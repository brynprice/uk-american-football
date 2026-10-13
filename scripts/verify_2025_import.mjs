import ws from 'ws';
global.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  const seasonId = 'bae0848d-0776-418b-bf3b-48d2e78b057e';
  
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

  // Champions
  const { data: phases } = await supabase.from('phases').select('id, name').eq('season_id', seasonId);
  const phaseIds = phases.map(p => p.id);
  const { data: champs } = await supabase
    .from('participations')
    .select('team_id, phase_id, wins, losses, ties, points_for, points_against, is_champion')
    .in('phase_id', phaseIds)
    .eq('is_champion', true);

  console.log('\n--- 2025/26 Division Champions ---');
  for (const c of champs || []) {
    const { data: t } = await supabase.from('teams').select('name').eq('id', c.team_id).single();
    const phaseName = phases.find(p => p.id === c.phase_id)?.name;
    console.log(`  ${phaseName}: ${t?.name} (${c.wins}-${c.losses}-${c.ties}, PF ${c.points_for}, PA ${c.points_against})`);
  }

  // Coaches
  const { data: coached } = await supabase
    .from('participations')
    .select('team_id, phase_id, head_coach_id')
    .in('phase_id', phaseIds)
    .not('head_coach_id', 'is', null);

  console.log(`\n--- Verified Head Coaches (${coached?.length} participations linked) ---`);
  const seenCoach = new Set();
  for (const cp of coached || []) {
    const { data: t } = await supabase.from('teams').select('name').eq('id', cp.team_id).single();
    const { data: p } = await supabase.from('people').select('display_name').eq('id', cp.head_coach_id).single();
    const key = `${t?.name}: ${p?.display_name}`;
    if (!seenCoach.has(key)) {
      seenCoach.add(key);
      console.log(`  ${key}`);
    }
  }

  // Season
  const { data: s } = await supabase.from('seasons').select('id, year, expected_participants, confidence_level, completeness_score').eq('id', seasonId).single();
  console.log('\nSeason Metadata:', s);
}

verify();
