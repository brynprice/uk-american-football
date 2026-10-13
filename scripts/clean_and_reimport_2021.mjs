import ws from 'ws';
global.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanAndReimport2021() {
  const seasonId = 'bed7f73b-de98-4e65-897b-abde26b9ea83';

  console.log('=== Step 1: Importing 25 standardized phases ===');
  execSync('node scripts/import_phases.mjs data/BUAFL/phases2021.csv', { stdio: 'inherit' });

  console.log('\n=== Step 2: Importing participations (85 teams + Ollie Kent) ===');
  execSync('node scripts/import_participations.mjs data/BUAFL/standings2021.csv', { stdio: 'inherit' });

  console.log('\n=== Step 3: Importing standings & 14 divisional champions ===');
  execSync('node scripts/import_standings.mjs data/BUAFL/standings2021.csv', { stdio: 'inherit' });

  console.log('\n=== Step 4: Purging existing games for 2021 to ensure zero duplicates ===');
  const { data: deleted, error } = await supabase.from('games').delete().eq('season_id', seasonId).select('id');
  if (error) {
    console.error('Error deleting games:', error);
    process.exit(1);
  }
  console.log(`Deleted ${deleted.length} existing games.`);

  console.log('\n=== Step 5: Importing 339 clean games from games2021.csv ===');
  execSync('node scripts/import_data.mjs data/BUAFL/games2021.csv', { stdio: 'inherit' });

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

  const brighton = parts.find(p => p.teams?.name === 'Brighton Panthers' || p.teams?.name === 'Brighton Tsunami');
  console.log(`Brighton participation:`, brighton);
  if (brighton && brighton.head_coach_id) {
    const { data: coach } = await supabase.from('people').select('id, name').eq('id', brighton.head_coach_id).single();
    console.log(`Brighton coach:`, coach);
  }
}

cleanAndReimport2021();
