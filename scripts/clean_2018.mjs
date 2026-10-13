import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function clean2018() {
  const SEASON_ID = '8afa2570-a5b8-4fa9-bdcc-900847cd35ee';

  console.log(`Cleaning season ${SEASON_ID} (2018)...`);

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
    console.log('No games found for 2018.');
  }

  // 2. Find phases for season 2018
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

    // Delete phases: leaf phases first
    for (let round = 0; round < 3; round++) {
      const { data: current } = await supabase.from('phases').select('id, parent_phase_id').eq('season_id', SEASON_ID);
      if (!current || current.length === 0) break;
      const parentsOfSomeone = new Set(current.map(c => c.parent_phase_id).filter(Boolean));
      const leaves = current.filter(c => !parentsOfSomeone.has(c.id));
      if (leaves.length > 0) {
        const { error: delErr } = await supabase.from('phases').delete().in('id', leaves.map(l => l.id));
        if (delErr) {
          console.error('Error deleting leaves in round', round, delErr);
        } else {
          console.log(`Deleted ${leaves.length} leaf phases in round ${round}.`);
        }
      }
    }
  }

  console.log('Clean 2018 complete.');
}

clean2018();
