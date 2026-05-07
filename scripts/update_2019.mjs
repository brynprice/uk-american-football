import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check2019() {
    const { data: comp } = await supabase.from('competitions').select('id').ilike('name', '%British Universities%').single();
    const { data: season } = await supabase.from('seasons').select('id, name').eq('competition_id', comp.id).eq('year', 2019).single();
    
    console.log(`Checking BUAFL ${season.name} (year: 2019)...`);
    
    const { data: phases } = await supabase.from('phases').select('id, name').eq('season_id', season.id);
    
    let totalGames = 0;
    for (const phase of phases) {
        const { count } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('phase_id', phase.id);
        if (count > 0) {
            console.log(`  ${phase.name}: ${count} games`);
            totalGames += count;
        }
    }
    
    console.log(`\nTotal games found: ${totalGames}`);
    console.log(`Marking season as interrupted with no championship game.`);

    const { error } = await supabase
        .from('seasons')
        .update({
            completeness_details: {
                has_title: false,
                notes: "Season was interrupted (COVID-19), no championship game held.",
                recorded_games: totalGames
            }
        })
        .eq('id', season.id);

    if (error) console.error("Error updating season:", error);
    else console.log("Success!");
}

check2019();
