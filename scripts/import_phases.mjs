import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables. Please check .env.local");
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

async function importPhases(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true
    });

    const isDryRun = process.argv.includes('--dry-run');
    if (isDryRun) console.log('--- DRY RUN: No changes will be saved ---\n');

    let created = 0;
    let skipped = 0;

    // We use a map to keep track of inserted phase IDs within this run to handle nesting
    const phaseCache = new Map(); // Key: "competition|year|phase_name", Value: ID

    const slugify = (text) => text.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

    for (const record of records) {
        const { competition_name, year, phase_name, type, parent_phase, confidence_level, ordinal } = record;

        if (!competition_name || !year || !phase_name) {
            console.warn(`[Warning] Skipping record with missing required fields:`, record);
            skipped++;
            continue;
        }

        // 1. Resolve Competition
        const compSlug = slugify(competition_name);
        const { data: comp } = await supabase
            .from('competitions')
            .select('id')
            .or(`slug.eq.${compSlug},name.eq."${competition_name.trim()}"`)
            .maybeSingle();

        if (!comp) {
            console.warn(`  [Skip] Competition "${competition_name}" not found.`);
            skipped++;
            continue;
        }

        // 2. Resolve Season
        const { data: season } = await supabase
            .from('seasons')
            .select('id')
            .eq('competition_id', comp.id)
            .eq('year', parseInt(year))
            .maybeSingle();

        if (!season) {
            console.warn(`  [Skip] Season ${year} for ${competition_name} not found.`);
            skipped++;
            continue;
        }

        // 3. Resolve Parent ID if applicable
        let parentId = null;
        if (parent_phase) {
            const cacheKey = `${competition_name}|${year}|${parent_phase}`;
            if (phaseCache.has(cacheKey)) {
                parentId = phaseCache.get(cacheKey);
            } else {
                // Try looking up in DB if not in current run cache
                const { data: existingParents } = await supabase
                    .from('phases')
                    .select('id')
                    .eq('season_id', season.id)
                    .eq('name', parent_phase)
                    .order('created_at', { ascending: true })
                    .limit(1);

                if (existingParents && existingParents.length > 0) {
                    parentId = existingParents[0].id;
                    phaseCache.set(cacheKey, parentId);
                } else {
                    console.warn(`  [Skip] Parent phase "${parent_phase}" not found for "${phase_name}". Skipping phase creation.`);
                    skipped++;
                    continue;
                }
            }
        }

        // 4. Upsert Phase
        const phaseData = {
            season_id: season.id,
            parent_phase_id: parentId,
            name: phase_name,
            type: type || null,
            confidence_level: confidence_level || 'high',
            ordinal: ordinal ? parseInt(ordinal) : null
        };

        if (isDryRun) {
            console.log(`  [Dry Run] Would upsert phase: ${phase_name} (${type || 'No Type'})`);
            // Add a fake ID to cache for dry run nesting simulation
            phaseCache.set(`${competition_name}|${year}|${phase_name}`, `dry-run-${phase_name}`);
            created++;
        } else {
            // Check if exists
            let query = supabase
                .from('phases')
                .select('id')
                .eq('season_id', season.id)
                .eq('name', phase_name);

            if (parentId) {
                query = query.eq('parent_phase_id', parentId);
            } else {
                query = query.is('parent_phase_id', null);
            }

            const { data: existingPhases } = await query.order('created_at', { ascending: true }).limit(1);

            if (existingPhases && existingPhases.length > 0) {
                const existingPhase = existingPhases[0];
                const { error } = await supabase
                    .from('phases')
                    .update(phaseData)
                    .eq('id', existingPhase.id);

                if (error) {
                    console.error(`  [Error] Failed to update ${phase_name}:`, error.message);
                    skipped++;
                } else {
                    console.log(`  [Updated] ${phase_name} updated.`);
                    await ensureSampleNote('phases', existingPhase.id);
                    phaseCache.set(`${competition_name}|${year}|${phase_name}|${parentId || 'root'}`, existingPhase.id);
                    created++;
                }
            } else {
                const { data: inserted, error } = await supabase
                    .from('phases')
                    .insert(phaseData)
                    .select()
                    .single();

                if (error) {
                    console.error(`  [Error] Failed to create ${phase_name}:`, error.message);
                    skipped++;
                } else {
                    console.log(`  [Created] ${phase_name} created.`);
                    await ensureSampleNote('phases', inserted.id);
                    phaseCache.set(`${competition_name}|${year}|${phase_name}|${parentId || 'root'}`, inserted.id);
                    created++;
                }
            }
        }
    }

    console.log(`\n--- Phase Import Finished ---`);
    console.log(`  Processed: ${created} | Skipped: ${skipped}`);
}

const filePath = process.argv.filter(arg => !arg.startsWith('--'))[2];
if (!filePath) {
    console.error('Usage: node scripts/import_phases.mjs <path-to-csv> [--dry-run] [--sample]');
    process.exit(1);
}

importPhases(filePath).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
