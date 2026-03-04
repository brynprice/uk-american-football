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
                notes
            } = record;

            console.log(`Processing: ${year} ${competition} - ${away_team} @ ${home_team}`);

            // 1. Resolve Parents
            const competitionId = await getOrCreateCompetition(competition);
            const seasonId = await getOrCreateSeason(competitionId, year);
            const phaseId = await getOrCreatePhase(seasonId, phase || 'Regular Season');

            // 2. Resolve Teams
            const homeTeamId = await getOrCreateTeam(home_team);
            const awayTeamId = await getOrCreateTeam(away_team);

            // 3. Create Game
            const { error: gameError } = await supabase
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
                });

            if (gameError) {
                // If it's a duplicate or other error, log it but continue
                console.warn(`  [Warning] Could not insert game: ${gameError.message}`);
            } else {
                console.log(`  [Success] Game recorded.`);
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
