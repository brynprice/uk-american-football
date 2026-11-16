import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function loadCSV(path) {
  if (!fs.existsSync(path)) return [];
  const content = fs.readFileSync(path, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const header = parseCSVLine(lines[0]);
  return lines.slice(1).map(l => {
    const row = parseCSVLine(l);
    const obj = {};
    header.forEach((h, idx) => obj[h.trim()] = (row[idx] || '').trim());
    return obj;
  });
}

async function run() {
  console.log('=== CLEAN SYNCHRONIZATION OF 2012 BUAFL DATA TO SUPABASE ===\n');

  const buaflCompId = 'e8490509-2a20-4ffb-98e1-d6d5440fb446';
  const { data: s12 } = await supabase.from('seasons')
    .select('id')
    .eq('competition_id', buaflCompId)
    .eq('year', 2012)
    .single();

  const season2012Id = s12.id;
  console.log(`2012 BUAFL Season ID: ${season2012Id}`);

  // 1. Build dbTeamMap strictly prioritizing University teams and their aliases
  const { data: allTeams } = await supabase.from('teams').select('id, name, team_type').range(0, 999);
  const dbTeamMap = {};

  // First non-university as fallback
  allTeams.forEach(t => {
    if (t.team_type !== 'University') {
      dbTeamMap[t.name] = t.id;
    }
  });
  // Prioritize University teams
  allTeams.forEach(t => {
    if (t.team_type === 'University') {
      dbTeamMap[t.name] = t.id;
    }
  });

  // Load team aliases with their associated team's team_type
  const { data: allAliases } = await supabase.from('team_aliases').select('name, team_id, teams!inner(team_type)');
  allAliases.forEach(a => {
    if (a.teams?.team_type === 'University' || !dbTeamMap[a.name]) {
      dbTeamMap[a.name] = a.team_id;
    }
  });

  // Explicit mappings to ensure 100% accuracy for historical university programs
  dbTeamMap['Birmingham Lions'] = 'b4ca537e-f302-4bda-80db-b3537bd59279';
  dbTeamMap['Derby Braves'] = '559dfaea-87f1-4005-809c-e0b3ac167afd';
  dbTeamMap['Durham Saints'] = '30b70907-4a98-4ddf-a25f-022ab292dd3c';
  dbTeamMap['Lancaster Bombers'] = 'c78a0102-34cb-4372-a03e-ccb2dcf88205';
  dbTeamMap['Loughborough Aces'] = '713be9b4-a9bd-45cd-b17b-de0a91cf5463';
  dbTeamMap['Loughborough Students'] = '713be9b4-a9bd-45cd-b17b-de0a91cf5463';
  dbTeamMap['Edinburgh Predators'] = '4a8a2a67-713e-4039-b79d-66c42196f8f1';
  dbTeamMap['Edinburgh Wildcats'] = '4a8a2a67-713e-4039-b79d-66c42196f8f1';
  dbTeamMap['Bangor MudDogs'] = 'd77d28f3-5452-4751-94a5-ad19a3abc995';
  dbTeamMap['Bangor Llewod'] = 'd77d28f3-5452-4751-94a5-ad19a3abc995';

  // 2. Load 2012 phases
  const { data: phases12 } = await supabase.from('phases').select('id, name').eq('season_id', season2012Id);
  const dbPhaseMap = {};
  phases12.forEach(p => dbPhaseMap[p.name] = p.id);

  // 3. Purge incorrect games with non-University team IDs for Birmingham, Lancaster, Derby, Durham
  const wrongIds = [
    'cd81c5d7-24d8-45fb-a246-d9f04cee5fff', // Womens Birmingham Lions
    '5ad13fd7-ca8b-41f5-87fc-e55bfde50f95', // Adult Lancaster Bombers
    'a03976cf-8193-4fb5-afa1-7937facaf676', // Womens Derby Braves
    '04e1cafa-f83f-4094-bd86-0c6d82e1f516'  // Adult Durham Saints
  ];

  console.log('Step 1: Purging games in 2012 with wrong non-University team IDs...');
  const { data: wrongGames, error: wgErr } = await supabase.from('games')
    .delete()
    .eq('season_id', season2012Id)
    .or(wrongIds.map(id => `home_team_id.eq.${id},away_team_id.eq.${id}`).join(','))
    .select('id');

  console.log(`Purged ${wrongGames?.length || 0} misplaced non-University games.`);

  // 4. Load CSV games
  const csvGames = loadCSV('data/BUAFL/games2012.csv');
  console.log(`\nStep 2: Syncing ${csvGames.length} games from games2012.csv to Supabase...`);

  let updatedCount = 0;
  let insertedCount = 0;

  for (const g of csvGames) {
    const homeId = dbTeamMap[g.home_team];
    const awayId = dbTeamMap[g.away_team];
    const phaseId = dbPhaseMap[g.phase];
    const awayPhaseId = g.away_phase ? dbPhaseMap[g.away_phase] : null;

    if (!homeId || !awayId) {
      console.error(`Missing team ID for ${g.away_team} or ${g.home_team}`);
      continue;
    }

    const gamePayload = {
      season_id: season2012Id,
      phase_id: phaseId || null,
      away_phase_id: awayPhaseId || null,
      home_team_id: homeId,
      away_team_id: awayId,
      date: g.date || null,
      date_precision: g.date_precision || 'day',
      date_display: g.date_display || null,
      home_score: g.home_score !== '' ? parseInt(g.home_score) : null,
      away_score: g.away_score !== '' ? parseInt(g.away_score) : null,
      status: g.status || 'completed',
      confidence_level: g.confidence_level || 'high',
      is_playoff: g.is_playoff === 'TRUE',
      final_type: g.final_type || null,
      notes: g.notes || null
    };

    // Find existing game by season, teams, and date
    let q = supabase.from('games')
      .select('id')
      .eq('season_id', season2012Id)
      .eq('home_team_id', homeId)
      .eq('away_team_id', awayId);

    if (g.date) {
      q = q.eq('date', g.date);
    } else {
      q = q.is('date', null);
    }

    let { data: existingG } = await q.maybeSingle();

    // Fallback 1: Check reverse home/away on same date
    if (!existingG && g.date) {
      let revQ = supabase.from('games')
        .select('id')
        .eq('season_id', season2012Id)
        .eq('home_team_id', awayId)
        .eq('away_team_id', homeId)
        .eq('date', g.date);
      const { data: revG } = await revQ.maybeSingle();
      if (revG) existingG = revG;
    }

    // Fallback 2: Check un-dated game for this matchup if g.date is set
    if (!existingG && g.date) {
      const { data: unDatedG } = await supabase.from('games')
        .select('id')
        .eq('season_id', season2012Id)
        .eq('home_team_id', homeId)
        .eq('away_team_id', awayId)
        .is('date', null)
        .maybeSingle();
      if (unDatedG) existingG = unDatedG;
    }

    if (existingG) {
      await supabase.from('games').update(gamePayload).eq('id', existingG.id);
      updatedCount++;
    } else {
      await supabase.from('games').insert(gamePayload);
      insertedCount++;
    }
  }

  console.log(`Finished games sync: Updated=${updatedCount}, Inserted=${insertedCount}`);

  // 5. Purge any un-dated ghost records if a dated fixture for the same matchup now exists
  console.log('\nStep 3: Checking for duplicate un-dated placeholder records in DB...');
  const { data: currentDbGames } = await supabase.from('games')
    .select('id, home_team_id, away_team_id, date')
    .eq('season_id', season2012Id);

  const datedMatchups = new Set();
  currentDbGames.filter(g => g.date).forEach(g => {
    datedMatchups.add([g.home_team_id, g.away_team_id].sort().join(' vs '));
  });

  let purgedUnDated = 0;
  for (const g of currentDbGames.filter(g => !g.date)) {
    const key = [g.home_team_id, g.away_team_id].sort().join(' vs ');
    if (datedMatchups.has(key)) {
      await supabase.from('games').delete().eq('id', g.id);
      purgedUnDated++;
    }
  }
  console.log(`Purged ${purgedUnDated} duplicate un-dated placeholder records.`);

  // 6. Sync participations from standings2012.csv
  console.log('\nStep 4: Syncing 2012 participations...');
  const csvStandings = loadCSV('data/BUAFL/standings2012.csv');
  let partUpdated = 0;

  for (const st of csvStandings) {
    const teamId = dbTeamMap[st.team];
    const phaseId = dbPhaseMap[st.phase];
    if (!teamId || !phaseId) continue;

    const { error: pErr } = await supabase.from('participations')
      .update({
        wins: parseInt(st.wins),
        losses: parseInt(st.losses),
        ties: parseInt(st.ties),
        points_for: parseInt(st.points_for),
        points_against: parseInt(st.points_against)
      })
      .eq('team_id', teamId)
      .eq('phase_id', phaseId);

    if (!pErr) partUpdated++;
  }
  console.log(`Successfully synced ${partUpdated} team participations in Supabase.`);

  // 7. Final count verification
  const { count: finalGameCount } = await supabase.from('games')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', season2012Id);

  console.log(`\n=== FINAL VERIFICATION ===`);
  console.log(`CSV 2012 games count: ${csvGames.length}`);
  console.log(`DB 2012 games count:  ${finalGameCount}`);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
