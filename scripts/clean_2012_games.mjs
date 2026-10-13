import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function clean2012Games() {
  const SEASON_ID = 'd4e61940-f44a-4b9a-84e7-23d01db775be';
  console.log(`Deleting existing games for season 2012 (${SEASON_ID})...`);

  const { data: deleted, error } = await supabase
    .from('games')
    .delete()
    .eq('season_id', SEASON_ID)
    .select('id');

  if (error) {
    console.error('Error deleting games:', error);
    process.exit(1);
  }

  console.log(`Successfully deleted ${deleted?.length || 0} existing games.`);
}

clean2012Games();
