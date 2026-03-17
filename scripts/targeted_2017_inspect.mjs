/**
 * Targeted 2017 Override Inspect
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const personId = '61302a1d-5d63-4258-adbf-aee9c6c9ace4';
    
    const { data: staff } = await supabase
        .from('game_staff')
        .select(`
            id, 
            team_id, 
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
        .eq('person_id', personId);

    const { data: parts } = await supabase
        .from('participations')
        .select(`
            id, 
            team_id, 
            phase_id,
            phase:phases(name, season:seasons(year))
        `)
        .eq('head_coach_id', personId);

    console.log('--- 2017 ANALYSIS ---');
    staff?.filter(s => s.game.phase.season.year === 2017).forEach(s => {
        const matchingPart = parts?.find(p => p.team_id === s.team_id && p.phase_id === s.game.phase_id);
        console.log(`Staff ID: ${s.id}, Date: ${s.game.date}, Team: ${s.team.name}, Phase: ${s.game.phase.name}`);
        console.log(`  Role: ${s.role}`);
        console.log(`  Match in Participations: ${matchingPart ? 'YES' : 'NO'}`);
    });

}
check();
