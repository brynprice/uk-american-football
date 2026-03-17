/**
 * CLEANUP REDUNDANT STAFF
 * 
 * Removes game_staff records that are redundant because they already match 
 * the phase-wide (season) head_coach assignment in the participations table.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env from .env.local
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const dryRun = process.argv.includes('--dry-run');

async function cleanup() {
    console.log(`--- Redundant Staff Cleanup (${dryRun ? 'DRY RUN' : 'LIVE'}) ---`);

    // 1. Fetch all game_staff with head_coach role
    const { data: staff, error: staffError } = await supabase
        .from('game_staff')
        .select(`
            id, 
            team_id, 
            person_id, 
            role, 
            game:games(
                id,
                date,
                phase_id,
                phase:phases!games_phase_id_fkey(
                    name,
                    season:seasons(year)
                )
            ),
            person:people(display_name),
            team:teams(name)
        `)
        .eq('role', 'head_coach');

    if (staffError) {
        console.error('Error fetching staff:', staffError);
        return;
    }

    // 2. Fetch all participations that have a head coach assigned
    const { data: participations, error: partError } = await supabase
        .from('participations')
        .select('team_id, phase_id, head_coach_id')
        .not('head_coach_id', 'is', null);

    if (partError) {
        console.error('Error fetching participations:', partError);
        return;
    }

    // 3. Identify redundant records
    const redundantIds = [];
    const redundantDetails = [];

    for (const s of staff || []) {
        // Redundant if: person is already the head coach for this team in this phase
        const isRedundant = participations?.some(p => 
            p.team_id === s.team_id && 
            p.phase_id === s.game.phase_id && 
            p.head_coach_id === s.person_id
        );

        if (s.person_id === '61302a1d-5d63-4258-adbf-aee9c6c9ace4' && s.game.phase.season.year === 2018) {
            console.log(`Checking Martin Harrison [2018]: Redundant=${isRedundant}`);
            if (!isRedundant) {
                const samePhase = participations?.filter(p => p.phase_id === s.game.phase_id);
                console.log(`  Participations in this phase: ${samePhase?.length}`);
                const phaseMatch = samePhase?.find(p => p.team_id === s.team_id);
                console.log(`  Found participation for team ${s.team_id}: ${phaseMatch ? 'YES' : 'NO'}`);
                if (phaseMatch) {
                    console.log(`  Participation Coach ID: ${phaseMatch.head_coach_id}`);
                    console.log(`  Staff Coach ID: ${s.person_id}`);
                    console.log(`  Match? ${phaseMatch.head_coach_id === s.person_id}`);
                }
            }
        }

        if (isRedundant) {
            redundantIds.push(s.id);
            redundantDetails.push({
                year: s.game.phase.season.year,
                team: s.team.name,
                phase: s.game.phase.name,
                coach: s.person.display_name,
                gameDate: s.game.date
            });
        }
    }

    console.log(`Found ${redundantIds.length} redundant records.`);

    if (redundantDetails.length > 0) {
        console.log('\nSample redundant records for deletion:');
        redundantDetails.slice(0, 10).forEach(d => {
            console.log(` - [${d.year}] ${d.team} (${d.phase}): ${d.coach} on ${d.gameDate}`);
        });
        if (redundantDetails.length > 10) console.log(` ... and ${redundantDetails.length - 10} more.`);
    }

    // 4. Delete if not dry run
    if (redundantIds.length > 0 && !dryRun) {
        console.log(`\nDeleting ${redundantIds.length} records...`);
        
        // Supabase/PostgREST can handle large IN filters but let's be safe if it's thousands (unlikely here)
        const { error: deleteError } = await supabase
            .from('game_staff')
            .delete()
            .in('id', redundantIds);

        if (deleteError) {
            console.error('Error during deletion:', deleteError);
        } else {
            console.log('Successfully deleted redundant records.');
        }
    } else if (redundantIds.length > 0) {
        console.log('\n[Dry Run] No records were deleted.');
    } else {
        console.log('\nNo redundant records found to clean up.');
    }
}

cleanup();
