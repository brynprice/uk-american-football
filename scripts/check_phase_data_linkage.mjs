import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import readline from 'readline';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function checkDataLinkage() {
    console.log("--- Checking Phase Data Linkage (Hierarchy-Aware) ---");
    console.log("Searching for phases that recursively have no games and no standings records...\n");

    // 1. Fetch all phases with their season and competition info
    const { data: phases, error: phaseError } = await supabase
        .from('phases')
        .select(`
            id, 
            name, 
            parent_phase_id,
            season:seasons(
                year, 
                competition:competitions(name)
            )
        `);

    if (phaseError) {
        console.error("Error fetching phases:", phaseError);
        process.exit(1);
    }

    // 2. Fetch game counts for all phases
    const { data: gameCounts, error: gameError } = await supabase
        .from('games')
        .select('phase_id');
        
    if (gameError) {
        console.error("Error fetching games:", gameError);
        process.exit(1);
    }

    const phasesWithDirectGames = new Set(gameCounts.map(g => g.phase_id));

    // 3. Fetch participations to check for standings
    const { data: participations, error: partError } = await supabase
        .from('participations')
        .select('id, phase_id, team:teams(name), wins, losses, ties, points_for, points_against');

    if (partError) {
        console.error("Error fetching participations:", partError);
        process.exit(1);
    }

    // Identify phases that have "standings data" (any record with stats)
    const phasesWithDirectStandings = new Set();
    participations.forEach(p => {
        const hasStats = p.wins !== null || p.losses !== null || p.ties !== null || p.points_for !== null || p.points_against !== null;
        if (hasStats) {
            phasesWithDirectStandings.add(p.phase_id);
        }
    });

    const hasDirectData = (id) => phasesWithDirectGames.has(id) || phasesWithDirectStandings.has(id);

    // Map hierarchy
    const parentToChildren = {};
    phases.forEach(p => {
        if (p.parent_phase_id) {
            if (!parentToChildren[p.parent_phase_id]) parentToChildren[p.parent_phase_id] = [];
            parentToChildren[p.parent_phase_id].push(p.id);
        }
    });

    // Recursive data check
    function hasDataDeep(id) {
        if (hasDirectData(id)) return true;
        const children = parentToChildren[id] || [];
        for (const childId of children) {
            if (hasDataDeep(childId)) return true;
        }
        return false;
    }

    // 4. Identify Truly problematic phases (no results here or in any descendant)
    const problematicPhases = phases.filter(p => !hasDataDeep(p.id));

    if (problematicPhases.length === 0) {
        console.log("✓ All phases have record linkage (directly or via children).");
        rl.close();
        return;
    }

    // Separate by age (Past vs Future)
    const currentYear = new Date().getFullYear();
    const problematicPastPhases = problematicPhases.filter(p => p.season && p.season.year < currentYear);
    const problematicFuturePhases = problematicPhases.filter(p => p.season && p.season.year >= currentYear);

    console.log(`Found ${problematicPhases.length} "Truly Empty" phases (no games/standings in themselves or children).`);
    console.log(`  Past Seasons (< ${currentYear}): ${problematicPastPhases.length}`);
    console.log(`  Future/Current Seasons (>= ${currentYear}): ${problematicFuturePhases.length}\n`);

    const orphanedParticipationIds = [];

    // Only process past phases for potential deletion
    for (const phase of problematicPastPhases) {
        const compName = phase.season?.competition?.name || "Unknown Competition";
        const year = phase.season?.year || "Unknown Year";
        
        console.log(`[!] ${compName} (${year}) - Phase: "${phase.name}" (ID: ${phase.id})`);
        
        const teamsInPhase = participations.filter(p => p.phase_id === phase.id);
        if (teamsInPhase.length > 0) {
            console.log(`    Participating Teams (${teamsInPhase.length}):`);
            teamsInPhase.forEach(p => {
                console.log(`      - ${p.team?.name || "Unknown Team"}`);
                orphanedParticipationIds.push(p.id);
            });
        } else {
            console.log("    (No participations recorded)");
        }
        console.log("");
    }

    if (orphanedParticipationIds.length > 0) {
        console.log(`Total orphaned participations found in PAST seasons: ${orphanedParticipationIds.length}`);
        console.log(`(Note: Excluding future/current seasons to avoid deleting upcoming season placeholders)`);
        
        const answer = await question(`Do you want to delete these ${orphanedParticipationIds.length} participation records? (y/N): `);
        
        if (answer.toLowerCase() === 'y') {
            console.log(`Deleting ${orphanedParticipationIds.length} records...`);
            const { error: deleteError } = await supabase
                .from('participations')
                .delete()
                .in('id', orphanedParticipationIds);
            
            if (deleteError) {
                console.error("Error deleting participations:", deleteError);
            } else {
                console.log("✓ Successfully deleted orphaned participations.");
                console.log("Note: The phases themselves remain. You may wish to delete them manually if they are redundant.");
            }
        } else {
            console.log("Deletion cancelled.");
        }
    } else {
        console.log("No orphaned participations found in past seasons to delete.");
    }

    rl.close();
}

checkDataLinkage();
