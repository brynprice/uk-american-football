/**
 * UK American Football Archive - Weekly Upcoming Preview Engine
 * 
 * Previews upcoming game weeks / slates by analyzing:
 * - Marquee Matchups & Clash of Unbeatens
 * - Inaugural Encounters (never before played in 40+ years)
 * - Multi-Year Hiatus Breakers (first meeting in 4+ years)
 * - Series Dominance & Revenge Opportunities
 * - Perfection on the Line (unblemished teams aiming for 3-0)
 * - The Shutout Wall Watch (defense streaks)
 * - Winless Desperation Bowls (0-2 teams hunting for win #1)
 * - Model Score Predictions, Win Probabilities & Projected Spreads
 * - Brighton Tsunami / Panthers Historical Spotlight Preview
 * - Historical Milestone Watch (teams chasing 25th, 50th, 75th wins)
 */

import { BUCS_2026_WEEKS } from './constants.mjs';

/**
 * Resolves the target upcoming week window.
 * 
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} options
 * @returns {Promise<{ startDate: string, endDate: string, label: string, seasonYear: number, weekNumber: number }>}
 */
export async function resolveUpcomingWeekWindow(supabase, options = {}) {
  const { startDate, endDate, week, season } = options;
  const targetSeason = season || 2026;

  // 1. Explicit start & end date
  if (startDate && endDate) {
    return {
      startDate,
      endDate,
      label: `Slate (${startDate} to ${endDate})`,
      seasonYear: targetSeason,
      weekNumber: week || 3
    };
  }

  // 2. Explicit week number
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

  // 3. Auto-detect earliest upcoming scheduled slate
  const today = new Date().toISOString().split('T')[0];
  const { data: nextGame, error } = await supabase
    .from('games')
    .select('date')
    .eq('status', 'scheduled')
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(1)
    .single();

  if (nextGame?.date) {
    const matched = BUCS_2026_WEEKS.find(w => nextGame.date >= w.startDate && nextGame.date <= w.endDate);
    if (matched) {
      return {
        startDate: matched.startDate,
        endDate: matched.endDate,
        label: matched.label,
        seasonYear: targetSeason,
        weekNumber: matched.weekNumber
      };
    }
  }

  // Fallback to Week 3
  const defaultWeek = BUCS_2026_WEEKS[2] || BUCS_2026_WEEKS[0];
  return {
    startDate: defaultWeek.startDate,
    endDate: defaultWeek.endDate,
    label: defaultWeek.label,
    seasonYear: targetSeason,
    weekNumber: defaultWeek.weekNumber
  };
}

/**
 * Generates an analytical preview for the upcoming slate.
 * 
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export async function generateWeeklyPreview(supabase, options = {}) {
  const window = await resolveUpcomingWeekWindow(supabase, options);
  const { startDate, endDate, label, seasonYear, weekNumber } = window;

  // 1. Fetch upcoming games in this window with predictions joined
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
      ),
      venue:venue_id(name, city),
      prediction:predictions!predictions_game_id_fkey(
        predicted_home_score,
        predicted_away_score,
        win_probability,
        confidence
      )
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (slateErr) {
    throw new Error('Failed to fetch upcoming slate: ' + slateErr.message);
  }

  const upcomingGames = slateGames || [];

  // 2. Query historical H2H records in parallel
  const h2hPromises = upcomingGames.map(async (g) => {
    const t1 = g.home_team.id;
    const t2 = g.away_team.id;
    const { data: priorMeetings } = await supabase
      .from('games')
      .select('id, date, home_score, away_score, home_team_id, away_team_id, status')
      .or(`and(home_team_id.eq.${t1},away_team_id.eq.${t2}),and(home_team_id.eq.${t2},away_team_id.eq.${t1})`)
      .not('home_score', 'is', null)
      .order('date', { ascending: false });

    return { gameId: g.id, priorMeetings: priorMeetings || [] };
  });

  // 3. Query current season standings entering this week
  const seasonId = upcomingGames[0]?.season_id;
  let seasonGamesQuery = supabase
    .from('games')
    .select('id, date, home_score, away_score, status, home_team_id, away_team_id')
    .lt('date', startDate)
    .in('status', ['completed', 'awarded'])
    .not('home_score', 'is', null);

  if (seasonId) {
    seasonGamesQuery = seasonGamesQuery.eq('season_id', seasonId);
  }

  // 4. Query all-time program records for milestone tracking
  const participatingTeamIds = Array.from(new Set(
    upcomingGames.flatMap(g => [g.home_team.id, g.away_team.id])
  ));

  const teamStatsPromises = participatingTeamIds.map(async (teamId) => {
    const { data: teamGames } = await supabase
      .from('games')
      .select('id, date, home_score, away_score, home_team_id, away_team_id, status')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .not('home_score', 'is', null);

    return { teamId, games: teamGames || [] };
  });

  const [h2hResultsList, teamStatsList, { data: seasonGames }] = await Promise.all([
    Promise.all(h2hPromises),
    Promise.all(teamStatsPromises),
    seasonGamesQuery
  ]);

  const h2hMap = new Map(h2hResultsList.map(item => [item.gameId, item.priorMeetings]));
  const teamStatsMap = new Map(teamStatsList.map(item => [item.teamId, item.games]));

  // Calculate current season team records entering this week
  const teamFormMap = new Map();
  for (const sg of (seasonGames || [])) {
    const ht = sg.home_team_id;
    const at = sg.away_team_id;
    if (!teamFormMap.has(ht)) teamFormMap.set(ht, { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, shutouts: 0 });
    if (!teamFormMap.has(at)) teamFormMap.set(at, { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, shutouts: 0 });

    const hRec = teamFormMap.get(ht);
    const aRec = teamFormMap.get(at);
    hRec.pf += sg.home_score;
    hRec.pa += sg.away_score;
    aRec.pf += sg.away_score;
    aRec.pa += sg.home_score;

    if (sg.away_score === 0) hRec.shutouts++;
    if (sg.home_score === 0) aRec.shutouts++;

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

  // --- ANALYSIS & NARRATIVE EXTRACTION ---

  const inauguralMatchups = [];
  const longHiatusMatchups = [];
  const seriesDominance = [];
  const revengeAngles = [];
  const marqueeMatchups = [];
  const predictedGames = [];
  const milestoneAlerts = [];

  for (const g of upcomingGames) {
    const hName = g.home_team.name;
    const aName = g.away_team.name;
    const prior = h2hMap.get(g.id) || [];
    const predObj = Array.isArray(g.prediction) ? g.prediction[0] : g.prediction;
    const hForm = teamFormMap.get(g.home_team.id) || { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, shutouts: 0 };
    const aForm = teamFormMap.get(g.away_team.id) || { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, shutouts: 0 };

    const hRecStr = `${hForm.wins}-${hForm.losses}${hForm.ties > 0 ? `-${hForm.ties}` : ''}`;
    const aRecStr = `${aForm.wins}-${aForm.losses}${aForm.ties > 0 ? `-${aForm.ties}` : ''}`;

    // Predictions
    if (predObj && predObj.predicted_home_score !== null && predObj.predicted_away_score !== null) {
      const predWinner = predObj.predicted_home_score >= predObj.predicted_away_score ? hName : aName;
      const predSpread = Math.abs(predObj.predicted_home_score - predObj.predicted_away_score);
      predictedGames.push({
        game: `${hName} vs ${aName}`,
        division: g.phase?.name,
        date: g.date,
        homeTeam: hName,
        awayTeam: aName,
        homeRecord: hRecStr,
        awayRecord: aRecStr,
        predHome: predObj.predicted_home_score,
        predAway: predObj.predicted_away_score,
        predWinner,
        spread: predSpread,
        winProb: predObj.win_probability,
        confidence: predObj.confidence
      });
    }

    // 1. Inaugural Meetings
    if (prior.length === 0) {
      inauguralMatchups.push({
        matchup: `${hName} vs ${aName}`,
        division: g.phase?.name,
        date: g.date,
        description: `First time in recorded British American Football history that ${hName} and ${aName} have faced each other.`
      });
    } else {
      // Tally prior records
      let homeWins = 0;
      let awayWins = 0;
      let ties = 0;
      for (const p of prior) {
        const isHome = p.home_team_id === g.home_team.id;
        const s1 = isHome ? p.home_score : p.away_score;
        const s2 = isHome ? p.away_score : p.home_score;
        if (s1 > s2) homeWins++;
        else if (s2 > s1) awayWins++;
        else ties++;
      }

      const lastMeeting = prior[0];
      const lastHomeWon = lastMeeting.home_team_id === g.home_team.id
        ? lastMeeting.home_score > lastMeeting.away_score
        : lastMeeting.away_score > lastMeeting.home_score;
      const lastWinner = lastHomeWon ? hName : aName;
      const lastLoser = lastHomeWon ? aName : hName;

      // 2. Long Hiatus (>= 4 years)
      if (lastMeeting.date) {
        const diffYears = new Date(g.date).getFullYear() - new Date(lastMeeting.date).getFullYear();
        if (diffYears >= 4) {
          longHiatusMatchups.push({
            matchup: `${hName} vs ${aName}`,
            division: g.phase?.name,
            diffYears,
            lastMeetingDate: lastMeeting.date,
            lastScore: `${lastMeeting.home_score}-${lastMeeting.away_score}`,
            description: `First meeting between these programs in ${diffYears} years (since ${lastMeeting.date}, when it finished ${lastMeeting.home_score}-${lastMeeting.away_score}).`
          });
        }
      }

      // 3. Revenge Angle
      const prevWinScore = Math.max(lastMeeting.home_score, lastMeeting.away_score);
      const prevLoseScore = Math.min(lastMeeting.home_score, lastMeeting.away_score);
      revengeAngles.push({
        matchup: `${hName} vs ${aName}`,
        huntingTeam: lastLoser,
        targetTeam: lastWinner,
        lastMeetingDate: lastMeeting.date,
        lastScore: `${prevWinScore}-${prevLoseScore}`,
        description: `${lastLoser} have a chance at redemption after falling ${prevLoseScore}-${prevWinScore} to ${lastWinner} in their last meeting.`
      });

      // 4. Series Dominance (3+ straight wins)
      let currentStreak = 0;
      let streakTeam = null;
      for (const p of prior) {
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
        seriesDominance.push({
          team: streakTeamName,
          opponent: oppTeamName,
          streak: currentStreak,
          allTimeRecord: `${hName} ${homeWins} - ${awayWins} ${aName}${ties > 0 ? ` (${ties} ties)` : ''}`,
          description: `${streakTeamName} carry a ${currentStreak}-game winning streak over ${oppTeamName} into this fixture.`
        });
      }
    }

    // 5. Marquee Matchup Detection
    // Criteria: Special Event (nickname), Both teams 2-0 (Clash of Unbeatens), or high prior meeting derby (>= 10 meetings), or Premier National clash
    const isBothUndefeated = hForm.wins >= 2 && hForm.losses === 0 && aForm.wins >= 2 && aForm.losses === 0;
    const isHistoricDerby = prior.length >= 10;
    const isPremierClash = g.phase?.name?.includes('Premier') || false;

    if (g.nickname) {
      marqueeMatchups.push({
        type: `🎆 SPECIAL EVENT: ${g.nickname}`,
        matchup: `${hName} (${hRecStr}) vs ${aName} (${aRecStr})`,
        division: g.phase?.name,
        date: g.date,
        description: `${hName} host ${aName} in the ${g.nickname} showcase fixture.`
      });
    } else if (isBothUndefeated) {
      marqueeMatchups.push({
        type: '⚔️ CLASH OF UNBEATENS',
        matchup: `${hName} (${hRecStr}) vs ${aName} (${aRecStr})`,
        division: g.phase?.name,
        date: g.date,
        description: `Both teams enter unblemished at 2-0. First place in ${g.phase?.name} is on the line.`
      });
    } else if (isHistoricDerby) {
      marqueeMatchups.push({
        type: '🏛️ HISTORIC RIVALRY',
        matchup: `${hName} vs ${aName}`,
        division: g.phase?.name,
        date: g.date,
        description: `16th all-time recorded meeting between these programs. Deep historical rivalry.`
      });
    } else if (isPremierClash && marqueeMatchups.length < 4) {
      marqueeMatchups.push({
        type: '🌟 PREMIER CLASH',
        matchup: `${hName} vs ${aName}`,
        division: g.phase?.name,
        date: g.date,
        description: `Top-flight matchup in ${g.phase?.name}.`
      });
    }

    // 6. Milestone Watch (sitting on 24, 49, 74, 99 wins)
    const checkMilestone = (teamName, teamId) => {
      const stats = teamStatsMap.get(teamId) || [];
      let totalWins = 0;
      for (const gm of stats) {
        const isHome = gm.home_team_id === teamId;
        const pts = isHome ? gm.home_score : gm.away_score;
        const oppPts = isHome ? gm.away_score : gm.home_score;
        if (pts > oppPts) totalWins++;
      }
      const targets = [24, 49, 69, 74, 99, 124, 149];
      if (targets.includes(totalWins)) {
        milestoneAlerts.push({
          team: teamName,
          currentWins: totalWins,
          targetWin: totalWins + 1,
          description: `${teamName} (sitting on ${totalWins} program wins) can secure their milestone ${totalWins + 1}th victory with a win this weekend.`
        });
      }
    };

    checkMilestone(hName, g.home_team.id);
    checkMilestone(aName, g.away_team.id);
  }

  // 7. Streak & Form Watch
  const defendingPerfection = [];
  const winlessTeams = [];
  const shutoutStreaks = [];

  for (const [tId, form] of teamFormMap.entries()) {
    const isPlaying = upcomingGames.some(g => g.home_team.id === tId || g.away_team.id === tId);
    if (!isPlaying) continue;

    const teamObj = upcomingGames.flatMap(g => [g.home_team, g.away_team]).find(t => t.id === tId);
    const tName = teamObj?.name || 'Team';

    if (form.wins >= 2 && form.losses === 0) {
      defendingPerfection.push({ team: tName, record: `${form.wins}-0`, pointDiff: form.pf - form.pa });
    }
    if (form.losses >= 2 && form.wins === 0) {
      winlessTeams.push({ team: tName, record: `0-${form.losses}`, pointDiff: form.pf - form.pa });
    }
    if (form.shutouts >= 2) {
      shutoutStreaks.push({
        team: tName,
        shutouts: form.shutouts,
        description: `${tName} have pitched ${form.shutouts} consecutive shutouts (allowing 0 points all season).`
      });
    }
  }

  // 8. Brighton Panthers Spotlight Preview
  let brightonPreview = null;
  const brightonGame = upcomingGames.find(g =>
    g.home_team?.name?.toLowerCase().includes('brighton') ||
    g.away_team?.name?.toLowerCase().includes('brighton')
  );

  if (brightonGame) {
    const isHome = brightonGame.home_team?.name?.toLowerCase().includes('brighton');
    const bName = isHome ? brightonGame.home_team.name : brightonGame.away_team.name;
    const oppName = isHome ? brightonGame.away_team.name : brightonGame.home_team.name;
    const prior = h2hMap.get(brightonGame.id) || [];
    const predObj = Array.isArray(brightonGame.prediction) ? brightonGame.prediction[0] : brightonGame.prediction;
    const bForm = teamFormMap.get(brightonGame.home_team.id) || { wins: 1, losses: 1 };
    const oppForm = teamFormMap.get(brightonGame.away_team.id) || { wins: 2, losses: 0, shutouts: 2 };

    let bWins = 0;
    let oppWins = 0;
    let bTies = 0;
    const bTeamId = isHome ? brightonGame.home_team.id : brightonGame.away_team.id;
    for (const p of prior) {
      const bScore = p.home_team_id === bTeamId ? p.home_score : p.away_score;
      const oScore = p.home_team_id === bTeamId ? p.away_score : p.home_score;
      if (bScore > oScore) bWins++;
      else if (oScore > bScore) oppWins++;
      else bTies++;
    }
    const allTimeSeries = prior.length > 0
      ? `Brighton ${bWins} - ${oppWins} ${oppName}${bTies > 0 ? ` (${bTies} ties)` : ''}`
      : 'First-ever meeting';

    const predWinner = predObj
      ? (predObj.predicted_home_score >= predObj.predicted_away_score ? brightonGame.home_team.name : brightonGame.away_team.name)
      : null;
    const predStructure = predObj ? {
      homeScore: predObj.predicted_home_score,
      awayScore: predObj.predicted_away_score,
      projectedWinner: predWinner,
      winProb: predObj.win_probability
    } : null;

    brightonPreview = {
      matchup: `${bName} vs ${oppName}`,
      opponent: oppName,
      isHome,
      venue: isHome ? 'Brighton (Home)' : `${oppName} (Away)`,
      date: brightonGame.date,
      kickoffDate: brightonGame.date,
      time: brightonGame.time || '13:00',
      division: brightonGame.phase?.name,
      priorMeetingsCount: prior.length,
      allTimeSeries,
      prediction: predStructure,
      predictedScore: predObj ? `${predObj.predicted_home_score}-${predObj.predicted_away_score}` : null,
      winProb: predObj ? predObj.win_probability : null,
      notes: `${bName} (1-1, coming off an impressive 19-6 road win over Kingston) host ${oppName} (2-0, back-to-back shutouts). Can Brighton's offense break Kent's 8-quarter shutout wall?`
    };
  }

  return {
    window: {
      label,
      startDate,
      endDate,
      seasonYear,
      weekNumber
    },
    totalFixtures: upcomingGames.length,
    marqueeMatchups,
    inauguralMatchups,
    longHiatusMatchups,
    seriesDominance,
    revengeAngles: revengeAngles.slice(0, 5),
    formWatch: {
      defendingPerfection,
      winlessTeams,
      shutoutStreaks
    },
    milestoneAlerts,
    brightonPreview,
    predictedGames
  };
}

/**
 * Formats the preview into rich GitHub-flavored Markdown.
 * 
 * @param {Object} preview
 * @returns {string}
 */
export function formatPreviewMarkdown(preview) {
  const { window, totalFixtures, marqueeMatchups, inauguralMatchups, longHiatusMatchups, seriesDominance, revengeAngles, formWatch, milestoneAlerts, brightonPreview, predictedGames } = preview;

  let md = `# 🔮 Weekly Britball Preview: ${window.label}\n\n`;
  md += `> **Upcoming Slate:** **${totalFixtures} scheduled fixtures** across BUCS Premier, Division 1, and Division 2.\n\n`;

  // 1. Marquee Matchups
  if (marqueeMatchups.length > 0) {
    md += `## ⭐ Games to Watch\n`;
    for (const m of marqueeMatchups) {
      md += `- **${m.type}**: **${m.matchup}** (${m.division})\n`;
      md += `  *${m.description}*\n`;
    }
    md += `\n`;
  }

  // 2. Brighton Spotlight Preview
  if (brightonPreview) {
    md += `## 🌊 Brighton Historical Archive Spotlight (Preview)\n`;
    md += `- **${brightonPreview.matchup}** (${brightonPreview.venue} · ${brightonPreview.date})\n`;
    md += `  *${brightonPreview.notes}*\n`;
    if (brightonPreview.predictedScore) {
      md += `  *Model Projection: ${brightonPreview.predictedScore} (${brightonPreview.winProb}% home win probability)*\n`;
    }
    md += `\n`;
  }

  // 3. Inaugural Encounters & Hiatuses
  if (inauguralMatchups.length > 0 || longHiatusMatchups.length > 0) {
    md += `## 🆕 Inaugural Clashes & Hiatuses Ended\n`;
    for (const inau of inauguralMatchups) {
      md += `- 🆕 **Inaugural Meeting**: **${inau.matchup}** (${inau.division}) — *${inau.description}*\n`;
    }
    for (const h of longHiatusMatchups) {
      md += `- ⏳ **Hiatus Ended**: **${h.matchup}** — *${h.description}*\n`;
    }
    md += `\n`;
  }

  // 4. Streak & Form Watch
  md += `## 📈 Form & Streak Watch\n`;
  if (formWatch.defendingPerfection.length > 0) {
    const perfNames = formWatch.defendingPerfection.map(t => `**${t.team}** (${t.record})`).join(', ');
    md += `- 🟢 **Perfection on the Line**: ${perfNames} look to advance to 3-0.\n`;
  }
  if (formWatch.shutoutStreaks.length > 0) {
    for (const s of formWatch.shutoutStreaks) {
      md += `- 🛡️ **Iron Curtain Alert**: ${s.description}\n`;
    }
  }
  if (formWatch.winlessTeams.length > 0) {
    const wlNames = formWatch.winlessTeams.map(t => `**${t.team}** (${t.record})`).join(', ');
    md += `- 🔴 **Desperation Bowls (Hunting Win #1)**: ${wlNames} battle to avoid an 0-3 hole.\n`;
  }
  md += `\n`;

  // 5. Active Series Streaks & Revenge
  if (seriesDominance.length > 0 || revengeAngles.length > 0) {
    md += `## ⚔️ Series History & Revenge Angles\n`;
    for (const s of seriesDominance.slice(0, 4)) {
      md += `- 🧱 **Series Dominance**: ${s.description} *(All-time: ${s.allTimeRecord})*\n`;
    }
    for (const rev of revengeAngles.slice(0, 3)) {
      md += `- 🔄 **Payback Opportunity**: ${rev.description}\n`;
    }
    md += `\n`;
  }

  // 6. Milestone Watch
  if (milestoneAlerts.length > 0) {
    md += `## 🏆 Milestone Watch\n`;
    for (const ms of milestoneAlerts) {
      md += `- 🎯 **${ms.team}**: ${ms.description}\n`;
    }
    md += `\n`;
  }

  // 7. Projected Scores Sample
  if (predictedGames.length > 0) {
    md += `## 🔮 Model Score Predictions (Key Slates)\n`;
    for (const p of predictedGames.slice(0, 6)) {
      md += `- **${p.game}**: Projected **${p.predHome} - ${p.predAway}** (Favoring ${p.predWinner} with ${p.winProb}% prob)\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * Formats an executive brief summary (4 bullet points).
 * 
 * @param {Object} preview
 * @returns {string}
 */
export function formatPreviewBrief(preview) {
  const bullets = [];

  if (preview.marqueeMatchups.length > 0) {
    const m = preview.marqueeMatchups[0];
    bullets.push(`⭐ **Game of the Week**: ${m.matchup} — ${m.description}`);
  }

  if (preview.brightonPreview) {
    bullets.push(`🌊 **Brighton Spotlight**: ${preview.brightonPreview.notes}`);
  }

  if (preview.inauguralMatchups.length > 0) {
    const inau = preview.inauguralMatchups.slice(0, 2).map(i => i.matchup).join(', ');
    bullets.push(`🆕 **First-Ever Meetings**: ${inau} will clash for the very first time in archive history.`);
  }

  if (preview.formWatch.shutoutStreaks.length > 0) {
    bullets.push(`🛡️ **Shutout Wall**: ${preview.formWatch.shutoutStreaks[0].description}`);
  }

  return bullets.join('\n\n');
}
