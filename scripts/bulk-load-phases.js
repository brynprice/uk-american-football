require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function bulkLoadPhases() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const filePath = args.find(a => a.endsWith('.json'));
    const seasonIdArg = args.find(a => a.startsWith('--season='));

    if (!filePath || !seasonIdArg) {
        console.error('Usage: node bulk-load-phases.js <path-to-json> --season=<id> [--dry-run]');
        process.exit(1);
    }

    const seasonId = seasonIdArg.split('=')[1];
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    console.log(`Starting bulk load for season ${seasonId}${dryRun ? ' (DRY RUN)' : ''}...`);

    async function processPhases(phases, parentId = null) {
        for (let i = 0; i < phases.length; i++) {
            const phase = phases[i];
            const { name, type, children, confidence_level = 'high' } = phase;

            console.log(`Processing: ${name} (${type || 'No Type'}) [Parent: ${parentId || 'None'}]`);

            let insertedId = 'DRY_RUN_ID';
            if (!dryRun) {
                const { data: inserted, error } = await supabase
                    .from('phases')
                    .insert({
                        season_id: seasonId,
                        parent_phase_id: parentId,
                        name,
                        type,
                        ordinal: i,
                        confidence_level
                    })
                    .select()
                    .single();

                if (error) {
                    console.error(`Error inserting ${name}:`, error.message);
                    throw error;
                }
                insertedId = inserted.id;
            }

            if (children && children.length > 0) {
                await processPhases(children, insertedId);
            }
        }
    }

    try {
        await processPhases(data);
        console.log('\nSUCCESS: Bulk load completed!');
    } catch (err) {
        console.error('\nFAILED: Bulk load aborted due to error.');
    }
}

bulkLoadPhases();
