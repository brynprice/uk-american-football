import { SupabaseClient } from '@supabase/supabase-js';

export interface PredictionResult {
  gameId?: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  winProbability: number; // 0-100%
  confidence: 'High' | 'Medium' | 'Low';
  h2hCount: number;
  commonOpponentsCount: number;
  inSeasonAdjustment: {
    homeOffenseDelta: number;
    awayOffenseDelta: number;
    homeDefenseDelta: number;
    awayDefenseDelta: number;
    description: string;
  };
  weights: {
    h2hWeight: number;
    commonWeight: number;
    recencyModifier: number;
    homeAdvantage: number;
    baseline: number;
    inSeasonLearningWeight: number;
  };
}

export interface SlateGame {
  id: string;
  date: string;
  time?: string | null;
  phaseId: string;
  phaseName: string;
  parentPhaseName?: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number | null;
  awayScore?: number | null;
  status: string;
  existingPrediction?: {
    id: string;
    predictedHomeScore: number;
    predictedAwayScore: number;
    winProbability: number;
    confidence: string;
    createdAt: string;
  } | null;
}

export interface GameWeekDefinition {
  weekNumber: number;
  label: string;
  startDate: string;
  endDate: string;
  gameCount: number;
}

// 12 Canonical 2026/27 BUCS Game Weeks
export const BUCS_2026_WEEKS: GameWeekDefinition[] = [
  { weekNumber: 1, label: 'Week 1 (24–25 Oct 2026)', startDate: '2026-10-24', endDate: '2026-10-25', gameCount: 20 },
  { weekNumber: 2, label: 'Week 2 (31 Oct–01 Nov 2026)', startDate: '2026-10-31', endDate: '2026-11-01', gameCount: 23 },
  { weekNumber: 3, label: 'Week 3 (07–08 Nov 2026)', startDate: '2026-11-07', endDate: '2026-11-08', gameCount: 25 },
  { weekNumber: 4, label: 'Week 4 (14–15 Nov 2026)', startDate: '2026-11-14', endDate: '2026-11-15', gameCount: 21 },
  { weekNumber: 5, label: 'Week 5 (21–22 Nov 2026)', startDate: '2026-11-21', endDate: '2026-11-22', gameCount: 24 },
  { weekNumber: 6, label: 'Week 6 (28–29 Nov 2026)', startDate: '2026-11-28', endDate: '2026-11-29', gameCount: 25 },
  { weekNumber: 7, label: 'Week 7 (05–13 Dec 2026)', startDate: '2026-12-05', endDate: '2026-12-13', gameCount: 27 },
  { weekNumber: 8, label: 'Week 8 (24 Jan 2027)', startDate: '2027-01-24', endDate: '2027-01-24', gameCount: 21 },
  { weekNumber: 9, label: 'Week 9 (30–31 Jan 2027)', startDate: '2027-01-30', endDate: '2027-01-31', gameCount: 23 },
  { weekNumber: 10, label: 'Week 10 (06–07 Feb 2027)', startDate: '2027-02-06', endDate: '2027-02-07', gameCount: 27 },
  { weekNumber: 11, label: 'Week 11 (13–14 Feb 2027)', startDate: '2027-02-13', endDate: '2027-02-14', gameCount: 25 },
  { weekNumber: 12, label: 'Week 12 (20–21 Feb 2027)', startDate: '2027-02-20', endDate: '2027-02-21', gameCount: 15 },
];

/**
 * Calculates in-season prediction residuals for all teams in a given season.
 * Measures how actual scores differ from expected/predicted baselines to learn team form.
 */
export async function getInSeasonTeamResiduals(
  supabase: SupabaseClient,
  seasonYear: number,
  upToDate?: string
): Promise<Map<string, { offenseDelta: number; defenseDelta: number; gamesPlayed: number }>> {
  const residuals = new Map<string, { totalOffenseDiff: number; totalDefenseDiff: number; gamesPlayed: number }>();

  // Fetch all completed games for this season up to the target date
  let query = supabase
    .from('games')
    .select(`
      id,
      home_team_id,
      away_team_id,
      home_score,
      away_score,
      date,
      status,
      phase:phases!games_phase_id_fkey(season:seasons(year))
    `)
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .filter('phase.season.year', 'eq', seasonYear);

  if (upToDate) {
    query = query.lt('date', upToDate);
  }

  const { data: completedGames, error: gErr } = await query;
  if (gErr || !completedGames || completedGames.length === 0) {
    return new Map();
  }

  // Fetch any past stored predictions for these games to evaluate prediction residuals
  const gameIds = completedGames.map(g => g.id);
  const { data: storedPredictions } = await supabase
    .from('predictions')
    .select('game_id, predicted_home_score, predicted_away_score')
    .in('game_id', gameIds);

  const predMap = new Map<string, { predHome: number; predAway: number }>();
  (storedPredictions || []).forEach(p => {
    if (p.game_id) {
      predMap.set(p.game_id, {
        predHome: p.predicted_home_score,
        predAway: p.predicted_away_score,
      });
    }
  });

  completedGames.forEach(game => {
    const homeId = game.home_team_id;
    const awayId = game.away_team_id;
    const actualHome = game.home_score;
    const actualAway = game.away_score;

    // Use stored prediction if available; otherwise use neutral 20-20 baseline
    const pred = predMap.get(game.id) || { predHome: 20, predAway: 20 };

    // Offense residual: actual - predicted (positive means scoring more than expected)
    const homeOffDiff = actualHome - pred.predHome;
    const awayOffDiff = actualAway - pred.predAway;

    // Defense residual: predicted - actual (positive means allowing fewer than expected)
    const homeDefDiff = pred.predAway - actualAway;
    const awayDefDiff = pred.predHome - actualHome;

    // Accumulate Home
    const h = residuals.get(homeId) || { totalOffenseDiff: 0, totalDefenseDiff: 0, gamesPlayed: 0 };
    h.totalOffenseDiff += homeOffDiff;
    h.totalDefenseDiff += homeDefDiff;
    h.gamesPlayed += 1;
    residuals.set(homeId, h);

    // Accumulate Away
    const a = residuals.get(awayId) || { totalOffenseDiff: 0, totalDefenseDiff: 0, gamesPlayed: 0 };
    a.totalOffenseDiff += awayOffDiff;
    a.totalDefenseDiff += awayDefDiff;
    a.gamesPlayed += 1;
    residuals.set(awayId, a);
  });

  const finalMap = new Map<string, { offenseDelta: number; defenseDelta: number; gamesPlayed: number }>();
  residuals.forEach((val, teamId) => {
    finalMap.set(teamId, {
      offenseDelta: Math.round((val.totalOffenseDiff / val.gamesPlayed) * 10) / 10,
      defenseDelta: Math.round((val.totalDefenseDiff / val.gamesPlayed) * 10) / 10,
      gamesPlayed: val.gamesPlayed,
    });
  });

  return finalMap;
}

/**
 * Predicts the score, spread, and win probability for an individual matchup.
 */
export async function predictMatchup(
  supabase: SupabaseClient,
  params: {
    gameId?: string;
    homeTeamId: string;
    awayTeamId: string;
    gameDate?: string;
    seasonYear?: number;
    teamNames?: { home: string; away: string };
    preloadedResiduals?: Map<string, { offenseDelta: number; defenseDelta: number; gamesPlayed: number }>;
  }
): Promise<PredictionResult> {
  const { gameId, homeTeamId, awayTeamId, gameDate, seasonYear = 2026 } = params;

  // 1. Fetch team names if not provided
  let homeName = params.teamNames?.home || '';
  let awayName = params.teamNames?.away || '';
  if (!homeName || !awayName) {
    const { data: teamRows } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', [homeTeamId, awayTeamId]);
    homeName = teamRows?.find(t => t.id === homeTeamId)?.name || 'Home Team';
    awayName = teamRows?.find(t => t.id === awayTeamId)?.name || 'Away Team';
  }

  // 2. Fetch H2H Historical Games
  let h2hQuery = supabase
    .from('games')
    .select(`
      id,
      home_team_id,
      away_team_id,
      home_score,
      away_score,
      date,
      phase:phases!games_phase_id_fkey(season:seasons(year))
    `)
    .or(`and(home_team_id.eq.${homeTeamId},away_team_id.eq.${awayTeamId}),and(home_team_id.eq.${awayTeamId},away_team_id.eq.${homeTeamId})`)
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);

  if (gameDate) {
    h2hQuery = h2hQuery.lt('date', gameDate);
  }

  const { data: h2hGames } = await h2hQuery;

  let h2hHomeScore = 0;
  let h2hAwayScore = 0;
  let h2hWeightTotal = 0;
  let h2hWins = 0;

  (h2hGames || []).forEach(g => {
    const isHome = g.home_team_id === homeTeamId;
    const gYear = (g as any).phase?.season?.year || 2020;
    const weight = gYear >= seasonYear - 2 ? 1.5 : 1.0;

    if (isHome) {
      h2hHomeScore += (g.home_score ?? 0) * weight;
      h2hAwayScore += (g.away_score ?? 0) * weight;
      if ((g.home_score ?? 0) > (g.away_score ?? 0)) h2hWins += 1;
    } else {
      h2hHomeScore += (g.away_score ?? 0) * weight;
      h2hAwayScore += (g.home_score ?? 0) * weight;
      if ((g.away_score ?? 0) > (g.home_score ?? 0)) h2hWins += 1;
    }
    h2hWeightTotal += weight;
  });

  const h2hAvgHome = h2hWeightTotal > 0 ? h2hHomeScore / h2hWeightTotal : 20;
  const h2hAvgAway = h2hWeightTotal > 0 ? h2hAwayScore / h2hWeightTotal : 20;
  const h2hWinPct = h2hGames && h2hGames.length > 0 ? h2hWins / h2hGames.length : 0.5;

  // 3. Common Opponents (Last 2 seasons)
  const startCommonYear = seasonYear - 2;
  const [homeHistory, awayHistory] = await Promise.all([
    supabase
      .from('games')
      .select('home_team_id, away_team_id, home_score, away_score, phase:phases!games_phase_id_fkey(season:seasons(year))')
      .or(`home_team_id.eq.${homeTeamId},away_team_id.eq.${homeTeamId}`)
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .filter('phase.season.year', 'gte', startCommonYear),
    supabase
      .from('games')
      .select('home_team_id, away_team_id, home_score, away_score, phase:phases!games_phase_id_fkey(season:seasons(year))')
      .or(`home_team_id.eq.${awayTeamId},away_team_id.eq.${awayTeamId}`)
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .filter('phase.season.year', 'gte', startCommonYear),
  ]);

  const hGames = (homeHistory.data || []) as any[];
  const aGames = (awayHistory.data || []) as any[];

  const homeOpponents = new Set(hGames.map(g => (g.home_team_id === homeTeamId ? g.away_team_id : g.home_team_id)));
  const awayOpponents = new Set(aGames.map(g => (g.home_team_id === awayTeamId ? g.away_team_id : g.home_team_id)));
  const commonOpponentIds = Array.from(homeOpponents).filter(id => awayOpponents.has(id) && id !== homeTeamId && id !== awayTeamId);

  let commonHomeDelta = 0;
  let commonAwayDelta = 0;
  let commonWeight = 0;

  commonOpponentIds.forEach(oppId => {
    const homeVsOpp = hGames.filter(g => g.home_team_id === oppId || g.away_team_id === oppId);
    const awayVsOpp = aGames.filter(g => g.home_team_id === oppId || g.away_team_id === oppId);

    const avgHomeFor = homeVsOpp.reduce((acc, g) => acc + (g.home_team_id === homeTeamId ? g.home_score : g.away_score), 0) / homeVsOpp.length;
    const avgHomeAgainst = homeVsOpp.reduce((acc, g) => acc + (g.home_team_id === homeTeamId ? g.away_score : g.home_score), 0) / homeVsOpp.length;

    const avgAwayFor = awayVsOpp.reduce((acc, g) => acc + (g.home_team_id === awayTeamId ? g.home_score : g.away_score), 0) / awayVsOpp.length;
    const avgAwayAgainst = awayVsOpp.reduce((acc, g) => acc + (g.home_team_id === awayTeamId ? g.away_score : g.home_score), 0) / awayVsOpp.length;

    commonHomeDelta += avgHomeFor - avgAwayAgainst;
    commonAwayDelta += avgAwayFor - avgHomeAgainst;
    commonWeight++;
  });

  const commonAvgHome = commonWeight > 0 ? commonHomeDelta / commonWeight : 0;
  const commonAvgAway = commonWeight > 0 ? commonAwayDelta / commonWeight : 0;

  // 4. In-Season Adaptive Residual Learning
  const residuals = params.preloadedResiduals || (await getInSeasonTeamResiduals(supabase, seasonYear, gameDate));
  const homeRes = residuals.get(homeTeamId) || { offenseDelta: 0, defenseDelta: 0, gamesPlayed: 0 };
  const awayRes = residuals.get(awayTeamId) || { offenseDelta: 0, defenseDelta: 0, gamesPlayed: 0 };

  // 5. Weight Synthesis & Score Derivation
  const h2hWeight = 0.6;
  const commonWeightRatio = 0.4;
  const homeAdvantage = 3.0; // Standard UK collegiate home field advantage
  const inSeasonFactor = 0.7; // How strongly current-season form adjusts predictions

  const baseHome = h2hGames && h2hGames.length > 0
    ? h2hAvgHome * h2hWeight + Math.max(0, h2hAvgHome + commonAvgHome) * commonWeightRatio
    : Math.max(0, 20 + commonAvgHome);

  const baseAway = h2hGames && h2hGames.length > 0
    ? h2hAvgAway * h2hWeight + Math.max(0, h2hAvgAway + commonAvgAway) * commonWeightRatio
    : Math.max(0, 20 + commonAvgAway);

  // Apply In-Season Learned Form + Home Advantage
  // If a team is scoring above expectations, boost offense; if opponent defense is tough, deduct
  const inSeasonHomeOffenseAdjustment = homeRes.offenseDelta * inSeasonFactor;
  const inSeasonAwayOffenseAdjustment = awayRes.offenseDelta * inSeasonFactor;
  const inSeasonHomeDefenseAdjustment = awayRes.defenseDelta * 0.3;
  const inSeasonAwayDefenseAdjustment = homeRes.defenseDelta * 0.3;

  const finalHomeScore = Math.max(
    0,
    Math.round(baseHome + inSeasonHomeOffenseAdjustment - inSeasonHomeDefenseAdjustment + homeAdvantage)
  );

  const finalAwayScore = Math.max(
    0,
    Math.round(baseAway + inSeasonAwayOffenseAdjustment - inSeasonAwayDefenseAdjustment)
  );

  // Win probability via logistic margin mapping: Margin / 14 scale
  const projectedMargin = finalHomeScore - finalAwayScore;
  const winProbability = Math.min(
    95,
    Math.max(5, Math.round(100 / (1 + Math.pow(10, -projectedMargin / 14))))
  );

  // Confidence Rating
  const hasHistory = (h2hGames?.length || 0) > 0;
  const confidence: 'High' | 'Medium' | 'Low' =
    (h2hGames?.length || 0) >= 5 || (commonWeight >= 4 && (homeRes.gamesPlayed > 0 || awayRes.gamesPlayed > 0))
      ? 'High'
      : (h2hGames?.length || 0) >= 2 || commonWeight >= 2
      ? 'Medium'
      : 'Low';

  let formDesc = 'Historical Baseline';
  if (homeRes.gamesPlayed > 0 || awayRes.gamesPlayed > 0) {
    const parts = [];
    if (homeRes.gamesPlayed > 0) {
      parts.push(`${homeName} in-season form: ${homeRes.offenseDelta >= 0 ? '+' : ''}${homeRes.offenseDelta} pts`);
    }
    if (awayRes.gamesPlayed > 0) {
      parts.push(`${awayName} in-season form: ${awayRes.offenseDelta >= 0 ? '+' : ''}${awayRes.offenseDelta} pts`);
    }
    formDesc = parts.join(' | ');
  }

  return {
    gameId,
    homeTeamId,
    awayTeamId,
    homeTeamName: homeName,
    awayTeamName: awayName,
    predictedHomeScore: finalHomeScore,
    predictedAwayScore: finalAwayScore,
    winProbability,
    confidence,
    h2hCount: h2hGames?.length || 0,
    commonOpponentsCount: commonWeight,
    inSeasonAdjustment: {
      homeOffenseDelta: homeRes.offenseDelta,
      awayOffenseDelta: awayRes.offenseDelta,
      homeDefenseDelta: homeRes.defenseDelta,
      awayDefenseDelta: awayRes.defenseDelta,
      description: formDesc,
    },
    weights: {
      h2hWeight,
      commonWeight: commonWeightRatio,
      recencyModifier: 1.5,
      homeAdvantage,
      baseline: 20,
      inSeasonLearningWeight: inSeasonFactor,
    },
  };
}

/**
 * Predicts all games in a weekly slate in batch.
 */
export async function predictBatchSlate(
  supabase: SupabaseClient,
  games: SlateGame[],
  seasonYear: number = 2026
): Promise<PredictionResult[]> {
  if (games.length === 0) return [];

  // Determine earliest date in slate to scope in-season residuals
  const sortedDates = games.map(g => g.date).sort();
  const earliestDate = sortedDates[0];

  // Pre-load in-season residuals once for all games in the slate
  const residuals = await getInSeasonTeamResiduals(supabase, seasonYear, earliestDate);

  const results: PredictionResult[] = [];
  for (const g of games) {
    const pred = await predictMatchup(supabase, {
      gameId: g.id,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      gameDate: g.date,
      seasonYear,
      teamNames: { home: g.homeTeamName, away: g.awayTeamName },
      preloadedResiduals: residuals,
    });
    results.push(pred);
  }

  return results;
}
