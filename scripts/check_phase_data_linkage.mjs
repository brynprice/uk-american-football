import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDataLinkage() {
    console.log("--- Checking Phase Data Linkage ---");
    console.log("Searching for phases with neither games nor standings records...\n");

    // 1. Fetch all phases with their season and competition info
    const { data: phases, error: phaseError } = await supabase
        .from('phases')
        .select(`
            id, 
            name, 
            season:seasons(
                year, 
                competition:competitions(name)
            )
        `);

    if (phaseError) {
        console.error("Error fetching phases:", phaseError);
        return;
    }

    // 2. Fetch game counts for all phases
    const { data: gameCounts, error: gameError } = await supabase
        .from('games')
        .select('phase_id');
        
    if (gameError) {
        console.error("Error fetching games:", gameError);
        return;
    }

    const phasesWithGames = new Set(gameCounts.map(g => g.phase_id));

    // 3. Fetch participations to check for standings
    const { data: participations, error: partError } = await supabase
        .from('participations')
        .select('id, phase_id, team:teams(name), wins, losses, ties, points_for, points_against');

    if (partError) {
        console.error("Error fetching participations:", partError);
        return;
    }

    // Identify phases that have "standings data" (any record with stats)
    const phasesWithStandings = new Set();
    participations.forEach(p => {
        const hasStats = p.wins !== null || p.losses !== null || p.ties !== null || p.points_for !== null || p.points_against !== null;
        if (hasStats) {
            phasesWithStandings.add(p.phase_id);
        }
    });

    // 4. Identify problematic phases
    const problematicPhases = phases.filter(p => !phasesWithGames.has(p.id) && !phasesWithStandings.has(p.id));

    if (problematicPhases.length === 0) {
        console.log("✓ All phases have either a game log or a standings record.");
        return;
    }

    console.log(`Found ${problematicPhases.length} phases with missing data linkage:\n`);

    for (const phase of problematicPhases) {
        const compName = phase.season?.competition?.name || "Unknown Competition";
        const year = phase.season?.year || "Unknown Year";
        
        console.log(`[!] ${compName} (${year}) - Phase: "${phase.name}" (ID: ${phase.id})`);
        
        // List teams in this phase
        const teamsInPhase = participations.filter(p => p.phase_id === phase.id);
        if (teamsInPhase.length > 0) {
            console.log(`    Participating Teams (${teamsInPhase.length}):`);
            teamsInPhase.forEach(p => {
                console.log(`      - ${p.team?.name || "Unknown Team"}`);
            });
        } else {
            console.log("    (No participations recorded for this phase)");
        }
        console.log("");
    }
}

checkDataLinkage();
