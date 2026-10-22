import { createRequire } from 'module';
const require = createRequire('/Users/brynprice/uk-football-history/package.json');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
globalThis.WebSocket = WebSocket;
const dotenv = require('dotenv');

dotenv.config({ path: '/Users/brynprice/uk-football-history/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const seasonId = '4f2bfd92-5f98-4447-aed1-15d0ef59ac74';

  console.log('='.repeat(70));
  console.log(' DATABASE AUDIT: 2022 BAFANL SEASON');
  console.log('='.repeat(70));

  // 1. Season record
  const { data: season, error: sErr } = await supabase
    .from('seasons')
    .select('id, year, confidence_level, expected_participants, completeness_score, start_date, end_date')
    .eq('id', seasonId)
    .single();
  if (sErr) console.error('Season err:', sErr);
  console.log('Season Record:', season);

  // 2. Phases
  const { data: phases, error: pErr } = await supabase
    .from('phases')
    .select('id, name, type, ordinal, parent_phase_id')
    .eq('season_id', seasonId)
    .order('ordinal');
  console.log(`\nPhases count: ${phases.length}`);

  // 3. Participations
  const phaseIds = phases.map(p => p.id);
  const { data: participations, error: partErr } = await supabase
    .from('participations')
    .select('id, team_id, wins, losses, ties, points_for, points_against, is_champion, head_coach_id, teams(name), phase:phase_id(name)')
    .in('phase_id', phaseIds);
  if (partErr) console.error('Part err:', partErr);
  console.log(`\nParticipations count: ${participations?.length}`);

  const champions = participations.filter(p => p.is_champion);
  console.log(`\nDivisional Champions (${champions.length}):`);
  champions.forEach(c => {
    console.log(`  🏆 [${c.phase?.name}] ${c.teams?.name} (${c.wins}-${c.losses}-${c.ties})`);
  });

  const withCoach = participations.filter(p => p.head_coach_id);
  console.log(`\nVerified Head Coaches (${withCoach.length}):`);
  
  // Fetch coach names
  const coachIds = [...new Set(withCoach.map(p => p.head_coach_id))];
  const { data: coaches } = await supabase.from('people').select('id, display_name').in('id', coachIds);
  const coachNameMap = new Map(coaches.map(c => [c.id, c.display_name]));

  withCoach.forEach(p => {
    console.log(`  👤 [${p.phase?.name}] ${p.teams?.name}: Coach ${coachNameMap.get(p.head_coach_id)}`);
  });

  // 4. Games
  const { data: games, error: gErr } = await supabase
    .from('games')
    .select('id, date, home_team_id, away_team_id, home_score, away_score, is_playoff, final_type, title_name, playoff_round, venue_id, status, venues(name), home:teams!home_team_id(name), away:teams!away_team_id(name)')
    .eq('season_id', seasonId)
    .order('date');

  if (gErr) console.error('Games err:', gErr);
  console.log(`\nTotal games in DB: ${games?.length}`);

  const playoffs = games.filter(g => g.is_playoff);
  console.log(`Playoff games count: ${playoffs.length}`);

  const titleGames = games.filter(g => g.final_type);
  console.log(`\nChampionship / Bowl Games (${titleGames.length}):`);
  titleGames.forEach(tg => {
    console.log(`  🏈 ${tg.date} | ${tg.title_name} (${tg.final_type}): ${tg.away?.name} ${tg.away_score} @ ${tg.home?.name} ${tg.home_score} (Venue: ${tg.venues?.name || 'N/A'})`);
  });

  const walkovers = games.filter(g => (g.home_score === 1 && g.away_score === 0) || (g.home_score === 0 && g.away_score === 1));
  console.log(`Walkovers count: ${walkovers.length}`);

  // 5. Duplicates check
  const gameKeys = new Set();
  let duplicates = 0;
  for (const g of games) {
    const key = `${g.date}|${g.home_team_id}|${g.away_team_id}`;
    if (gameKeys.has(key)) {
      console.error(`DUPLICATE GAME DETECTED: ${g.date} ${g.away?.name} @ ${g.home?.name}`);
      duplicates++;
    }
    gameKeys.add(key);
  }
  console.log(`Duplicate games: ${duplicates}`);

  console.log('='.repeat(70));
}

main().catch(console.error);
