import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function alterTable() {
    console.log("Applying schema change...");
    // @supabase/supabase-js does not support direct SQL execution unfortunately.
    // Instead we will just rely on the REST API to check if the column exists
    // by doing a dummy select, and if it fails, we will guide the user on how 
    // to apply the migration.

    try {
        const { error } = await supabase.from('games').select('playoff_round').limit(1);
        if (error && error.code === 'PGRST204') {
            console.error("COLUMN NOT FOUND. Please run this in your Supabase SQL Editor:");
            console.error("ALTER TABLE games ADD COLUMN playoff_round TEXT;");
        } else {
            console.log("Column 'playoff_round' already exists or other error:", error);
        }
    } catch (e) {
        console.error(e);
    }
}
alterTable();
