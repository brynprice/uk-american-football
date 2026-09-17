/**
 * Cleanup Duplicate Games Utility
 * 
 * Finds and removes duplicate game records from Supabase, keeping the earliest created record
 * for each unique combination of season_id, phase_id, home_team_id, away_team_id, and date.
 */

import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { run as calculateCompleteness } from '/Users/brynprice/uk-football-history/scripts/calculate_completeness.mjs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDuplicates() {
    console.log("--- Fetching all games from database ---");
    let allGames = [];
    let from = 0;
    const limit = 1000;

    while (true) {
        const { data: games, error } = await supabase
            .from('games')
            .select('id, season_id, phase_id, home_team_id, away_team_id, date, created_at')
            .range(from, from + limit - 1);

        if (error) {
            console.error("Error fetching games:", error);
            process.exit(1);
        }
        allGames.push(...games);
        if (games.length < limit) break;
        from += limit;
    }

    console.log(`Total games found: ${allGames.length}`);

    // Group by unique key
    const groups = new Map();
    for (const g of allGames) {
        const key = `${g.season_id}|${g.phase_id}|${g.home_team_id}|${g.away_team_id}|${g.date}`;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(g);
    }

    let duplicateGroupCount = 0;
    let deletedCount = 0;

    for (const [key, group] of groups.entries()) {
        if (group.length > 1) {
            duplicateGroupCount++;
            // Sort by created_at ascending (earliest first)
            group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            const keepGame = group[0];
            const duplicateGames = group.slice(1);

            for (const dup of duplicateGames) {
                // Re-link or remove game_staff pointing to duplicate game
                const { data: staffList } = await supabase
                    .from('game_staff')
                    .select('id, team_id, person_id, role')
                    .eq('game_id', dup.id);

                if (staffList && staffList.length > 0) {
                    for (const staff of staffList) {
                        const { data: existingStaff } = await supabase
                            .from('game_staff')
                            .select('id')
                            .eq('game_id', keepGame.id)
                            .eq('team_id', staff.team_id)
                            .eq('person_id', staff.person_id)
                            .eq('role', staff.role)
                            .maybeSingle();

                        if (!existingStaff) {
                            await supabase
                                .from('game_staff')
                                .update({ game_id: keepGame.id })
                                .eq('id', staff.id);
                        } else {
                            await supabase
                                .from('game_staff')
                                .delete()
                                .eq('id', staff.id);
                        }
                    }
                }

                // Delete duplicate game row
                const { error: deleteError } = await supabase
                    .from('games')
                    .delete()
                    .eq('id', dup.id);

                if (deleteError) {
                    console.error(`Failed to delete duplicate game ${dup.id}:`, deleteError.message);
                } else {
                    deletedCount++;
                }
            }
        }
    }

    console.log(`\n--- Cleanup Complete ---`);
    console.log(`Duplicate Groups Identified: ${duplicateGroupCount}`);
    console.log(`Duplicate Game Rows Deleted: ${deletedCount}`);

    if (deletedCount > 0) {
        console.log("\nRecalculating season completeness scores...");
        await calculateCompleteness();
    }
}

cleanupDuplicates();
