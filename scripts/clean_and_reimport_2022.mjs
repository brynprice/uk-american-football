import ws from 'ws';
global.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanAndReimport2022() {
  const seasonId = 'e55554cd-5a75-4b5c-b853-5ed6afb34453';

  console.log('=== Step 0: Updating season metadata (expected_participants = 83) ===');
  const { error: seasonErr } = await supabase
    .from('seasons')
    .update({ expected_participants: 83 })
    .eq('id', seasonId);
  if (seasonErr) {
    console.error('Error updating seasons expected_participants:', seasonErr);
  } else {
    console.log('Successfully set expected_participants = 83 for 2022 season.');
  }

  console.log('\n=== Step 1: Importing 25 standardized phases ===');
  execSync('node scripts/import_phases.mjs data/BUAFL/phases2022.csv', { stdio: 'inherit' });

  console.log('\n=== Step 2: Importing participations (83 teams + 8 verified coaches) ===');
  execSync('node scripts/import_participations.mjs data/BUAFL/standings2022.csv', { stdio: 'inherit' });

  console.log('\n=== Step 3: Importing standings & 14 divisional champions ===');
  execSync('node scripts/import_standings.mjs data/BUAFL/standings2022.csv', { stdio: 'inherit' });

  console.log('\n=== Step 4: Purging existing games for 2022 to ensure zero duplicates ===');
  const { data: deleted, error } = await supabase.from('games').delete().eq('season_id', seasonId).select('id');
  if (error) {
    console.error('Error deleting games:', error);
    process.exit(1);
  }
  console.log(`Deleted ${deleted.length} existing games.`);

  console.log('\n=== Step 5: Importing 333 clean games from games2022.csv ===');
  execSync('node scripts/import_data.mjs data/BUAFL/games2022.csv', { stdio: 'inherit' });

  console.log('\n=== Step 6: Recalculating season completeness score ===');
  execSync(`node scripts/calculate_completeness.mjs ${seasonId}`, { stdio: 'inherit' });

  console.log('\n=== Step 7: Verifying final state in Supabase ===');
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

  const coachedParts = parts.filter(p => p.head_coach_id);
  console.log(`Participations with head coach linked: ${coachedParts.length}`);
  for (const cp of coachedParts) {
    const { data: coach } = await supabase.from('people').select('id, display_name').eq('id', cp.head_coach_id).single();
    console.log(`  - ${cp.teams?.name}: ${coach?.display_name}`);
  }

  const { data: season } = await supabase.from('seasons').select('id, year, expected_participants, confidence_level, completeness_score, completeness_details').eq('id', seasonId).single();
  console.log('\nUpdated Season Status:', season);
}

cleanAndReimport2022();
