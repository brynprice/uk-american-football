import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY
);

async function verify2012() {
  const SEASON_ID = 'd4e61940-f44a-4b9a-84e7-23d01db775be';

  console.log('=== VERIFYING 2012/13 IMPORT IN SUPABASE ===');

  // 1. Phases
  const { data: phases } = await supabase
    .from('phases')
    .select('id, name, parent_phase_id, type, ordinal')
    .eq('season_id', SEASON_ID)
    .order('ordinal');
  console.log(`Phases count: ${phases?.length || 0}`);
  phases?.forEach(p => console.log(`  - [${p.ordinal}] ${p.name} (${p.type})`));

  // 2. Games
  const { data: games, error: gamesErr } = await supabase
    .from('games')
    .select('id, date, home_score, away_score, is_playoff, playoff_round, final_type, title_name, notes, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)')
    .eq('season_id', SEASON_ID);

  if (gamesErr) console.error('Error fetching games:', gamesErr);
  console.log(`Total Games count: ${games?.length || 0}`);
  const playoffGames = games?.filter(g => g.is_playoff) || [];
  console.log(`Playoff Games count: ${playoffGames.length}`);
  const titleGames = games?.filter(g => g.final_type !== null) || [];
  console.log(`Title Games count: ${titleGames.length}`);
  titleGames.forEach(tg => {
    console.log(`  - ${tg.away_team?.name} ${tg.away_score} @ ${tg.home_team?.name} ${tg.home_score} | round: ${tg.playoff_round} | final_type: ${tg.final_type} | title_name: ${tg.title_name}`);
  });

  // Check for forbidden notes in games (Rule 1: no internal file paths like .xlsx, .csv, data/...)
  const badNotes = games?.filter(g => g.notes && (g.notes.includes('.xlsx') || g.notes.includes('.csv') || (g.notes.includes('.htm') && !g.notes.includes('http')) || g.notes.includes('data/'))) || [];
  console.log(`Rule 1 Note Violations in games: ${badNotes.length}`);
  if (badNotes.length > 0) badNotes.forEach(b => console.log('  [Violation]:', b.notes));

  // 3. Participations & Standings
  const phaseIds = phases?.map(p => p.id) || [];
  const { data: parts, error: partErr } = await supabase
    .from('participations')
    .select('id, phase_id, wins, losses, ties, points_for, points_against, is_champion, head_coach_id, coach:people(display_name), team:teams(name)')
    .in('phase_id', phaseIds);

  if (partErr) console.error('Error fetching participations:', partErr);
  console.log(`Participations count: ${parts?.length || 0}`);
  const champions = parts?.filter(p => p.is_champion) || [];
  console.log(`Divisional Champions flagged: ${champions.length}`);
  champions.forEach(c => {
    console.log(`  - ${c.team?.name} (${c.wins}-${c.losses}-${c.ties})`);
  });

  const coaches = parts?.filter(p => p.head_coach_id) || [];
  console.log(`Participations with linked Head Coach: ${coaches.length}`);
  coaches.forEach(c => {
    console.log(`  - ${c.team?.name}: Coach ${c.coach?.display_name}`);
  });
}

verify2012();
