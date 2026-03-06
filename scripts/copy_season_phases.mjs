/**
 * UK American Football Archive - Season Phase Copy Utility
 * 
 * Copies the entire phase structure from a source season to a target season.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const supabaseKey = supabaseServiceKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
    console.error("CRITICAL: Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function copySeasonPhases() {
    const args = process.argv.slice(2);
    const compName = args[0];
    const sourceYear = args[1];
    const targetYear = args[2];
    const force = args.includes('--force');

    if (!compName || !sourceYear || !targetYear) {
        console.log("Usage: node scripts/copy_season_phases.mjs <competition_name> <source_year> <target_year> [--force]");
        console.log("Example: node scripts/copy_season_phases.mjs \"BUAFL\" 2024 2023");
        return;
    }

    console.log(`--- Copying Phase Structure for "${compName}" ---`);
    console.log(`Source: ${sourceYear} -> Target: ${targetYear}`);

    // 1. Resolve Competition
    const { data: comp, error: compError } = await supabase
        .from('competitions')
        .select('id')
        .eq('name', compName)
        .maybeSingle();

    if (compError) throw compError;
    if (!comp) {
        console.error(`Error: Competition "${compName}" not found.`);
        return;
    }

    // 2. Resolve Source Season
    const { data: sourceSeason, error: sourceError } = await supabase
        .from('seasons')
        .select('id')
        .eq('competition_id', comp.id)
        .eq('year', parseInt(sourceYear))
        .maybeSingle();

    if (sourceError) throw sourceError;
    if (!sourceSeason) {
        console.error(`Error: Source season ${sourceYear} not found for "${compName}".`);
        return;
    }

    // 3. Resolve Target Season
    let { data: targetSeason, error: targetError } = await supabase
        .from('seasons')
        .select('id')
        .eq('competition_id', comp.id)
        .eq('year', parseInt(targetYear))
        .maybeSingle();

    if (targetError) throw targetError;
    if (!targetSeason) {
        console.log(`  [Info] Creating target season ${targetYear}...`);
        const { data: newSeason, error: createError } = await supabase
            .from('seasons')
            .insert({ competition_id: comp.id, year: parseInt(targetYear) })
            .select('id')
            .single();
        if (createError) throw createError;
        targetSeason = newSeason;
    }

    // 4. Check if target season already has phases
    const { count, error: countError } = await supabase
        .from('phases')
        .select('*', { count: 'exact', head: true })
        .eq('season_id', targetSeason.id);

    if (countError) throw countError;
    if (count > 0 && !force) {
        console.error(`Error: Target season ${targetYear} already has ${count} phases. Use --force to proceed.`);
        return;
    }

    // 5. Fetch all source phases
    const { data: sourcePhases, error: phasesError } = await supabase
        .from('phases')
        .select('*')
        .eq('season_id', sourceSeason.id);

    if (phasesError) throw phasesError;
    if (!sourcePhases || sourcePhases.length === 0) {
        console.warn("Source season has no phases to copy.");
        return;
    }

    console.log(`  [Info] Found ${sourcePhases.length} phases to copy.`);

    // 6. Map and Create Phases
    const idMap = new Map(); // old_id -> new_id

    // Helper to recursively copy
    async function copyTree(parentId = null, newParentId = null) {
        const children = sourcePhases.filter(p => p.parent_phase_id === parentId);

        // Sort by ordinal to keep order clean
        children.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));

        for (const phase of children) {
            console.log(`  [+][${newParentId ? 'Child' : 'Root'}] Copying "${phase.name}"...`);

            const { data: newPhase, error: insertError } = await supabase
                .from('phases')
                .insert({
                    season_id: targetSeason.id,
                    parent_phase_id: newParentId,
                    name: phase.name,
                    type: phase.type,
                    ordinal: phase.ordinal,
                    confidence_level: phase.confidence_level
                })
                .select('id')
                .single();

            if (insertError) {
                console.error(`    [Error] Failed to copy phase "${phase.name}":`, insertError.message);
                continue;
            }

            idMap.set(phase.id, newPhase.id);

            // Recurse
            await copyTree(phase.id, newPhase.id);
        }
    }

    await copyTree();

    console.log(`--- Finished! Copied ${idMap.size} phases ---`);
}

copySeasonPhases().catch(err => {
    console.error("FATAL ERROR:", err.message);
    process.exit(1);
});
