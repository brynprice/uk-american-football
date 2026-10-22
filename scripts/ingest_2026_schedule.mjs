#!/usr/bin/env node
/**
 * Ingest 2026/27 BUCS Fixtures into Supabase & Generate Canonical CSVs
 */

import ws from 'ws';
global.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local', quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const isDryRun = process.argv.includes('--dry-run');

// 27 Phases Hierarchy
const PHASES_SPEC = [
  { ordinal: 1, name: "Premier", type: "Tier", parent: null },
  { ordinal: 2, name: "National Championship", type: "Playoffs", parent: "Premier" },
  { ordinal: 3, name: "National Vase", type: "Playoffs", parent: "Premier" },
  { ordinal: 4, name: "Premier (National)", type: "Division", parent: "Premier" },
  { ordinal: 5, name: "Premier North", type: "Division", parent: "Premier" },
  { ordinal: 6, name: "Premier South", type: "Division", parent: "Premier" },
  { ordinal: 7, name: "Division 1", type: "Tier", parent: null },
  { ordinal: 8, name: "National Trophy", type: "Playoffs", parent: "Division 1" },
  { ordinal: 9, name: "Division 1 North", type: "Conference", parent: "Division 1" },
  { ordinal: 10, name: "Division 1 Scottish", type: "Division", parent: "Division 1 North" },
  { ordinal: 11, name: "Division 1 Northern", type: "Division", parent: "Division 1 North" },
  { ordinal: 12, name: "Division 1 Mid & Yorks", type: "Division", parent: "Division 1 North" },
  { ordinal: 13, name: "Division 1 South", type: "Conference", parent: "Division 1" },
  { ordinal: 14, name: "Division 1 Southern", type: "Division", parent: "Division 1 South" },
  { ordinal: 15, name: "Division 1 South Western", type: "Division", parent: "Division 1 South" },
  { ordinal: 16, name: "Division 1 South Eastern", type: "Division", parent: "Division 1 South" },
  { ordinal: 17, name: "Division 2", type: "Tier", parent: null },
  { ordinal: 18, name: "Division 2 North", type: "Conference", parent: "Division 2" },
  { ordinal: 19, name: "Northern Conference Cup", type: "Playoffs", parent: "Division 2 North" },
  { ordinal: 20, name: "Division 2 North Eastern", type: "Division", parent: "Division 2 North" },
  { ordinal: 21, name: "Division 2 North Western", type: "Division", parent: "Division 2 North" },
  { ordinal: 22, name: "Division 2 Midlands", type: "Division", parent: "Division 2 North" },
  { ordinal: 23, name: "Division 2 South", type: "Conference", parent: "Division 2" },
  { ordinal: 24, name: "Southern Conference Cup", type: "Playoffs", parent: "Division 2 South" },
  { ordinal: 25, name: "Division 2 Southern", type: "Division", parent: "Division 2 South" },
  { ordinal: 26, name: "Division 2 South Western", type: "Division", parent: "Division 2 South" },
  { ordinal: 27, name: "Division 2 South Eastern", type: "Division", parent: "Division 2 South" },
];

const PREMIER_NORTH_TEAMS = new Set([
  'Leeds Beckett Carnegie',
  'Newcastle Raiders',
  'Northumbria Mustangs',
  'Nottingham Trent Renegades',
  'UCLan Rams'
]);

function resolvePhaseName(compName, homeTeamName) {
  if (compName === 'Premier (National)') return 'Premier (National)';
  if (compName === 'Premier (North/South)') {
    return PREMIER_NORTH_TEAMS.has(homeTeamName) ? 'Premier North' : 'Premier South';
  }
  if (compName === 'Scottish Tier 1') return 'Division 1 Scottish';
  if (compName === 'North Central Tier 1') return 'Division 1 Mid & Yorks';
  if (compName === 'North Western Tier 1') return 'Division 1 Northern';
  if (compName === 'Southern Tier 1') return 'Division 1 Southern';
  if (compName === 'South Western Tier 1') return 'Division 1 South Western';
  if (compName === 'South Eastern Tier 1') return 'Division 1 South Eastern';
  if (compName === 'Midlands Tier 2') return 'Division 2 Midlands';
  if (compName === 'North Eastern Tier 2') return 'Division 2 North Eastern';
  if (compName === 'North Western Tier 2') return 'Division 2 North Western';
  if (compName === 'Southern Tier 2') return 'Division 2 Southern';
  if (compName === 'South Western Tier 2') return 'Division 2 South Western';
  if (compName === 'South Eastern Tier 2') return 'Division 2 South Eastern';
  throw new Error(`Unknown Playwaze comp: ${compName}`);
}

async function main() {
  console.log(`\n=== Ingesting 2026/27 BUAFL Schedule ===`);
  if (isDryRun) console.log(`[DRY RUN MODE: No DB modifications will be written]\n`);

  // Load team mapping
  const bucsMap = JSON.parse(fs.readFileSync('data/mappings/bucs_teams.json', 'utf8'));

  // 1. Fetch competition
  const { data: comp } = await supabase
    .from('competitions')
    .select('id, name')
    .or('name.eq.British Universities American Football League,name.eq.BUAFL')
    .limit(1)
    .single();

  console.log(`Competition: ${comp.name} (${comp.id})`);

  // 2. Fetch or create season 2026
  let { data: season } = await supabase
    .from('seasons')
    .select('id, year, name')
    .eq('year', 2026)
    .eq('competition_id', comp.id)
    .maybeSingle();

  if (!season) {
    console.log('Creating 2026/27 season in DB...');
    if (!isDryRun) {
      const { data: newSeason, error: sErr } = await supabase
        .from('seasons')
        .insert({
          year: 2026,
          competition_id: comp.id,
          name: '2026/27 Season'
        })
        .select()
        .single();
      if (sErr) throw sErr;
      season = newSeason;
    } else {
      season = { id: 'dry-run-season-id', year: 2026, name: '2026/27 Season' };
    }
  }
  console.log(`Season: ${season.name} (${season.id})`);

  // 3. Provision phases
  const { data: existingPhases } = await supabase
    .from('phases')
    .select('id, name, parent_phase_id, ordinal')
    .eq('season_id', season.id);

  const phaseMap = new Map();
  for (const ep of (existingPhases || [])) {
    phaseMap.set(ep.name, ep);
  }

  for (const spec of PHASES_SPEC) {
    let existing = phaseMap.get(spec.name);
    let parentId = spec.parent && phaseMap.get(spec.parent) ? phaseMap.get(spec.parent).id : null;

    if (!existing) {
      console.log(`Creating phase [${spec.ordinal}] ${spec.name}...`);
      if (!isDryRun) {
        const { data: newPhase, error: pErr } = await supabase
          .from('phases')
          .insert({
            season_id: season.id,
            name: spec.name,
            type: spec.type,
            parent_phase_id: parentId,
            ordinal: spec.ordinal
          })
          .select()
          .single();
        if (pErr) throw pErr;
        phaseMap.set(spec.name, newPhase);
      } else {
        phaseMap.set(spec.name, { id: `dry-phase-${spec.ordinal}`, name: spec.name });
      }
    }
  }

  // 4. Fetch DB teams
  const { data: dbTeams } = await supabase.from('teams').select('id, name');
  const teamByName = new Map();
  dbTeams.forEach(t => teamByName.set(t.name.toLowerCase(), t));

  function getCanonicalTeam(raw) {
    const mappedName = bucsMap[raw] || raw;
    const team = teamByName.get(mappedName.toLowerCase());
    if (!team) throw new Error(`Could not find team for: "${raw}" -> "${mappedName}"`);
    return team;
  }

  // 5. Load scraped fixtures
  const rawMatches = JSON.parse(fs.readFileSync('scratch/playwaze_2026_fixtures.json', 'utf8'));
  console.log(`Loaded ${rawMatches.length} raw fixtures.`);

  // Prepare participations and games
  const participationsToInsert = new Map(); // `${phaseId}:${teamId}` -> object
  const gamesToInsert = [];

  for (const m of rawMatches) {
    // Skip fixtures voided by BUCS during schedule balancing
    if (m.date === '2026-07-23' || m.isVoid) continue;

    const homeTeam = getCanonicalTeam(m.home);
    const awayTeam = getCanonicalTeam(m.away);
    const phaseName = resolvePhaseName(m.comp, homeTeam.name);
    const phase = phaseMap.get(phaseName);

    if (!phase) throw new Error(`Phase not found: ${phaseName}`);

    // Register participations
    const homePartKey = `${phase.id}:${homeTeam.id}`;
    const awayPartKey = `${phase.id}:${awayTeam.id}`;
    if (!participationsToInsert.has(homePartKey)) {
      participationsToInsert.set(homePartKey, { phase_id: phase.id, team_id: homeTeam.id, phaseName, teamName: homeTeam.name });
    }
    if (!participationsToInsert.has(awayPartKey)) {
      participationsToInsert.set(awayPartKey, { phase_id: phase.id, team_id: awayTeam.id, phaseName, teamName: awayTeam.name });
    }

    // Determine date
    const isPlaceholderDate = m.date === '2026-07-23';
    const gameDate = isPlaceholderDate ? null : m.date;
    const datePrecision = isPlaceholderDate ? 'season' : 'day';
    const dateDisplay = gameDate ? gameDate.split('-').reverse().join('/') : null;
    const gameTime = (m.time && m.time !== '00:00') ? m.time : null;

    gamesToInsert.push({
      season_id: season.id,
      phase_id: phase.id,
      home_team_id: homeTeam.id,
      away_team_id: awayTeam.id,
      date: gameDate,
      date_precision: datePrecision,
      date_display: dateDisplay,
      time: gameTime,
      status: 'scheduled',
      home_score: null,
      away_score: null,
      is_playoff: false,
      is_double_header: false,
      notes: 'Source: BUCS Play historical records (https://bucs.playwaze.com/bucs-american-football-26-27/ifxdwhhz1xyc/community-details)',
      confidence_level: 'high',
      _meta: { phaseName, home: homeTeam.name, away: awayTeam.name }
    });
  }

  console.log(`Identified ${participationsToInsert.size} unique team participations across regular season divisions.`);
  console.log(`Identified ${gamesToInsert.length} fixtures ready for ingestion.`);

  if (!isDryRun) {
    // A. Insert participations
    console.log('Ensuring participations exist...');
    const phaseIds = Array.from(new Set(Array.from(participationsToInsert.values()).map(p => p.phase_id)));
    const { data: existingParts } = await supabase
      .from('participations')
      .select('id, phase_id, team_id')
      .in('phase_id', phaseIds);

    const existingPartSet = new Set((existingParts || []).map(p => `${p.phase_id}:${p.team_id}`));
    const newParts = [];
    for (const p of participationsToInsert.values()) {
      const key = `${p.phase_id}:${p.team_id}`;
      if (!existingPartSet.has(key)) {
        newParts.push({ phase_id: p.phase_id, team_id: p.team_id });
      }
    }

    if (newParts.length > 0) {
      console.log(`Inserting ${newParts.length} new participations...`);
      const { error: insPartErr } = await supabase.from('participations').insert(newParts);
      if (insPartErr) throw insPartErr;
      console.log('Participations inserted successfully.');
    } else {
      console.log('All participations already exist.');
    }

    // B. Insert games
    console.log('Inserting fixtures into games table...');
    // Delete existing scheduled games for season 2026 first to prevent duplicates
    await supabase.from('games').delete().eq('season_id', season.id);

    const batchSize = 50;
    for (let i = 0; i < gamesToInsert.length; i += batchSize) {
      const batch = gamesToInsert.slice(i, i + batchSize).map(({ _meta, ...g }) => g);
      const { error: gErr } = await supabase.from('games').insert(batch);
      if (gErr) throw gErr;
      console.log(`  Inserted games ${i + 1} to ${Math.min(i + batchSize, gamesToInsert.length)}...`);
    }
  }

  // Generate canonical games2026.csv
  const csvHeaders = [
    'competition','year','phase','date','away_team','home_team','away_score','home_score',
    'venue','notes','away_coach','home_coach','is_double_header','date_precision','date_display',
    'time','status','confidence_level','is_playoff','is_title_game','final_type','title_name',
    'playoff_round','parent_phase'
  ];

  const csvRows = [csvHeaders.join(',')];
  for (const g of gamesToInsert) {
    const parentPhase = PHASES_SPEC.find(p => p.name === g._meta.phaseName)?.parent || '';
    const row = [
      'BUAFL',
      '2026',
      g._meta.phaseName,
      g.date || '',
      `"${g._meta.away}"`,
      `"${g._meta.home}"`,
      '',
      '',
      '',
      `"${g.notes}"`,
      '',
      '',
      'FALSE',
      g.date_precision,
      g.date_display || '',
      g.time || '',
      g.status,
      g.confidence_level,
      'FALSE',
      'FALSE',
      '',
      '',
      '',
      parentPhase
    ];
    csvRows.push(row.join(','));
  }

  fs.writeFileSync('data/BUAFL/games2026.csv', csvRows.join('\n') + '\n');
  console.log(`Wrote data/BUAFL/games2026.csv (${gamesToInsert.length} fixtures).`);

  console.log('\n=== Ingestion Completed Successfully ===');
}

main().catch(err => {
  console.error('Fatal error during schedule ingestion:', err);
  process.exit(1);
});
