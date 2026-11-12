#!/usr/bin/env node
/**
 * UK American Football Archive - Weekly Preview PDF Generator
 * 
 * Usage:
 *   node scripts/generate_weekly_preview_pdf.mjs [--week 3] [--output public/reports/BUCS_2026_Week_3_Preview.pdf]
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
import { generateWeeklyPreview } from '../lib/facts/weekly-preview-core.mjs';

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

function generateHtml(preview) {
  const { window, totalFixtures, marqueeMatchups, inauguralMatchups, longHiatusMatchups, seriesDominance, revengeAngles, formWatch, milestoneAlerts, brightonPreview, predictedGames } = preview;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Britball Weekly Preview - ${window.label}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 12mm 12mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
      font-size: 11pt;
    }
    .header {
      border-bottom: 3px solid #6366f1;
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
      color: #4f46e5;
      margin-top: 2px;
    }
    .header-right { text-align: right; font-size: 8.5pt; color: #64748b; }
    .header-right .badge {
      display: inline-block;
      background: #e0e7ff;
      color: #4338ca;
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
    .stat-box { text-align: center; }
    .stat-val { font-size: 16pt; font-weight: 800; color: #0f172a; }
    .stat-label { font-size: 7.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
    .section { margin-bottom: 16px; page-break-inside: avoid; }
    .section-title {
      font-size: 11pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #0f172a;
      border-left: 4px solid #6366f1;
      padding-left: 8px;
      margin-bottom: 10px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 9px 12px;
      margin-bottom: 8px;
    }
    .card-purple { background: #faf5ff; border: 1.5px solid #c084fc; }
    .card-blue { background: #f0f9ff; border: 1px solid #bae6fd; }
    .card-panthers { background: #faf5f8; border: 1.5px solid #633063; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .card-title { font-weight: 700; font-size: 10.5pt; color: #0f172a; }
    .tag { font-size: 7pt; font-weight: 800; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; }
    .tag-purple { background: #9333ea; color: #ffffff; }
    .tag-blue { background: #0284c7; color: #ffffff; }
    .tag-panthers { background: #633063; color: #B3A066; border: 1px solid #B3A066; }
    .tag-green { background: #16a34a; color: #ffffff; }
    .tag-amber { background: #d97706; color: #ffffff; }
    .card-desc { font-size: 9pt; color: #334155; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    ul.fact-list { list-style: none; }
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
      color: #6366f1;
      font-weight: bold;
      font-size: 11pt;
    }
    .preds-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
    .pred-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 6px 8px;
      font-size: 8.5pt;
    }
    .pred-matchup { font-weight: 700; color: #0f172a; margin-bottom: 2px; }
    .pred-score { font-size: 8.5pt; color: #4338ca; font-weight: 700; }
    .pred-prob { font-size: 7.5pt; color: #64748b; }
    .footer {
      margin-top: 18px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      font-size: 7.5pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <h1>UK American Football Archive</h1>
      <div class="sub">Upcoming Scouting & Intelligence Preview — ${window.label}</div>
    </div>
    <div class="header-right">
      <div class="badge">OFFICIAL SCOUTING REPORT</div>
      <div>Season: <strong>BUCS ${window.seasonYear}</strong></div>
      <div>Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
    </div>
  </div>

  <!-- Snapshot Bar -->
  <div class="snapshot-bar">
    <div class="stat-box">
      <div class="stat-val">${totalFixtures}</div>
      <div class="stat-label">Fixtures Scheduled</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${inauguralMatchups.length}</div>
      <div class="stat-label">Inaugural Clashes</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${formWatch.defendingPerfection.length}</div>
      <div class="stat-label">Undefeated Teams Playing</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${longHiatusMatchups.length}</div>
      <div class="stat-label">Hiatuses Ended (≥4 Yrs)</div>
    </div>
  </div>

  <!-- Marquee Matchups & Brighton Spotlight -->
  <div class="section">
    <div class="section-title">⭐ Featured Games to Watch</div>
    <div class="grid-2">
      ${marqueeMatchups.slice(0, 4).map(m => `
        <div class="card card-purple">
          <div class="card-header">
            <div class="card-title">${m.matchup}</div>
            <span class="tag tag-purple">${m.type}</span>
          </div>
          <div class="card-desc">${m.description} (${m.division})</div>
        </div>
      `).join('')}

      ${brightonPreview ? `
        <div class="card card-panthers">
          <div class="card-header">
            <div class="card-title" style="color: #252E30;">🐾 ${brightonPreview.matchup}</div>
            <span class="tag tag-panthers">PANTHERS SPOTLIGHT</span>
          </div>
          <div class="card-desc" style="color: #252E30;">
            ${brightonPreview.notes}
            ${brightonPreview.predictedScore ? `<br><strong style="color: #633063;">Model Projection:</strong> ${brightonPreview.predictedScore} (${brightonPreview.winProb}% prob)` : ''}
          </div>
        </div>
      ` : ''}
    </div>
  </div>

  <!-- Inaugural Meetings & Hiatuses Ended -->
  <div class="section">
    <div class="section-title">🆕 Inaugural Clashes & Hiatuses Ended</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Inaugural Meetings (${inauguralMatchups.length})</div>
          <span class="tag tag-green">FIRST-EVER</span>
        </div>
        <ul class="fact-list">
          ${inauguralMatchups.map(i => `<li><strong>${i.matchup}</strong> (${i.division}): ${i.description}</li>`).join('')}
        </ul>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Multi-Year Hiatuses Ended</div>
          <span class="tag tag-amber">LONG TIME NO SEE</span>
        </div>
        <ul class="fact-list">
          ${longHiatusMatchups.map(h => `<li><strong>${h.matchup}</strong>: ${h.description}</li>`).join('')}
        </ul>
      </div>
    </div>
  </div>

  <!-- Form & Streak Watch -->
  <div class="section">
    <div class="section-title">📈 Form & Streak Watch</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Early Season Momentum</div>
        </div>
        <ul class="fact-list">
          ${formWatch.defendingPerfection.length > 0 ? `<li>🟢 <strong>Perfection on the Line</strong>: ${formWatch.defendingPerfection.map(t => `${t.team} (${t.record}) aiming for ${t.nextWin || (t.wins + 1)}-0`).join(', ')}</li>` : ''}
          ${formWatch.shutoutStreaks.map(s => `<li>🛡️ <strong>Iron Curtain Watch</strong>: ${s.description}</li>`).join('')}
          ${formWatch.winlessTeams.length > 0 ? `<li>🔴 <strong>Desperation Bowls (Hunting Win #1)</strong>: ${formWatch.winlessTeams.map(t => `${t.team} (${t.record})`).join(', ')}</li>` : ''}
        </ul>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Historical Series Dominance & Milestones</div>
        </div>
        <ul class="fact-list">
          ${seriesDominance.slice(0, 4).map(s => `<li>🧱 <strong>Dominance</strong>: ${s.description}</li>`).join('')}
          ${milestoneAlerts.map(ms => `<li>🏆 <strong>Milestone Watch</strong>: ${ms.description}</li>`).join('')}
        </ul>
      </div>
    </div>
  </div>

  <!-- Model Score Predictions -->
  <div class="section">
    <div class="section-title">🔮 Model Score Predictions & Matchup Odds</div>
    <div class="preds-grid">
      ${predictedGames.map(p => `
        <div class="pred-card">
          <div class="pred-matchup">${p.homeTeam} vs ${p.awayTeam}</div>
          <div class="pred-score">Proj: ${p.predHome} - ${p.predAway}</div>
          <div class="pred-prob">${p.predWinner} favored (${p.winProb}% prob)</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>UK American Football Archive & Scouting Intelligence · <strong>Strict Evidence-Based Standards</strong></div>
    <div>Cross-referenced against 16,000+ fixtures · 40+ Years of Britball History</div>
  </div>

</body>
</html>`;
}

async function main() {
  try {
    const options = {
      week: weekArg ? parseInt(weekArg, 10) : 3,
      season: seasonArg ? parseInt(seasonArg, 10) : 2026
    };

    console.log(`[INFO] Generating preview for Week ${options.week} (${options.season})...`);
    const preview = await generateWeeklyPreview(supabase, options);
    const html = generateHtml(preview);

    const reportsDir = path.resolve('public/reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const defaultFilename = `BUCS_${options.season}_Week_${options.week}_Preview.pdf`;
    const outputPath = outputArg ? path.resolve(outputArg) : path.join(reportsDir, defaultFilename);

    console.log(`[INFO] Launching Chromium to render Preview PDF...`);
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
    console.log(`[SUCCESS] Preview PDF successfully produced at: ${outputPath}`);
  } catch (err) {
    console.error('[ERROR]', err.message);
    process.exit(1);
  }
}

main();
