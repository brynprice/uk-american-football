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

function serializeCSVRow(fields) {
  return fields.map(val => {
    const s = String(val === null || val === undefined ? '' : val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }).join(',');
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
  console.log('=== FINAL RECONCILIATION & DATABASE SYNCHRONIZATION ===\n');

  const buaflCompId = 'e8490509-2a20-4ffb-98e1-d6d5440fb446';
  const { data: s12 } = await supabase.from('seasons')
    .select('id')
    .eq('competition_id', buaflCompId)
    .eq('year', 2012)
    .single();
  const season2012Id = s12.id;

  // 1. Ensure Cambridge vs Oxford (Varsity Bowl) is in games2012.csv
  const g12Lines = fs.readFileSync('data/BUAFL/games2012.csv', 'utf-8').split('\n').filter(l => l.trim().length > 0);
  const g12Header = parseCSVLine(g12Lines[0]);
  const hasVarsity = g12Lines.some(l => l.includes('Cambridge Pythons') && l.includes('Oxford Lancers') && l.includes('Varsity Bowl'));

  if (!hasVarsity) {
    console.log('Adding Oxford Lancers vs Cambridge Pythons Varsity Bowl to games2012.csv...');
    const varsityRow = {
      competition: 'BUAFL',
      year: '2012',
      date: '',
      date_precision: 'season',
      date_display: '',
      phase: 'Varsity Bowl',
      parent_phase: 'Varsity Fixtures',
      away_phase: '',
      away_parent_phase: '',
      away_team: 'Cambridge Pythons',
      away_score: '20',
      home_score: '13',
      home_team: 'Oxford Lancers',
      is_playoff: 'FALSE',
      playoff_round: '',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: '',
      nickname: '',
      is_double_header: 'FALSE',
      game_type: 'friendly',
      status: 'completed',
      confidence_level: 'high',
      venue: '',
      home_coach: 'Andy Hollands',
      away_coach: '',
      notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database'
    };
    g12Lines.push(serializeCSVRow(g12Header.map(h => varsityRow[h.trim()] || '')));
    fs.writeFileSync('data/BUAFL/games2012.csv', g12Lines.join('\n') + '\n');
    console.log(`Updated data/BUAFL/games2012.csv (total games now: ${g12Lines.length - 1})`);
  }

  // 2. Build canonical team map strictly for University teams
  const { data: allTeams } = await supabase.from('teams').select('id, name, team_type').range(0, 999);
  const dbTeamMap = {};
  allTeams.forEach(t => {
    if (t.team_type === 'University') {
      dbTeamMap[t.name] = t.id;
    }
  });

  const { data: allAliases } = await supabase.from('team_aliases').select('name, team_id, teams!inner(team_type)');
  allAliases.forEach(a => {
    if (a.teams?.team_type === 'University' || !dbTeamMap[a.name]) {
      dbTeamMap[a.name] = a.team_id;
    }
  });

  // Explicit canonical team IDs
  dbTeamMap['Birmingham Lions'] = 'b4ca537e-f302-4bda-80db-b3537bd59279';
  dbTeamMap['Derby Braves'] = '559dfaea-87f1-4005-809c-e0b3ac167afd';
  dbTeamMap['Durham Saints'] = '30b70907-4a98-4ddf-a25f-022ab292dd3c';
  dbTeamMap['Lancaster Bombers'] = 'c78a0102-34cb-4372-a03e-ccb2dcf88205';
  dbTeamMap['Loughborough Aces'] = '713be9b4-a9bd-45cd-b17b-de0a91cf5463';
  dbTeamMap['Loughborough Students'] = '713be9b4-a9bd-45cd-b17b-de0a91cf5463';
  dbTeamMap['Edinburgh Predators'] = '4a8a2a67-713e-4039-b79d-66c42196f8f1';
  dbTeamMap['Edinburgh Wildcats'] = '4a8a2a67-713e-4039-b79d-66c42196f8f1';
  dbTeamMap['Bangor MudDogs'] = '8d43e268-3ff3-4356-a7bd-8357b717183d';
  dbTeamMap['Bangor Llewod'] = '8d43e268-3ff3-4356-a7bd-8357b717183d';
  dbTeamMap['UWS Pyros'] = 'd77d28f3-5452-4751-94a5-ad19a3abc995';

  // 3. Delete the 9 known ghost duplicate games from Supabase
  const ghostIdsToDelete = [
    '63e001e2-252e-441b-a0c9-653cbd4993a0',
    '64f224bf-a706-426e-b325-4fb084f21c2c',
    '4bbb0e4d-9f23-4f66-9143-fd3cbe05cf57',
    '9cdca199-af05-4cb4-8e95-d35e0418dc5b',
    'ba18a724-c36e-4e56-8feb-ba1ae801d7bf',
    '642f461f-59ed-4490-b350-76f4c6860c15',
    '71d58222-e8dc-44b9-8218-9d7a081c3d15',
    '37f28177-dec0-4e15-910d-51f7b1ccdcb7',
    'bba04b80-be6e-468b-84d1-a53fb648b047'
  ];

  console.log('Purging 9 confirmed ghost duplicate records from Supabase...');
  const { data: delGhosts } = await supabase.from('games')
    .delete()
    .in('id', ghostIdsToDelete)
    .select('id');
  console.log(`Deleted ${delGhosts?.length || 0} ghost records.`);

  // 4. Update the 7 games where UWS Pyros was erroneously set instead of Bangor Llewod
  const uwsId = 'd77d28f3-5452-4751-94a5-ad19a3abc995';
  const bangorId = '8d43e268-3ff3-4356-a7bd-8357b717183d';

  console.log('Fixing Bangor Llewod team IDs in Supabase games...');
  await supabase.from('games')
    .update({ home_team_id: bangorId })
    .eq('season_id', season2012Id)
    .eq('home_team_id', uwsId);

  await supabase.from('games')
    .update({ away_team_id: bangorId })
    .eq('season_id', season2012Id)
    .eq('away_team_id', uwsId);

  // 5. Ensure Cambridge vs Oxford is cleanly recorded in Supabase
  const oxfordId = dbTeamMap['Oxford Lancers'];
  const cambridgeId = dbTeamMap['Cambridge Pythons'];
  const { data: existingVarsity } = await supabase.from('games')
    .select('id')
    .eq('season_id', season2012Id)
    .eq('home_team_id', oxfordId)
    .eq('away_team_id', cambridgeId)
    .is('date', null)
    .maybeSingle();

  if (existingVarsity) {
    await supabase.from('games').update({
      home_score: 13,
      away_score: 20,
      status: 'completed',
      game_type: 'friendly',
      notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database'
    }).eq('id', existingVarsity.id);
    console.log('Updated Varsity Bowl in Supabase.');
  }

  // 6. Final count checks
  const { count: finalGameCount } = await supabase.from('games')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', season2012Id);

  const csvCount = loadCSV('data/BUAFL/games2012.csv').length;

  console.log(`\n=== VERIFICATION RESULTS ===`);
  console.log(`games2012.csv total fixtures:  ${csvCount}`);
  console.log(`Supabase 2012 total fixtures:   ${finalGameCount}`);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
