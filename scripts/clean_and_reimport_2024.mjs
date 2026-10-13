import ws from 'ws';
global.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanAndReimport2024() {
  const seasonId = '6820cd9d-4f28-41f9-9ba0-3026f0736eec';

  console.log('=== Step 0: Updating season metadata (expected_participants = 77) ===');
  const { error: seasonErr } = await supabase
    .from('seasons')
    .update({ expected_participants: 77 })
    .eq('id', seasonId);
  if (seasonErr) {
    console.error('Error updating seasons expected_participants:', seasonErr);
  } else {
    console.log('Successfully set expected_participants = 77 for 2024 season.');
  }

  console.log('\n=== Step 1: Purging all old games, participations, and phases for 2024 ===');
  const { data: gDel } = await supabase.from('games').delete().eq('season_id', seasonId).select('id');
  console.log(`Deleted ${gDel?.length || 0} existing games.`);

  const { data: existingPhases } = await supabase.from('phases').select('id').eq('season_id', seasonId);
  if (existingPhases && existingPhases.length > 0) {
    const pIds = existingPhases.map(p => p.id);
    const { data: partDel } = await supabase.from('participations').delete().in('phase_id', pIds).select('id');
    console.log(`Deleted ${partDel?.length || 0} existing participations.`);
    
    await supabase.from('phases').update({ parent_phase_id: null }).eq('season_id', seasonId);
    const { data: pDel } = await supabase.from('phases').delete().eq('season_id', seasonId).select('id');
    console.log(`Deleted ${pDel?.length || 0} existing phases.`);
  }

  console.log('\n=== Step 2: Importing 27 standardized phases ===');
  execSync('node scripts/import_phases.mjs data/BUAFL/phases2024.csv', { stdio: 'inherit' });

  console.log('\n=== Step 3: Importing participations (77 teams + 8 verified coaches) ===');
  execSync('node scripts/import_participations.mjs data/BUAFL/standings2024.csv', { stdio: 'inherit' });

  console.log('\n=== Step 4: Importing standings & 15 divisional champions ===');
  execSync('node scripts/import_standings.mjs data/BUAFL/standings2024.csv', { stdio: 'inherit' });

  console.log('\n=== Step 5: Importing 305 clean games from games2024.csv ===');
  execSync('node scripts/import_data.mjs data/BUAFL/games2024.csv', { stdio: 'inherit' });

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

cleanAndReimport2024();
