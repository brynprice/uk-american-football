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
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import dotenv from 'dotenv';
import { run as calculateCompleteness } from './calculate_completeness.mjs';

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

function resolveExpectedTeamType(compLevel, compName = '') {
    const lvl = (compLevel || '').trim().toLowerCase();
    const cname = (compName || '').trim().toLowerCase();
    if (lvl === 'womens' || lvl === 'women' || cname.includes('nwfl') || cname.includes('sapphire') || cname.includes('women')) {
        return 'Womens';
    }
    if (lvl === 'uniball' || lvl === 'university' || cname.includes('buafl') || cname.includes('bucs') || cname.includes('bcafl')) {
        return 'University';
    }
    if (lvl === 'flag' || cname.includes('flag') || cname.includes('opal')) {
        return 'Flag';
    }
    if (lvl === 'u19s' || lvl === 'youth' || cname.includes('u19') || cname.includes('youth')) {
        return 'U19s';
    }
    if (lvl === 'adult contact' || lvl === 'adult' || lvl === 'senior' || cname.includes('bafanl') || cname.includes('bafl') || cname.includes('bigc') || cname.includes('sga')) {
        return 'Adult';
    }
    return null;
}

async function getTeam(name, year = null, expectedTeamType = null) {
    if (!name) return null;
    let cleanName = name.trim();
    if (expectedTeamType === 'University' && (
        cleanName.toLowerCase() === 'aberdeen roughnecks' ||
        cleanName.toLowerCase() === 'aberdeen bulls' ||
        cleanName.toLowerCase() === 'aberdeen' ||
        cleanName.toLowerCase() === 'aberdeen open 1' ||
        cleanName.toLowerCase() === 'aberdeen mixed 1' ||
        cleanName.toLowerCase() === 'aberdeen university' ||
        cleanName.toLowerCase() === 'university of aberdeen' ||
        cleanName.toLowerCase() === 'aberdeen university roughnecks'
    )) {
        cleanName = 'Aberdeen Roughnecks University Team';
    }
    const numericYear = year ? parseInt(year, 10) : null;

    if (numericYear) {
        const { data: aliases } = await supabase
            .from('team_aliases')
            .select('team_id, start_year, end_year, teams!inner(team_type)')
            .eq('name', cleanName);

        if (aliases && aliases.length > 0) {
            const typeFilteredAliases = expectedTeamType
                ? aliases.filter(a => a.teams?.team_type === expectedTeamType)
                : aliases;

            const matchingAlias = typeFilteredAliases.find(a => {
                const start = a.start_year || 0;
                const end = a.end_year || 9999;
                return numericYear >= start && numericYear <= end;
            });
            if (matchingAlias) return matchingAlias.team_id;
        }

        const { data: primaryTeams } = await supabase
            .from('teams')
            .select('id, founded_year, folded_year, team_type')
            .eq('name', cleanName);

        if (primaryTeams && primaryTeams.length > 0) {
            const typeFilteredTeams = expectedTeamType
                ? primaryTeams.filter(t => t.team_type === expectedTeamType)
                : primaryTeams;

            if (typeFilteredTeams.length > 0) {
                const matchingTeam = typeFilteredTeams.find(t => {
                    const start = t.founded_year || 0;
                    const end = t.folded_year || 9999;
                    return numericYear >= start && numericYear <= end;
                }) || typeFilteredTeams[0];
                if (matchingTeam) return matchingTeam.id;
            }
        }
    }

    const { data: primaryData } = await supabase
        .from('teams')
        .select('id, team_type')
        .eq('name', cleanName);

    if (primaryData && primaryData.length > 0) {
        if (expectedTeamType) {
            const matched = primaryData.find(t => t.team_type === expectedTeamType);
            if (matched) return matched.id;
        } else {
            return primaryData[0].id;
        }
    }

    const { data: aliasData } = await supabase
        .from('team_aliases')
        .select('team_id, teams!inner(team_type)')
        .eq('name', cleanName);

    if (aliasData && aliasData.length > 0) {
        if (expectedTeamType) {
            const matchedAlias = aliasData.find(a => a.teams?.team_type === expectedTeamType);
            if (matchedAlias) return matchedAlias.team_id;
        } else {
            return aliasData[0].team_id;
        }
    }

    if (expectedTeamType) {
        const mismatchedTypes = [
            ...(primaryData || []).map(t => t.team_type),
            ...(aliasData || []).map(a => a.teams?.team_type)
        ].filter(Boolean);
        if (mismatchedTypes.length > 0) {
            console.error(`  [Validation Error] Team "${cleanName}" exists with team_type "${[...new Set(mismatchedTypes)].join('/')}", but competition requires team_type "${expectedTeamType}".`);
        }
    }

    return null;
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

    let count = 0;
    for (const record of records) {
        count++;
        const { competition_name, year, phase, parent_phase, team, wins, losses, ties, points_for, points_against, is_champion } = record;

        if (!competition_name || !year || !team) {
            console.warn(`[Warning] Skipping record with missing competition, year, or team:`, record);
            skipped++;
            continue;
        }

        console.log(`Standing ${count} out of ${records.length} imported`);

        const cleanName = competition_name.trim();
        const cleanYear = parseInt(year);
        const phaseName = (phase || 'Regular Season').trim();
        const teamName = team.trim();

        // 1. Find competition
        const compSlug = slugify(cleanName);
        const { data: comp } = await supabase
            .from('competitions')
            .select('id, level')
            .or(`slug.eq.${compSlug},name.eq."${cleanName}"`)
            .maybeSingle();

        if (!comp) {
            console.warn(`  [Skip] Competition "${cleanName}" not found.`);
            skipped++;
            continue;
        }
        const expectedTeamType = resolveExpectedTeamType(comp.level, cleanName);

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
        const { data: phaseRecords } = await supabase
            .from('phases')
            .select('id, parent_phase_id')
            .eq('season_id', season.id)
            .eq('name', phaseName);

        if (!phaseRecords || phaseRecords.length === 0) {
            console.warn(`  [Skip] Phase "${phaseName}" not found in ${cleanYear} ${cleanName}.`);
            skipped++;
            continue;
        }

        let finalPhaseId = phaseRecords[0].id;

        if (phaseRecords.length > 1) {
            if (!parent_phase) {
                console.warn(`  [Skip] Ambiguous phase "${phaseName}". Multiple found, but no 'parent_phase' provided in CSV to disambiguate.`);
                skipped++;
                continue;
            }

            const { data: parentRecord } = await supabase
                .from('phases')
                .select('id')
                .eq('season_id', season.id)
                .eq('name', parent_phase.trim())
                .maybeSingle();

            if (!parentRecord) {
                console.warn(`  [Skip] Ambiguous phase "${phaseName}". 'parent_phase' "${parent_phase}" not found in DB.`);
                skipped++;
                continue;
            }

            const matchedPhases = phaseRecords.filter(p => p.parent_phase_id === parentRecord.id);
            if (matchedPhases.length === 1) {
                finalPhaseId = matchedPhases[0].id;
            } else {
                console.warn(`  [Skip] Ambiguous phase "${phaseName}". Even with parent "${parent_phase}", found ${matchedPhases.length} matches.`);
                skipped++;
                continue;
            }
        }

        // 4. Find team (validated against expectedTeamType)
        const teamId = await getTeam(teamName, cleanYear, expectedTeamType);

        if (!teamId) {
            console.warn(`  [Skip] Team "${teamName}" not found (or invalid team_type for ${expectedTeamType || 'competition'}).`);
            skipped++;
            continue;
        }

        // 5. Update or Create participation record
        const hasChampField = is_champion !== undefined && is_champion !== "";
        const isChamp = is_champion === 'TRUE' || is_champion === 'true' || is_champion === true;
        const stats = {
            wins: wins !== undefined && wins !== "" ? parseInt(wins) : null,
            losses: losses !== undefined && losses !== "" ? parseInt(losses) : null,
            ties: ties !== undefined && ties !== "" ? parseInt(ties) : null,
            points_for: points_for !== undefined && points_for !== "" ? parseInt(points_for) : null,
            points_against: points_against !== undefined && points_against !== "" ? parseInt(points_against) : null,
            ...(hasChampField && { is_champion: isChamp })
        };

        const { data: existing } = await supabase
            .from('participations')
            .select('id')
            .eq('phase_id', finalPhaseId)
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
                    phase_id: finalPhaseId,
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

        if (isChamp) {
            await supabase
                .from('notes')
                .delete()
                .eq('entity_type', 'divisional_champion')
                .eq('entity_id', finalPhaseId);

            await supabase
                .from('notes')
                .insert({
                    entity_type: 'divisional_champion',
                    entity_id: finalPhaseId,
                    content: teamId
                });
            console.log(`  [Champion] Set ${teamName} as Divisional Champion for ${phaseName}.`);
        }
    }

    console.log(`\n--- Standing Import Finished ---`);
    console.log(`  Updated: ${updated} | Skipped: ${skipped}`);
    await calculateCompleteness();
}

const fileArg = process.argv.filter(arg => !arg.startsWith('--'))[2];
if (!fileArg) {
    console.log("Usage: node scripts/import_standings.mjs <path_to_csv> [--sample]");
} else {
    importStandings(fileArg);
}
