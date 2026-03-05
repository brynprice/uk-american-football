import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
    const { data: aliases } = await supabase
        .from("team_aliases")
        .select("*")
        .not("logo_url", "is", null)
        .limit(3);

    console.log("Team aliases with logos:", JSON.stringify(aliases, null, 2));
}

run();
