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
  const { data: comp } = await supabase.from('competitions').select('id').eq('slug', 'bafanl').single();
  const { data: season, error: sErr } = await supabase
    .from('seasons')
    .select('id, year, confidence_level, expected_participants, completeness_score, start_date, end_date, notes, completeness_details')
    .eq('competition_id', comp.id)
    .eq('year', 2018)
    .single();

  if (sErr) throw sErr;
  const seasonId = season.id;

  console.log('='.repeat(70));
  console.log(' DATABASE AUDIT: 2018 BAFANL SEASON');
  console.log('='.repeat(70));

  // 1. Season record
  console.log('Season Record:');
  console.log(`  ID: ${season.id}`);
  console.log(`  Year: ${season.year}`);
  console.log(`  Expected Participants: ${season.expected_participants}`);
  console.log(`  Completeness Score: ${season.completeness_score}`);
  console.log(`  Start Date: ${season.start_date} | End Date: ${season.end_date}`);
  console.log(`  Confidence Level: ${season.confidence_level}`);

  // 2. Phases
  const { data: phases, error: pErr } = await supabase
    .from('phases')
    .select('id, name, type, ordinal, parent_phase_id')
    .eq('season_id', seasonId)
    .order('ordinal');
  if (pErr) console.error('Phase error:', pErr);
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
  const coachIds = [...new Set(withCoach.map(p => p.head_coach_id))];
  if (coachIds.length > 0) {
    const { data: coaches } = await supabase.from('people').select('id, display_name').in('id', coachIds);
    const coachNameMap = new Map(coaches.map(c => [c.id, c.display_name]));
    withCoach.forEach(c => {
      console.log(`  👤 ${c.teams?.name} [${c.phase?.name}]: ${coachNameMap.get(c.head_coach_id)}`);
    });
  }

  // 4. Games
  const { count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', seasonId);
  console.log(`\nTotal Games in DB: ${gameCount}`);

  const { data: playoffGames, error: pgErr } = await supabase
    .from('games')
    .select('date, away_score, home_score, final_type, title_name, playoff_round, home_team:home_team_id(name), away_team:away_team_id(name)')
    .eq('season_id', seasonId)
    .eq('is_playoff', true)
    .order('date');

  if (pgErr) console.error('Playoff query error:', pgErr);

  console.log(`\nPlayoff Games in DB (${playoffGames?.length}):`);
  playoffGames?.forEach(g => {
    const titleTag = g.final_type ? ` [${g.title_name || g.final_type}]` : '';
    console.log(`  ${g.date} (${g.playoff_round}${titleTag}): ${g.away_team?.name} ${g.away_score} @ ${g.home_score} ${g.home_team?.name}`);
  });

  console.log('\nAudit completed successfully.');
}

main().catch(console.error);
