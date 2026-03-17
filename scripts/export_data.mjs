/**
 * UK American Football Archive - Data Export Script
 * 
 * Extracts game data from Supabase and outputs a CSV matching the structure 
 * expected by import_data.mjs
 */

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("CRITICAL: Missing SUPABASE_URL or a valid KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

async function exportData(outputPath) {
    console.log("--- Starting Data Export ---");

    // 1. Fetch all games with their relationships
    console.log("Fetching games...");
    let allGames = [];
    let from = 0;
    const limit = 1000;

    while (true) {
        process.stdout.write(`  Fetching games ${from} to ${from + limit - 1}... `);
        const { data: games, error } = await supabase
            .from('games')
            .select(`
                id,
                date,
                date_precision,
                date_display,
                time,
                home_score,
                away_score,
                status,
                confidence_level,
                is_playoff,
                final_type,
                title_name,
                playoff_round,
                is_double_header,
                notes,
                home_team_id,
                away_team_id,
                phase_id,
                away_phase_id,
                venue:venues(name),
                home_team:teams!home_team_id(name),
                away_team:teams!away_team_id(name),
                phase:phases!games_phase_id_fkey(
                    id,
                    name,
                    parent:phases(name),
                    season:seasons(
                        year,
                        competition:competitions(name)
                    )
                ),
                away_phase:phases!away_phase_id(
                    name,
                    parent:phases(name)
                ),
                game_staff(
                    role,
                    team_id,
                    person:people(display_name)
                )
            `)
            .range(from, from + limit - 1)
            .order('date', { ascending: true });

        if (error) {
            console.error("Error fetching games:", error);
            process.exit(1);
        }

        console.log(`Retrieved ${games.length}`);
        if (!games || games.length === 0) {
            break;
        }

        allGames = allGames.concat(games);
        from += limit;
        if (games.length < limit) break;
    }

    console.log(`Total games fetched: ${allGames.length}`);

    // 2. Fetch all participations to get season/phase level head coaches fallback
    console.log("Fetching participations for default coach mapping...");
    let allParticipations = [];
    let pFrom = 0;
    while (true) {
        const { data: participations, error: pError } = await supabase
            .from('participations')
            .select(`
                phase_id,
                team_id,
                head_coach:people!head_coach_id(display_name)
            `)
            .range(pFrom, pFrom + limit - 1);

        if (pError) {
            console.error("Error fetching participations:", pError);
            break;
        }
        if (!participations || participations.length === 0) break;
        allParticipations = allParticipations.concat(participations);
        pFrom += limit;
        if (participations.length < limit) break;
    }

    // Map: phase_id + team_id -> display_name
    const coachMap = {};
    for (const p of allParticipations) {
        if (p.head_coach) {
            coachMap[`${p.phase_id}_${p.team_id}`] = p.head_coach.display_name;
        }
    }

    // 3. Transform to CSV rows
    console.log("Transforming data to CSV format...");

    const headers = [
        "competition", "year", "phase", "parent_phase", "away_phase", "away_parent_phase",
        "date", "away_team", "home_team",
        "away_score", "home_score", "venue", "notes", "away_coach", "home_coach",
        "is_double_header", "date_precision", "date_display", "time", "status",
        "confidence_level", "is_playoff", "is_title_game", "final_type",
        "title_name", "playoff_round"
    ];

    const csvData = allGames.map(game => {
        // Safe access relationships
        const phase = game.phase || {};
        const season = phase.season || {};
        const competition = season.competition || {};
        const parentPhase = phase.parent || {};
        const awayPhase = game.away_phase || {};
        const awayParentPhase = awayPhase.parent || {};

        // Head coach default (from participations)
        // For inter-phase games, the away team's coach is in their own phase
        let homeCoach = coachMap[`${game.phase_id}_${game.home_team_id}`] || "";
        let awayCoach = coachMap[`${game.away_phase_id || game.phase_id}_${game.away_team_id}`] || "";

        // Override with game staff if present (role = head_coach)
        if (game.game_staff && game.game_staff.length > 0) {
            for (const staff of game.game_staff) {
                if (staff.role === 'head_coach' && staff.person) {
                    if (staff.team_id === game.home_team_id) {
                        homeCoach = staff.person.display_name;
                    }
                    if (staff.team_id === game.away_team_id) {
                        awayCoach = staff.person.display_name;
                    }
                }
            }
        }

        // is_title_game is either final_type = title or true
        const isTitleGame = game.final_type === 'title' ? "true" : "false";

        return {
            competition: competition.name || "",
            year: season.year || "",
            phase: phase.name || "Regular Season",
            parent_phase: parentPhase.name || "",
            away_phase: awayPhase.name || "",
            away_parent_phase: awayParentPhase.name || "",
            date: game.date || "",
            away_team: game.away_team?.name || "",
            home_team: game.home_team?.name || "",
            away_score: game.away_score !== null ? game.away_score : "",
            home_score: game.home_score !== null ? game.home_score : "",
            venue: game.venue?.name || "",
            notes: game.notes || "",
            away_coach: awayCoach,
            home_coach: homeCoach,
            is_double_header: game.is_double_header ? "true" : "false",
            date_precision: game.date_precision || "",
            date_display: game.date_display || "",
            time: game.time || "",
            status: game.status || "",
            confidence_level: game.confidence_level || "",
            is_playoff: game.is_playoff ? "true" : "false",
            is_title_game: isTitleGame,
            final_type: game.final_type || "",
            title_name: game.title_name || "",
            playoff_round: game.playoff_round || "",
            parent_phase: parentPhase.name || ""
        };
    });

    // 4. Write CSV
    const csvString = toCSV(csvData, headers);
    fs.writeFileSync(outputPath, csvString, 'utf8');
    console.log(`--- Exported ${csvData.length} records to ${outputPath} ---`);
}

const outputFile = process.argv[2] || 'exported_games.csv';
exportData(outputFile).catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
