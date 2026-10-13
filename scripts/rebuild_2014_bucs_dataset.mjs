import fs from 'fs';
import { parse } from 'csv-parse/sync';

// Canonical alias map for 2014 season
const ALIAS_MAP = {
  'Brighton Panthers': 'Brighton Tsunami',
  'Anglia Ruskin Rhinos': 'Anglia Ruskin Siege',
  'Anglia Ruskin Phantoms': 'Anglia Ruskin Siege',
  'Edinburgh Mavericks': 'Edinburgh Predators',
  'DMU Falcons': 'DMU Lions',
  'Leeds Celtics': 'Leeds Gryphons',
  'Leeds Carnegie': 'Leeds Beckett Carnegie',
  'Leeds Met Carnegie': 'Leeds Beckett Carnegie',
  'London City Sentinels': 'City Wolfpack',
  'Bangor Llewod': 'Bangor MudDogs',
  'Bangor Muddogs': 'Bangor MudDogs',
  'OBU Panthers': 'Oxford Brookes University',
  'LJM Fury': 'LJMU Fury',
  'UCL Rams': 'UCLan Rams',
  'Hallam Warriors': 'Sheffield Hallam Warriors',
  'Nottingham Outlaws': 'Nottingham Gold',
  'Nottingham Students': 'Nottingham Gold',
  'Coventry Jets': 'Coventry University Jets',
  'Canterbury Chargers': 'Canterbury CC Chargers',
  'RHUL Bears': 'Royal Holloway Bears',
  'Loughborough Students': 'Loughborough Students'
};

function resolveTeam(t) {
  if (!t) return '';
  const trimmed = t.trim();
  return ALIAS_MAP[trimmed] || trimmed;
}

function escapeCsv(val) {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// 1. Phases (16 phases)
// User requirement: In Division 1, the two playoffs (north and south) are contained within a Parent "Playoffs" phase
const phaseHeaders = ['competition_name', 'year', 'phase_name', 'parent_phase', 'type', 'ordinal'];
const phases = [
  { competition_name: 'BUAFL', year: '2014', phase_name: 'Premier North/South', parent_phase: '', type: 'Tier', ordinal: '1' },
  { competition_name: 'BUAFL', year: '2014', phase_name: 'National Championship', parent_phase: 'Premier North/South', type: 'Playoffs', ordinal: '2' },
  { competition_name: 'BUAFL', year: '2014', phase_name: 'Premier North', parent_phase: 'Premier North/South', type: 'Division', ordinal: '3' },
  { competition_name: 'BUAFL', year: '2014', phase_name: 'Premier South', parent_phase: 'Premier North/South', type: 'Division', ordinal: '4' },
  { competition_name: 'BUAFL', year: '2014', phase_name: 'Division 1', parent_phase: '', type: 'Tier', ordinal: '5' },
  { competition_name: 'BUAFL', year: '2014', phase_name: 'Playoffs', parent_phase: 'Division 1', type: 'Playoffs', ordinal: '6' },
  { competition_name: 'BUAFL', year: '2014', phase_name: 'National Trophy (North)', parent_phase: 'Playoffs', type: 'Playoffs', ordinal: '7' },
  { competition_name: 'BUAFL', year: '2014', phase_name: 'National Trophy (South)', parent_phase: 'Playoffs', type: 'Playoffs', ordinal: '8' },
  { competition_name: 'BUAFL', year: '2014', phase_name: 'Borders Division', parent_phase: 'Division 1', type: 'Division', ordinal: '9' },
  { competition_name: 'BUAFL', year: '2014', phase_name: 'Yorkshire Division', parent_phase: 'Division 1', type: 'Division', ordinal: '10' },
  { competition_name: 'BUAFL', year: '2014', phase_name: 'North West Division', parent_phase: 'Division 1', type: 'Division', ordinal: '11' },
  { competition_name: 'BUAFL', year: '2014', phase_name: 'Midlands Division', parent_phase: 'Division 1', type: 'Division', ordinal: '12' },
  { competition_name: 'BUAFL', year: '2014', phase_name: 'London Division', parent_phase: 'Division 1', type: 'Division', ordinal: '13' },
  { competition_name: 'BUAFL', year: '2014', phase_name: 'East Division', parent_phase: 'Division 1', type: 'Division', ordinal: '14' },
  { competition_name: 'BUAFL', year: '2014', phase_name: 'South West Division', parent_phase: 'Division 1', type: 'Division', ordinal: '15' },
  { competition_name: 'BUAFL', year: '2014', phase_name: 'South East Division', parent_phase: 'Division 1', type: 'Division', ordinal: '16' }
];

const phasesCsv = [phaseHeaders.join(',')];
for (const p of phases) {
  phasesCsv.push(phaseHeaders.map(h => escapeCsv(p[h])).join(','));
}
fs.writeFileSync('data/BUAFL/phases2014.csv', phasesCsv.join('\n') + '\n', 'utf8');
fs.writeFileSync('data/2014phases.csv', phasesCsv.join('\n') + '\n', 'utf8');
console.log('Successfully wrote data/BUAFL/phases2014.csv (16 phases)');

// 2. Games processing
const rawGamesContent = fs.readFileSync('data/BUAFL/games2014.csv', 'utf8');
const rawGames = parse(rawGamesContent, { columns: true, skip_empty_lines: true, trim: true });

console.log(`Read ${rawGames.length} raw games from data/BUAFL/games2014.csv`);

const cleanedGames = [];
const seenGameKeys = new Set();

for (let i = 0; i < rawGames.length; i++) {
  const g = rawGames[i];
  let awayTeam = resolveTeam(g.away_team);
  let homeTeam = resolveTeam(g.home_team);
  let phase = g.phase.trim();
  let date = g.date ? g.date.trim() : '';
  let awayScore = g.away_score ? g.away_score.trim() : '';
  let homeScore = g.home_score ? g.home_score.trim() : '';
  let venue = g.venue ? g.venue.trim() : '';
  let notes = g.notes ? g.notes.trim() : '';
  let time = g.time ? g.time.trim() : '13:00';
  let datePrecision = g.date_precision ? g.date_precision.trim() : (date ? 'day' : 'season');

  // Fix 1: 2014-11-16 Kingston Cougars @ Edinburgh Napier Knights (0-18) in London Division
  // Actual: Kingston Cougars @ Reading Knights (0-18)
  if (date === '2014-11-16' && awayTeam === 'Kingston Cougars' && (homeTeam === 'Edinburgh Napier Knights' || homeTeam === 'Reading Knights')) {
    homeTeam = 'Reading Knights';
    phase = 'London Division';
    notes = 'Source: BAFRA Newsflash Issue 2014-44';
  }

  // Fix 2: 2014-11-16 Leicester Longhorns @ Loughborough Students (6-68) in Midlands Division
  // Actual: Leicester Longhorns @ Nottingham Gold (6-68)
  if (date === '2014-11-16' && awayTeam === 'Leicester Longhorns' && (homeTeam === 'Loughborough Students' || homeTeam === 'Nottingham Gold')) {
    homeTeam = 'Nottingham Gold';
    phase = 'Midlands Division';
    notes = 'Source: BAFRA Newsflash Issue 2014-44';
  }

  // Fix 3: 2014-11-16 Kent Falcons @ Oxford Brookes University (12-6) in South East Division
  // Actual: East Division
  if (date === '2014-11-16' && awayTeam === 'Kent Falcons' && homeTeam === 'Oxford Brookes University') {
    phase = 'East Division';
    notes = 'Source: BAFRA Newsflash Issue 2014-44';
  }

  // Fix 4: 2014-11-23 Northumbria Mustangs @ Kingston Cougars (42-14) in London Division
  // Actual: Northumbria Mustangs @ Teesside Cougars (42-14) in Borders Division
  if (date === '2014-11-23' && awayTeam === 'Northumbria Mustangs' && (homeTeam === 'Kingston Cougars' || homeTeam === 'Teesside Cougars')) {
    homeTeam = 'Teesside Cougars';
    phase = 'Borders Division';
    notes = 'Source: BAFRA Newsflash Issue 2014-47';
  }

  // Fix 5: 2014-11-23 KCL Regents @ Edinburgh Napier Knights (2-8) in London Division
  // Actual: KCL Regents @ Reading Knights (2-8) in London Division
  if (date === '2014-11-23' && awayTeam === 'KCL Regents' && (homeTeam === 'Edinburgh Napier Knights' || homeTeam === 'Reading Knights')) {
    homeTeam = 'Reading Knights';
    phase = 'London Division';
    notes = 'Source: BAFRA Newsflash Issue 2014-47';
  }

  // Duplicate checks
  const key = `${awayTeam}|${homeTeam}|${date}`;
  if (seenGameKeys.has(key)) {
    console.log(`Skipping duplicate regular season game: ${key}`);
    continue;
  }
  seenGameKeys.add(key);

  // Format notes
  if (notes.includes('bafra.org/newsflashes/')) {
    const m = notes.match(/201[45](\d{2})/);
    if (m) {
      const yearStr = notes.includes('2015') ? '2015' : '2014';
      notes = `Source: BAFRA Newsflash Issue ${yearStr}-${m[1]}`;
    } else {
      notes = 'Source: BAFRA Newsflashes';
    }
  } else if (!notes) {
    if (awayTeam === 'Brighton Tsunami' || homeTeam === 'Brighton Tsunami') {
      notes = 'Source: Brighton Tsunami historical records';
    } else {
      notes = 'Source: BUCS contemporary records';
    }
  }

  if (awayTeam === 'Brighton Tsunami' || homeTeam === 'Brighton Tsunami') {
    if (homeTeam === 'Brighton Tsunami' && !venue) {
      venue = 'Falmer Campus';
    }
    notes = 'Source: Brighton Tsunami historical records';
  }

  // Determine parent phase
  let parentPhase = '';
  if (phase === 'Premier North' || phase === 'Premier South') {
    parentPhase = 'Premier North/South';
  } else {
    parentPhase = 'Division 1';
  }

  // Head coach strictly verified per Rule 6 (Only Chris Denny for Brighton Tsunami)
  const awayCoach = awayTeam === 'Brighton Tsunami' ? 'Chris Denny' : '';
  const homeCoach = homeTeam === 'Brighton Tsunami' ? 'Chris Denny' : '';

  cleanedGames.push({
    competition: 'BUAFL',
    year: '2014',
    phase,
    parent_phase: parentPhase,
    away_phase: '',
    away_parent_phase: '',
    date,
    away_team: awayTeam,
    home_team: homeTeam,
    away_score: awayScore,
    home_score: homeScore,
    venue,
    notes,
    away_coach: awayCoach,
    home_coach: homeCoach,
    is_double_header: 'FALSE',
    date_precision: datePrecision,
    date_display: date ? date.split('-').reverse().join('/') : (datePrecision === 'month' ? 'March 2015' : ''),
    time,
    status: 'completed',
    confidence_level: 'high',
    is_playoff: 'FALSE',
    is_title_game: 'FALSE',
    final_type: '',
    title_name: '',
    playoff_round: ''
  });
}

console.log(`Cleaned regular season games: ${cleanedGames.length}`);

// 3. Postseason fixtures (5 games)
const playoffGames = [
  {
    competition: 'BUAFL',
    year: '2014',
    phase: 'National Championship',
    parent_phase: 'Premier North/South',
    away_phase: '',
    away_parent_phase: '',
    date: '2015-03-08',
    away_team: 'Hertfordshire Hurricanes',
    home_team: 'Durham Saints',
    away_score: '19',
    home_score: '14',
    venue: '',
    notes: 'Source: BUCS Championship Playoffs',
    away_coach: '',
    home_coach: '',
    is_double_header: 'FALSE',
    date_precision: 'day',
    date_display: '08/03/2015',
    time: '13:00',
    status: 'completed',
    confidence_level: 'high',
    is_playoff: 'TRUE',
    is_title_game: 'FALSE',
    final_type: '',
    title_name: '',
    playoff_round: 'Semi-Final'
  },
  {
    competition: 'BUAFL',
    year: '2014',
    phase: 'National Championship',
    parent_phase: 'Premier North/South',
    away_phase: '',
    away_parent_phase: '',
    date: '2015-03-08',
    away_team: 'Stirling Clansmen',
    home_team: 'Birmingham Lions',
    away_score: '35',
    home_score: '13',
    venue: '',
    notes: 'Source: BUCS Championship Playoffs',
    away_coach: '',
    home_coach: '',
    is_double_header: 'FALSE',
    date_precision: 'day',
    date_display: '08/03/2015',
    time: '13:00',
    status: 'completed',
    confidence_level: 'high',
    is_playoff: 'TRUE',
    is_title_game: 'FALSE',
    final_type: '',
    title_name: '',
    playoff_round: 'Semi-Final'
  },
  {
    competition: 'BUAFL',
    year: '2014',
    phase: 'National Championship',
    parent_phase: 'Premier North/South',
    away_phase: '',
    away_parent_phase: '',
    date: '2015-03-21',
    away_team: 'Stirling Clansmen',
    home_team: 'Hertfordshire Hurricanes',
    away_score: '46',
    home_score: '6',
    venue: 'Allianz Park',
    notes: 'Source: BUCS National Championship',
    away_coach: '',
    home_coach: '',
    is_double_header: 'FALSE',
    date_precision: 'day',
    date_display: '21/03/2015',
    time: '14:30',
    status: 'completed',
    confidence_level: 'high',
    is_playoff: 'TRUE',
    is_title_game: 'TRUE',
    final_type: 'title',
    title_name: 'College Bowl XXIX',
    playoff_round: 'Final'
  },
  {
    competition: 'BUAFL',
    year: '2014',
    phase: 'National Trophy (North)',
    parent_phase: 'Playoffs',
    away_phase: '',
    away_parent_phase: '',
    date: '',
    away_team: 'Sheffield Hallam Warriors',
    home_team: 'Glasgow Tigers',
    away_score: '26',
    home_score: '6',
    venue: 'UCLan Sports Arena',
    notes: 'Source: BUCS Division 1 North Final',
    away_coach: '',
    home_coach: '',
    is_double_header: 'FALSE',
    date_precision: 'month',
    date_display: 'March 2015',
    time: '13:00',
    status: 'completed',
    confidence_level: 'high',
    is_playoff: 'TRUE',
    is_title_game: 'TRUE',
    final_type: 'bowl',
    title_name: 'National Trophy (North)',
    playoff_round: 'Final'
  },
  {
    competition: 'BUAFL',
    year: '2014',
    phase: 'National Trophy (South)',
    parent_phase: 'Playoffs',
    away_phase: '',
    away_parent_phase: '',
    date: '',
    away_team: 'Surrey Stingers',
    home_team: 'Kingston Cougars',
    away_score: '9',
    home_score: '42',
    venue: '',
    notes: 'Source: BUCS Division 1 South Final',
    away_coach: '',
    home_coach: '',
    is_double_header: 'FALSE',
    date_precision: 'month',
    date_display: 'March 2015',
    time: '13:00',
    status: 'completed',
    confidence_level: 'high',
    is_playoff: 'TRUE',
    is_title_game: 'TRUE',
    final_type: 'bowl',
    title_name: 'National Trophy (South)',
    playoff_round: 'Final'
  }
];

for (const p of playoffGames) {
  cleanedGames.push(p);
}

const gameHeaders = [
  'competition', 'year', 'phase', 'parent_phase', 'away_phase', 'away_parent_phase',
  'date', 'away_team', 'home_team', 'away_score', 'home_score', 'venue', 'notes',
  'away_coach', 'home_coach', 'is_double_header', 'date_precision', 'date_display',
  'time', 'status', 'confidence_level', 'is_playoff', 'is_title_game', 'final_type',
  'title_name', 'playoff_round'
];

const gamesCsv = [gameHeaders.join(',')];
for (const g of cleanedGames) {
  gamesCsv.push(gameHeaders.map(h => escapeCsv(g[h])).join(','));
}
fs.writeFileSync('data/BUAFL/games2014.csv', gamesCsv.join('\n') + '\n', 'utf8');
console.log(`Successfully wrote data/BUAFL/games2014.csv (${cleanedGames.length} games)`);

// 4. Standings Generation (16 columns across 82 teams)
// Calculate stats from the 280 regular season games
const standingsByDiv = {};
const divisions = [
  'Premier North',
  'Premier South',
  'Borders Division',
  'Yorkshire Division',
  'North West Division',
  'Midlands Division',
  'London Division',
  'East Division',
  'South West Division',
  'South East Division'
];

for (const div of divisions) {
  standingsByDiv[div] = {};
}

// Only process regular season games (first 280)
for (let i = 0; i < cleanedGames.length - playoffGames.length; i++) {
  const g = cleanedGames[i];
  const div = g.phase;
  const away = g.away_team;
  const home = g.home_team;
  const ascore = parseInt(g.away_score);
  const hscore = parseInt(g.home_score);

  if (!standingsByDiv[div][away]) {
    standingsByDiv[div][away] = { w: 0, l: 0, t: 0, pf: 0, pa: 0, gp: 0 };
  }
  if (!standingsByDiv[div][home]) {
    standingsByDiv[div][home] = { w: 0, l: 0, t: 0, pf: 0, pa: 0, gp: 0 };
  }

  standingsByDiv[div][away].gp++;
  standingsByDiv[div][away].pf += ascore;
  standingsByDiv[div][away].pa += hscore;

  standingsByDiv[div][home].gp++;
  standingsByDiv[div][home].pf += hscore;
  standingsByDiv[div][home].pa += ascore;

  if (ascore > hscore) {
    standingsByDiv[div][away].w++;
    standingsByDiv[div][home].l++;
  } else if (hscore > ascore) {
    standingsByDiv[div][home].w++;
    standingsByDiv[div][away].l++;
  } else {
    standingsByDiv[div][away].t++;
    standingsByDiv[div][home].t++;
  }
}

// Confirmed champions (9 confirmed, South West left blank per user instructions)
const verifiedChampions = new Set([
  'Durham Saints',              // Premier North (#1 seed)
  'Birmingham Lions',           // Premier South (#1 seed on H2H pts diff)
  'Glasgow Tigers',             // Borders Division (7-0-0)
  'Cambridge Pythons',          // East Division (6-1-0)
  'Royal Holloway Bears',       // London Division (7-0-0)
  'Warwick Wolves',             // Midlands Division (7-1-0)
  'Tarannau Aberystwyth',       // North West Division (8-0-0)
  'Solent Redhawks',            // South East Division (6-1-0)
  'Sheffield Hallam Warriors'   // Yorkshire Division (7-0-0)
  // South West Division: left blank per explicit user instruction
]);

const standingsHeaders = [
  'competition_name', 'parent_phase', 'phase', 'year', 'team',
  'position', 'games_played', 'wins', 'losses', 'ties', 'points_for',
  'points_against', 'streak', 'is_champion', 'notes', 'head_coach'
];

const finalStandingsRows = [];

for (const div of divisions) {
  const teamsObj = standingsByDiv[div];
  const teamList = Object.keys(teamsObj).map(teamName => ({
    team: teamName,
    ...teamsObj[teamName]
  }));

  // Sort by win pct, diff, pf, name
  teamList.sort((a, b) => {
    const pctA = (a.w + 0.5 * a.t) / (a.gp || 1);
    const pctB = (b.w + 0.5 * b.t) / (b.gp || 1);
    if (pctB !== pctA) return pctB - pctA;
    const diffA = a.pf - a.pa;
    const diffB = b.pf - b.pa;
    if (diffB !== diffA) return diffB - diffA;
    if (b.pf !== a.pf) return b.pf - a.pf;
    return a.team.localeCompare(b.team);
  });

  const parentPhase = (div === 'Premier North' || div === 'Premier South')
    ? 'Premier North/South'
    : 'Division 1';

  teamList.forEach((t, idx) => {
    const isChamp = verifiedChampions.has(t.team) ? 'TRUE' : 'FALSE';
    const coach = t.team === 'Brighton Tsunami' ? 'Chris Denny' : '';
    const notes = t.team === 'Brighton Tsunami'
      ? 'Source: Brighton Tsunami historical records'
      : 'Source: BUCS official records & BAFRA Newsflashes';

    finalStandingsRows.push({
      competition_name: 'BUAFL',
      parent_phase: parentPhase,
      phase: div,
      year: '2014',
      team: t.team,
      position: (idx + 1).toString(),
      games_played: t.gp.toString(),
      wins: t.w.toString(),
      losses: t.l.toString(),
      ties: t.t.toString(),
      points_for: t.pf.toString(),
      points_against: t.pa.toString(),
      streak: '',
      is_champion: isChamp,
      notes,
      head_coach: coach
    });
  });
}

const standingsCsv = [standingsHeaders.join(',')];
for (const r of finalStandingsRows) {
  standingsCsv.push(standingsHeaders.map(h => escapeCsv(r[h])).join(','));
}
fs.writeFileSync('data/BUAFL/standings2014.csv', standingsCsv.join('\n') + '\n', 'utf8');
console.log(`Successfully wrote data/BUAFL/standings2014.csv (${finalStandingsRows.length} teams across 10 divisions)`);
