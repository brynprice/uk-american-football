import ws from 'ws';
global.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanAndReimport() {
  const seasonId = '44968ca2-4cc2-4381-9fdd-edc5c04c92d5';

  console.log('1. Deleting existing games for season 2019...');
  const { data: deleted, error } = await supabase.from('games').delete().eq('season_id', seasonId).select('id');
  if (error) {
    console.error('Error deleting games:', error);
    process.exit(1);
  }
  console.log(`Deleted ${deleted.length} games.`);

  console.log('2. Running import_data.mjs for data/BUAFL/games2019.csv...');
  execSync('node scripts/import_data.mjs data/BUAFL/games2019.csv', { stdio: 'inherit' });

  console.log('3. Verifying count in DB...');
  const { count } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('season_id', seasonId);
  console.log(`Final games count in DB: ${count}`);
}
cleanAndReimport();
