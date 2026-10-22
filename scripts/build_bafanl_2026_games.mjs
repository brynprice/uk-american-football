import fs from 'fs';
import { parse } from 'csv-parse/sync';

// Team to primary division map from standings2026.csv
const standingsContent = fs.readFileSync('data/BAFANL/standings2026.csv', 'utf8');
const standingsRecords = parse(standingsContent, { columns: true, skip_empty_lines: true });

const teamDivisionMap = {};
const teamParentMap = {};
for (const s of standingsRecords) {
  teamDivisionMap[s.team] = s.phase;
  teamParentMap[s.team] = s.parent_phase;
}

// Read raw scraped matches
const rawContent = fs.readFileSync('league_republic_matches.csv', 'utf8');
const rawMatches = parse(rawContent, { columns: true, skip_empty_lines: true });

console.log(`Processing ${rawMatches.length} raw scraped matches...`);

const cleanGames = [];

for (const m of rawMatches) {
  let phase = m.phase.trim();
  let homeTeam = m.home_team.trim();
  let awayTeam = m.away_team.trim();
  let homeScore = m.home_score.trim();
  let awayScore = m.away_score.trim();
  const date = m.date.trim();
  const time = m.time.trim() || '14:00';
  let venue = m.venue.trim();
  if (venue.startsWith('@ @ ')) venue = venue.substring(4).trim();
  if (venue.startsWith('@ ')) venue = venue.substring(2).trim();

  let isPlayoff = false;
  let isTitle = false;
  let finalType = '';
  let titleName = '';
  let playoffRound = '';
  let parentPhase = '';
  let awayPhase = '';
  let status = 'completed';

  let notes = 'Source: League Republic official match records (https://bafanle.leaguerepublic.com/)';

  // 1. Unplayed, Abandoned or Walkover fixture checks
  if (homeScore.includes('Abandoned') || awayScore.includes('Abandoned') || (homeScore === 'A' && awayScore === 'A')) {
    status = 'cancelled';
    homeScore = '0';
    awayScore = '0';
    notes = 'Source: League Republic official match records (Abandoned)';
  } else if (homeScore.includes('walkover') || awayScore.includes('walkover') || homeScore === 'H' || awayScore === 'W') {
    status = 'awarded';
    homeScore = '1';
    awayScore = '0';
    notes = 'Source: League Republic official match records (Home walkover awarded 1-0)';
  } else if (homeScore === 'W' || awayScore === 'H') {
    status = 'awarded';
    homeScore = '0';
    awayScore = '1';
    notes = 'Source: League Republic official match records (Away walkover awarded 0-1)';
  } else if (!homeScore && !awayScore) {
    status = 'cancelled';
    homeScore = '0';
    awayScore = '0';
  }

  // 2. Playoff / Postseason Resolution
  const upperPhase = phase.toUpperCase();
  if (upperPhase.includes('PLAYOFFS') || upperPhase.includes('PLAY-OFFS') || date >= '2026-08-15') {
    isPlayoff = true;

    if (upperPhase.includes('DIVISION ONE') || (!phase && (teamParentMap[homeTeam] === 'Northern Football Conference' || teamParentMap[homeTeam] === 'Southern Football Conference') && teamDivisionMap[homeTeam]?.startsWith('SFC 1') || teamDivisionMap[homeTeam]?.startsWith('NFC 1'))) {
      phase = 'Playoffs';
      parentPhase = 'Division One';
      if (upperPhase.includes('WILD CARD')) playoffRound = 'Wildcard';
      else if (upperPhase.includes('QUARTER-FINAL')) playoffRound = 'Quarter-Final';
      else if (upperPhase.includes('SEMI-FINAL')) playoffRound = 'Semi-Final';
      else if (upperPhase.includes('FINAL')) {
        playoffRound = 'Final';
        isTitle = true;
        finalType = 'bowl';
        titleName = 'Division One Bowl';
      }
    } else if (upperPhase.includes('DIVISION TWO')) {
      phase = 'Playoffs';
      parentPhase = 'Division Two';
      if (upperPhase.includes('QUARTER-FINAL')) playoffRound = 'Quarter-Final';
      else if (upperPhase.includes('SEMI-FINAL')) playoffRound = 'Semi-Final';
      else if (upperPhase.includes('FINAL')) {
        playoffRound = 'Final';
        isTitle = true;
        finalType = 'bowl';
        titleName = 'Division Two Bowl';
      }
    } else {
      // Premiership Playoffs
      phase = 'Playoffs';
      parentPhase = 'Premiership';
      if (date === '2026-09-06') {
        playoffRound = 'Final';
        isTitle = true;
        finalType = 'title';
        titleName = 'Britbowl XXXVIII';
        if (!venue) venue = 'Coventry';
      } else {
        playoffRound = 'Semi-Final';
      }
    }
  } else if (upperPhase.includes('INTER-DIVISIONAL')) {
    // D1 Scotland/North Inter-divisional regular season games
    const homeDiv = teamDivisionMap[homeTeam] || 'NFC 1 North';
    const awayDiv = teamDivisionMap[awayTeam] || 'NFC 1 Scotland';
    phase = homeDiv;
    parentPhase = 'Northern Football Conference';
    awayPhase = awayDiv;
  } else if (!phase) {
    // Empty phase on regular season date: resolve from home team
    const homeDiv = teamDivisionMap[homeTeam];
    const awayDiv = teamDivisionMap[awayTeam];
    phase = homeDiv;
    parentPhase = teamParentMap[homeTeam] || '';
    if (homeDiv !== awayDiv) {
      awayPhase = awayDiv;
    }
  } else {
    // Standard regular season division
    // Normalize naming: e.g. NFC1 SCOTLAND -> NFC 1 Scotland
    if (upperPhase === 'NFC1 SCOTLAND' || upperPhase === 'NFC 1 SCOTLAND') phase = 'NFC 1 Scotland';
    else if (upperPhase === 'NFC 1 NORTH') phase = 'NFC 1 North';
    else if (upperPhase === 'NFC 1 MIDLANDS') phase = 'NFC 1 Midlands';
    else if (upperPhase === 'SFC 1 EAST') phase = 'SFC 1 East';
    else if (upperPhase === 'SFC 1 CENTRAL') phase = 'SFC 1 Central';
    else if (upperPhase === 'SFC 1 WEST') phase = 'SFC 1 West';
    else if (upperPhase === 'NFC 2 NORTH') phase = 'NFC 2 North';
    else if (upperPhase === 'NFC 2 MIDLANDS') phase = 'NFC 2 Midlands';
    else if (upperPhase === 'SFC 2 EAST') phase = 'SFC 2 East';
    else if (upperPhase === 'SFC 2 WEST') phase = 'SFC 2 West';
    else if (upperPhase === 'PREMIERSHIP NORTH') phase = 'Premiership North';
    else if (upperPhase === 'PREMIERSHIP SOUTH') phase = 'Premiership South';

    parentPhase = teamParentMap[homeTeam] || (phase.startsWith('Premiership') ? 'Premiership' : '');
  }

  cleanGames.push({
    competition: 'BAFA National Leagues',
    year: '2026',
    phase,
    date,
    away_team: awayTeam,
    home_team: homeTeam,
    away_score: awayScore,
    home_score: homeScore,
    venue,
    notes,
    away_coach: '',
    home_coach: '',
    is_double_header: 'FALSE',
    date_precision: 'day',
    date_display: '',
    time,
    status,
    confidence_level: 'high',
    is_playoff: isPlayoff ? 'TRUE' : 'FALSE',
    is_title_game: isTitle ? 'TRUE' : 'FALSE',
    final_type: finalType,
    title_name: titleName,
    playoff_round: playoffRound,
    parent_phase: parentPhase,
    away_phase: awayPhase
  });
}

console.log(`Cleaned ${cleanGames.length} games for 2026.`);

// Write games2026.csv
const headers = [
  'competition', 'year', 'phase', 'date', 'away_team', 'home_team',
  'away_score', 'home_score', 'venue', 'notes', 'away_coach', 'home_coach',
  'is_double_header', 'date_precision', 'date_display', 'time', 'status',
  'confidence_level', 'is_playoff', 'is_title_game', 'final_type',
  'title_name', 'playoff_round', 'parent_phase', 'away_phase'
];

const escapeCsv = (val) => {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const lines = [headers.join(',')];
for (const g of cleanGames) {
  lines.push(headers.map(h => escapeCsv(g[h])).join(','));
}

const outPath = 'data/BAFANL/games2026.csv';
fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`Successfully wrote ${cleanGames.length} games to ${outPath}!`);
