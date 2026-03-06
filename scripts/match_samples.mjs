import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function identifySamples() {
    console.log("--- Identifying Previous Sample Data ---");

    // 1. Teams from sample_teams.csv
    if (fs.existsSync('data/sample_teams.csv')) {
        const teamsInput = fs.readFileSync('data/sample_teams.csv');
        const teamRecords = parse(teamsInput, { columns: true, skip_empty_lines: true, trim: true, bom: true });
        console.log(`\nChecking ${teamRecords.length} teams from sample_teams.csv...`);
        for (const r of teamRecords) {
            const { data } = await supabase.from('teams').select('id').eq('name', r.name).maybeSingle();
            if (data) console.log(`  [Match] Team: ${r.name} (ID: ${data.id})`);
        }
    }

    // 2. Competitions from sample_competitions.csv
    if (fs.existsSync('data/sample_competitions.csv')) {
        const compsInput = fs.readFileSync('data/sample_competitions.csv');
        const compRecords = parse(compsInput, { columns: true, skip_empty_lines: true, trim: true, bom: true });
        console.log(`\nChecking ${compRecords.length} competitions from sample_competitions.csv...`);
        for (const r of compRecords) {
            const { data } = await supabase.from('competitions').select('id').eq('name', r.name).maybeSingle();
            if (data) console.log(`  [Match] Competition: ${r.name} (ID: ${data.id})`);
        }
    }

    // 3. Games from sample_games.csv
    if (fs.existsSync('data/sample_games.csv')) {
        const gamesInput = fs.readFileSync('data/sample_games.csv');
        const gameRecords = parse(gamesInput, { columns: true, skip_empty_lines: true, trim: true, bom: true });
        console.log(`\nChecking ${gameRecords.length} games from sample_games.csv...`);
        for (const r of gameRecords) {
            // Find home/away IDs
            const { data: home } = await supabase.from('teams').select('id').eq('name', r.home_team).maybeSingle();
            const { data: away } = await supabase.from('teams').select('id').eq('name', r.away_team).maybeSingle();

            if (home && away) {
                const { data: game } = await supabase.from('games')
                    .select('id')
                    .eq('home_team_id', home.id)
                    .eq('away_team_id', away.id)
                    .eq('date', r.date)
                    .maybeSingle();
                if (game) console.log(`  [Match] Game: ${r.away_team} @ ${r.home_team} on ${r.date} (ID: ${game.id})`);
            }
        }
    }
}

identifySamples().catch(console.error);
