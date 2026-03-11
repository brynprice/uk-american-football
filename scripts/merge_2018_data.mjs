import fs from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';

const fileOld = 'data/games2018.csv';
const fileNewReg = 'data/transformed_bucs_games_2018_reg.csv';
const fileNewPlayoffs = 'data/transformed_bucs_games_2018_playoffs.csv';
const fileOutput = 'data/transformed_bucs_games_2018_merged.csv';

function loadCsv(path) {
    if (!fs.existsSync(path)) {
        console.error(`File not found: ${path}`);
        return [];
    }
    const content = fs.readFileSync(path, 'utf8');
    return parse(content, { columns: true, skip_empty_lines: true, trim: true, bom: true });
}

const oldData = loadCsv(fileOld);
const newReg = loadCsv(fileNewReg);
const newPlayoffs = loadCsv(fileNewPlayoffs);

console.log(`### Merger Input Stats`);
console.log(`- Old CSV (games2018.csv): ${oldData.length} games`);
console.log(`- New Reg (transformed...reg.csv): ${newReg.length} games`);
console.log(`- New Playoffs (transformed...playoffs.csv): ${newPlayoffs.length} games`);

// Helpers for deduplication
function getBaseKey(g) {
    const home = (g.home_team || "").trim().toLowerCase();
    const away = (g.away_team || "").trim().toLowerCase();
    return `${home} vs ${away}`;
}

function getDate(g) {
    return new Date(g.date);
}

// 1. Build a lookup for the NEW data (the primary source)
const newLookup = new Map(); // pairing -> [games]
[...newReg, ...newPlayoffs].forEach(g => {
    const key = getBaseKey(g);
    if (!newLookup.has(key)) newLookup.set(key, []);
    newLookup.get(key).push(g);
});

const mergedGames = [...newReg, ...newPlayoffs];
let backfilledCount = 0;

// 2. Identify and add missing games from Old CSV
oldData.forEach(oldGame => {
    const key = getBaseKey(oldGame);
    const existing = newLookup.get(key) || [];

    // Check if a game with the same pairing already exists within a +/- 10 day window
    const oldDate = getDate(oldGame);
    const isDuplicate = existing.some(newGame => {
        const newDate = getDate(newGame);
        const diffDays = Math.abs(newDate - oldDate) / (1000 * 60 * 60 * 24);
        return diffDays < 10;
    });

    if (!isDuplicate) {
        // This is a missing game! Backfill it.
        // We'll trust the Old CSV data but ensure it matches the new header format.
        mergedGames.push({
            ...oldGame,
            confidence_level: 'medium', // Mark backfilled data as lower confidence
            notes: (oldGame.notes || "") + " [Backfilled from legacy BUCS CSV]"
        });
        backfilledCount++;
    }
});

// 3. Save merged results
const headers = [
    "competition", "year", "phase", "date", "away_team", "home_team",
    "away_score", "home_score", "venue", "notes", "away_coach", "home_coach",
    "is_double_header", "date_precision", "date_display", "time", "status",
    "confidence_level", "is_playoff", "is_title_game", "final_type",
    "title_name", "playoff_round", "parent_phase"
];

function toCSV(data, headers) {
    const rows = [headers];
    for (const row of data) {
        const values = headers.map(header => {
            const val = row[header];
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('\"') || str.includes('\n')) {
                return `\"${str.replace(/\"/g, '\"\"')}\"`;
            }
            return str;
        });
        rows.push(values);
    }
    return rows.map(r => r.join(',')).join('\n');
}

fs.writeFileSync(fileOutput, toCSV(mergedGames, headers), 'utf8');

console.log(`\n### Merger Results`);
console.log(`- **Backfilled**: ${backfilledCount} games added from Old CSV.`);
console.log(`- **Total Merged**: ${mergedGames.length} games. saved to ${fileOutput}`);

// Sanity check: Total games should be around 330-350
if (mergedGames.length < 330) {
    console.warn(`[!] Warning: Merged count (${mergedGames.length}) is lower than expected (~330+).`);
}
