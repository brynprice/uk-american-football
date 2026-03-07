/**
 * UK American Football Archive - Season Import Script
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

// Use Service Role Key if available (bypasses RLS), otherwise fallback to Anon Key
const supabaseKey = supabaseServiceKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
    console.error("CRITICAL: Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const isSample = process.argv.includes('--sample');

async function ensureSampleNote(entityType, entityId) {
    if (!isSample || !entityId) return;

    // Check if sample note already exists for this entity
    const { data: existing } = await supabase
        .from('notes')
        .select('id')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('content', 'sample')
        .maybeSingle();

    if (!existing) {
        await supabase.from('notes').insert({
            entity_type: entityType,
            entity_id: entityId,
            content: 'sample'
        });
        console.log(`    [Note] Tagged ${entityType} ${entityId} as sample.`);
    }
}

async function importSeasons(filePath) {
    const input = fs.readFileSync(filePath);
    const records = parse(input, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true
    });

    console.log(`--- Importing ${records.length} Seasons ---`);

    for (const record of records) {
        const { competition_name, year, season_name, start_date, end_date, confidence_level, expected_participants } = record;

        if (!competition_name || !year) {
            console.warn(`[Warning] Skipping record with missing competition or year:`, record);
            continue;
        }

        // 1. Resolve Competition ID
        const compSlug = slugify(competition_name);
        const { data: comp } = await supabase
            .from('competitions')
            .select('id')
            .or(`slug.eq.${compSlug},name.eq."${competition_name.trim()}"`)
            .maybeSingle();

        if (!comp) {
            console.warn(`[Warning] Competition "${competition_name}" not found. Skipping season.`);
            continue;
        }

        const cleanYear = parseInt(year);

        // 2. Check for existing season
        const { data: existing } = await supabase
            .from('seasons')
            .select('id')
            .eq('competition_id', comp.id)
            .eq('year', cleanYear)
            .maybeSingle();

        const seasonPayload = {
            competition_id: comp.id,
            year: cleanYear,
            name: season_name || `${cleanYear} Season`,
            start_date: start_date || null,
            end_date: end_date || null,
            confidence_level: confidence_level || 'high',
            expected_participants: expected_participants ? parseInt(expected_participants) : null
        };

        if (existing) {
            console.log(`[Info] Updating ${competition_name} ${cleanYear}...`);
            await supabase.from('seasons').update(seasonPayload).eq('id', existing.id);
            await ensureSampleNote('seasons', existing.id);
        } else {
            console.log(`[Success] Creating ${competition_name} ${cleanYear}...`);
            const { data: newData, error: insertError } = await supabase.from('seasons').insert(seasonPayload).select('id').single();
            if (!insertError && newData) {
                await ensureSampleNote('seasons', newData.id);
            }
        }
    }
    console.log("--- Season Import Finished ---");
}

const fileArg = process.argv.filter(arg => !arg.startsWith('--'))[2];
if (!fileArg) {
    console.log("Usage: node scripts/import_seasons.mjs <path_to_csv> [--sample]");
} else {
    importSeasons(fileArg);
}
