import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function clean2011() {
  const SEASON_ID = '60c4fa58-3675-47f9-ad47-bef29f3d0f5c';

  console.log(`Cleaning season ${SEASON_ID} (2011)...`);

  // 1. Delete games
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

  // 2. Find phases for season 2011
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

clean2011();
