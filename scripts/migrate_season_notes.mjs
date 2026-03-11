import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
    console.log("Checking if 'notes' column exists in 'seasons' table...");

    // We already checked this with check_seasons_schema.mjs, but let's be safe.
    const { data: oneRow } = await supabase.from('seasons').select('*').limit(1);
    if (oneRow && oneRow.length > 0 && 'notes' in oneRow[0]) {
        console.log("Column 'notes' already exists.");
        return;
    }

    console.log("Adding 'notes' column to 'seasons' table...");
    // Note: We don't have a direct 'run_sql' tool that works against remote DBs easily without RPC or similar.
    // Many users have a 'exec_sql' or similar RPC for this. 
    // If not, I'll attempt to use the Supabase CLI if possible, or explain I can't do it via JS easily without an RPC.

    // Let's check for an RPC that can run SQL.
    const { error } = await supabase.rpc('exec_sql', { sql: 'ALTER TABLE seasons ADD COLUMN notes TEXT;' });

    if (error) {
        console.error("Migration failed via RPC 'exec_sql'. Trying common alternative 'run_sql'...");
        const { error: error2 } = await supabase.rpc('run_sql', { sql: 'ALTER TABLE seasons ADD COLUMN notes TEXT;' });
        if (error2) {
            console.error("Migration failed. Please run manually: ALTER TABLE seasons ADD COLUMN notes TEXT;");
            console.error(error2);
        } else {
            console.log("Successfully added 'notes' column via 'run_sql'.");
        }
    } else {
        console.log("Successfully added 'notes' column via 'exec_sql'.");
    }
}

migrate();
