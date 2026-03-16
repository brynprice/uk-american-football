/**
 * Fix Missing Participation
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
    const personId = '61302a1d-5d63-4258-adbf-aee9c6c9ace4'; // Martin Harrison
    const phaseId = '7aceaad3-ae4c-4857-8bdf-edde636202d2';  // Northern Conference Cup 2016
    const teamId = '4a8a2a67-713e-4039-b79d-66c42196f8f1';   // Edinburgh Mavericks
    
    console.log('Inserting missing participation...');
    const { data, error } = await supabase
        .from('participations')
        .insert({
            phase_id: phaseId,
            team_id: teamId,
            head_coach_id: personId
        })
        .select();

    if (error) console.error('Error:', error);
    else console.log('Successfully inserted participation:', data[0].id);
}
fix();
