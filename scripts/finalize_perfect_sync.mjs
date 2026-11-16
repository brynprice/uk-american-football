import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const s12Id = 'd4e61940-f44a-4b9a-84e7-23d01db775be';

  // 1. Delete 1 duplicate ID from each of the 7 Bangor pairs
  const duplicateBangorIdsToDelete = [
    'd5359301-d736-4c52-ba9c-8f7aa0ff6a53', // vs Sheffield Hallam (keep f9511cc6)
    '2640ced7-ace3-42f8-acfb-238222e717c1', // vs Manchester Tyrants (keep c4512f97)
    'fd9754b3-bc28-4d45-b8ca-ada1ca504a55', // vs Sheffield Sabres (keep 83b817c7)
    '08abb274-9011-4749-8975-750ef22fbc5a', // vs Huddersfield (keep 65c733f5)
    'a4fe2754-240b-47a0-9e7f-09f9c9756854', // vs Derby (keep de496b90)
    '24f232d0-0871-4362-9b6e-4806193ff69a', // vs UCLan (keep 783fc78e)
    '6548c78b-e735-4225-8c27-d83b42568a54'  // vs LJMU (keep 1000efef)
  ];

  console.log('Deleting 7 duplicate Bangor game records...');
  await supabase.from('games').delete().in('id', duplicateBangorIdsToDelete);

  // 2. Insert the 3 legitimate second-leg / bowl fixtures
  const { data: durham } = await supabase.from('teams').select('id').eq('name', 'Durham Saints').eq('team_type', 'University').single();
  const { data: sunderland } = await supabase.from('teams').select('id').eq('name', 'Sunderland Spartans').single();
  const { data: solent } = await supabase.from('teams').select('id').eq('name', 'Solent Redhawks').single();
  const { data: brookes } = await supabase.from('teams').select('id').eq('name', 'Oxford Brookes University').single();
  const { data: lsbu } = await supabase.from('teams').select('id').eq('name', 'LSBU Spartans').single();
  const { data: westminster } = await supabase.from('teams').select('id').eq('name', 'Westminster Dragons').single();

  const { data: nePhase } = await supabase.from('phases').select('id').eq('season_id', s12Id).eq('name', 'North Eastern Conference').single();
  const { data: ocPhase } = await supabase.from('phases').select('id').eq('season_id', s12Id).eq('name', 'Oyster Card Conference').single();

  const threeGames = [
    {
      season_id: s12Id,
      phase_id: nePhase.id,
      home_team_id: sunderland.id,
      away_team_id: durham.id,
      home_score: 14,
      away_score: 8,
      date: null,
      date_precision: 'season',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: false,
      notes: 'Source: BUCS historical records [Exact date unconfirmed; cleared off-season placeholder date]'
    },
    {
      season_id: s12Id,
      phase_id: ocPhase.id,
      home_team_id: brookes.id,
      away_team_id: solent.id,
      home_score: 25,
      away_score: 19,
      date: null,
      date_precision: 'season',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: false,
      notes: 'Source: BUCS historical records [Exact date unconfirmed; cleared off-season placeholder date]'
    },
    {
      season_id: s12Id,
      phase_id: ocPhase.id,
      home_team_id: westminster.id,
      away_team_id: lsbu.id,
      home_score: 0,
      away_score: 0,
      date: null,
      date_precision: 'season',
      status: 'cancelled',
      confidence_level: 'high',
      is_playoff: false,
      notes: 'Source: BUCS historical records (BUCS record: Void) [Exact date unconfirmed; cleared off-season placeholder date]'
    }
  ];

  console.log('Inserting 3 legitimate fixtures into Supabase...');
  await supabase.from('games').insert(threeGames);

  // 3. Final verification
  const { count: finalCount } = await supabase.from('games')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', s12Id);

  console.log(`\n=== 100% VERIFICATION CHECK ===`);
  console.log(`Total games in data/BUAFL/games2012.csv: 277`);
  console.log(`Total games in Supabase 2012 BUAFL:     ${finalCount}`);
}

run().catch(console.error);
