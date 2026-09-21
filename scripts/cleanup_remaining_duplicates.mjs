import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { run as calculateCompleteness } from './calculate_completeness.mjs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupRemaining() {
    console.log("--- Finding and Cleaning Up Remaining Duplicate Games ---");

    let allGames = [];
    let from = 0;
    const limit = 1000;

    while (true) {
        const { data: games, error } = await supabase
            .from('games')
            .select(`
                id, season_id, phase_id, home_team_id, away_team_id, date, date_display, home_score, away_score, venue_id, notes, created_at,
                home_team:teams!games_home_team_id_fkey(name),
                away_team:teams!games_away_team_id_fkey(name),
                season:seasons(year)
            `)
            .range(from, from + limit - 1);

        if (error) {
            console.error("Error fetching games:", error);
            process.exit(1);
        }
        allGames.push(...games);
        if (games.length < limit) break;
        from += limit;
    }

    const grouped = new Map();
    for (const g of allGames) {
        const key = `${g.season_id}|${g.home_team_id}|${g.away_team_id}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(g);
    }

    let deletedCount = 0;

    for (const [key, list] of grouped.entries()) {
        if (list.length <= 1) continue;

        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const g1 = list[i];
                const g2 = list[j];

                // If home_score and away_score match (or both null)
                const scoreMatch = (g1.home_score === g2.home_score && g1.away_score === g2.away_score);
                if (!scoreMatch) continue;

                console.log(`\nDuplicate pair found:`);
                console.log(` Season ${g1.season?.year}: ${g1.home_team?.name} vs ${g1.away_team?.name} (${g1.home_score}-${g1.away_score})`);
                console.log(`  G1 ID: ${g1.id} | Date: ${g1.date} | Phase: ${g1.phase_id} | Venue: ${g1.venue_id} | Created: ${g1.created_at}`);
                console.log(`  G2 ID: ${g2.id} | Date: ${g2.date} | Phase: ${g2.phase_id} | Venue: ${g2.venue_id} | Created: ${g2.created_at}`);

                let keep = g1;
                let dup = g2;

                // Priority for KEEP:
                // 1. Has non-null date over null date
                // 2. Has non-Dec 25 date over Dec 25 date
                // 3. Has non-null phase_id over null phase_id
                // 4. Has non-null venue_id over null venue_id
                // 5. Earlier created_at
                if (!g1.date && g2.date) {
                    keep = g2; dup = g1;
                } else if (g1.date === '2015-12-25' && g2.date !== '2015-12-25') {
                    keep = g2; dup = g1;
                } else if (!g1.phase_id && g2.phase_id) {
                    keep = g2; dup = g1;
                } else if (!g1.venue_id && g2.venue_id) {
                    keep = g2; dup = g1;
                } else if (new Date(g2.created_at) < new Date(g1.created_at)) {
                    keep = g2; dup = g1;
                }

                console.log(`  => KEEPing ${keep.id} (Date: ${keep.date}), REMOVing ${dup.id} (Date: ${dup.date})`);

                // Re-link phase_id if keep is missing it
                if (!keep.phase_id && dup.phase_id) {
                    await supabase.from('games').update({ phase_id: dup.phase_id }).eq('id', keep.id);
                }
                // Re-link venue_id if keep is missing it
                if (!keep.venue_id && dup.venue_id) {
                    await supabase.from('games').update({ venue_id: dup.venue_id }).eq('id', keep.id);
                }

                // Re-link game_staff
                const { data: staffList } = await supabase
                    .from('game_staff')
                    .select('*')
                    .eq('game_id', dup.id);

                if (staffList && staffList.length > 0) {
                    for (const staff of staffList) {
                        const { data: existingStaff } = await supabase
                            .from('game_staff')
                            .select('id')
                            .eq('game_id', keep.id)
                            .eq('team_id', staff.team_id)
                            .eq('person_id', staff.person_id)
                            .eq('role', staff.role)
                            .maybeSingle();

                        if (!existingStaff) {
                            await supabase
                                .from('game_staff')
                                .update({ game_id: keep.id })
                                .eq('id', staff.id);
                        } else {
                            await supabase
                                .from('game_staff')
                                .delete()
                                .eq('id', staff.id);
                        }
                    }
                }

                // Delete dup game
                const { error: delErr } = await supabase.from('games').delete().eq('id', dup.id);
                if (delErr) {
                    console.error(`  Error deleting duplicate game ${dup.id}:`, delErr.message);
                } else {
                    console.log(`  Successfully deleted duplicate game ${dup.id}`);
                    deletedCount++;
                }
            }
        }
    }

    console.log(`\nDeleted ${deletedCount} remaining duplicate game records.`);

    if (deletedCount > 0) {
        console.log("\n--- Recalculating Season Completeness Scores ---");
        await calculateCompleteness();
    }
}

cleanupRemaining();
