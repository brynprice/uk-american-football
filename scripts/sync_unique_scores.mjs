/**
 * UK American Football Archive - Sync Unique Scores Script
 * 
 * Scans all games with recorded scores, identifies scores that have only occurred
 * once in their specific football level (Adult, University, Womens, etc.),
 * marks totally unique scores (occurred only once across ALL levels),
 * and syncs `is_unique_score`, `is_totally_unique`, and `game_level` in Supabase.
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

export function resolveGameLevel(game, season, homeTeam, awayTeam) {
    const compLevel = season?.competitions?.level || season?.competition?.level;
    if (compLevel === 'Adult Contact' || compLevel === 'Adult') return 'Adult';
    if (compLevel === 'Uniball' || compLevel === 'University') return 'University';
    if (compLevel === 'Womens' || compLevel === 'Women') return 'Womens';
    if (homeTeam?.team_type === 'University' || awayTeam?.team_type === 'University') return 'University';
    if (homeTeam?.team_type) return homeTeam.team_type;
    if (awayTeam?.team_type) return awayTeam.team_type;
    return 'Adult';
}

export async function syncUniqueScores() {
    console.log(`=== Syncing Level-Specific Unique Scores (${isDryRun ? "DRY RUN" : "LIVE"}) ===`);

    // 1. Fetch team types and season competition levels for level mapping
    console.log("Fetching teams and competition levels for level resolution...");
    const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, team_type');
    if (teamsError) throw teamsError;
    const teamMap = new Map(teamsData.map(t => [t.id, t]));

    const { data: seasonsData, error: seasonsError } = await supabase
        .from('seasons')
        .select('id, competition_id, competitions(id, name, level)');
    if (seasonsError) throw seasonsError;
    const seasonMap = new Map(seasonsData.map(s => [s.id, s]));

    // Check if new columns exist in Supabase
    let hasNewColumns = false;
    const { error: probeError } = await supabase
        .from('games')
        .select('is_totally_unique, game_level')
        .limit(1);
    if (!probeError) {
        hasNewColumns = true;
        console.log("Detected 'is_totally_unique' and 'game_level' columns in Supabase.");
    } else {
        console.log("Note: 'is_totally_unique' and 'game_level' columns not detected in Supabase.");
        console.log("Run supabase/migrations/20261026_level_unique_scores.sql in Supabase SQL editor to create them.");
    }

    // 2. Fetch all games with recorded scores
    console.log("Fetching all games with non-null scores from Supabase...");
    let allGames = [];
    let page = 0;
    const pageSize = 1000;

    const selectCols = hasNewColumns 
        ? "id, season_id, home_team_id, away_team_id, home_score, away_score, status, is_unique_score, is_totally_unique, game_level"
        : "id, season_id, home_team_id, away_team_id, home_score, away_score, status, is_unique_score";

    while (true) {
        const { data, error } = await supabase
            .from("games")
            .select(selectCols)
            .not("home_score", "is", null)
            .not("away_score", "is", null)
            .neq("status", "anomaly")
            .neq("status", "cancelled")
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error("[ERROR] Failed fetching games:", error.message);
            return;
        }

        allGames.push(...data);
        if (data.length < pageSize) break;
        page++;
    }

    console.log(`Total games with valid scores: ${allGames.length}`);

    // 3. Resolve game_level and score combinations
    for (const g of allGames) {
        const season = seasonMap.get(g.season_id);
        const homeTeam = teamMap.get(g.home_team_id);
        const awayTeam = teamMap.get(g.away_team_id);
        g.resolved_level = resolveGameLevel(g, season, homeTeam, awayTeam);

        const high = Math.max(g.home_score, g.away_score);
        const low = Math.min(g.home_score, g.away_score);
        g.score_key = `${high}-${low}`;
    }

    // 4. Compute symmetric score frequencies
    // A. Overall frequencies across ALL levels
    const overallCounts = new Map();
    for (const g of allGames) {
        overallCounts.set(g.score_key, (overallCounts.get(g.score_key) || 0) + 1);
    }

    // B. Level-specific frequencies
    const levelCounts = new Map(); // level -> Map(score_key -> count)
    for (const g of allGames) {
        if (!levelCounts.has(g.resolved_level)) {
            levelCounts.set(g.resolved_level, new Map());
        }
        const m = levelCounts.get(g.resolved_level);
        m.set(g.score_key, (m.get(g.score_key) || 0) + 1);
    }

    // 5. Classify games
    const shouldBeUniqueIds = new Set();
    const shouldBeTotallyUniqueIds = new Set();
    const levelBreakdown = {};

    for (const g of allGames) {
        const isLevelUnique = levelCounts.get(g.resolved_level).get(g.score_key) === 1;
        const isTotallyUnique = overallCounts.get(g.score_key) === 1;

        if (isLevelUnique) {
            shouldBeUniqueIds.add(g.id);
            levelBreakdown[g.resolved_level] = (levelBreakdown[g.resolved_level] || 0) + 1;
        }

        if (isTotallyUnique) {
            shouldBeTotallyUniqueIds.add(g.id);
        }
    }

    console.log(`\nUniqueness Summary:`);
    console.log(`  - Total Level-Unique Games:   ${shouldBeUniqueIds.size}`);
    for (const [lvl, count] of Object.entries(levelBreakdown)) {
        console.log(`    * ${lvl}: ${count}`);
    }
    console.log(`  - Totally Unique Games (all levels): ${shouldBeTotallyUniqueIds.size}`);

    // 6. Identify diffs against current database state
    const needsUniqueTrue = allGames.filter(g => shouldBeUniqueIds.has(g.id) && !g.is_unique_score).map(g => g.id);
    const needsUniqueFalse = allGames.filter(g => !shouldBeUniqueIds.has(g.id) && g.is_unique_score).map(g => g.id);

    console.log(`\nChanges for is_unique_score:`);
    console.log(`  - Needing is_unique_score = TRUE:  ${needsUniqueTrue.length}`);
    console.log(`  - Needing is_unique_score = FALSE: ${needsUniqueFalse.length}`);

    let needsTotallyUniqueTrue = [];
    let needsTotallyUniqueFalse = [];
    let needsGameLevelUpdate = [];

    if (hasNewColumns) {
        needsTotallyUniqueTrue = allGames.filter(g => shouldBeTotallyUniqueIds.has(g.id) && !g.is_totally_unique).map(g => g.id);
        needsTotallyUniqueFalse = allGames.filter(g => !shouldBeTotallyUniqueIds.has(g.id) && g.is_totally_unique).map(g => g.id);
        needsGameLevelUpdate = allGames.filter(g => g.game_level !== g.resolved_level);

        console.log(`\nChanges for is_totally_unique & game_level:`);
        console.log(`  - Needing is_totally_unique = TRUE:  ${needsTotallyUniqueTrue.length}`);
        console.log(`  - Needing is_totally_unique = FALSE: ${needsTotallyUniqueFalse.length}`);
        console.log(`  - Needing game_level update:        ${needsGameLevelUpdate.length}`);
    }

    if (isDryRun) {
        console.log("\n[DRY RUN] No database records modified.");
        return {
            total: allGames.length,
            unique: shouldBeUniqueIds.size,
            totallyUnique: shouldBeTotallyUniqueIds.size
        };
    }

    // 7. Apply batch updates
    const batchSize = 100;

    // Apply is_unique_score = TRUE
    if (needsUniqueTrue.length > 0) {
        console.log(`Updating ${needsUniqueTrue.length} games to is_unique_score = TRUE...`);
        for (let i = 0; i < needsUniqueTrue.length; i += batchSize) {
            const batch = needsUniqueTrue.slice(i, i + batchSize);
            const { error } = await supabase
                .from("games")
                .update({ is_unique_score: true })
                .in("id", batch);
            if (error) console.error(`Error updating is_unique_score TRUE batch:`, error.message);
        }
    }

    // Apply is_unique_score = FALSE
    if (needsUniqueFalse.length > 0) {
        console.log(`Updating ${needsUniqueFalse.length} games to is_unique_score = FALSE...`);
        for (let i = 0; i < needsUniqueFalse.length; i += batchSize) {
            const batch = needsUniqueFalse.slice(i, i + batchSize);
            const { error } = await supabase
                .from("games")
                .update({ is_unique_score: false })
                .in("id", batch);
            if (error) console.error(`Error updating is_unique_score FALSE batch:`, error.message);
        }
    }

    if (hasNewColumns) {
        // Apply is_totally_unique = TRUE
        if (needsTotallyUniqueTrue.length > 0) {
            console.log(`Updating ${needsTotallyUniqueTrue.length} games to is_totally_unique = TRUE...`);
            for (let i = 0; i < needsTotallyUniqueTrue.length; i += batchSize) {
                const batch = needsTotallyUniqueTrue.slice(i, i + batchSize);
                const { error } = await supabase
                    .from("games")
                    .update({ is_totally_unique: true })
                    .in("id", batch);
                if (error) console.error(`Error updating is_totally_unique TRUE batch:`, error.message);
            }
        }

        // Apply is_totally_unique = FALSE
        if (needsTotallyUniqueFalse.length > 0) {
            console.log(`Updating ${needsTotallyUniqueFalse.length} games to is_totally_unique = FALSE...`);
            for (let i = 0; i < needsTotallyUniqueFalse.length; i += batchSize) {
                const batch = needsTotallyUniqueFalse.slice(i, i + batchSize);
                const { error } = await supabase
                    .from("games")
                    .update({ is_totally_unique: false })
                    .in("id", batch);
                if (error) console.error(`Error updating is_totally_unique FALSE batch:`, error.message);
            }
        }

        // Apply game_level updates grouped by level
        if (needsGameLevelUpdate.length > 0) {
            console.log(`Updating game_level for ${needsGameLevelUpdate.length} games...`);
            const byLevel = new Map();
            for (const g of needsGameLevelUpdate) {
                if (!byLevel.has(g.resolved_level)) byLevel.set(g.resolved_level, []);
                byLevel.get(g.resolved_level).push(g.id);
            }

            for (const [lvl, ids] of byLevel.entries()) {
                console.log(`  Setting game_level = '${lvl}' for ${ids.length} games...`);
                for (let i = 0; i < ids.length; i += batchSize) {
                    const batch = ids.slice(i, i + batchSize);
                    const { error } = await supabase
                        .from("games")
                        .update({ game_level: lvl })
                        .in("id", batch);
                    if (error) console.error(`Error updating game_level '${lvl}' batch:`, error.message);
                }
            }
        }
    }

    console.log("\n[SUCCESS] Unique scores synchronization complete.");
    return {
        total: allGames.length,
        unique: shouldBeUniqueIds.size,
        totallyUnique: shouldBeTotallyUniqueIds.size
    };
}

if (process.argv[1] && process.argv[1].endsWith('sync_unique_scores.mjs')) {
    syncUniqueScores().catch(err => {
        console.error("Fatal error:", err);
        process.exit(1);
    });
}
