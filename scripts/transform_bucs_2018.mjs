/**
 * UK American Football Archive - 2018/19 BUCS Data Transformer
 * 
 * Transforms standard tabular BUCS Excel data into the games CSV format 
 * expected by import_data.mjs.
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

// Data for validation
let existingTeams = new Set();
let existingPhases = new Map(); // year -> Set of phase names

async function loadExistingData() {
    const { data: teams } = await supabase.from('teams').select('name');
    if (teams) teams.forEach(t => existingTeams.add(t.name.toLowerCase()));

    const { data: phases } = await supabase.from('phases').select('name, season:seasons(year)');
    if (phases) {
        phases.forEach(p => {
            const year = String(p.season?.year);
            if (!existingPhases.has(year)) existingPhases.set(year, new Set());
            existingPhases.get(year).add(p.name.toLowerCase());
        });
    }
}

// Mappings
let teamMappings = {};
let phaseMappings = {};
const unmappedTeams = new Set();
const unmappedPhases = new Set();
const missingTeamsInDb = new Set();
const missingPhasesInDb = new Set();

try {
    const teamMapPath = path.resolve('data/mappings/bucs_teams.json');
    if (fs.existsSync(teamMapPath)) {
        teamMappings = JSON.parse(fs.readFileSync(teamMapPath, 'utf8'));
    }
    const phaseMapPath = path.resolve('data/mappings/bucs_phases.json');
    if (fs.existsSync(phaseMapPath)) {
        phaseMappings = JSON.parse(fs.readFileSync(phaseMapPath, 'utf8'));
    }
} catch (e) {
    console.error(`[FATAL ERROR] Could not parse mapping JSON files: ${e.message}`);
    process.exit(1);
}

function cleanTeamName(name) {
    if (!name) return "";
    let clean = name.trim();
    if (teamMappings.hasOwnProperty(clean)) {
        if (teamMappings[clean]) return teamMappings[clean];
    } else {
        teamMappings[clean] = "";
    }
    if (!teamMappings[clean]) unmappedTeams.add(clean);
    return clean;
}

function cleanPhaseName(name) {
    if (!name) return "";
    let clean = name.trim();
    if (phaseMappings.hasOwnProperty(clean)) {
        if (phaseMappings[clean]) return phaseMappings[clean];
    } else {
        phaseMappings[clean] = "";
    }
    if (!phaseMappings[clean]) unmappedPhases.add(clean);
    return clean;
}

function excelDateToISODate(excelDate) {
    if (!excelDate || isNaN(excelDate)) return null;
    const unixTime = (excelDate - 25569) * 86400 * 1000;
    const date = new Date(unixTime);
    return date.toISOString().split('T')[0];
}

function excelFractionToTime(fraction) {
    if (fraction === undefined || fraction === null || isNaN(fraction)) return null;
    const totalSeconds = Math.round(fraction * 24 * 3600);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

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

async function transformData(inputPath, outputPath, overriddenYear = "2018") {
    console.log(`--- Starting 2018/19 Transformation for ${inputPath} ---`);
    await loadExistingData();

    const workbook = xlsx.readFile(inputPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    const games = [];
    const walkovers = [];

    // Skip header row
    for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length < 10) continue;

        const rawPhase = row[3];
        const dateVal = row[4];
        const timeVal = row[5];
        const rawHome = row[6];
        const scoreHome = row[7];
        const scoreAway = row[8];
        const rawAway = row[9];
        const noScoreType = row[11];

        const mappedPhase = cleanPhaseName(rawPhase);
        const mappedHome = cleanTeamName(rawHome);
        const mappedAway = cleanTeamName(rawAway);

        let date = excelDateToISODate(dateVal);
        let time = typeof timeVal === 'number' ? excelFractionToTime(timeVal) : null;

        let homeScore = scoreHome;
        let awayScore = scoreAway;
        let status = 'completed';

        if (noScoreType === 'Walkover') {
            status = 'awarded';
            // We need to figure out who won. Usually Row 10 (Winner) tells us.
            const winner = row[10];
            if (winner === rawHome) {
                homeScore = 1; awayScore = 0;
            } else if (winner === rawAway) {
                homeScore = 0; awayScore = 1;
            }
            walkovers.push(`${mappedHome} vs ${mappedAway} (Walkover)`);
        }

        // DB VALIDATION
        if (mappedHome && !existingTeams.has(mappedHome.toLowerCase())) missingTeamsInDb.add(mappedHome);
        if (mappedAway && !existingTeams.has(mappedAway.toLowerCase())) missingTeamsInDb.add(mappedAway);
        if (mappedPhase) {
            const yearPhases = existingPhases.get(overriddenYear);
            if (!yearPhases || !yearPhases.has(mappedPhase.toLowerCase())) {
                missingPhasesInDb.add(`${mappedPhase} (${overriddenYear})`);
            }
        }

        games.push({
            competition: "BUAFL",
            year: overriddenYear,
            phase: mappedPhase,
            date: date || "",
            away_team: mappedAway,
            home_team: mappedHome,
            away_score: awayScore !== undefined ? awayScore : "",
            home_score: homeScore !== undefined ? homeScore : "",
            venue: "",
            notes: "",
            away_coach: "",
            home_coach: "",
            is_double_header: "false",
            date_precision: date ? "day" : "unknown",
            date_display: "",
            time: time || "",
            status: status,
            confidence_level: "high",
            is_playoff: mappedPhase.toLowerCase().includes('championship') || mappedPhase.toLowerCase().includes('playoff') ? "true" : "false",
            is_title_game: mappedPhase.toLowerCase().includes('final') ? "true" : "false",
            final_type: "",
            title_name: "",
            playoff_round: "",
            parent_phase: ""
        });
    }

    const headers = [
        "competition", "year", "phase", "date", "away_team", "home_team",
        "away_score", "home_score", "venue", "notes", "away_coach", "home_coach",
        "is_double_header", "date_precision", "date_display", "time", "status",
        "confidence_level", "is_playoff", "is_title_game", "final_type",
        "title_name", "playoff_round", "parent_phase"
    ];

    fs.writeFileSync(outputPath, toCSV(games, headers), 'utf8');
    console.log(`Successfully parsed ${games.length} games. Saved to ${outputPath}`);

    // Update mappings
    fs.writeFileSync('data/mappings/bucs_teams.json', JSON.stringify(teamMappings, null, 2), 'utf8');
    fs.writeFileSync('data/mappings/bucs_phases.json', JSON.stringify(phaseMappings, null, 2), 'utf8');

    if (unmappedTeams.size > 0) console.warn(`\n[!] Missing team mappings:`, Array.from(unmappedTeams));
    if (unmappedPhases.size > 0) console.warn(`\n[!] Missing phase mappings:`, Array.from(unmappedPhases));
    if (missingTeamsInDb.size > 0) console.warn(`\n[!] Missing in DB:`, Array.from(missingTeamsInDb));
    if (missingPhasesInDb.size > 0) console.warn(`\n[!] Missing phases in DB:`, Array.from(missingPhasesInDb));
}

const input = process.argv[2] || 'data/bucs_data.xlsx';
const output = process.argv[3] || 'data/transformed_bucs_games.csv';
transformData(input, output);
