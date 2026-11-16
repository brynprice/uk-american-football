import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  const buaflCompId = 'e8490509-2a20-4ffb-98e1-d6d5440fb446';
  const { data: s11 } = await supabase.from('seasons').select('id').eq('competition_id', buaflCompId).eq('year', 2011).single();
  const { data: s12 } = await supabase.from('seasons').select('id').eq('competition_id', buaflCompId).eq('year', 2012).single();

  const { count: c11 } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('season_id', s11.id);
  const { count: c12 } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('season_id', s12.id);

  console.log('2011 games count in Supabase:', c11);
  console.log('2012 games count in Supabase:', c12);

  // Check BNU Buccaneers 2012 participation
  const { data: bnuTeam } = await supabase.from('teams').select('id').eq('name', 'BNU Buccaneers').single();
  const { data: phases12 } = await supabase.from('phases').select('id, name').eq('season_id', s12.id);
  const phaseIds = phases12.map(p => p.id);
  const phaseMap = Object.fromEntries(phases12.map(p => [p.id, p.name]));

  const { data: bnuPart } = await supabase.from('participations')
    .select('phase_id, wins, losses, ties, points_for, points_against')
    .eq('team_id', bnuTeam.id)
    .in('phase_id', phaseIds);

  console.log('BNU Buccaneers 2012 participations:');
  for (const bp of bnuPart) {
    console.log(`  Phase: ${phaseMap[bp.phase_id]} -> Record: ${bp.wins}-${bp.losses}-${bp.ties}, PF: ${bp.points_for}, PA: ${bp.points_against}`);
  }

  // Check BNU games in 2012
  const { data: bnuGames } = await supabase.from('games')
    .select('date, away_team_id, home_team_id, away_score, home_score, is_playoff, notes')
    .eq('season_id', s12.id)
    .or(`home_team_id.eq.${bnuTeam.id},away_team_id.eq.${bnuTeam.id}`)
    .order('date', { ascending: true });

  const { data: allTeams } = await supabase.from('teams').select('id, name');
  const teamNameMap = Object.fromEntries(allTeams.map(t => [t.id, t.name]));

  console.log(`\nBNU Buccaneers 2012 Games in Supabase (${bnuGames.length} games):`);
  bnuGames.forEach((g, idx) => {
    const away = teamNameMap[g.away_team_id];
    const home = teamNameMap[g.home_team_id];
    console.log(`  ${idx + 1}. [${g.date || 'No Date'}] ${away} ${g.away_score} @ ${home} ${g.home_score} (Playoff: ${g.is_playoff})`);
  });

  // Check duplicate matchups on the same date in 2012
  const { data: g12List } = await supabase.from('games').select('home_team_id, away_team_id, date').eq('season_id', s12.id);
  const seen = new Set();
  let dupes = 0;
  for (const g of g12List) {
    const teams = [g.home_team_id, g.away_team_id].sort().join(' vs ');
    const key = `${teams} on ${g.date}`;
    if (seen.has(key)) {
      console.warn('Duplicate game detected in DB:', key);
      dupes++;
    }
    seen.add(key);
  }
  console.log(`\nTotal duplicate games on same date in 2012 DB: ${dupes}`);
}

verify().catch(console.error);
