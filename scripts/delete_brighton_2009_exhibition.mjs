import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== DELETING 8 EXHIBITION BRIGHTON TSUNAMI GAMES FROM 2009 DB SEASON ===\n');

  const { data: season } = await supabase.from('seasons').select('id').eq('year', 2009).single();
  if (!season) {
    console.error('2009 season not found.');
    return;
  }

  // Find all games for 2009 season involving Brighton with non-null date
  const { data: games } = await supabase
    .from('games')
    .select('id, date, home_score, away_score, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)')
    .eq('season_id', season.id)
    .not('date', 'is', null);

  const exhibitionGames = games.filter(g => g.home_team?.name.includes('Brighton') || g.away_team?.name.includes('Brighton'));

  console.log(`Found ${exhibitionGames.length} exhibition games to delete:`);
  for (const g of exhibitionGames) {
    console.log(` - ID: ${g.id} | Date: ${g.date} | ${g.home_team?.name} (${g.home_score}) vs ${g.away_team?.name} (${g.away_score})`);
    
    // Delete participations first if foreign key constraint exists
    await supabase.from('game_participations').delete().eq('game_id', g.id);
    
    // Delete game record
    const { error } = await supabase.from('games').delete().eq('id', g.id);
    if (error) {
      console.error(`   Error deleting game ${g.id}:`, error);
    } else {
      console.log(`   Deleted game ${g.id}.`);
    }
  }

  console.log('\n=== DELETION COMPLETE ===');
}

main().catch(console.error);
