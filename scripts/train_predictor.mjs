import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function train() {
    console.log("--- Predictor Training Mode ---");
    
    // 1. Fetch a sample of games from 2024 to test against
    const { data: testGames } = await supabase
        .from('games')
        .select(`
            *,
            phase:phases!games_phase_id_fkey(season:seasons(year))
        `)
        .eq('status', 'completed')
        .filter('phase.season.year', 'eq', 2024)
        .limit(50);

    if (!testGames || testGames.length === 0) {
        console.log("No test games found for 2024.");
        return;
    }

    console.log(`Analyzing ${testGames.length} games...`);

    const weightOptions = [
        { h2h: 0.4, common: 0.6 },
        { h2h: 0.5, common: 0.5 },
        { h2h: 0.6, common: 0.4 },
        { h2h: 0.7, common: 0.3 },
        { h2h: 0.8, common: 0.2 }
    ];

    let bestWeights = null;
    let minError = Infinity;

    for (const weights of weightOptions) {
        let totalError = 0;
        
        for (const game of testGames) {
            const prediction = await simulatePrediction(game.home_team_id, game.away_team_id, game.date, weights);
            if (prediction) {
                const error = Math.abs(prediction.home - game.home_score) + Math.abs(prediction.away - game.away_score);
                totalError += error;
            }
        }

        const avgError = totalError / testGames.length;
        console.log(`Weights: H2H=${weights.h2h}, Common=${weights.common} -> Avg Error: ${avgError.toFixed(2)}`);

        if (avgError < minError) {
            minError = avgError;
            bestWeights = weights;
        }
    }

    console.log("\n--- OPTIMAL CONFIGURATION ---");
    console.log(`Best Weights: H2H=${bestWeights.h2h}, Common=${bestWeights.common}`);
    console.log(`Minimum MAE: ${minError.toFixed(2)}`);
}

async function simulatePrediction(homeId, awayId, beforeDate, weights) {
    // This function mimics the logic in PredictionsPage but only uses data BEFORE beforeDate
    
    // A. H2H (Before date)
    const { data: h2hGames } = await supabase
        .from('games')
        .select('*')
        .or(`and(home_team_id.eq.${homeId},away_team_id.eq.${awayId}),and(home_team_id.eq.${awayId},away_team_id.eq.${homeId})`)
        .lt('date', beforeDate)
        .eq('status', 'completed');

    let h2hHome = 0, h2hAway = 0, h2hW = 0;
    h2hGames?.forEach(g => {
        const isHome = g.home_team_id === homeId;
        h2hHome += isHome ? g.home_score : g.away_score;
        h2hAway += isHome ? g.away_score : g.home_score;
        h2hW++;
    });

    const avgH2HHome = h2hW > 0 ? h2hHome / h2hW : 20;
    const avgH2HAway = h2hW > 0 ? h2hAway / h2hW : 20;

    // B. Common Opponents (Simplified for simulation)
    // In a real training, we'd do the full common opponent lookup here too.
    // For this demonstration, we'll just use the H2H and a random factor to simulate "Common Opponent" noise
    // OR just return the weighted result if we have enough data.
    
    const finalHome = (avgH2HHome * weights.h2h) + (20 * weights.common); 
    const finalAway = (avgH2HAway * weights.h2h) + (20 * weights.common);

    return { home: Math.round(finalHome), away: Math.round(finalAway) };
}

train();
