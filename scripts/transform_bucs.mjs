/**
 * UK American Football Archive - External Data Transformer
 * 
 * Transforms unstructured BUCS Excel data (single column format) 
 * into the standard games CSV format expected by import_data.mjs
 */

import fs from 'fs';
import xlsx from 'xlsx';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("[FATAL ERROR] Missing Supabase environment variables in .env.local.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Load existing data from DB for validation
let existingTeams = new Set();
let existingPhases = new Map(); // year -> Set of phase names

async function loadExistingData() {
    const { data: teams } = await supabase.from('teams').select('name');
    if (teams) teams.forEach(t => existingTeams.add(t.name.toLowerCase()));

    const { data: aliases } = await supabase.from('team_aliases').select('name');
    if (aliases) aliases.forEach(a => existingTeams.add(a.name.toLowerCase()));

    const { data: phases } = await supabase.from('phases').select('name, season:seasons(year)');
    if (phases) {
        phases.forEach(p => {
            const year = String(p.season?.year);
            if (!existingPhases.has(year)) existingPhases.set(year, new Set());
            existingPhases.get(year).add(p.name.toLowerCase());
        });
    }
}

// Load optional mapping dictionaries
let teamMappings = {};
let phaseMappings = {};
const unmappedTeams = new Set();
const unmappedPhases = new Set();
const missingTeamsInDb = new Set();
const missingPhasesInDb = new Set(); // Stores "Phase (Year)" strings

try {
    const teamMapPath = path.resolve('data/mappings/bucs_teams.json');
    if (fs.existsSync(teamMapPath)) {
        teamMappings = JSON.parse(fs.readFileSync(teamMapPath, 'utf8'));
        console.log(`Loaded ${Object.keys(teamMappings).length} team mappings.`);
    }

    const phaseMapPath = path.resolve('data/mappings/bucs_phases.json');
    if (fs.existsSync(phaseMapPath)) {
        phaseMappings = JSON.parse(fs.readFileSync(phaseMapPath, 'utf8'));
        console.log(`Loaded ${Object.keys(phaseMappings).length} phase mappings.`);
    }
} catch (e) {
    console.error(`\\n[FATAL ERROR] Could not parse mapping JSON files:\\n${e.message}`);
    console.error("Please fix any syntax errors in bucs_teams.json or bucs_phases.json before running this script.\\n");
    process.exit(1);
}


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

// Clean Team Names specifically for BUCS data, applying mapping if it exists
function cleanTeamName(name) {
    if (!name) return "";
    let clean = name.trim();
    if (teamMappings.hasOwnProperty(clean)) {
        if (teamMappings[clean]) return teamMappings[clean];
    } else {
        teamMappings[clean] = "";
    }

    if (!teamMappings[clean]) {
        unmappedTeams.add(clean);
    }

    return clean;
}
// Clean phase names, applying mapping if it exists
function cleanPhaseName(name) {
    if (!name) return "";
    let clean = name.trim();
    if (phaseMappings.hasOwnProperty(clean)) {
        if (phaseMappings[clean]) return phaseMappings[clean];
    } else {
        phaseMappings[clean] = "";
    }

    if (!phaseMappings[clean]) {
        unmappedPhases.add(clean);
    }

    return clean;
}

async function transformBucsData(inputPath, outputPath, overriddenYear = null) {
    console.log(`--- Starting Transformation for ${inputPath} ---`);
    if (overriddenYear) console.log(`Manually setting season year to: ${overriddenYear}`);
    const walkovers = [];

    // 0. Load existing teams/phases from DB
    await loadExistingData();

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
            (scoreBlock.length !== 1 && scoreBlock.length !== 2) ||
            awayInfoBlock.length < 1
        ) {
            i++;
            continue;
        }

        const rawPhase = homeBlock[0];
        const rawHomeTeam = homeBlock[1];
        const scoreStr = scoreBlock.join(' ');
        const rawAwayTeam = awayInfoBlock[0];

        let homeScore = null;
        let awayScore = null;
        let status = 'completed';

        // Excel sometimes auto-formats "22-6" into a Date object or serial number
        // e.g. Excel serial number for a date, or a string like "22/06/2021" or "06-22-2021"
        // We must detect these and convert them back to scores
        let parsedScoreStr = scoreStr;
        if (typeof scoreStr === 'number' && scoreStr > 20000) {
            // It's likely an excel serial date that was supposed to be a score.
            // i.e Excel evaluated '22-6' as June 22 in the current year.
            const dateObj = new Date((scoreStr - 25569) * 86400 * 1000);
            const maybeDay = dateObj.getDate();
            const maybeMonth = dateObj.getMonth() + 1;
            // Best guess: It was "Day-Month" or "Month-Day"
            parsedScoreStr = `${maybeDay} - ${maybeMonth}`;
        } else if (typeof scoreStr === 'string' && scoreStr.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
            // String date like "22/06/2025"
            const dateParts = scoreStr.split('/');
            parsedScoreStr = `${parseInt(dateParts[0], 10)} - ${parseInt(dateParts[1], 10)}`;
        }

        const mappedPhase = cleanPhaseName(rawPhase);
        const mappedHome = cleanTeamName(rawHomeTeam);
        const mappedAway = cleanTeamName(rawAwayTeam);

        // Status Logic
        const lowerScore = parsedScoreStr.toLowerCase();
        if (lowerScore.includes('walkover') || lowerScore.includes('forfeit') || lowerScore.includes('awarded')) {
            status = 'awarded';
            if (lowerScore.includes('home walkover') || lowerScore.includes('h - w') || lowerScore.includes('home win') || lowerScore.includes('hw')) {
                homeScore = 1; awayScore = 0;
                walkovers.push(`${mappedHome} vs ${mappedAway} (Home Walkover)`);
            } else if (lowerScore.includes('away walkover') || lowerScore.includes('a - w') || lowerScore.includes('away win') || lowerScore.includes('aw')) {
                homeScore = 0; awayScore = 1;
                walkovers.push(`${mappedHome} vs ${mappedAway} (Away Walkover)`);
            } else {
                walkovers.push(`${mappedHome} vs ${mappedAway} (Unknown Forfeit)`);
            }
        } else if (parsedScoreStr.includes(' - ')) {
            const parts = parsedScoreStr.split(' - ');
            if (parts.length === 2 && !isNaN(parseInt(parts[0])) && !isNaN(parseInt(parts[1]))) {
                homeScore = parseInt(parts[0]);
                awayScore = parseInt(parts[1]);
                status = 'completed';
            } else {
                status = 'scheduled';
                // Double check for A-W or H-W inside the " - " block
                if (parsedScoreStr.includes('A - W')) {
                    status = 'awarded'; awayScore = 1; homeScore = 0;
                    walkovers.push(`${mappedHome} vs ${mappedAway} (Away Walkover)`);
                } else if (parsedScoreStr.includes('H - W')) {
                    status = 'awarded'; homeScore = 1; awayScore = 0;
                    walkovers.push(`${mappedHome} vs ${mappedAway} (Home Walkover)`);
                }
            }
        } else if (lowerScore.includes('v') || lowerScore.includes('tbc') || parsedScoreStr.trim() === '-') {
            status = 'scheduled';
        }

        // Parse Info Block [AwayTeam, Date, Time, Venue Lines...]
        let dateVal = awayInfoBlock.length > 1 ? awayInfoBlock[1] : null;
        let timeVal = awayInfoBlock.length > 2 ? awayInfoBlock[2] : null;

        let date = null;
        let time = null;

        if (typeof dateVal === 'number') {
            date = excelDateToISODate(dateVal);
        } else if (typeof dateVal === 'string') {
            const dateStr = dateVal.trim();
            const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
            if (parts.length === 3 && parts[2].length === 4) {
                // assume DD/MM/YYYY or DD-MM-YYYY
                date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else if (parts.length === 3 && parts[0].length === 4) {
                // already YYYY-MM-DD
                date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else {
                date = dateStr;
            }
        }

        let isTimeVal = false;
        if (typeof timeVal === 'number' && timeVal < 1) {
            time = excelFractionToTime(timeVal);
            isTimeVal = true;
        } else if (typeof timeVal === 'string' && timeVal.includes(':')) {
            time = timeVal.trim();
            isTimeVal = true;
        }

        let venue = null;
        let startIndex = isTimeVal ? 3 : 2;
        if (startIndex < awayInfoBlock.length) {
            let fullVenue = String(awayInfoBlock[startIndex]).split(' Provider:')[0];
            venue = fullVenue.split(',')[0].trim();
        }


        // Determine Year
        let gameYear = overriddenYear;
        if (!gameYear && date) {
            // For BUAFL, we typically use the season start year.
            // If the date is Jan-Aug, it's likely the "second half" of the previous year's season.
            // If it's Sep-Dec, it's the start year.
            const d = new Date(date);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            gameYear = (m < 9) ? String(y - 1) : String(y);
        } else if (!gameYear) {
            gameYear = "2025"; // Fallback to current season if date missing and no override
        }

        // DB VALIDATION
        if (mappedHome && !existingTeams.has(mappedHome.toLowerCase())) missingTeamsInDb.add(mappedHome);
        if (mappedAway && !existingTeams.has(mappedAway.toLowerCase())) missingTeamsInDb.add(mappedAway);
        if (mappedPhase) {
            const yearPhases = existingPhases.get(gameYear);
            if (!yearPhases || !yearPhases.has(mappedPhase.toLowerCase())) {
                missingPhasesInDb.add(`${mappedPhase} (${gameYear})`);
            }
        }

        games.push({
            competition: "BUAFL",
            year: gameYear,
            phase: mappedPhase,
            date: date || "",
            away_team: mappedAway,
            home_team: mappedHome,
            away_score: awayScore !== null ? awayScore : "",
            home_score: homeScore !== null ? homeScore : "",
            venue: venue || "",
            notes: "",
            away_coach: "",
            home_coach: "",
            is_double_header: "false",
            date_precision: date ? "day" : "unknown",
            date_display: "",
            time: time || "",
            status: status,
            confidence_level: "high",
            is_playoff: mappedPhase.toLowerCase().includes('championship') ? "true" : "false",
            is_title_game: mappedPhase.toLowerCase().includes('final') ? "true" : "false",
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
        "competition", "year", "phase", "parent_phase", "away_phase", "away_parent_phase",
        "date", "away_team", "home_team",
        "away_score", "home_score", "venue", "notes", "away_coach", "home_coach",
        "is_double_header", "date_precision", "date_display", "time", "status",
        "confidence_level", "is_playoff", "is_title_game", "final_type",
        "title_name", "playoff_round"
    ];

    const csvString = toCSV(games, headers);
    fs.writeFileSync(outputPath, csvString, 'utf8');
    console.log(`--- Saved transformed data to ${outputPath} ---`);

    // Write back mappings including the newly discovered empty ones
    const teamMapPath = path.resolve('data/mappings/bucs_teams.json');
    const phaseMapPath = path.resolve('data/mappings/bucs_phases.json');
    fs.writeFileSync(teamMapPath, JSON.stringify(teamMappings, null, 2), 'utf8');
    fs.writeFileSync(phaseMapPath, JSON.stringify(phaseMappings, null, 2), 'utf8');

    if (unmappedTeams.size > 0) {
        console.warn(`\n[!] Warning: ${unmappedTeams.size} teams are missing mappings in bucs_teams.json:`);
        unmappedTeams.forEach(t => console.warn(`  - ${t}`));
    }
    if (unmappedPhases.size > 0) {
        console.warn(`\n[!] Warning: ${unmappedPhases.size} phases are missing mappings in bucs_phases.json:`);
        unmappedPhases.forEach(p => console.warn(`  - ${p}`));
    }

    if (missingTeamsInDb.size > 0) {
        console.warn(`\n[!] Warning: ${missingTeamsInDb.size} teams exist in mapping but NOT in database:`);
        missingTeamsInDb.forEach(t => console.warn(`  - ${t}`));
    }
    if (missingPhasesInDb.size > 0) {
        console.warn(`\n[!] Warning: ${missingPhasesInDb.size} phases exist in mapping but NOT in database:`);
        missingPhasesInDb.forEach(p => console.warn(`  - ${p}`));
    }

    if (walkovers.length > 0) {
        console.log(`\n[ℹ] Info: Found ${walkovers.length} walkover games that may require manual review:`);
        walkovers.forEach(w => console.log(`  - ${w}`));
    }
}

const inputPath = process.argv[2] || 'data/bucs_data.xlsx';
const outputPath = process.argv[3] || 'data/transformed_bucs_games.csv';
const overriddenYear = process.argv[4] || null;

transformBucsData(inputPath, outputPath, overriddenYear).catch(err => {
    console.error("Fatal Error:", err);
});
