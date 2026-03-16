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

    // 1. PRE-SCAN: Identify Primary Divisions for each team
    const teamGameCounts = {}; // team -> competition -> count
    console.log(`  [Integrity] Pre-scanning ${rawRows.length - 1} rows for primary divisions...`);

    for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length < 10) continue;
        const comp = (row[3] || "").toString().trim();
        const home = (row[6] || "").toString().trim();
        const away = (row[9] || "").toString().trim();
        if (!comp || (!home && !away)) continue;

        [home, away].forEach(t => {
            if (!t) return;
            if (!teamGameCounts[t]) teamGameCounts[t] = {};
            teamGameCounts[t][comp] = (teamGameCounts[t][comp] || 0) + 1;
        });
    }

    const teamPrimary = {};
    for (const team in teamGameCounts) {
        const sorted = Object.entries(teamGameCounts[team]).sort((a, b) => b[1] - a[1]);
        teamPrimary[team] = sorted[0][0];
    }

    const games = [];
    const anomalies = [];
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

        const isPlayoff = mappedPhase.toLowerCase().includes('championship') ||
            mappedPhase.toLowerCase().includes('playoff') ||
            mappedPhase.toLowerCase().includes('cup') ||
            mappedPhase.toLowerCase().includes('trophy');

        let date = excelDateToISODate(dateVal);
        const originalDateStr = date;

        // Smart Date Correction
        if (date) {
            const d = new Date(date);
            const day = d.getUTCDate();
            const month = d.getUTCMonth();
            const year = d.getUTCFullYear();

            const yearInt = parseInt(overriddenYear);
            // Default regular season window: Nov of Year to Mar of Year+1
            let seasonStart = new Date(Date.UTC(yearInt, 10, 2)); 
            let seasonEnd = new Date(Date.UTC(yearInt + 1, 2, 31));   

            // narrowed Playoff window: Feb 14 - Mar 31 of Year+1
            if (isPlayoff) {
                seasonStart = new Date(Date.UTC(yearInt + 1, 1, 14));
            }

            const getScore = (dateObj) => {
                let s = 0;
                if (dateObj >= seasonStart && dateObj <= seasonEnd) s += 100;
                const dw = dateObj.getUTCDay();
                if (dw === 0) s += 3; // Sunday
                if (dw === 6) s += 2; // Saturday
                if (dw === 3) s += 1; // Wednesday
                return s;
            };

            const originalScore = getScore(d);

            if (day <= 12) {
                let targetYear = year;
                if (month >= 8 && day <= 4) targetYear = year + 1;
                else if (month <= 3 && day >= 9) targetYear = year - 1;

                const flipped = new Date(Date.UTC(targetYear, day - 1, month + 1));
                const flippedScore = getScore(flipped);

                if (flippedScore > originalScore) {
                    date = flipped.toISOString().split('T')[0];
                    console.log(`  [Date Correction] Flipped "${originalDateStr}" (Score ${originalScore}) -> "${date}" (Score ${flippedScore}) [Playoff=${isPlayoff}]`);
                }
            }
        }
        let time = typeof timeVal === 'number' ? excelFractionToTime(timeVal) : null;

        let homeScore = scoreHome;
        let awayScore = scoreAway;
        let status = 'completed';

        if (noScoreType === 'Walkover') {
            status = 'awarded';
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

        const game = {
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
            is_playoff: isPlayoff ? "true" : "false",
            is_title_game: mappedPhase.toLowerCase().includes('final') ? "true" : "false",
            final_type: "",
            title_name: "",
            playoff_round: "",
            parent_phase: ""
        };

        // INTEGRITY CHECK: Is this an anomaly?
        // If it's a playoff/cup game, we don't strictly enforce primary division
        // But for regular league games, we do.
        const isAnomaly = !isPlayoff && (teamPrimary[rawHome] !== rawPhase || teamPrimary[rawAway] !== rawPhase);

        if (isAnomaly) {
            game.notes = `[Anomaly] HomePrimary=${teamPrimary[rawHome]}, AwayPrimary=${teamPrimary[rawAway]}`;
            anomalies.push(game);
        } else {
            games.push(game);
        }
    }

    const headers = [
        "competition", "year", "phase", "date", "away_team", "home_team",
        "away_score", "home_score", "venue", "notes", "away_coach", "home_coach",
        "is_double_header", "date_precision", "date_display", "time", "status",
        "confidence_level", "is_playoff", "is_title_game", "final_type",
        "title_name", "playoff_round", "parent_phase"
    ];

    fs.writeFileSync(outputPath, toCSV(games, headers), 'utf8');

    if (anomalies.length > 0) {
        const anomalyPath = outputPath.replace('.csv', '_anomalies.csv');
        fs.writeFileSync(anomalyPath, toCSV(anomalies, headers), 'utf8');
        console.log(`  [Integrity] Quarantined ${anomalies.length} anomalous games to ${anomalyPath}`);
    }

    console.log(`Successfully parsed ${games.length} clean games. Saved to ${outputPath}`);

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
const year = process.argv[4] || '2018';
transformData(input, output, year);
