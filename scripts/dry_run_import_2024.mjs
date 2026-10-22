import ws from 'ws';
global.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function dryRunImport2024() {
  console.log('='.repeat(80));
  console.log(' DRY RUN IMPORT: 2024 BAFANL SEASON');
  console.log(' Mode: READ-ONLY (No changes will be written to Supabase)');
  console.log('='.repeat(80));

  const stats = {
    season: { id: null, year: 2024, expected_participants: 58 },
    phases: { total: 0, matched: 0, missing: 0 },
    participations: { total: 0, matchedTeams: 0, unmappedTeams: [] },
    standings: { total: 0, champions: 0, validMath: 0 },
    coaches: { verified: 0, foundInDb: 0, missingFromDb: [] },
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

  const { data: season } = await supabase.from('seasons').select('*').eq('competition_id', comp.id).eq('year', 2024).single();
  if (!season) {
    console.error('❌ Season 2024 not found for BAFANL!');
    return;
  }
  stats.season.id = season.id;
  console.log(`  ✓ Season: ${season.year} (id: ${season.id})`);
  console.log(`    - expected_participants: ${season.expected_participants}`);
  console.log(`    - date range: ${season.start_date} to ${season.end_date}`);

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

  // 3. Fetch and Index Teams & People
  console.log('\n[3/5] Verifying Teams, Aliases, and Coaches...');
  const { data: allTeams } = await supabase.from('teams').select('id, name, team_type');
  const teamByName = new Map();
  for (const t of allTeams) {
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

  const { data: allPeople } = await supabase.from('people').select('id, first_name, last_name, display_name');
  const peopleMap = new Map();
  for (const p of allPeople) {
    if (p.display_name) peopleMap.set(p.display_name.toLowerCase(), p.id);
    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim().toLowerCase();
    if (fullName) peopleMap.set(fullName, p.id);
  }

  // 4. Test Standings & Participations
  console.log('\n[4/5] Testing Standings and Participations...');
  const standingsRows = parse(fs.readFileSync('data/BAFANL/standings2024.csv', 'utf8'), { columns: true, skip_empty_lines: true });
  stats.standings.total = standingsRows.length;

  for (const s of standingsRows) {
    const t = resolveTeam(s.team);
    if (!t) {
      stats.participations.unmappedTeams.push(s.team);
    } else {
      stats.participations.matchedTeams++;
      if (t.team_type !== 'Adult') {
        console.warn(`    ⚠️ Warning: Team "${s.team}" has team_type="${t.team_type}" (expected "Adult")`);
      }
    }

    const pId = resolvePhaseId(s.phase, s.parent_phase);
    if (!pId) {
      console.error(`    ❌ Unresolved phase: "${s.phase}" (parent: "${s.parent_phase}")`);
    }

    if (s.is_champion === 'TRUE') stats.standings.champions++;

    const w = parseInt(s.wins, 10);
    const l = parseInt(s.losses, 10);
    const ties = parseInt(s.ties, 10);
    const gp = parseInt(s.games_played, 10);
    if (w + l + ties === gp) stats.standings.validMath++;

    if (s.head_coach) {
      stats.coaches.verified++;
      const coachId = peopleMap.get(s.head_coach.toLowerCase());
      if (coachId) {
        stats.coaches.foundInDb++;
      } else {
        stats.coaches.missingFromDb.push(s.head_coach);
      }
    }
  }

  console.log(`  ✓ Checked ${stats.standings.total} standings rows.`);
  console.log(`    - Matched Teams: ${stats.participations.matchedTeams} / ${stats.standings.total}`);
  console.log(`    - Mathematical Integrity (W+L+T == GP): ${stats.standings.validMath} / ${stats.standings.total}`);
  console.log(`    - Division Champions: ${stats.standings.champions} (expected 12)`);
  console.log(`    - Verified Head Coaches: ${stats.coaches.verified} (Found in DB: ${stats.coaches.foundInDb}, Will insert: ${stats.coaches.missingFromDb.length})`);
  if (stats.coaches.missingFromDb.length > 0) {
    console.log(`      * Coaches to auto-create in people table: ${[...new Set(stats.coaches.missingFromDb)].join(', ')}`);
  }

  // 5. Test Games Fixture Mapping
  console.log('\n[5/5] Testing Games Fixtures...');
  const gamesRows = parse(fs.readFileSync('data/BAFANL/games2024.csv', 'utf8'), { columns: true, skip_empty_lines: true });
  stats.games.total = gamesRows.length;

  const teamDivisionMap = Object.fromEntries(standingsRows.map(s => [s.team, s.phase]));

  for (const g of gamesRows) {
    if (g.is_playoff === 'TRUE') stats.games.playoffs++;
    else stats.games.regularSeason++;

    if (g.is_title_game === 'TRUE') stats.games.titleGames++;
    if (g.status === 'cancelled') stats.games.cancelled++;

    const home = resolveTeam(g.home_team);
    const away = resolveTeam(g.away_team);
    if (!home) stats.games.unresolvedTeams.push(g.home_team);
    if (!away) stats.games.unresolvedTeams.push(g.away_team);

    const phaseId = resolvePhaseId(g.phase, g.parent_phase);
    if (!phaseId) {
      stats.games.unresolvedPhases.push(`${g.phase} (parent: ${g.parent_phase})`);
    }

    if (g.is_playoff !== 'TRUE' && home && away) {
      const homeDiv = teamDivisionMap[g.home_team];
      const awayDiv = teamDivisionMap[g.away_team];
      if (homeDiv && awayDiv && homeDiv !== awayDiv) {
        stats.games.interDivisional++;
      }
    }
  }

  console.log(`  ✓ Checked ${stats.games.total} games rows.`);
  console.log(`    - Regular Season: ${stats.games.regularSeason}`);
  console.log(`    - Postseason / Playoffs: ${stats.games.playoffs}`);
  console.log(`    - Title Games (Britbowl + Conference Finals): ${stats.games.titleGames}`);
  console.log(`    - Inter-Divisional Games: ${stats.games.interDivisional}`);
  console.log(`    - Unresolved Teams: ${stats.games.unresolvedTeams.length}`);
  console.log(`    - Unresolved Phases: ${stats.games.unresolvedPhases.length}`);

  // Summary Report
  console.log('\n' + '='.repeat(80));
  console.log(' DRY RUN EXECUTIVE SUMMARY');
  console.log('='.repeat(80));
  const hasErrors =
    stats.participations.unmappedTeams.length > 0 ||
    stats.games.unresolvedTeams.length > 0 ||
    stats.games.unresolvedPhases.length > 0 ||
    stats.standings.champions !== 12;

  if (hasErrors) {
    console.error('❌ Dry run encountered validation errors!');
  } else {
    console.log('✨ [SUCCESS] 2024 Dry Run Completed with ZERO errors!');
    console.log('   Ready for production clean & re-import.');
  }
  console.log('='.repeat(80));
}

dryRunImport2024().catch(console.error);
