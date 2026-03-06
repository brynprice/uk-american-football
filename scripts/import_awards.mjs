/**
 * UK American Football Archive - Awards Import Script
 *
 * Imports Hall of Fame inductions and Retired Jerseys.
 * 
 * CSV Columns Required: award_type (hall_of_fame|retired_jersey), team, honoured_person, year
 * Additional Required for Retired Jerseys: jersey_number
 * Optional: seasons_with_team, notes
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
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

if (supabaseServiceKey) {
    console.log("--- [✓] Using Service Role Key (RLS Bypassed) ---");
} else {
    console.warn("--- [!] Warning: Using ANONYMOUS key. Import will likely fail due to RLS. ---");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getOrCreatePerson(displayName) {
    if (!displayName) return null;

    const trimmed = displayName.trim();
    if (!trimmed) return null;

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

async function importAwards(filePath) {
    const input = fs.readFileSync(filePath);
    const records = parse(input, {
        columns: true,
        skip_empty_lines: true,
        bom: true
    });

    console.log(`--- Importing ${records.length} Awards ---`);

    let created = 0, skipped = 0;

    for (const record of records) {
        const { award_type, team, honoured_person, year, jersey_number, seasons_with_team, notes } = record;

        if (!award_type || !team || !honoured_person || !year) {
            console.warn(`[Warning] Skipping row missing core data (award_type, team, person, or year):`, record);
            skipped++;
            continue;
        }

        const type = award_type.trim().toLowerCase();
        const teamName = team.trim();
        const personName = honoured_person.trim();
        const awardYear = parseInt(year, 10);

        if (type !== 'hall_of_fame' && type !== 'retired_jersey') {
            console.warn(`[Warning] Unknown award_type "${type}". Skipping row.`);
            skipped++;
            continue;
        }

        if (type === 'retired_jersey' && !jersey_number) {
            console.warn(`[Warning] Retired jersey record missing "jersey_number". Skipping row.`);
            skipped++;
            continue;
        }

        // 1. Find the team
        const { data: teamRecord } = await supabase
            .from('teams')
            .select('id')
            .eq('name', teamName)
            .maybeSingle();

        if (!teamRecord) {
            console.warn(`  [Skip] Team "${teamName}" not found in database.`);
            skipped++;
            continue;
        }

        // 2. Resolve the Person ID
        const personId = await getOrCreatePerson(personName);

        // 3. Insert specific award
        try {
            if (type === 'hall_of_fame') {
                // Check dupes first
                const { data: existing } = await supabase
                    .from('hall_of_fame')
                    .select('id')
                    .eq('team_id', teamRecord.id)
                    .eq('person_name', personName) // Fallback check
                    .maybeSingle();

                if (existing) {
                    console.log(`  [Skip] HOF entry for ${personName} with ${teamName} already exists.`);
                    skipped++;
                    continue;
                }

                const { error: insertError } = await supabase.from('hall_of_fame').insert({
                    team_id: teamRecord.id,
                    person_id: personId,
                    person_name: personName,
                    year_inducted: isNaN(awardYear) ? null : awardYear,
                    seasons_with_team: seasons_with_team || null,
                    notes: notes || null
                });

                if (insertError) throw insertError;
                console.log(`  [Success] Inserted HOF: ${personName} (${teamName})`);
                created++;
            }
            else if (type === 'retired_jersey') {
                // Check dupes first
                const { data: existing } = await supabase
                    .from('retired_jerseys')
                    .select('id')
                    .eq('team_id', teamRecord.id)
                    .eq('jersey_number', jersey_number.trim())
                    .maybeSingle();

                if (existing) {
                    console.log(`  [Skip] Retired Jersey #${jersey_number} for ${teamName} already exists.`);
                    skipped++;
                    continue;
                }

                const { error: insertError } = await supabase.from('retired_jerseys').insert({
                    team_id: teamRecord.id,
                    jersey_number: jersey_number.trim(),
                    year_retired: isNaN(awardYear) ? null : awardYear,
                    honoured_person_id: personId,
                    honoured_person_name: personName,
                    notes: notes || null
                });

                if (insertError) throw insertError;
                console.log(`  [Success] Inserted Retired Jersey #${jersey_number}: ${personName} (${teamName})`);
                created++;
            }

        } catch (err) {
            console.error(`  [Error] Failed to insert ${type} for ${personName}: ${err.message}`);
            skipped++;
        }
    }

    console.log(`\n--- Awards Import Finished ---`);
    console.log(`  Created: ${created} | Skipped/Existed: ${skipped}`);
}

const fileArg = process.argv[2];
if (!fileArg) {
    console.log("Usage: node scripts/import_awards.mjs <path_to_csv>");
} else {
    importAwards(fileArg);
}
