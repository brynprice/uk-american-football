"use server";

import { createClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/auth/admin-guard";
import { revalidatePath } from "next/cache";
import { isValidUuid } from "@/lib/utils/validation";
import {
  predictBatchSlate,
  predictMatchup,
  sanitizePredictedScore,
  PredictionResult,
  SlateGame,
  BUCS_2026_WEEKS,
} from "@/lib/predictions/engine";

const VALID_CONFIDENCE_LEVELS = new Set(["High", "Medium", "Low"]);

function validatePredictionMetrics(winProbability: number, confidence: string) {
  if (
    typeof winProbability !== "number" ||
    !Number.isFinite(winProbability) ||
    winProbability < 0 ||
    winProbability > 100
  ) {
    throw new Error("Win probability must be a finite number between 0 and 100.");
  }
  if (!VALID_CONFIDENCE_LEVELS.has(confidence)) {
    throw new Error("Invalid confidence level.");
  }
}

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

    if (!isValidUuid(payload.homeTeamId) || !isValidUuid(payload.awayTeamId)) {
      return { success: false, error: "Invalid team ID." };
    }
    if (payload.gameId && !isValidUuid(payload.gameId)) {
      return { success: false, error: "Invalid game ID." };
    }
    validatePredictionMetrics(payload.winProbability, payload.confidence);

    const supabase = getAdminClient();
    const cleanHomeScore = sanitizePredictedScore(payload.predictedHomeScore);
    const cleanAwayScore = sanitizePredictedScore(payload.predictedAwayScore);

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
            predicted_home_score: cleanHomeScore,
            predicted_away_score: cleanAwayScore,
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
      predicted_home_score: cleanHomeScore,
      predicted_away_score: cleanAwayScore,
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

    const seasonYear = params.seasonYear ?? 2026;
    if (!Number.isInteger(seasonYear) || seasonYear < 1980 || seasonYear > 2100) {
      return { success: false, error: "Invalid season year." };
    }
    if (!Number.isInteger(params.weekNumber) || params.weekNumber < 1 || params.weekNumber > 25) {
      return { success: false, error: "Invalid week number." };
    }
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
    for (const p of storedPredictions || []) {
      const cleanHome = sanitizePredictedScore(p.predicted_home_score);
      const cleanAway = sanitizePredictedScore(p.predicted_away_score);
      if (cleanHome !== p.predicted_home_score || cleanAway !== p.predicted_away_score) {
        // Auto-correct any legacy 1-point stored prediction in the DB
        await supabase
          .from("predictions")
          .update({
            predicted_home_score: cleanHome,
            predicted_away_score: cleanAway,
          })
          .eq("id", p.id);
        p.predicted_home_score = cleanHome;
        p.predicted_away_score = cleanAway;
      }
      if (p.game_id) predMap.set(p.game_id, p);
    }

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
 * Runs the tier-adjusted prediction engine for a single matchup.
 */
export async function simulateSingleMatchupAction(params: {
  homeTeamId: string;
  awayTeamId: string;
  seasonYear?: number;
}): Promise<{
  success: boolean;
  prediction?: PredictionResult;
  error?: string;
}> {
  try {
    await assertPermission("predictions");

    if (!isValidUuid(params.homeTeamId) || !isValidUuid(params.awayTeamId)) {
      return { success: false, error: "Please select valid home and away teams." };
    }
    const seasonYear = params.seasonYear ?? 2026;
    if (!Number.isInteger(seasonYear) || seasonYear < 1980 || seasonYear > 2100) {
      return { success: false, error: "Invalid season year." };
    }

    const supabase = getAdminClient();
    const prediction = await predictMatchup(supabase, {
      homeTeamId: params.homeTeamId,
      awayTeamId: params.awayTeamId,
      seasonYear,
    });

    return { success: true, prediction };
  } catch (err: any) {
    console.error("simulateSingleMatchupAction error:", err);
    return { success: false, error: err.message || "Failed to simulate matchup." };
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

    if (!Array.isArray(params.games) || params.games.length === 0 || params.games.length > 200) {
      return { success: false, error: "Invalid games slate provided." };
    }
    for (const g of params.games) {
      if (!isValidUuid(g.homeTeamId) || !isValidUuid(g.awayTeamId)) {
        return { success: false, error: "Slate contains an invalid team ID." };
      }
    }
    const seasonYear = params.seasonYear ?? 2026;
    if (!Number.isInteger(seasonYear) || seasonYear < 1980 || seasonYear > 2100) {
      return { success: false, error: "Invalid season year." };
    }

    const supabase = getAdminClient();
    const predictions = await predictBatchSlate(supabase, params.games, seasonYear);

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

    if (!Array.isArray(predictions) || predictions.length === 0 || predictions.length > 200) {
      return { success: false, error: "Invalid predictions batch." };
    }
    for (const p of predictions) {
      if (!isValidUuid(p.gameId) || !isValidUuid(p.homeTeamId) || !isValidUuid(p.awayTeamId)) {
        return { success: false, error: "Batch contains invalid game or team IDs." };
      }
      validatePredictionMetrics(p.winProbability, p.confidence);
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
      const cleanHomeScore = sanitizePredictedScore(p.predictedHomeScore);
      const cleanAwayScore = sanitizePredictedScore(p.predictedAwayScore);
      if (existingId) {
        updatePromises.push(
          supabase
            .from("predictions")
            .update({
              predicted_home_score: cleanHomeScore,
              predicted_away_score: cleanAwayScore,
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
          predicted_home_score: cleanHomeScore,
          predicted_away_score: cleanAwayScore,
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
    await assertPermission("predictions");
    const supabase = getAdminClient();

    // 1. Fetch season ID (if filtered) and all predictions (with nested linked game) in a single parallel round-trip
    const seasonPromise =
      seasonYear !== "all"
        ? supabase
            .from("seasons")
            .select("id, competitions!inner(name)")
            .eq("year", seasonYear)
            .ilike("competitions.name", "%Universities%")
            .maybeSingle()
        : Promise.resolve({ data: null });

    const predictionsPromise = supabase
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
        away_team:teams!predictions_away_team_id_fkey(id, name),
        game:games!predictions_game_id_fkey(id, date, home_score, away_score, status, season_id, home_team_id, away_team_id)
      `)
      .order("created_at", { ascending: false });

    const [{ data: bucsSeason }, { data: predictions, error: pErr }] = await Promise.all([
      seasonPromise,
      predictionsPromise,
    ]);

    if (pErr) throw pErr;

    let seasonId: string | null = bucsSeason?.id || null;
    if (seasonYear !== "all" && !seasonId) {
      const { data: fallbackSeason } = await supabase
        .from("seasons")
        .select("id")
        .eq("year", seasonYear)
        .limit(1)
        .maybeSingle();
      seasonId = fallbackSeason?.id || null;
    }

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

    // Resolve any unlinked ad-hoc predictions in parallel rather than sequentially
    const unlinkedPreds = predictions.filter((p) => !p.game_id);
    const adHocGamesMap = new Map<string, any>();
    if (unlinkedPreds.length > 0) {
      await Promise.all(
        unlinkedPreds.map(async (p) => {
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
          if (mGame) adHocGamesMap.set(p.id, mGame);
        })
      );
    }

    const matched: any[] = [];
    const teamDiffs = new Map<
      string,
      { teamName: string; offenseDiff: number; defenseDiff: number; games: number }
    >();

    for (const p of predictions) {
      let game: any = null;
      if (p.game_id) {
        const linked = Array.isArray(p.game) ? p.game[0] : p.game;
        if (
          linked &&
          linked.status === "completed" &&
          linked.home_score !== null &&
          linked.away_score !== null &&
          (!seasonId || linked.season_id === seasonId)
        ) {
          game = linked;
        }
      } else {
        game = adHocGamesMap.get(p.id) || null;
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
