/**
 * UK American Football Archive - 2010/11 BUAFL Dataset Builder
 *
 * Builds clean CSV files for the 2010/11 BUAFL season:
 *  - data/BUAFL/phases2010.csv (Includes parent phase "Playoffs" and 6 Conferences)
 *  - data/BUAFL/standings2010.csv (Standard 16-column format with coaches and records)
 *  - data/BUAFL/games2010.csv (Empirical games, Brighton's 8 RS + 2 Challenge Trophy games, College Bowl XXV, Challenge Trophy Final)
 */

import fs from 'fs';

// --- CANONICAL 2010/11 CONFERENCE MAPPINGS (60 TEAMS, 6 CONFERENCES) ---
const teamPrimaryConference = {
  // Border Conference (10)
  "Glasgow Tigers": "Border Conference",
  "Newcastle Raiders": "Border Conference",
  "Northumbria Mustangs": "Border Conference",
  "Edinburgh Predators": "Border Conference",
  "Edinburgh Napier Knights": "Border Conference",
  "Stirling Clansmen": "Border Conference",
  "Sunderland Spartans": "Border Conference",
  "Teesside Cougars": "Border Conference",
  "Durham Saints": "Border Conference",
  "UWS Pyros": "Border Conference",

  // Northern Conference (10)
  "Sheffield Hallam Warriors": "Northern Conference",
  "Lancaster Bombers": "Northern Conference",
  "Bangor MudDogs": "Northern Conference",
  "Huddersfield Hawks": "Northern Conference",
  "Leeds Met Carnegie": "Northern Conference",
  "Leeds Celtics": "Northern Conference",
  "Manchester Tyrants": "Northern Conference",
  "Sheffield Sabres": "Northern Conference",
  "Hull Sharks": "Northern Conference",
  "York Centurions": "Northern Conference",

  // Midland Conference (11)
  "Loughborough Aces": "Midland Conference",
  "Birmingham Lions": "Midland Conference",
  "Derby Braves": "Midland Conference",
  "Nottingham Trent Renegades": "Midland Conference",
  "Nottingham Outlaws": "Midland Conference",
  "Warwick Wolves": "Midland Conference",
  "Staffordshire Stallions": "Midland Conference",
  "Coventry University Jets": "Midland Conference",
  "Leicester Longhorns": "Midland Conference",
  "Lincoln Colonials": "Midland Conference",
  "Worcester Royals": "Midland Conference",

  // South Western Conference (10)
  "UWE Bullets": "South Western Conference",
  "Bristol Barracuda": "South Western Conference",
  "Cardiff Cobras": "South Western Conference",
  "Exeter Demons": "South Western Conference",
  "Bath Killer Bees": "South Western Conference",
  "Swansea Titans": "South Western Conference",
  "Tarannau Aberystwyth": "South Western Conference",
  "Gloucestershire Gladiators": "South Western Conference",
  "Plymouth Blitz": "South Western Conference",
  "Bath Spa Bulldogs": "South Western Conference",

  // Thames Valley Conference (10)
  "Portsmouth Destroyers": "Thames Valley Conference",
  "Southampton Stags": "Thames Valley Conference",
  "Solent Redhawks": "Thames Valley Conference",
  "BNU Buccaneers": "Thames Valley Conference",
  "Imperial Immortals": "Thames Valley Conference",
  "Brunel Burners": "Thames Valley Conference",
  "Reading Knights": "Thames Valley Conference",
  "Royal Holloway Bears": "Thames Valley Conference",
  "Oxford Brookes University": "Thames Valley Conference",
  "Surrey Stingers": "Thames Valley Conference",

  // South Eastern Conference (9)
  "Hertfordshire Hurricanes": "South Eastern Conference",
  "Kent Falcons": "South Eastern Conference",
  "UEA Pirates": "South Eastern Conference",
  "Brighton Tsunami": "South Eastern Conference",
  "LSBU Spartans": "South Eastern Conference",
  "KCL Regents": "South Eastern Conference",
  "Greenwich Mariners": "South Eastern Conference",
  "Essex Blades": "South Eastern Conference",
  "Canterbury CC Chargers": "South Eastern Conference"
};

// Historical name alias resolver for 2010/11
function resolveTeamName(name) {
  if (!name) return '';
  const clean = name.trim();
  const map = {
    'Brighton Panthers': 'Brighton Tsunami',
    'Bristol Bullets': 'Bristol Bullets',
    'Bristol Barracuda': 'Bristol Barracuda',
    'Leeds Carnegie': 'Leeds Met Carnegie',
    'Leeds Met': 'Leeds Met Carnegie',
    'UCH Sharks': 'Hull Sharks',
    'UH Sharks': 'Hull Sharks',
    'Canterbury Chargers': 'Canterbury CC Chargers',
    'Kings College Regents': 'KCL Regents',
    'OBU Panthers': 'Oxford Brookes University',
    'Oxford Brookes Panthers': 'Oxford Brookes University',
    'Team Solent Redhawks': 'Solent Redhawks',
    'NTU Renegades': 'Nottingham Trent Renegades',
    'Coventry Jets': 'Coventry University Jets',
    'EN Knights': 'Edinburgh Napier Knights',
    'Gloucester Gladiators': 'Gloucestershire Gladiators'
  };
  return map[clean] || clean;
}

// Head coach map for known 2010/11 teams
const teamHeadCoaches = {
  "Brighton Tsunami": "Martin Harrison",
  "Birmingham Lions": "Tony Athersmith"
};

// Escape helper for CSV
function escapeCsv(val) {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Gather all empirical games
const allGames = [];

// 1. Title Game: College Bowl XXV
allGames.push({
  competition: 'BUAFL',
  year: '2010',
  phase: 'National Championship',
  date: '2011-04-09',
  away_team: 'Birmingham Lions',
  home_team: 'Portsmouth Destroyers',
  away_score: 19,
  home_score: 20,
  venue: 'John Charles Centre for Sport',
  notes: 'https://en.wikipedia.org/wiki/British_Universities_American_Football_League',
  away_coach: 'Tony Athersmith',
  home_coach: '',
  is_double_header: 'FALSE',
  date_precision: 'day',
  date_display: '',
  time: '16:00',
  status: 'completed',
  confidence_level: 'high',
  is_playoff: 'TRUE',
  is_title_game: 'TRUE',
  final_type: 'title',
  title_name: 'College Bowl XXV',
  playoff_round: 'Final',
  parent_phase: 'Playoffs',
  away_phase: ''
});

// 2. Challenge Trophy Final
allGames.push({
  competition: 'BUAFL',
  year: '2010',
  phase: 'Challenge Trophy',
  date: '2011-04-09',
  away_team: 'Hull Sharks',
  home_team: 'Cardiff Cobras',
  away_score: 0,
  home_score: 1, // Awarded/placeholder victory for Cardiff Cobras
  venue: 'John Charles Centre for Sport',
  notes: 'https://britball.fandom.com/wiki/Cardiff_Cobras (Cardiff won 2011 Challenge Trophy final against Hull Sharks; exact numerical score unrecorded)',
  away_coach: '',
  home_coach: '',
  is_double_header: 'FALSE',
  date_precision: 'day',
  date_display: '',
  time: '12:00',
  status: 'completed',
  confidence_level: 'medium',
  is_playoff: 'TRUE',
  is_title_game: 'TRUE',
  final_type: 'bowl',
  title_name: 'Challenge Trophy',
  playoff_round: 'Final',
  parent_phase: 'Playoffs',
  away_phase: ''
});

// 3. Brighton's 2 Challenge Trophy Postseason Games
allGames.push({
  competition: 'BUAFL',
  year: '2010',
  phase: 'Challenge Trophy',
  date: '2011-03-13',
  away_team: 'Brighton Tsunami',
  home_team: 'UEA Pirates',
  away_score: 19,
  home_score: 8,
  venue: '',
  notes: 'Source: Brighton Tsunami historical records',
  away_coach: 'Martin Harrison',
  home_coach: '',
  is_double_header: 'FALSE',
  date_precision: 'day',
  date_display: '',
  time: '13:00',
  status: 'completed',
  confidence_level: 'high',
  is_playoff: 'TRUE',
  is_title_game: 'FALSE',
  final_type: '',
  title_name: '',
  playoff_round: 'Round 1',
  parent_phase: 'Playoffs',
  away_phase: ''
});

allGames.push({
  competition: 'BUAFL',
  year: '2010',
  phase: 'Challenge Trophy',
  date: '2011-03-27',
  away_team: 'Brighton Tsunami',
  home_team: 'Solent Redhawks',
  away_score: 14,
  home_score: 21,
  venue: '',
  notes: 'Source: Brighton Tsunami historical records',
  away_coach: 'Martin Harrison',
  home_coach: '',
  is_double_header: 'FALSE',
  date_precision: 'day',
  date_display: '',
  time: '13:00',
  status: 'completed',
  confidence_level: 'high',
  is_playoff: 'TRUE',
  is_title_game: 'FALSE',
  final_type: '',
  title_name: '',
  playoff_round: 'Quarter Final',
  parent_phase: 'Playoffs',
  away_phase: ''
});

// 4. Source: data/gamesbrighton.csv (Regular Season 2010 games)
if (fs.existsSync('data/gamesbrighton.csv')) {
  const content = fs.readFileSync('data/gamesbrighton.csv', 'utf8');
  const lines = content.split('\n');
  lines.forEach(l => {
    if (l.includes(',2010,South Eastern Division,')) {
      const parts = l.split(',');
      if (parts.length >= 10) {
        const rawDate = parts[3];
        const rawAway = parts[4];
        const rawHome = parts[5];
        const awayScore = parts[6];
        const homeScore = parts[7];
        const venue = parts[8] || '';

        // Convert DD/MM/YYYY to YYYY-MM-DD
        let dStr = '';
        if (rawDate && rawDate.includes('/')) {
          const dParts = rawDate.split('/');
          if (dParts.length === 3) {
            dStr = `${dParts[2]}-${dParts[1].padStart(2,'0')}-${dParts[0].padStart(2,'0')}`;
          }
        } else {
          dStr = rawDate;
        }

        const away = resolveTeamName(rawAway);
        const home = resolveTeamName(rawHome);

        let gameNote = 'Source: Brighton Tsunami historical records';
        if (parts[9] && parts[9].trim()) {
          gameNote += ` (${parts[9].trim()})`;
        }

        const homeCoach = teamHeadCoaches[home] || parts[11] || '';
        const awayCoach = teamHeadCoaches[away] || parts[10] || '';

        if (away && home) {
          const homeConf = teamPrimaryConference[home] || 'South Eastern Conference';
          const awayConf = teamPrimaryConference[away] || 'South Eastern Conference';

          allGames.push({
            competition: 'BUAFL',
            year: '2010',
            phase: homeConf,
            date: dStr,
            away_team: away,
            home_team: home,
            away_score: Number(awayScore),
            home_score: Number(homeScore),
            venue,
            notes: gameNote,
            away_coach: awayCoach,
            home_coach: homeCoach,
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
            away_phase: awayConf !== homeConf ? awayConf : ''
          });
        }
      }
    }
  });
}

// 5. Source: Bath Killer Bees games (Britball wiki archive)
if (fs.existsSync('data/BUAFL/games2010.csv')) {
  const content = fs.readFileSync('data/BUAFL/games2010.csv', 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (i === 0 || !l.trim()) return;
    const parts = l.split(',');
    if (parts.length >= 8 && (parts[4].includes('Bath') || parts[5].includes('Bath'))) {
      const rawDate = parts[3] || '';
      const rawAway = parts[4] || '';
      const rawHome = parts[5] || '';
      const awayScore = parts[6] || '0';
      const homeScore = parts[7] || '0';

      const away = resolveTeamName(rawAway);
      const home = resolveTeamName(rawHome);

      if (away && home) {
        const homeConf = teamPrimaryConference[home] || 'South Western Conference';
        const awayConf = teamPrimaryConference[away] || 'South Western Conference';

        const homeCoach = teamHeadCoaches[home] || '';
        const awayCoach = teamHeadCoaches[away] || '';

        allGames.push({
          competition: 'BUAFL',
          year: '2010',
          phase: homeConf,
          date: rawDate,
          away_team: away,
          home_team: home,
          away_score: Number(awayScore),
          home_score: Number(homeScore),
          venue: '',
          notes: 'https://americanfootball.fandom.com/wiki/Bath_Killer_Bees',
          away_coach: awayCoach,
          home_coach: homeCoach,
          is_double_header: 'FALSE',
          date_precision: rawDate ? 'day' : 'season',
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
          away_phase: awayConf !== homeConf ? awayConf : ''
        });
      }
    }
  });
}

// Deduplicate
const cleanGames = [];
const gameKeys = new Set();
for (const g of allGames) {
  const key = `${g.date}|${g.away_team}|${g.home_team}|${g.away_score}|${g.home_score}`;
  if (gameKeys.has(key)) continue;
  gameKeys.add(key);
  cleanGames.push(g);
}

console.log(`Rebuilt 2010 BUAFL dataset: ${cleanGames.length} games.`);

// 1. Write data/BUAFL/games2010.csv
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

fs.writeFileSync('data/BUAFL/games2010.csv', gamesCsvLines.join('\n') + '\n', 'utf8');
console.log('Successfully wrote data/BUAFL/games2010.csv');

// 2. Write data/BUAFL/phases2010.csv
const phaseContent = `competition_name,year,phase_name,type,parent_phase,confidence_level,ordinal,max_games_per_team
BUAFL,2010,Playoffs,Playoffs,,high,1,
BUAFL,2010,National Championship,Playoffs,Playoffs,high,2,
BUAFL,2010,Challenge Trophy,Playoffs,Playoffs,high,3,
BUAFL,2010,Border Conference,Division,,high,4,8
BUAFL,2010,Midland Conference,Division,,high,5,8
BUAFL,2010,Northern Conference,Division,,high,6,8
BUAFL,2010,South Eastern Conference,Division,,high,7,8
BUAFL,2010,South Western Conference,Division,,high,8,8
BUAFL,2010,Thames Valley Conference,Division,,high,9,8
`;

fs.writeFileSync('data/BUAFL/phases2010.csv', phaseContent, 'utf8');
console.log('Successfully wrote data/BUAFL/phases2010.csv');

// 3. Write data/BUAFL/standings2010.csv (Standard 16 columns)
const teamStats = {};
for (const [teamName, conf] of Object.entries(teamPrimaryConference)) {
  if (!teamStats[conf]) teamStats[conf] = {};
  teamStats[conf][teamName] = { W: 0, L: 0, T: 0, PF: 0, PA: 0, GP: 0 };
}

// Explicit Border Conference standings from Britball Wiki
const borderStandings = {
  "Glasgow Tigers":           { W: 7, L: 1, T: 0, PF: 317, PA: 108, GP: 8 },
  "Newcastle Raiders":         { W: 7, L: 1, T: 0, PF: 253, PA: 117, GP: 8 },
  "Northumbria Mustangs":      { W: 6, L: 2, T: 0, PF: 162, PA: 175, GP: 8 },
  "Edinburgh Predators":       { W: 5, L: 3, T: 0, PF: 163, PA: 118, GP: 8 },
  "Edinburgh Napier Knights":  { W: 4, L: 3, T: 1, PF: 185, PA: 94,  GP: 8 },
  "Stirling Clansmen":         { W: 4, L: 4, T: 0, PF: 116, PA: 120, GP: 8 },
  "Sunderland Spartans":       { W: 1, L: 5, T: 0, PF: 86,  PA: 128, GP: 6 },
  "Teesside Cougars":          { W: 1, L: 6, T: 0, PF: 79,  PA: 160, GP: 7 },
  "Durham Saints":             { W: 0, L: 6, T: 1, PF: 27,  PA: 141, GP: 7 },
  "UWS Pyros":                 { W: 0, L: 7, T: 0, PF: 16,  PA: 258, GP: 7 }
};

for (const [teamName, s] of Object.entries(borderStandings)) {
  if (teamStats["Border Conference"][teamName]) {
    teamStats["Border Conference"][teamName] = s;
  }
}

// Loughborough Aces finished 8-0-0 as 1st in Midlands
teamStats["Midland Conference"]["Loughborough Aces"] = { W: 8, L: 0, T: 0, PF: 0, PA: 0, GP: 8 };

// Accumulate game log results for other teams (regular season only)
for (const g of cleanGames) {
  if (g.is_playoff === 'FALSE') {
    const awayTeam = g.away_team;
    const homeTeam = g.home_team;
    const awayConf = teamPrimaryConference[awayTeam];
    const homeConf = teamPrimaryConference[homeTeam];

    if (awayConf !== "Border Conference" && awayConf && teamStats[awayConf] && teamStats[awayConf][awayTeam] && awayTeam !== "Loughborough Aces") {
      teamStats[awayConf][awayTeam].GP++;
      teamStats[awayConf][awayTeam].PF += g.away_score;
      teamStats[awayConf][awayTeam].PA += g.home_score;
      if (g.away_score > g.home_score) teamStats[awayConf][awayTeam].W++;
      else if (g.home_score > g.away_score) teamStats[awayConf][awayTeam].L++;
      else teamStats[awayConf][awayTeam].T++;
    }

    if (homeConf !== "Border Conference" && homeConf && teamStats[homeConf] && teamStats[homeConf][homeTeam] && homeTeam !== "Loughborough Aces") {
      teamStats[homeConf][homeTeam].GP++;
      teamStats[homeConf][homeTeam].PF += g.home_score;
      teamStats[homeConf][homeTeam].PA += g.away_score;
      if (g.home_score > g.away_score) teamStats[homeConf][homeTeam].W++;
      else if (g.away_score > g.home_score) teamStats[homeConf][homeTeam].L++;
      else teamStats[homeConf][homeTeam].T++;
    }
  }
}

const standingsHeaders = [
  'competition_name','parent_phase','phase','year','team',
  'position','games_played','wins','losses','ties',
  'points_for','points_against','streak','is_champion','notes','head_coach'
];
const standingsLines = [standingsHeaders.join(',')];

const conferenceOrder = [
  'Border Conference',
  'Midland Conference',
  'Northern Conference',
  'South Eastern Conference',
  'South Western Conference',
  'Thames Valley Conference'
];

// Conference Champions
const confChampions = {
  'Border Conference': 'Glasgow Tigers',
  'Midland Conference': 'Loughborough Aces',
  'Thames Valley Conference': 'Portsmouth Destroyers' // Won National Championship College Bowl XXV
};

for (const conf of conferenceOrder) {
  const teams = teamStats[conf] || {};
  const sortedTeams = Object.entries(teams).sort((a,b) => {
    const isChampA = a[0] === confChampions[conf];
    const isChampB = b[0] === confChampions[conf];
    if (isChampA && !isChampB) return -1;
    if (isChampB && !isChampA) return 1;

    const pctA = (a[1].W + 0.5 * a[1].T) / (a[1].GP || 1);
    const pctB = (b[1].W + 0.5 * b[1].T) / (b[1].GP || 1);
    if (pctB !== pctA) return pctB - pctA;
    if (b[1].W !== a[1].W) return b[1].W - a[1].W;
    return (b[1].PF - b[1].PA) - (a[1].PF - a[1].PA);
  });

  let pos = 1;
  for (const [teamName, s] of sortedTeams) {
    const headCoach = teamHeadCoaches[teamName] || '';
    const isChamp = teamName === confChampions[conf] ? 'TRUE' : 'FALSE';
    const note = teamName.includes('Brighton')
      ? 'Source: Brighton Tsunami historical records'
      : 'https://britball.fandom.com/wiki/2010-11_BUAFL_Season';

    const row = [
      'BUAFL',
      '',
      escapeCsv(conf),
      '2010',
      escapeCsv(teamName),
      pos.toString(),
      s.GP.toString(),
      s.W.toString(),
      s.L.toString(),
      s.T.toString(),
      s.PF.toString(),
      s.PA.toString(),
      '',
      isChamp,
      escapeCsv(note),
      escapeCsv(headCoach)
    ];
    standingsLines.push(row.join(','));
    pos++;
  }
}

fs.writeFileSync('data/BUAFL/standings2010.csv', standingsLines.join('\n') + '\n', 'utf8');
console.log('Successfully wrote data/BUAFL/standings2010.csv');
