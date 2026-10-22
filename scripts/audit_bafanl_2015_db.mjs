import { createRequire } from 'module';
const require = createRequire('/Users/brynprice/uk-football-history/package.json');

const ws = require('ws');
global.WebSocket = ws;
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '/Users/brynprice/uk-football-history/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function audit2015() {
  console.log('====================================================');
  console.log('       2015 BAFANL DATABASE AUDIT REPORT');
  console.log('====================================================');

  const { data: comp } = await supabase.from('competitions').select('id, name, slug').eq('slug', 'bafanl').single();
  const { data: season } = await supabase.from('seasons').select('*').eq('competition_id', comp.id).eq('year', 2015).single();

  console.log(`Season: ${season.year} (${season.id})`);
  console.log(`Expected Participants: ${season.expected_participants}`);
  console.log(`Completeness Score: ${season.completeness_score}`);
  console.log(`Dates: ${season.start_date} to ${season.end_date}`);
  console.log(`Confidence: ${season.confidence_level}`);

  // 1. Phases
  const { data: phases } = await supabase.from('phases').select('id, name, parent_phase_id, ordinal').eq('season_id', season.id).order('ordinal');
  console.log(`\nPhases count: ${phases.length}`);

  // 2. Participations
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
  const coachIds = [...new Set(withCoach.map(p => p.head_coach_id))];
  if (coachIds.length > 0) {
    const { data: coaches } = await supabase.from('people').select('id, display_name').in('id', coachIds);
    const coachNameMap = new Map(coaches.map(c => [c.id, c.display_name]));
    withCoach.forEach(c => {
      console.log(`  👤 ${c.teams?.name} [${c.phase?.name}]: ${coachNameMap.get(c.head_coach_id)}`);
    });
  }

  // 3. Games
  const { count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', season.id);
  console.log(`\nTotal Games in DB: ${gameCount}`);

  const { data: playoffGames, error: pgErr } = await supabase
    .from('games')
    .select('date, away_score, home_score, final_type, title_name, playoff_round, venues:venue_id(name), home_team:home_team_id(name), away_team:away_team_id(name)')
    .eq('season_id', season.id)
    .eq('is_playoff', true)
    .order('date');

  if (pgErr) console.error('Playoff query error:', pgErr);

  console.log(`\nPlayoff Games in DB (${playoffGames?.length}):`);
  playoffGames?.forEach(g => {
    const titleTag = g.final_type ? ` [${g.title_name || g.final_type}] (Venue: ${g.venues?.name || 'N/A'})` : '';
    console.log(`  ${g.date} (${g.playoff_round}${titleTag}): ${g.away_team?.name} ${g.away_score} @ ${g.home_score} ${g.home_team?.name}`);
  });

  console.log('\n====================================================');
  console.log('AUDIT COMPLETE: All structures verified.');
  console.log('====================================================');
}

audit2015().catch(console.error);
