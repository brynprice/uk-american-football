import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function clean2014() {
  const SEASON_ID = '54c09a7b-ed8c-4a05-9b07-09c4df7e3aaf';

  console.log(`Cleaning season ${SEASON_ID} (2014)...`);

  // 1. Fetch games and delete game_staff
  const { data: existingGames } = await supabase
    .from('games')
    .select('id')
    .eq('season_id', SEASON_ID);

  if (existingGames && existingGames.length > 0) {
    const gameIds = existingGames.map(g => g.id);
    const { error: staffErr } = await supabase
      .from('game_staff')
      .delete()
      .in('game_id', gameIds);
    if (staffErr) console.warn('Warning deleting game_staff:', staffErr.message);

    const { data: deletedGames, error: gamesErr } = await supabase
      .from('games')
      .delete()
      .eq('season_id', SEASON_ID)
      .select('id');
    if (gamesErr) {
      console.error('Error deleting games:', gamesErr);
    } else {
      console.log(`Deleted ${deletedGames?.length || 0} games.`);
    }
  } else {
    console.log('No games found for 2014.');
  }

  await supabase.from('seasons').update({ champion_id: null }).eq('id', SEASON_ID);

  // 2. Find phases for season 2014
  const { data: phases } = await supabase
    .from('phases')
    .select('id, name, parent_phase_id')
    .eq('season_id', SEASON_ID);

  if (phases && phases.length > 0) {
    const phaseIds = phases.map(p => p.id);

    // Delete participations attached to these phases
    const { data: deletedPart, error: partErr } = await supabase
      .from('participations')
      .delete()
      .in('phase_id', phaseIds)
      .select('id');
    if (partErr) {
      console.error('Error deleting participations:', partErr);
    } else {
      console.log(`Deleted ${deletedPart?.length || 0} participations.`);
    }

    // Delete child phases first, then parents
    const childPhases = phases.filter(p => p.parent_phase_id !== null);
    const parentPhases = phases.filter(p => p.parent_phase_id === null);

    if (childPhases.length > 0) {
      const { error: childErr } = await supabase
        .from('phases')
        .delete()
        .in('id', childPhases.map(p => p.id));
      if (childErr) console.error('Error deleting child phases:', childErr);
      else console.log(`Deleted ${childPhases.length} child phases.`);
    }

    if (parentPhases.length > 0) {
      const { error: parentErr } = await supabase
        .from('phases')
        .delete()
        .in('id', parentPhases.map(p => p.id));
      if (parentErr) console.error('Error deleting parent phases:', parentErr);
      else console.log(`Deleted ${parentPhases.length} parent phases.`);
    }
  }

  console.log('Clean complete.');
}

clean2014();
