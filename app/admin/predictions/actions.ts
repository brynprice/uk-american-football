"use server";

import { createClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/auth/admin-guard";
import { revalidatePath } from "next/cache";
import {
  predictBatchSlate,
  predictMatchup,
  PredictionResult,
  SlateGame,
  BUCS_2026_WEEKS,
} from "@/lib/predictions/engine";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Records a single ad-hoc prediction (used by single matchup simulator)
 */
export async function recordPredictionAction(payload: {
  homeTeamId: string;
  awayTeamId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  winProbability: number;
  confidence: string;
  weights: Record<string, any>;
  gameId?: string;
}) {
  try {
    await assertPermission("predictions");

    if (!payload.homeTeamId || !payload.awayTeamId) {
      return { success: false, error: "Missing required team IDs." };
    }

    const supabase = getAdminClient();

    if (payload.gameId) {
      // Check if a prediction already exists for this game
      const { data: existing } = await supabase
        .from("predictions")
        .select("id")
        .eq("game_id", payload.gameId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("predictions")
          .update({
            predicted_home_score: payload.predictedHomeScore,
            predicted_away_score: payload.predictedAwayScore,
            win_probability: payload.winProbability,
            confidence: payload.confidence,
            weights: payload.weights,
          })
          .eq("id", existing.id);

        if (error) throw error;
        revalidatePath("/admin/predictions");
        revalidatePath("/admin/predictions/accuracy");
        return { success: true };
      }
    }

    const { error } = await supabase.from("predictions").insert({
      home_team_id: payload.homeTeamId,
      away_team_id: payload.awayTeamId,
      predicted_home_score: payload.predictedHomeScore,
      predicted_away_score: payload.predictedAwayScore,
      win_probability: payload.winProbability,
      confidence: payload.confidence,
      weights: payload.weights,
      game_id: payload.gameId || null,
    });

    if (error) {
      console.error("Error inserting prediction:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/predictions");
    revalidatePath("/admin/predictions/accuracy");

    return { success: true };
  } catch (err: any) {
    console.error("recordPredictionAction error:", err);
    return { success: false, error: err.message || "Failed to record prediction." };
  }
}

/**
 * Retrieves scheduled games for a specific game week in a season.
 */
export async function getWeeklySlateAction(params: {
  weekNumber: number;
  seasonYear?: number;
}): Promise<{
  success: boolean;
  games?: SlateGame[];
  weekDef?: (typeof BUCS_2026_WEEKS)[0];
  error?: string;
}> {
  try {
    await assertPermission("predictions");

    const seasonYear = params.seasonYear || 2026;
    const weekDef = BUCS_2026_WEEKS.find((w) => w.weekNumber === params.weekNumber);
    if (!weekDef) {
      return { success: false, error: `Invalid week number: ${params.weekNumber}` };
    }

    const supabase = getAdminClient();

    // 1. Fetch BUCS University Season ID
    let seasonId: string | null = null;
    const { data: bucsSeason } = await supabase
      .from("seasons")
      .select("id, competitions!inner(name)")
      .eq("year", seasonYear)
      .ilike("competitions.name", "%Universities%")
      .maybeSingle();

    if (bucsSeason) {
      seasonId = bucsSeason.id;
    } else {
      const { data: fallbackSeason } = await supabase
        .from("seasons")
        .select("id")
        .eq("year", seasonYear)
        .limit(1)
        .maybeSingle();
      seasonId = fallbackSeason?.id || null;
    }

    if (!seasonId) {
      return { success: false, error: `Season ${seasonYear} not found.` };
    }

    // 2. Fetch games in the date window
    const { data: rawGames, error: gErr } = await supabase
      .from("games")
      .select(`
        id,
        date,
        time,
        home_score,
        away_score,
        status,
        phase_id,
        home_team_id,
        away_team_id,
        phases!games_phase_id_fkey(name, parent_phase_id),
        home_team:teams!games_home_team_id_fkey(name),
        away_team:teams!games_away_team_id_fkey(name)
      `)
      .eq("season_id", seasonId)
      .gte("date", weekDef.startDate)
      .lte("date", weekDef.endDate)
      .order("date", { ascending: true })
      .order("time", { ascending: true, nullsFirst: false });

    if (gErr) {
      return { success: false, error: gErr.message };
    }

    const gameIds = (rawGames || []).map((g) => g.id);

    // 3. Fetch existing predictions for these games
    const { data: storedPredictions } = await supabase
      .from("predictions")
      .select("id, game_id, predicted_home_score, predicted_away_score, win_probability, confidence, created_at")
      .in("game_id", gameIds);

    const predMap = new Map<string, any>();
    (storedPredictions || []).forEach((p) => {
      if (p.game_id) predMap.set(p.game_id, p);
    });

    // 4. Map into clean SlateGame array
    const slateGames: SlateGame[] = (rawGames || []).map((g: any) => {
      const pred = predMap.get(g.id);
      return {
        id: g.id,
        date: g.date,
        time: g.time,
        phaseId: g.phase_id,
        phaseName: g.phases?.name || "Regular Season",
        parentPhaseName: null,
        homeTeamId: g.home_team_id,
        awayTeamId: g.away_team_id,
        homeTeamName: g.home_team?.name || "Home Team",
        awayTeamName: g.away_team?.name || "Away Team",
        homeScore: g.home_score,
        awayScore: g.away_score,
        status: g.status,
        existingPrediction: pred
          ? {
              id: pred.id,
              predictedHomeScore: pred.predicted_home_score,
              predictedAwayScore: pred.predicted_away_score,
              winProbability: pred.win_probability,
              confidence: pred.confidence,
              createdAt: pred.created_at,
            }
          : null,
      };
    });

    return { success: true, games: slateGames, weekDef };
  } catch (err: any) {
    console.error("getWeeklySlateAction error:", err);
    return { success: false, error: err.message || "Failed to load weekly slate." };
  }
}

/**
 * Runs the prediction engine across all games in a weekly slate.
 */
export async function generateSlatePredictionsAction(params: {
  games: SlateGame[];
  seasonYear?: number;
}): Promise<{
  success: boolean;
  predictions?: PredictionResult[];
  error?: string;
}> {
  try {
    await assertPermission("predictions");

    if (!params.games || params.games.length === 0) {
      return { success: false, error: "No games provided to predict." };
    }

    const supabase = getAdminClient();
    const predictions = await predictBatchSlate(supabase, params.games, params.seasonYear || 2026);

    return { success: true, predictions };
  } catch (err: any) {
    console.error("generateSlatePredictionsAction error:", err);
    return { success: false, error: err.message || "Failed to generate predictions." };
  }
}

/**
 * Persists multiple predictions to the database linked to game_id.
 */
export async function saveBatchPredictionsAction(
  predictions: Array<{
    gameId: string;
    homeTeamId: string;
    awayTeamId: string;
    predictedHomeScore: number;
    predictedAwayScore: number;
    winProbability: number;
    confidence: string;
    weights: Record<string, any>;
  }>
) {
  try {
    await assertPermission("predictions");

    if (!predictions || predictions.length === 0) {
      return { success: false, error: "No predictions to save." };
    }

    const supabase = getAdminClient();
    const gameIds = predictions.map((p) => p.gameId);

    // Fetch existing predictions for these gameIds
    const { data: existing } = await supabase
      .from("predictions")
      .select("id, game_id")
      .in("game_id", gameIds);

    const existingMap = new Map<string, string>();
    (existing || []).forEach((e) => {
      if (e.game_id) existingMap.set(e.game_id, e.id);
    });

    const toInsert: any[] = [];
    const updatePromises: PromiseLike<any>[] = [];

    for (const p of predictions) {
      const existingId = existingMap.get(p.gameId);
      if (existingId) {
        updatePromises.push(
          supabase
            .from("predictions")
            .update({
              predicted_home_score: p.predictedHomeScore,
              predicted_away_score: p.predictedAwayScore,
              win_probability: p.winProbability,
              confidence: p.confidence,
              weights: p.weights,
            })
            .eq("id", existingId)
        );
      } else {
        toInsert.push({
          game_id: p.gameId,
          home_team_id: p.homeTeamId,
          away_team_id: p.awayTeamId,
          predicted_home_score: p.predictedHomeScore,
          predicted_away_score: p.predictedAwayScore,
          win_probability: p.winProbability,
          confidence: p.confidence,
          weights: p.weights,
        });
      }
    }

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from("predictions").insert(toInsert);
      if (insErr) throw insErr;
    }

    if (updatePromises.length > 0) {
      const results = await Promise.all(updatePromises);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    }

    revalidatePath("/admin/predictions");
    revalidatePath("/admin/predictions/accuracy");

    return {
      success: true,
      savedCount: predictions.length,
      insertedCount: toInsert.length,
      updatedCount: updatePromises.length,
    };
  } catch (err: any) {
    console.error("saveBatchPredictionsAction error:", err);
    return { success: false, error: err.message || "Failed to save batch predictions." };
  }
}

/**
 * Returns model calibration metrics and in-season team performance residuals.
 */
export async function getModelCalibrationStatsAction(seasonYear: number | "all" = 2026) {
  try {
    const supabase = getAdminClient();

    let seasonId: string | null = null;
    if (seasonYear !== "all") {
      const { data: bucsSeason } = await supabase
        .from("seasons")
        .select("id, competitions!inner(name)")
        .eq("year", seasonYear)
        .ilike("competitions.name", "%Universities%")
        .maybeSingle();

      if (bucsSeason) {
        seasonId = bucsSeason.id;
      } else {
        const { data: fallbackSeason } = await supabase
          .from("seasons")
          .select("id")
          .eq("year", seasonYear)
          .limit(1)
          .maybeSingle();
        seasonId = fallbackSeason?.id || null;
      }
    }

    // 1. Fetch predictions with home & away teams
    const { data: predictions, error: pErr } = await supabase
      .from("predictions")
      .select(`
        id,
        game_id,
        home_team_id,
        away_team_id,
        predicted_home_score,
        predicted_away_score,
        win_probability,
        confidence,
        created_at,
        home_team:teams!predictions_home_team_id_fkey(id, name),
        away_team:teams!predictions_away_team_id_fkey(id, name)
      `)
      .order("created_at", { ascending: false });

    if (pErr) throw pErr;

    if (!predictions || predictions.length === 0) {
      return {
        success: true,
        evaluatedCount: 0,
        winAccuracy: null,
        maeHome: null,
        maeAway: null,
        matchedGames: [],
        teamResiduals: [],
      };
    }

    // Collect explicit game_ids to fetch completed games in bulk
    const explicitGameIds = predictions
      .filter((p) => p.game_id)
      .map((p) => p.game_id as string);

    const explicitGamesMap = new Map<string, any>();
    if (explicitGameIds.length > 0) {
      let gQuery = supabase
        .from("games")
        .select("id, date, home_score, away_score, status, season_id, home_team_id, away_team_id")
        .in("id", explicitGameIds)
        .eq("status", "completed")
        .not("home_score", "is", null)
        .not("away_score", "is", null);

      if (seasonId) {
        gQuery = gQuery.eq("season_id", seasonId);
      }

      const { data: explicitGames } = await gQuery;
      (explicitGames || []).forEach((g) => explicitGamesMap.set(g.id, g));
    }

    const matched: any[] = [];
    const teamDiffs = new Map<
      string,
      { teamName: string; offenseDiff: number; defenseDiff: number; games: number }
    >();

    for (const p of predictions) {
      let game: any = null;
      if (p.game_id) {
        game = explicitGamesMap.get(p.game_id);
      } else {
        // Match ad-hoc prediction with completed game between those teams on or after prediction
        let matchQuery = supabase
          .from("games")
          .select("id, date, home_score, away_score, status, season_id")
          .eq("home_team_id", p.home_team_id)
          .eq("away_team_id", p.away_team_id)
          .eq("status", "completed")
          .not("home_score", "is", null)
          .not("away_score", "is", null)
          .gte("date", p.created_at.split("T")[0])
          .order("date", { ascending: true })
          .limit(1);

        if (seasonId) {
          matchQuery = matchQuery.eq("season_id", seasonId);
        }

        const { data: mGame } = await matchQuery.maybeSingle();
        game = mGame;
      }

      if (!game) continue;

      const actHome = Number(game.home_score);
      const actAway = Number(game.away_score);
      const predHome = Number(p.predicted_home_score);
      const predAway = Number(p.predicted_away_score);

      const homeOff = actHome - predHome;
      const awayOff = actAway - predAway;
      const homeDef = predAway - actAway;
      const awayDef = predHome - actHome;

      const isHomeWin = actHome > actAway;
      const isAwayWin = actAway > actHome;
      const predHomeWin = predHome > predAway;
      const predAwayWin = predAway > predHome;
      const wasCorrect = (predHomeWin && isHomeWin) || (predAwayWin && isAwayWin);

      matched.push({
        id: p.id,
        gameId: game.id,
        date: game.date,
        homeTeam: (p.home_team as any)?.name || "Home Team",
        awayTeam: (p.away_team as any)?.name || "Away Team",
        actualHome: actHome,
        actualAway: actAway,
        predictedHome: predHome,
        predictedAway: predAway,
        homeError: Math.abs(actHome - predHome),
        awayError: Math.abs(actAway - predAway),
        predictedWinner: predHomeWin ? "home" : "away",
        actualWinner: isHomeWin ? "home" : isAwayWin ? "away" : "tie",
        wasCorrect,
      });

      // Accumulate Home Team
      const ht = teamDiffs.get(p.home_team_id) || {
        teamName: (p.home_team as any)?.name || "Home Team",
        offenseDiff: 0,
        defenseDiff: 0,
        games: 0,
      };
      ht.offenseDiff += homeOff;
      ht.defenseDiff += homeDef;
      ht.games += 1;
      teamDiffs.set(p.home_team_id, ht);

      // Accumulate Away Team
      const at = teamDiffs.get(p.away_team_id) || {
        teamName: (p.away_team as any)?.name || "Away Team",
        offenseDiff: 0,
        defenseDiff: 0,
        games: 0,
      };
      at.offenseDiff += awayOff;
      at.defenseDiff += awayDef;
      at.games += 1;
      teamDiffs.set(p.away_team_id, at);
    }

    const teamResiduals = Array.from(teamDiffs.values()).map((t) => ({
      teamName: t.teamName,
      avgOffenseDelta: Math.round((t.offenseDiff / t.games) * 10) / 10,
      avgDefenseDelta: Math.round((t.defenseDiff / t.games) * 10) / 10,
      gamesPlayed: t.games,
      performanceBadge:
        t.offenseDiff / t.games > 5
          ? "Exceeding Expectations"
          : t.offenseDiff / t.games < -5
          ? "Underperforming"
          : "On Target",
    }));

    teamResiduals.sort((a, b) => b.avgOffenseDelta - a.avgOffenseDelta);

    const winAccuracy =
      matched.length > 0
        ? Math.round((matched.filter((m) => m.wasCorrect).length / matched.length) * 100)
        : null;

    const maeHome =
      matched.length > 0
        ? Math.round((matched.reduce((acc, m) => acc + m.homeError, 0) / matched.length) * 10) / 10
        : null;

    const maeAway =
      matched.length > 0
        ? Math.round((matched.reduce((acc, m) => acc + m.awayError, 0) / matched.length) * 10) / 10
        : null;

    return {
      success: true,
      evaluatedCount: matched.length,
      winAccuracy,
      maeHome,
      maeAway,
      matchedGames: matched.slice(0, 20),
      teamResiduals,
    };
  } catch (err: any) {
    console.error("getModelCalibrationStatsAction error:", err);
    return { success: false, error: err.message };
  }
}
