/**
 * UK American Football Archive - Participation Import Script
 *
 * Imports team participation records (team + head coach for a given season/phase).
 * Requires that competitions, seasons, phases, and teams already exist.
 * Will create people records if head coach is not found.
 *
 * CSV Columns Required: competition_name, year, team
 * Optional: phase (defaults to "Regular Season"), head_coach
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const slugify = (text) => text.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const supabaseKey = supabaseServiceKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
    console.error("CRITICAL: Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

if (supabaseServiceKey) {
    console.log("--- [✓] Using Service Role Key (RLS Bypassed) ---");
} else {
    console.warn("--- [!] Warning: Using ANONYMOUS key. Import will likely fail due to RLS. ---");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getOrCreatePerson(displayName) {
    if (!displayName) return null;

    const trimmed = displayName.trim();
    const parts = trimmed.split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    const { data, error } = await supabase
        .from('people')
        .select('id')
        .eq('display_name', trimmed)
        .maybeSingle();

    if (data) return data.id;

    console.log(`  [Info] Creating new person record: "${trimmed}"`);
    const { data: newData, error: insertError } = await supabase
        .from('people')
        .insert({
            display_name: trimmed,
            first_name: firstName || null,
            last_name: lastName || null
        })
        .select('id')
        .single();

    if (insertError) throw insertError;
    return newData.id;
}

async function importParticipations(filePath) {
    const input = fs.readFileSync(filePath);
    const records = parse(input, {
        columns: true,
        skip_empty_lines: true,
        bom: true
    });

    console.log(`--- Importing ${records.length} Participations ---`);

    let created = 0, updated = 0, skipped = 0;

    for (const record of records) {
        const { competition_name, year, phase, team, head_coach } = record;

        if (!competition_name || !year || !team) {
            console.warn(`[Warning] Skipping record with missing competition_name, year, or team:`, record);
            skipped++;
            continue;
        }

        const cleanName = competition_name.trim();
        const cleanYear = parseInt(year);
        const phaseName = (phase || 'Regular Season').trim();
        const teamName = team.trim();

        // 1. Find competition
        const compSlug = slugify(cleanName);
        const { data: comp } = await supabase
            .from('competitions')
            .select('id')
            .or(`slug.eq.${compSlug},name.eq."${cleanName}"`)
            .maybeSingle();

        if (!comp) {
            console.warn(`  [Skip] Competition "${cleanName}" not found.`);
            skipped++;
            continue;
        }

        // 2. Find season
        const { data: season } = await supabase
            .from('seasons')
            .select('id')
            .eq('competition_id', comp.id)
            .eq('year', cleanYear)
            .maybeSingle();

        if (!season) {
            console.warn(`  [Skip] Season ${cleanYear} for "${cleanName}" not found.`);
            skipped++;
            continue;
        }

        // 3. Find phase
        const { data: phaseRecord } = await supabase
            .from('phases')
            .select('id')
            .eq('season_id', season.id)
            .eq('name', phaseName)
            .maybeSingle();

        if (!phaseRecord) {
            console.warn(`  [Skip] Phase "${phaseName}" not found in ${cleanYear} ${cleanName}.`);
            skipped++;
            continue;
        }

        // 4. Find team
        const { data: teamRecord } = await supabase
            .from('teams')
            .select('id')
            .eq('name', teamName)
            .maybeSingle();

        if (!teamRecord) {
            console.warn(`  [Skip] Team "${teamName}" not found.`);
            skipped++;
            continue;
        }

        // 5. Resolve head coach (create if not found)
        const coachId = await getOrCreatePerson(head_coach);

        // 6. Check for existing participation
        const { data: existing } = await supabase
            .from('participations')
            .select('id')
            .eq('phase_id', phaseRecord.id)
            .eq('team_id', teamRecord.id)
            .maybeSingle();

        if (existing) {
            // Update with coach if provided
            if (coachId) {
                await supabase.from('participations')
                    .update({ head_coach_id: coachId })
                    .eq('id', existing.id);
            }
            console.log(`  [Updated] ${teamName} in ${cleanYear} ${cleanName} - ${phaseName}`);
            updated++;
        } else {
            const { error: insertError } = await supabase
                .from('participations')
                .insert({
                    phase_id: phaseRecord.id,
                    team_id: teamRecord.id,
                    head_coach_id: coachId
                });

            if (insertError) {
                console.error(`  [Error] Failed to create participation: ${insertError.message}`);
                skipped++;
                continue;
            }
            console.log(`  [Created] ${teamName} in ${cleanYear} ${cleanName} - ${phaseName}`);
            created++;
        }
    }

    console.log(`\n--- Participation Import Finished ---`);
    console.log(`  Created: ${created} | Updated: ${updated} | Skipped: ${skipped}`);
}

const fileArg = process.argv[2];
if (!fileArg) {
    console.log("Usage: node scripts/import_participations.mjs <path_to_csv>");
} else {
    importParticipations(fileArg);
}
