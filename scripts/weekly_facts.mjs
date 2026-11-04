#!/usr/bin/env node
/**
 * UK American Football Archive - Weekly Facts CLI
 * 
 * Usage:
 *   node scripts/weekly_facts.mjs [--past-week]
 *   node scripts/weekly_facts.mjs --week 2
 *   node scripts/weekly_facts.mjs --week 1 --season 2026
 *   node scripts/weekly_facts.mjs --start 2026-10-31 --end 2026-11-01
 *   node scripts/weekly_facts.mjs --format brief
 *   node scripts/weekly_facts.mjs --format json
 */

import ws from 'ws';
global.WebSocket = ws;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import {
  generateWeeklyFacts,
  formatFactsMarkdown,
  formatFactsBrief
} from '../lib/facts/weekly-facts-core.mjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[FATAL] Missing Supabase environment variables in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

let weekArg = getArg('--week') || getArg('-w');
if (!weekArg) {
  const weekIdx = args.findIndex(a => a.toLowerCase() === 'week');
  if (weekIdx !== -1 && weekIdx + 1 < args.length) {
    weekArg = args[weekIdx + 1];
  } else {
    // Check if any argument is just a standalone number (e.g. "2")
    const numArg = args.find(a => !isNaN(parseInt(a, 10)) && parseInt(a, 10) > 0 && parseInt(a, 10) <= 25);
    if (numArg) {
      weekArg = numArg;
    }
  }
}

const seasonArg = getArg('--season') || getArg('-s');
const startArg = getArg('--start');
const endArg = getArg('--end');
const formatArg = getArg('--format') || 'markdown';
const outputArg = getArg('--output') || getArg('-o');
const isPdf = args.includes('--pdf');
const isPastWeek = args.includes('--past-week') || (!weekArg && !startArg && !endArg);

async function main() {
  if (isPdf) {
    const { execSync } = await import('child_process');
    const cmd = `node scripts/generate_weekly_pdf.mjs ${weekArg ? `--week ${weekArg}` : ''} ${seasonArg ? `--season ${seasonArg}` : ''} ${outputArg ? `--output "${outputArg}"` : ''}`;
    execSync(cmd, { stdio: 'inherit' });
    return;
  }
  try {
    const options = {
      week: weekArg ? parseInt(weekArg, 10) : undefined,
      season: seasonArg ? parseInt(seasonArg, 10) : undefined,
      startDate: startArg || undefined,
      endDate: endArg || undefined,
      pastWeek: isPastWeek
    };

    const facts = await generateWeeklyFacts(supabase, options);

    let output = '';
    if (formatArg === 'json') {
      output = JSON.stringify(facts, null, 2);
    } else if (formatArg === 'brief') {
      output = formatFactsBrief(facts);
    } else {
      output = formatFactsMarkdown(facts);
    }

    if (outputArg) {
      fs.writeFileSync(path.resolve(outputArg), output, 'utf8');
      console.log(`Saved report to ${outputArg}`);
    } else {
      console.log(output);
    }
  } catch (err) {
    console.error('[ERROR]', err.message);
    process.exit(1);
  }
}

main();
