#!/usr/bin/env node
/**
 * UK American Football Archive - Standings Recomputation Script
 *
 * Deterministically computes wins, losses, ties, points for, and points against
 * from all completed/awarded league games for each phase and synchronizes the
 * `participations` table in Supabase.
 *
 * Usage:
 *   node scripts/recompute_standings.mjs --year 2026              # Recompute specific season
 *   node scripts/recompute_standings.mjs --phase <uuid>           # Recompute specific phase
 *   node scripts/recompute_standings.mjs --year 2026 --dry-run    # Preview changes without saving
 */

import ws from 'ws';
global.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}
const yearArg = getArg('--year') ? parseInt(getArg('--year'), 10) : null;
const phaseArg = getArg('--phase');
const isDryRun = args.includes('--dry-run');

async function recompute() {
  console.log(`\n=== Recomputing Standings ===`);
  if (isDryRun) console.log(`[DRY RUN MODE: No database changes will be written]`);

  // 1. Fetch target phases
  let phaseQuery = supabase
    .from('phases')
    .select(`
      id,
      name,
      type,
      season:seasons!inner(id, year, competition:competitions(name))
    `);

  if (phaseArg) {
    phaseQuery = phaseQuery.eq('id', phaseArg);
  } else if (yearArg) {
    phaseQuery = phaseQuery.eq('season.year', yearArg);
  } else {
    console.error('Please specify either --year <YYYY> or --phase <UUID>');
    process.exit(1);
  }

  const { data: phases, error: phaseErr } = await phaseQuery;
  if (phaseErr) {
    console.error('Error fetching phases:', phaseErr.message);
    process.exit(1);
  }

  if (!phases || phases.length === 0) {
    console.log('No matching phases found.');
    return;
  }

  console.log(`Found ${phases.length} phase(s) to process.`);

  let totalUpdated = 0;

  for (const phase of phases) {
    const isKnockout = ['playoffs', 'tournament', 'bowl'].includes((phase.type || '').toLowerCase()) ||
                       (phase.name || '').toLowerCase().includes('playoff') ||
                       (phase.name || '').toLowerCase().includes('cup') ||
                       (phase.name || '').toLowerCase().includes('trophy') ||
                       (phase.name || '').toLowerCase().includes('vase');

    if (isKnockout) {
      // Knockout tournament phases do not maintain divisional standings tables
      continue;
    }

    // Fetch participations in this phase
    const { data: participations, error: partErr } = await supabase
      .from('participations')
      .select('id, team_id, wins, losses, ties, points_for, points_against, team:teams(name)')
      .eq('phase_id', phase.id);

    if (partErr) {
      console.error(`Error fetching participations for phase ${phase.name}:`, partErr.message);
      continue;
    }

    if (!participations || participations.length === 0) {
      continue;
    }

    // Fetch completed or awarded league games for this phase
    const { data: games, error: gameErr } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id, home_score, away_score, status, is_double_header, game_type, is_playoff')
      .eq('phase_id', phase.id)
      .in('status', ['completed', 'awarded'])
      .eq('is_playoff', false);

    if (gameErr) {
      console.error(`Error fetching games for phase ${phase.name}:`, gameErr.message);
      continue;
    }

    // Calculate record per team
    const teamStats = new Map();
    for (const p of participations) {
      teamStats.set(p.team_id, {
        partId: p.id,
        teamName: p.team?.name || 'Unknown',
        current: { w: p.wins, l: p.losses, t: p.ties, pf: p.points_for, pa: p.points_against },
        computed: { w: 0, l: 0, t: 0, pf: 0, pa: 0, gamesCount: 0 }
      });
    }

    for (const g of (games || [])) {
      if (g.game_type && g.game_type !== 'league') continue;
      if (g.home_score === null || g.away_score === null) continue;

      const mult = g.is_double_header ? 2 : 1;

      // Home stats
      if (teamStats.has(g.home_team_id)) {
        const h = teamStats.get(g.home_team_id);
        h.computed.pf += g.home_score;
        h.computed.pa += g.away_score;
        h.computed.gamesCount++;
        if (g.home_score > g.away_score) h.computed.w += mult;
        else if (g.home_score < g.away_score) h.computed.l += mult;
        else h.computed.t += mult;
      }

      // Away stats
      if (teamStats.has(g.away_team_id)) {
        const a = teamStats.get(g.away_team_id);
        a.computed.pf += g.away_score;
        a.computed.pa += g.home_score;
        a.computed.gamesCount++;
        if (g.away_score > g.home_score) a.computed.w += mult;
        else if (g.away_score < g.home_score) a.computed.l += mult;
        else a.computed.t += mult;
      }
    }

    let phaseChanges = 0;

    for (const [teamId, stat] of teamStats.entries()) {
      const { current, computed, partId, teamName } = stat;

      const diff =
        current.w !== computed.w ||
        current.l !== computed.l ||
        current.t !== computed.t ||
        current.pf !== computed.pf ||
        current.pa !== computed.pa;

      if (diff) {
        phaseChanges++;
        console.log(
          `  [${phase.name}] ${teamName}: (${current.w ?? '-'}-${current.l ?? '-'}-${current.t ?? '-'}, ${current.pf ?? '-'}/${current.pa ?? '-'}) -> (${computed.w}-${computed.l}-${computed.t}, ${computed.pf}/${computed.pa})`
        );

        if (!isDryRun) {
          const { error: updErr } = await supabase
            .from('participations')
            .update({
              wins: computed.w,
              losses: computed.l,
              ties: computed.t,
              points_for: computed.pf,
              points_against: computed.pa
            })
            .eq('id', partId);

          if (updErr) {
            console.error(`    Failed to update participation ${partId}:`, updErr.message);
          } else {
            totalUpdated++;
          }
        }
      }
    }

    if (phaseChanges > 0) {
      console.log(`  Phase ${phase.name}: ${phaseChanges} participation(s) adjusted.`);
    }
  }

  console.log(`\nRecomputation completed. Total participations updated: ${isDryRun ? 0 : totalUpdated}`);
}

recompute().catch(err => {
  console.error('Fatal error during recomputation:', err);
  process.exit(1);
});
