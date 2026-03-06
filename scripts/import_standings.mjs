/**
 * UK American Football Archive - Standings Import Script
 *
 * Imports final standings (wins, losses, ties, points) for team participations.
 * Requires that participations already exist (use import_participations.mjs first).
 *
 * CSV Columns Required: competition_name, year, team, wins, losses, ties, points_for, points_against
 * Optional: phase (defaults to "Regular Season")
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

async function importStandings(filePath) {
    const fileContent = fs.readFileSync(filePath);
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true
    });

    console.log(`--- Importing Standings for ${records.length} Teams ---`);

    let updated = 0, skipped = 0;

    for (const record of records) {
        const { competition_name, year, phase, team, wins, losses, ties, points_for, points_against } = record;

        if (!competition_name || !year || !team) {
            console.warn(`[Warning] Skipping record with missing competition, year, or team:`, record);
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
        let teamId = null;
        const { data: teamRecord } = await supabase
            .from('teams')
            .select('id')
            .eq('name', teamName)
            .maybeSingle();

        if (teamRecord) {
            teamId = teamRecord.id;
        } else {
            const { data: aliasRecord } = await supabase
                .from('team_aliases')
                .select('team_id')
                .eq('name', teamName)
                .maybeSingle();
            if (aliasRecord) teamId = aliasRecord.team_id;
        }

        if (!teamId) {
            console.warn(`  [Skip] Team "${teamName}" not found.`);
            skipped++;
            continue;
        }

        // 5. Update or Create participation record
        const stats = {
            wins: wins !== undefined && wins !== "" ? parseInt(wins) : null,
            losses: losses !== undefined && losses !== "" ? parseInt(losses) : null,
            ties: ties !== undefined && ties !== "" ? parseInt(ties) : null,
            points_for: points_for !== undefined && points_for !== "" ? parseInt(points_for) : null,
            points_against: points_against !== undefined && points_against !== "" ? parseInt(points_against) : null
        };

        const { data: existing } = await supabase
            .from('participations')
            .select('id')
            .eq('phase_id', phaseRecord.id)
            .eq('team_id', teamId)
            .maybeSingle();

        if (existing) {
            const { error: updateError } = await supabase
                .from('participations')
                .update(stats)
                .eq('id', existing.id);

            if (updateError) {
                console.error(`  [Error] Failed to update standings for ${teamName}: ${updateError.message}`);
                skipped++;
            } else {
                console.log(`  [Updated] ${teamName} standings updated.`);
                await ensureSampleNote('participations', existing.id);
                updated++;
            }
        } else {
            const { data, error: insertError } = await supabase
                .from('participations')
                .insert({
                    phase_id: phaseRecord.id,
                    team_id: teamId,
                    ...stats
                }).select('id').single();

            if (!insertError && data) {
                await ensureSampleNote('participations', data.id);
            }

            if (insertError) {
                console.error(`  [Error] Failed to create participation and standings for ${teamName}: ${insertError.message}`);
                skipped++;
            } else {
                console.log(`  [Created] ${teamName} participation and standings created.`);
                updated++;
            }
        }
    }

    console.log(`\n--- Standing Import Finished ---`);
    console.log(`  Updated: ${updated} | Skipped: ${skipped}`);
}

const fileArg = process.argv.filter(arg => !arg.startsWith('--'))[2];
if (!fileArg) {
    console.log("Usage: node scripts/import_standings.mjs <path_to_csv> [--sample]");
} else {
    importStandings(fileArg);
}
