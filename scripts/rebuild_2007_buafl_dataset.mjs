/**
 * UK American Football Archive - 2007/08 BUAFL Dataset Builder
 *
 * Builds clean CSV files for the 2007/08 BUAFL season:
 *  - data/BUAFL/phases2007.csv
 *  - data/BUAFL/standings2007.csv
 *  - data/BUAFL/games2007.csv
 *
 * Source: https://britball.fandom.com/wiki/2007-08_BUAFL_Season
 */

import fs from 'fs';

const SOURCE_URL = 'https://britball.fandom.com/wiki/2007-08_BUAFL_Season';

// --- CANONICAL 2007/08 DIVISION MAPPINGS (42 TEAMS, 8 DIVISIONS) ---
const teamPrimaryDivision = {
  // Scottish Division (Northern Conference)
  "Stirling Clansmen": "Scottish Division",
  "Edinburgh Napier Knights": "Scottish Division",
  "Napier Mavericks": "Scottish Division",
  "Caledonian Roughriders": "Scottish Division",
  "GCU Roughriders": "Scottish Division",
  "Glasgow Tigers": "Scottish Division",
  "UWS Pyros": "Scottish Division",

  // North-East Division (Northern Conference)
  "Newcastle Raiders": "North-East Division",
  "Teesside Cougars": "North-East Division",
  "Sunderland Spartans": "North-East Division",
  "Durham Saints": "North-East Division",
  "Hull Sharks": "North-East Division",

  // Roses Division (Northern Conference)
  "Leeds Celtics": "Roses Division",
  "Sheffield Sabres": "Roses Division",
  "Sheffield Hallam Warriors": "Roses Division",
  "Lancaster Bombers": "Roses Division",
  "Huddersfield Hawks": "Roses Division",

  // Midland Division (Northern Conference)
  "Staffordshire Stallions": "Midland Division",
  "Nottingham Outlaws": "Midland Division",
  "Loughborough Aces": "Midland Division",
  "Leicester Longhorns": "Midland Division",
  "Derby Braves": "Midland Division",
  "Lincoln Colonials": "Midland Division",

  // Central Division (Southern Conference)
  "Birmingham Lions": "Central Division",
  "Oxford Cavaliers": "Central Division",
  "Warwick Wolves": "Central Division",
  "Tarannau Aberystwyth": "Central Division",

  // Southern Division (Southern Conference)
  "Southampton Stags": "Southern Division",
  "Royal Holloway Bears": "Southern Division",
  "Reading Knights": "Southern Division",
  "Portsmouth Destroyers": "Southern Division",
  "Brighton Tsunami": "Southern Division",
  "Surrey Stingers": "Southern Division",

  // Eastern Division (Southern Conference)
  "Hertfordshire Hurricanes": "Eastern Division",
  "Greenwich Mariners": "Eastern Division",
  "UEA Pirates": "Eastern Division",
  "Essex Blades": "Eastern Division",
  "Kent Falcons": "Eastern Division",
  "Anglia Ruskin Rhinos": "Eastern Division",

  // Western Division (Southern Conference)
  "Bath Killer Bees": "Western Division",
  "UWE Bullets": "Western Division",
  "Cardiff Cobras": "Western Division",
  "Bristol Barracuda": "Western Division",
  "Plymouth Blitz": "Western Division"
};

// Historical team name alias resolver for 2007/08
function resolveTeamName(name) {
  if (!name) return '';
  const clean = name.trim();
  const map = {
    'Napier Mavericks': 'Edinburgh Napier Knights',
    'GCU Roughriders': 'Caledonian Roughriders',
    'Brighton Panthers': 'Brighton Tsunami',
    'Royal Holloway Vikings': 'Royal Holloway Bears',
    'Paisley Pyros': 'UWS Pyros',
    'UT Cougars': 'Teesside Cougars',
    'UCH Sharks': 'Hull Sharks',
    'UH Sharks': 'Hull Sharks',
    'ARU Phantoms': 'Anglia Ruskin Rhinos',
    'Anglia Ruskin Siege': 'Anglia Ruskin Rhinos',
    'Leeds Carnegie': 'Leeds Met Carnegie',
    'Leeds Met': 'Leeds Met Carnegie'
  };
  return map[clean] || clean;
}

// Escape helper for CSV
function escapeCsv(val) {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Full 42-Team Standings from https://britball.fandom.com/wiki/2007-08_BUAFL_Season
const fullStandingsData = [
  // Scottish Division
  { team: "Stirling Clansmen", div: "Scottish Division", W: 7, L: 0, T: 1, PF: 264, PA: 23 },
  { team: "Napier Mavericks", div: "Scottish Division", W: 4, L: 3, T: 1, PF: 94, PA: 129 },
  { team: "GCU Roughriders", div: "Scottish Division", W: 4, L: 4, T: 0, PF: 109, PA: 140 },
  { team: "Glasgow Tigers", div: "Scottish Division", W: 3, L: 5, T: 0, PF: 108, PA: 135 },
  { team: "UWS Pyros", div: "Scottish Division", W: 1, L: 7, T: 0, PF: 43, PA: 138 },

  // North-East Division
  { team: "Newcastle Raiders", div: "North-East Division", W: 8, L: 0, T: 0, PF: 369, PA: 74 },
  { team: "Teesside Cougars", div: "North-East Division", W: 6, L: 2, T: 0, PF: 152, PA: 151 },
  { team: "Sunderland Spartans", div: "North-East Division", W: 3, L: 5, T: 0, PF: 132, PA: 198 },
  { team: "Durham Saints", div: "North-East Division", W: 2, L: 6, T: 0, PF: 99, PA: 180 },
  { team: "Hull Sharks", div: "North-East Division", W: 1, L: 7, T: 0, PF: 81, PA: 234 },

  // Roses Division
  { team: "Leeds Celtics", div: "Roses Division", W: 7, L: 1, T: 0, PF: 206, PA: 7 },
  { team: "Sheffield Sabres", div: "Roses Division", W: 7, L: 1, T: 0, PF: 217, PA: 31 },
  { team: "Sheffield Hallam Warriors", div: "Roses Division", W: 4, L: 4, T: 0, PF: 242, PA: 100 },
  { team: "Lancaster Bombers", div: "Roses Division", W: 2, L: 6, T: 0, PF: 59, PA: 263 },
  { team: "Huddersfield Hawks", div: "Roses Division", W: 0, L: 8, T: 0, PF: 20, PA: 356 },

  // Midland Division
  { team: "Staffordshire Stallions", div: "Midland Division", W: 8, L: 0, T: 0, PF: 306, PA: 18 },
  { team: "Nottingham Outlaws", div: "Midland Division", W: 6, L: 2, T: 0, PF: 182, PA: 86 },
  { team: "Loughborough Aces", div: "Midland Division", W: 5, L: 3, T: 0, PF: 162, PA: 118 },
  { team: "Leicester Longhorns", div: "Midland Division", W: 3, L: 5, T: 0, PF: 106, PA: 175 },
  { team: "Derby Braves", div: "Midland Division", W: 1, L: 7, T: 0, PF: 82, PA: 238 },
  { team: "Lincoln Colonials", div: "Midland Division", W: 1, L: 7, T: 0, PF: 68, PA: 271 },

  // Central Division
  { team: "Birmingham Lions", div: "Central Division", W: 8, L: 0, T: 0, PF: 282, PA: 33 },
  { team: "Oxford Cavaliers", div: "Central Division", W: 4, L: 4, T: 0, PF: 123, PA: 121 },
  { team: "Warwick Wolves", div: "Central Division", W: 2, L: 5, T: 1, PF: 36, PA: 151 },
  { team: "Tarannau Aberystwyth", div: "Central Division", W: 1, L: 6, T: 1, PF: 27, PA: 157 },

  // Southern Division
  { team: "Southampton Stags", div: "Southern Division", W: 8, L: 0, T: 0, PF: 462, PA: 20 },
  { team: "Royal Holloway Bears", div: "Southern Division", W: 6, L: 2, T: 0, PF: 154, PA: 137 },
  { team: "Reading Knights", div: "Southern Division", W: 5, L: 3, T: 0, PF: 117, PA: 127 },
  { team: "Portsmouth Destroyers", div: "Southern Division", W: 3, L: 5, T: 0, PF: 60, PA: 137 },
  { team: "Brighton Tsunami", div: "Southern Division", W: 2, L: 6, T: 0, PF: 63, PA: 169 },
  { team: "Surrey Stingers", div: "Southern Division", W: 0, L: 8, T: 0, PF: 12, PA: 278 },

  // Eastern Division
  { team: "Hertfordshire Hurricanes", div: "Eastern Division", W: 8, L: 0, T: 0, PF: 340, PA: 58 },
  { team: "Greenwich Mariners", div: "Eastern Division", W: 5, L: 3, T: 0, PF: 152, PA: 99 },
  { team: "UEA Pirates", div: "Eastern Division", W: 5, L: 3, T: 0, PF: 102, PA: 124 },
  { team: "Essex Blades", div: "Eastern Division", W: 4, L: 4, T: 0, PF: 164, PA: 200 },
  { team: "Kent Falcons", div: "Eastern Division", W: 2, L: 6, T: 0, PF: 71, PA: 155 },
  { team: "Anglia Ruskin Rhinos", div: "Eastern Division", W: 0, L: 8, T: 0, PF: 18, PA: 211 },

  // Western Division
  { team: "Bath Killer Bees", div: "Western Division", W: 7, L: 0, T: 1, PF: 182, PA: 48 },
  { team: "UWE Bullets", div: "Western Division", W: 5, L: 3, T: 0, PF: 167, PA: 116 },
  { team: "Cardiff Cobras", div: "Western Division", W: 5, L: 3, T: 0, PF: 127, PA: 65 },
  { team: "Bristol Barracuda", div: "Western Division", W: 1, L: 6, T: 1, PF: 110, PA: 229 },
  { team: "Plymouth Blitz", div: "Western Division", W: 1, L: 7, T: 0, PF: 72, PA: 206 }
];

// All empirical 2007 games
const cleanGames = [];

// 1. Regular Season Brighton games from data/gamesbrighton.csv
if (fs.existsSync('data/gamesbrighton.csv')) {
  const content = fs.readFileSync('data/gamesbrighton.csv', 'utf8');
  const lines = content.split('\n');
  lines.forEach(l => {
    if (l.includes(',2007,')) {
      const parts = l.split(',');
      if (parts.length >= 10) {
        const rawDate = parts[3];
        const rawAway = parts[4];
        const rawHome = parts[5];
        const awayScore = Number(parts[6]);
        const homeScore = Number(parts[7]);
        const venue = parts[8] || '';

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

        if (away && home) {
          const homeConf = teamPrimaryDivision[home] || 'Southern Division';
          const awayConf = teamPrimaryDivision[away] || 'Southern Division';

          cleanGames.push({
            competition: 'BUAFL',
            year: '2007',
            phase: homeConf,
            date: dStr,
            away_team: away,
            home_team: home,
            away_score: awayScore,
            home_score: homeScore,
            venue,
            notes: `${SOURCE_URL} (data/gamesbrighton.csv)`,
            away_coach: '',
            home_coach: parts[11] || '',
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
            parent_phase: 'Southern Conference',
            away_phase: awayConf !== homeConf ? awayConf : ''
          });
        }
      }
    }
  });
}

// 2. Verified 16-Team National Championship Playoff Bracket Games
const playoffBracket = [
  // Wild-Card Round (2008-03-02)
  { away: 'Loughborough Aces', home: 'Newcastle Raiders', away_score: 15, home_score: 34, date: '2008-03-02', round: 'round_1' },
  { away: 'Nottingham Outlaws', home: 'Stirling Clansmen', away_score: 12, home_score: 0, date: '2008-03-02', round: 'round_1' },
  { away: 'Teesside Cougars', home: 'Staffordshire Stallions', away_score: 6, home_score: 60, date: '2008-03-02', round: 'round_1' },
  { away: 'Sheffield Sabres', home: 'Leeds Celtics', away_score: 12, home_score: 19, date: '2008-03-02', round: 'round_1' },
  { away: 'Greenwich Mariners', home: 'Southampton Stags', away_score: 0, home_score: 43, date: '2008-03-02', round: 'round_1' },
  { away: 'Royal Holloway Bears', home: 'Bath Killer Bees', away_score: 0, home_score: 39, date: '2008-03-02', round: 'round_1' },
  { away: 'Reading Knights', home: 'Hertfordshire Hurricanes', away_score: 7, home_score: 51, date: '2008-03-02', round: 'round_1' },
  { away: 'UWE Bullets', home: 'Birmingham Lions', away_score: 6, home_score: 14, date: '2008-03-02', round: 'round_1' },

  // Quarter-Finals / Divisional Round (2008-03-09)
  { away: 'Nottingham Outlaws', home: 'Newcastle Raiders', away_score: 0, home_score: 26, date: '2008-03-09', round: 'quarter_final' },
  { away: 'Leeds Celtics', home: 'Staffordshire Stallions', away_score: 0, home_score: 19, date: '2008-03-09', round: 'quarter_final' },
  { away: 'Bath Killer Bees', home: 'Southampton Stags', away_score: 13, home_score: 35, date: '2008-03-09', round: 'quarter_final' },
  { away: 'Birmingham Lions', home: 'Hertfordshire Hurricanes', away_score: 24, home_score: 46, date: '2008-03-09', round: 'quarter_final' },

  // Semi-Finals (2008-03-16) - Scores from historical records
  { away: 'Staffordshire Stallions', home: 'Newcastle Raiders', away_score: 20, home_score: 14, date: '2008-03-16', round: 'semi_final' },
  { away: 'Hertfordshire Hurricanes', home: 'Southampton Stags', away_score: 14, home_score: 28, date: '2008-03-16', round: 'semi_final' },

  // Championship Game (College Bowl XXII - 2008-03-30) at Keepmoat Stadium, Doncaster
  {
    away: 'Staffordshire Stallions',
    home: 'Southampton Stags',
    away_score: 20,
    home_score: 52,
    date: '2008-03-30',
    round: 'final',
    is_title: 'TRUE',
    title: 'BUCS National Championship / College Bowl XXII',
    final_type: 'championship',
    venue: 'Keepmoat Stadium, Doncaster'
  }
];

for (const p of playoffBracket) {
  const away = resolveTeamName(p.away);
  const home = resolveTeamName(p.home);
  const homeConf = teamPrimaryDivision[home] || '';
  const awayConf = teamPrimaryDivision[away] || '';

  cleanGames.push({
    competition: 'BUAFL',
    year: '2007',
    phase: 'National Championship',
    date: p.date,
    away_team: away,
    home_team: home,
    away_score: p.away_score,
    home_score: p.home_score,
    venue: p.venue || '',
    notes: SOURCE_URL,
    away_coach: '',
    home_coach: '',
    is_double_header: 'FALSE',
    date_precision: 'day',
    date_display: '',
    time: '13:00',
    status: 'completed',
    confidence_level: 'high',
    is_playoff: 'TRUE',
    is_title_game: p.is_title || 'FALSE',
    final_type: p.final_type || '',
    title_name: p.title || '',
    playoff_round: p.round,
    parent_phase: '',
    away_phase: awayConf !== homeConf ? awayConf : ''
  });
}

console.log(`\nRebuilt 2007 BUAFL dataset: ${cleanGames.length} verified empirical games.`);

// 1. Write data/BUAFL/games2007.csv
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

fs.writeFileSync('data/BUAFL/games2007.csv', gamesCsvLines.join('\n') + '\n', 'utf8');
console.log('Successfully wrote data/BUAFL/games2007.csv');

// 2. Write data/BUAFL/phases2007.csv (Parent Conferences and Divisions)
const phaseContent = `competition_name,year,phase_name,type,parent_phase,confidence_level,ordinal,max_games_per_team
BUAFL,2007,National Championship,Playoffs,,high,1,
BUAFL,2007,Northern Conference,Conference,,high,2,
BUAFL,2007,Scottish Division,Division,Northern Conference,high,3,8
BUAFL,2007,North-East Division,Division,Northern Conference,high,4,8
BUAFL,2007,Roses Division,Division,Northern Conference,high,5,8
BUAFL,2007,Midland Division,Division,Northern Conference,high,6,8
BUAFL,2007,Southern Conference,Conference,,high,7,
BUAFL,2007,Central Division,Division,Southern Conference,high,8,8
BUAFL,2007,Southern Division,Division,Southern Conference,high,9,8
BUAFL,2007,Eastern Division,Division,Southern Conference,high,10,8
BUAFL,2007,Western Division,Division,Southern Conference,high,11,8
`;

fs.writeFileSync('data/BUAFL/phases2007.csv', phaseContent, 'utf8');
console.log('Successfully wrote data/BUAFL/phases2007.csv');

// 3. Write data/BUAFL/standings2007.csv
const standingsHeaders = ['competition_name','parent_phase','phase','year','team','wins','losses','ties','points_for','points_against','head_coach'];
const standingsLines = [standingsHeaders.join(',')];

for (const s of fullStandingsData) {
  const teamName = resolveTeamName(s.team);
  const parentPhase = (s.div === 'Scottish Division' || s.div === 'North-East Division' || s.div === 'Roses Division' || s.div === 'Midland Division') ? 'Northern Conference' : 'Southern Conference';
  
  const row = [
    'BUAFL',
    escapeCsv(parentPhase),
    escapeCsv(s.div),
    '2007',
    escapeCsv(teamName),
    s.W,
    s.L,
    s.T,
    s.PF,
    s.PA,
    ''
  ];
  standingsLines.push(row.join(','));
}

fs.writeFileSync('data/BUAFL/standings2007.csv', standingsLines.join('\n') + '\n', 'utf8');
console.log('Successfully wrote data/BUAFL/standings2007.csv');
