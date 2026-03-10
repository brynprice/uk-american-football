import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Calculates a completeness score for a given season.
 * Weights (Total 100):
 * - Structure (20): Has phases (10), has participations (10)
 * - Game Presence (30): Has games (30), or has standings only (15)
 * - Game Quality (30): Scores (15), Dates (10), Venues (5)
 * - Context (20): Coaches (15), Title Game (5)
 */
async function calculateForSeason(seasonId, seasonName, expectedParticipants = null) {
    let score = 0;
    const details = {
        missing_phases: true,
        missing_participations: true,
        missing_games: true,
        games_missing_scores: 0,
        games_missing_dates: 0,
        games_missing_venues: 0,
        participations_missing_coach: 0,
        missing_title_game: true
    };

    // 1. Structure (Phases & Participations)
    // Get all phases for the season
    const { data: phases } = await supabase.from('phases').select('id').eq('season_id', seasonId);
    if (!phases || phases.length === 0) {
        return { score: 0, details }; // Total failure
    }

    score += 10;
    details.missing_phases = false;

    const phaseIds = phases.map(p => p.id);

    // Get participations for these phases
    const { data: participations } = await supabase
        .from('participations')
        .select('id, head_coach_id, wins, team_id')
        .in('phase_id', phaseIds);

    if (participations && participations.length > 0) {
        const totalParts = participations.length;
        const uniqueTeamsCount = new Set(participations.map(p => p.team_id)).size;

        if (expectedParticipants && expectedParticipants > 0) {
            const ratio = Math.min(uniqueTeamsCount / expectedParticipants, 1.0);
            score += Math.round(ratio * 10);
            details.missing_expected_ratio = `${uniqueTeamsCount}/${expectedParticipants}`;
        } else {
            score += 10;
        }

        details.missing_participations = false;

        // Context: Coaches
        const partsWithCoach = participations.filter(p => !!p.head_coach_id).length;
        details.participations_missing_coach = totalParts - partsWithCoach;

        const coachPercentage = partsWithCoach / totalParts;
        score += Math.round(coachPercentage * 15);
    }

    // 2. Games Presence & Quality
    const { data: games } = await supabase
        .from('games')
        .select('id, home_score, away_score, date, date_precision, venue_id, final_type')
        .in('phase_id', phaseIds);

    if (games && games.length > 0) {
        score += 30; // Game presence
        details.missing_games = false;

        const totalGames = games.length;
        let scoreCount = 0;
        let dateCount = 0;
        let venueCount = 0;
        let hasTitle = false;

        games.forEach(g => {
            if (g.home_score !== null && g.away_score !== null) scoreCount++;
            else details.games_missing_scores++;

            if (g.date && g.date_precision === 'day') dateCount++;
            else details.games_missing_dates++;

            if (g.venue_id) venueCount++;
            else details.games_missing_venues++;

            if (g.final_type === 'title') hasTitle = true;
        });

        const scorePercent = scoreCount / totalGames;
        const datePercent = dateCount / totalGames;
        const venuePercent = venueCount / totalGames;

        score += Math.round(scorePercent * 15);
        score += Math.round(datePercent * 10);
        score += Math.round(venuePercent * 5);

        if (hasTitle) {
            score += 5;
            details.missing_title_game = false;
        }

    } else if (participations && participations.some(p => p.wins !== null)) {
        // No individual games, but we have aggregated standings
        score += 15;
    }

    return { score, details };
}

export async function run(targetSeasonId = null) {
    console.log("--- Calculating Season Completeness Scores ---");

    let query = supabase.from('seasons').select('id, year, name, expected_participants');
    if (targetSeasonId) {
        query = query.eq('id', targetSeasonId);
    }

    const { data: seasons, error } = await query;
    if (error) {
        console.error("Error fetching seasons:", error);
        return;
    }

    console.log(`Found ${seasons.length} seasons to process.`);

    let updated = 0;
    for (const s of seasons) {
        const title = s.name || `${s.year} Season`;
        const { score, details } = await calculateForSeason(s.id, title, s.expected_participants);

        const { error: updateError } = await supabase
            .from('seasons')
            .update({
                completeness_score: score,
                completeness_details: details
            })
            .eq('id', s.id);

        if (updateError) {
            console.error(`[Error] updating ${title}: ${updateError.message}`);
        } else {
            console.log(`[Score: ${score}] ${title} updated.`);
            updated++;
        }
    }

    console.log(`\nFinished updating ${updated} seasons.`);
}

// Only run if executed directly
if (process.argv[1] && (process.argv[1].endsWith('calculate_completeness.mjs') || process.argv[1].endsWith('calculate_completeness'))) {
    const arg = process.argv[2];
    run(arg);
}
