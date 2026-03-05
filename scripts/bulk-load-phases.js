require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function bulkLoadPhases() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const filePath = args.find(a => a.endsWith('.json'));
    const competitionArg = args.find(a => a.startsWith('--competition='));
    const yearArg = args.find(a => a.startsWith('--year='));

    if (!filePath || !competitionArg || !yearArg) {
        console.error('Usage: node bulk-load-phases.js <path-to-json> --competition="<name>" --year=<YYYY> [--dry-run]');
        process.exit(1);
    }

    const competitionName = competitionArg.split('=')[1];
    const year = yearArg.split('=')[1];
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
    const supabaseKey = supabaseServiceKey || supabaseAnonKey;

    if (!supabaseUrl || !supabaseKey) {
        console.error("CRITICAL: Missing SUPABASE_URL or a valid KEY in .env.local");
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const slugify = (text) => text.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    const compSlug = slugify(competitionName);
    
    const { data: comp } = await supabase
        .from('competitions')
        .select('id')
        .or(`slug.eq.${compSlug},name.eq."${competitionName.trim()}"`)
        .maybeSingle();

    if (!comp) {
        console.error(`Error: Competition "${competitionName}" not found in database.`);
        process.exit(1);
    }

    const { data: season } = await supabase
        .from('seasons')
        .select('id')
        .eq('competition_id', comp.id)
        .eq('year', parseInt(year))
        .maybeSingle();

    if (!season) {
        console.error(`Error: Season for year ${year} in competition "${competitionName}" not found in database.`);
        process.exit(1);
    }

    const seasonId = season.id;

    console.log(`Starting bulk load for ${competitionName} ${year} (Season ID: ${seasonId})${dryRun ? ' (DRY RUN)' : ''}...`);

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
