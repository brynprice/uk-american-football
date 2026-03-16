/**
 * Full Remaining Staff Analysis
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const personId = '61302a1d-5d63-4258-adbf-aee9c6c9ace4';
    
    const { data: person } = await supabase.from('people').select(`
        id,
        display_name,
        game_staff (
            id,
            team_id,
            role,
            game:games (
                id,
                date,
                phase_id,
                phase:phases (
                    name,
                    season:seasons (
                        year,
                        competition:competitions (name)
                    )
                )
            ),
            team:teams(name)
        ),
        participations (
            id,
            team_id,
            phase_id,
            phase:phases (
                name,
                season:seasons (year)
            )
        )
    `).eq('id', personId).single();

    if (!person) {
        console.log('Person not found');
        return;
    }

    console.log(`Person: ${person.display_name} (${person.id})`);
    
    console.log('\n--- ALL REMAINING GAME STAFF ---');
    person.game_staff?.forEach(s => {
        const matchingPart = person.participations?.find(p => p.team_id === s.team_id && p.phase_id === s.game.phase_id);
        console.log(`Staff ID: ${s.id}`);
        console.log(`  Team:   ${s.team.name} (${s.team_id})`);
        console.log(`  Phase:  ${s.game.phase.name} (${s.game.phase_id}) - ${s.game.phase.season.year}`);
        console.log(`  Match by ID: ${matchingPart ? 'YES' : 'NO'}`);
    });
}
check();
