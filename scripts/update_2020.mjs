import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function mark2020Cancelled() {
    const { data: comp } = await supabase.from('competitions').select('id').ilike('name', '%British Universities%').single();
    if (!comp) return;

    const { data: season } = await supabase.from('seasons').select('id, name').eq('competition_id', comp.id).eq('year', 2020).single();
    if (!season) return;

    console.log(`Marking BUAFL ${season.name} (year: 2020) as cancelled...`);

    const { error } = await supabase
        .from('seasons')
        .update({
            completeness_details: {
                has_title: false,
                notes: "Season was cancelled (COVID-19)."
            }
        })
        .eq('id', season.id);

    if (error) console.error("Error updating season:", error);
    else console.log("Success!");
}

mark2020Cancelled();
