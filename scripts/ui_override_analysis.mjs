/**
 * Full Remaining Staff Analysis
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const personId = '61302a1d-5d63-4258-adbf-aee9c6c9ace4';
    
    const { data: person } = await supabase.from('people').select(`
        id,
        display_name,
        game_staff (
            id,
            team_id,
            role,
            game:games (
                id,
                date,
                phase_id,
                phase:phases (
                    name,
                    season:seasons (
                        year,
                        competition:competitions (name)
                    )
                )
            )
        ),
        participations (
            id,
            team_id,
            phase_id,
            phase:phases (
                name,
                season:seasons (year)
            )
        )
    `).eq('id', personId).single();

    if (!person) {
        console.log('Person not found');
        return;
    }

    console.log(`Person: ${person.display_name} (${person.id})`);
    console.log(`Total Game Staff: ${person.game_staff?.length || 0}`);
    console.log(`Total Participations: ${person.participations?.length || 0}`);

    const staff = person.game_staff || [];
    const participations = person.participations || [];

    const gameEvents = staff
        .filter((s) => !participations.some((p) => p.phase_id === s.game.phase_id && p.team_id === s.team_id))
        .map((s) => ({
            id: s.id,
            gameId: s.game.id,
            year: s.game.date ? new Date(s.game.date).getFullYear() : s.game.phase.season.year,
            displayYear: s.game.phase.season.year,
            competition: s.game.phase.season.competition.name,
            team: s.team_id,
            phase: s.game.phase.name,
            date: s.game.date
        }));

    console.log('\n--- UI CALCULATED GAME OVERRIDES ---');
    if (gameEvents.length === 0) {
        console.log('None found.');
    } else {
        gameEvents.forEach(e => {
            console.log(`Override: ID=${e.id}, Game=${e.gameId}, Year=${e.year} (${e.displayYear}), TeamID=${e.team}, Phase=${e.phase}, Date=${e.date}`);
        });
    }
}
check();
