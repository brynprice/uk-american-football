import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
globalThis.WebSocket = ws;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function purgeSeasonData(compName, yearStr, isDryRun) {
  const year = parseInt(yearStr, 10);
  console.log(`=== ${isDryRun ? 'DRY RUN: ' : ''}Purging Season Data for Competition: "${compName}", Year: ${year} ===`);

  // 1. Find Competition
  const { data: comps, error: cErr } = await supabase
    .from('competitions')
    .select('id, name, slug')
    .or(`name.ilike.%${compName}%,slug.ilike.%${compName}%`);

  if (cErr || !comps || comps.length === 0) {
    console.error(`Competition "${compName}" not found. Error:`, cErr);
    process.exit(1);
  }

  const comp = comps[0];
  console.log(`Found competition: "${comp.name}" (${comp.id})`);

  // 2. Find Season
  const { data: seasons, error: sErr } = await supabase
    .from('seasons')
    .select('id, year, name')
    .eq('competition_id', comp.id)
    .eq('year', year);

  if (sErr || !seasons || seasons.length === 0) {
    console.error(`Season for ${compName} ${year} not found. Error:`, sErr);
    process.exit(1);
  }

  const season = seasons[0];
  console.log(`Found season: "${season.name || year}" (${season.id})`);

  // 3. Find Phases
  const { data: phases, error: pErr } = await supabase
    .from('phases')
    .select('id, name, parent_phase_id')
    .eq('season_id', season.id);

  if (pErr) {
    console.error('Error fetching phases:', pErr);
    process.exit(1);
  }

  const phaseIds = (phases || []).map(p => p.id);
  console.log(`Found ${phaseIds.length} phases for ${compName} ${year}.`);

  // 4. Find Participations linked via phase_id
  let partIds = [];
  if (phaseIds.length > 0) {
    const { data: participations, error: partErr } = await supabase
      .from('participations')
      .select('id')
      .in('phase_id', phaseIds);

    if (partErr) {
      console.error('Error fetching participations:', partErr);
    } else {
      partIds = (participations || []).map(p => p.id);
    }
  }
  console.log(`Found ${partIds.length} participation records linked to ${compName} ${year} phases.`);

  // 5. Find Games
  let games = [];
  if (phaseIds.length > 0) {
    const { data: gData, error: gErr } = await supabase
      .from('games')
      .select('id')
      .or(`season_id.eq.${season.id},phase_id.in.(${phaseIds.join(',')}),away_phase_id.in.(${phaseIds.join(',')})`);
    
    if (gErr) {
      console.error('Error fetching games:', gErr);
    } else {
      games = gData || [];
    }
  } else {
    const { data: gData } = await supabase
      .from('games')
      .select('id')
      .eq('season_id', season.id);
    games = gData || [];
  }

  // De-duplicate game IDs
  const gameIds = [...new Set(games.map(g => g.id))];
  console.log(`Found ${gameIds.length} unique game records for ${compName} ${year}.`);

  if (isDryRun) {
    console.log('\n[DRY RUN SUMMARY]');
    console.log(`Would delete ${gameIds.length} games (and related game_staff records).`);
    console.log(`Would delete ${partIds.length} participation records.`);
    console.log(`Would delete ${phaseIds.length} phase records.`);
    console.log('Dry run complete. No database changes were made.');
    return;
  }

  // EXECUTE DELETIONS IN SAFE CASCADE ORDER

  // Step A: Delete game_staff
  if (gameIds.length > 0) {
    console.log(`Deleting game_staff for ${gameIds.length} games...`);
    const { error: gsErr } = await supabase
      .from('game_staff')
      .delete()
      .in('game_id', gameIds);
    if (gsErr) console.warn('Warning deleting game_staff:', gsErr.message);
  }

  // Step B: Delete games
  if (gameIds.length > 0) {
    console.log(`Deleting ${gameIds.length} games...`);
    const { error: gErr } = await supabase
      .from('games')
      .delete()
      .in('id', gameIds);
    if (gErr) console.error('Error deleting games:', gErr.message);
    else console.log('Successfully deleted games.');
  }

  // Step C: Delete participations
  if (partIds.length > 0) {
    console.log(`Deleting ${partIds.length} participations...`);
    const { error: pErr } = await supabase
      .from('participations')
      .delete()
      .in('id', partIds);
    if (pErr) console.error('Error deleting participations:', pErr.message);
    else console.log('Successfully deleted participations.');
  }

  // Step D: Delete child phases then parent phases
  if (phaseIds.length > 0) {
    console.log(`Deleting ${phaseIds.length} phases...`);
    // Delete child phases first (parent_phase_id is not null)
    const childPhases = (phases || []).filter(p => p.parent_phase_id !== null).map(p => p.id);
    if (childPhases.length > 0) {
      const { error: cpErr } = await supabase.from('phases').delete().in('id', childPhases);
      if (cpErr) console.warn('Warning deleting child phases:', cpErr.message);
    }
    // Delete remaining parent/root phases
    const rootPhases = (phases || []).filter(p => p.parent_phase_id === null).map(p => p.id);
    if (rootPhases.length > 0) {
      const { error: rpErr } = await supabase.from('phases').delete().in('id', rootPhases);
      if (rpErr) console.error('Error deleting root phases:', rpErr.message);
      else console.log('Successfully deleted phases.');
    }
  }

  console.log(`\nSUCCESS: Reset of ${compName} ${year} complete.`);
}

const args = process.argv.slice(2);
const compName = args[0] || 'BUAFL';
const yearStr = args[1] || '2012';
const isDryRun = args.includes('--dry-run');

purgeSeasonData(compName, yearStr, isDryRun);
