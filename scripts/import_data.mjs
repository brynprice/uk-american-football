/**
 * UK American Football Archive - Data Import Script
 * 
 * This script imports historical game data from a CSV file into Supabase.
 * It automatically handles the creation of competitions, seasons, phases, and teams.
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

// Use Service Role Key if available (bypasses RLS), otherwise fallback to Anon Key
const supabaseKey = supabaseServiceKey || supabaseAnonKey;

console.log("--- Env Diagnostic ---");
console.log("SUPABASE_URL found:", !!supabaseUrl);
console.log("ANON_KEY found:", !!supabaseAnonKey);
console.log("SERVICE_ROLE_KEY found:", !!supabaseServiceKey);
console.log("Detected Keys:", Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('KEY')));
console.log("----------------------");

if (!supabaseUrl || !supabaseKey) {
    console.error("CRITICAL: Missing SUPABASE_URL or a valid KEY in .env.local");
    console.log("Your .env.local currently has:", Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('KEY')));
    process.exit(1);
}

if (supabaseServiceKey) {
    console.log("--- [✓] Using Service Role Key (RLS Bypassed) ---");
} else {
    console.warn("--- [!] Warning: Using ANONYMOUS key. Import will likely fail due to RLS. ---");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- UTILS ---

const slugify = (text) => text.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

async function getOrCreateCompetition(name, level = 'Senior') {
    const slug = slugify(name);
    const { data, error } = await supabase
        .from('competitions')
        .select('id')
        .eq('slug', slug)
        .single();

    if (data) return data.id;

    const { data: newData, error: insertError } = await supabase
        .from('competitions')
        .insert({ name, slug, level })
        .select('id')
        .single();

    if (insertError) throw insertError;
    return newData.id;
}

async function getOrCreateSeason(competitionId, year) {
    const { data, error } = await supabase
        .from('seasons')
        .select('id')
        .eq('competition_id', competitionId)
        .eq('year', parseInt(year))
        .single();

    if (data) return data.id;

    const { data: newData, error: insertError } = await supabase
        .from('seasons')
        .insert({
            competition_id: competitionId,
            year: parseInt(year),
            name: `${year} Season`
        })
        .select('id')
        .single();

    if (insertError) throw insertError;
    return newData.id;
}

async function getOrCreatePhase(seasonId, name) {
    const { data, error } = await supabase
        .from('phases')
        .select('id')
        .eq('season_id', seasonId)
        .eq('name', name)
        .single();

    if (data) return data.id;

    const { data: newData, error: insertError } = await supabase
        .from('phases')
        .insert({ season_id: seasonId, name, type: 'division' })
        .select('id')
        .single();

    if (insertError) throw insertError;
    return newData.id;
}

async function getOrCreateTeam(name) {
    const { data, error } = await supabase
        .from('teams')
        .select('id')
        .eq('name', name)
        .single();

    if (data) return data.id;

    const { data: newData, error: insertError } = await supabase
        .from('teams')
        .insert({ name })
        .select('id')
        .single();

    if (insertError) throw insertError;
    return newData.id;
}

async function getOrCreatePerson(displayName) {
    if (!displayName) return null;

    // Naivety assumption: first word is first name, rest is last name
    const parts = displayName.trim().split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    const { data, error } = await supabase
        .from('people')
        .select('id')
        .eq('display_name', displayName.trim())
        .single();

    if (data) return data.id;

    const { data: newData, error: insertError } = await supabase
        .from('people')
        .insert({
            display_name: displayName.trim(),
            first_name: firstName || null,
            last_name: lastName || null
        })
        .select('id')
        .single();

    if (insertError) throw insertError;
    return newData.id;
}

async function ensureParticipation(phaseId, teamId, coachId = null) {
    const { data: existing, error: findError } = await supabase
        .from('participations')
        .select('id')
        .eq('phase_id', phaseId)
        .eq('team_id', teamId)
        .single();

    // Ignore error 406 (Not Acceptable) which might happen if multiple results or 0 results
    if (existing) {
        // Optionally update coach if it was null before? Skip for now to let manual DB take precedence.
        return existing.id;
    }

    const { data: newData, error: insertError } = await supabase
        .from('participations')
        .insert({
            phase_id: phaseId,
            team_id: teamId,
            head_coach_id: coachId
        })
        .select('id')
        .single();

    if (insertError) {
        // If there was a race condition or constraint violation, try to ignore
        if (insertError.code === '23505') return null; // unique violation
        throw insertError;
    }
    return newData.id;
}

// --- MAIN ---

async function importData(filePath) {
    const input = fs.readFileSync(filePath);
    const records = parse(input, {
        columns: true,
        skip_empty_lines: true
    });

    console.log(`--- Starting Import of ${records.length} records ---`);

    for (const record of records) {
        try {
            const {
                competition,
                year,
                phase,
                date,
                away_team,
                home_team,
                away_score,
                home_score,
                venue,
                notes,
                away_coach,
                home_coach
            } = record;

            console.log(`Processing: ${year} ${competition} - ${away_team} @ ${home_team}`);

            // 1. Resolve Parents
            const competitionId = await getOrCreateCompetition(competition);
            const seasonId = await getOrCreateSeason(competitionId, year);
            const phaseId = await getOrCreatePhase(seasonId, phase || 'Regular Season');

            // 2. Resolve Teams
            const homeTeamId = await getOrCreateTeam(home_team);
            const awayTeamId = await getOrCreateTeam(away_team);

            // 3. Resolve Coaches
            const homeCoachId = await getOrCreatePerson(home_coach);
            const awayCoachId = await getOrCreatePerson(away_coach);

            // 4. Ensure Participations (For Standings)
            await ensureParticipation(phaseId, homeTeamId, homeCoachId);
            await ensureParticipation(phaseId, awayTeamId, awayCoachId);

            // 5. Create Game
            const { data: gameData, error: gameError } = await supabase
                .from('games')
                .insert({
                    phase_id: phaseId,
                    home_team_id: homeTeamId,
                    away_team_id: awayTeamId,
                    home_score: home_score ? parseInt(home_score) : null,
                    away_score: away_score ? parseInt(away_score) : null,
                    date: date || null,
                    notes: notes || null,
                    status: 'completed'
                })
                .select('id')
                .single();

            if (gameError) {
                // If it's a duplicate or other error, log it but continue
                console.warn(`  [Warning] Could not insert game: ${gameError.message}`);
            } else {
                console.log(`  [Success] Game recorded.`);

                // 6. Link Coaches to Game
                if (homeCoachId) {
                    await supabase.from('game_staff').insert({
                        game_id: gameData.id,
                        team_id: homeTeamId,
                        person_id: homeCoachId,
                        role: 'head_coach'
                    });
                }

                if (awayCoachId) {
                    await supabase.from('game_staff').insert({
                        game_id: gameData.id,
                        team_id: awayTeamId,
                        person_id: awayCoachId,
                        role: 'head_coach'
                    });
                }
            }

        } catch (err) {
            console.error(`  [Error] Failed to process record:`, err.message);
        }
    }

    console.log("--- Import Finished ---");
}

const fileArg = process.argv[2];
if (!fileArg) {
    console.log("Usage: node scripts/import_data.mjs <path_to_csv>");
} else {
    importData(fileArg);
}
