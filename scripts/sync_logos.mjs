/**
 * UK American Football Archive - Logo Synchronization Script
 * 
 * Automatically matches image files in public/images/logos/ to teams or team aliases
 * based on slugified names and updates their logo_url in the database.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("[FATAL ERROR] Missing Supabase environment variables in .env.local.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const isDryRun = process.argv.includes('--dry-run');
const LOGO_DIR = './public/images/logos';

const slugify = (text) => 
    text.toLowerCase()
        .trim()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-');

async function syncLogos() {
    console.log(`--- Starting Logo Sync (${isDryRun ? "DRY RUN" : "LIVE"}) ---`);

    if (!fs.existsSync(LOGO_DIR)) {
        console.error(`[Error] Logo directory not found: ${LOGO_DIR}`);
        return;
    }

    // 1. Scan logo directory
    const files = fs.readdirSync(LOGO_DIR).filter(f => 
        ['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(path.extname(f).toLowerCase())
    );

    console.log(`Found ${files.length} logo files in ${LOGO_DIR}.`);

    const logoMap = new Map(); // slug -> original_filename
    files.forEach(f => {
        const slug = slugify(path.parse(f).name);
        logoMap.set(slug, f);
    });

    // 2. Fetch all teams and aliases
    const { data: teams, error: teamError } = await supabase
        .from('teams')
        .select('id, name, logo_url');

    const { data: aliases, error: aliasError } = await supabase
        .from('team_aliases')
        .select('id, name, logo_url, team_id');

    if (teamError || aliasError) {
        console.error("[Error] Failed to fetch teams/aliases:", teamError || aliasError);
        return;
    }

    const stats = { matchedTeams: 0, matchedAliases: 0, updated: 0, skipped: 0 };
    const matchedSlugs = new Set();

    console.log("\n--- Processing Teams ---");
    for (const team of teams) {
        const slug = slugify(team.name);
        if (logoMap.has(slug)) {
            const fileName = logoMap.get(slug);
            const logoPath = `/images/logos/${fileName}`;
            matchedSlugs.add(slug);
            stats.matchedTeams++;

            if (team.logo_url === logoPath) {
                console.log(`  [Match] ${team.name} already has correct logo.`);
                continue;
            }

            console.log(`  [Update] ${team.name}: ${team.logo_url || 'NONE'} -> ${logoPath}`);
            stats.updated++;

            if (!isDryRun) {
                const { error } = await supabase
                    .from('teams')
                    .update({ logo_url: logoPath })
                    .eq('id', team.id);
                if (error) console.error(`    [Error] Failed to update ${team.name}:`, error.message);
            }
        }
    }

    console.log("\n--- Processing Aliases ---");
    for (const alias of aliases) {
        const slug = slugify(alias.name);
        if (logoMap.has(slug)) {
            const fileName = logoMap.get(slug);
            const logoPath = `/images/logos/${fileName}`;
            matchedSlugs.add(slug);
            stats.matchedAliases++;

            if (alias.logo_url === logoPath) {
                console.log(`  [Match] Alias "${alias.name}" already has correct logo.`);
                continue;
            }

            console.log(`  [Update] Alias "${alias.name}": ${alias.logo_url || 'NONE'} -> ${logoPath}`);
            stats.updated++;

            if (!isDryRun) {
                const { error } = await supabase
                    .from('team_aliases')
                    .update({ logo_url: logoPath })
                    .eq('id', alias.id);
                if (error) console.error(`    [Error] Failed to update alias ${alias.name}:`, error.message);
            }
        }
    }

    // 3. Check for orphans
    const orphans = Array.from(logoMap.keys()).filter(s => !matchedSlugs.has(s));
    if (orphans.length > 0) {
        console.log("\n--- Orphaned Logos (No match in DB) ---");
        orphans.forEach(s => console.log(`  - ${logoMap.get(s)} (${s})`));
    }

    console.log("\n--- Final Summary ---");
    console.log(`Total Files Scanned: ${files.length}`);
    console.log(`Teams Matched: ${stats.matchedTeams}`);
    console.log(`Aliases Matched: ${stats.matchedAliases}`);
    console.log(`Records ${isDryRun ? "that would be updated" : "actually updated"}: ${stats.updated}`);
    console.log(`Orphaned Files: ${orphans.length}`);
    console.log("------------------------");
}

syncLogos();
