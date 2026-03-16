/**
 * Diagnostic: Find Coach-Only Phases
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: games } = await supabase.from('games').select('phase_id');
    const { data: participations } = await supabase.from('participations').select('phase_id, head_coach_id, wins');

    const phasesWithGames = new Set(games.map(g => g.phase_id));
    const phasesWithStats = new Set(participations.filter(p => p.wins !== null).map(p => p.phase_id));
    const phasesWithCoach = new Set(participations.filter(p => p.head_coach_id !== null).map(p => p.phase_id));

    const coachedOnlyPhases = [...phasesWithCoach].filter(id => !phasesWithGames.has(id) && !phasesWithStats.has(id));
    
    console.log(`Found ${coachedOnlyPhases.length} phases with ONLY coaching data.`);
    
    if (coachedOnlyPhases.length > 0) {
        const { data: details } = await supabase
            .from('phases')
            .select('name, season:seasons(year)')
            .in('id', coachedOnlyPhases);
        
        details?.forEach(d => console.log(` - ${d.name} (${d.season.year})`));
    }
}
check();
