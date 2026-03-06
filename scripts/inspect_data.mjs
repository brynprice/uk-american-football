import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectData() {
    console.log("--- Inspecting Data ---");

    // 1. All Competitions
    const { data: comps } = await supabase
        .from('competitions')
        .select('id, name, level, slug');

    console.log(`\n[Competitions] Total: ${comps?.length}`);
    comps?.forEach(c => console.log(`  - ${c.name} (${c.level}) [${c.slug}]`));

    // 2. Recent Phases
    const { data: phases } = await supabase
        .from('phases')
        .select(`
            id, 
            name, 
            type,
            seasons (
                year,
                competitions ( name )
            )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

    console.log(`\n[Recent Phases]`);
    phases?.forEach(p => {
        const compName = p.seasons?.competitions?.name || 'Unknown';
        const year = p.seasons?.year || 'Unknown';
        console.log(`  - ${p.name} (${p.type}) in ${year} ${compName}`);
    });
}

inspectData().catch(console.error);
