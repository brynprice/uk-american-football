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

// --- UTILS ---

const slugify = (text) => text.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

async function getOrCreateCompetition(name, level = 'Senior') {
    const cleanName = name.trim();
    const slug = slugify(cleanName);

    const { data, error } = await supabase
        .from('competitions')
        .select('id')
        .or(`slug.eq.${slug},name.eq."${cleanName}"`)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') console.error("Error looking up competition:", error);
    if (data) {
        console.log(`  [Lookup] Found existing competition "${cleanName}" (ID: ${data.id})`);
        return data.id;
    }

    console.log(`  [Lookup] Competition "${cleanName}" not found, creating...`);
    const { data: newData, error: insertError } = await supabase
        .from('competitions')
        .insert({ name: cleanName, slug, level })
        .select('id')
        .single();

    if (insertError) throw insertError;
    await ensureSampleNote('competitions', newData.id);
    return newData.id;
}

async function getOrCreateSeason(competitionId, year) {
    const cleanYear = parseInt(year);
    if (isNaN(cleanYear)) {
        throw new Error(`Invalid year provided for season creation: ${year}`);
    }

    const { data: existing, error } = await supabase
        .from('seasons')
        .select('id')
        .eq('competition_id', competitionId)
        .eq('year', cleanYear)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') {
        console.error("Error looking up season:", error);
    }

    if (existing) {
        console.log(`  [Lookup] Found existing season for year ${cleanYear} (ID: ${existing.id})`);
        return existing.id;
    }

    console.log(`  [Lookup] Season for year ${cleanYear} not found, creating...`);
    const { data: newData, error: insertError } = await supabase
        .from('seasons')
        .insert({
            competition_id: competitionId,
            year: cleanYear,
            name: `${cleanYear} Season`
        })
        .select('id')
        .single();

    if (insertError) throw insertError;
    await ensureSampleNote('seasons', newData.id);
    return newData.id;
}

async function getOrCreatePhase(seasonId, name, parentPhaseName = null) {
    const { data: phases, error } = await supabase
        .from('phases')
        .select('id, parent_phase_id')
        .eq('season_id', seasonId)
        .eq('name', name);

    if (error) console.error("Error looking up phase:", error);

    if (phases && phases.length === 1) {
        return phases[0].id;
    }

    let parentId = null;
    if (parentPhaseName) {
        const { data: parentData } = await supabase
            .from('phases')
            .select('id')
            .eq('season_id', seasonId)
            .eq('name', parentPhaseName.trim())
            .maybeSingle();

        if (parentData) {
            parentId = parentData.id;
        } else {
            console.warn(`  [Warning] Parent phase "${parentPhaseName}" not found; proceeding without it.`);
        }
    }

    if (phases && phases.length > 1) {
        if (!parentPhaseName) {
            throw new Error(`Ambiguous phase "${name}". Multiple found, no 'parent_phase' provided.`);
        }
        if (!parentId) {
            throw new Error(`Ambiguous phase "${name}". 'parent_phase' "${parentPhaseName}" not found.`);
        }

        const matched = phases.filter(p => p.parent_phase_id === parentId);
        if (matched.length === 1) {
            return matched[0].id;
        } else {
            throw new Error(`Ambiguous phase "${name}". Found ${matched.length} even with 'parent_phase'.`);
        }
    }

    const { data: newData, error: insertError } = await supabase
        .from('phases')
        .insert({ season_id: seasonId, parent_phase_id: parentId, name, type: 'division' })
        .select('id')
        .single();

    if (insertError) throw insertError;
    await ensureSampleNote('phases', newData.id);
    return newData.id;
}

async function getOrCreateTeam(name) {
    const cleanName = name.trim();

    // 1. Check primary team name
    const { data, error } = await supabase
        .from('teams')
        .select('id')
        .eq('name', cleanName)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') console.error("Error looking up team:", error);
    if (data) return data.id;

    // 2. Check team aliases
    const { data: aliasData, error: aliasError } = await supabase
        .from('team_aliases')
        .select('team_id')
        .eq('name', cleanName)
        .maybeSingle();

    if (aliasError && aliasError.code !== 'PGRST116') console.error("Error looking up team alias:", aliasError);
    if (aliasData) {
        console.log(`  [Info] Resolved team "${cleanName}" via alias.`);
        return aliasData.team_id;
    }

    // 3. Create new team if neither match
    const { data: newData, error: insertError } = await supabase
        .from('teams')
        .insert({ name: cleanName })
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
        .maybeSingle();

    if (error && error.code !== 'PGRST116') console.error("Error looking up person:", error);
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

async function getOrCreateVenue(name) {
    if (!name) return null;

    const { data, error } = await supabase
        .from('venues')
        .select('id')
        .eq('name', name.trim())
        .maybeSingle();

    if (data) return data.id;

    const { data: newData, error: insertError } = await supabase
        .from('venues')
        .insert({ name: name.trim() })
        .select('id')
        .single();

    if (insertError) throw insertError;
    return newData.id;
}

async function ensureTeamParticipation(phaseId, teamId, coachId = null) {
    const { data: existing, error: findError } = await supabase
        .from('participations')
        .select('id, head_coach_id')
        .eq('phase_id', phaseId)
        .eq('team_id', teamId)
        .maybeSingle();

    if (existing) {
        if (!existing.head_coach_id && coachId) {
            await supabase.from('participations').update({ head_coach_id: coachId }).eq('id', existing.id);
            existing.head_coach_id = coachId;
        }
        return existing;
    }

    const { data: newData, error: insertError } = await supabase
        .from('participations')
        .insert({
            phase_id: phaseId,
            team_id: teamId,
            head_coach_id: coachId
        })
        .select('id, head_coach_id')
        .single();

    if (insertError) {
        if (insertError.code === '23505') {
            const { data: retry } = await supabase
                .from('participations')
                .select('id, head_coach_id')
                .eq('phase_id', phaseId)
                .eq('team_id', teamId)
                .maybeSingle();
            return retry;
        }
        throw insertError;
    }
    return newData;
}


// --- MAIN ---

async function importData(filePath) {
    const input = fs.readFileSync(filePath);
    const records = parse(input, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true
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
                home_coach,
                is_double_header,
                date_precision,
                date_display,
                time,
                status,
                confidence_level,
                is_playoff,
                is_title_game,
                final_type,
                title_name,
                playoff_round,
                parent_phase
            } = record;

            // Validation: Skip if core identifiers are missing
            if (!competition || !year || !home_team || !away_team) {
                console.warn(`[Warning] Skipping malformed record (missing competition, year, or teams):`, record);
                continue;
            }

            console.log(`Processing: ${year} ${competition} - ${away_team} @ ${home_team}`);

            // 1. Resolve Parents
            const competitionId = await getOrCreateCompetition(competition);
            const seasonId = await getOrCreateSeason(competitionId, year);
            const phaseId = await getOrCreatePhase(seasonId, phase || 'Regular Season', parent_phase);

            // 2. Resolve Teams
            const homeTeamId = await getOrCreateTeam(home_team);
            const awayTeamId = await getOrCreateTeam(away_team);

            // 3. Resolve Coaches & Venues
            const homeCoachId = await getOrCreatePerson(home_coach);
            const awayCoachId = await getOrCreatePerson(away_coach);
            const venueId = await getOrCreateVenue(venue);

            // 4. Ensure Team Participations (For Standings)
            const homePart = await ensureTeamParticipation(phaseId, homeTeamId, homeCoachId);
            const awayPart = await ensureTeamParticipation(phaseId, awayTeamId, awayCoachId);


            // 5. Resolve or Create Game
            let gameId;
            const { data: existingGame } = await supabase
                .from('games')
                .select('id')
                .eq('phase_id', phaseId)
                .eq('home_team_id', homeTeamId)
                .eq('away_team_id', awayTeamId)
                .eq('date', date || null)
                .maybeSingle();

            if (existingGame) {
                gameId = existingGame.id;
                console.log(`  [Info] Game already exists (ID: ${gameId}). Updating fields...`);

                const { error: updateError } = await supabase
                    .from('games')
                    .update({
                        home_score: home_score ? parseInt(home_score) : null,
                        away_score: away_score ? parseInt(away_score) : null,
                        date_precision: date_precision || (date ? 'day' : 'unknown'),
                        date_display: date_display || (date ? date.split('-').reverse().join('/') : null),
                        time: time || null,
                        venue_id: venueId,
                        notes: notes || null,
                        status: status || 'completed',
                        confidence_level: confidence_level || 'high',
                        is_playoff: ['true', 'yes', '1'].includes((is_playoff || '').toString().toLowerCase()),
                        final_type: final_type ? final_type.toLowerCase().trim() : (['true', 'yes', '1'].includes((is_title_game || '').toString().toLowerCase()) ? 'title' : null),
                        title_name: title_name || null,
                        playoff_round: playoff_round ? playoff_round.trim() : null,
                        is_double_header: ['true', 'yes', '1'].includes((is_double_header || '').toString().toLowerCase())
                    })
                    .eq('id', gameId);

                await ensureSampleNote('games', gameId);
                if (updateError) console.warn(`  [Warning] Could not update existing game: ${updateError.message}`);
            } else {
                const { data: newGame, error: gameError } = await supabase
                    .from('games')
                    .insert({
                        phase_id: phaseId,
                        home_team_id: homeTeamId,
                        away_team_id: awayTeamId,
                        home_score: home_score ? parseInt(home_score) : null,
                        away_score: away_score ? parseInt(away_score) : null,
                        date: date || null,
                        date_precision: date_precision || (date ? 'day' : 'unknown'),
                        date_display: date_display || (date ? date.split('-').reverse().join('/') : null),
                        time: time || null,
                        venue_id: venueId,
                        notes: notes || null,
                        status: status || 'completed',
                        confidence_level: confidence_level || 'high',
                        is_playoff: ['true', 'yes', '1'].includes((is_playoff || '').toString().toLowerCase()),
                        final_type: final_type ? final_type.toLowerCase().trim() : (['true', 'yes', '1'].includes((is_title_game || '').toString().toLowerCase()) ? 'title' : null),
                        title_name: title_name || null,
                        playoff_round: playoff_round ? playoff_round.trim() : null,
                        is_double_header: ['true', 'yes', '1'].includes((is_double_header || '').toString().toLowerCase())
                    })
                    .select('id')
                    .single();

                if (gameError) {
                    console.warn(`  [Warning] Could not insert game: ${gameError.message}`);
                    continue;
                }
                gameId = newGame.id;
                await ensureSampleNote('games', gameId);
                console.log(`  [Success] Game recorded (ID: ${gameId}).`);
            }

            // 6. Link Coaches to Game (Game-Level overrides)
            // Only create an override if the game coach is NOT the season-level coach (which we just ensured existence of)
            if (homeCoachId && homePart && homePart.head_coach_id !== homeCoachId) {
                const { data: existingStaff } = await supabase
                    .from('game_staff')
                    .select('id')
                    .eq('game_id', gameId)
                    .eq('team_id', homeTeamId)
                    .eq('person_id', homeCoachId)
                    .eq('role', 'head_coach')
                    .maybeSingle();

                if (!existingStaff) {
                    const { error: staffError } = await supabase.from('game_staff').insert({
                        game_id: gameId,
                        team_id: homeTeamId,
                        person_id: homeCoachId,
                        role: 'head_coach'
                    });
                    if (!staffError) console.log(`  [Success] Home coach (${home_coach}) linked as game override.`);
                } else {
                    console.log(`  [Info] Home coach (${home_coach}) already linked as game override.`);
                }
            }

            if (awayCoachId && awayPart && awayPart.head_coach_id !== awayCoachId) {
                const { data: existingStaff } = await supabase
                    .from('game_staff')
                    .select('id')
                    .eq('game_id', gameId)
                    .eq('team_id', awayTeamId)
                    .eq('person_id', awayCoachId)
                    .eq('role', 'head_coach')
                    .maybeSingle();

                if (!existingStaff) {
                    const { error: staffError } = await supabase.from('game_staff').insert({
                        game_id: gameId,
                        team_id: awayTeamId,
                        person_id: awayCoachId,
                        role: 'head_coach'
                    });
                    if (!staffError) console.log(`  [Success] Away coach (${away_coach}) linked as game override.`);
                } else {
                    console.log(`  [Info] Away coach (${away_coach}) already linked as game override.`);
                }
            }

        } catch (err) {
            console.error(`  [Error] Failed to process record:`, err.message);
        }
    }

    console.log("--- Import Finished ---");
}

const fileArg = process.argv.filter(arg => !arg.startsWith('--'))[2];
if (!fileArg) {
    console.log("Usage: node scripts/import_data.mjs <path_to_csv> [--sample]");
} else {
    importData(fileArg);
}
