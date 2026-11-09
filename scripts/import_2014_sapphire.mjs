import ws from 'ws';
globalThis.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('=== Step 0: Ensuring Women\'s Team Aliases in Supabase ===');
  execSync('node scripts/add_womens_team_aliases.mjs', { stdio: 'inherit' });

  console.log('\n=== Step 1: Importing teams from data/NWFL/teams2014.csv ===');
  execSync('node scripts/import_teams.mjs data/NWFL/teams2014.csv', { stdio: 'inherit' });

  console.log('\n=== Step 2: Ensuring Season record in Supabase ===');
  execSync('node scripts/import_seasons.mjs data/NWFL/seasons.csv', { stdio: 'inherit' });

  // Get Sapphire Series 2014 season ID
  const { data: comp } = await supabase.from('competitions').select('id').eq('name', 'Sapphire Series').single();
  const { data: season } = await supabase.from('seasons').select('id, name, year').eq('competition_id', comp.id).eq('year', 2014).single();
  console.log(`Found Sapphire Series 2014 Season ID: ${season.id} (${season.name})`);

  console.log('\n=== Step 4: Importing phases from data/NWFL/phases2014.csv ===');
  execSync('node scripts/import_phases.mjs data/NWFL/phases2014.csv', { stdio: 'inherit' });

  console.log('\n=== Step 5: Importing participations (6 teams) ===');
  execSync('node scripts/import_participations.mjs data/NWFL/standings2014.csv', { stdio: 'inherit' });

  console.log('\n=== Step 6: Importing standings & divisional champions ===');
  execSync('node scripts/import_standings.mjs data/NWFL/standings2014.csv', { stdio: 'inherit' });

  console.log('\n=== Step 7: Purging existing games for 2014 to ensure zero duplicates ===');
  const { data: deleted, error: delErr } = await supabase.from('games').delete().eq('season_id', season.id).select('id');
  if (delErr) {
    console.error('Error deleting games:', delErr);
    process.exit(1);
  }
  console.log(`Deleted ${deleted ? deleted.length : 0} existing games.`);

  console.log('\n=== Step 8: Importing games from data/NWFL/games2014.csv ===');
  execSync('node scripts/import_data.mjs data/NWFL/games2014.csv', { stdio: 'inherit' });

  console.log('\n=== Step 9: Recalculating season completeness score ===');
  execSync(`node scripts/calculate_completeness.mjs ${season.id}`, { stdio: 'inherit' });

  console.log('\n=== Step 10: Verifying final state in Supabase ===');
  const { count: gameCount } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('season_id', season.id);
  console.log(`Final games count in DB: ${gameCount}`);

  const { data: phases } = await supabase.from('phases').select('id, name, ordinal, parent_phase_id').eq('season_id', season.id);
  console.log(`Phases count in DB: ${phases.length}`);

  const phaseIds = phases.map(p => p.id);
  const { data: parts } = await supabase.from('participations').select('id, team_id, head_coach_id, wins, losses, is_champion, teams(name)').in('phase_id', phaseIds);
  console.log(`Participations count in DB: ${parts.length}`);
  const withStats = parts.filter(p => p.wins !== null);
  console.log(`Participations with stats: ${withStats.length}`);
  const champs = parts.filter(p => p.is_champion);
  console.log(`Divisional champions in DB: ${champs.length} (${champs.map(c => c.teams.name).join(', ')})`);

  const { data: seasonFinal } = await supabase.from('seasons').select('id, year, name, completeness_score, completeness_details').eq('id', season.id).single();
  console.log(`Season details in DB: ${seasonFinal.name} (${seasonFinal.year}), Completeness: ${seasonFinal.completeness_score}%`);
  console.log('Details:', JSON.stringify(seasonFinal.completeness_details, null, 2));
}

run().catch(err => {
  console.error('Fatal error during import:', err);
  process.exit(1);
});
