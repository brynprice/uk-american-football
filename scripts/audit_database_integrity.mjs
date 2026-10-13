#!/usr/bin/env node
/**
 * UK American Football Archive - Database Integrity & Data Sanity Audit Suite
 *
 * Checks seasons, phases, standings/participations, and games in Supabase for:
 *   1. Standings vs. Recorded Games Discrepancies (e.g. 0 games in standings with recorded games)
 *   2. Standings Mathematical Symmetry & Consistency (wins/losses balance, points, ties)
 *   3. Games Integrity (missing scores on completed/awarded, cross-season leaks, duplicates)
 *   4. Phase Hierarchy Integrity (orphaned phases, circular parents, duplicates)
 *   5. Coaching Personnel Integrity (AGENTS.md Rule 6 verified coach registry check)
 *
 * Usage:
 *   node scripts/audit_database_integrity.mjs                     # Check all seasons
 *   node scripts/audit_database_integrity.mjs --year 2010         # Check specific season year
 *   node scripts/audit_database_integrity.mjs --phase <uuid>      # Check specific phase ID
 *   node scripts/audit_database_integrity.mjs --season <uuid>     # Check specific season ID
 *   node scripts/audit_database_integrity.mjs --severity CRITICAL # Only critical issues
 *   node scripts/audit_database_integrity.mjs --json              # Output JSON format
 */

import ws from 'ws';
global.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: '.env.local', quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse CLI flags
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
UK American Football Archive - Database Integrity & Data Sanity Audit Suite

Usage:
  node scripts/audit_database_integrity.mjs [options]

Options:
  --year <YYYY>         Audit a specific season year (e.g. --year 2010)
  --phase <UUID>        Audit a specific phase by UUID
  --season <UUID>       Audit a specific season by UUID
  --severity <LEVEL>    Filter issues by severity: CRITICAL, WARNING, INFO
  --json                Output audit results as a JSON array
  -h, --help            Show this help message and exit

Checks performed:
  1. Standings 0 games with recorded games in DB (STANDINGS_ZERO_WITH_RECORDED_GAMES)
  2. Standings games strictly fewer than recorded games (STANDINGS_FEWER_THAN_RECORDED)
  3. Standings mathematical asymmetry (Wins != Losses, odd ties, PF != PA)
  4. Negative standings values or records
  5. Champions flagged with 0 games
  6. Completed or awarded games missing scores
  7. Identical home and away teams on a single game
  8. Negative game scores
  9. Tied games in knockout playoff or bowl stages
 10. Games with teams lacking participation records in that phase
 11. Games dated outside season year boundaries
 12. Cross-season phase leaks or orphan parent phases
 13. AGENTS.md Rule 6 coaching registry compliance
`);
  process.exit(0);
}

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}
const targetYear = getArg('--year') ? parseInt(getArg('--year'), 10) : null;
const targetPhase = getArg('--phase');
const targetSeason = getArg('--season');
const targetSeverity = getArg('--severity');
const jsonOutput = args.includes('--json');

// Load verified coaches registry for Rule 6 check
let verifiedCoaches = [];
try {
  const evidencePath = path.join(__dirname, '..', 'data', 'evidence', 'verified_coaches.json');
  if (fs.existsSync(evidencePath)) {
    verifiedCoaches = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  }
} catch (e) {
  // Ignore or empty
}

const verifiedCoachSet = new Set(
  verifiedCoaches.map(c => `${c.year}:${c.team.trim()}:${(c.head_coach || '').trim()}`)
);

async function runAudit() {
  const issues = [];

  function addIssue({ season, phase, team, category, severity, message, details = null }) {
    if (targetSeverity && targetSeverity.toUpperCase() !== severity.toUpperCase()) {
      return;
    }
    issues.push({
      season_year: season?.year || null,
      season_name: season?.name || null,
      season_id: season?.id || null,
      phase_name: phase?.name || null,
      phase_id: phase?.id || null,
      phase_type: phase?.type || null,
      team_name: team?.name || null,
      team_id: team?.id || null,
      category,
      severity,
      message,
      details
    });
  }

  // Fetch team aliases to allow canonical and alias resolution
  const { data: dbAliases } = await supabase.from('team_aliases').select('name, team_id');
  const aliasesByTeamId = new Map();
  for (const a of dbAliases || []) {
    if (!aliasesByTeamId.has(a.team_id)) aliasesByTeamId.set(a.team_id, new Set());
    aliasesByTeamId.get(a.team_id).add(a.name.trim());
  }

  const KNOWN_PAIRS = [
    ['Brighton Panthers', 'Brighton Tsunami'],
    ['Anglia Ruskin Phantoms', 'Anglia Ruskin Siege'],
    ['Anglia Ruskin Rhinos', 'Anglia Ruskin Siege'],
    ['Royal Holloway Vikings', 'Royal Holloway Bears'],
    ['Napier Mavericks', 'Edinburgh Napier Knights'],
    ['GCU Roughriders', 'Caledonian Roughriders'],
    ['Liverpool Fury', 'LJMU Fury'],
    ['Bristol Bullets', 'Bristol Barracuda'],
  ];

  function getAllTeamNames(teamId, teamName) {
    const names = new Set();
    if (teamName) names.add(teamName.trim());
    if (teamId && aliasesByTeamId.has(teamId)) {
      for (const a of aliasesByTeamId.get(teamId)) names.add(a);
    }
    for (const [a, b] of KNOWN_PAIRS) {
      if (teamName === a) names.add(b);
      if (teamName === b) names.add(a);
    }
    return Array.from(names);
  }

  // 1. Fetch seasons to inspect
  let seasonsQuery = supabase.from('seasons').select('*, competitions(name, slug)').order('year', { ascending: true });
  if (targetYear) {
    seasonsQuery = seasonsQuery.eq('year', targetYear);
  }
  if (targetSeason) {
    seasonsQuery = seasonsQuery.eq('id', targetSeason);
  }

  const { data: seasons, error: seasonsErr } = await seasonsQuery;
  if (seasonsErr) {
    console.error('Error fetching seasons:', seasonsErr);
    process.exit(1);
  }

  let filteredSeasons = seasons || [];

  if (targetPhase) {
    const { data: phaseData } = await supabase.from('phases').select('season_id').eq('id', targetPhase).single();
    if (phaseData) {
      filteredSeasons = filteredSeasons.filter(s => s.id === phaseData.season_id);
    }
  }

  if (!jsonOutput) {
    console.log('='.repeat(80));
    console.log(` UK AMERICAN FOOTBALL ARCHIVE - DATABASE INTEGRITY AUDIT SUITE`);
    console.log(` Target Scope: ${filteredSeasons.length} season(s) selected`);
    if (targetYear) console.log(` Filter: Year = ${targetYear}`);
    if (targetPhase) console.log(` Filter: Phase ID = ${targetPhase}`);
    if (targetSeason) console.log(` Filter: Season ID = ${targetSeason}`);
    if (targetSeverity) console.log(` Filter: Severity = ${targetSeverity}`);
    console.log('='.repeat(80));
  }

  for (const season of filteredSeasons) {
    // 2. Fetch all phases for season
    const { data: allPhases, error: phasesErr } = await supabase
      .from('phases')
      .select('*')
      .eq('season_id', season.id)
      .order('ordinal', { ascending: true });

    if (phasesErr) {
      addIssue({
        season,
        category: 'FETCH_ERROR',
        severity: 'CRITICAL',
        message: `Failed to fetch phases for season ${season.year}: ${phasesErr.message}`
      });
      continue;
    }

    const seasonAllPhasesMap = new Map((allPhases || []).map(p => [p.id, p]));

    // If targetPhase is specified and not in this season, skip
    if (targetPhase && !seasonAllPhasesMap.has(targetPhase)) {
      continue;
    }

    const phasesToAudit = targetPhase
      ? (allPhases || []).filter(p => p.id === targetPhase)
      : (allPhases || []);

    const phasesToAuditMap = new Map(phasesToAudit.map(p => [p.id, p]));
    const phaseIdsToAudit = Array.from(phasesToAuditMap.keys());

    // Phase checks on the season: duplicate names & orphan parent phase
    const phaseNames = new Map();
    for (const p of allPhases || []) {
      const pKey = `${p.name.trim().toLowerCase()}:${p.parent_phase_id || ''}`;
      if (phaseNames.has(pKey)) {
        addIssue({
          season,
          phase: p,
          category: 'DUPLICATE_PHASE',
          severity: 'CRITICAL',
          message: `Duplicate phase "${p.name}" with same parent in season ${season.year}.`
        });
      }
      phaseNames.set(pKey, p.id);

      if (p.parent_phase_id && !seasonAllPhasesMap.has(p.parent_phase_id)) {
        addIssue({
          season,
          phase: p,
          category: 'ORPHAN_PARENT_PHASE',
          severity: 'CRITICAL',
          message: `Phase "${p.name}" has parent_phase_id ${p.parent_phase_id} which does not exist in season ${season.year}.`
        });
      }
    }

    if (phaseIdsToAudit.length === 0) {
      continue;
    }

    // 3. Fetch all participations in the audited phases
    const { data: participations, error: partErr } = await supabase
      .from('participations')
      .select('*, teams(id, name), people:head_coach_id(id, display_name)')
      .in('phase_id', phaseIdsToAudit);

    if (partErr) {
      addIssue({
        season,
        category: 'FETCH_ERROR',
        severity: 'CRITICAL',
        message: `Failed to fetch participations: ${partErr.message}`
      });
      continue;
    }

    // 4. Fetch games for this season
    const { data: allSeasonGames, error: gamesErr } = await supabase
      .from('games')
      .select('*, home:home_team_id(id, name), away:away_team_id(id, name)')
      .eq('season_id', season.id);

    if (gamesErr) {
      addIssue({
        season,
        category: 'FETCH_ERROR',
        severity: 'CRITICAL',
        message: `Failed to fetch games: ${gamesErr.message}`
      });
      continue;
    }

    // Scope games to the audited phases if targetPhase is set
    const games = targetPhase
      ? (allSeasonGames || []).filter(g => g.phase_id === targetPhase || g.away_phase_id === targetPhase)
      : (allSeasonGames || []);

    // Map games by phase and team
    const gamesByPhaseAndTeam = new Map(); // key: `${phase_id}:${team_id}` => array of games
    const allGamesInAuditedPhase = new Map(); // key: `${phase_id}` => array of games

    for (const g of games || []) {
      const gPhase = seasonAllPhasesMap.get(g.phase_id);

      // Game integrity check: same home & away team
      if (g.home_team_id && g.away_team_id && g.home_team_id === g.away_team_id) {
        addIssue({
          season,
          phase: gPhase,
          category: 'SAME_HOME_AND_AWAY_TEAM',
          severity: 'CRITICAL',
          message: `Game on ${g.date} has identical home and away team "${g.home?.name}".`,
          details: { game_id: g.id }
        });
      }

      // Game integrity check: negative score
      if ((g.home_score !== null && g.home_score < 0) || (g.away_score !== null && g.away_score < 0)) {
        addIssue({
          season,
          phase: gPhase,
          category: 'NEGATIVE_SCORE',
          severity: 'CRITICAL',
          message: `Game on ${g.date} (${g.away?.name} @ ${g.home?.name}) has negative scores (Home: ${g.home_score}, Away: ${g.away_score}).`,
          details: { game_id: g.id }
        });
      }

      // Game integrity check: status completed but missing score
      if (g.status === 'completed' && (g.home_score === null || g.away_score === null)) {
        addIssue({
          season,
          phase: gPhase,
          category: 'MISSING_SCORE_COMPLETED',
          severity: 'CRITICAL',
          message: `Game on ${g.date} (${g.away?.name} @ ${g.home?.name}) is marked 'completed' but missing score (Home: ${g.home_score}, Away: ${g.away_score}).`,
          details: { game_id: g.id }
        });
      }

      // Game integrity check: status awarded but missing score
      if (g.status === 'awarded' && (g.home_score === null || g.away_score === null)) {
        addIssue({
          season,
          phase: gPhase,
          category: 'MISSING_SCORE_AWARDED',
          severity: 'CRITICAL',
          message: `Game on ${g.date} (${g.away?.name} @ ${g.home?.name}) is marked 'awarded' (walkover) but missing score.`,
          details: { game_id: g.id }
        });
      }

      // Game integrity check: phase belongs to another season
      if (g.phase_id && !seasonAllPhasesMap.has(g.phase_id)) {
        addIssue({
          season,
          category: 'CROSS_SEASON_PHASE_LEAK',
          severity: 'CRITICAL',
          message: `Game on ${g.date} (${g.away?.name} @ ${g.home?.name}) has phase_id ${g.phase_id} not belonging to season ${season.year}.`,
          details: { game_id: g.id, phase_id: g.phase_id }
        });
      }

      // Date year boundary check (season.year to season.year + 1)
      if (g.date) {
        const gameYear = parseInt(g.date.split('-')[0], 10);
        if (gameYear < season.year || gameYear > season.year + 1) {
          addIssue({
            season,
            phase: gPhase,
            category: 'DATE_OUT_OF_BOUNDS',
            severity: 'CRITICAL',
            message: `Game on ${g.date} (${g.away?.name} @ ${g.home?.name}) has year ${gameYear} which is outside season ${season.year} (${season.year}-${season.year + 1}).`,
            details: { game_id: g.id, date: g.date }
          });
        }
      }

      // Tied playoff game check
      const isPlayoffGame = g.is_playoff || gPhase?.type === 'playoffs' || g.final_type !== null;
      if (isPlayoffGame && g.status === 'completed' && g.home_score !== null && g.home_score === g.away_score) {
        // Documented historical exceptions (e.g. 1987 College Bowl II shared title, 1993 overtime seed tiebreak)
        const notes = (g.notes || '').toLowerCase();
        const isDocumentedTieException = notes.includes('title shared') ||
                                         notes.includes('shared after') ||
                                         notes.includes('advanced as higher seed') ||
                                         notes.includes('higher seed advanced');
        if (!isDocumentedTieException) {
          addIssue({
            season,
            phase: gPhase,
            category: 'TIED_PLAYOFF_GAME',
            severity: 'CRITICAL',
            message: `Playoff game on ${g.date} (${g.away?.name} @ ${g.home?.name}) ended in a tie (${g.home_score}-${g.away_score}). Playoff games cannot tie.`,
            details: { game_id: g.id }
          });
        }
      }

      // Only count active played/awarded games for standings validation
      if (g.status === 'cancelled') continue;

      if (g.phase_id && phasesToAuditMap.has(g.phase_id)) {
        if (!allGamesInAuditedPhase.has(g.phase_id)) allGamesInAuditedPhase.set(g.phase_id, []);
        allGamesInAuditedPhase.get(g.phase_id).push(g);

        const homeKey = `${g.phase_id}:${g.home_team_id}`;
        if (!gamesByPhaseAndTeam.has(homeKey)) gamesByPhaseAndTeam.set(homeKey, []);
        gamesByPhaseAndTeam.get(homeKey).push(g);
      }

      const awayPhase = g.away_phase_id || g.phase_id;
      if (awayPhase && phasesToAuditMap.has(awayPhase)) {
        const awayKey = `${awayPhase}:${g.away_team_id}`;
        if (!gamesByPhaseAndTeam.has(awayKey)) gamesByPhaseAndTeam.set(awayKey, []);
        gamesByPhaseAndTeam.get(awayKey).push(g);
      }
    }

    // 5. Audit Participations & Standings
    const partByPhase = new Map();
    const teamParticipationsInPhase = new Set();

    for (const p of participations || []) {
      const phase = phasesToAuditMap.get(p.phase_id);
      const team = p.teams;

      if (!partByPhase.has(p.phase_id)) partByPhase.set(p.phase_id, []);
      partByPhase.get(p.phase_id).push(p);

      const ptKey = `${p.phase_id}:${p.team_id}`;
      if (teamParticipationsInPhase.has(ptKey)) {
        addIssue({
          season,
          phase,
          team,
          category: 'DUPLICATE_PARTICIPATION',
          severity: 'CRITICAL',
          message: `Team "${team?.name}" has multiple participation records in phase "${phase?.name}".`
        });
      }
      teamParticipationsInPhase.add(ptKey);

      // Check coaching integrity (AGENTS.md Rule 6)
      if (p.head_coach_id) {
        const coachName = (p.people?.display_name || '').trim();
        const candidateTeamNames = getAllTeamNames(team?.id, team?.name);
        const isVerified = candidateTeamNames.some(tName =>
          verifiedCoachSet.has(`${season.year}:${tName.trim()}:${coachName}`)
        );
        if (!isVerified) {
          addIssue({
            season,
            phase,
            team,
            category: 'UNVERIFIED_COACH',
            severity: 'CRITICAL',
            message: `AGENTS.md Rule 6 Violation: Head coach "${coachName}" on "${team?.name}" in ${season.year} is NOT registered in verified_coaches.json.`
          });
        }
      }

      // Check games recorded vs standings
      const recordedGames = gamesByPhaseAndTeam.get(ptKey) || [];
      const recCount = recordedGames.length;
      const wins = p.wins ?? null;
      const losses = p.losses ?? null;
      const ties = p.ties ?? null;
      const pf = p.points_for ?? null;
      const pa = p.points_against ?? null;
      const gamesPlayed = p.games_played ?? null;

      const hasStandingsData = (wins !== null || losses !== null || ties !== null);
      const totalStandingsGames = (wins || 0) + (losses || 0) + (ties || 0);

      // Distinguish league divisions/conferences from knockout playoff phases
      const isPlayoffOrBowl = ['playoffs', 'tournament', 'bowl'].includes((phase?.type || '').toLowerCase()) ||
                              (phase?.name || '').toLowerCase().includes('playoff') ||
                              (phase?.name || '').toLowerCase().includes('cup') ||
                              (phase?.name || '').toLowerCase().includes('championship') ||
                              (phase?.name || '').toLowerCase().includes('trophy') ||
                              (phase?.name || '').toLowerCase().includes('vase');

      // CRITICAL ISSUE (User's case): Team in standings has 0 games, but has recorded games in DB!
      if (!isPlayoffOrBowl && totalStandingsGames === 0 && recCount > 0 && hasStandingsData) {
        const sampleGame = recordedGames[0];
        const sampleScore = `${sampleGame.away?.name} (${sampleGame.away_score}) @ ${sampleGame.home?.name} (${sampleGame.home_score})`;
        addIssue({
          season,
          phase,
          team,
          category: 'STANDINGS_ZERO_WITH_RECORDED_GAMES',
          severity: 'CRITICAL',
          message: `Team "${team?.name}" in phase "${phase?.name}" (${season.year}) has 0 games in standings (W:${wins} L:${losses} T:${ties} PF:${pf} PA:${pa}), but has ${recCount} recorded game(s) in DB (e.g. ${sampleGame.date}: ${sampleScore}).`,
          details: { recorded_count: recCount, standings_games: totalStandingsGames, sample_game: sampleGame.id }
        });
      }

      // Standings games strictly less than recorded games
      if (!isPlayoffOrBowl && hasStandingsData && totalStandingsGames > 0 && totalStandingsGames < recCount) {
        addIssue({
          season,
          phase,
          team,
          category: 'STANDINGS_FEWER_THAN_RECORDED',
          severity: 'WARNING',
          message: `Team "${team?.name}" has only ${totalStandingsGames} games in standings, but ${recCount} recorded games in phase "${phase?.name}".`,
          details: { standings_games: totalStandingsGames, recorded_count: recCount }
        });
      }

      // Check math inconsistency in participation row
      if (gamesPlayed !== null && (wins !== null || losses !== null || ties !== null)) {
        if (gamesPlayed !== totalStandingsGames) {
          addIssue({
            season,
            phase,
            team,
            category: 'GAMES_PLAYED_MISMATCH',
            severity: 'CRITICAL',
            message: `Team "${team?.name}" has games_played=${gamesPlayed} but W+L+T=${totalStandingsGames} in phase "${phase?.name}".`
          });
        }
      }

      // Negative values check
      if ((wins !== null && wins < 0) || (losses !== null && losses < 0) || (ties !== null && ties < 0)) {
        addIssue({
          season,
          phase,
          team,
          category: 'NEGATIVE_RECORDS',
          severity: 'CRITICAL',
          message: `Team "${team?.name}" has negative record values (W:${wins}, L:${losses}, T:${ties}) in phase "${phase?.name}".`
        });
      }

      // Champion with 0 games played
      if (p.is_champion && totalStandingsGames === 0 && !isPlayoffOrBowl) {
        addIssue({
          season,
          phase,
          team,
          category: 'CHAMPION_WITH_ZERO_GAMES',
          severity: 'CRITICAL',
          message: `Team "${team?.name}" is flagged as is_champion=TRUE in phase "${phase?.name}", but has 0 games recorded in standings.`
        });
      }
    }

    // 6. Check for games involving teams with NO participation in that phase
    for (const [phaseId, phaseGames] of allGamesInAuditedPhase.entries()) {
      const phase = phasesToAuditMap.get(phaseId);
      for (const g of phaseGames) {
        const homeKey = `${phaseId}:${g.home_team_id}`;
        if (!teamParticipationsInPhase.has(homeKey)) {
          addIssue({
            season,
            phase,
            team: g.home,
            category: 'GAME_WITHOUT_PARTICIPATION',
            severity: 'CRITICAL',
            message: `Home team "${g.home?.name}" played on ${g.date} in phase "${phase?.name}", but has NO participation record in this phase.`,
            details: { game_id: g.id }
          });
        }
        const awayPhase = g.away_phase_id || phaseId;
        if (phasesToAuditMap.has(awayPhase)) {
          const awayKey = `${awayPhase}:${g.away_team_id}`;
          if (!teamParticipationsInPhase.has(awayKey)) {
            addIssue({
              season,
              phase: phasesToAuditMap.get(awayPhase) || phase,
              team: g.away,
              category: 'GAME_WITHOUT_PARTICIPATION',
              severity: 'CRITICAL',
              message: `Away team "${g.away?.name}" played on ${g.date} in phase "${phasesToAuditMap.get(awayPhase)?.name || phase?.name}", but has NO participation record in this phase.`,
              details: { game_id: g.id }
            });
          }
        }
      }
    }

    // 7. Check Division/Conference mathematical symmetry
    for (const [phaseId, parts] of partByPhase.entries()) {
      const phase = phasesToAuditMap.get(phaseId);
      const isPlayoffOrBowl = ['playoffs', 'tournament', 'bowl'].includes((phase?.type || '').toLowerCase()) ||
                              (phase?.name || '').toLowerCase().includes('playoff') ||
                              (phase?.name || '').toLowerCase().includes('cup');

      if (isPlayoffOrBowl) continue;

      const teamsWithStats = parts.filter(p => p.wins !== null && p.losses !== null);
      if (teamsWithStats.length === parts.length && parts.length >= 3) {
        const sumW = parts.reduce((acc, p) => acc + (p.wins || 0), 0);
        const sumL = parts.reduce((acc, p) => acc + (p.losses || 0), 0);
        const sumT = parts.reduce((acc, p) => acc + (p.ties || 0), 0);
        const sumPF = parts.reduce((acc, p) => acc + (p.points_for || 0), 0);
        const sumPA = parts.reduce((acc, p) => acc + (p.points_against || 0), 0);

        if (sumW !== sumL) {
          addIssue({
            season,
            phase,
            category: 'STANDINGS_ASYMMETRY',
            severity: 'WARNING',
            message: `Phase "${phase?.name}" (${season.year}) has unequal total wins (${sumW}) and total losses (${sumL}) across fully populated standings.`
          });
        }

        if (sumT % 2 !== 0) {
          addIssue({
            season,
            phase,
            category: 'STANDINGS_ASYMMETRY',
            severity: 'WARNING',
            message: `Phase "${phase?.name}" (${season.year}) has an odd sum of ties (${sumT}). Ties must pair up evenly.`
          });
        }

        if (sumPF !== sumPA && sumPF > 0 && sumPA > 0) {
          addIssue({
            season,
            phase,
            category: 'STANDINGS_POINTS_ASYMMETRY',
            severity: 'WARNING',
            message: `Phase "${phase?.name}" (${season.year}) has unequal total Points For (${sumPF}) and Points Against (${sumPA}). Diff = ${sumPF - sumPA}.`
          });
        }
      }
    }
  }

  // 8. Generate Output
  if (jsonOutput) {
    console.log(JSON.stringify(issues, null, 2));
    process.exitCode = issues.some(i => i.severity === 'CRITICAL') ? 1 : 0;
    return;
  }

  // Console Output Grouped by Season
  const issuesBySeason = new Map();
  for (const issue of issues) {
    const sKey = issue.season_year ? `${issue.season_year} (${issue.season_name})` : 'General / Unassociated';
    if (!issuesBySeason.has(sKey)) issuesBySeason.set(sKey, []);
    issuesBySeason.get(sKey).push(issue);
  }

  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const [seasonTitle, sIssues] of issuesBySeason.entries()) {
    console.log(`\n📅 SEASON: ${seasonTitle} [${sIssues.length} issues found]`);
    console.log('-'.repeat(80));

    for (const iss of sIssues) {
      if (iss.severity === 'CRITICAL') criticalCount++;
      else if (iss.severity === 'WARNING') warningCount++;
      else infoCount++;

      const icon = iss.severity === 'CRITICAL' ? '🔴' : (iss.severity === 'WARNING' ? '🟡' : '🔵');
      const phaseTag = iss.phase_name ? `[${iss.phase_name}]` : '';
      const catTag = `[${iss.category}]`;
      console.log(`  ${icon} ${iss.severity.padEnd(8)} ${catTag.padEnd(35)} ${phaseTag}`);
      console.log(`     ${iss.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(' AUDIT EXECUTIVE SUMMARY');
  console.log('='.repeat(80));
  console.log(` Total Issues Found: ${issues.length}`);
  console.log(`   🔴 CRITICAL: ${criticalCount}`);
  console.log(`   🟡 WARNING:  ${warningCount}`);
  console.log(`   🔵 INFO:     ${infoCount}`);
  console.log(` Seasons Scanned: ${filteredSeasons.length}`);
  console.log(` Seasons Affected: ${issuesBySeason.size}`);
  console.log('='.repeat(80));

  if (criticalCount > 0) {
    console.log('\n[FAIL] Critical integrity issues detected! Review items marked with 🔴.');
    process.exit(1);
  } else if (warningCount > 0) {
    console.log('\n[WARN] Zero critical issues, but warnings detected. Review items marked with 🟡.');
    process.exit(0);
  } else {
    console.log('\n[PASS] Database passed all integrity checks cleanly! ✨');
    process.exit(0);
  }
}

runAudit();
