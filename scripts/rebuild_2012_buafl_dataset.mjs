import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

// Load base team mapping
const bucsTeamsMap = JSON.parse(fs.readFileSync('data/mappings/bucs_teams.json', 'utf8'));

// Custom overrides for 2012 historical team names
const custom2012Map = {
  "University of Brighton Men's 1st": "Brighton Tsunami",
  "Brighton University Men's 1st": "Brighton Tsunami",
  "Brighton Panthers": "Brighton Tsunami",
  "Anglia Ruskin University Men's 1st (Cambridge)": "Anglia Ruskin Rhinos",
  "Anglia Ruskin University Men's 1st": "Anglia Ruskin Rhinos",
  "Teesside University Men's 1st": "Teesside Cougars",
  "University of Derby Men's 1st": "Derby Braves",
  "University of Bristol Men's 1st": "Bristol Bullets",
  "University of Portsmouth  Men's 1st": "Portsmouth Destroyers",
  "University of Portsmouth Men's 1st": "Portsmouth Destroyers",
  "Leeds Metropolitan University Men's 1st": "Leeds Met Carnegie",
  "Leeds Beckett University (Carnegie) Men's 1st": "Leeds Met Carnegie",
  "Loughborough University Men's 1st": "Loughborough Aces",
  "University of Huddersfield Men's 1st": "Huddersfield Hawks"
};

function resolveTeam(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (custom2012Map[trimmed]) return custom2012Map[trimmed];
  if (bucsTeamsMap[trimmed]) return bucsTeamsMap[trimmed];
  const cleanRaw = trimmed.replace(/\s+Men's 1st.*$/i, '').trim();
  return bucsTeamsMap[cleanRaw + " Men's 1st"] || bucsTeamsMap[cleanRaw + " Mixed 1st"] || trimmed;
}

// Explicit Primary Conference per Team for 2012 BUAFL Season (Each team belongs to EXACTLY 1 Conference)
const teamPrimaryConference = {
  // Saltire Conference
  "Stirling Clansmen": "Saltire Conference",
  "Glasgow Tigers": "Saltire Conference",
  "Edinburgh Predators": "Saltire Conference",
  "UWS Pyros": "Saltire Conference",
  "Edinburgh Napier Knights": "Saltire Conference",

  // Big North Western Conference
  "Derby Braves": "Big North Western Conference",
  "Sheffield Sabres": "Big North Western Conference",
  "Manchester Tyrants": "Big North Western Conference",
  "Sheffield Hallam Warriors": "Big North Western Conference",
  "LJMU Fury": "Big North Western Conference",
  "Lancaster Bombers": "Big North Western Conference",
  "UCLan Rams": "Big North Western Conference",
  "Staffordshire Stallions": "Big North Western Conference",
  "Huddersfield Hawks": "Big North Western Conference",
  "Bangor MudDogs": "Big North Western Conference",
  "MMU Eagles": "Big North Western Conference",
  "Keele Crusaders": "Big North Western Conference",

  // North Eastern Conference
  "Leeds Met Carnegie": "North Eastern Conference",
  "Hull Sharks": "North Eastern Conference",
  "Newcastle Raiders": "North Eastern Conference",
  "Durham Saints": "North Eastern Conference",
  "Leeds Gryphons": "North Eastern Conference",
  "Sunderland Spartans": "North Eastern Conference",
  "Northumbria Mustangs": "North Eastern Conference",
  "Bradford Bears": "North Eastern Conference",
  "Teesside Cougars": "North Eastern Conference",
  "York Centurions": "North Eastern Conference",

  // Midlands Athletics Conference
  "Birmingham Lions": "Midlands Athletics Conference",
  "Loughborough Aces": "Midlands Athletics Conference",
  "Warwick Wolves": "Midlands Athletics Conference",
  "Nottingham Trent Renegades": "Midlands Athletics Conference",
  "Coventry University Jets": "Midlands Athletics Conference",
  "Lincoln Colonials": "Midlands Athletics Conference",
  "Nottingham Gold": "Midlands Athletics Conference",
  "DMU Lions": "Midlands Athletics Conference",
  "Northampton Nemesis": "Midlands Athletics Conference",
  "Leicester Longhorns": "Midlands Athletics Conference",
  "Wolverhampton Wildcats": "Midlands Athletics Conference",

  // South Western Athletics Conference
  "Bath Killer Bees": "South Western Athletics Conference",
  "UWE Bullets": "South Western Athletics Conference",
  "Gloucestershire Gladiators": "South Western Athletics Conference",
  "Swansea Titans": "South Western Athletics Conference",
  "Tarannau Aberystwyth": "South Western Athletics Conference",
  "Exeter Demons": "South Western Athletics Conference",
  "Cardiff Cobras": "South Western Athletics Conference",
  "Plymouth Blitz": "South Western Athletics Conference",
  "Bristol Bullets": "South Western Athletics Conference",
  "Worcester Royals": "South Western Athletics Conference",
  "Bath Spa Bulldogs": "South Western Athletics Conference",

  // South Central Conference
  "Hertfordshire Hurricanes": "South Central Conference",
  "Cambridge Pythons": "South Central Conference",
  "Kent Falcons": "South Central Conference",
  "UEA Pirates": "South Central Conference",
  "Essex Blades": "South Central Conference",
  "Canterbury CC Chargers": "South Central Conference",
  "Anglia Ruskin Rhinos": "South Central Conference",

  // Oyster Card Conference
  "Brighton Tsunami": "Oyster Card Conference",
  "Portsmouth Destroyers": "Oyster Card Conference",
  "Southampton Stags": "Oyster Card Conference",
  "Kingston Cougars": "Oyster Card Conference",
  "BNU Buccaneers": "Oyster Card Conference",
  "Brunel Burners": "Oyster Card Conference",
  "Reading Knights": "Oyster Card Conference",
  "Oxford Brookes University": "Oyster Card Conference",
  "Surrey Stingers": "Oyster Card Conference",
  "Solent Redhawks": "Oyster Card Conference",
  "Sussex Saxons": "Oyster Card Conference",
  "Royal Holloway Bears": "Oyster Card Conference",
  "Oxford Lancers": "Oyster Card Conference",
  "Imperial Immortals": "Oyster Card Conference",
  "Greenwich Mariners": "Oyster Card Conference",
  "KCL Regents": "Oyster Card Conference",
  "LSBU Spartans": "Oyster Card Conference",
  "Westminster Dragons": "Oyster Card Conference",
  "City Wolfpack": "Oyster Card Conference"
};

const excelPath = 'data/BUCS_2012_13_Results.xlsx';
const wb = XLSX.readFile(excelPath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

const afRows = rows.filter(r => String(r[1] || '').toLowerCase().includes('american football'));
console.log(`Processing ${afRows.length} American Football rows from BUCS Excel...`);

const rawGames = [];

for (let i = 0; i < afRows.length; i++) {
  const r = afRows[i];
  const rawStage = String(r[3] || '').trim();
  const rawDate = r[4];
  const rawAway = String(r[6] || '').trim();
  const score1Val = r[7];
  const score2Val = r[8];
  const rawHome = String(r[9] || '').trim();
  const rawNotes = String(r[11] || '').trim();

  if (!rawAway && !rawHome) continue;

  let dStr = '';
  if (typeof rawDate === 'number') {
    const d = XLSX.SSF.parse_date_code(rawDate);
    if (d) dStr = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  } else if (rawDate) {
    dStr = String(rawDate);
  }

  const away = resolveTeam(rawAway);
  const home = resolveTeam(rawHome);

  const isPlayoff = rawStage.toLowerCase().includes('championship') || rawStage.toLowerCase().includes('trophy');
  let playoffRound = '';
  let phase = '';

  if (isPlayoff) {
    phase = rawStage.toLowerCase().includes('championship') ? 'National Championship' : 'National Trophy';
    if (dStr === '2013-04-20') playoffRound = 'final';
    else if (dStr === '2013-03-17') playoffRound = 'semi_final';
    else if (dStr === '2013-03-03') playoffRound = 'quarter_final';
  } else {
    // For regular season games, phase is Home Team's primary conference
    phase = teamPrimaryConference[home] || teamPrimaryConference[away] || 'Oyster Card Conference';
  }

  const awayPhase = isPlayoff ? '' : (teamPrimaryConference[away] || phase);

  let status = 'completed';
  let awayScore = (score1Val !== undefined && score1Val !== null && score1Val !== '') ? Number(score1Val) : 0;
  let homeScore = (score2Val !== undefined && score2Val !== null && score2Val !== '') ? Number(score2Val) : 0;
  let isVoid = false;

  if (score1Val === undefined || score1Val === null || score1Val === '' || score2Val === undefined || score2Val === null || score2Val === '') {
    status = 'awarded';
    if (rawNotes.toLowerCase().includes('void')) isVoid = true;
  } else if (rawNotes.toLowerCase().includes('void') && awayScore === 0 && homeScore === 0) {
    isVoid = true;
    status = 'awarded';
  }

  let notes = rawNotes ? `BUCS record: ${rawNotes}` : '';

  if (isPlayoff && rawStage === 'Trophy' && (away === 'BNU Buccaneers' || home === 'BNU Buccaneers') && dStr === '2013-03-03') {
    notes = 'BUCS data suggests BNU won the quarter final but the 4 teams in the semi final does not match this. Data unreliable';
  }

  const isTitleGame = (isPlayoff && playoffRound === 'final') ? 'TRUE' : 'FALSE';
  const titleName = isTitleGame === 'TRUE' ? (phase === 'National Championship' ? 'BUCS National Championship' : 'BUCS National Trophy') : '';

  rawGames.push({
    competition: 'BUAFL',
    year: '2012',
    phase,
    date: dStr,
    away_team: away,
    home_team: home,
    away_score: awayScore,
    home_score: homeScore,
    venue: '',
    notes,
    away_coach: '',
    home_coach: '',
    is_double_header: 'FALSE',
    date_precision: 'day',
    date_display: '',
    time: '13:00',
    status,
    confidence_level: 'high',
    is_playoff: isPlayoff ? 'TRUE' : 'FALSE',
    is_title_game: isTitleGame,
    final_type: '',
    title_name: titleName,
    playoff_round: playoffRound,
    parent_phase: '',
    away_phase: awayPhase !== phase ? awayPhase : '',
    isVoid
  });
}

// Load 8 Brighton games from data/gamesbrighton.csv
const brightonRaw = fs.readFileSync('data/gamesbrighton.csv', 'utf8').trim().split('\n');
const brightonGames = [];

for (let i = 1; i < brightonRaw.length; i++) {
  const line = brightonRaw[i];
  const parts = line.split(',');
  if (parts[1]?.trim() === '2012') {
    const rawDate = parts[3]?.trim();
    let dStr = rawDate;
    if (rawDate && rawDate.includes('/')) {
      const [d, m, y] = rawDate.split('/');
      dStr = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    const home = resolveTeam(parts[5]?.trim());
    const away = resolveTeam(parts[4]?.trim());
    brightonGames.push({
      competition: 'BUAFL',
      year: '2012',
      phase: 'Oyster Card Conference',
      date: dStr,
      away_team: away,
      home_team: home,
      away_score: Number(parts[6]),
      home_score: Number(parts[7]),
      venue: parts[8]?.trim() || '',
      notes: parts[9]?.trim() || 'Source: gamesbrighton.csv',
      away_coach: parts[10]?.trim() || '',
      home_coach: parts[11]?.trim() || '',
      is_double_header: 'FALSE',
      date_precision: 'day',
      date_display: '',
      time: '13:00',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: '',
      playoff_round: '',
      parent_phase: '',
      away_phase: '',
      isVoid: false
    });
  }
}

// Filter out raw BUCS Brighton games and use clean brightonGames
const filteredGames = rawGames.filter(g => g.away_team !== 'Brighton Tsunami' && g.home_team !== 'Brighton Tsunami');
filteredGames.push(...brightonGames);

// Sort games: Real dates first, placeholder dates ('2013-08-12', '2013-03-11') last
filteredGames.sort((a,b) => {
  const isPlaceholderA = a.date === '2013-08-12' || a.date === '2013-03-11';
  const isPlaceholderB = b.date === '2013-08-12' || b.date === '2013-03-11';
  if (isPlaceholderA !== isPlaceholderB) return isPlaceholderA ? 1 : -1;
  return a.date.localeCompare(b.date);
});

// Deduplicate and enforce max 8 regular season games per team limit
const teamRegGameCount = {};
const matchPairCount = {};
const cleanGames = [];

for (const g of filteredGames) {
  if (g.is_playoff === 'TRUE') {
    cleanGames.push(g);
    continue;
  }

  // Skip 0-0 void games from active standings & game counts
  if (g.isVoid || g.notes.toLowerCase().includes('void')) {
    cleanGames.push(g);
    continue;
  }

  const pairKey = [g.home_team, g.away_team].sort().join(' vs ');
  if (!matchPairCount[pairKey]) matchPairCount[pairKey] = [];

  const isDuplicateDate = matchPairCount[pairKey].some(existing => existing.date === g.date);
  const isOverTwoGames = matchPairCount[pairKey].length >= 2;

  const countHome = teamRegGameCount[g.home_team] || 0;
  const countAway = teamRegGameCount[g.away_team] || 0;

  if (isDuplicateDate || isOverTwoGames || countHome >= 8 || countAway >= 8) {
    console.log(`Filtering out excess game: ${g.date} | ${g.away_team} @ ${g.home_team} (${g.away_score}-${g.home_score})`);
    continue;
  }

  matchPairCount[pairKey].push(g);
  teamRegGameCount[g.home_team] = countHome + 1;
  teamRegGameCount[g.away_team] = countAway + 1;
  cleanGames.push(g);
}

console.log(`Cleaned total games in dataset: ${cleanGames.length}`);

// Escape helper for CSV
function escapeCsv(val) {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// 1. Write games2012.csv
const gameHeaders = [
  'competition','year','phase','date','away_team','home_team',
  'away_score','home_score','venue','notes','away_coach','home_coach',
  'is_double_header','date_precision','date_display','time','status',
  'confidence_level','is_playoff','is_title_game','final_type',
  'title_name','playoff_round','parent_phase','away_phase'
];

const gamesCsvLines = [gameHeaders.join(',')];
for (const g of cleanGames) {
  const line = gameHeaders.map(h => escapeCsv(g[h])).join(',');
  gamesCsvLines.push(line);
}

fs.writeFileSync('data/BUAFL/games2012.csv', gamesCsvLines.join('\n') + '\n', 'utf8');
fs.writeFileSync('games2012.csv', gamesCsvLines.join('\n') + '\n', 'utf8');
console.log('Successfully wrote data/BUAFL/games2012.csv and games2012.csv');

// 2. Write phases2012.csv (Playoffs first, regular season in alphabetical order)
const phaseContent = `competition_name,year,phase_name,type,parent_phase,confidence_level,ordinal,max_games_per_team
BUAFL,2012,National Championship,Playoffs,,high,1,
BUAFL,2012,National Trophy,Playoffs,,high,2,
BUAFL,2012,Big North Western Conference,Division,,high,3,8
BUAFL,2012,Midlands Athletics Conference,Division,,high,4,8
BUAFL,2012,North Eastern Conference,Division,,high,5,8
BUAFL,2012,Oyster Card Conference,Division,,high,6,8
BUAFL,2012,Saltire Conference,Division,,high,7,8
BUAFL,2012,South Central Conference,Division,,high,8,8
BUAFL,2012,South Western Athletics Conference,Division,,high,9,8
`;

fs.writeFileSync('data/BUAFL/phases2012.csv', phaseContent, 'utf8');
console.log('Successfully wrote data/BUAFL/phases2012.csv');

// 3. Write standings2012.csv (Every team enrolled in EXACTLY 1 primary conference)
const teamStats = {};

for (const g of cleanGames) {
  if (g.is_playoff === 'FALSE' && !g.isVoid && !g.notes.toLowerCase().includes('void')) {
    const awayTeam = g.away_team;
    const homeTeam = g.home_team;
    const awayConf = teamPrimaryConference[awayTeam];
    const homeConf = teamPrimaryConference[homeTeam];
    const awayScore = Number(g.away_score);
    const homeScore = Number(g.home_score);

    // Credit each team under their OWN primary conference
    if (!teamStats[awayConf]) teamStats[awayConf] = {};
    if (!teamStats[homeConf]) teamStats[homeConf] = {};

    if (!teamStats[awayConf][awayTeam]) teamStats[awayConf][awayTeam] = { W: 0, L: 0, T: 0, PF: 0, PA: 0, GP: 0 };
    if (!teamStats[homeConf][homeTeam]) teamStats[homeConf][homeTeam] = { W: 0, L: 0, T: 0, PF: 0, PA: 0, GP: 0 };

    teamStats[awayConf][awayTeam].GP++;
    teamStats[homeConf][homeTeam].GP++;
    teamStats[awayConf][awayTeam].PF += awayScore;
    teamStats[awayConf][awayTeam].PA += homeScore;
    teamStats[homeConf][homeTeam].PF += homeScore;
    teamStats[homeConf][homeTeam].PA += awayScore;

    if (awayScore > homeScore) {
      teamStats[awayConf][awayTeam].W++;
      teamStats[homeConf][homeTeam].L++;
    } else if (homeScore > awayScore) {
      teamStats[homeConf][homeTeam].W++;
      teamStats[awayConf][awayTeam].L++;
    } else {
      teamStats[awayConf][awayTeam].T++;
      teamStats[homeConf][homeTeam].T++;
    }
  }
}

const standingsHeaders = ['competition_name','parent_phase','phase','year','team','wins','losses','ties','points_for','points_against'];
const standingsLines = [standingsHeaders.join(',')];

const conferenceOrder = [
  'Saltire Conference',
  'Big North Western Conference',
  'North Eastern Conference',
  'Midlands Athletics Conference',
  'South Western Athletics Conference',
  'South Central Conference',
  'Oyster Card Conference'
];

for (const conf of conferenceOrder) {
  const teams = teamStats[conf] || {};
  const sortedTeams = Object.entries(teams).sort((a,b) => {
    const pctA = (a[1].W + 0.5 * a[1].T) / (a[1].GP || 1);
    const pctB = (b[1].W + 0.5 * b[1].T) / (b[1].GP || 1);
    if (pctB !== pctA) return pctB - pctA;
    const diffA = a[1].PF - a[1].PA;
    const diffB = b[1].PF - b[1].PA;
    return diffB - diffA;
  });

  for (const [teamName, s] of sortedTeams) {
    const row = [
      'BUAFL',
      '',
      escapeCsv(conf),
      '2012',
      escapeCsv(teamName),
      s.W,
      s.L,
      s.T,
      s.PF,
      s.PA
    ];
    standingsLines.push(row.join(','));
  }
}

fs.writeFileSync('data/BUAFL/standings2012.csv', standingsLines.join('\n') + '\n', 'utf8');
console.log('Successfully wrote data/BUAFL/standings2012.csv');
