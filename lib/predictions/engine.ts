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
  tierContext?: {
    targetTierLabel: string;
    homePriorTierLabel: string;
    awayPriorTierLabel: string;
    homeTierDelta: number;
    awayTierDelta: number;
    summary: string;
  };
  weights: {
    h2hWeight: number;
    commonWeight: number;
    recencyModifier: number;
    homeAdvantage: number;
    baseline: number;
    inSeasonLearningWeight: number;
    pointsPerTier?: number;
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
 * Points per full competitive tier step (empirically calibrated from BUCS promotion/relegation transitions:
 * moving up 1 tier reduces PF by ~10 pts/g and increases PA by ~10 pts/g; moving down 1 tier does the inverse).
 */
export const POINTS_PER_TIER = 10;

export interface CompetitiveTierInfo {
  level: number; // 1.0 = Premier (National), 1.8 = Premier (Regional), 2.7 = Division 1, 3.7 = Division 2
  shortLabel: string;
}

/**
 * Maps any division or playoff phase to its numerical competitive tier level:
 * - 1.0: Premier (National) / National Championship (Top 5 Super League)
 * - 1.8: Premier North / Premier South / National Vase (Regional Premier)
 * - 2.7: Division 1 / National Trophy
 * - 3.7: Division 2 / Conference Cup
 */
export function getCompetitiveTierInfo(
  phaseName?: string | null,
  parentPhaseName?: string | null
): CompetitiveTierInfo {
  const name = (phaseName || '').toLowerCase().trim();
  const parent = (parentPhaseName || '').toLowerCase().trim();
  const combined = `${parent} ${name}`;

  // Postseason brackets mapped to their equivalent competitive tier
  if (name.includes('national championship') || name.includes('college bowl')) {
    return { level: 1.0, shortLabel: 'Premier (National)' };
  }
  if (name.includes('national vase')) {
    return { level: 1.8, shortLabel: 'Premier (Regional)' };
  }
  if (name.includes('national trophy')) {
    return { level: 2.7, shortLabel: 'Division 1' };
  }
  if (name.includes('conference cup') || name.includes('challenge trophy')) {
    return { level: 3.7, shortLabel: 'Division 2' };
  }

  // Regular season divisions
  if (name.includes('premier (national)') || name.includes('super league')) {
    return { level: 1.0, shortLabel: 'Premier (National)' };
  }
  if (combined.includes('premier') || combined.includes('premiership')) {
    return { level: 1.8, shortLabel: 'Premier (Regional)' };
  }
  if (combined.includes('division 1') || combined.includes('div 1') || combined.includes('tier 1')) {
    return { level: 2.7, shortLabel: 'Division 1' };
  }
  if (combined.includes('division 2') || combined.includes('div 2') || combined.includes('tier 2')) {
    return { level: 3.7, shortLabel: 'Division 2' };
  }

  return { level: 2.7, shortLabel: 'Division 1' };
}

/**
 * Ensures a predicted American football score is non-negative and never equals 1
 * (scoring a single point in a game is effectively impossible; 1 rounds down to a 0-point shutout).
 */
export function sanitizePredictedScore(rawScore: number): number {
  const rounded = Math.max(0, Math.round(rawScore));
  return rounded === 1 ? 0 : rounded;
}

/**
 * Returns true if a scoreline is a 1-0 or 0-1 walkover forfeit rather than an on-field score.
 */
export function isWalkoverScoreline(
  homeScore: number | null | undefined,
  awayScore: number | null | undefined
): boolean {
  return (homeScore === 1 && awayScore === 0) || (homeScore === 0 && awayScore === 1);
}

/**
 * Translates a single game's PF and PA from `gameTierLevel` to `targetTierLevel`
 * and returns the tier relevance weight multiplier.
 *
 * - If `tierDiff > 0` (past game was in a lower/easier division than today's game):
 *   penalizes PF by `tierDiff * POINTS_PER_TIER`, increases PA by `tierDiff * POINTS_PER_TIER`,
 *   and discounts the game's weight (`0.65 ^ tierDiff`).
 * - If `tierDiff < 0` (past game was in a higher/harder division — e.g. a relegated team):
 *   boosts PF by `|tierDiff| * POINTS_PER_TIER`, reduces PA by `|tierDiff| * POINTS_PER_TIER`,
 *   and applies a `1.15x` confidence weight for higher-tier experience.
 */
function translateScoreForTier(
  rawPF: number,
  rawPA: number,
  gameTierLevel: number,
  targetTierLevel: number
): { adjPF: number; adjPA: number; tierWeight: number; tierDiff: number } {
  const tierDiff = gameTierLevel - targetTierLevel;
  const adjPF = Math.max(0, rawPF - tierDiff * POINTS_PER_TIER);
  const adjPA = Math.max(0, rawPA + tierDiff * POINTS_PER_TIER);
  const tierWeight =
    tierDiff > 0 ? Math.pow(0.65, tierDiff) : tierDiff < 0 ? 1.15 : 1.0;

  return { adjPF, adjPA, tierWeight, tierDiff };
}

/**
 * Calculates in-season prediction residuals strictly for completed games in `seasonYear`
 * up to `upToDate`.
 */
export async function getInSeasonTeamResiduals(
  supabase: SupabaseClient,
  seasonYear: number,
  upToDate?: string
): Promise<Map<string, { offenseDelta: number; defenseDelta: number; gamesPlayed: number }>> {
  const residuals = new Map<
    string,
    { totalOffenseDiff: number; totalDefenseDiff: number; gamesPlayed: number }
  >();

  // Use !inner on phases and seasons so PostgREST strictly filters to `seasonYear`
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
      phase:phases!games_phase_id_fkey!inner(name, season:seasons!inner(year))
    `)
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .eq('phase.season.year', seasonYear);

  if (upToDate) {
    query = query.lt('date', upToDate);
  }

  const { data: rawCompletedGames, error: gErr } = await query;
  if (gErr || !rawCompletedGames || rawCompletedGames.length === 0) {
    return new Map();
  }

  // Double-guard in JS that only games from `seasonYear` are included
  const completedGames = rawCompletedGames.filter(
    (g: any) => g.phase?.season?.year === seasonYear && !isWalkoverScoreline(g.home_score, g.away_score)
  );

  if (completedGames.length === 0) {
    return new Map();
  }

  const gameIds = completedGames.map((g: any) => g.id);
  const { data: storedPredictions } = await supabase
    .from('predictions')
    .select('game_id, predicted_home_score, predicted_away_score')
    .in('game_id', gameIds);

  const predMap = new Map<string, { predHome: number; predAway: number }>();
  (storedPredictions || []).forEach((p: any) => {
    if (p.game_id) {
      predMap.set(p.game_id, {
        predHome: p.predicted_home_score,
        predAway: p.predicted_away_score,
      });
    }
  });

  completedGames.forEach((game: any) => {
    const homeId = game.home_team_id;
    const awayId = game.away_team_id;
    const actualHome = game.home_score;
    const actualAway = game.away_score;

    const pred = predMap.get(game.id) || { predHome: 18, predAway: 18 };

    const homeOffDiff = actualHome - pred.predHome;
    const awayOffDiff = actualAway - pred.predAway;
    const homeDefDiff = pred.predAway - actualAway;
    const awayDefDiff = pred.predHome - actualHome;

    const h = residuals.get(homeId) || {
      totalOffenseDiff: 0,
      totalDefenseDiff: 0,
      gamesPlayed: 0,
    };
    h.totalOffenseDiff += homeOffDiff;
    h.totalDefenseDiff += homeDefDiff;
    h.gamesPlayed += 1;
    residuals.set(homeId, h);

    const a = residuals.get(awayId) || {
      totalOffenseDiff: 0,
      totalDefenseDiff: 0,
      gamesPlayed: 0,
    };
    a.totalOffenseDiff += awayOffDiff;
    a.totalDefenseDiff += awayDefDiff;
    a.gamesPlayed += 1;
    residuals.set(awayId, a);
  });

  const finalMap = new Map<
    string,
    { offenseDelta: number; defenseDelta: number; gamesPlayed: number }
  >();
  residuals.forEach((val, teamId) => {
    // Clamp per-game residual delta to [-14, +14] so a single blowout doesn't distort projections
    const rawOff = val.totalOffenseDiff / val.gamesPlayed;
    const rawDef = val.totalDefenseDiff / val.gamesPlayed;
    finalMap.set(teamId, {
      offenseDelta: Math.max(-14, Math.min(14, Math.round(rawOff * 10) / 10)),
      defenseDelta: Math.max(-14, Math.min(14, Math.round(rawDef * 10) / 10)),
      gamesPlayed: val.gamesPlayed,
    });
  });

  return finalMap;
}

/**
 * Predicts the score, spread, and win probability for an individual matchup,
 * accounting for the competitive tier of all historical games relative to the current matchup tier.
 */
export async function predictMatchup(
  supabase: SupabaseClient,
  params: {
    gameId?: string;
    homeTeamId: string;
    awayTeamId: string;
    gameDate?: string;
    seasonYear?: number;
    phaseName?: string;
    parentPhaseName?: string | null;
    teamNames?: { home: string; away: string };
    preloadedResiduals?: Map<
      string,
      { offenseDelta: number; defenseDelta: number; gamesPlayed: number }
    >;
  }
): Promise<PredictionResult> {
  const {
    gameId,
    homeTeamId,
    awayTeamId,
    gameDate,
    seasonYear = 2026,
  } = params;

  // 1. Fetch team names if not provided
  let homeName = params.teamNames?.home || '';
  let awayName = params.teamNames?.away || '';
  if (!homeName || !awayName) {
    const { data: teamRows } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', [homeTeamId, awayTeamId]);
    homeName = teamRows?.find((t: any) => t.id === homeTeamId)?.name || 'Home Team';
    awayName = teamRows?.find((t: any) => t.id === awayTeamId)?.name || 'Away Team';
  }

  // 2. Fetch Recent History (last 2 seasons + current season) with !inner join on phase & season
  const startCommonYear = seasonYear - 2;
  let homeHistQuery = supabase
    .from('games')
    .select(
      'id, date, home_team_id, away_team_id, home_score, away_score, is_playoff, phase:phases!games_phase_id_fkey!inner(name, season:seasons!inner(year))'
    )
    .or(`home_team_id.eq.${homeTeamId},away_team_id.eq.${homeTeamId}`)
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .gte('phase.season.year', startCommonYear);

  let awayHistQuery = supabase
    .from('games')
    .select(
      'id, date, home_team_id, away_team_id, home_score, away_score, is_playoff, phase:phases!games_phase_id_fkey!inner(name, season:seasons!inner(year))'
    )
    .or(`home_team_id.eq.${awayTeamId},away_team_id.eq.${awayTeamId}`)
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .gte('phase.season.year', startCommonYear);

  if (gameDate) {
    homeHistQuery = homeHistQuery.lt('date', gameDate);
    awayHistQuery = awayHistQuery.lt('date', gameDate);
  }

  // 3. Fetch H2H Historical Games
  let h2hQuery = supabase
    .from('games')
    .select(`
      id,
      home_team_id,
      away_team_id,
      home_score,
      away_score,
      date,
      is_playoff,
      phase:phases!games_phase_id_fkey!inner(name, season:seasons!inner(year))
    `)
    .or(
      `and(home_team_id.eq.${homeTeamId},away_team_id.eq.${awayTeamId}),and(home_team_id.eq.${awayTeamId},away_team_id.eq.${homeTeamId})`
    )
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);

  if (gameDate) {
    h2hQuery = h2hQuery.lt('date', gameDate);
  }

  const [homeHistoryRes, awayHistoryRes, h2hRes] = await Promise.all([
    homeHistQuery,
    awayHistQuery,
    h2hQuery,
  ]);

  const hGames = ((homeHistoryRes.data || []) as any[]).filter(
    (g) =>
      (g.phase?.season?.year ?? 0) >= startCommonYear &&
      !isWalkoverScoreline(g.home_score, g.away_score)
  );
  const aGames = ((awayHistoryRes.data || []) as any[]).filter(
    (g) =>
      (g.phase?.season?.year ?? 0) >= startCommonYear &&
      !isWalkoverScoreline(g.home_score, g.away_score)
  );
  const h2hGames = ((h2hRes.data || []) as any[]).filter(
    (g) => !isWalkoverScoreline(g.home_score, g.away_score)
  );

  // 4. Determine Target Matchup Tier
  // If `params.phaseName` is provided (Weekly Slate), use it directly.
  // Otherwise (Single Matchup Simulator), look up the teams' current season division or latest regular-season division.
  let targetTierInfo: CompetitiveTierInfo;
  if (params.phaseName) {
    targetTierInfo = getCompetitiveTierInfo(params.phaseName, params.parentPhaseName);
  } else {
    // Check if there is a scheduled/completed game in `seasonYear` for either team to infer their current division
    const { data: currentSeasonPhase } = await supabase
      .from('games')
      .select('phase:phases!games_phase_id_fkey!inner(name, season:seasons!inner(year))')
      .or(`home_team_id.eq.${homeTeamId},away_team_id.eq.${homeTeamId}`)
      .eq('phase.season.year', seasonYear)
      .eq('is_playoff', false)
      .limit(1)
      .maybeSingle();

    const inferredPhaseName =
      (currentSeasonPhase as any)?.phase?.name ||
      hGames.find((g) => !g.is_playoff)?.phase?.name ||
      aGames.find((g) => !g.is_playoff)?.phase?.name ||
      'Division 1';
    targetTierInfo = getCompetitiveTierInfo(inferredPhaseName);
  }

  const targetTier = targetTierInfo.level;

  // 5. Compute Tier-Adjusted Recent Team Strength for Home and Away
  function computeTierAdjustedStrength(games: any[], teamId: string) {
    let pfSum = 0;
    let paSum = 0;
    let weightSum = 0;
    let weightedTierSum = 0;
    let tierTrackWeight = 0;

    for (const g of games) {
      const isHome = g.home_team_id === teamId;
      const rawPF = isHome ? g.home_score ?? 0 : g.away_score ?? 0;
      const rawPA = isHome ? g.away_score ?? 0 : g.home_score ?? 0;
      const gYear = g.phase?.season?.year || seasonYear - 1;
      const gTierInfo = getCompetitiveTierInfo(g.phase?.name);

      const { adjPF, adjPA, tierWeight } = translateScoreForTier(
        rawPF,
        rawPA,
        gTierInfo.level,
        targetTier
      );

      // Season recency weighting: current season > last season > 2 seasons ago
      const recencyWeight =
        gYear >= seasonYear ? 2.2 : gYear === seasonYear - 1 ? 1.5 : 0.85;
      const w = recencyWeight * tierWeight;

      pfSum += adjPF * w;
      paSum += adjPA * w;
      weightSum += w;

      // Track average prior tier from previous season(s) to detect promotions/relegations
      if (gYear < seasonYear && !g.is_playoff) {
        const priorW = gYear === seasonYear - 1 ? 2.0 : 1.0;
        weightedTierSum += gTierInfo.level * priorW;
        tierTrackWeight += priorW;
      }
    }

    const avgPriorTier =
      tierTrackWeight > 0 ? weightedTierSum / tierTrackWeight : targetTier;

    return {
      pf: weightSum > 0 ? pfSum / weightSum : 18,
      pa: weightSum > 0 ? paSum / weightSum : 18,
      avgPriorTier,
      gameCount: games.length,
    };
  }

  const homeStrength = computeTierAdjustedStrength(hGames, homeTeamId);
  const awayStrength = computeTierAdjustedStrength(aGames, awayTeamId);

  const strengthProjectedHome = (homeStrength.pf + awayStrength.pa) / 2;
  const strengthProjectedAway = (awayStrength.pf + homeStrength.pa) / 2;

  // 6. Compute Tier-Adjusted Common Opponents Signal (Last 2 Seasons)
  const homeOpponents = new Set(
    hGames.map((g) => (g.home_team_id === homeTeamId ? g.away_team_id : g.home_team_id))
  );
  const awayOpponents = new Set(
    aGames.map((g) => (g.home_team_id === awayTeamId ? g.away_team_id : g.home_team_id))
  );
  const commonOpponentIds = Array.from(homeOpponents).filter(
    (id) => awayOpponents.has(id) && id !== homeTeamId && id !== awayTeamId
  );

  let commonHomeTotal = 0;
  let commonAwayTotal = 0;
  let commonWeightCount = 0;

  commonOpponentIds.forEach((oppId) => {
    const homeVsOpp = hGames.filter(
      (g) => g.home_team_id === oppId || g.away_team_id === oppId
    );
    const awayVsOpp = aGames.filter(
      (g) => g.home_team_id === oppId || g.away_team_id === oppId
    );

    const hVsStr = computeTierAdjustedStrength(homeVsOpp, homeTeamId);
    const aVsStr = computeTierAdjustedStrength(awayVsOpp, awayTeamId);

    commonHomeTotal += (hVsStr.pf + aVsStr.pa) / 2;
    commonAwayTotal += (aVsStr.pf + hVsStr.pa) / 2;
    commonWeightCount++;
  });

  const commonProjectedHome =
    commonWeightCount > 0 ? commonHomeTotal / commonWeightCount : strengthProjectedHome;
  const commonProjectedAway =
    commonWeightCount > 0 ? commonAwayTotal / commonWeightCount : strengthProjectedAway;

  // 7. Compute Tier-Adjusted H2H Signal (heavily favoring recent university cycles)
  let h2hHomeScore = 0;
  let h2hAwayScore = 0;
  let h2hWeightTotal = 0;
  let recentH2hCount = 0;

  h2hGames.forEach((g) => {
    const isHome = g.home_team_id === homeTeamId;
    const rawHome = isHome ? g.home_score ?? 0 : g.away_score ?? 0;
    const rawAway = isHome ? g.away_score ?? 0 : g.home_score ?? 0;
    const gYear = g.phase?.season?.year || 2020;
    const gTierInfo = getCompetitiveTierInfo(g.phase?.name);

    const { adjPF: adjHome, adjPA: adjAway, tierWeight } = translateScoreForTier(
      rawHome,
      rawAway,
      gTierInfo.level,
      targetTier
    );

    // University rosters turn over every 3 years; discount distant historical H2H
    const yearAge = Math.max(0, seasonYear - gYear);
    if (yearAge <= 3) recentH2hCount++;
    const recencyW =
      yearAge <= 1 ? 2.0 : yearAge === 2 ? 1.4 : yearAge <= 4 ? 0.6 : 0.15;
    const weight = recencyW * tierWeight;

    h2hHomeScore += adjHome * weight;
    h2hAwayScore += adjAway * weight;
    h2hWeightTotal += weight;
  });

  const h2hAvgHome = h2hWeightTotal > 0 ? h2hHomeScore / h2hWeightTotal : strengthProjectedHome;
  const h2hAvgAway = h2hWeightTotal > 0 ? h2hAwayScore / h2hWeightTotal : strengthProjectedAway;

  // 8. Blend Tier-Adjusted Signals (Team Strength + Common Opponents + Recent H2H)
  const h2hShare =
    recentH2hCount >= 3
      ? 0.35
      : recentH2hCount === 2
      ? 0.25
      : recentH2hCount === 1
      ? 0.15
      : h2hGames.length > 0
      ? 0.08
      : 0;
  const commonShare =
    commonWeightCount >= 3
      ? 0.35
      : commonWeightCount >= 1
      ? 0.25
      : 0;
  const strengthShare = Math.max(0, 1 - h2hShare - commonShare);

  const baseHome =
    strengthProjectedHome * strengthShare +
    commonProjectedHome * commonShare +
    h2hAvgHome * h2hShare;

  const baseAway =
    strengthProjectedAway * strengthShare +
    commonProjectedAway * commonShare +
    h2hAvgAway * h2hShare;

  // 9. In-Season Adaptive Residual Learning (strictly current season games)
  const residuals =
    params.preloadedResiduals ||
    (await getInSeasonTeamResiduals(supabase, seasonYear, gameDate));
  const homeRes = residuals.get(homeTeamId) || {
    offenseDelta: 0,
    defenseDelta: 0,
    gamesPlayed: 0,
  };
  const awayRes = residuals.get(awayTeamId) || {
    offenseDelta: 0,
    defenseDelta: 0,
    gamesPlayed: 0,
  };

  const homeAdvantage = 3.0; // Standard UK collegiate home field advantage
  // Scale in-season residual influence by number of current-season games played
  const homeInSeasonFactor = Math.min(0.55, homeRes.gamesPlayed * 0.2);
  const awayInSeasonFactor = Math.min(0.55, awayRes.gamesPlayed * 0.2);

  const inSeasonHomeOffenseAdjustment = homeRes.offenseDelta * homeInSeasonFactor;
  const inSeasonAwayOffenseAdjustment = awayRes.offenseDelta * awayInSeasonFactor;
  const inSeasonHomeDefenseAdjustment = awayRes.defenseDelta * (awayInSeasonFactor * 0.45);
  const inSeasonAwayDefenseAdjustment = homeRes.defenseDelta * (homeInSeasonFactor * 0.45);

  const finalHomeScore = sanitizePredictedScore(
    baseHome +
      inSeasonHomeOffenseAdjustment -
      inSeasonHomeDefenseAdjustment +
      homeAdvantage
  );

  const finalAwayScore = sanitizePredictedScore(
    baseAway + inSeasonAwayOffenseAdjustment - inSeasonAwayDefenseAdjustment
  );

  // Win probability via logistic margin mapping: Margin / 14 scale
  const projectedMargin = finalHomeScore - finalAwayScore;
  const winProbability = Math.min(
    95,
    Math.max(5, Math.round(100 / (1 + Math.pow(10, -projectedMargin / 14))))
  );

  // Confidence Rating
  const totalEvidenceGames = hGames.length + aGames.length;
  const confidence: 'High' | 'Medium' | 'Low' =
    recentH2hCount >= 2 ||
    (commonWeightCount >= 2 && totalEvidenceGames >= 12) ||
    totalEvidenceGames >= 18
      ? 'High'
      : totalEvidenceGames >= 8 || commonWeightCount >= 1
      ? 'Medium'
      : 'Low';

  // Build descriptive Tier & Form Context
  const homeTierDelta = Math.round((homeStrength.avgPriorTier - targetTier) * 10) / 10;
  const awayTierDelta = Math.round((awayStrength.avgPriorTier - targetTier) * 10) / 10;

  const tierNotes: string[] = [];
  if (homeTierDelta >= 0.4) {
    tierNotes.push(`${homeName} promoted (tier adj -${Math.round(homeTierDelta * POINTS_PER_TIER)} pts)`);
  } else if (homeTierDelta <= -0.4) {
    tierNotes.push(`${homeName} relegated (tier adj +${Math.round(Math.abs(homeTierDelta) * POINTS_PER_TIER)} pts)`);
  }

  if (awayTierDelta >= 0.4) {
    tierNotes.push(`${awayName} promoted (tier adj -${Math.round(awayTierDelta * POINTS_PER_TIER)} pts)`);
  } else if (awayTierDelta <= -0.4) {
    tierNotes.push(`${awayName} relegated (tier adj +${Math.round(Math.abs(awayTierDelta) * POINTS_PER_TIER)} pts)`);
  }

  const formParts: string[] = [...tierNotes];
  if (homeRes.gamesPlayed > 0) {
    formParts.push(
      `${homeName} ${seasonYear} form: ${homeRes.offenseDelta >= 0 ? '+' : ''}${homeRes.offenseDelta} pts`
    );
  }
  if (awayRes.gamesPlayed > 0) {
    formParts.push(
      `${awayName} ${seasonYear} form: ${awayRes.offenseDelta >= 0 ? '+' : ''}${awayRes.offenseDelta} pts`
    );
  }

  const formDesc =
    formParts.length > 0 ? formParts.join(' | ') : `Tier-Adjusted (${targetTierInfo.shortLabel})`;

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
    h2hCount: h2hGames.length,
    commonOpponentsCount: commonWeightCount,
    inSeasonAdjustment: {
      homeOffenseDelta: homeRes.offenseDelta,
      awayOffenseDelta: awayRes.offenseDelta,
      homeDefenseDelta: homeRes.defenseDelta,
      awayDefenseDelta: awayRes.defenseDelta,
      description: formDesc,
    },
    tierContext: {
      targetTierLabel: targetTierInfo.shortLabel,
      homePriorTierLabel:
        homeStrength.avgPriorTier <= 1.3
          ? 'Premier (National)'
          : homeStrength.avgPriorTier <= 2.1
          ? 'Premier (Regional)'
          : homeStrength.avgPriorTier <= 3.1
          ? 'Division 1'
          : 'Division 2',
      awayPriorTierLabel:
        awayStrength.avgPriorTier <= 1.3
          ? 'Premier (National)'
          : awayStrength.avgPriorTier <= 2.1
          ? 'Premier (Regional)'
          : awayStrength.avgPriorTier <= 3.1
          ? 'Division 1'
          : 'Division 2',
      homeTierDelta,
      awayTierDelta,
      summary: tierNotes.length > 0 ? tierNotes.join(' • ') : `Both teams accustomed to ${targetTierInfo.shortLabel}`,
    },
    weights: {
      h2hWeight: h2hShare,
      commonWeight: commonShare,
      recencyModifier: 1.5,
      homeAdvantage,
      baseline: 18,
      inSeasonLearningWeight: Math.max(homeInSeasonFactor, awayInSeasonFactor),
      pointsPerTier: POINTS_PER_TIER,
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
  const sortedDates = games.map((g) => g.date).sort();
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
      phaseName: g.phaseName,
      parentPhaseName: g.parentPhaseName,
      teamNames: { home: g.homeTeamName, away: g.awayTeamName },
      preloadedResiduals: residuals,
    });
    results.push(pred);
  }

  return results;
}
