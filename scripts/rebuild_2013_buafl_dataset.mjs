import fs from 'fs';
import { parse } from 'csv-parse/sync';

// Canonical alias map for 2013 season
const ALIAS_MAP = {
  'Anglia Ruskin Rhinos': 'Anglia Ruskin Siege',
  'Brighton Panthers': 'Brighton Tsunami',
  'Bangor Llewod': 'Bangor MudDogs',
  'Bangor Muddogs': 'Bangor MudDogs',
  'DMU Falcons': 'DMU Lions',
  'Edinburgh Mavericks': 'Edinburgh Predators',
  'Leeds Celtics': 'Leeds Gryphons',
  'Leeds Met Carnegie': 'Leeds Met Carnegie',
  'Leeds Beckett Carnegie': 'Leeds Met Carnegie',
  'Leeds Carnegie': 'Leeds Met Carnegie',
  'London City Sentinels': 'City Wolfpack',
  'Loughborough Students': 'Loughborough Aces',
  'Nottingham Outlaws': 'Nottingham Gold',
  'OBU Panthers': 'Oxford Brookes University'
};

function resolveTeam(t) {
  if (!t) return '';
  const trimmed = t.trim();
  return ALIAS_MAP[trimmed] || trimmed;
}

// 1. Phases
const phaseHeaders = ['competition_name', 'year', 'phase_name', 'parent_phase', 'type', 'ordinal'];
const phases = [
  { competition_name: 'BUAFL', year: '2013', phase_name: 'Playoffs', parent_phase: '', type: 'Playoffs', ordinal: '1' },
  { competition_name: 'BUAFL', year: '2013', phase_name: 'Championship Playoffs', parent_phase: 'Playoffs', type: 'Playoffs', ordinal: '2' },
  { competition_name: 'BUAFL', year: '2013', phase_name: 'Trophy Playoffs', parent_phase: 'Playoffs', type: 'Playoffs', ordinal: '3' },
  { competition_name: 'BUAFL', year: '2013', phase_name: 'Big North Western Conference', parent_phase: '', type: 'Division', ordinal: '4' },
  { competition_name: 'BUAFL', year: '2013', phase_name: 'Midlands Athletics Conference', parent_phase: '', type: 'Division', ordinal: '5' },
  { competition_name: 'BUAFL', year: '2013', phase_name: 'North Eastern Conference', parent_phase: '', type: 'Division', ordinal: '6' },
  { competition_name: 'BUAFL', year: '2013', phase_name: 'Oyster Card Conference', parent_phase: '', type: 'Division', ordinal: '7' },
  { competition_name: 'BUAFL', year: '2013', phase_name: 'Saltire Conference', parent_phase: '', type: 'Division', ordinal: '8' },
  { competition_name: 'BUAFL', year: '2013', phase_name: 'South Central Conference', parent_phase: '', type: 'Division', ordinal: '9' },
  { competition_name: 'BUAFL', year: '2013', phase_name: 'South Coast Conference', parent_phase: '', type: 'Division', ordinal: '10' },
  { competition_name: 'BUAFL', year: '2013', phase_name: 'South Western Athletics Conference', parent_phase: '', type: 'Division', ordinal: '11' }
];

function escapeCsv(val) {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const phasesCsv = [phaseHeaders.join(',')];
for (const p of phases) {
  phasesCsv.push(phaseHeaders.map(h => escapeCsv(p[h])).join(','));
}
fs.writeFileSync('data/BUAFL/phases2013.csv', phasesCsv.join('\n') + '\n', 'utf8');
fs.writeFileSync('data/2013phases.csv', phasesCsv.join('\n') + '\n', 'utf8');
console.log('Successfully wrote data/BUAFL/phases2013.csv (11 phases)');

// 2. Primary Conference per Team (75 teams)
const teamPrimaryConference = {
  // Saltire Conference (5)
  'Stirling Clansmen': 'Saltire Conference',
  'Glasgow Tigers': 'Saltire Conference',
  'Edinburgh Predators': 'Saltire Conference',
  'Edinburgh Napier Knights': 'Saltire Conference',
  'UWS Pyros': 'Saltire Conference',

  // Big North Western Conference (11)
  'Derby Braves': 'Big North Western Conference',
  'Sheffield Hallam Warriors': 'Big North Western Conference',
  'Sheffield Sabres': 'Big North Western Conference',
  'LJMU Fury': 'Big North Western Conference',
  'UCLan Rams': 'Big North Western Conference',
  'Lancaster Bombers': 'Big North Western Conference',
  'Bangor MudDogs': 'Big North Western Conference',
  'MMU Eagles': 'Big North Western Conference',
  'Staffordshire Stallions': 'Big North Western Conference',
  'Manchester Tyrants': 'Big North Western Conference',
  'Keele Crusaders': 'Big North Western Conference',

  // North Eastern Conference (11)
  'Durham Saints': 'North Eastern Conference',
  'Sunderland Spartans': 'North Eastern Conference',
  'Hull Sharks': 'North Eastern Conference',
  'Leeds Met Carnegie': 'North Eastern Conference',
  'Newcastle Raiders': 'North Eastern Conference',
  'York Centurions': 'North Eastern Conference',
  'Northumbria Mustangs': 'North Eastern Conference',
  'Huddersfield Hawks': 'North Eastern Conference',
  'Leeds Gryphons': 'North Eastern Conference',
  'Bradford Bears': 'North Eastern Conference',
  'Teesside Cougars': 'North Eastern Conference',

  // Midlands Athletics Conference (11)
  'Birmingham Lions': 'Midlands Athletics Conference',
  'Loughborough Aces': 'Midlands Athletics Conference',
  'Nottingham Trent Renegades': 'Midlands Athletics Conference',
  'Warwick Wolves': 'Midlands Athletics Conference',
  'Nottingham Gold': 'Midlands Athletics Conference',
  'Coventry University Jets': 'Midlands Athletics Conference',
  'DMU Lions': 'Midlands Athletics Conference',
  'Worcester Royals': 'Midlands Athletics Conference',
  'Lincoln Colonials': 'Midlands Athletics Conference',
  'Wolverhampton Wildcats': 'Midlands Athletics Conference',
  'Leicester Longhorns': 'Midlands Athletics Conference',

  // South Western Athletics Conference (10)
  'Bath Killer Bees': 'South Western Athletics Conference',
  'Swansea Titans': 'South Western Athletics Conference',
  'UWE Bullets': 'South Western Athletics Conference',
  'Exeter Demons': 'South Western Athletics Conference',
  'Gloucestershire Gladiators': 'South Western Athletics Conference',
  'Cardiff Cobras': 'South Western Athletics Conference',
  'Bristol Barracuda': 'South Western Athletics Conference',
  'Tarannau Aberystwyth': 'South Western Athletics Conference',
  'Plymouth Blitz': 'South Western Athletics Conference',
  'Bath Spa Bulldogs': 'South Western Athletics Conference',

  // Oyster Card Conference (9)
  'Imperial Immortals': 'Oyster Card Conference',
  'Kingston Cougars': 'Oyster Card Conference',
  'Royal Holloway Bears': 'Oyster Card Conference',
  'Brunel Burners': 'Oyster Card Conference',
  'KCL Regents': 'Oyster Card Conference',
  'Greenwich Mariners': 'Oyster Card Conference',
  'Westminster Dragons': 'Oyster Card Conference',
  'LSBU Spartans': 'Oyster Card Conference',
  'City Wolfpack': 'Oyster Card Conference',

  // South Coast Conference (9)
  'Brighton Tsunami': 'South Coast Conference',
  'Southampton Stags': 'South Coast Conference',
  'Portsmouth Destroyers': 'South Coast Conference',
  'Surrey Stingers': 'South Coast Conference',
  'Oxford Brookes University': 'South Coast Conference',
  'Solent Redhawks': 'South Coast Conference',
  'Reading Knights': 'South Coast Conference',
  'Sussex Saxons': 'South Coast Conference',
  'Oxford Lancers': 'South Coast Conference',

  // South Central Conference (9)
  'Hertfordshire Hurricanes': 'South Central Conference',
  'Cambridge Pythons': 'South Central Conference',
  'Northampton Nemesis': 'South Central Conference',
  'Kent Falcons': 'South Central Conference',
  'Canterbury CC Chargers': 'South Central Conference',
  'BNU Buccaneers': 'South Central Conference',
  'UEA Pirates': 'South Central Conference',
  'Anglia Ruskin Siege': 'South Central Conference',
  'Essex Blades': 'South Central Conference'
};

// 3. Rebuild Standings
const rawStandingsCsv = fs.readFileSync('data/BUAFL/standings2013.csv', 'utf8');
const rawStandings = parse(rawStandingsCsv, { columns: true, skip_empty_lines: true });

const champions = new Set([
  'Stirling Clansmen',
  'Sheffield Sabres',
  'Durham Saints',
  'Birmingham Lions',
  'Bath Killer Bees',
  'Imperial Immortals',
  'Brighton Tsunami',
  'Hertfordshire Hurricanes'
]);

// Group by conference and assign position
const standingsByConf = {};
for (const s of rawStandings) {
  const conf = s.phase;
  const team = resolveTeam(s.team);
  if (!standingsByConf[conf]) standingsByConf[conf] = [];

  const w = parseInt(s.wins);
  const l = parseInt(s.losses);
  const t = parseInt(s.ties);
  const pf = parseInt(s.points_for);
  const pa = parseInt(s.points_against);
  const gp = w + l + t;

  standingsByConf[conf].push({
    competition_name: 'BUAFL',
    parent_phase: '',
    phase: conf,
    year: '2013',
    team,
    games_played: gp.toString(),
    wins: w.toString(),
    losses: l.toString(),
    ties: t.toString(),
    points_for: pf.toString(),
    points_against: pa.toString(),
    streak: '',
    is_champion: champions.has(team) ? 'TRUE' : 'FALSE',
    notes: team === 'Brighton Tsunami'
      ? 'Source: Brighton Tsunami historical records'
      : 'Source: BAFRA Newsflashes & BUAFL contemporary archives',
    head_coach: team === 'Brighton Tsunami' ? 'Chris Denny' : ''
  });
}

const standingsHeaders = [
  'competition_name', 'parent_phase', 'phase', 'year', 'team',
  'position', 'games_played', 'wins', 'losses', 'ties', 'points_for',
  'points_against', 'streak', 'is_champion', 'notes', 'head_coach'
];

const confOrder = [
  'Saltire Conference',
  'Big North Western Conference',
  'North Eastern Conference',
  'Midlands Athletics Conference',
  'South Western Athletics Conference',
  'Oyster Card Conference',
  'South Coast Conference',
  'South Central Conference'
];

const finalStandingsRows = [];
for (const conf of confOrder) {
  const rows = standingsByConf[conf] || [];
  // Sort by win pct, diff, pf
  rows.sort((a,b) => {
    // Keep Sheffield Sabres #1 for BNWC if champion
    if (conf === 'Big North Western Conference') {
      if (a.team === 'Sheffield Sabres') return -1;
      if (b.team === 'Sheffield Sabres') return 1;
    }
    const pctA = (parseInt(a.wins) + 0.5 * parseInt(a.ties)) / (parseInt(a.games_played) || 1);
    const pctB = (parseInt(b.wins) + 0.5 * parseInt(b.ties)) / (parseInt(b.games_played) || 1);
    if (pctB !== pctA) return pctB - pctA;
    const diffA = parseInt(a.points_for) - parseInt(a.points_against);
    const diffB = parseInt(b.points_for) - parseInt(b.points_against);
    if (diffB !== diffA) return diffB - diffA;
    return a.team.localeCompare(b.team);
  });

  rows.forEach((r, idx) => {
    r.position = (idx + 1).toString();
    finalStandingsRows.push(r);
  });
}

const standingsCsv = [standingsHeaders.join(',')];
for (const r of finalStandingsRows) {
  standingsCsv.push(standingsHeaders.map(h => escapeCsv(r[h])).join(','));
}
fs.writeFileSync('data/BUAFL/standings2013.csv', standingsCsv.join('\n') + '\n', 'utf8');
console.log(`Successfully wrote data/BUAFL/standings2013.csv (${finalStandingsRows.length} teams)`);

// 4. Rebuild Games
const rawGamesCsv = fs.readFileSync('data/BUAFL/games2013.csv', 'utf8');
const rawGames = parse(rawGamesCsv, { columns: true, skip_empty_lines: true });

const gameHeaders = [
  'competition', 'year', 'phase', 'date', 'away_team', 'home_team',
  'away_score', 'home_score', 'venue', 'notes', 'away_coach', 'home_coach',
  'is_double_header', 'date_precision', 'date_display', 'time', 'status',
  'confidence_level', 'is_playoff', 'is_title_game', 'final_type',
  'title_name', 'playoff_round', 'parent_phase', 'away_phase', 'away_parent_phase'
];

const cleanedGames = [];

for (const g of rawGames) {
  const awayTeam = resolveTeam(g.away_team);
  const homeTeam = resolveTeam(g.home_team);
  const isPlayoff = g.is_playoff === 'TRUE';

  let phase = g.phase;
  let parentPhase = '';
  let awayPhase = '';
  let awayParentPhase = '';
  let finalType = g.final_type || '';
  let titleName = g.title_name || '';
  let isTitleGame = g.is_title_game || 'FALSE';
  let playoffRound = g.playoff_round || '';
  let venue = g.venue || '';

  if (isPlayoff) {
    parentPhase = 'Playoffs';
    awayPhase = '';
    awayParentPhase = '';

    // Standardize postseason final games
    if (g.date === '2014-03-29') {
      if (phase === 'Championship Playoffs' || awayTeam === 'Birmingham Lions' || homeTeam === 'Stirling Clansmen') {
        isTitleGame = 'TRUE';
        finalType = 'title';
        titleName = 'College Bowl XXVIII';
        playoffRound = 'Final';
        venue = 'John Charles Centre, Leeds';
      } else if (phase === 'Trophy Playoffs' || awayTeam === 'Royal Holloway Bears' || homeTeam === 'Swansea Titans') {
        isTitleGame = 'TRUE';
        finalType = 'bowl';
        titleName = 'Challenge Trophy';
        playoffRound = 'Final';
      }
    } else if (g.date === '2014-03-09' && homeTeam === 'Brighton Tsunami') {
      // Last-16 wild card game
      playoffRound = 'Wild Card';
      phase = 'Championship Playoffs';
      venue = venue || 'Falmer Campus';
    }
  } else {
    // Regular season game
    parentPhase = '';
    const homeConf = teamPrimaryConference[homeTeam];
    const awayConf = teamPrimaryConference[awayTeam];

    if (homeConf) {
      phase = homeConf;
    }
    if (awayConf && awayConf !== phase) {
      awayPhase = awayConf;
      awayParentPhase = '';
    } else {
      awayPhase = '';
      awayParentPhase = '';
    }

    if (homeTeam === 'Brighton Tsunami' && !venue) {
      venue = 'Falmer Campus';
    }
  }

  // Sanitize notes
  let notes = g.notes || '';
  if (notes.includes('.htm')) {
    const match = notes.match(/201[34]\d{2}/);
    if (match) {
      const issueNum = match[0].substring(0,4) + '-' + match[0].substring(4);
      notes = `Source: BAFRA Newsflash Issue ${issueNum}`;
    } else {
      notes = 'Source: BAFRA Newsflashes';
    }
  }
  if (notes.toLowerCase().includes('brighton tsunami historical archive') || awayTeam === 'Brighton Tsunami' || homeTeam === 'Brighton Tsunami') {
    if (notes.toLowerCase().includes('brighton')) {
      notes = 'Source: Brighton Tsunami historical records';
    }
  }

  // Coaches - ONLY Chris Denny for Brighton Tsunami (all other teams empty)
  const awayCoach = awayTeam === 'Brighton Tsunami' ? 'Chris Denny' : '';
  const homeCoach = homeTeam === 'Brighton Tsunami' ? 'Chris Denny' : '';

  cleanedGames.push({
    competition: 'BUAFL',
    year: '2013',
    phase,
    date: g.date,
    away_team: awayTeam,
    home_team: homeTeam,
    away_score: g.away_score,
    home_score: g.home_score,
    venue,
    notes,
    away_coach: awayCoach,
    home_coach: homeCoach,
    is_double_header: g.is_double_header || 'FALSE',
    date_precision: g.date_precision || 'day',
    date_display: g.date_display || (g.date ? g.date.split('-').reverse().join('/') : ''),
    time: g.time || '13:00',
    status: g.status || 'completed',
    confidence_level: g.confidence_level || 'high',
    is_playoff: isPlayoff ? 'TRUE' : 'FALSE',
    is_title_game: isTitleGame,
    final_type: finalType,
    title_name: titleName,
    playoff_round: playoffRound,
    parent_phase: parentPhase,
    away_phase: awayPhase,
    away_parent_phase: awayParentPhase
  });
}

const gamesCsv = [gameHeaders.join(',')];
for (const g of cleanedGames) {
  gamesCsv.push(gameHeaders.map(h => escapeCsv(g[h])).join(','));
}
fs.writeFileSync('data/BUAFL/games2013.csv', gamesCsv.join('\n') + '\n', 'utf8');
console.log(`Successfully wrote data/BUAFL/games2013.csv (${cleanedGames.length} games)`);
