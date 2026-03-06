import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findSampleData() {
    console.log("--- Searching for Potential Sample Data ---");

    const searchStr = '%sample%';
    const searchStr2 = '%test%';

    // 1. Competitions
    const { data: comps } = await supabase
        .from('competitions')
        .select('id, name')
        .or(`name.ilike.${searchStr},name.ilike.${searchStr2}`);

    if (comps?.length) {
        console.log(`\n[Competitions] Found ${comps.length} matching:`);
        comps.forEach(c => console.log(`  - ${c.name} (ID: ${c.id})`));
    }

    // 2. Phases
    const { data: phases } = await supabase
        .from('phases')
        .select('id, name, season_id')
        .or(`name.ilike.${searchStr},name.ilike.${searchStr2}`);

    if (phases?.length) {
        console.log(`\n[Phases] Found ${phases.length} matching:`);
        phases.forEach(p => console.log(`  - ${p.name} (ID: ${p.id}, Season: ${p.season_id})`));
    }

    // 3. Teams
    const { data: teams } = await supabase
        .from('teams')
        .select('id, name')
        .or(`name.ilike.${searchStr},name.ilike.${searchStr2}`);

    if (teams?.length) {
        console.log(`\n[Teams] Found ${teams.length} matching:`);
        teams.forEach(t => console.log(`  - ${t.name} (ID: ${t.id})`));
    }

    // 4. Games with "sample" in notes
    const { data: games } = await supabase
        .from('games')
        .select('id, notes')
        .ilike('notes', searchStr);

    if (games?.length) {
        console.log(`\n[Games] Found ${games.length} with "sample" in notes:`);
        games.forEach(g => console.log(`  - Game ID: ${g.id} (Notes: ${g.notes})`));
    }

    console.log("\n--- Search Finished ---");
}

findSampleData().catch(console.error);
