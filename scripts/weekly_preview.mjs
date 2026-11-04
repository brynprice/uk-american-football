#!/usr/bin/env node
/**
 * UK American Football Archive - Weekly Preview CLI
 * 
 * Usage:
 *   node scripts/weekly_preview.mjs [--week 3]
 *   node scripts/weekly_preview.mjs --format brief
 *   node scripts/weekly_preview.mjs --format json
 *   node scripts/weekly_preview.mjs --pdf
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
  generateWeeklyPreview,
  formatPreviewMarkdown,
  formatPreviewBrief
} from '../lib/facts/weekly-preview-core.mjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[FATAL] Missing Supabase environment variables');
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
    const numArg = args.find(a => !isNaN(parseInt(a, 10)) && parseInt(a, 10) > 0 && parseInt(a, 10) <= 25);
    if (numArg) weekArg = numArg;
  }
}

const seasonArg = getArg('--season') || getArg('-s');
const startArg = getArg('--start');
const endArg = getArg('--end');
const formatArg = getArg('--format') || 'markdown';
const outputArg = getArg('--output') || getArg('-o');
const isPdf = args.includes('--pdf');

async function main() {
  try {
    if (isPdf) {
      const { execSync } = await import('child_process');
      const cmd = `node scripts/generate_weekly_preview_pdf.mjs ${weekArg ? `--week ${weekArg}` : ''} ${seasonArg ? `--season ${seasonArg}` : ''} ${outputArg ? `--output "${outputArg}"` : ''}`;
      execSync(cmd, { stdio: 'inherit' });
      return;
    }

    const options = {
      week: weekArg ? parseInt(weekArg, 10) : undefined,
      season: seasonArg ? parseInt(seasonArg, 10) : undefined,
      startDate: startArg || undefined,
      endDate: endArg || undefined
    };

    const preview = await generateWeeklyPreview(supabase, options);

    let output = '';
    if (formatArg === 'json') {
      output = JSON.stringify(preview, null, 2);
    } else if (formatArg === 'brief') {
      output = formatPreviewBrief(preview);
    } else {
      output = formatPreviewMarkdown(preview);
    }

    if (outputArg) {
      fs.writeFileSync(path.resolve(outputArg), output, 'utf8');
      console.log(`Saved preview to ${outputArg}`);
    } else {
      console.log(output);
    }
  } catch (err) {
    console.error('[ERROR]', err.message);
    process.exit(1);
  }
}

main();
