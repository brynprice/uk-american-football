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
  const uwsId = 'd77d28f3-5452-4751-94a5-ad19a3abc995';
  const bangorId = '8d43e268-3ff3-4356-a7bd-8357b717183d';

  // 1. Delete the 4 surplus duplicate games from 2013-02-17
  const dupesToDelete = [
    '05aadd9b-fb54-4d53-9a61-1480cd3dc7c9',
    '30f73652-4fa4-4314-828b-56d357e158c1',
    '72880509-a62a-4cf5-86c9-a150e1069823',
    '2ae7577f-1863-4446-9d39-7a6ba35aef25'
  ];
  console.log('Deleting 4 duplicate games from 2013-02-17...');
  await supabase.from('games').delete().in('id', dupesToDelete);

  // 2. The 8 Saltire Conference games belonging to UWS Pyros
  const uwsGameIds = [
    '64bbc7ba-42b0-4cef-b372-f3a79be89ec9', // 2012-11-04 vs Napier (14-13)
    '90d482bf-19fa-46b5-9924-c193db657f35', // 2012-11-18 vs Wildcats (26-6)
    'da54f50f-3523-422d-ad74-932276742bf0', // 2012-11-25 vs Glasgow (27-8)
    '49840c5d-014c-4138-a1f4-b04236d922af', // 2013-01-27 vs Wildcats (0-0)
    '088e1f8e-ac22-4113-8cb7-bb5b8491e2ad', // 2013-02-17 vs Stirling (48-0)
    '5a43f047-2f9d-43bc-ab7b-7a53ad87d66f', // 2013-02-17 vs Stirling (32-0)
    '96b42f0b-147a-4bb7-bde4-dc53f64af642', // 2013-02-24 vs Napier (36-30)
    '0ca1467e-5edc-481b-a25e-d35fd5cf6cdd'  // 2013-03-02 vs Glasgow (0-6)
  ];

  console.log('Assigning UWS Pyros ID to 8 Saltire games...');
  for (const gid of uwsGameIds) {
    const { data: g } = await supabase.from('games').select('home_team_id, away_team_id').eq('id', gid).single();
    if (g.home_team_id === bangorId) {
      await supabase.from('games').update({ home_team_id: uwsId }).eq('id', gid);
    }
    if (g.away_team_id === bangorId) {
      await supabase.from('games').update({ away_team_id: uwsId }).eq('id', gid);
    }
  }

  // 3. Final verification of game counts
  const { count: finalGameCount } = await supabase.from('games')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', s12Id);

  console.log(`\nFinal Supabase 2012 Games Count: ${finalGameCount}`);
}

run().catch(console.error);
