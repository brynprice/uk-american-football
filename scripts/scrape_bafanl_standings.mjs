import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

chromium.use(stealthPlugin());

const DIVISIONS_2026 = [
  { name: 'Premiership North', id: '393306084', tier: 'Premiership', parent: 'Premiership' },
  { name: 'Premiership South', id: '683840583', tier: 'Premiership', parent: 'Premiership' },
  { name: 'NFC 1 Scotland', id: '302831043', tier: 'Division One', parent: 'Northern Football Conference' },
  { name: 'NFC 1 North', id: '221294791', tier: 'Division One', parent: 'Northern Football Conference' },
  { name: 'NFC 1 Midlands', id: '96790864', tier: 'Division One', parent: 'Northern Football Conference' },
  { name: 'SFC 1 East', id: '203332542', tier: 'Division One', parent: 'Southern Football Conference' },
  { name: 'SFC 1 Central', id: '155947035', tier: 'Division One', parent: 'Southern Football Conference' },
  { name: 'SFC 1 West', id: '725626399', tier: 'Division One', parent: 'Southern Football Conference' },
  { name: 'NFC 2 North', id: '206762272', tier: 'Division Two', parent: 'Northern Football Conference' },
  { name: 'NFC 2 Midlands', id: '969776118', tier: 'Division Two', parent: 'Northern Football Conference' },
  { name: 'SFC 2 East', id: '131600197', tier: 'Division Two', parent: 'Southern Football Conference' },
  { name: 'SFC 2 West', id: '597587404', tier: 'Division Two', parent: 'Southern Football Conference' },
];

async function main() {
  console.log('Launching browser to scrape BAFANL 2026 standings...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const allStandings = [];

  for (const div of DIVISIONS_2026) {
    const url = `https://bafanle.leaguerepublic.com/standingsForDate/${div.id}/2/-1/-1.html`;
    console.log(`Scraping ${div.name}... (${url})`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    const rows = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return [];
      const trs = Array.from(table.querySelectorAll('tr'));
      const parsed = [];
      for (const tr of trs) {
        const tds = Array.from(tr.querySelectorAll('td'));
        if (tds.length >= 18) {
          parsed.push({
            position: tds[0]?.innerText.trim(),
            team: tds[1]?.innerText.trim(),
            played: tds[2]?.innerText.trim(),
            home_w: tds[3]?.innerText.trim(),
            home_l: tds[4]?.innerText.trim(),
            home_t: tds[5]?.innerText.trim(),
            home_pf: tds[6]?.innerText.trim(),
            home_pa: tds[7]?.innerText.trim(),
            away_w: tds[8]?.innerText.trim(),
            away_l: tds[9]?.innerText.trim(),
            away_t: tds[10]?.innerText.trim(),
            away_pf: tds[11]?.innerText.trim(),
            away_pa: tds[12]?.innerText.trim(),
            wins: tds[13]?.innerText.trim(),
            losses: tds[14]?.innerText.trim(),
            ties: tds[15]?.innerText.trim(),
            points_for: tds[16]?.innerText.trim(),
            points_against: tds[17]?.innerText.trim(),
            pct: tds[18]?.innerText.trim(),
            streak: tds[19]?.innerText.trim() || ''
          });
        }
      }
      return parsed;
    });

    console.log(`  Found ${rows.length} teams in ${div.name}`);
    for (const r of rows) {
      allStandings.push({
        competition_name: 'BAFA National Leagues',
        parent_phase: div.parent,
        phase: div.name,
        year: '2026',
        team: r.team,
        position: r.position,
        games_played: r.played,
        wins: r.wins,
        losses: r.losses,
        ties: r.ties,
        points_for: r.points_for,
        points_against: r.points_against,
        streak: r.streak,
        is_champion: r.position === '1' ? 'TRUE' : 'FALSE',
        notes: `Source: League Republic official standings (${url})`,
        head_coach: ''
      });
    }
  }

  await browser.close();

  // Write standings2026.csv
  const headers = [
    'competition_name', 'parent_phase', 'phase', 'year', 'team', 'position',
    'games_played', 'wins', 'losses', 'ties', 'points_for', 'points_against',
    'streak', 'is_champion', 'notes', 'head_coach'
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [headers.join(',')];
  for (const s of allStandings) {
    lines.push(headers.map(h => escapeCsv(s[h])).join(','));
  }

  const outPath = 'data/BAFANL/standings2026.csv';
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
  console.log(`\nSuccessfully wrote ${allStandings.length} standings rows to ${outPath}!`);
}

main().catch(console.error);
