import { createRequire } from 'module';
const require = createRequire('/Users/brynprice/uk-football-history/package.json');

const ws = require('ws');
global.WebSocket = ws;
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

dotenv.config({ path: '/Users/brynprice/uk-football-history/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const COVID_NOTES = "The 2021 BAFA National Leagues adult contact season operated under a modified 'Return to Play' structure following the disruption of the COVID-19 pandemic. To minimize travel and ease clubs back into full contact competition safely, standard league tiers (Premiership, Division One, and Division Two) and the national Britbowl playoffs were suspended. Instead, 72 teams were organized into 14 regional localized divisions playing an 8-game schedule, concluding with regional division titles and no nationwide postseason championship.";

async function cleanAndReimport2021() {
  const seasonId = '92417ee0-b12c-4b95-9d4b-004e2b89958b';

  console.log('=== Step 0: Updating season metadata (expected_participants = 72, COVID notes) ===');
  const { error: seasonErr } = await supabase
    .from('seasons')
    .update({ 
      name: '2021 Season',
      expected_participants: 72,
      start_date: '2021-06-27',
      end_date: '2021-10-31',
      confidence_level: 'high',
      notes: COVID_NOTES,
      completeness_details: {
        status: 'interrupted',
        waive_title_game: true,
        return_to_play: true
      }
    })
    .eq('id', seasonId);
  if (seasonErr) {
    console.error('Error updating seasons metadata:', seasonErr);
  } else {
    console.log('Successfully set expected_participants = 72 and COVID description for 2021 BAFANL season.');
  }

  console.log('\n=== Step 1: Purging all old games and participations for 2021 BAFANL ===');
  const { data: gDel } = await supabase.from('games').delete().eq('season_id', seasonId).select('id');
  console.log(`Deleted ${gDel?.length || 0} existing games.`);

  const { data: existingPhases } = await supabase.from('phases').select('id').eq('season_id', seasonId);
  if (existingPhases && existingPhases.length > 0) {
    const pIds = existingPhases.map(p => p.id);
    const { data: partDel } = await supabase.from('participations').delete().in('phase_id', pIds).select('id');
    console.log(`Deleted ${partDel?.length || 0} existing participations.`);
  }

  console.log('\n=== Step 2: Importing participations (72 teams across 14 divisions + verified coaches) ===');
  execSync('node scripts/import_participations.mjs data/BAFANL/standings2021.csv', { cwd: '/Users/brynprice/uk-football-history', stdio: 'inherit' });

  console.log('\n=== Step 3: Importing standings & 14 divisional champions ===');
  execSync('node scripts/import_standings.mjs data/BAFANL/standings2021.csv', { cwd: '/Users/brynprice/uk-football-history', stdio: 'inherit' });

  console.log('\n=== Step 4: Importing 267 clean games from games2021.csv ===');
  execSync('node scripts/import_data.mjs data/BAFANL/games2021.csv', { cwd: '/Users/brynprice/uk-football-history', stdio: 'inherit' });

  console.log('\n=== Step 5: Recalculating season completeness score ===');
  execSync(`node scripts/calculate_completeness.mjs ${seasonId}`, { cwd: '/Users/brynprice/uk-football-history', stdio: 'inherit' });

  console.log('\n=== Step 6: Verifying final state in Supabase ===');
  const { count: gameCount } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('season_id', seasonId);
  console.log(`Final games count in DB: ${gameCount}`);

  const { data: phases } = await supabase.from('phases').select('id, name, ordinal').eq('season_id', seasonId);
  console.log(`Phases count in DB: ${phases.length}`);

  const phaseIds = phases.map(p => p.id);
  const { data: parts } = await supabase.from('participations').select('id, team_id, head_coach_id, wins, losses, is_champion, teams(name)').in('phase_id', phaseIds);
  console.log(`Participations count in DB: ${parts.length}`);
  const withStats = parts.filter(p => p.wins !== null);
  console.log(`Participations with stats: ${withStats.length}`);
  const champs = parts.filter(p => p.is_champion);
  console.log(`Divisional champions in DB: ${champs.length}`);
  const withCoach = parts.filter(p => p.head_coach_id !== null);
  console.log(`Participations with verified head coach: ${withCoach.length}`);

  const { data: season } = await supabase.from('seasons').select('id, year, name, expected_participants, confidence_level, completeness_score, completeness_details, notes').eq('id', seasonId).single();
  console.log('\nUpdated Season Status:', season);
}

cleanAndReimport2021().catch(err => {
  console.error('Fatal error during 2021 BAFANL import:', err);
  process.exit(1);
});
