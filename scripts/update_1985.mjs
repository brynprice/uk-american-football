import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function markNoTitle() {
    const { data: seasons } = await supabase
        .from('seasons')
        .select(`
            id,
            name,
            competition:competitions(name, slug)
        `)
        .eq('year', 1985);

    const bcafl1985 = seasons?.find(s => s.competition.slug === 'british-collegiate-american-football-league' || s.competition.name.includes('Collegiate'));

    if (bcafl1985) {
        console.log(`Marking ${bcafl1985.name} as having no title game...`);
        const { error } = await supabase
            .from('seasons')
            .update({
                completeness_details: {
                    has_title: false,
                    notes: "1985 season didn't have a title game"
                }
            })
            .eq('id', bcafl1985.id);

        if (error) console.error("Error updating season:", error);
        else console.log("Success!");
    } else {
        console.log("Could not find 1985 BCAFL season.");
    }
}

markNoTitle();
