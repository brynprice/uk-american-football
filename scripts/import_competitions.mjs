/**
 * UK American Football Archive - Competition Import Script
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

if (!supabaseUrl || !supabaseKey) {
    console.error("CRITICAL: Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const isSample = process.argv.includes('--sample');

const slugify = (text) => text.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

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

async function importCompetitions(filePath) {
    const input = fs.readFileSync(filePath);
    const records = parse(input, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true
    });

    console.log(`--- Importing ${records.length} Competitions ---`);

    for (const record of records) {
        const { name, level, description } = record;

        if (!name) {
            console.warn(`[Warning] Skipping record with missing name:`, record);
            continue;
        }

        const cleanName = name.trim();
        const slug = slugify(cleanName);

        const { data: existing } = await supabase
            .from('competitions')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();

        if (existing) {
            console.log(`[Info] Updating ${cleanName}...`);
            await supabase.from('competitions').update({
                name: cleanName,
                level: level || 'Senior',
                description: description || null
            }).eq('id', existing.id);
            await ensureSampleNote('competitions', existing.id);
        } else {
            console.log(`[Success] Creating ${cleanName}...`);
            const { data: newData, error: insertError } = await supabase.from('competitions').insert({
                name: cleanName,
                slug,
                level: level || 'Senior',
                description: description || null
            }).select('id').single();

            if (!insertError && newData) {
                await ensureSampleNote('competitions', newData.id);
            }
        }
    }
    console.log("--- Competition Import Finished ---");
}

const fileArg = process.argv.filter(arg => !arg.startsWith('--'))[2];
if (!fileArg) {
    console.log("Usage: node scripts/import_competitions.mjs <path_to_csv> [--sample]");
} else {
    importCompetitions(fileArg);
}
