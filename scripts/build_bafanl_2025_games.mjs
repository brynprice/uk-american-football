import fs from 'fs';
import { parse } from 'csv-parse/sync';

// 1. Read scraped 2025 matches
const scrapedMatches = JSON.parse(
  fs.readFileSync('/Users/brynprice/.gemini/antigravity/brain/29afc068-86b4-41f5-b685-4e55f014f3ce/scratch/scraped_2025_matches.json', 'utf8')
);

// 2. Read standings for team -> division mapping
const standingsContent = fs.readFileSync('data/BAFANL/standings2025.csv', 'utf8');
const standingsRecords = parse(standingsContent, { columns: true, skip_empty_lines: true });

const teamDivisionMap = {};
const teamParentMap = {};
for (const s of standingsRecords) {
  teamDivisionMap[s.team] = s.phase;
  teamParentMap[s.team] = s.parent_phase;
}

const VERIFIED_COACHES_2025 = {
  'Bristol Aztecs': 'Pete Jones',
  'London Warriors': 'Tony Allen',
  'Manchester Titans': 'George Foster',
  'East Kilbride Pirates': 'Matthew Davies',
  'London Blitz': 'Heath Thomas',
  'Rushmoor Knights': 'Calvin Stitt',
  'Hertfordshire Cheetahs': 'Rich Moult',
  'Solent Thrashers': 'Dave Gibbs',
  'Wembley Stallions': 'Warren Smart',
  'Glasgow Tigers': 'Ryan McCluskey',
  'Sussex Thunder': 'Billy Walker',
};

const cleanGames = [];

for (const m of scrapedMatches) {
  let phase = m.phase ? m.phase.trim() : '';
  let homeTeam = m.home_team.trim();
  let awayTeam = m.away_team.trim();
  let homeScore = m.home_score.trim();
  let awayScore = m.away_score.trim();
  const date = m.date.trim();
  const time = m.time.trim() || '14:00';
  let venue = m.venue ? m.venue.trim() : '';
  if (venue.startsWith('@ @ ')) venue = venue.substring(4).trim();
  if (venue.startsWith('@ ')) venue = venue.substring(2).trim();

  // If venue contains status text like "Final Score - not approved", clear it
  if (venue.includes('Final Score') || venue.includes('Updated')) {
    venue = '';
  }

  let isPlayoff = false;
  let isTitle = false;
  let finalType = '';
  let titleName = '';
  let playoffRound = '';
  let parentPhase = '';
  let status = 'completed';
  let notes = 'Source: League Republic official match records (https://bafanle.leaguerepublic.com/)';

  const tooltip = (m.tooltip_note || '').toLowerCase();

  // Handle specific known unrecorded score matches
  if (date === '2025-07-27' && homeTeam === 'Sandwell Steelers' && awayTeam === 'Merseyside Nighthawks') {
    homeScore = '15';
    awayScore = '24';
    status = 'completed';
    notes = 'Source: Contemporary team match reports / social media announcement (Merseyside advanced)';
    venue = 'Willenhall Rugby Club';
  } else if (date === '2025-08-03' && homeTeam === 'East Kent Mavericks' && awayTeam === 'London Olympians') {
    homeScore = '14';
    awayScore = '12';
    status = 'completed';
    notes = 'Source: East Kent Mavericks official match report (Mavericks advanced to Southern Final in OT)';
    venue = 'Simon Langton Boys School';
  } else if (m.score_raw && m.score_raw.includes('walkover')) {
    if (m.score_raw.includes('Home walkover') || m.home_score === 'H' || m.away_score === 'W') {
      status = 'awarded';
      homeScore = '1';
      awayScore = '0';
      notes = 'Source: League Republic official match records (Home walkover awarded 1-0)';
    } else {
      status = 'awarded';
      homeScore = '0';
      awayScore = '1';
      notes = 'Source: League Republic official match records (Away walkover awarded 0-1)';
    }
  } else if (m.score_raw && (m.score_raw.includes('Cancelled') || m.score_raw === 'C - C' || m.score_raw === 'A - A')) {
    status = 'cancelled';
    homeScore = '0';
    awayScore = '0';
    notes = 'Source: League Republic official match records (Cancelled)';
  } else if (!homeScore && !awayScore) {
    status = 'cancelled';
    homeScore = '0';
    awayScore = '0';
  }

  // Playoff & Postseason Classification
  if (tooltip || date >= '2025-07-27' && !phase) {
    isPlayoff = true;

    if (tooltip.includes('premiership semi-final')) {
      phase = 'Playoffs';
      parentPhase = 'Premiership';
      playoffRound = 'Semi-Final';
    } else if (tooltip.includes('southern prem\' promotion/relegation')) {
      phase = 'Playoffs';
      parentPhase = 'Premiership';
      playoffRound = 'Promotion Playoff';
    } else if (tooltip.includes('d1 quarter')) {
      phase = 'Playoffs';
      parentPhase = 'Division One';
      playoffRound = 'Quarter-Final';
    } else if (tooltip.includes('d1 semi')) {
      phase = 'Playoffs';
      parentPhase = 'Division One';
      playoffRound = 'Semi-Final';
    } else if (tooltip.includes('d1 northern final')) {
      phase = 'Playoffs';
      parentPhase = 'Division One';
      playoffRound = 'Final';
      isTitle = true;
      finalType = 'bowl';
      titleName = 'Division One Northern Final';
    } else if (tooltip.includes('d1 southern final')) {
      phase = 'Playoffs';
      parentPhase = 'Division One';
      playoffRound = 'Final';
      isTitle = true;
      finalType = 'bowl';
      titleName = 'Division One Southern Final';
    } else if (tooltip.includes('d2 quarter')) {
      phase = 'Playoffs';
      parentPhase = 'Division Two';
      playoffRound = 'Quarter-Final';
    } else if (tooltip.includes('promotion/relegation') || tooltip.includes('relegation match')) {
      phase = 'Playoffs';
      parentPhase = 'Division One';
      playoffRound = tooltip.includes('relegation') ? 'Relegation Playoff' : 'Promotion Playoff';
    } else {
      // Fallback based on team division
      phase = 'Playoffs';
      const homeDiv = teamDivisionMap[homeTeam] || '';
      if (homeDiv.startsWith('Premiership')) parentPhase = 'Premiership';
      else if (homeDiv.startsWith('SFC 2') || homeDiv.startsWith('NFC 2')) parentPhase = 'Division Two';
      else parentPhase = 'Division One';
      playoffRound = 'Playoffs';
    }
  } else {
    // Regular Season Match
    // If phase is empty from scraped heading, infer from home team division
    if (!phase) {
      phase = teamDivisionMap[homeTeam] || teamDivisionMap[awayTeam] || '';
    }

    // Normalize phase casing to match standings
    const norm = phase.toUpperCase();
    if (norm === 'PREMIERSHIP NORTH') phase = 'Premiership North';
    else if (norm === 'PREMIERSHIP SOUTH') phase = 'Premiership South';
    else if (norm === 'NFC 1 SCOTTISH') phase = 'NFC 1 Scottish';
    else if (norm === 'NFC 1 NORTH') phase = 'NFC 1 North';
    else if (norm === 'NFC 1 MIDLANDS') phase = 'NFC 1 Midlands';
    else if (norm === 'SFC 1 EAST') phase = 'SFC 1 East';
    else if (norm === 'SFC 1 CENTRAL') phase = 'SFC 1 Central';
    else if (norm === 'SFC 1 WEST') phase = 'SFC 1 West';
    else if (norm === 'NFC 2 NORTH') phase = 'NFC 2 North';
    else if (norm === 'NFC 2 MIDLANDS') phase = 'NFC 2 Midlands';
    else if (norm === 'SFC 2 EAST') phase = 'SFC 2 East';
    else if (norm === 'SFC 2 WEST') phase = 'SFC 2 West';

    parentPhase = teamParentMap[homeTeam] || '';
  }

  const homeCoach = VERIFIED_COACHES_2025[homeTeam] || '';
  const awayCoach = VERIFIED_COACHES_2025[awayTeam] || '';

  cleanGames.push({
    competition: 'BAFA National Leagues',
    year: '2025',
    phase: phase,
    date: date,
    away_team: awayTeam,
    home_team: homeTeam,
    away_score: awayScore,
    home_score: homeScore,
    venue: venue,
    notes: notes,
    away_coach: awayCoach,
    home_coach: homeCoach,
    is_double_header: 'FALSE',
    date_precision: 'day',
    date_display: '',
    time: time,
    status: status,
    confidence_level: 'high',
    is_playoff: isPlayoff ? 'TRUE' : 'FALSE',
    is_title_game: isTitle ? 'TRUE' : 'FALSE',
    final_type: finalType,
    title_name: titleName,
    playoff_round: playoffRound,
    parent_phase: parentPhase
  });
}

// 3. Append Britbowl XXXVII (National Championship Title Game)
cleanGames.push({
  competition: 'BAFA National Leagues',
  year: '2025',
  phase: 'Playoffs',
  date: '2025-09-07',
  away_team: 'Bristol Aztecs',
  home_team: 'London Warriors',
  away_score: '27',
  home_score: '24',
  venue: 'Butts Park Arena',
  notes: 'Source: British American Football Association official championship match report (Bristol Aztecs first senior national title)',
  away_coach: 'Pete Jones',
  home_coach: 'Tony Allen',
  is_double_header: 'FALSE',
  date_precision: 'day',
  date_display: '',
  time: '16:00',
  status: 'completed',
  confidence_level: 'high',
  is_playoff: 'TRUE',
  is_title_game: 'TRUE',
  final_type: 'title',
  title_name: 'Britbowl XXXVII',
  playoff_round: 'Final',
  parent_phase: 'Premiership'
});

// Sort chronologically
cleanGames.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

// Headers matching canonical schema
const headers = [
  'competition', 'year', 'phase', 'date', 'away_team', 'home_team',
  'away_score', 'home_score', 'venue', 'notes', 'away_coach', 'home_coach',
  'is_double_header', 'date_precision', 'date_display', 'time', 'status',
  'confidence_level', 'is_playoff', 'is_title_game', 'final_type', 'title_name',
  'playoff_round', 'parent_phase'
];

const csvLines = [headers.join(',')];
for (const g of cleanGames) {
  const line = [
    `"${g.competition}"`,
    g.year,
    `"${g.phase}"`,
    g.date,
    `"${g.away_team}"`,
    `"${g.home_team}"`,
    g.away_score,
    g.home_score,
    `"${g.venue}"`,
    `"${g.notes}"`,
    `"${g.away_coach}"`,
    `"${g.home_coach}"`,
    g.is_double_header,
    g.date_precision,
    `"${g.date_display}"`,
    g.time,
    g.status,
    g.confidence_level,
    g.is_playoff,
    g.is_title_game,
    `"${g.final_type}"`,
    `"${g.title_name}"`,
    `"${g.playoff_round}"`,
    `"${g.parent_phase}"`
  ];
  csvLines.push(line.join(','));
}

fs.writeFileSync('data/BAFANL/games2025.csv', csvLines.join('\n') + '\n');
console.log(`Generated data/BAFANL/games2025.csv with ${cleanGames.length} fixtures.`);
