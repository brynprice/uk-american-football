import fs from 'fs';
import { parse } from 'csv-parse/sync';

// Canonical alias map for 2015 season
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

// -------------------------------------------------------------
// 1. Phases (26 phases matching Supabase DB hierarchy)
// -------------------------------------------------------------
const phaseHeaders = ['competition_name', 'year', 'phase_name', 'parent_phase', 'type', 'ordinal'];
const phases = [
  // Tier 1 (Premier North/South)
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Premier North/South', parent_phase: '', type: 'Tier', ordinal: '1' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'National Championship', parent_phase: 'Premier North/South', type: 'Playoffs', ordinal: '2' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Premier North', parent_phase: 'Premier North/South', type: 'Division', ordinal: '3' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Premier South', parent_phase: 'Premier North/South', type: 'Division', ordinal: '4' },

  // Tier 2 (Division 1)
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 1', parent_phase: '', type: 'Tier', ordinal: '5' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'National Trophy', parent_phase: 'Division 1', type: 'Playoffs', ordinal: '6' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 1 North', parent_phase: 'Division 1', type: 'Conference', ordinal: '7' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 1 Scottish/Northern', parent_phase: 'Division 1 North', type: 'Division', ordinal: '8' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 1 Yorkshire', parent_phase: 'Division 1 North', type: 'Division', ordinal: '9' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 1 Midlands', parent_phase: 'Division 1 North', type: 'Division', ordinal: '10' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 1 South', parent_phase: 'Division 1', type: 'Conference', ordinal: '11' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 1 South Western', parent_phase: 'Division 1 South', type: 'Division', ordinal: '12' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 1 Southern', parent_phase: 'Division 1 South', type: 'Division', ordinal: '13' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 1 South Eastern', parent_phase: 'Division 1 South', type: 'Division', ordinal: '14' },

  // Tier 3 (Division 2)
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 2', parent_phase: '', type: 'Tier', ordinal: '15' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 2 North', parent_phase: 'Division 2', type: 'Conference', ordinal: '16' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Northern Conference Cup', parent_phase: 'Division 2 North', type: 'Playoffs', ordinal: '17' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 2 Scottish/Northern', parent_phase: 'Division 2 North', type: 'Division', ordinal: '18' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 2 Northern', parent_phase: 'Division 2 North', type: 'Division', ordinal: '19' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 2 Midlands', parent_phase: 'Division 2 North', type: 'Division', ordinal: '20' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 2 South', parent_phase: 'Division 2', type: 'Conference', ordinal: '21' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Southern Conference Cup', parent_phase: 'Division 2 South', type: 'Playoffs', ordinal: '22' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 2 South Western', parent_phase: 'Division 2 South', type: 'Division', ordinal: '23' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 2 Southern', parent_phase: 'Division 2 South', type: 'Division', ordinal: '24' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 2 South Eastern', parent_phase: 'Division 2 South', type: 'Division', ordinal: '25' },
  { competition_name: 'BUAFL', year: '2015', phase_name: 'Division 2 London', parent_phase: 'Division 2 South', type: 'Division', ordinal: '26' }
];

const phasesCsv = [phaseHeaders.join(',')];
for (const p of phases) {
  phasesCsv.push(phaseHeaders.map(h => escapeCsv(p[h])).join(','));
}
fs.writeFileSync('data/BUAFL/phases2015.csv', phasesCsv.join('\n') + '\n', 'utf8');
fs.writeFileSync('data/2015phases.csv', phasesCsv.join('\n') + '\n', 'utf8');
console.log('Successfully wrote data/BUAFL/phases2015.csv (26 phases)');

// Parent phase lookup
const parentPhaseMap = {};
for (const p of phases) {
  parentPhaseMap[p.phase_name] = p.parent_phase;
}

// -------------------------------------------------------------
// 2. Regular Season Games Processing
// -------------------------------------------------------------
const rawGamesContent = fs.readFileSync('data/BUAFL/games2015.csv', 'utf8');
const rawGames = parse(rawGamesContent, { columns: true, skip_empty_lines: true, trim: true });

console.log(`Read ${rawGames.length} raw games from data/BUAFL/games2015.csv`);

const cleanedGames = [];
const seenGameKeys = new Set();

// Helper to add game
function addGame(g) {
  let awayTeam = resolveTeam(g.away_team);
  let homeTeam = resolveTeam(g.home_team);
  let phase = g.phase ? g.phase.trim() : '';
  let date = g.date ? g.date.trim() : '';
  let awayScore = g.away_score !== undefined && g.away_score !== null ? String(g.away_score).trim() : '';
  let homeScore = g.home_score !== undefined && g.home_score !== null ? String(g.home_score).trim() : '';
  let venue = g.venue ? g.venue.trim() : '';
  let notes = g.notes ? g.notes.trim() : '';
  let time = g.time ? g.time.trim() : '13:00';
  let isPlayoff = g.is_playoff ? String(g.is_playoff).toUpperCase() : 'FALSE';
  let isTitleGame = g.is_title_game ? String(g.is_title_game).toUpperCase() : 'FALSE';
  let finalType = g.final_type ? g.final_type.trim().toLowerCase() : '';
  let titleName = g.title_name ? g.title_name.trim() : '';
  let playoffRound = g.playoff_round ? g.playoff_round.trim() : '';
  let datePrecision = g.date_precision ? g.date_precision.trim() : (date ? 'day' : 'season');

  // Skip self-matches if any remain unresolved
  if (awayTeam === homeTeam) {
    console.log(`Skipping unresolved self-match: ${awayTeam} vs ${homeTeam} on ${date}`);
    return;
  }

  // Deduplicate
  const key = `${awayTeam}|${homeTeam}|${date}|${phase}`;
  if (seenGameKeys.has(key)) {
    console.log(`Skipping duplicate game: ${key}`);
    return;
  }
  seenGameKeys.add(key);

  // Clean notes
  if (notes.includes('data/') || notes.includes('.csv')) {
    notes = '';
  }
  if (!notes) {
    if (awayTeam === 'Brighton Tsunami' || homeTeam === 'Brighton Tsunami') {
      notes = 'Source: Brighton Tsunami historical records';
    } else if (isPlayoff === 'TRUE') {
      notes = 'Source: BUCS Championship Playoffs';
    } else {
      notes = 'Source: BUCS contemporary records';
    }
  }

  // Head coach rule (Rule 6: Chris Denny only for Brighton Tsunami)
  const awayCoach = awayTeam === 'Brighton Tsunami' ? 'Chris Denny' : '';
  const homeCoach = homeTeam === 'Brighton Tsunami' ? 'Chris Denny' : '';
  if (homeTeam === 'Brighton Tsunami' && !venue) {
    venue = 'Falmer Campus';
  }

  const parentPhase = parentPhaseMap[phase] || '';

  cleanedGames.push({
    competition: 'BUAFL',
    year: '2015',
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
    date_display: date ? date.split('-').reverse().join('/') : '',
    time,
    status: 'completed',
    confidence_level: 'high',
    is_playoff: isPlayoff,
    is_title_game: isTitleGame,
    final_type: finalType,
    title_name: titleName,
    playoff_round: playoffRound
  });
}

// 2a. Process games from games2015.csv
for (const g of rawGames) {
  if (g.is_playoff === 'TRUE') continue;
  let away = g.away_team.trim();
  let home = g.home_team.trim();
  let date = g.date.trim();
  let phase = g.phase.trim();

  // Spurious / impossible Premier duplicates with no date that contradict verified records
  if (!date && phase === 'Premier South' && away === 'Hertfordshire Hurricanes' && home === 'Birmingham Lions') {
    continue; // Birmingham never lost 30-35; they were 8-0-0 and already played Herts twice (32-12 and 27-10)
  }
  if (!date && phase === 'Premier North' && away === 'Stirling Clansmen' && home === 'Derby Braves') {
    continue; // Stirling never lost 37-40; they were 8-0-0 and already played Derby twice (21-20 and 43-0)
  }
  if (!date && phase === 'Premier North' && away === 'Durham Saints' && home === 'Stirling Clansmen') {
    continue; // Stirling and Durham already played twice (30-28 and 32-10)
  }
  if (!date && phase === 'Premier North' && away === 'Durham Saints' && home === 'Loughborough Students') {
    continue; // Durham and Loughborough already played twice (30-18 and 18-6)
  }
  if (!date && phase === 'Premier North' && away === 'Loughborough Students' && home === 'Derby Braves') {
    continue; // Loughborough was 2-6-0; already played Derby twice (16-18 and 2-6)
  }

  // Resolve the Liverpool derby self-match on 2016-01-31
  if (date === '2016-01-31' && away === 'Liverpool Raptors' && home === 'Liverpool Raptors') {
    // LJMU Fury @ Liverpool Raptors (7-30) (BAFRA record: Liverpool Raptors 7-30 LJMU Fury)
    addGame({
      ...g,
      away_team: 'LJMU Fury',
      home_team: 'Liverpool Raptors',
      away_score: '7',
      home_score: '30',
      notes: 'Source: BAFRA Newsflash Issue 2016-05'
    });
    continue;
  }

  // Re-attribute LJMU Fury games that were misassigned to Liverpool Raptors
  if (date === '2016-02-07' && away === 'Liverpool Raptors' && home === 'Keele Crusaders') {
    // LJMU Fury @ Keele Crusaders (6-34) (Raptors had already played Keele twice: 47-0 and 28-8)
    addGame({
      ...g,
      away_team: 'LJMU Fury',
      home_team: 'Keele Crusaders'
    });
    continue;
  }
  if (date === '2016-02-14' && away === 'Bangor MudDogs' && home === 'Liverpool Raptors') {
    // Bangor MudDogs @ LJMU Fury (38-0)
    addGame({
      ...g,
      away_team: 'Bangor MudDogs',
      home_team: 'LJMU Fury'
    });
    continue;
  }
  if (date === '2016-02-21' && away === 'Bangor MudDogs' && home === 'Liverpool Raptors') {
    // Bangor MudDogs @ LJMU Fury (0-0)
    addGame({
      ...g,
      away_team: 'Bangor MudDogs',
      home_team: 'LJMU Fury'
    });
    continue;
  }

  addGame(g);
}

// 2b. Restore the 11 legitimate regular season games from data/anomalies2015.csv
const rawAnomaliesContent = fs.readFileSync('data/anomalies2015.csv', 'utf8');
const rawAnomalies = parse(rawAnomaliesContent, { columns: true, skip_empty_lines: true, trim: true });

for (const a of rawAnomalies) {
  const date = a.date.trim();
  if (!date) continue; // Only process dated fixtures

  let away = a.away_team.trim();
  let home = a.home_team.trim();
  let phase = a.phase.trim();
  let notes = 'Source: BAFRA contemporary records';

  // 1. Leeds Gryphons @ York Centurions (16-30) on 2015-10-31
  if (date === '2015-10-31' && away === 'Leeds Gryphons' && home === 'York Centurions') {
    phase = 'Division 2 Northern';
    addGame({ ...a, phase, notes });
  }
  // 2. Newcastle Raiders @ Glasgow Tigers (0-14) on 2015-11-15
  else if (date === '2015-11-15' && away === 'Newcastle Raiders' && home === 'Glasgow Tigers') {
    phase = 'Division 1 Scottish/Northern';
    addGame({ ...a, phase, notes });
  }
  // 3. DMU Lions @ Northampton Nemesis (0-7) on 2015-11-15
  else if (date === '2015-11-15' && away === 'DMU Lions' && home === 'Northampton Nemesis') {
    phase = 'Division 2 Midlands';
    addGame({ ...a, phase, notes });
  }
  // 4. LJMU Fury @ Bangor MudDogs (8-20) on 2015-11-22
  else if (date === '2015-11-22' && (away === 'Liverpool Raptors' || away === 'LJMU Fury') && home === 'Bangor MudDogs') {
    phase = 'Division 2 Northern';
    away = 'LJMU Fury';
    addGame({ ...a, away_team: away, phase, notes });
  }
  // 5. DMU Lions @ Coventry University Jets (0-21) on 2015-11-29
  else if (date === '2015-11-29' && away === 'DMU Lions' && home === 'Coventry University Jets') {
    phase = 'Division 2 Midlands';
    addGame({ ...a, phase, notes });
  }
  // 6. Liverpool derby: Liverpool Raptors @ LJMU Fury (0-36) on 2015-12-13
  else if (date === '2015-12-13' && away === 'Liverpool Raptors' && home === 'Liverpool Raptors') {
    phase = 'Division 2 Northern';
    home = 'LJMU Fury';
    addGame({ ...a, away_team: away, home_team: home, phase, notes });
  }
  // 7. Leicester Longhorns @ Coventry University Jets (6-7) on 2016-01-24
  else if (date === '2016-01-24' && away === 'Leicester Longhorns' && home === 'Coventry University Jets') {
    phase = 'Division 2 Midlands';
    addGame({ ...a, phase, notes });
  }
  // 8. Bath Killer Bees @ Birmingham Lions (8-41) on 2016-02-06
  else if (date === '2016-02-06' && away === 'Bath Killer Bees' && home === 'Birmingham Lions') {
    phase = 'Premier South';
    addGame({ ...a, phase, notes });
  }
  // 9. Edge Hill Vikings @ Keele Crusaders (17-6) on 2016-02-14
  else if (date === '2016-02-14' && away === 'Edge Hill Vikings' && home === 'Keele Crusaders') {
    phase = 'Division 2 Northern';
    addGame({ ...a, phase, notes });
  }
  // 10. Northampton Nemesis @ Coventry University Jets (6-32) on 2016-02-14
  else if (date === '2016-02-14' && away === 'Northampton Nemesis' && home === 'Coventry University Jets') {
    phase = 'Division 2 Midlands';
    addGame({ ...a, phase, notes });
  }
  // 11. LJMU Fury @ Edge Hill Vikings (0-0) on 2016-02-21
  else if (date === '2016-02-21' && (away === 'Liverpool Raptors' || away === 'LJMU Fury') && home === 'Edge Hill Vikings') {
    phase = 'Division 2 Northern';
    away = 'LJMU Fury';
    addGame({ ...a, away_team: away, phase, notes });
  }
}

// 2c. Add Brighton's 2 missing home fixtures from data/gamesbrighton.csv
const rawBrightonContent = fs.readFileSync('data/gamesbrighton.csv', 'utf8');
const rawBrighton = parse(rawBrightonContent, { columns: true, skip_empty_lines: true, trim: true }).filter(g => g.year === '2015');

for (const b of rawBrighton) {
  let dateParts = b.date.split('/');
  let isoDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}` : b.date;
  
  addGame({
    competition: 'BUAFL',
    year: '2015',
    phase: 'Division 1 South Eastern',
    date: isoDate,
    away_team: b.away_team,
    home_team: b.home_team,
    away_score: b.away_score,
    home_score: b.home_score,
    venue: b.venue || (b.home_team === 'Brighton Panthers' ? 'Falmer Campus' : ''),
    notes: 'Source: Brighton Tsunami historical records',
    away_coach: b.away_team === 'Brighton Panthers' ? 'Chris Denny' : '',
    home_coach: b.home_team === 'Brighton Panthers' ? 'Chris Denny' : '',
    is_double_header: 'FALSE',
    date_precision: 'day',
    time: '13:00',
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

// -------------------------------------------------------------
// 3. Postseason Fixtures (28 games from playoffs2015.csv)
// -------------------------------------------------------------
const rawPlayoffsContent = fs.readFileSync('data/BUAFL/playoffs2015.csv', 'utf8');
const rawPlayoffs = parse(rawPlayoffsContent, { columns: true, skip_empty_lines: true, trim: true });

for (const p of rawPlayoffs) {
  let phase = p.phase.trim();
  let awayTeam = resolveTeam(p.away_team);
  let homeTeam = resolveTeam(p.home_team);
  let isTitleGame = 'FALSE';
  let finalType = '';
  let titleName = '';
  let playoffRound = p.playoff_round ? p.playoff_round.trim() : '';
  let venue = p.venue ? p.venue.trim() : '';

  // National Championship Final: College Bowl XXX
  if (phase === 'National Championship' && (playoffRound === 'Final' || p.is_title_game?.toUpperCase() === 'TRUE')) {
    isTitleGame = 'TRUE';
    finalType = 'title';
    titleName = 'College Bowl XXX';
    playoffRound = 'Final';
    venue = venue || 'John Charles Centre';
  }
  // National Trophy Final
  else if (phase === 'National Trophy' && (playoffRound === 'Final' || p.is_title_game?.toUpperCase() === 'TRUE')) {
    isTitleGame = 'TRUE';
    finalType = 'bowl';
    titleName = 'National Trophy';
    playoffRound = 'Final';
  }
  // Northern Conference Cup Final
  else if (phase === 'Northern Conference Cup' && (playoffRound === 'Final' || p.is_title_game?.toUpperCase() === 'TRUE')) {
    isTitleGame = 'TRUE';
    finalType = 'bowl';
    titleName = 'Northern Conference Cup';
    playoffRound = 'Final';
  }
  // Southern Conference Cup Final
  else if (phase === 'Southern Conference Cup' && (playoffRound === 'Final' || p.is_title_game?.toUpperCase() === 'TRUE')) {
    isTitleGame = 'TRUE';
    finalType = 'bowl';
    titleName = 'Southern Conference Cup';
    playoffRound = 'Final';
  }

  const parentPhase = parentPhaseMap[phase] || '';

  // Coach check
  const awayCoach = awayTeam === 'Brighton Tsunami' ? 'Chris Denny' : '';
  const homeCoach = homeTeam === 'Brighton Tsunami' ? 'Chris Denny' : '';

  // Postseason notes & tied game handling
  let notes = 'Source: BUCS Championship Playoffs';
  if (awayTeam === 'Derby Braves' && homeTeam === 'Hertfordshire Hurricanes' && p.date === '2016-02-28') {
    notes = 'Source: BUCS Championship Playoffs. Hertfordshire Hurricanes advanced (walkover/concession by Derby Braves).';
  }

  cleanedGames.push({
    competition: 'BUAFL',
    year: '2015',
    phase,
    parent_phase: parentPhase,
    away_phase: '',
    away_parent_phase: '',
    date: p.date.trim(),
    away_team: awayTeam,
    home_team: homeTeam,
    away_score: p.away_score.trim(),
    home_score: p.home_score.trim(),
    venue,
    notes,
    away_coach: awayCoach,
    home_coach: homeCoach,
    is_double_header: 'FALSE',
    date_precision: 'day',
    date_display: p.date ? p.date.split('-').reverse().join('/') : '',
    time: p.time ? p.time.trim() : '13:00',
    status: 'completed',
    confidence_level: 'high',
    is_playoff: 'TRUE',
    is_title_game: isTitleGame,
    final_type: finalType,
    title_name: titleName,
    playoff_round: playoffRound
  });
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
fs.writeFileSync('data/BUAFL/games2015.csv', gamesCsv.join('\n') + '\n', 'utf8');
console.log(`Successfully wrote data/BUAFL/games2015.csv (${cleanedGames.length} games)`);

// -------------------------------------------------------------
// 4. Standings Generation (16 columns across 82 teams in 15 divisions)
// -------------------------------------------------------------
const divisions = [
  'Premier North',
  'Premier South',
  'Division 1 Scottish/Northern',
  'Division 1 Yorkshire',
  'Division 1 Midlands',
  'Division 1 South Western',
  'Division 1 Southern',
  'Division 1 South Eastern',
  'Division 2 Scottish/Northern',
  'Division 2 Northern',
  'Division 2 Midlands',
  'Division 2 South Western',
  'Division 2 Southern',
  'Division 2 South Eastern',
  'Division 2 London'
];

const standingsByDiv = {};
for (const div of divisions) {
  standingsByDiv[div] = {};
}

// Compute records from regular season games only
for (const g of cleanedGames) {
  if (g.is_playoff === 'TRUE') continue;
  const div = g.phase;
  if (!standingsByDiv[div]) continue;

  const away = g.away_team;
  const home = g.home_team;
  const ascore = parseInt(g.away_score, 10);
  const hscore = parseInt(g.home_score, 10);
  if (isNaN(ascore) || isNaN(hscore)) continue;

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

// Confirmed division champions
const verifiedChampions = new Set([
  'Stirling Clansmen',           // Premier North (8-0-0)
  'Birmingham Lions',            // Premier South (8-0-0, College Bowl XXX Champion)
  'Glasgow Tigers',              // Division 1 Scottish/Northern (undefeated)
  'UCLan Rams',                  // Division 1 Yorkshire
  'Nottingham Trent Renegades',  // Division 1 Midlands (National Trophy Finalist)
  'Swansea Titans',              // Division 1 South Western (National Trophy Champion)
  'Surrey Stingers',             // Division 1 Southern (undefeated)
  'Kent Falcons',                // Division 1 South Eastern
  'Edinburgh Napier Knights',    // Division 2 Scottish/Northern
  'Manchester Tyrants',          // Division 2 Northern (6-0-0)
  'Coventry University Jets',    // Division 2 Midlands
  'Plymouth Blitz',              // Division 2 South Western
  'Portsmouth Destroyers',       // Division 2 Southern (Southern Conference Cup Champion)
  'Oxford Lancers',              // Division 2 South Eastern (Southern Conference Cup Finalist)
  'Greenwich Mariners'           // Division 2 London (undefeated)
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

  const parentPhase = parentPhaseMap[div] || '';

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
      year: '2015',
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
fs.writeFileSync('data/BUAFL/standings2015.csv', standingsCsv.join('\n') + '\n', 'utf8');
console.log(`Successfully wrote data/BUAFL/standings2015.csv (${finalStandingsRows.length} teams across 15 divisions)`);
