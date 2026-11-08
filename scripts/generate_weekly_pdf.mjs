#!/usr/bin/env node
/**
 * UK American Football Archive - PDF Report Generator
 * 
 * Generates an executive, publication-grade PDF report of weekly insights and facts.
 * 
 * Usage:
 *   node scripts/generate_weekly_pdf.mjs [--week 2] [--output public/reports/week_2_insights.pdf]
 */

import ws from 'ws';
global.WebSocket = ws;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import playwright from 'playwright';
import { generateWeeklyFacts } from '../lib/facts/weekly-facts-core.mjs';

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
const outputArg = getArg('--output') || getArg('-o');

function escapeHtml(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateHtml(facts) {
  const { window, overview, scorigamis, rivalries, extremes, recordsAndMilestones, standingsMomentum, brightonSpotlight, postponements } = facts;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Britball Weekly Insights - ${escapeHtml(window.label)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 12mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
      font-size: 11pt;
    }
    .header {
      border-bottom: 3px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-left h1 {
      font-size: 20pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .header-left .sub {
      font-size: 11pt;
      font-weight: 600;
      color: #0284c7;
      margin-top: 2px;
    }
    .header-right {
      text-align: right;
      font-size: 8.5pt;
      color: #64748b;
    }
    .header-right .badge {
      display: inline-block;
      background: #e0f2fe;
      color: #0369a1;
      padding: 3px 8px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 8pt;
      margin-bottom: 4px;
    }
    .snapshot-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 18px;
    }
    .stat-box {
      text-align: center;
    }
    .stat-val {
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
    }
    .stat-label {
      font-size: 7.5pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
    }
    .section {
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 11pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #0f172a;
      border-left: 4px solid #0284c7;
      padding-left: 8px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 9px 12px;
      margin-bottom: 8px;
    }
    .card-gold {
      background: #fffbeb;
      border: 1.5px solid #f59e0b;
    }
    .card-blue {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
    }
    .card-green {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .card-title {
      font-weight: 700;
      font-size: 10.5pt;
      color: #0f172a;
    }
    .tag {
      font-size: 7pt;
      font-weight: 800;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .tag-gold {
      background: #f59e0b;
      color: #ffffff;
    }
    .tag-blue {
      background: #0284c7;
      color: #ffffff;
    }
    .tag-green {
      background: #16a34a;
      color: #ffffff;
    }
    .tag-purple {
      background: #9333ea;
      color: #ffffff;
    }
    .card-desc {
      font-size: 9pt;
      color: #334155;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .shutout-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
    .shutout-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #16a34a;
      border-radius: 4px;
      padding: 6px 8px;
      font-size: 8.5pt;
    }
    .shutout-score {
      font-weight: 700;
      color: #0f172a;
    }
    .shutout-div {
      font-size: 7.5pt;
      color: #64748b;
    }
    ul.fact-list {
      list-style: none;
    }
    ul.fact-list li {
      position: relative;
      padding-left: 14px;
      margin-bottom: 5px;
      font-size: 9pt;
      color: #1e293b;
    }
    ul.fact-list li::before {
      content: "•";
      position: absolute;
      left: 0;
      color: #0284c7;
      font-weight: bold;
      font-size: 11pt;
      line-height: 1;
    }
    .footer {
      margin-top: 18px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      font-size: 7.5pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    .footer strong {
      color: #64748b;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <h1>UK American Football Archive</h1>
      <div class="sub">Weekly Intelligence & Scouting Digest — ${escapeHtml(window.label)}</div>
    </div>
    <div class="header-right">
      <div class="badge">OFFICIAL ARCHIVE DIGEST</div>
      <div>Season: <strong>BUCS ${escapeHtml(window.seasonYear)}</strong></div>
      <div>Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
    </div>
  </div>

  <!-- Snapshot Bar -->
  <div class="snapshot-bar">
    <div class="stat-box">
      <div class="stat-val">${escapeHtml(overview.completedGames)}</div>
      <div class="stat-label">Fixtures Completed</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${escapeHtml(overview.totalPoints)}</div>
      <div class="stat-label">Total Points (${escapeHtml(overview.avgPoints)} PPG)</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${escapeHtml(extremes.shutouts.length)}</div>
      <div class="stat-label">Shutouts Pitched</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${escapeHtml(scorigamis.allTime.length + scorigamis.level.length)}</div>
      <div class="stat-label">Scorigamis Unlocked</div>
    </div>
  </div>

  <!-- Section: Scorigami Watch -->
  <div class="section">
    <div class="section-title">🎯 Scorigami Watch</div>
    ${scorigamis.allTime.map(sc => `
      <div class="card card-gold">
        <div class="card-header">
          <div class="card-title">${escapeHtml(sc.game)}</div>
          <span class="tag tag-gold">ALL-TIME BRITBALL SCORIGAMI</span>
        </div>
        <div class="card-desc">${escapeHtml(sc.description)} (Division: ${escapeHtml(sc.division)})</div>
      </div>
    `).join('')}
    <div class="grid-2">
      ${scorigamis.level.map(sc => `
        <div class="card card-blue">
          <div class="card-header">
            <div class="card-title">${escapeHtml(sc.game)}</div>
            <span class="tag tag-blue">${escapeHtml(sc.level.toUpperCase())} SCORIGAMI</span>
          </div>
          <div class="card-desc">${escapeHtml(sc.description)}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Section: Program Records & Milestones -->
  <div class="section">
    <div class="section-title">📜 Program Records & Milestones</div>
    <div class="grid-2">
      ${recordsAndMilestones.programRecords.map(rec => `
        <div class="card">
          <div class="card-header">
            <div class="card-title">${escapeHtml(rec.team)}</div>
            <span class="tag ${rec.type.includes('Explosion') ? 'tag-green' : 'tag-purple'}">${escapeHtml(rec.type)}</span>
          </div>
          <div class="card-desc">${escapeHtml(rec.description)}</div>
        </div>
      `).join('')}
      ${recordsAndMilestones.milestoneWins.map(ms => `
        <div class="card card-green">
          <div class="card-header">
            <div class="card-title">${escapeHtml(ms.team)}</div>
            <span class="tag tag-green">${escapeHtml(ms.wins)}th PROGRAM WIN</span>
          </div>
          <div class="card-desc">${escapeHtml(ms.description)}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Section: Rivalry & Series Context -->
  <div class="section">
    <div class="section-title">⚔️ Rivalry & Historical Series Context</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Inaugural Encounters & Hiatuses</div>
          <span class="tag tag-blue">SERIES CONTEXT</span>
        </div>
        <ul class="fact-list">
          ${rivalries.inauguralMatchups.map(inau => `<li><strong>${escapeHtml(inau.game)}</strong>: ${escapeHtml(inau.description)}</li>`).join('')}
          ${rivalries.longHiatusMatchups.map(h => `<li><strong>${escapeHtml(h.game)}</strong>: ${escapeHtml(h.description)}</li>`).join('')}
        </ul>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Series Dominance Streaks</div>
          <span class="tag tag-purple">ACTIVE STREAKS</span>
        </div>
        <ul class="fact-list">
          ${rivalries.seriesStreaks.slice(0, 5).map(str => `<li><strong>${escapeHtml(str.team)}</strong>: ${escapeHtml(str.description)}</li>`).join('')}
        </ul>
      </div>
    </div>
    <div class="card" style="margin-top: 6px;">
      <div class="card-header">
        <div class="card-title">Reversals & Revenge Victories</div>
        <span class="tag tag-gold">SCORE REVERSED</span>
      </div>
      <ul class="fact-list">
        ${rivalries.revengeGames.slice(0, 5).map(rev => `<li><strong>${escapeHtml(rev.winner)} ${escapeHtml(rev.currentScore)} ${escapeHtml(rev.loser)}</strong>: ${escapeHtml(rev.description)}</li>`).join('')}
      </ul>
    </div>
  </div>

  <!-- Section: Extremes & The Shutout Wall -->
  <div class="section">
    <div class="section-title">⚡ Extremes & Defensive Dominance</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Slate Extremes</div>
        </div>
        <ul class="fact-list">
          ${extremes.shootout ? `<li>🔥 <strong>Shootout of the Week</strong>: ${escapeHtml(extremes.shootout.game)} (${escapeHtml(extremes.shootout.combined)} combined points)</li>` : ''}
          ${extremes.defensiveBattle ? `<li>🔒 <strong>Defensive Slugfest</strong>: ${escapeHtml(extremes.defensiveBattle.game)} (${escapeHtml(extremes.defensiveBattle.combined)} combined points)</li>` : ''}
          ${extremes.biggestBlowout ? `<li>🚜 <strong>Margin of the Week</strong>: ${escapeHtml(extremes.biggestBlowout.game)} (+${escapeHtml(extremes.biggestBlowout.diff)} margin)</li>` : ''}
          ${extremes.nailbiters.map(nb => `<li>⏱️ <strong>Thriller (≤7 pts)</strong>: ${escapeHtml(nb.game)} (decided by ${escapeHtml(nb.diff)} pt${nb.diff === 1 ? '' : 's'})</li>`).join('')}
        </ul>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">The Shutout Wall (${escapeHtml(extremes.shutouts.length)} Clean Sheets)</div>
          <span class="tag tag-green">ZERO CONCEDED</span>
        </div>
        <div class="shutout-grid">
          ${extremes.shutouts.map(s => `
            <div class="shutout-item">
              <div class="shutout-score">${escapeHtml(s.team)} ${escapeHtml(s.score)}</div>
              <div class="shutout-div">${escapeHtml(s.opponent)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  </div>

  <!-- Section: Standings & Brighton Spotlight -->
  <div class="section">
    <div class="section-title">🌊 Momentum & Brighton Spotlight</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Early Season Form Watch</div>
        </div>
        <ul class="fact-list">
          ${(() => {
            const pGroups = new Map();
            for (const t of (standingsMomentum.perfectStarts || [])) {
              const rec = t.record || '2-0';
              if (!pGroups.has(rec)) pGroups.set(rec, []);
              pGroups.get(rec).push(`${escapeHtml(t.team)} (+${escapeHtml(t.pointDiff)})`);
            }
            let out = '';
            for (const [rec, teams] of pGroups.entries()) {
              out += `<li>🟢 <strong>Unblemished (${escapeHtml(rec)})</strong>: ${teams.join(', ')}</li>`;
            }
            return out;
          })()}
          ${standingsMomentum.bounceBacks.length > 0 ? `<li>🔄 <strong>Bounce-Back Wins</strong>: ${standingsMomentum.bounceBacks.map(b => `${escapeHtml(b.team)} (${escapeHtml(b.record ? `${b.record}, ` : '')}${escapeHtml(b.score)} vs ${escapeHtml(b.opponent)})`).join(', ')}</li>` : ''}
          ${(() => {
            const wGroups = new Map();
            for (const t of (standingsMomentum.winlessStarts || [])) {
              const rec = t.record || '0-2';
              if (!wGroups.has(rec)) wGroups.set(rec, []);
              wGroups.get(rec).push(escapeHtml(t.team));
            }
            let out = '';
            for (const [rec, teams] of wGroups.entries()) {
              out += `<li>🔴 <strong>Seeking 1st Win (${escapeHtml(rec)})</strong>: ${teams.join(', ')}</li>`;
            }
            return out;
          })()}
        </ul>
      </div>

      ${brightonSpotlight ? `
        <div class="card card-blue">
          <div class="card-header">
            <div class="card-title">Brighton Historical Records Spotlight</div>
            <span class="tag tag-blue">${escapeHtml(brightonSpotlight.result.toUpperCase())}</span>
          </div>
          <div style="font-size: 11pt; font-weight: 700; color: #0284c7; margin-bottom: 4px;">
            ${escapeHtml(brightonSpotlight.team)} ${escapeHtml(brightonSpotlight.score)} ${escapeHtml(brightonSpotlight.opponent)}
          </div>
          <div class="card-desc">${escapeHtml(brightonSpotlight.note)}</div>
        </div>
      ` : ''}
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>UK American Football Archive & Historical Lab · <strong>Strict Evidence-Based Standards</strong></div>
    <div>Cross-referenced against 16,000+ fixtures · 40+ Years of Britball History</div>
  </div>

</body>
</html>`;
}

async function main() {
  try {
    const options = {
      week: weekArg ? parseInt(weekArg, 10) : 2,
      season: seasonArg ? parseInt(seasonArg, 10) : 2026,
      pastWeek: !weekArg
    };

    console.log(`[INFO] Generating facts for Week ${options.week} (${options.season})...`);
    const facts = await generateWeeklyFacts(supabase, options);

    const html = generateHtml(facts);

    const reportsDir = path.resolve('public/reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const defaultFilename = `BUCS_${options.season}_Week_${options.week}_Insights.pdf`;
    const outputPath = outputArg ? path.resolve(outputArg) : path.join(reportsDir, defaultFilename);

    console.log(`[INFO] Launching Chromium to render PDF...`);
    const browser = await playwright.chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(html, { waitUntil: 'networkidle' });

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm'
      }
    });

    await browser.close();

    console.log(`[SUCCESS] PDF successfully produced at: ${outputPath}`);
  } catch (err) {
    console.error('[ERROR]', err.message);
    process.exit(1);
  }
}

main();
