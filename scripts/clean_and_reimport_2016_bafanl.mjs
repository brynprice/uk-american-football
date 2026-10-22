import { createRequire } from 'module';
const require = createRequire('/Users/brynprice/uk-football-history/package.json');

const ws = require('ws');
global.WebSocket = ws;
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

dotenv.config({ path: '/Users/brynprice/uk-football-history/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SEASON_NOTES = "Source: BAFA contemporary records & Wikipedia (https://it.wikipedia.org/wiki/BAFA_NL_Premiership_2016, https://it.wikipedia.org/wiki/BAFA_NL_Division_One_2016, https://it.wikipedia.org/wiki/BAFA_NL_Division_Two_2016). The 2016 BAFA National Leagues adult contact season featured 64 teams across 11 divisions in 3 tiers. The season concluded with Britbowl XXX at Sixways Stadium in Worcester on 27 August 2016, where the London Warriors defeated the London Blitz 36-15 to capture their fourth consecutive National Championship.";

async function cleanAndReimport2016() {
  const { data: comp } = await supabase.from('competitions').select('id').eq('slug', 'bafanl').single();
  const { data: season } = await supabase.from('seasons').select('id').eq('competition_id', comp.id).eq('year', 2016).single();
  if (!season) {
    throw new Error('2016 BAFANL season not found in Supabase!');
  }
  const seasonId = season.id;
  console.log(`2016 BAFANL Season ID: ${seasonId}`);

  console.log('\n=== Step 0: Updating season metadata (expected_participants = 64) ===');
  const { error: seasonErr } = await supabase
    .from('seasons')
    .update({ 
      expected_participants: 64,
      start_date: '2016-04-10',
      end_date: '2016-09-11',
      confidence_level: 'high',
      notes: SEASON_NOTES
    })
    .eq('id', seasonId);
  if (seasonErr) {
    console.error('Error updating seasons metadata:', seasonErr);
  } else {
    console.log('Successfully set expected_participants = 64 for 2016 BAFANL season.');
  }

  console.log('\n=== Step 1: Purging all old games and participations for 2016 BAFANL ===');
  const { data: gDel } = await supabase.from('games').delete().eq('season_id', seasonId).select('id');
  console.log(`Deleted ${gDel?.length || 0} existing games.`);

  const { data: existingPhases } = await supabase.from('phases').select('id').eq('season_id', seasonId);
  if (existingPhases && existingPhases.length > 0) {
    const pIds = existingPhases.map(p => p.id);
    const { data: partDel } = await supabase.from('participations').delete().in('phase_id', pIds).select('id');
    console.log(`Deleted ${partDel?.length || 0} existing participations.`);
  }

  console.log('\n=== Step 2: Importing participations (64 teams across 11 divisions + verified coaches) ===');
  execSync('node scripts/import_participations.mjs data/BAFANL/standings2016.csv', { cwd: '/Users/brynprice/uk-football-history', stdio: 'inherit' });

  console.log('\n=== Step 3: Importing standings & 11 divisional champions ===');
  execSync('node scripts/import_standings.mjs data/BAFANL/standings2016.csv', { cwd: '/Users/brynprice/uk-football-history', stdio: 'inherit' });

  console.log('\n=== Step 4: Importing 341 clean games from games2016.csv ===');
  execSync('node scripts/import_data.mjs data/BAFANL/games2016.csv', { cwd: '/Users/brynprice/uk-football-history', stdio: 'inherit' });

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

  const { data: finalSeason } = await supabase.from('seasons').select('id, year, expected_participants, confidence_level, completeness_score, completeness_details').eq('id', seasonId).single();
  console.log('\nUpdated Season Status:', finalSeason);
}

cleanAndReimport2016().catch(console.error);
