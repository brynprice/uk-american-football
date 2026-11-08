/**
 * UK American Football Archive - Weekly Interesting Facts Engine
 * 
 * Analyzes any slate/week of games against the complete 40+ year historical archive:
 * - All-Time & Level Scorigamis (totally unique scores)
 * - Historical Rivalry Context (inaugural matchups, hiatuses, revenge wins, head-to-head dominance)
 * - Extremes of the Week (shootouts, defensive slugfests, blowouts, nailbiters)
 * - The Shutout Wall & clean sheet streaks
 * - Program Records & Historical Milestones (all-time program highs, largest defeats, milestone wins)
 * - Season Standings & Momentum (perfect starts, winless struggles, bounce-back wins)
 * - Brighton Tsunami / Panthers Historical Spotlight (following repo rules)
 * - Fixture postponements & awarded games
 */

import { BUCS_2026_WEEKS } from './constants.mjs';

/**
 * Resolves the target date window and metadata for a requested week or date range.
 * 
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} options
 * @param {string} [options.startDate]
 * @param {string} [options.endDate]
 * @param {number} [options.week]
 * @param {number} [options.season]
 * @param {boolean} [options.pastWeek]
 * @returns {Promise<{ startDate: string, endDate: string, label: string, seasonYear: number, weekNumber?: number }>}
 */
export async function resolveWeekWindow(supabase, options = {}) {
  const { startDate, endDate, week, season, pastWeek } = options;

  // 1. Explicit start & end date
  if (startDate && endDate) {
    return {
      startDate,
      endDate,
      label: `Slate (${startDate} to ${endDate})`,
      seasonYear: season || new Date(startDate).getFullYear()
    };
  }

  // 2. Explicit week number (BUCS 2026/27)
  const targetSeason = season || 2026;
  if (week) {
    const found = BUCS_2026_WEEKS.find(w => w.weekNumber === Number(week));
    if (found) {
      return {
        startDate: found.startDate,
        endDate: found.endDate,
        label: found.label,
        seasonYear: targetSeason,
        weekNumber: found.weekNumber
      };
    }
  }

  // 3. Past week / Latest completed week resolution
  // Find the date of the latest completed game with a recorded score
  const { data: latestGame, error } = await supabase
    .from('games')
    .select('date')
    .not('date', 'is', null)
    .not('home_score', 'is', null)
    .eq('status', 'completed')
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (error || !latestGame || !latestGame.date) {
    throw new Error('Could not find latest completed game in archive: ' + (error?.message || 'No games found'));
  }

  const latestDate = latestGame.date;

  // Check if latest date matches one of our defined game weeks
  const matchedWeek = BUCS_2026_WEEKS.find(w => latestDate >= w.startDate && latestDate <= w.endDate);
  if (matchedWeek) {
    return {
      startDate: matchedWeek.startDate,
      endDate: matchedWeek.endDate,
      label: matchedWeek.label,
      seasonYear: targetSeason,
      weekNumber: matchedWeek.weekNumber
    };
  }

  // Fallback: window spanning the weekend of the latest date (Monday to Sunday)
  const d = new Date(latestDate);
  const day = d.getDay(); // 0 is Sun, 1 is Mon...
  const diffToMon = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diffToMon));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  const fmt = (dt) => dt.toISOString().split('T')[0];
  const startStr = fmt(mon);
  const endStr = fmt(sun);

  return {
    startDate: startStr,
    endDate: endStr,
    label: `Week ending ${latestDate} (${startStr} to ${endStr})`,
    seasonYear: targetSeason
  };
}

/**
 * Main fact generator function.
 * 
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} options
 * @returns {Promise<Object>} Structured fact sheet
 */
export async function generateWeeklyFacts(supabase, options = {}) {
  const window = await resolveWeekWindow(supabase, options);
  const { startDate, endDate, label, seasonYear, weekNumber } = window;

  // 1. Fetch all games in the slate
  const { data: slateGames, error: slateErr } = await supabase
    .from('games')
    .select(`
      *,
      home_team:home_team_id(id, name, team_type),
      away_team:away_team_id(id, name, team_type),
      phase:phases!games_phase_id_fkey(
        id,
        name,
        type,
        season:seasons(id, year, competition:competitions(name, level))
      )
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (slateErr) {
    throw new Error('Failed to fetch slate games: ' + slateErr.message);
  }

  const completedGames = (slateGames || []).filter(g => g.status === 'completed' && g.home_score !== null && g.away_score !== null);
  const postponedGames = (slateGames || []).filter(g => g.status === 'postponed');
  const awardedGames = (slateGames || []).filter(g => g.status === 'awarded');
  const totalPoints = completedGames.reduce((acc, g) => acc + (g.home_score || 0) + (g.away_score || 0), 0);
  const avgPoints = completedGames.length > 0 ? (totalPoints / completedGames.length).toFixed(1) : '0';

  // 2. Fetch parallel historical head-to-head records for all completed games
  const h2hPromises = completedGames.map(async (g) => {
    const t1 = g.home_team.id;
    const t2 = g.away_team.id;

    // Fetch previous completed meetings prior to this game
    const { data: priorMeetings } = await supabase
      .from('games')
      .select('id, date, home_score, away_score, home_team_id, away_team_id, status')
      .or(`and(home_team_id.eq.${t1},away_team_id.eq.${t2}),and(home_team_id.eq.${t2},away_team_id.eq.${t1})`)
      .not('home_score', 'is', null)
      .lt('date', g.date)
      .order('date', { ascending: false });

    return { gameId: g.id, priorMeetings: priorMeetings || [] };
  });

  // 3. Fetch all-time team game records for participating teams
  const participatingTeamIds = Array.from(new Set(
    completedGames.flatMap(g => [g.home_team.id, g.away_team.id])
  ));

  const teamStatsPromises = participatingTeamIds.map(async (teamId) => {
    const { data: teamGames } = await supabase
      .from('games')
      .select('id, date, home_score, away_score, home_team_id, away_team_id, status')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .not('home_score', 'is', null)
      .lte('date', endDate);

    return { teamId, games: teamGames || [] };
  });

  // 4. Fetch season standings context up to this week
  const seasonId = slateGames[0]?.season_id;
  let seasonGamesQuery = supabase
    .from('games')
    .select('id, date, home_score, away_score, status, home_team_id, away_team_id')
    .lte('date', endDate)
    .in('status', ['completed', 'awarded'])
    .not('home_score', 'is', null);

  if (seasonId) {
    seasonGamesQuery = seasonGamesQuery.eq('season_id', seasonId);
  }

  const [h2hResultsList, teamStatsList, { data: seasonGames }] = await Promise.all([
    Promise.all(h2hPromises),
    Promise.all(teamStatsPromises),
    seasonGamesQuery
  ]);

  const h2hMap = new Map(h2hResultsList.map(item => [item.gameId, item.priorMeetings]));
  const teamStatsMap = new Map(teamStatsList.map(item => [item.teamId, item.games]));

  // Build team records in current season up to endDate
  const teamSeasonRecords = new Map();
  for (const sg of (seasonGames || [])) {
    const ht = sg.home_team_id;
    const at = sg.away_team_id;
    if (!teamSeasonRecords.has(ht)) teamSeasonRecords.set(ht, { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0 });
    if (!teamSeasonRecords.has(at)) teamSeasonRecords.set(at, { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0 });

    const hRec = teamSeasonRecords.get(ht);
    const aRec = teamSeasonRecords.get(at);
    hRec.pf += sg.home_score;
    hRec.pa += sg.away_score;
    aRec.pf += sg.away_score;
    aRec.pa += sg.home_score;

    if (sg.home_score > sg.away_score) {
      hRec.wins++;
      aRec.losses++;
    } else if (sg.away_score > sg.home_score) {
      aRec.wins++;
      hRec.losses++;
    } else {
      hRec.ties++;
      aRec.ties++;
    }
  }

  // --- ANALYSIS SECTION ---

  // A. Scorigamis
  const allTimeScorigamis = [];
  const levelScorigamis = [];
  for (const g of completedGames) {
    const higherScore = Math.max(g.home_score, g.away_score);
    const lowerScore = Math.min(g.home_score, g.away_score);
    const winner = g.home_score >= g.away_score ? g.home_team.name : g.away_team.name;
    const loser = g.home_score >= g.away_score ? g.away_team.name : g.home_team.name;

    if (g.is_totally_unique) {
      allTimeScorigamis.push({
        game: `${g.home_team.name} ${g.home_score} - ${g.away_score} ${g.away_team.name}`,
        score: `${higherScore}-${lowerScore}`,
        winner,
        loser,
        division: g.phase?.name,
        date: g.date,
        description: `FIRST TIME in recorded British American Football history (across all levels in 40+ years) that a game finished ${higherScore}-${lowerScore}!`
      });
    } else if (g.is_unique_score) {
      levelScorigamis.push({
        game: `${g.home_team.name} ${g.home_score} - ${g.away_score} ${g.away_team.name}`,
        score: `${higherScore}-${lowerScore}`,
        winner,
        loser,
        level: g.game_level || 'University',
        division: g.phase?.name,
        date: g.date,
        description: `First time in ${g.game_level || 'University'} football history a game finished with a ${higherScore}-${lowerScore} scoreline!`
      });
    }
  }

  // B. Matchup Rivalries & Historical Context
  const inauguralMatchups = [];
  const longHiatusMatchups = [];
  const revengeGames = [];
  const seriesStreaks = [];
  const h2hSummaries = [];

  for (const g of completedGames) {
    const prior = h2hMap.get(g.id) || [];
    const hName = g.home_team.name;
    const aName = g.away_team.name;
    const hScore = g.home_score;
    const aScore = g.away_score;
    const homeWon = hScore > aScore;
    const awayWon = aScore > hScore;
    const winnerName = homeWon ? hName : (awayWon ? aName : 'Tie');

    if (prior.length === 0) {
      inauguralMatchups.push({
        game: `${hName} ${hScore} - ${aScore} ${aName}`,
        division: g.phase?.name,
        description: `Inaugural meeting: This was the first recorded matchup between ${hName} and ${aName} in archive history.`
      });
      continue;
    }

    // Tally prior records
    let homePriorWins = 0;
    let awayPriorWins = 0;
    let ties = 0;
    for (const p of prior) {
      const pHomeIsCurrentHome = p.home_team_id === g.home_team.id;
      const t1Score = pHomeIsCurrentHome ? p.home_score : p.away_score;
      const t2Score = pHomeIsCurrentHome ? p.away_score : p.home_score;
      if (t1Score > t2Score) homePriorWins++;
      else if (t2Score > t1Score) awayPriorWins++;
      else ties++;
    }

    const lastMeeting = prior[0];
    const lastHomeWon = lastMeeting.home_team_id === g.home_team.id
      ? lastMeeting.home_score > lastMeeting.away_score
      : lastMeeting.away_score > lastMeeting.home_score;
    const lastWinner = lastHomeWon ? hName : aName;

    // Check Hiatus (>= 4 years)
    if (lastMeeting.date) {
      const lastYear = new Date(lastMeeting.date).getFullYear();
      const currentYear = new Date(g.date).getFullYear();
      const diffYears = currentYear - lastYear;
      if (diffYears >= 4) {
        longHiatusMatchups.push({
          game: `${hName} ${hScore} - ${aScore} ${aName}`,
          diffYears,
          lastMeetingDate: lastMeeting.date,
          lastScore: `${lastMeeting.home_score}-${lastMeeting.away_score}`,
          description: `First meeting in ${diffYears} years (since ${lastMeeting.date}, when it was ${lastMeeting.home_score}-${lastMeeting.away_score}).`
        });
      }
    }

    // Check Revenge / Reversal (Opponent won last time, winner turned it around)
    if (lastWinner !== winnerName && winnerName !== 'Tie') {
      const winScore = Math.max(hScore, aScore);
      const loseScore = Math.min(hScore, aScore);
      const prevWinScore = Math.max(lastMeeting.home_score, lastMeeting.away_score);
      const prevLoseScore = Math.min(lastMeeting.home_score, lastMeeting.away_score);
      revengeGames.push({
        winner: winnerName,
        loser: winnerName === hName ? aName : hName,
        currentScore: `${winScore}-${loseScore}`,
        lastMeetingDate: lastMeeting.date,
        lastWinner,
        lastScore: `${prevWinScore}-${prevLoseScore}`,
        description: `${winnerName} avenged their previous defeat against ${lastWinner} (who won ${prevWinScore}-${prevLoseScore} on ${lastMeeting.date}).`
      });
    }

    // Check head-to-head win streak (3 or more consecutive wins by one team against the other)
    let currentStreak = 0;
    let streakTeam = null;
    const allMeetings = [
      { home_score: hScore, away_score: aScore, home_team_id: g.home_team.id, away_team_id: g.away_team.id },
      ...prior
    ];
    for (const p of allMeetings) {
      const winnerId = p.home_score > p.away_score ? p.home_team_id : (p.away_score > p.home_score ? p.away_team_id : null);
      if (!winnerId) break;
      if (streakTeam === null) {
        streakTeam = winnerId;
        currentStreak = 1;
      } else if (streakTeam === winnerId) {
        currentStreak++;
      } else {
        break;
      }
    }

    if (currentStreak >= 3 && streakTeam) {
      const streakTeamName = streakTeam === g.home_team.id ? hName : aName;
      const oppTeamName = streakTeam === g.home_team.id ? aName : hName;
      seriesStreaks.push({
        team: streakTeamName,
        opponent: oppTeamName,
        streak: currentStreak,
        description: `${streakTeamName} have now won ${currentStreak} consecutive meetings against ${oppTeamName}.`
      });
    }

    // All-time series summary
    const updatedHomeWins = homePriorWins + (homeWon ? 1 : 0);
    const updatedAwayWins = awayPriorWins + (awayWon ? 1 : 0);
    h2hSummaries.push({
      game: `${hName} vs ${aName}`,
      priorCount: prior.length,
      updatedRecord: `${hName} ${updatedHomeWins} - ${updatedAwayWins} ${aName}${ties > 0 ? ` (${ties} ties)` : ''}`
    });
  }

  // C. Extremes (Shootout, Defensive battle, Blowout, Nailbiter, Shutouts)
  let shootout = null;
  let defensiveBattle = null;
  let biggestBlowout = null;
  const nailbiters = [];
  const shutouts = [];

  for (const g of completedGames) {
    const combined = g.home_score + g.away_score;
    const diff = Math.abs(g.home_score - g.away_score);
    const winner = g.home_score >= g.away_score ? g.home_team.name : g.away_team.name;
    const loser = g.home_score >= g.away_score ? g.away_team.name : g.home_team.name;

    // Shootout
    if (!shootout || combined > shootout.combined) {
      shootout = {
        game: `${g.home_team.name} ${g.home_score} - ${g.away_score} ${g.away_team.name}`,
        combined,
        winner,
        loser,
        division: g.phase?.name
      };
    }

    // Defensive battle
    if (!defensiveBattle || combined < defensiveBattle.combined) {
      defensiveBattle = {
        game: `${g.home_team.name} ${g.home_score} - ${g.away_score} ${g.away_team.name}`,
        combined,
        winner,
        loser,
        division: g.phase?.name
      };
    }

    // Blowout
    if (!biggestBlowout || diff > biggestBlowout.diff) {
      biggestBlowout = {
        game: `${g.home_team.name} ${g.home_score} - ${g.away_score} ${g.away_team.name}`,
        diff,
        winner,
        loser,
        division: g.phase?.name
      };
    }

    // Nailbiter (diff <= 7)
    if (diff <= 7) {
      nailbiters.push({
        game: `${g.home_team.name} ${g.home_score} - ${g.away_score} ${g.away_team.name}`,
        diff,
        winner,
        loser,
        division: g.phase?.name
      });
    }

    // Shutout
    if (g.home_score === 0 || g.away_score === 0) {
      const shutTeam = g.home_score > 0 ? g.home_team.name : g.away_team.name;
      const blankedTeam = g.home_score > 0 ? g.away_team.name : g.home_team.name;
      const score = `${Math.max(g.home_score, g.away_score)}-0`;
      shutouts.push({
        team: shutTeam,
        opponent: blankedTeam,
        score,
        division: g.phase?.name
      });
    }
  }

  // D. Program Records & Milestones
  const programRecords = [];
  const milestoneWins = [];

  for (const g of completedGames) {
    const hStats = teamStatsMap.get(g.home_team.id) || [];
    const aStats = teamStatsMap.get(g.away_team.id) || [];

    // Helper for team scoring history
    const evalTeamPerformance = (teamName, teamId, scoreFor, scoreAgainst, oppName, allGames) => {
      let totalWins = 0;
      const pointsScoredList = [];
      const defeatMargins = [];

      for (const gm of allGames) {
        const isHome = gm.home_team_id === teamId;
        const pts = isHome ? gm.home_score : gm.away_score;
        const oppPts = isHome ? gm.away_score : gm.home_score;
        if (pts > oppPts) totalWins++;
        pointsScoredList.push({ pts, oppPts, date: gm.date });
        if (oppPts > pts) {
          defeatMargins.push({ margin: oppPts - pts, pts, oppPts, date: gm.date, opp: isHome ? gm.away_team_id : gm.home_team_id });
        }
      }

      // Check if scoreFor is top-3 in program history (minimum 40 pts)
      if (scoreFor >= 40) {
        pointsScoredList.sort((a, b) => b.pts - a.pts);
        const rank = pointsScoredList.findIndex(p => p.pts === scoreFor && p.oppPts === scoreAgainst) + 1;
        if (rank > 0 && rank <= 3) {
          programRecords.push({
            team: teamName,
            type: 'Offensive Explosion',
            score: `${scoreFor}-${scoreAgainst}`,
            rank: rank === 1 ? 'ALL-TIME PROGRAM RECORD' : `#${rank} all-time in program history`,
            description: `${teamName}'s ${scoreFor} points vs ${oppName} is their ${rank === 1 ? 'highest scoring game in program history' : `#${rank} highest scoring performance in program history`}!`
          });
        }
      }

      // Check if defeat margin is program worst (minimum 40 margin)
      const currentMargin = scoreAgainst - scoreFor;
      if (currentMargin >= 40) {
        defeatMargins.sort((a, b) => b.margin - a.margin);
        const worstRank = defeatMargins.findIndex(m => m.margin === currentMargin) + 1;
        if (worstRank === 1) {
          programRecords.push({
            team: teamName,
            type: 'Heaviest Defeat',
            margin: currentMargin,
            score: `${scoreFor}-${scoreAgainst}`,
            description: `The ${currentMargin}-point loss (${scoreFor}-${scoreAgainst}) to ${oppName} is the LARGEST DEFEAT in ${teamName}'s recorded history.`
          });
        }
      }

      // Milestone wins: 25, 50, 70, 75, 100
      const milestones = [25, 50, 70, 75, 100, 125, 150];
      if (milestones.includes(totalWins) && scoreFor > scoreAgainst) {
        milestoneWins.push({
          team: teamName,
          wins: totalWins,
          totalGames: allGames.length,
          description: `${teamName} secured their milestone ${totalWins}th recorded victory in program history!`
        });
      }
    };

    evalTeamPerformance(g.home_team.name, g.home_team.id, g.home_score, g.away_score, g.away_team.name, hStats);
    evalTeamPerformance(g.away_team.name, g.away_team.id, g.away_score, g.home_score, g.home_team.name, aStats);
  }

  // E. Standings Momentum (Unblemished perfect starts, winless teams, bounce-backs)
  const perfectStarts = [];
  const winlessStarts = [];
  const bounceBacks = [];

  for (const [tId, rec] of teamSeasonRecords.entries()) {
    const teamObj = slateGames.flatMap(g => [g.home_team, g.away_team]).find(t => t.id === tId);
    if (!teamObj) continue;
    const tName = teamObj.name;

    // Check unblemished records (at least 2 wins, 0 losses, 0 ties)
    if (rec.wins >= 2 && rec.losses === 0 && rec.ties === 0) {
      perfectStarts.push({
        team: tName,
        record: `${rec.wins}-0`,
        wins: rec.wins,
        pointsFor: rec.pf,
        pointsAgainst: rec.pa,
        pointDiff: rec.pf - rec.pa
      });
    }

    // Check winless records (at least 2 losses, 0 wins, 0 ties)
    if (rec.losses >= 2 && rec.wins === 0 && rec.ties === 0) {
      winlessStarts.push({
        team: tName,
        record: `0-${rec.losses}`,
        losses: rec.losses,
        pointsFor: rec.pf,
        pointsAgainst: rec.pa,
        pointDiff: rec.pf - rec.pa
      });
    }
  }

  // Sort perfectStarts by wins desc, then pointDiff desc
  perfectStarts.sort((a, b) => b.wins - a.wins || b.pointDiff - a.pointDiff);

  // Sort winlessStarts by losses desc, then pointDiff asc
  winlessStarts.sort((a, b) => b.losses - a.losses || a.pointDiff - b.pointDiff);

  // Check bounce-back teams (lost previous game, won this week)
  for (const g of completedGames) {
    const winnerId = g.home_score > g.away_score ? g.home_team.id : (g.away_score > g.home_score ? g.away_team.id : null);
    if (!winnerId) continue;
    const winnerName = winnerId === g.home_team.id ? g.home_team.name : g.away_team.name;
    const rec = teamSeasonRecords.get(winnerId);

    const prevGames = (seasonGames || [])
      .filter(sg => sg.date < g.date && (sg.home_team_id === winnerId || sg.away_team_id === winnerId))
      .sort((a, b) => b.date.localeCompare(a.date));

    if (prevGames.length > 0) {
      const lastGame = prevGames[0];
      const isHomeLast = lastGame.home_team_id === winnerId;
      const scoredLast = isHomeLast ? lastGame.home_score : lastGame.away_score;
      const allowedLast = isHomeLast ? lastGame.away_score : lastGame.home_score;
      if (scoredLast < allowedLast) {
        bounceBacks.push({
          team: winnerName,
          record: rec ? `${rec.wins}-${rec.losses}${rec.ties > 0 ? `-${rec.ties}` : ''}` : undefined,
          score: `${Math.max(g.home_score, g.away_score)}-${Math.min(g.home_score, g.away_score)}`,
          opponent: winnerId === g.home_team.id ? g.away_team.name : g.home_team.name
        });
      }
    } else if (rec && rec.wins === 1 && rec.losses === 1) {
      bounceBacks.push({
        team: winnerName,
        record: '1-1',
        score: `${Math.max(g.home_score, g.away_score)}-${Math.min(g.home_score, g.away_score)}`,
        opponent: winnerId === g.home_team.id ? g.away_team.name : g.home_team.name
      });
    }
  }

  // F. Brighton Spotlight (Historical records rule compliance)
  let brightonSpotlight = null;
  const brightonGame = slateGames.find(g => 
    g.home_team?.name?.toLowerCase().includes('brighton') ||
    g.away_team?.name?.toLowerCase().includes('brighton')
  );

  if (brightonGame) {
    const isHome = brightonGame.home_team?.name?.toLowerCase().includes('brighton');
    const bName = isHome ? brightonGame.home_team.name : brightonGame.away_team.name;
    const oppName = isHome ? brightonGame.away_team.name : brightonGame.home_team.name;
    const bScore = isHome ? brightonGame.home_score : brightonGame.away_score;
    const oppScore = isHome ? brightonGame.away_score : brightonGame.home_score;
    const prior = h2hMap.get(brightonGame.id) || [];

    if (bScore !== null && oppScore !== null) {
      const bWon = bScore > oppScore;
      const bStreak = seriesStreaks.find(s => s.team === bName);
      const bBounce = bounceBacks.find(b => b.team === bName);
      const details = [];
      if (bBounce) details.push('bouncing back to 1-1');
      if (bStreak) details.push(`extending their win streak over ${oppName} to ${bStreak.streak} straight games`);
      const extra = details.length > 0 ? ` (${details.join(', ')})` : '';

      brightonSpotlight = {
        team: bName,
        opponent: oppName,
        score: `${bScore}-${oppScore}`,
        result: bWon ? 'Win' : (bScore === oppScore ? 'Tie' : 'Loss'),
        priorMeetingsCount: prior.length,
        note: bWon
          ? `${bName} secured an impressive ${bScore}-${oppScore} victory over ${oppName}${extra}.`
          : `${bName} were defeated ${oppScore}-${bScore} by ${oppName}.`
      };
    } else {
      brightonSpotlight = {
        team: bName,
        opponent: oppName,
        score: 'Upcoming',
        result: 'Scheduled',
        priorMeetingsCount: prior.length,
        note: `${bName} are scheduled to play ${oppName} on ${brightonGame.date || 'TBD'}. (Prior recorded meetings: ${prior.length}).`
      };
    }
  }

  // G. Postponements
  const postponementsList = postponedGames.map(g => ({
    matchup: `${g.home_team.name} vs ${g.away_team.name}`,
    division: g.phase?.name,
    status: 'Postponed'
  }));

  return {
    window: {
      label,
      startDate,
      endDate,
      seasonYear,
      weekNumber
    },
    overview: {
      totalFixtures: slateGames.length,
      completedGames: completedGames.length,
      postponedGames: postponedGames.length,
      awardedGames: awardedGames.length,
      totalPoints,
      avgPoints
    },
    scorigamis: {
      allTime: allTimeScorigamis,
      level: levelScorigamis
    },
    rivalries: {
      inauguralMatchups,
      longHiatusMatchups,
      revengeGames,
      seriesStreaks
    },
    extremes: {
      shootout,
      defensiveBattle,
      biggestBlowout,
      nailbiters,
      shutouts
    },
    recordsAndMilestones: {
      programRecords,
      milestoneWins
    },
    standingsMomentum: {
      perfectStarts,
      winlessStarts,
      bounceBacks
    },
    brightonSpotlight,
    postponements: postponementsList
  };
}

/**
 * Formats the weekly facts into rich, human-readable GitHub-flavored Markdown.
 * 
 * @param {Object} facts
 * @returns {string}
 */
export function formatFactsMarkdown(facts) {
  const { window, overview, scorigamis, rivalries, extremes, recordsAndMilestones, standingsMomentum, brightonSpotlight, postponements } = facts;

  let md = `# 🏈 Weekly Britball Digest: ${window.label}\n\n`;

  // Overview quick bar
  md += `> **Slate Snapshot:** ${overview.completedGames} completed fixtures | **${overview.totalPoints}** total points scored (${overview.avgPoints} PPG) | **${extremes.shutouts.length}** shutouts pitched\n\n`;

  // 1. Headline Scorigamis
  if (scorigamis.allTime.length > 0 || scorigamis.level.length > 0) {
    md += `## 🎯 Scorigami Watch\n`;
    for (const sc of scorigamis.allTime) {
      md += `- 🌟 **ALL-TIME BRITBALL SCORIGAMI**: **${sc.game}**\n`;
      md += `  *${sc.description}*\n`;
    }
    for (const sc of scorigamis.level) {
      md += `- 🔷 **${sc.level.toUpperCase()} SCORIGAMI**: **${sc.game}**\n`;
      md += `  *${sc.description}*\n`;
    }
    md += `\n`;
  }

  // 2. Program Records & Historic Milestones
  if (recordsAndMilestones.programRecords.length > 0 || recordsAndMilestones.milestoneWins.length > 0) {
    md += `## 📜 Program Records & Milestones\n`;
    for (const rec of recordsAndMilestones.programRecords) {
      md += `- 💥 **${rec.team} (${rec.type})**: ${rec.description}\n`;
    }
    for (const ms of recordsAndMilestones.milestoneWins) {
      md += `- 🏆 **${ms.team} Milestone**: ${ms.description}\n`;
    }
    md += `\n`;
  }

  // 3. Historical Rivalries & Hiatuses
  if (rivalries.inauguralMatchups.length > 0 || rivalries.longHiatusMatchups.length > 0 || rivalries.revengeGames.length > 0 || rivalries.seriesStreaks.length > 0) {
    md += `## ⚔️ Rivalry & Series Context\n`;
    for (const inau of rivalries.inauguralMatchups) {
      md += `- 🆕 **Inaugural Meeting**: **${inau.game}** — ${inau.description}\n`;
    }
    for (const h of rivalries.longHiatusMatchups) {
      md += `- ⏳ **Hiatus Ended**: **${h.game}** — ${h.description}\n`;
    }
    for (const rev of rivalries.revengeGames) {
      md += `- 🔄 **Reversal**: **${rev.winner} ${rev.currentScore} ${rev.loser}** — ${rev.description}\n`;
    }
    for (const str of rivalries.seriesStreaks) {
      md += `- 🧱 **Series Dominance**: ${str.description}\n`;
    }
    md += `\n`;
  }

  // 4. Extremes of the Week
  md += `## ⚡ Extremes of the Slate\n`;
  if (extremes.shootout) {
    md += `- 🔥 **Shootout of the Week**: **${extremes.shootout.game}** (${extremes.shootout.combined} combined points in ${extremes.shootout.division})\n`;
  }
  if (extremes.defensiveBattle) {
    md += `- 🔒 **Defensive Slugfest**: **${extremes.defensiveBattle.game}** (just ${extremes.defensiveBattle.combined} combined points!)\n`;
  }
  if (extremes.biggestBlowout) {
    md += `- 🚜 **Margin of the Week**: **${extremes.biggestBlowout.game}** (+${extremes.biggestBlowout.diff} margin)\n`;
  }
  if (extremes.nailbiters.length > 0) {
    md += `- ⏱️ **Nailbiters & One-Score Thrillers**:\n`;
    for (const nb of extremes.nailbiters) {
      md += `  - **${nb.game}** (decided by ${nb.diff} point${nb.diff === 1 ? '' : 's'})\n`;
    }
  }
  md += `\n`;

  // 5. The Shutout Wall
  if (extremes.shutouts.length > 0) {
    md += `## 🛡️ The Shutout Club (${extremes.shutouts.length} Clean Sheets)\n`;
    for (const s of extremes.shutouts) {
      md += `- **${s.team}** ${s.score} ${s.opponent} (${s.division})\n`;
    }
    md += `\n`;
  }

  // 6. Standings & Form Watch
  if (standingsMomentum.perfectStarts.length > 0 || standingsMomentum.bounceBacks.length > 0 || standingsMomentum.winlessStarts.length > 0) {
    md += `## 📈 Season Form & Momentum\n`;
    if (standingsMomentum.perfectStarts.length > 0) {
      const pGroups = new Map();
      for (const t of standingsMomentum.perfectStarts) {
        const rec = t.record || '2-0';
        if (!pGroups.has(rec)) pGroups.set(rec, []);
        pGroups.get(rec).push(`**${t.team}** (+${t.pointDiff})`);
      }
      for (const [rec, teams] of pGroups.entries()) {
        md += `- 🟢 **Unblemished (${rec})**: ${teams.join(', ')}\n`;
      }
    }
    if (standingsMomentum.bounceBacks.length > 0) {
      const bbNames = standingsMomentum.bounceBacks.map(b => `**${b.team}** (${b.record ? `${b.record}, ` : ''}beat ${b.opponent} ${b.score})`).join(', ');
      md += `- 🔄 **Bounce-Back Victories**: ${bbNames}\n`;
    }
    if (standingsMomentum.winlessStarts.length > 0) {
      const wGroups = new Map();
      for (const t of standingsMomentum.winlessStarts) {
        const rec = t.record || '0-2';
        if (!wGroups.has(rec)) wGroups.set(rec, []);
        wGroups.get(rec).push(`**${t.team}**`);
      }
      for (const [rec, teams] of wGroups.entries()) {
        md += `- 🔴 **Seeking 1st Win (${rec})**: ${teams.join(', ')}\n`;
      }
    }
    md += `\n`;
  }

  // 7. Brighton Spotlight
  if (brightonSpotlight) {
    md += `## 🌊 Brighton Historical Archive Spotlight\n`;
    md += `- **${brightonSpotlight.team} ${brightonSpotlight.score} ${brightonSpotlight.opponent}** (${brightonSpotlight.result})\n`;
    md += `  *${brightonSpotlight.note}*\n\n`;
  }

  // 8. Postponements
  if (postponements.length > 0) {
    md += `## ⏸️ Postponed Fixtures\n`;
    for (const p of postponements) {
      md += `- **${p.matchup}** (${p.division})\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * Formats facts into an executive brief (3-5 punchy highlights).
 * 
 * @param {Object} facts
 * @returns {string}
 */
export function formatFactsBrief(facts) {
  const bullets = [];

  // Scorigamis
  if (facts.scorigamis?.allTime?.length > 0) {
    const sc = facts.scorigamis.allTime[0];
    bullets.push(`🎯 **Scorigami Alert**: ${sc.game} (${sc.score}) is an all-time Britball scorigami!`);
  } else if (facts.scorigamis?.level?.length > 0) {
    const sc = facts.scorigamis.level[0];
    bullets.push(`🎯 **Scorigami Alert**: ${sc.game} (${sc.score}) is a ${sc.level} scorigami.`);
  }

  // Records
  if (facts.recordsAndMilestones?.programRecords?.length > 0) {
    const rec = facts.recordsAndMilestones.programRecords[0];
    bullets.push(`💥 **Record Book**: ${rec.description}`);
  }

  // Shutouts
  if (facts.extremes?.shutouts?.length > 0) {
    const topShutout = facts.extremes.shutouts[0];
    bullets.push(`🛡️ **Defensive Wall**: ${facts.extremes.shutouts.length} shutouts pitched this weekend, including ${topShutout.team}'s ${topShutout.score} clean sheet.`);
  }

  // Shootout vs Slugfest
  if (facts.extremes?.shootout && facts.extremes?.defensiveBattle) {
    bullets.push(`⚡ **Poles Apart**: Shootout of the week was ${facts.extremes.shootout.game} (${facts.extremes.shootout.combined} pts), while ${facts.extremes.defensiveBattle.game} was a ${facts.extremes.defensiveBattle.combined}-point defensive battle.`);
  }

  // Brighton
  if (facts.brightonSpotlight) {
    bullets.push(`🌊 **Brighton Panthers**: ${facts.brightonSpotlight.note}`);
  }

  return bullets.join('\n\n');
}
