import { createRequire } from 'module';
const require = createRequire('/Users/brynprice/uk-football-history/package.json');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const ws = require('ws');
global.WebSocket = ws;
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '/Users/brynprice/uk-football-history/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('=== Step 1: Loading Teams from Supabase ===');
  const { data: teams, error: tErr } = await supabase
    .from('teams')
    .select('id, name, location, team_type, founded_year, folded_year')
    .order('name');
  if (tErr) throw tErr;
  console.log(`Loaded ${teams.length} teams.`);

  console.log('\n=== Step 2: Loading All Games to Determine First Game Year ===');
  let allGames = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data: chunk, error: gErr } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id, date, seasons(year)')
      .order('date', { ascending: true })
      .range(from, from + step - 1);
    if (gErr) throw gErr;
    allGames = allGames.concat(chunk);
    if (chunk.length < step) break;
    from += step;
  }
  console.log(`Loaded ${allGames.length} games.`);

  const teamGames = new Map();
  for (const g of allGames) {
    for (const tid of [g.home_team_id, g.away_team_id]) {
      if (!tid) continue;
      if (!teamGames.has(tid)) teamGames.set(tid, []);
      teamGames.get(tid).push(g);
    }
  }

  const toPopulate = [];
  const exactMatch = [];
  const foundedBefore = [];
  const foundedAfter = [];
  const noGames = [];

  for (const t of teams) {
    const gList = teamGames.get(t.id);
    if (!gList || gList.length === 0) {
      noGames.push(t);
      continue;
    }

    gList.sort((a, b) => {
      const aDate = a.date || `${a.seasons?.year}-01-01`;
      const bDate = b.date || `${b.seasons?.year}-01-01`;
      return aDate.localeCompare(bDate);
    });

    const firstG = gList[0];
    const firstYear = firstG.date ? parseInt(firstG.date.substring(0, 4)) : firstG.seasons?.year;

    if (t.founded_year === null || t.founded_year === undefined) {
      toPopulate.push({
        team: t,
        firstYear,
        firstGameDate: firstG.date,
        seasonYear: firstG.seasons?.year
      });
    } else if (t.founded_year === firstYear) {
      exactMatch.push({
        team: t,
        year: firstYear
      });
    } else if (t.founded_year < firstYear) {
      foundedBefore.push({
        team: t,
        founded: t.founded_year,
        firstYear,
        diff: firstYear - t.founded_year,
        firstGameDate: firstG.date
      });
    } else {
      foundedAfter.push({
        team: t,
        founded: t.founded_year,
        firstYear,
        diff: firstYear - t.founded_year,
        firstGameDate: firstG.date
      });
    }
  }

  console.log('\n=== Analysis Summary ===');
  console.log(`- Total Teams: ${teams.length}`);
  console.log(`- Teams to populate with first game year: ${toPopulate.length}`);
  console.log(`- Existing founded_year matching first game year: ${exactMatch.length}`);
  console.log(`- Existing founded_year BEFORE first game (early formation): ${foundedBefore.length}`);
  console.log(`- Existing founded_year AFTER first game (debuted before recorded founding): ${foundedAfter.length}`);
  console.log(`- Teams without games: ${noGames.length}`);

  console.log('\n=== Step 3: Updating Supabase Teams (Without Overwriting Existing) ===');
  let updatedCount = 0;
  for (const item of toPopulate) {
    const { error: uErr } = await supabase
      .from('teams')
      .update({ founded_year: item.firstYear })
      .eq('id', item.team.id);
    if (uErr) {
      console.error(`Error updating team ${item.team.name}:`, uErr.message);
    } else {
      updatedCount++;
    }
  }
  console.log(`Successfully updated ${updatedCount} teams in Supabase.`);

  console.log('\n=== Step 4: Synchronizing data/teams.csv ===');
  const teamsCsvPath = 'data/teams.csv';
  if (fs.existsSync(teamsCsvPath)) {
    const csvContent = fs.readFileSync(teamsCsvPath, 'utf8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true, bom: true });

    // Build map of updated founded years
    const populatedMap = new Map();
    for (const p of toPopulate) {
      populatedMap.set(p.team.name.toLowerCase().trim(), p.firstYear);
    }

    let csvUpdatedCount = 0;
    for (const row of records) {
      const nameKey = row.name.toLowerCase().trim();
      if ((!row.founded_year || row.founded_year.trim() === '') && populatedMap.has(nameKey)) {
        row.founded_year = String(populatedMap.get(nameKey));
        csvUpdatedCount++;
      }
    }

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = 'name,location,team_type,founded_year,folded_year\n';
    const lines = records.map(r => [r.name, r.location, r.team_type, r.founded_year || '', r.folded_year || ''].map(escapeCsv).join(','));
    fs.writeFileSync(teamsCsvPath, header + lines.join('\n') + '\n', 'utf8');
    console.log(`Updated ${csvUpdatedCount} rows in data/teams.csv.`);
  }

  // Generate Report Object
  const report = {
    totalTeams: teams.length,
    populatedCount: toPopulate.length,
    exactMatchCount: exactMatch.length,
    foundedBeforeCount: foundedBefore.length,
    foundedAfterCount: foundedAfter.length,
    noGamesCount: noGames.length,
    toPopulate,
    foundedBefore,
    foundedAfter,
    noGames
  };

  fs.writeFileSync('scratch/founding_year_report.json', JSON.stringify(report, null, 2), 'utf8');
  console.log('\nReport written to scratch/founding_year_report.json');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
