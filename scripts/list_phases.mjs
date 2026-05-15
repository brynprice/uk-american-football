import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllPhases() {
    const years = [2007, 2008, 2009, 2010, 2011, 2012, 2013, 2019, 2020];
    const { data: comp } = await supabase.from('competitions').select('id').ilike('name', '%British Universities%').single();
    
    if (!comp) return;

    const { data: seasons } = await supabase
        .from('seasons')
        .select('id, year')
        .eq('competition_id', comp.id)
        .in('year', years);

    for (const season of seasons) {
        console.log(`\nSeason ${season.year}:`);
        const { data: phases } = await supabase
            .from('phases')
            .select('name')
            .eq('season_id', season.id);
        
        if (phases && phases.length > 0) {
            console.log("  Phases: " + phases.map(p => p.name).join(', '));
        } else {
            console.log("  No phases found.");
        }
    }
}

listAllPhases();
