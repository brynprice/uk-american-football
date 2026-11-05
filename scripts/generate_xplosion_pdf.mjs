#!/usr/bin/env node
/**
 * UK American Football Archive - xpLosION Historical Dossier & 2026 Matchup Preview PDF Generator
 *
 * Generates a crisp 2-page A4 PDF detailing all xpLosION games (2005–2026) and key analytical facts
 * ahead of Saturday's matchup: Reading Knights @ Birmingham Lions (7 November 2026).
 */

import fs from 'fs';
import path from 'path';
import playwright from 'playwright';

const XPLOSION_GAMES = [
  { edition: 'I', year: '2005', date: '05/11/2005', opponent: 'Tarannau Aberystwyth', score: '26 – 0', result: 'W', tier: 'BCAFL Northern', notes: 'Inaugural xpLosION showcase on Bournbrook grass pitch (~1,000+ crowd)' },
  { edition: 'II', year: '2006', date: '05/11/2006', opponent: 'Warwick Wolves', score: '43 – 6', result: 'W', tier: 'BCAFL Central', notes: '2nd annual bonfire weekend showcase vs local West Midlands rivals' },
  { edition: 'III', year: '2007', date: '10/11/2007', opponent: 'Warwick Wolves', score: '49 – 0', result: 'W', tier: 'BUAFL Central', notes: 'Largest ever xpLosION winning margin (+49 pts); 2nd shutout in 3 years' },
  { edition: 'IV', year: '2008', date: '08/11/2008', opponent: 'Bath Killer Bees', score: '29 – 0', result: 'W', tier: 'BUAFL Conf 2 South', notes: 'Launches undefeated 2008–09 National Championship run (College Bowl XXIII)' },
  { edition: 'V', year: '2009', date: '07/11/2009', opponent: 'LMS / Exhibition', score: '34 – 6', result: 'W', tier: 'BUAFL Midlands', notes: '5th anniversary showcase; Lions go on to win back-to-back titles (CB XXIV)' },
  { edition: 'VI', year: '2010', date: '06/11/2010', opponent: 'Loughborough Aces', score: '22 – 19', result: 'W', tier: 'BUAFL Midlands (MAC)', notes: 'Closest xpLosION win (+3 pts); RB Dan Conroy scores decisive TD' },
  { edition: 'VII', year: '2011', date: '05/11/2011', opponent: 'NTU Renegades', score: '25 – 6', result: 'W', tier: 'BUAFL Midlands (MAC)', notes: 'QB Jonny Glover & RB Dan Conroy lead Lions in front of packed campus crowd' },
  { edition: 'VIII', year: '2012', date: '03/11/2012', opponent: 'Warwick Wolves', score: '48 – 0', result: 'W', tier: 'BUCS Inter-Conf', notes: '4th xpLosION shutout; springboard to unbeaten title season (College Bowl XXVII)' },
  { edition: 'IX', year: '2013', date: '03/11/2013', opponent: 'NTU Renegades', score: '16 – 9', result: 'W', tier: 'BUCS Midlands (MAC)', notes: 'One-score defensive battle gives Birmingham a perfect 9–0 all-time start' },
  { edition: 'X', year: '2014', date: '01/11/2014', opponent: 'Hertfordshire Hurricanes', score: '23 – 0', result: 'W', tier: 'BUCS Premier South', notes: '10th anniversary & 1st Premier South xpLosION; 5th historical shutout' },
  { edition: 'XI', year: '2015', date: '07/11/2015', opponent: 'Kingston Cougars', score: '36 – 0', result: 'W', tier: 'BUCS Premier South', notes: 'Back-to-back xpLosION shutouts en route to 2015–16 National Title (CB XXX)' },
  { edition: 'XII', year: '2016', date: '12/11/2016', opponent: 'Bath Killer Bees', score: '7 – 10', result: 'L', tier: 'BUCS Premier South', notes: 'First-ever xpLosION defeat, snapping Birmingham’s 11-game win streak' },
  { edition: 'XIII', year: '2017', date: '11/11/2017', opponent: 'Portsmouth Destroyers', score: '39 – 14', result: 'W', tier: 'BUCS Premier South', notes: 'Highest combined scoring xpLosION (53 total pts) as Lions bounce back' },
  { edition: 'XIV', year: '2018', date: '24/11/2018', opponent: 'Swansea Titans', score: '16 – 20', result: 'L', tier: 'BUCS Premier South', notes: 'Latest calendar xpLosION (24 Nov); only the 2nd defeat in first 14 editions' },
  { edition: 'XV', year: '2019', date: '09/11/2019', opponent: 'Hertfordshire Hurricanes', score: '24 – 0', result: 'W', tier: 'BUCS Premier South', notes: '2nd xpLosION shutout over Hertfordshire (47–0 combined across 2014 & 2019)' },
  { edition: '—', year: '2020', date: 'Nov 2020', opponent: 'No Season (COVID-19)', score: '—', result: '—', tier: 'BUCS Suspended', notes: '2020–21 BUCS American Football season cancelled nationwide' },
  { edition: 'XVI', year: '2021', date: '06/11/2021', opponent: 'Swansea Titans', score: '41 – 0', result: 'W', tier: 'BUCS Div 1 South', notes: 'Post-pandemic return & emphatic revenge shutout over Swansea' },
  { edition: 'XVII', year: '2022', date: '12/11/2022', opponent: 'Cardiff Cobras', score: '20 – 0', result: 'W', tier: 'BUCS Div 1 South', notes: '9th all-time xpLosION shutout; 1st of three straight xpLosION games vs Cardiff' },
  { edition: 'XVIII', year: '2023', date: '04/11/2023', opponent: 'Cardiff Cobras', score: '27 – 17', result: 'W', tier: 'BUCS Premier South', notes: 'Return to Premier South; Lions defeat Cardiff for 2nd straight xpLosION' },
  { edition: 'XIX', year: '2024', date: '09/11/2024', opponent: 'Cardiff Cobras', score: '27 – 6', result: 'W', tier: 'BUCS Premier South', notes: 'xpLosION event/festivities cancelled, though fixture was played (3-peat vs Cardiff)' },
  { edition: 'XX', year: '2025', date: '08/11/2025', opponent: 'Oxford Brookes Univ.', score: '0 – 6', result: 'L', tier: 'BUCS Div 1 South', notes: 'Lowest-scoring xpLosION (6 pts) & first time Birmingham were shut out' },
  { edition: 'XXI', year: '2026', date: '07/11/2026', opponent: 'Reading Knights', score: '16:10 KO', result: 'TBD', tier: 'BUCS Div 1 South', notes: 'Inaugural all-time meeting between Birmingham Lions & Reading Knights' }
];

function buildHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>xpLosION Historical Dossier & 2026 Matchup Preview</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8.5mm 10mm 8.5mm 10mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.32;
      font-size: 8.8pt;
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 11px 16px;
      border-radius: 7px;
      border-bottom: 3.5px solid #f59e0b;
      margin-bottom: 9px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-left h1 {
      font-size: 16.5pt;
      font-weight: 900;
      letter-spacing: -0.3px;
      color: #ffffff;
    }
    .header-left h1 span.lion {
      color: #fbbf24;
      font-style: italic;
    }
    .header-left .sub {
      font-size: 8.4pt;
      font-weight: 600;
      color: #cbd5e1;
      margin-top: 2px;
    }
    .header-right {
      text-align: right;
      font-size: 7.5pt;
      color: #e2e8f0;
    }
    .header-right .event-pill {
      display: inline-block;
      background: #f59e0b;
      color: #0f172a;
      font-weight: 900;
      font-size: 7.5pt;
      padding: 2.5px 8px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 3px;
    }
    .snapshot-bar {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 8px;
      margin-bottom: 9px;
    }
    .stat-box { text-align: center; }
    .stat-val { font-size: 12.5pt; font-weight: 900; color: #0f172a; }
    .stat-val.amber { color: #d97706; }
    .stat-label { font-size: 6.4pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: #64748b; }
    .section { margin-bottom: 9px; }
    .section-title {
      font-size: 9.2pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #0f172a;
      border-left: 3.5px solid #f59e0b;
      padding-left: 7px;
      margin-bottom: 6px;
    }
    .matchup-banner {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      border: 1.5px solid #f59e0b;
      border-radius: 7px;
      padding: 8px 12px;
      margin-bottom: 9px;
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 10px;
      align-items: center;
    }
    .matchup-teams {
      font-size: 12pt;
      font-weight: 900;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .matchup-meta {
      font-size: 7.8pt;
      color: #475569;
      font-weight: 600;
    }
    .pred-box {
      background: #0f172a;
      color: #ffffff;
      border-radius: 5px;
      padding: 6px 10px;
      text-align: right;
    }
    .pred-label {
      font-size: 6.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #fbbf24;
      font-weight: 800;
    }
    .pred-score {
      font-size: 11.5pt;
      font-weight: 900;
      color: #ffffff;
      margin: 1px 0;
    }
    .pred-prob {
      font-size: 7.2pt;
      color: #cbd5e1;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 7px 9px;
    }
    .card-title {
      font-weight: 800;
      font-size: 8.5pt;
      color: #0f172a;
      margin-bottom: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .tag {
      font-size: 6pt;
      font-weight: 800;
      text-transform: uppercase;
      padding: 1px 4.5px;
      border-radius: 3px;
    }
    .tag-amber { background: #fef3c7; color: #b45309; border: 1px solid #f59e0b; }
    .tag-blue { background: #e0f2fe; color: #0369a1; border: 1px solid #38bdf8; }
    .tag-green { background: #dcfce7; color: #15803d; border: 1px solid #4ade80; }
    .tag-slate { background: #1e293b; color: #fbbf24; font-style: italic; }
    ul.fact-list { list-style: none; }
    ul.fact-list li {
      position: relative;
      padding-left: 10px;
      margin-bottom: 3.8px;
      font-size: 7.9pt;
      color: #1e293b;
    }
    ul.fact-list li::before {
      content: "▸";
      position: absolute;
      left: 0;
      color: #d97706;
      font-weight: bold;
    }
    table.tale {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.8pt;
    }
    table.tale th {
      background: #1e293b;
      color: #ffffff;
      padding: 4px 7px;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    table.tale td {
      padding: 3.5px 7px;
      border-bottom: 1px solid #e2e8f0;
    }
    table.tale tr:nth-child(even) td {
      background: #f8fafc;
    }
    table.ledger {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.3pt;
      margin-top: 3px;
    }
    table.ledger th {
      background: #0f172a;
      color: #ffffff;
      text-align: left;
      padding: 4px 5px;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 6.4pt;
      letter-spacing: 0.25px;
    }
    table.ledger td {
      padding: 3.1px 5px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
      white-space: nowrap;
    }
    table.ledger td.notes-cell {
      white-space: normal;
    }
    table.ledger tr:nth-child(even) td {
      background: #f8fafc;
    }
    table.ledger tr.row-2026 td {
      background: #fffbeb;
      font-weight: 700;
      border-top: 1.5px solid #f59e0b;
      border-bottom: 1.5px solid #f59e0b;
    }
    table.ledger tr.row-cancelled td {
      color: #94a3b8;
      font-style: italic;
    }
    .res-badge {
      display: inline-block;
      width: 17px;
      text-align: center;
      font-weight: 900;
      font-size: 6.6pt;
      padding: 0.5px 0;
      border-radius: 3px;
    }
    .res-W { background: #dcfce7; color: #166534; }
    .res-L { background: #fee2e2; color: #991b1b; }
    .res-TBD { background: #fef3c7; color: #92400e; width: 24px; }
    .page-break {
      page-break-before: always;
    }
    .footer {
      margin-top: 7px;
      border-top: 1px solid #cbd5e1;
      padding-top: 5px;
      font-size: 6.8pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>

  <!-- ================= PAGE 1: 2026 MATCHUP PREVIEW & KEY FACTS ================= -->
  <div class="header">
    <div class="header-left">
      <h1><span class="lion">xpLosION</span> HISTORICAL DOSSIER &amp; 2026 PREVIEW</h1>
      <div class="sub">University of Birmingham Lions Annual Showcase (2005–2026) · Capital Letters Spell "L-I-O-N"</div>
    </div>
    <div class="header-right">
      <div class="event-pill">xpLosION XXI · 7 NOV 2026</div>
      <div>BUCS Division 1 Southern</div>
      <div>Bournbrook 3G Pitch, Edgbaston</div>
    </div>
  </div>

  <!-- Snapshot Bar -->
  <div class="snapshot-bar">
    <div class="stat-box">
      <div class="stat-val amber">17 – 3</div>
      <div class="stat-label">Lions All-Time xpLosION Record (85%)</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">570 – 130</div>
      <div class="stat-label">Aggregate Points (28.5 – 6.5 Avg)</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">9 / 20</div>
      <div class="stat-label">Shutouts Pitched by Birmingham (45%)</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">1st Ever</div>
      <div class="stat-label">All-Time Meeting vs Reading Knights</div>
    </div>
    <div class="stat-box">
      <div class="stat-val amber">20 – 14</div>
      <div class="stat-label">2026 Model Projection (73% Lions)</div>
    </div>
  </div>

  <!-- This Saturday's Matchup Banner -->
  <div class="matchup-banner">
    <div>
      <div style="font-size: 7pt; font-weight: 900; text-transform: uppercase; color: #b45309; letter-spacing: 0.4px; margin-bottom: 1px;">
        🎆 THIS SATURDAY’S SHOWCASE FIXTURE · SATURDAY, 7 NOVEMBER 2026 · 16:10 GMT
      </div>
      <div class="matchup-teams">Reading Knights (0–0) at Birmingham Lions (0–0–1)</div>
      <div class="matchup-meta">
        Competition: BUCS Division 1 Southern · Venue: Bournbrook Pitch, University of Birmingham · Return Fixture: 06/12/2026 at Reading
      </div>
    </div>
    <div class="pred-box">
      <div class="pred-label">Archive Model Projection</div>
      <div class="pred-score">Birmingham 20, Reading 14</div>
      <div class="pred-prob">Birmingham Lions 73% Win Prob · Spread: Lions -6.0</div>
    </div>
  </div>

  <!-- Key Matchup & Historical Facts -->
  <div class="section">
    <div class="section-title">⚡ 10 Key Facts &amp; Storylines for Saturday’s Game (Reading Knights @ Birmingham Lions)</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">
          <span>1. Matchup Intelligence &amp; Current Form</span>
          <span class="tag tag-green">Saturday Preview</span>
        </div>
        <ul class="fact-list">
          <li><strong>First-Ever Meeting in 40+ Years:</strong> Despite Birmingham Lions (founded 1989; <strong>181 recorded games, 122–56–3</strong>) and Reading Knights (founded 1985; <strong>137 recorded games, 54–80–3</strong>) being two of the oldest university programs in Britain, Saturday is their <strong>first recorded meeting in archive history</strong>.</li>
          <li><strong>Reading’s Unbeaten Promotion &amp; 6-Game Win Streak:</strong> Reading Knights enter Division 1 Southern riding a <strong>6-game winning streak</strong> after going a perfect <strong>6–0 in 2025–26</strong> (5–0 in Division 2 Southern + an 18–0 Southern Conference Cup triumph over Sussex Saxons), outscoring opponents <strong>122–20</strong>.</li>
          <li><strong>Reading’s Iron Curtain Defense:</strong> Reading have pitched <strong>back-to-back shutouts</strong> (14–0 and 18–0 vs Sussex) and <strong>3 shutouts in their last 4 games</strong>, conceding just <strong>6 total points across their last 16 quarters</strong> of football.</li>
          <li><strong>Birmingham’s Rare Season-Opening Tie:</strong> Birmingham opened 2026–27 on 24 Oct with a defensive <strong>6–6 road tie at Oxford Brookes</strong>—just the <strong>3rd tie in Birmingham’s 181-game recorded history</strong>.</li>
          <li><strong>Rebounding From xpLosION 2025:</strong> Last year (8 Nov 2025), Oxford Brookes handed Birmingham a <strong>6–0 defeat</strong>—the first time the Lions were ever shut out at xpLosION and the lowest-scoring game (6 total pts) in xpLosION history.</li>
        </ul>
      </div>

      <div class="card">
        <div class="card-title">
          <span>2. xpLosION Tradition &amp; All-Time Records</span>
          <span class="tag tag-slate">xpLosION Trivia</span>
        </div>
        <ul class="fact-list">
          <li><strong>Why "xpLosION" is Capitalised That Way:</strong> Founded in <strong>November 2005</strong> around Guy Fawkes Night, the four capital letters in <strong>xpLosION</strong> deliberately spell out <strong>L-I-O-N</strong>. It is the longest-running single-game campus night showcase in British university football (drawing 1,000–2,500+ spectators with fireworks, pyrotechnics, and cheer/marching bands).</li>
          <li><strong>Fortress Bournbrook (17–3 All-Time):</strong> Across 20 completed xpLosION games (2005–2025), Birmingham are <strong>17–3 (.850)</strong>, winning the first <strong>11 straight editions (2005–2015)</strong> and another <strong>5 straight from 2019–2024</strong>.</li>
          <li><strong>Defensive Masterclass:</strong> Birmingham have recorded <strong>9 shutouts in 20 xpLosION games (45%)</strong> and held visitors to 10 points or fewer in <strong>16 of 20 editions (80%)</strong>.</li>
          <li><strong>Only 3 Visiting Teams Have Ever Won:</strong> Bath Killer Bees (<strong>10–7</strong> in 2016), Swansea Titans (<strong>20–16</strong> in 2018), and Oxford Brookes (<strong>6–0</strong> in 2025)—every single Birmingham defeat at xpLosION has been by 4 points or fewer.</li>
          <li><strong>The 2024 Anomaly:</strong> In 2024, the off-field xpLosION fireworks/event festivities were cancelled, though the Premier South game vs Cardiff Cobras was still played on 9 Nov 2024 (won <strong>27–6</strong> by Birmingham to complete a 3-peat over Cardiff).</li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Tale of the Tape -->
  <div class="section" style="margin-bottom: 4px;">
    <div class="section-title">📊 Tale of the Tape: Birmingham Lions vs Reading Knights (Archive Comparison)</div>
    <table class="tale">
      <thead>
        <tr>
          <th style="text-align: left; width: 28%;">Category / Metric</th>
          <th style="text-align: center; width: 36%;">🦁 Birmingham Lions (Home)</th>
          <th style="text-align: center; width: 36%;">⚔️ Reading Knights (Away)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Year Founded / University</strong></td>
          <td style="text-align: center;">1989 · University of Birmingham</td>
          <td style="text-align: center;">1985 · University of Reading</td>
        </tr>
        <tr>
          <td><strong>All-Time Recorded Archive Record</strong></td>
          <td style="text-align: center;"><strong>122 – 56 – 3</strong> (.682) across 181 games</td>
          <td style="text-align: center;"><strong>54 – 80 – 3</strong> (.405) across 137 games</td>
        </tr>
        <tr>
          <td><strong>All-Time Points For / Against (Shutouts)</strong></td>
          <td style="text-align: center;">4,629 PF / 2,705 PA (<strong>45 Shutouts</strong>)</td>
          <td style="text-align: center;">1,490 PF / 2,172 PA (<strong>24 Shutouts</strong>)</td>
        </tr>
        <tr>
          <td><strong>National Championships Won</strong></td>
          <td style="text-align: center;"><strong>5× National Champions</strong> (2005, 2009, 2010, 2013, 2016)</td>
          <td style="text-align: center;">0 National Titles (2025–26 Div 2 South Champions)</td>
        </tr>
        <tr>
          <td><strong>2025–26 Season Record &amp; Division</strong></td>
          <td style="text-align: center;"><strong>4 – 4</strong> (BUCS Div 1 South · National Trophy QF)</td>
          <td style="text-align: center;"><strong>6 – 0</strong> (BUCS Div 2 South · Promoted to Div 1)</td>
        </tr>
        <tr>
          <td><strong>2026–27 Season Form Entering Saturday</strong></td>
          <td style="text-align: center;"><strong>0 – 0 – 1</strong> (Tied 6–6 at Oxford Brookes on 24 Oct)</td>
          <td style="text-align: center;"><strong>0 – 0</strong> (Season Opener · On 6-game winning streak)</td>
        </tr>
        <tr>
          <td><strong>Model Projection (7 Nov 2026)</strong></td>
          <td style="text-align: center;"><strong>Projected Score: 20</strong> (73% Win Probability)</td>
          <td style="text-align: center;"><strong>Projected Score: 14</strong> (27% Win Probability)</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    <div>UK American Football Archive · <strong>xpLosION Historical Dossier &amp; 2026 Matchup Preview (Page 1 of 2)</strong></div>
    <div>Saturday, 7 November 2026 · Reading Knights @ Birmingham Lions</div>
  </div>

  <!-- ================= PAGE 2: COMPLETE ALL-TIME XPLOSION LEDGER ================= -->
  <div class="page-break"></div>

  <div class="section">
    <div class="section-title">📜 Complete All-Time xpLosION Game Ledger (2005–2026 · Editions I–XXI)</div>
    <table class="ledger">
      <thead>
        <tr>
          <th style="width: 24px;">Ed.</th>
          <th style="width: 32px;">Year</th>
          <th style="width: 56px;">Date</th>
          <th style="width: 130px;">Visiting Opponent</th>
          <th style="width: 56px;">Score</th>
          <th style="width: 28px; text-align: center;">Res</th>
          <th style="width: 105px;">Competition / Division</th>
          <th>Historical Notes &amp; Archive Context</th>
        </tr>
      </thead>
      <tbody>
        ${XPLOSION_GAMES.map(g => {
          const rowClass = g.year === '2026' ? 'row-2026' : (g.year === '2020' ? 'row-cancelled' : '');
          const badge = g.result === '—'
            ? '—'
            : `<span class="res-badge res-${g.result}">${g.result}</span>`;
          return `<tr class="${rowClass}">
            <td><strong>${g.edition}</strong></td>
            <td><strong>${g.year}</strong></td>
            <td>${g.date}</td>
            <td><strong>${g.opponent}</strong></td>
            <td><strong>${g.score}</strong></td>
            <td style="text-align: center;">${badge}</td>
            <td>${g.tier}</td>
            <td class="notes-cell">${g.notes}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>

  <!-- Opponent Series & Superlatives Breakdown -->
  <div class="section" style="margin-top: 10px;">
    <div class="section-title">🏆 xpLosION Superlatives &amp; Frequent Opponent Breakdown</div>
    <div class="grid-3">
      <div class="card">
        <div class="card-title">
          <span>Most Frequent Visitors</span>
          <span class="tag tag-amber">Series Records</span>
        </div>
        <ul class="fact-list">
          <li><strong>Warwick Wolves (3×):</strong> Lions 3–0 (2006, 2007, 2012) · Aggregate <strong>140–6</strong></li>
          <li><strong>Cardiff Cobras (3×):</strong> Lions 3–0 (2022, 2023, 2024) · Aggregate <strong>74–23</strong></li>
          <li><strong>NTU Renegades (2×):</strong> Lions 2–0 (2011, 2013) · Aggregate <strong>41–15</strong></li>
          <li><strong>Hertfordshire (2×):</strong> Lions 2–0 (2014, 2019) · Aggregate <strong>47–0</strong></li>
          <li><strong>Bath (2×) &amp; Swansea (2×):</strong> Tied 1–1 each</li>
        </ul>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Scoring Superlatives</span>
          <span class="tag tag-blue">Highs &amp; Lows</span>
        </div>
        <ul class="fact-list">
          <li><strong>Biggest Blowout:</strong> <strong>49–0</strong> vs Warwick Wolves (2007) &amp; <strong>48–0</strong> vs Warwick (2012)</li>
          <li><strong>Highest Total Points:</strong> <strong>53 pts</strong> (39–14 vs Portsmouth Destroyers, 2017)</li>
          <li><strong>Lowest Total Points:</strong> <strong>6 pts</strong> (0–6 vs Oxford Brookes, 2025)</li>
          <li><strong>Closest Win:</strong> <strong>22–19</strong> (+3 pts) vs Loughborough Aces (2010)</li>
          <li><strong>Closest Defeat:</strong> <strong>7–10</strong> (-3 pts) vs Bath Killer Bees (2016)</li>
        </ul>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Championship Omens</span>
          <span class="tag tag-green">Title Seasons</span>
        </div>
        <ul class="fact-list">
          <li><strong>4 National Titles Won After xpLosION Wins:</strong></li>
          <li><strong>2008–09:</strong> Beat Bath 29–0 → Won <strong>College Bowl XXIII</strong> (42–2)</li>
          <li><strong>2009–10:</strong> Beat LMS 34–6 → Won <strong>College Bowl XXIV</strong> (27–16)</li>
          <li><strong>2012–13:</strong> Beat Warwick 48–0 → Won <strong>College Bowl XXVII</strong> (17–13)</li>
          <li><strong>2015–16:</strong> Beat Kingston 36–0 → Won <strong>College Bowl XXX</strong> (19–13)</li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>UK American Football Archive · <strong>xpLosION Historical Dossier (Page 2 of 2)</strong> · All games tagged with <code>nickname = xpLosION</code></div>
    <div>Sources: BUCS Play, BAFRA Newsflash Archives (2007–2013), Double Coverage Archives &amp; Britball Wiki · Generated 5 Nov 2026</div>
  </div>

</body>
</html>`;
}

async function main() {
  const reportsDir = path.resolve('public/reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const outputPath = path.join(reportsDir, 'xpLosION_2026_History_and_Preview.pdf');
  const html = buildHtml();

  console.log('[INFO] Launching Chromium to render xpLosION PDF...');
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '8.5mm', right: '10mm', bottom: '8.5mm', left: '10mm' }
  });

  await browser.close();
  console.log(`[SUCCESS] PDF generated at: ${outputPath}`);
}

main().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
