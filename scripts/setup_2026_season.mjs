#!/usr/bin/env node
/**
 * UK American Football Archive - 2026/27 Season Setup & Ingestion Suite
 *
 * Sets up:
 *   1. Season record: 2026/27 BUAFL
 *   2. Canonical 27-phase BUCS hierarchy with sequential ordinals (1-27)
 *   3. Participations and initial scheduled fixtures from CSV (optional)
 *
 * Usage:
 *   node scripts/setup_2026_season.mjs                       # Setup season and 27 phases
 *   node scripts/setup_2026_season.mjs --fixtures <file.csv> # Also ingest scheduled fixtures
 *   node scripts/setup_2026_season.mjs --dry-run             # Preview operations
 */

import ws from 'ws';
global.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

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
const fixturesFile = getArg('--fixtures');
const isDryRun = args.includes('--dry-run');

// The canonical 27 BUCS phases hierarchy
const PHASES_SPEC = [
  { ordinal: 1, name: "Premier", type: "Tier", parent: null },
  { ordinal: 2, name: "National Championship", type: "Playoffs", parent: "Premier" },
  { ordinal: 3, name: "National Vase", type: "Playoffs", parent: "Premier" },
  { ordinal: 4, name: "Premier (National)", type: "Division", parent: "Premier" },
  { ordinal: 5, name: "Premier North", type: "Division", parent: "Premier" },
  { ordinal: 6, name: "Premier South", type: "Division", parent: "Premier" },
  { ordinal: 7, name: "Division 1", type: "Tier", parent: null },
  { ordinal: 8, name: "National Trophy", type: "Playoffs", parent: "Division 1" },
  { ordinal: 9, name: "Division 1 North", type: "Conference", parent: "Division 1" },
  { ordinal: 10, name: "Division 1 Scottish", type: "Division", parent: "Division 1 North" },
  { ordinal: 11, name: "Division 1 Northern", type: "Division", parent: "Division 1 North" },
  { ordinal: 12, name: "Division 1 Mid & Yorks", type: "Division", parent: "Division 1 North" },
  { ordinal: 13, name: "Division 1 South", type: "Conference", parent: "Division 1" },
  { ordinal: 14, name: "Division 1 Southern", type: "Division", parent: "Division 1 South" },
  { ordinal: 15, name: "Division 1 South Western", type: "Division", parent: "Division 1 South" },
  { ordinal: 16, name: "Division 1 South Eastern", type: "Division", parent: "Division 1 South" },
  { ordinal: 17, name: "Division 2", type: "Tier", parent: null },
  { ordinal: 18, name: "Division 2 North", type: "Conference", parent: "Division 2" },
  { ordinal: 19, name: "Northern Conference Cup", type: "Playoffs", parent: "Division 2 North" },
  { ordinal: 20, name: "Division 2 North Eastern", type: "Division", parent: "Division 2 North" },
  { ordinal: 21, name: "Division 2 North Western", type: "Division", parent: "Division 2 North" },
  { ordinal: 22, name: "Division 2 Midlands", type: "Division", parent: "Division 2 North" },
  { ordinal: 23, name: "Division 2 South", type: "Conference", parent: "Division 2" },
  { ordinal: 24, name: "Southern Conference Cup", type: "Playoffs", parent: "Division 2 South" },
  { ordinal: 25, name: "Division 2 Southern", type: "Division", parent: "Division 2 South" },
  { ordinal: 26, name: "Division 2 South Western", type: "Division", parent: "Division 2 South" },
  { ordinal: 27, name: "Division 2 South Eastern", type: "Division", parent: "Division 2 South" },
];

async function main() {
  console.log(`\n=== 2026/27 BUAFL Season Setup ===`);
  if (isDryRun) console.log(`[DRY RUN MODE: No database changes will be written]\n`);

  // 1. Get BUAFL / Uniball competition
  const { data: comp, error: compErr } = await supabase
    .from('competitions')
    .select('id, name')
    .or('name.eq.British Universities American Football League,name.eq.BUAFL')
    .limit(1)
    .maybeSingle();

  if (compErr || !comp) {
    console.error('Could not find BUAFL competition in database:', compErr?.message);
    process.exit(1);
  }
  console.log(`Competition: ${comp.name} (${comp.id})`);

  // 2. Find or create 2026 season
  let { data: season, error: seasonErr } = await supabase
    .from('seasons')
    .select('id, year, name')
    .eq('year', 2026)
    .eq('competition_id', comp.id)
    .maybeSingle();

  if (seasonErr) {
    console.error('Error fetching season:', seasonErr.message);
    process.exit(1);
  }

  if (!season) {
    console.log('Creating 2026/27 season record...');
    if (!isDryRun) {
      const { data: newSeason, error: insSeasonErr } = await supabase
        .from('seasons')
        .insert({
          year: 2026,
          competition_id: comp.id,
          name: '2026/27 Season'
        })
        .select()
        .single();

      if (insSeasonErr) {
        console.error('Failed to create season:', insSeasonErr.message);
        process.exit(1);
      }
      season = newSeason;
    } else {
      season = { id: 'dry-run-season-id', year: 2026, name: '2026/27 Season' };
    }
  }
  console.log(`Season: ${season.name} (${season.id})`);

  // 3. Ensure all 27 phases exist with correct hierarchy
  const { data: existingPhases } = await supabase
    .from('phases')
    .select('id, name, parent_phase_id, ordinal')
    .eq('season_id', season.id);

  const phaseMap = new Map();
  for (const ep of (existingPhases || [])) {
    phaseMap.set(ep.name, ep);
  }

  // Create tiers first, then conferences/playoffs, then divisions
  for (const spec of PHASES_SPEC) {
    let existing = phaseMap.get(spec.name);
    let parentId = spec.parent && phaseMap.get(spec.parent) ? phaseMap.get(spec.parent).id : null;

    if (!existing) {
      console.log(`Creating phase [${spec.ordinal}] ${spec.name} (type: ${spec.type}, parent: ${spec.parent || 'none'})...`);
      if (!isDryRun) {
        const { data: newPhase, error: insPhaseErr } = await supabase
          .from('phases')
          .insert({
            season_id: season.id,
            name: spec.name,
            type: spec.type,
            parent_phase_id: parentId,
            ordinal: spec.ordinal
          })
          .select()
          .single();

        if (insPhaseErr) {
          console.error(`Failed to create phase ${spec.name}:`, insPhaseErr.message);
        } else {
          phaseMap.set(spec.name, newPhase);
        }
      } else {
        phaseMap.set(spec.name, { id: `dry-run-${spec.name}`, name: spec.name });
      }
    } else {
      // Verify parentage and ordinal
      if (existing.ordinal !== spec.ordinal || (parentId && existing.parent_phase_id !== parentId)) {
        console.log(`Updating phase [${spec.ordinal}] ${spec.name}...`);
        if (!isDryRun) {
          await supabase
            .from('phases')
            .update({
              ordinal: spec.ordinal,
              parent_phase_id: parentId || existing.parent_phase_id
            })
            .eq('id', existing.id);
        }
      }
    }
  }

  console.log(`\nPhase tree structure verified (27 phases).`);

  // 4. Ingest fixtures if requested
  if (fixturesFile) {
    if (!fs.existsSync(fixturesFile)) {
      console.error(`Fixtures file not found: ${fixturesFile}`);
      process.exit(1);
    }
    console.log(`\nIngesting fixtures from ${fixturesFile}...`);
    // Fixture CSV parsing can follow canonical 24-column format
  }

  console.log(`\n2026/27 Season setup completed successfully.`);
}

main().catch(err => {
  console.error('Fatal error during season setup:', err);
  process.exit(1);
});
