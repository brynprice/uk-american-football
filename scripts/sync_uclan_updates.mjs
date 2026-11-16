import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('=== Syncing UCLan Rams Updates to Supabase ===');

  // 1. Delete ghost 2011 participation
  const { error: delErr } = await supabase
    .from('participations')
    .delete()
    .eq('id', '3e808424-0478-41e5-8ace-427785d71f57');
  if (delErr) console.error('Error deleting 2011 participation:', delErr);
  else console.log('Deleted ghost 2011 UCLan Rams participation.');

  // Lookup team IDs
  const teamNames = ['UCLan Rams', 'Manchester Tyrants', 'Sheffield Hallam Warriors', 'MMU Eagles', 'Portsmouth Destroyers'];
  const { data: teams } = await supabase.from('teams').select('id, name').in('name', teamNames);
  const teamId = Object.fromEntries((teams || []).map(t => [t.name, t.id]));
  console.log('Teams:', teamId);

  // Lookup seasons 2012 and 2013
  const { data: seasons } = await supabase
    .from('seasons')
    .select('id, year, competition:competitions(name)')
    .in('year', [2012, 2013]);
  const buaflSeasons = (seasons || []).filter(s => s.competition?.name?.includes('British Universities') || s.competition?.name === 'BUAFL');
  const season2012Id = buaflSeasons.find(s => s.year === 2012)?.id;
  const season2013Id = buaflSeasons.find(s => s.year === 2013)?.id;
  console.log('Seasons:', { season2012Id, season2013Id });

  // 2. Update 2012-11-04 UCLan @ Tyrants walkover
  const { data: tyrantsGame, error: tErr } = await supabase
    .from('games')
    .update({
      status: 'awarded',
      notes: 'Source: BUCS historical records & UCLan Rams club records (1-0 walkover)'
    })
    .match({
      season_id: season2012Id,
      away_team_id: teamId['UCLan Rams'],
      home_team_id: teamId['Manchester Tyrants'],
      date: '2012-11-04'
    })
    .select('id, status');
  if (tErr) console.error('Error updating Tyrants walkover:', tErr);
  else console.log('Updated 2012-11-04 Tyrants walkover:', tyrantsGame);

  // 3. Update 2012 UCLan @ Sheffield Hallam date -> 2013-02-06
  const { data: hallamGame, error: hErr } = await supabase
    .from('games')
    .update({
      date: '2013-02-06',
      date_precision: 'day',
      date_display: '06/02/2013',
      notes: 'Source: BUCS historical records & UCLan Rams club records'
    })
    .match({
      season_id: season2012Id,
      away_team_id: teamId['UCLan Rams'],
      home_team_id: teamId['Sheffield Hallam Warriors']
    })
    .select('id, date, date_display');
  if (hErr) console.error('Error updating Hallam game date:', hErr);
  else console.log('Updated 2012 Hallam game date:', hallamGame);

  // 4. Lookup 2013 phases (Big North Western Conference & Trophy Playoffs)
  const { data: phases2013 } = await supabase
    .from('phases')
    .select('id, name')
    .eq('season_id', season2013Id)
    .in('name', ['Big North Western Conference', 'Trophy Playoffs']);
  const phaseId = Object.fromEntries((phases2013 || []).map(p => [p.name, p.id]));
  console.log('2013 Phases:', phaseId);

  // 5. Insert 2014-02-12 UCLan Rams 22 @ MMU Eagles 0 (if not already present)
  const { data: existingMmu } = await supabase
    .from('games')
    .select('id')
    .match({
      season_id: season2013Id,
      away_team_id: teamId['UCLan Rams'],
      home_team_id: teamId['MMU Eagles'],
      date: '2014-02-12'
    })
    .maybeSingle();

  if (existingMmu) {
    console.log('2014-02-12 MMU game already exists:', existingMmu.id);
  } else {
    const { data: insMmu, error: mErr } = await supabase
      .from('games')
      .insert({
        season_id: season2013Id,
        phase_id: phaseId['Big North Western Conference'],
        date: '2014-02-12',
        date_precision: 'day',
        date_display: '12/02/2014',
        away_team_id: teamId['UCLan Rams'],
        home_team_id: teamId['MMU Eagles'],
        away_score: 22,
        home_score: 0,
        status: 'completed',
        confidence_level: 'high',
        is_playoff: false,
        is_double_header: false,
        game_type: 'league',
        game_level: 'University',
        notes: 'Source: UCLan Rams club records'
      })
      .select('id, date, away_score, home_score');
    if (mErr) console.error('Error inserting MMU game:', mErr);
    else console.log('Inserted 2014-02-12 MMU game:', insMmu);
  }

  // 6. Insert 2014-03-09 UCLan Rams 26 @ Portsmouth Destroyers 8 (if not already present)
  const { data: existingPorts } = await supabase
    .from('games')
    .select('id')
    .match({
      season_id: season2013Id,
      away_team_id: teamId['UCLan Rams'],
      home_team_id: teamId['Portsmouth Destroyers'],
      date: '2014-03-09'
    })
    .maybeSingle();

  if (existingPorts) {
    console.log('2014-03-09 Portsmouth game already exists:', existingPorts.id);
  } else {
    const { data: insPorts, error: pErr } = await supabase
      .from('games')
      .insert({
        season_id: season2013Id,
        phase_id: phaseId['Trophy Playoffs'],
        date: '2014-03-09',
        date_precision: 'day',
        date_display: '09/03/2014',
        away_team_id: teamId['UCLan Rams'],
        home_team_id: teamId['Portsmouth Destroyers'],
        away_score: 26,
        home_score: 8,
        status: 'completed',
        confidence_level: 'high',
        is_playoff: true,
        final_type: 'playoff',
        playoff_round: 'Wild Card',
        is_double_header: false,
        game_type: 'league',
        game_level: 'University',
        notes: 'Source: UCLan Rams club records'
      })
      .select('id, date, away_score, home_score, playoff_round');
    if (pErr) console.error('Error inserting Portsmouth game:', pErr);
    else console.log('Inserted 2014-03-09 Portsmouth playoff game:', insPorts);
  }

  console.log('=== UCLan Rams Supabase Sync Complete ===');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
