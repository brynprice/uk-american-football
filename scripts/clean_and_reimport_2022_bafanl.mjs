import { createRequire } from 'module';
const require = createRequire('/Users/brynprice/uk-football-history/package.json');

const ws = require('ws');
global.WebSocket = ws;
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

dotenv.config({ path: '/Users/brynprice/uk-football-history/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanAndReimport2022() {
  const seasonId = '4f2bfd92-5f98-4447-aed1-15d0ef59ac74';

  console.log('=== Step 0: Updating season metadata (expected_participants = 68) ===');
  const { error: seasonErr } = await supabase
    .from('seasons')
    .update({ 
      expected_participants: 68,
      start_date: '2022-04-10',
      end_date: '2022-09-04',
      confidence_level: 'high'
    })
    .eq('id', seasonId);
  if (seasonErr) {
    console.error('Error updating seasons metadata:', seasonErr);
  } else {
    console.log('Successfully set expected_participants = 68 for 2022 BAFANL season.');
  }

  console.log('\n=== Step 1: Purging all old games and participations for 2022 BAFANL ===');
  const { data: gDel } = await supabase.from('games').delete().eq('season_id', seasonId).select('id');
  console.log(`Deleted ${gDel?.length || 0} existing games.`);

  const { data: existingPhases } = await supabase.from('phases').select('id').eq('season_id', seasonId);
  if (existingPhases && existingPhases.length > 0) {
    const pIds = existingPhases.map(p => p.id);
    const { data: partDel } = await supabase.from('participations').delete().in('phase_id', pIds).select('id');
    console.log(`Deleted ${partDel?.length || 0} existing participations.`);
  }

  console.log('\n=== Step 2: Importing participations (68 teams across 14 divisions + verified coaches) ===');
  execSync('node scripts/import_participations.mjs data/BAFANL/standings2022.csv', { cwd: '/Users/brynprice/uk-football-history', stdio: 'inherit' });

  console.log('\n=== Step 3: Importing standings & 14 divisional champions ===');
  execSync('node scripts/import_standings.mjs data/BAFANL/standings2022.csv', { cwd: '/Users/brynprice/uk-football-history', stdio: 'inherit' });

  console.log('\n=== Step 4: Importing 318 clean games from games2022.csv ===');
  execSync('node scripts/import_data.mjs data/BAFANL/games2022.csv', { cwd: '/Users/brynprice/uk-football-history', stdio: 'inherit' });

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

  const { data: season } = await supabase.from('seasons').select('id, year, expected_participants, confidence_level, completeness_score, completeness_details').eq('id', seasonId).single();
  console.log('\nUpdated Season Status:', season);
}

cleanAndReimport2022().catch(console.error);
