import ws from 'ws';
global.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  const seasonId = '6820cd9d-4f28-41f9-9ba0-3026f0736eec';
  
  // Games
  const { count: totalGames } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('season_id', seasonId);
  const { count: awardedGames } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('season_id', seasonId).eq('status', 'awarded');
  const { count: cancelledGames } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('season_id', seasonId).eq('status', 'cancelled');
  
  console.log(`Total games: ${totalGames} (Awarded: ${awardedGames}, Cancelled: ${cancelledGames})`);

  // Title / Bowl games
  const { data: titleGames } = await supabase
    .from('games')
    .select('date, home_team_id, away_team_id, home_score, away_score, final_type, title_name')
    .eq('season_id', seasonId)
    .not('final_type', 'is', null)
    .order('date');

  console.log('\n--- Title & Bowl Games ---');
  for (const g of titleGames || []) {
    const { data: ht } = await supabase.from('teams').select('name').eq('id', g.home_team_id).single();
    const { data: at } = await supabase.from('teams').select('name').eq('id', g.away_team_id).single();
    console.log(`  ${g.date} | ${g.title_name} (${g.final_type}): ${at?.name} ${g.away_score} @ ${ht?.name} ${g.home_score}`);
  }
}
verify();
