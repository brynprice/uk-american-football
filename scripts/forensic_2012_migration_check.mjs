import fs from 'fs';
import xlsx from 'xlsx';

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function loadCSV(path) {
  if (!fs.existsSync(path)) return [];
  const content = fs.readFileSync(path, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const header = parseCSVLine(lines[0]);
  return lines.slice(1).map(l => {
    const row = parseCSVLine(l);
    const obj = {};
    header.forEach((h, idx) => obj[h.trim()] = (row[idx] || '').trim());
    return obj;
  });
}

const teamMap = {
  "University of Birmingham Men's 1st": "Birmingham Lions",
  "University of Hertfordshire Men's 1st": "Hertfordshire Hurricanes",
  "University of Stirling Men's 1st": "Stirling Clansmen",
  "University of Derby Men's 1st": "Derby Braves",
  "Loughborough University Men's 1st": "Loughborough Aces",
  "Sheffield Hallam University Men's 1st": "Sheffield Hallam Warriors",
  "University of Sheffield Men's 1st": "Sheffield Sabres",
  "University of Portsmouth  Men's 1st": "Portsmouth Destroyers",
  "University of Portsmouth Men's 1st": "Portsmouth Destroyers",
  "Kingston University Men's 1st": "Kingston Cougars",
  "University of Bath Men's 1st": "Bath Killer Bees",
  "University of the West of England (UWE) Men's 1st": "UWE Bullets",
  "Leeds Beckett University (Carnegie) Men's 1st": "Leeds Beckett Carnegie",
  "Leeds Metropolitan University Men's 1st": "Leeds Beckett Carnegie",
  "University of Leeds Men's 1st": "Leeds Gryphons",
  "Nottingham Trent University Men's 1st": "Nottingham Trent Renegades",
  "University of Southampton Men's 1st": "Southampton Stags",
  "University of Glasgow Men's 1st": "Glasgow University Tigers",
  "University of Edinburgh Men's 1st": "Edinburgh Predators",
  "University of Cambridge Men's 1st": "Cambridge Pythons",
  "University of East Anglia Men's 1st": "UEA Pirates",
  "University of Gloucestershire Men's 1st": "Gloucestershire Gladiators",
  "Buckinghamshire New University Men's 1st": "BNU Buccaneers",
  "University of Manchester Men's 1st": "Manchester Tyrants",
  "University of Kent Men's 1st": "Kent Falcons",
  "University of Brighton Men's 1st": "Brighton Tsunami",
  "Brighton University Men's 1st": "Brighton Tsunami",
  "University of Surrey Men's 1st": "Surrey Stingers",
  "University of Sussex Men's 1st": "Sussex Saxons",
  "Coventry University Men's 1st": "Coventry University Jets",
  "University of Wolverhampton Men's 1st": "Wolverhampton Wildcats",
  "De Montfort University Men's 1st": "DMU Lions",
  "University of Leicester Men's 1st": "Leicester Longhorns",
  "University of Lincoln Men's 1st": "Lincoln Colonials",
  "Northumbria University Men's 1st": "Northumbria Mustangs",
  "Durham University Men's 1st": "Durham Saints",
  "Teesside University Men's 1st": "Teesside Cougars",
  "University of Hull Men's 1st": "Hull Sharks",
  "University of Bradford Men's 1st": "Bradford Bears",
  "Newcastle University Men's 1st": "Newcastle Raiders",
  "University of York Men's 1st": "York Centurions",
  "Bangor University Men's 1st": "Bangor MudDogs",
  "Lancaster University Men's 1st": "Lancaster Bombers",
  "Keele University Men's 1st": "Keele Crusaders",
  "University of Central Lancashire Men's 1st": "UCLan Rams",
  "Manchester Metropolitan University Men's 1st (Manchester)": "MMU Eagles",
  "Southampton Solent University Men's 1st": "Solent Redhawks",
  "Oxford Brookes University Men's 1st": "Oxford Brookes University",
  "Anglia Ruskin University Men's 1st (Cambridge)": "Anglia Ruskin Siege",
  "University of Northampton Men's 1st": "Northampton Nemesis",
  "Brunel University Men's 1st": "Brunel Burners",
  "Imperial College London  Men's 1st": "Imperial Immortals",
  "Imperial College London Men's 1st": "Imperial Immortals",
  "Royal Holloway, University of London Men's 1st": "Royal Holloway Bears",
  "University of Greenwich Men's 1st": "Greenwich Mariners",
  "City University London Men's 1st": "City Wolfpack",
  "Aberystwyth University Men's 1st": "Tarannau Aberystwyth",
  "University of Exeter Men's 1st": "Exeter Demons",
  "Swansea University Men's 1st": "Swansea Titans",
  "Reading University Men's 1st": "Reading Knights",
  "University of Huddersfield Men's 1st": "Huddersfield Hawks",
  "Liverpool John Moores University Men's 1st": "LJMU Fury",
  "Staffordshire University Men's 1st": "Staffordshire Stallions",
  "Canterbury Christ Church University Men's 1st": "Canterbury CC Chargers",
  "London South Bank University Men's 1st": "LSBU Spartans",
  "University of Westminster Men's 1st": "Westminster Dragons",
  "University of Plymouth Men's 1st": "Plymouth Blitz",
  "University of Bristol Men's 1st": "Bristol Barracuda",
  "University of Nottingham Men's 1st": "Nottingham Gold",
  "Edinburgh Napier University Men's 1st": "Edinburgh Napier Knights",
  "University of the West of Scotland Men's 1st": "UWS Pyros",
  "University of Essex Men's 1st": "Essex Blades",
  "University of Oxford Men's 1st": "Oxford Lancers",
  "University of Chichester Men's 1st": "Chichester Spitfires",
  "University of Sunderland Men's 1st": "Sunderland Spartans",
  "University of Liverpool Men's 1st": "Liverpool Raptors",
  "Edge Hill University Men's 1st": "Edge Hill Vikings",
  "Oxford University Men's 1st": "Oxford Lancers",
  "Cardiff University Men's 1st": "Cardiff Cobras",
  "King's College London Men's 1st": "KCL Regents",
  "Bath Spa University Men's 1st": "Bath Spa Bulldogs",
  "University of Worcester Men's 1st": "Worcester Royals",
  "University of Warwick Men's 1st": "Warwick Wolves",
};

const g2011 = loadCSV('data/BUAFL/games2011.csv');
const g2012 = loadCSV('data/BUAFL/games2012.csv');
const s2012 = loadCSV('data/BUAFL/standings2012.csv');

let dblPosts = [];
if (fs.existsSync('scratch/dblcoverage_2012_all_full_posts.json')) {
  dblPosts = JSON.parse(fs.readFileSync('scratch/dblcoverage_2012_all_full_posts.json', 'utf-8'));
}

const wb = xlsx.readFile('data/BUCS_2011_12_Results.xlsx');
const s = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(s, { header: 1 });
const afRows = rows.filter(r => (r[1] || '').toString().toLowerCase().includes('american football'));

function resolve(raw) {
  if (!raw) return '';
  const trimmed = raw.trim();
  return teamMap[trimmed] || trimmed;
}

function excelDateToDate(excelDate) {
  if (!excelDate || isNaN(excelDate)) return null;
  const d = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
  return d.toISOString().split('T')[0];
}

function flipDate(isoDate) {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  if (d <= 12 && d !== m) {
    const fy = y;
    const fm = String(d).padStart(2, '0');
    const fd = String(m).padStart(2, '0');
    return `${fy}-${fm}-${fd}`;
  }
  return null;
}

// Group all 43 rows by verification category
const verifiedDuplicates = []; // Already in 2012 on this date or identical
const conflictCases = [];     // Same matchup on different date or team already playing on date
const cleanAdditions = [];     // Clean new games with verified flipped date

afRows.forEach((r, idx) => {
  const rowNum = idx + 1;
  const rawDate = excelDateToDate(r[4]);
  const flippedDate = flipDate(rawDate);
  const rawHome = r[6];
  const rawAway = r[9];
  const homeScore = r[7] !== undefined ? Number(r[7]) : null;
  const awayScore = r[8] !== undefined ? Number(r[8]) : null;
  const comp = r[3];
  const winner = r[10] || '';
  const noScoreType = r[11] || '';

  const home = resolve(rawHome);
  const away = resolve(rawAway);

  // Check existing games in 2012
  const in2012 = g2012.filter(g => 
    (g.home_team === home && g.away_team === away) ||
    (g.home_team === away && g.away_team === home)
  );

  // Check games on flippedDate in 2012
  const homeOnDate = g2012.filter(g => (g.home_team === home || g.away_team === home) && g.date === flippedDate);
  const awayOnDate = g2012.filter(g => (g.home_team === away || g.away_team === away) && g.date === flippedDate);

  const item = {
    rowNum,
    comp,
    rawDate,
    flippedDate,
    home,
    away,
    homeScore,
    awayScore,
    winner,
    noScoreType,
    in2012,
    homeOnDate,
    awayOnDate
  };

  // Case 1: Exact match already in 2012 on flipped date
  const exactIn2012 = in2012.find(g => g.date === flippedDate);
  if (exactIn2012) {
    verifiedDuplicates.push({
      ...item,
      existingGame: exactIn2012,
      reason: `Already exists in 2012 on ${flippedDate} (${exactIn2012.away_team} @ ${exactIn2012.home_team} ${exactIn2012.away_score}-${exactIn2012.home_score})`
    });
    return;
  }

  // Case 2: Matchup exists on a different date in 2012
  if (in2012.length > 0) {
    conflictCases.push({
      ...item,
      existingGames: in2012,
      reason: `Matchup already exists on different date(s): ${in2012.map(g => `${g.date || '(blank)'}: ${g.away_team} @ ${g.home_team} ${g.away_score}-${g.home_score}`).join('; ')}`
    });
    return;
  }

  // Case 3: Either team already playing another game on flippedDate
  if (homeOnDate.length > 0 || awayOnDate.length > 0) {
    conflictCases.push({
      ...item,
      reason: `Date conflict on ${flippedDate}: Home team playing ${homeOnDate.map(g => g.away_team + ' vs ' + g.home_team).join('; ')} | Away team playing ${awayOnDate.map(g => g.away_team + ' vs ' + g.home_team).join('; ')}`
    });
    return;
  }

  cleanAdditions.push(item);
});

console.log('=== VERIFICATION SUMMARY ===');
console.log(`Total BUCS rows examined: ${afRows.length}`);
console.log(`1. Already in 2012 (Duplicates to SKIP): ${verifiedDuplicates.length}`);
console.log(`2. Complex / Ambiguous / Existing Matchups to INSPECT: ${conflictCases.length}`);
console.log(`3. Clean New Additions to 2012: ${cleanAdditions.length}`);

console.log('\n======================================================');
console.log('1. ALREADY IN 2012 DATASET (DO NOT IMPORT):');
console.log('======================================================');
verifiedDuplicates.forEach(d => {
  console.log(`Row #${d.rowNum}: ${d.away} @ ${d.home} (${d.awayScore}-${d.homeScore}) on ${d.flippedDate}`);
  console.log(`   -> ${d.reason}`);
});

console.log('\n======================================================');
console.log('2. CONFLICT / COMPLEX CASES TO INSPECT CAREFULLY:');
console.log('======================================================');
conflictCases.forEach(c => {
  console.log(`Row #${c.rowNum}: ${c.away} @ ${c.home} (${c.awayScore}-${c.homeScore}) candidate date: ${c.flippedDate}`);
  console.log(`   -> ${c.reason}`);
});

console.log('\n======================================================');
console.log('3. CLEAN ADDITIONS TO 2012 (BY DATE):');
console.log('======================================================');
const byDate = {};
cleanAdditions.forEach(a => {
  const d = a.flippedDate;
  if (!byDate[d]) byDate[d] = [];
  byDate[d].push(a);
});

for (const [date, games] of Object.entries(byDate)) {
  console.log(`\n--- Date: ${date} (${games.length} games) ---`);
  games.forEach(g => {
    console.log(`  Row #${g.rowNum}: ${g.away} @ ${g.home} (${g.awayScore}-${g.homeScore}) [div: ${g.comp}]`);
  });
}
