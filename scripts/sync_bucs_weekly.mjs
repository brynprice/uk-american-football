#!/usr/bin/env node
/**
 * UK American Football Archive - Weekly BUCS Fixtures & Scores Sync Tool
 *
 * Ingests weekly match scores, postponements, and walkovers from BUCS Play / Playwaze
 * data feeds or CSV/JSON fixtures, previews diffs, and deterministically applies them.
 *
 * Usage:
 *   node scripts/sync_bucs_weekly.mjs --file data/weekly_feed.json --dry-run
 *   node scripts/sync_bucs_weekly.mjs --file data/weekly_feed.csv --apply --recompute
 */

import ws from 'ws';
global.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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

const inputFile = getArg('--file');
const seasonYear = getArg('--season') ? parseInt(getArg('--season'), 10) : 2026;
const isApply = args.includes('--apply');
const shouldRecompute = args.includes('--recompute');

// Load team alias mapping if available
let bucsTeamMap = {};
const mappingPath = path.resolve('data/mappings/bucs_teams.json');
if (fs.existsSync(mappingPath)) {
  try {
    bucsTeamMap = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  } catch (e) {
    console.warn('Could not parse bucs_teams.json:', e.message);
  }
}

function resolveTeamName(rawName) {
  if (!rawName) return rawName;
  const trimmed = rawName.trim();
  return bucsTeamMap[trimmed] || trimmed;
}

async function runSync() {
  console.log(`\n=== BUCS Weekly Sync Tool (Season: ${seasonYear}) ===`);
  console.log(`Mode: ${isApply ? 'LIVE APPLY' : 'DRY RUN (Preview Only)'}`);

  // Fetch season
  const { data: season, error: sErr } = await supabase
    .from('seasons')
    .select('id, year')
    .eq('year', seasonYear)
    .single();

  if (sErr || !season) {
    console.error(`Season ${seasonYear} not found in database:`, sErr?.message);
    process.exit(1);
  }

  // Fetch all teams
  const { data: teams } = await supabase.from('teams').select('id, name');
  const teamByName = new Map();
  for (const t of (teams || [])) {
    teamByName.set(t.name.toLowerCase(), t.id);
  }

  // Fetch existing games for season
  const { data: existingGames, error: gErr } = await supabase
    .from('games')
    .select('id, home_team_id, away_team_id, home_score, away_score, status, date, time, notes')
    .eq('season_id', season.id);

  if (gErr) {
    console.error('Error fetching existing games:', gErr.message);
    process.exit(1);
  }

  const gameLookup = new Map();
  for (const g of (existingGames || [])) {
    const key = `${g.home_team_id}:${g.away_team_id}`;
    gameLookup.set(key, g);
  }

  if (!inputFile) {
    console.log('\nNo input file provided. Use --file <path_to_json_or_csv> to process incoming scores.');
    console.log(`Database currently has ${existingGames?.length || 0} fixtures registered for season ${seasonYear}.`);
    return;
  }

  // Parse input
  const content = fs.readFileSync(inputFile, 'utf8');
  let incomingMatches = [];

  if (inputFile.endsWith('.json')) {
    incomingMatches = JSON.parse(content);
  } else if (inputFile.endsWith('.csv')) {
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const headers = lines[0].split(',').map(h => h.trim());
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      const row = {};
      headers.forEach((h, idx) => row[h] = parts[idx]);
      incomingMatches.push(row);
    }
  }

  console.log(`Processing ${incomingMatches.length} incoming match record(s)...`);

  const updates = [];

  for (const match of incomingMatches) {
    const rawHome = match.home_team || match.HomeTeam || match.home;
    const rawAway = match.away_team || match.AwayTeam || match.away;
    const homeName = resolveTeamName(rawHome);
    const awayName = resolveTeamName(rawAway);

    const homeId = teamByName.get(homeName.toLowerCase());
    const awayId = teamByName.get(awayName.toLowerCase());

    if (!homeId || !awayId) {
      console.warn(`Could not resolve team ID for match: "${rawHome}" vs "${rawAway}"`);
      continue;
    }

    const key = `${homeId}:${awayId}`;
    const existing = gameLookup.get(key);

    if (!existing) {
      console.warn(`No pre-scheduled game found in database for ${homeName} vs ${awayName}.`);
      continue;
    }

    const newHomeScore = match.home_score !== undefined && match.home_score !== '' ? parseInt(match.home_score, 10) : null;
    const newAwayScore = match.away_score !== undefined && match.away_score !== '' ? parseInt(match.away_score, 10) : null;
    const newStatus = match.status || (newHomeScore !== null && newAwayScore !== null ? 'completed' : existing.status);

    const scoreChanged = newHomeScore !== existing.home_score || newAwayScore !== existing.away_score;
    const statusChanged = newStatus !== existing.status;

    if (scoreChanged || statusChanged) {
      updates.push({
        id: existing.id,
        homeName,
        awayName,
        oldScore: `${existing.home_score ?? '-'}:${existing.away_score ?? '-'} (${existing.status})`,
        newScore: `${newHomeScore ?? '-'}:${newAwayScore ?? '-'} (${newStatus})`,
        payload: {
          home_score: newHomeScore,
          away_score: newAwayScore,
          status: newStatus,
          notes: match.notes || existing.notes
        }
      });
    }
  }

  if (updates.length === 0) {
    console.log('No score or status discrepancies found. Database is fully up-to-date!');
    return;
  }

  console.log(`\nIdentified ${updates.length} fixture update(s):`);
  for (const u of updates) {
    console.log(`  - [${u.homeName} vs ${u.awayName}] ${u.oldScore} -> ${u.newScore}`);
  }

  if (isApply) {
    console.log('\nApplying updates to Supabase...');
    for (const u of updates) {
      const { error } = await supabase.from('games').update(u.payload).eq('id', u.id);
      if (error) {
        console.error(`  Error updating game ${u.id}:`, error.message);
      }
    }
    console.log('All updates committed.');

    if (shouldRecompute) {
      console.log('\nTriggering standings recomputation...');
      execSync(`node scripts/recompute_standings.mjs --year ${seasonYear}`, { stdio: 'inherit' });
    }
  } else {
    console.log('\nRun with --apply to write these changes to the database.');
  }
}

runSync().catch(err => {
  console.error('Fatal error during sync:', err);
  process.exit(1);
});
