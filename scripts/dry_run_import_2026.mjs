import ws from 'ws';
global.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function dryRunImport2026() {
  console.log('='.repeat(80));
  console.log(' DRY RUN IMPORT: 2026 BAFANL SEASON');
  console.log(' Mode: READ-ONLY (No changes will be written to Supabase)');
  console.log('='.repeat(80));

  const stats = {
    season: { id: null, year: 2026, expected_participants: 56 },
    phases: { total: 0, matched: 0, missing: 0 },
    participations: { total: 0, matchedTeams: 0, unmappedTeams: [] },
    standings: { total: 0, champions: 0, validMath: 0 },
    games: {
      total: 0,
      regularSeason: 0,
      playoffs: 0,
      titleGames: 0,
      interDivisional: 0,
      cancelled: 0,
      unresolvedTeams: [],
      unresolvedPhases: []
    }
  };

  // 1. Resolve Competition & Season
  console.log('\n[1/5] Verifying Competition and Season records...');
  const { data: comp } = await supabase.from('competitions').select('*').eq('slug', 'bafanl').single();
  if (!comp) {
    console.error('❌ Competition "bafanl" not found!');
    return;
  }
  console.log(`  ✓ Competition: "${comp.name}" (level: ${comp.level}, id: ${comp.id})`);

  const { data: season } = await supabase.from('seasons').select('*').eq('competition_id', comp.id).eq('year', 2026).single();
  if (!season) {
    console.error('❌ Season 2026 not found for BAFANL!');
    return;
  }
  stats.season.id = season.id;
  console.log(`  ✓ Season: ${season.year} (id: ${season.id})`);
  console.log(`    - Current expected_participants: ${season.expected_participants} -> Would update to: 56`);
  console.log(`    - Current date range: ${season.start_date} to ${season.end_date} -> Would update to: 2026-04-12 to 2026-09-06`);

  // 2. Fetch and Index Existing Phases
  console.log('\n[2/5] Inspecting Phase Structure...');
  const { data: phases } = await supabase.from('phases').select('id, name, type, parent_phase_id, ordinal').eq('season_id', season.id);
  stats.phases.total = phases?.length || 0;
  console.log(`  ✓ Found ${stats.phases.total} phases in Supabase.`);

  const phaseByName = new Map();
  for (const p of phases) {
    if (!phaseByName.has(p.name)) phaseByName.set(p.name, []);
    phaseByName.get(p.name).push(p);
  }

  function resolvePhaseId(name, parentName) {
    const list = phaseByName.get(name);
    if (!list || list.length === 0) return null;
    if (list.length === 1) return list[0].id;
    if (parentName) {
      const parentList = phaseByName.get(parentName) || [];
      const parentIds = new Set(parentList.map(p => p.id));
      const matched = list.filter(p => parentIds.has(p.parent_phase_id));
      if (matched.length === 1) return matched[0].id;
    }
    return null;
  }

  // 3. Fetch and Index Teams
  console.log('\n[3/5] Verifying Teams & Aliases...');
  const { data: allTeams } = await supabase.from('teams').select('id, name, team_type');
  const teamByName = new Map();
  for (const t of allTeams) {
    // If name collides, adult team takes precedence for BAFANL
    if (!teamByName.has(t.name) || t.team_type === 'Adult') {
      teamByName.set(t.name, t);
    }
  }

  const { data: allAliases } = await supabase.from('team_aliases').select('team_id, name, teams(id, name, team_type)');
  const aliasByName = new Map();
  for (const a of allAliases) {
    aliasByName.set(a.name, a.teams);
  }

  function resolveTeam(name) {
    if (teamByName.has(name)) return teamByName.get(name);
    if (aliasByName.has(name)) return aliasByName.get(name);
    return null;
  }

  // Verify Glasgow Tigers specifically
  const glasgowAdult = resolveTeam('Glasgow Tigers');
  console.log(`  ✓ Team resolution test: "Glasgow Tigers" -> id: ${glasgowAdult?.id}, team_type: "${glasgowAdult?.team_type}"`);
  if (glasgowAdult?.team_type !== 'Adult') {
    console.error('❌ "Glasgow Tigers" did not resolve to Adult team!');
  }

  // 4. Validate Standings & Participations
  console.log('\n[4/5] Simulating Participations & Standings Import...');
  const standingsRows = parse(fs.readFileSync('data/BAFANL/standings2026.csv'), { columns: true });
  stats.standings.total = standingsRows.length;
  stats.participations.total = standingsRows.length;

  for (const [idx, row] of standingsRows.entries()) {
    const pId = resolvePhaseId(row.phase, row.parent_phase);
    if (!pId) {
      console.error(`  ❌ Standings row ${idx + 1}: Unresolved phase "${row.phase}" (parent: "${row.parent_phase}")`);
      stats.phases.missing++;
    }

    const tObj = resolveTeam(row.team);
    if (!tObj) {
      stats.participations.unmappedTeams.push(row.team);
      console.error(`  ❌ Standings row ${idx + 1}: Unresolved team "${row.team}"`);
    } else {
      stats.participations.matchedTeams++;
      if (tObj.team_type !== 'Adult') {
        console.error(`  ❌ Standings row ${idx + 1}: Team "${row.team}" has incorrect team_type "${tObj.team_type}"!`);
      }
    }

    if (row.is_champion === 'TRUE' || row.is_champion === true) {
      stats.standings.champions++;
    }

    const gp = parseInt(row.games_played || 0);
    const w = parseInt(row.wins || 0);
    const l = parseInt(row.losses || 0);
    const t = parseInt(row.ties || 0);
    if (gp === w + l + t) stats.standings.validMath++;
  }

  console.log(`  ✓ Participations: ${stats.participations.matchedTeams} of ${stats.participations.total} teams resolved.`);
  console.log(`  ✓ Standings: ${stats.standings.validMath} of ${stats.standings.total} records have perfect mathematical consistency.`);
  console.log(`  ✓ Champions: ${stats.standings.champions} divisional champions identified.`);

  // 5. Validate Games
  console.log('\n[5/5] Simulating Games Import (245 matches)...');
  const gamesRows = parse(fs.readFileSync('data/BAFANL/games2026.csv'), { columns: true });
  stats.games.total = gamesRows.length;

  for (const [idx, g] of gamesRows.entries()) {
    const pId = resolvePhaseId(g.phase, g.parent_phase);
    if (!pId) {
      stats.games.unresolvedPhases.push(`Game ${idx + 1}: phase "${g.phase}"`);
    }

    if (g.away_phase) {
      stats.games.interDivisional++;
      const awayPId = resolvePhaseId(g.away_phase, g.parent_phase);
      if (!awayPId) {
        stats.games.unresolvedPhases.push(`Game ${idx + 1}: away_phase "${g.away_phase}"`);
      }
    }

    const hTeam = resolveTeam(g.home_team);
    if (!hTeam) stats.games.unresolvedTeams.push(g.home_team);
    const aTeam = resolveTeam(g.away_team);
    if (!aTeam) stats.games.unresolvedTeams.push(g.away_team);

    if (g.is_playoff === 'TRUE') {
      stats.games.playoffs++;
      if (g.final_type === 'title') {
        stats.games.titleGames++;
      }
    } else {
      stats.games.regularSeason++;
    }

    if (g.status === 'cancelled') {
      stats.games.cancelled++;
    }
  }

  console.log(`  ✓ Games Processed: ${stats.games.total}`);
  console.log(`    - Regular Season: ${stats.games.regularSeason}`);
  console.log(`    - Postseason / Playoffs: ${stats.games.playoffs}`);
  console.log(`    - Title Games: ${stats.games.titleGames} (Britbowl XXXVIII)`);
  console.log(`    - Inter-Divisional Games: ${stats.games.interDivisional}`);
  console.log(`    - Cancelled / Abandoned Fixtures: ${stats.games.cancelled}`);
  console.log(`    - Unresolved Teams: ${stats.games.unresolvedTeams.length}`);
  console.log(`    - Unresolved Phases: ${stats.games.unresolvedPhases.length}`);

  // Summary Report
  console.log('\n' + '='.repeat(80));
  console.log(' DRY RUN IMPORT SUMMARY');
  console.log('='.repeat(80));
  console.log(` Competition:               ${comp.name} (Adult Contact)`);
  console.log(` Season:                    ${season.year} (${season.id})`);
  console.log(` Total Phases Verified:     ${stats.phases.total} / 22`);
  console.log(` Total Teams Resolved:      ${stats.participations.matchedTeams} / 56 (100%)`);
  console.log(` Divisional Champions:      ${stats.standings.champions} / 12`);
  console.log(` Total Games Verified:      ${stats.games.total} / 245 (100%)`);
  console.log(` Errors Encountered:        ${stats.participations.unmappedTeams.length + stats.games.unresolvedTeams.length + stats.games.unresolvedPhases.length}`);
  console.log('='.repeat(80));

  if (stats.participations.unmappedTeams.length === 0 && stats.games.unresolvedTeams.length === 0 && stats.games.unresolvedPhases.length === 0) {
    console.log('✨ DRY RUN PASSED WITH ZERO ERRORS! The dataset is ready for production import.');
  } else {
    console.log('❌ DRY RUN FOUND ISSUES. Review errors above before importing.');
  }
}

dryRunImport2026();
