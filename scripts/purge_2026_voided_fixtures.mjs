import ws from 'ws';
global.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local', quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('=== Purging 22 Voided Fixtures from 2026/27 Schedule ===\n');

  const seasonId = '1f2d75df-a1f4-4884-ab7c-b6c07c137083';

  // 1. Get 2026 phase IDs
  const { data: phases } = await supabase
    .from('phases')
    .select('id, name')
    .eq('season_id', seasonId);

  const phaseIds = phases.map(p => p.id);
  const phaseNameMap = new Map(phases.map(p => [p.id, p.name]));

  // 2. Fetch the 22 undated/voided games
  const { data: voidGames, error: fetchErr } = await supabase
    .from('games')
    .select('id, phase_id, home_team_id, away_team_id, date, status, teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)')
    .in('phase_id', phaseIds)
    .is('date', null);

  if (fetchErr) throw fetchErr;

  console.log(`Found ${voidGames.length} voided games in database to delete.`);
  if (voidGames.length !== 22) {
    console.warn(`Warning: Expected 22 voided games, found ${voidGames.length}`);
  }

  const idsToDelete = voidGames.map(g => g.id);

  // 3. Delete from Supabase
  if (idsToDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('games')
      .delete()
      .in('id', idsToDelete);

    if (delErr) throw delErr;
    console.log(`[DB] Successfully deleted ${idsToDelete.length} voided games from Supabase.`);
  }

  // 4. Verify remaining DB games for 2026
  const { count: remainingCount, error: countErr } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .in('phase_id', phaseIds);

  if (countErr) throw countErr;
  console.log(`[DB] Remaining 2026 scheduled games: ${remainingCount} (Expected: 276)`);

  // 5. Update data/BUAFL/games2026.csv
  const csvPath = path.join(__dirname, '..', 'data', 'BUAFL', 'games2026.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n');
  const header = lines[0];

  const retainedLines = [header];
  let purgedCsvCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Check if line has empty date (e.g. BUAFL,2026,Division 2 Midlands,,...)
    // Format: competition,year,phase,date,home_team,...
    const parts = line.split(',');
    // In our CSV: col 0 = competition, col 1 = year, col 2 = phase, col 3 = date
    // If phase has quotes, let's handle regex:
    const isUndated = /^[^,]+,[^,]+,(?:"[^"]*"|[^,]*),,/.test(line);

    if (isUndated) {
      purgedCsvCount++;
    } else {
      retainedLines.push(line);
    }
  }

  fs.writeFileSync(csvPath, retainedLines.join('\n') + '\n', 'utf8');
  console.log(`[CSV] Purged ${purgedCsvCount} voided rows from data/BUAFL/games2026.csv.`);
  console.log(`[CSV] Remaining rows in CSV: ${retainedLines.length - 1} (Expected: 276)`);

  // 6. Update scratch/playwaze_2026_fixtures.json to filter out 2026-07-23
  const rawJsonPath = path.join(__dirname, '..', 'scratch', 'playwaze_2026_fixtures.json');
  if (fs.existsSync(rawJsonPath)) {
    const rawMatches = JSON.parse(fs.readFileSync(rawJsonPath, 'utf8'));
    const filteredMatches = rawMatches.filter(m => m.date !== '2026-07-23');
    fs.writeFileSync(rawJsonPath, JSON.stringify(filteredMatches, null, 2) + '\n', 'utf8');
    console.log(`[JSON] Filtered scratch/playwaze_2026_fixtures.json: ${rawMatches.length} -> ${filteredMatches.length} fixtures.`);
  }

  console.log('\n=== Purge Completed Successfully ===');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
