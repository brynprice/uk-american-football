import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTeams() {
    const { data: teams } = await supabase.from('teams').select('name').limit(50);
    console.log("--- First 50 Teams ---");
    teams?.forEach(t => console.log(`  - ${t.name}`));
}

listTeams().catch(console.error);
