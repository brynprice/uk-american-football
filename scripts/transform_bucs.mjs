/**
 * UK American Football Archive - External Data Transformer
 * 
 * Transforms unstructured BUCS Excel data (single column format) 
 * into the standard games CSV format expected by import_data.mjs
 */

import fs from 'fs';
import xlsx from 'xlsx';

// Utility to write CSV string safely
function toCSV(data, headers) {
    if (data.length === 0) return headers.join(',') + '\n';

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

// Convert Excel Serial Date to YYYY-MM-DD
function excelDateToISODate(excelDate) {
    if (!excelDate || isNaN(excelDate)) return null;
    // Excel epochs differ between Windows (1900) and Mac (1904), standard is 1900
    // 25569 represents Jan 1, 1970
    const unixTime = (excelDate - 25569) * 86400 * 1000;
    const date = new Date(unixTime);
    return date.toISOString().split('T')[0];
}

// Format Time from fraction (e.g. 0.5416666 = 13:00)
function excelFractionToTime(fraction) {
    if (!fraction || isNaN(fraction)) return null;
    const totalSeconds = Math.round(fraction * 24 * 3600);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Clean Team Names specifically for BUCS data
function cleanTeamName(name) {
    if (!name) return "";
    return name.replace(/\s+Open\s+\d+$/, '').trim();
}

async function transformBucsData(inputPath, outputPath) {
    console.log(`--- Starting Transformation for ${inputPath} ---`);

    // 1. Read Excel file
    const workbook = xlsx.readFile(inputPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to simple 1D array from the single column layout
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    const flattenedData = rawData.map(row => row[0]).filter(val => val !== undefined);

    // 2. Parse by Chunks
    // The data appears to consist of blocks separated by ' ' (whitespace)
    const blocks = [];
    let currentBlock = [];

    for (const item of flattenedData) {
        if (typeof item === 'string' && item.trim() === '') {
            if (currentBlock.length > 0) {
                // Determine if this looks like a valid game block
                // Usually blocks with just 1 element might just be stray whitespace or anomalies
                blocks.push(currentBlock);
            }
            // Start reading the next component of the game, or wait for the next game
            currentBlock = [];
        } else {
            currentBlock.push(item);
        }
    }
    // catch last block
    if (currentBlock.length > 0) blocks.push(currentBlock);

    console.log(`Identified approx ${blocks.length} data blocks.`);

    // We look for consecutive blocks to form a game. 
    // Usually it's:
    // Block 1: [Phase, HomeTeam]
    // Block 2: [Score]
    // Block 3: [AwayTeam, Date, ...info]

    const games = [];
    let i = 0;

    while (i < blocks.length) {
        // Safety check boundaries
        if (i + 2 >= blocks.length) break;

        const homeBlock = blocks[i];
        const scoreBlock = blocks[i + 1];
        const awayInfoBlock = blocks[i + 2];

        // If it doesn't match the expected signature, advance by 1 and try again
        if (
            homeBlock.length !== 2 ||
            scoreBlock.length !== 1 ||
            awayInfoBlock.length < 1
        ) {
            i++;
            continue;
        }

        const phase = homeBlock[0];
        const rawHomeTeam = homeBlock[1];
        const scoreStr = scoreBlock[0];
        const rawAwayTeam = awayInfoBlock[0];

        let homeScore = null;
        let awayScore = null;
        let status = 'completed';

        if (typeof scoreStr === 'string' && scoreStr.includes(' - ')) {
            const parts = scoreStr.split(' - ');
            if (parts.length === 2 && !isNaN(parseInt(parts[0])) && !isNaN(parseInt(parts[1]))) {
                // Format is Home - Away
                homeScore = parseInt(parts[0]);
                awayScore = parseInt(parts[1]);
            } else {
                status = 'scheduled'; // Not played yet or Walkover
                if (scoreStr.includes('A - W')) { status = 'awarded'; awayScore = 1; homeScore = 0; } // Away win walkover
                if (scoreStr.includes('H - W')) { status = 'awarded'; homeScore = 1; awayScore = 0; } // Home win walkover
            }
        } else if (typeof scoreStr === 'string' && (scoreStr.includes('v') || scoreStr.includes('TBC'))) {
            status = 'scheduled';
        }

        // Parse Info Block [AwayTeam, Date, Time, Venue Lines...]
        const dateSerial = awayInfoBlock.length > 1 ? awayInfoBlock[1] : null;
        const timeFraction = (awayInfoBlock.length > 2 && typeof awayInfoBlock[2] === 'number' && awayInfoBlock[2] < 1) ? awayInfoBlock[2] : null;

        const date = typeof dateSerial === 'number' ? excelDateToISODate(dateSerial) : null;
        const time = timeFraction ? excelFractionToTime(timeFraction) : null;

        let venue = null;
        let notes = [];

        let startIndex = timeFraction ? 3 : 2;
        if (startIndex < awayInfoBlock.length) {
            venue = String(awayInfoBlock[startIndex]).split(' Provider:')[0];
            for (let j = startIndex + 1; j < awayInfoBlock.length; j++) {
                notes.push(String(awayInfoBlock[j]));
            }
        }


        games.push({
            competition: "BUCS",
            year: "2021", // Inferring from 'Provider: Rugby Union 21-22' in notes
            phase: phase,
            date: date || "",
            away_team: cleanTeamName(rawAwayTeam),
            home_team: cleanTeamName(rawHomeTeam),
            away_score: awayScore !== null ? awayScore : "",
            home_score: homeScore !== null ? homeScore : "",
            venue: venue || "",
            notes: notes.join(' | '),
            away_coach: "",
            home_coach: "",
            is_double_header: "false",
            date_precision: date ? "day" : "unknown",
            date_display: "",
            time: time || "",
            status: status,
            confidence_level: "high",
            is_playoff: phase.toLowerCase().includes('championship') ? "true" : "false",
            is_title_game: phase.toLowerCase().includes('final') ? "true" : "false",
            final_type: "",
            title_name: "",
            playoff_round: "",
            parent_phase: ""
        });

        // Advance pointer.
        i += 3;
    }

    console.log(`Successfully parsed ${games.length} games.`);

    // 3. Write standard format to CSV
    const headers = [
        "competition", "year", "phase", "date", "away_team", "home_team",
        "away_score", "home_score", "venue", "notes", "away_coach", "home_coach",
        "is_double_header", "date_precision", "date_display", "time", "status",
        "confidence_level", "is_playoff", "is_title_game", "final_type",
        "title_name", "playoff_round", "parent_phase"
    ];

    const csvString = toCSV(games, headers);
    fs.writeFileSync(outputPath, csvString, 'utf8');
    console.log(`--- Saved transformed data to ${outputPath} ---`);
}

const inputPath = process.argv[2] || 'data/bucs_data.xlsx';
const outputPath = process.argv[3] || 'data/transformed_bucs_games.csv';

transformBucsData(inputPath, outputPath).catch(err => {
    console.error("Fatal Error:", err);
});
