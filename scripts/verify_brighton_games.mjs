import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyBrighton() {
    // Brighton team_id
    const { data: team } = await supabase.from('teams').select('id, name').ilike('name', '%Brighton Panthers%').single();
    if (!team) {
        console.error("Brighton Panthers team not found");
        return;
    }

    console.log(`Found team: ${team.name} (${team.id})`);

    const { data: games, error } = await supabase
        .from('games')
        .select(`
            id, season_id, date, date_display, home_score, away_score, status,
            season:seasons(year),
            home_team:teams!games_home_team_id_fkey(name),
            away_team:teams!games_away_team_id_fkey(name)
        `)
        .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`);

    if (error) {
        console.error("Error fetching games:", error);
        return;
    }

    console.log(`Total games for Brighton Panthers: ${games.length}`);

    const seasonMap = new Map();
    for (const g of games) {
        const year = g.season?.year || 'Unknown';
        if (!seasonMap.has(year)) seasonMap.set(year, []);
        seasonMap.get(year).push(g);
    }

    const sortedYears = Array.from(seasonMap.keys()).sort();
    for (const year of sortedYears) {
        const seasonGames = seasonMap.get(year);
        console.log(`\nSeason ${year}: ${seasonGames.length} games`);
        for (const g of seasonGames) {
            console.log(`  ${g.date} (${g.date_display}): ${g.home_team?.name} ${g.home_score} - ${g.away_score} ${g.away_team?.name}`);
        }
    }
}

verifyBrighton();
