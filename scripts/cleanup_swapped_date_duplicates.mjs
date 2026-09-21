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

const isExecute = process.argv.includes('--execute');

function computeTargetIsoDate(dateDisplay) {
    if (!dateDisplay) return null;
    const parts = dateDisplay.split('/');
    if (parts.length === 3) {
        let [d, m, y] = parts;
        d = d.padStart(2, '0');
        m = m.padStart(2, '0');
        if (y.length === 2) y = '20' + y;
        return `${y}-${m}-${d}`;
    }
    return null;
}

async function runCleanup() {
    console.log(`--- Running Swapped Date Duplicates Cleanup (${isExecute ? 'EXECUTE MODE' : 'DRY RUN MODE'}) ---`);

    let allGames = [];
    let from = 0;
    const limit = 1000;

    while (true) {
        const { data: games, error } = await supabase
            .from('games')
            .select(`
                id, season_id, phase_id, home_team_id, away_team_id, date, date_display, home_score, away_score, created_at,
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

    console.log(`Fetched ${allGames.length} total games from database.`);

    // Group games by (season_id, home_team_id, away_team_id)
    const grouped = new Map();
    for (const g of allGames) {
        const key = `${g.season_id}|${g.home_team_id}|${g.away_team_id}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(g);
    }

    const toDeleteIds = new Set();
    const actions = [];

    for (const [key, gamesInGroup] of grouped.entries()) {
        if (gamesInGroup.length <= 1) continue;

        // Compare each pair in group
        for (let i = 0; i < gamesInGroup.length; i++) {
            for (let j = i + 1; j < gamesInGroup.length; j++) {
                const g1 = gamesInGroup[i];
                const g2 = gamesInGroup[j];

                if (toDeleteIds.has(g1.id) || toDeleteIds.has(g2.id)) continue;

                let isDup = false;
                let reason = "";

                if (g1.date && g2.date && g1.date === g2.date) {
                    isDup = true;
                    reason = "Exact date match";
                } else if (g1.date_display && g2.date_display && g1.date_display === g2.date_display) {
                    isDup = true;
                    reason = "Matching date_display";
                } else if (g1.date && g2.date) {
                    const [y1, m1, d1] = g1.date.split('-');
                    const [y2, m2, d2] = g2.date.split('-');
                    if (y1 === y2 && m1 === d2 && d1 === m2 && m1 !== d1) {
                        isDup = true;
                        reason = "Swapped YYYY-MM-DD vs YYYY-DD-MM";
                    }
                }

                if (!isDup) continue;

                // Determine which game to keep and which to delete
                let keep = null;
                let dup = null;

                const targetIso1 = computeTargetIsoDate(g1.date_display);
                const targetIso2 = computeTargetIsoDate(g2.date_display);

                if (targetIso1 && g1.date === targetIso1 && g2.date !== targetIso1) {
                    keep = g1;
                    dup = g2;
                } else if (targetIso2 && g2.date === targetIso2 && g1.date !== targetIso2) {
                    keep = g2;
                    dup = g1;
                } else if (g1.phase_id && !g2.phase_id) {
                    keep = g1;
                    dup = g2;
                } else if (g2.phase_id && !g1.phase_id) {
                    keep = g2;
                    dup = g1;
                } else {
                    // Default to keeping earlier created record
                    if (new Date(g1.created_at) <= new Date(g2.created_at)) {
                        keep = g1;
                        dup = g2;
                    } else {
                        keep = g2;
                        dup = g1;
                    }
                }

                toDeleteIds.add(dup.id);
                actions.push({ keep, dup, reason });
            }
        }
    }

    console.log(`\nIdentified ${actions.length} duplicate games to remove.`);

    for (let idx = 0; idx < actions.length; idx++) {
        const { keep, dup, reason } = actions[idx];
        console.log(`\n[${idx + 1}/${actions.length}] ${reason}`);
        console.log(` Season: ${keep.season?.year}, ${keep.home_team?.name} vs ${keep.away_team?.name}`);
        console.log(` KEEP  ID: ${keep.id} | Date: ${keep.date} | Display: ${keep.date_display} | Score: ${keep.home_score}-${keep.away_score} | Phase: ${keep.phase_id} | Created: ${keep.created_at}`);
        console.log(` REMOVE ID: ${dup.id} | Date: ${dup.date} | Display: ${dup.date_display} | Score: ${dup.home_score}-${dup.away_score} | Phase: ${dup.phase_id} | Created: ${dup.created_at}`);

        if (isExecute) {
            // Update phase_id on keep if keep.phase_id is null and dup.phase_id is not null
            if (!keep.phase_id && dup.phase_id) {
                await supabase.from('games').update({ phase_id: dup.phase_id }).eq('id', keep.id);
                console.log(`  Updated keep game phase_id to ${dup.phase_id}`);
            }

            // Re-link or clean game_staff
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
            }
        }
    }

    if (isExecute) {
        console.log("\n--- Recalculating Season Completeness Scores ---");
        await calculateCompleteness();
        console.log("--- Cleanup Finished ---");
    } else {
        console.log("\n--- DRY RUN complete. Run with --execute to perform deletions. ---");
    }
}

runCleanup();
