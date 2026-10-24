/**
 * UK American Football Archive - Sync Unique Scores Script
 * 
 * Scans all games with recorded scores, identifies scores that have only occurred
 * once in history (symmetric: high_score - low_score), and syncs the `is_unique_score`
 * column in Supabase.
 * 
 * Usage:
 *   node scripts/sync_unique_scores.mjs [--dry-run]
 */

import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("[FATAL ERROR] Missing Supabase service role credentials in .env.local.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const isDryRun = process.argv.includes('--dry-run');

export async function syncUniqueScores() {
    console.log(`=== Syncing Unique Game Scores (${isDryRun ? "DRY RUN" : "LIVE"}) ===`);

    // 1. Fetch all games with recorded scores
    console.log("Fetching all games with non-null scores from Supabase...");
    let allGames = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from("games")
            .select("id, home_score, away_score, status, is_unique_score")
            .not("home_score", "is", null)
            .not("away_score", "is", null)
            .neq("status", "anomaly")
            .neq("status", "cancelled")
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            if (error.message && error.message.includes('is_unique_score')) {
                console.error("\n[CRITICAL ERROR] The column 'is_unique_score' does not yet exist in your Supabase database.");
                console.error("Please execute the migration script in your Supabase SQL Editor first:");
                console.error("  -> supabase/migrations/20261024_unique_scores.sql\n");
                process.exit(1);
            }
            throw error;
        }

        allGames.push(...data);
        if (data.length < pageSize) break;
        page++;
    }

    console.log(`Total games with valid scores: ${allGames.length}`);

    // 2. Compute symmetric score frequencies
    const scoreCounts = new Map();
    for (const g of allGames) {
        const high = Math.max(g.home_score, g.away_score);
        const low = Math.min(g.home_score, g.away_score);
        const key = `${high}-${low}`;
        scoreCounts.set(key, (scoreCounts.get(key) || 0) + 1);
    }

    console.log(`Total distinct score combinations: ${scoreCounts.size}`);

    // 3. Classify unique games
    const shouldBeUniqueIds = new Set();
    const shouldNotBeUniqueIds = new Set();

    for (const g of allGames) {
        const high = Math.max(g.home_score, g.away_score);
        const low = Math.min(g.home_score, g.away_score);
        const key = `${high}-${low}`;
        const isUnique = scoreCounts.get(key) === 1;

        if (isUnique) {
            shouldBeUniqueIds.add(g.id);
        } else {
            shouldNotBeUniqueIds.add(g.id);
        }
    }

    console.log(`Unique score games detected: ${shouldBeUniqueIds.size}`);

    // 4. Identify diffs against current database state
    const needsTrue = allGames.filter(g => shouldBeUniqueIds.has(g.id) && !g.is_unique_score).map(g => g.id);
    const needsFalse = allGames.filter(g => shouldNotBeUniqueIds.has(g.id) && g.is_unique_score).map(g => g.id);

    console.log(`\nChanges required:`);
    console.log(`  - Games needing is_unique_score = TRUE:  ${needsTrue.length}`);
    console.log(`  - Games needing is_unique_score = FALSE: ${needsFalse.length}`);

    if (isDryRun) {
        console.log("\n[DRY RUN] No database records modified.");
        return { total: allGames.length, unique: shouldBeUniqueIds.size, needsTrue: needsTrue.length, needsFalse: needsFalse.length };
    }

    // 5. Apply batch updates
    const batchSize = 100;

    if (needsTrue.length > 0) {
        console.log(`Updating ${needsTrue.length} games to is_unique_score = TRUE in batches...`);
        for (let i = 0; i < needsTrue.length; i += batchSize) {
            const batch = needsTrue.slice(i, i + batchSize);
            const { error } = await supabase
                .from("games")
                .update({ is_unique_score: true })
                .in("id", batch);
            if (error) console.error(`Error updating TRUE batch ${i}-${i + batch.length}:`, error);
        }
    }

    if (needsFalse.length > 0) {
        console.log(`Updating ${needsFalse.length} games to is_unique_score = FALSE in batches...`);
        for (let i = 0; i < needsFalse.length; i += batchSize) {
            const batch = needsFalse.slice(i, i + batchSize);
            const { error } = await supabase
                .from("games")
                .update({ is_unique_score: false })
                .in("id", batch);
            if (error) console.error(`Error updating FALSE batch ${i}-${i + batch.length}:`, error);
        }
    }

    console.log("\n[SUCCESS] Unique scores synchronization complete.");
    return { total: allGames.length, unique: shouldBeUniqueIds.size, updated: needsTrue.length + needsFalse.length };
}

if (process.argv[1].endsWith('sync_unique_scores.mjs')) {
    syncUniqueScores().catch(err => {
        console.error("Fatal error:", err);
        process.exit(1);
    });
}
