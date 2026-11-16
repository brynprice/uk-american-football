import fs from 'fs';
import xlsx from 'xlsx';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const isExecute = process.argv.includes('--execute');

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

function serializeCSVRow(fields) {
  return fields.map(val => {
    const s = String(val === null || val === undefined ? '' : val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }).join(',');
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

async function run() {
  console.log(`=== RECONCILING 2011/12 & 2012/13 BUCS FIXTURES (${isExecute ? 'EXECUTE MODE' : 'DRY RUN'}) ===\n`);

  // -------------------------------------------------------------
  // STEP 1: Purge 37 misplaced games from games2011.csv
  // -------------------------------------------------------------
  console.log('--- Step 1: Purging 37 misplaced BUCS games from games2011.csv ---');
  const g2011Raw = fs.readFileSync('data/BUAFL/games2011.csv', 'utf-8');
  const g2011Lines = g2011Raw.split('\n').filter(l => l.trim().length > 0);
  const g2011Header = parseCSVLine(g2011Lines[0]);
  const notesIdx = g2011Header.findIndex(h => h.trim() === 'notes');

  const kept2011Lines = [g2011Lines[0]];
  const purged2011Games = [];

  for (let i = 1; i < g2011Lines.length; i++) {
    const row = parseCSVLine(g2011Lines[i]);
    const notes = row[notesIdx] || '';
    if (notes.includes('BUCS contemporary records')) {
      purged2011Games.push({
        away: row[4],
        home: row[5],
        as: row[6],
        hs: row[7],
        date: row[3]
      });
    } else {
      kept2011Lines.push(g2011Lines[i]);
    }
  }

  console.log(`games2011.csv: Original=${g2011Lines.length - 1}, Purged=${purged2011Games.length}, Kept=${kept2011Lines.length - 1}`);

  if (isExecute) {
    fs.writeFileSync('data/BUAFL/games2011.csv', kept2011Lines.join('\n') + '\n');
    console.log('Successfully updated data/BUAFL/games2011.csv');
  }

  // -------------------------------------------------------------
  // STEP 2: Process BUCS 2011-12 Excel Rows for games2012.csv
  // -------------------------------------------------------------
  console.log('\n--- Step 2: Preparing 2012/13 fixtures from BUCS 2011-12 Workbook ---');
  const wb = xlsx.readFile('data/BUCS_2011_12_Results.xlsx');
  const s = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(s, { header: 1 });
  const afRows = rows.filter(r => (r[1] || '').toString().toLowerCase().includes('american football'));

  // Load existing 2012 games and standings
  const g2012Raw = fs.readFileSync('data/BUAFL/games2012.csv', 'utf-8');
  const g2012Lines = g2012Raw.split('\n').filter(l => l.trim().length > 0);
  const g2012Header = parseCSVLine(g2012Lines[0]);

  const s2012 = loadCSV('data/BUAFL/standings2012.csv');
  const teamPhaseMap = {};
  s2012.forEach(s => teamPhaseMap[s.team] = s.phase);

  // Load verified coaches 2012
  const verifiedCoachesRaw = JSON.parse(fs.readFileSync('data/evidence/verified_coaches.json', 'utf-8'));
  const verifiedCoaches2012 = {};
  for (const vc of verifiedCoachesRaw) {
    if (parseInt(vc.year) === 2012) {
      verifiedCoaches2012[vc.team] = vc.head_coach;
    }
  }

  // Load existing games objects in 2012
  const existing2012Games = g2012Lines.slice(1).map(l => {
    const row = parseCSVLine(l);
    const obj = {};
    g2012Header.forEach((h, idx) => obj[h.trim()] = (row[idx] || '').trim());
    obj._rawLine = l;
    return obj;
  });

  const updated2012Games = [];
  let updatedExistingCount = 0;
  let addedNewCount = 0;
  let skippedDupCount = 0;

  let updatedBrunelOxford = false;
  let updatedLincolnLeicester = false;

  // Process existing 2012 games: check for date assignments/replacements
  for (const eg of existing2012Games) {
    // 2a. Oxford vs Brunel (Row #21): assign true date 2012-11-04
    if (
      (eg.away_team === 'Brunel Burners' && eg.home_team === 'Oxford Lancers') ||
      (eg.away_team === 'Oxford Lancers' && eg.home_team === 'Brunel Burners')
    ) {
      if (!eg.date) {
        eg.date = '2012-11-04';
        eg.date_precision = 'day';
        eg.date_display = '04/11/2012';
        eg.notes = 'Source: BUCS historical records';
        updatedExistingCount++;
        updatedBrunelOxford = true;
        console.log(`[Update] Assigned date 2012-11-04 to Brunel vs Oxford Lancers`);
      }
    }

    // 2b. Lincoln vs Leicester (Row #2): replace un-dated phantom 0-6 with true 2012-12-01 (Leicester 24, Lincoln 22)
    if (
      (eg.away_team === 'Leicester Longhorns' && eg.home_team === 'Lincoln Colonials' && eg.away_score === '0' && eg.home_score === '6') ||
      (eg.away_team === 'Lincoln Colonials' && eg.home_team === 'Leicester Longhorns' && eg.away_score === '6' && eg.home_score === '0')
    ) {
      if (!eg.date) {
        eg.date = '2012-12-01';
        eg.date_precision = 'day';
        eg.date_display = '01/12/2012';
        eg.away_team = 'Leicester Longhorns';
        eg.home_team = 'Lincoln Colonials';
        eg.away_score = '24';
        eg.home_score = '22';
        eg.notes = 'Source: BUCS historical records';
        updatedExistingCount++;
        updatedLincolnLeicester = true;
        console.log(`[Update] Replaced phantom Lincoln/Leicester with true 2012-12-01 match (Leicester 24, Lincoln 22)`);
      }
    }

    updated2012Games.push(eg);
  }

  // Define the rows to skip (Category A duplicates already present on true date)
  // Row 10 (Surrey @ Brighton on 2012-12-02), Row 20 (Nottingham @ Birmingham on 2012-11-03),
  // Row 22 (Coventry @ NTU on 2012-11-04), Row 37 (BNU @ Kingston on 2012-11-04)
  const skipRowNums = new Set([10, 20, 22, 37]);
  // Rows already updated in existing2012Games above:
  const updatedRowNums = new Set();
  if (updatedLincolnLeicester) updatedRowNums.add(2);
  if (updatedBrunelOxford) updatedRowNums.add(21);

  const newGamesToAppend = [];

  afRows.forEach((r, idx) => {
    const rowNum = idx + 1;
    if (skipRowNums.has(rowNum)) {
      skippedDupCount++;
      return;
    }
    if (updatedRowNums.has(rowNum)) {
      return; // already handled
    }

    const rawDate = excelDateToDate(r[4]);
    const flippedDate = flipDate(rawDate);
    const home = resolve(r[6]);
    const away = resolve(r[9]);
    const homeScore = r[7] !== undefined ? String(r[7]) : '';
    const awayScore = r[8] !== undefined ? String(r[8]) : '';

    // Check if game already exists in updated2012Games to prevent duplicates on repeated execution
    const alreadyExists = updated2012Games.some(eg => 
      ((eg.home_team === home && eg.away_team === away) || (eg.home_team === away && eg.away_team === home)) &&
      (eg.date === flippedDate)
    );
    if (alreadyExists) {
      skippedDupCount++;
      return;
    }

    const homePhase = teamPhaseMap[home] || '';
    const awayPhase = teamPhaseMap[away] || '';
    const phase = homePhase || awayPhase || 'Regular Season';
    const awayPhaseCol = (awayPhase && awayPhase !== phase) ? awayPhase : '';

    const isVoid = awayScore === '0' && homeScore === '0';
    const status = isVoid ? 'cancelled' : 'completed';
    const notes = isVoid 
      ? 'Source: BUCS historical records (BUCS record: Void)'
      : (home === 'Stirling Clansmen' && away === 'Glasgow University Tigers'
          ? 'Source: BUCS historical records & Double Coverage contemporary reports'
          : 'Source: BUCS historical records');

    const [fy, fm, fd] = flippedDate.split('-');
    const dateDisplay = `${fd}/${fm}/${fy}`;

    const newGame = {
      competition: 'BUAFL',
      year: '2012',
      date: flippedDate,
      date_precision: 'day',
      date_display: dateDisplay,
      phase: phase,
      parent_phase: '',
      away_phase: awayPhaseCol,
      away_parent_phase: '',
      away_team: away,
      away_score: awayScore,
      home_score: homeScore,
      home_team: home,
      is_playoff: 'FALSE',
      playoff_round: '',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: '',
      nickname: '',
      is_double_header: 'FALSE',
      game_type: 'league',
      status: status,
      confidence_level: 'high',
      venue: '',
      home_coach: verifiedCoaches2012[home] || '',
      away_coach: verifiedCoaches2012[away] || '',
      notes: notes
    };

    newGamesToAppend.push(newGame);
    addedNewCount++;
  });

  console.log(`2012 Fixtures Summary: Updated=${updatedExistingCount}, Added New=${addedNewCount}, Skipped Dupes=${skippedDupCount}`);

  // Combine updated + new games
  const final2012Games = [...updated2012Games, ...newGamesToAppend];

  // Sort final 2012 games by date
  final2012Games.sort((a, b) => {
    const da = a.date || '9999-99-99';
    const db = b.date || '9999-99-99';
    return da.localeCompare(db);
  });

  if (isExecute) {
    const outputLines = [
      g2012Header.join(','),
      ...final2012Games.map(g => serializeCSVRow(g2012Header.map(h => g[h.trim()] || '')))
    ];
    fs.writeFileSync('data/BUAFL/games2012.csv', outputLines.join('\n') + '\n');
    console.log(`Successfully updated data/BUAFL/games2012.csv (${final2012Games.length} total games)`);
  }

  // -------------------------------------------------------------
  // STEP 3: Recompute 2012 Standings
  // -------------------------------------------------------------
  console.log('\n--- Step 3: Recomputing standings2012.csv ---');
  const teamStats = {};
  s2012.forEach(st => {
    teamStats[st.team] = {
      team: st.team,
      phase: st.phase,
      parent_phase: st.parent_phase,
      head_coach: st.head_coach || verifiedCoaches2012[st.team] || '',
      wins: 0,
      losses: 0,
      ties: 0,
      pf: 0,
      pa: 0,
      notes: st.notes
    };
  });

  for (const g of final2012Games) {
    if (g.is_playoff === 'TRUE') continue;
    if (g.status === 'cancelled') continue; // do not count void 0-0 games in standings

    const home = g.home_team;
    const away = g.away_team;
    const hs = parseInt(g.home_score);
    const as = parseInt(g.away_score);

    if (isNaN(hs) || isNaN(as)) continue;

    if (teamStats[home]) {
      teamStats[home].pf += hs;
      teamStats[home].pa += as;
      if (hs > as) teamStats[home].wins++;
      else if (hs < as) teamStats[home].losses++;
      else teamStats[home].ties++;
    }

    if (teamStats[away]) {
      teamStats[away].pf += as;
      teamStats[away].pa += hs;
      if (as > hs) teamStats[away].wins++;
      else if (as < hs) teamStats[away].losses++;
      else teamStats[away].ties++;
    }
  }

  const s2012Lines = fs.readFileSync('data/BUAFL/standings2012.csv', 'utf-8').split('\n').filter(l => l.trim().length > 0);
  const s2012Header = parseCSVLine(s2012Lines[0]);

  const newStandingsRows = s2012.map(st => {
    const stats = teamStats[st.team];
    const wins = stats ? stats.wins : parseInt(st.wins || 0);
    const losses = stats ? stats.losses : parseInt(st.losses || 0);
    const ties = stats ? stats.ties : parseInt(st.ties || 0);
    const pf = stats ? stats.pf : parseInt(st.points_for || 0);
    const pa = stats ? stats.pa : parseInt(st.points_against || 0);
    const gp = wins + losses + ties;

    return {
      competition_name: 'BUAFL',
      parent_phase: st.parent_phase || '',
      phase: st.phase,
      year: '2012',
      team: st.team,
      position: st.position || '',
      games_played: String(gp),
      wins: String(wins),
      losses: String(losses),
      ties: String(ties),
      points_for: String(pf),
      points_against: String(pa),
      streak: st.streak || '',
      is_champion: st.is_champion || 'FALSE',
      notes: st.notes || 'Source: BUCS historical records & Double Coverage contemporary reports',
      head_coach: stats ? stats.head_coach : (st.head_coach || '')
    };
  });

  // Re-rank within each phase
  const phases = {};
  for (const row of newStandingsRows) {
    if (!phases[row.phase]) phases[row.phase] = [];
    phases[row.phase].push(row);
  }

  const sortedStandingsRows = [];
  for (const [phaseName, rows] of Object.entries(phases)) {
    rows.sort((a, b) => {
      const aW = parseInt(a.wins, 10);
      const aL = parseInt(a.losses, 10);
      const aT = parseInt(a.ties, 10);
      const aGP = parseInt(a.games_played, 10) || 1;
      const aPct = (aW + 0.5 * aT) / aGP;

      const bW = parseInt(b.wins, 10);
      const bL = parseInt(b.losses, 10);
      const bT = parseInt(b.ties, 10);
      const bGP = parseInt(b.games_played, 10) || 1;
      const bPct = (bW + 0.5 * bT) / bGP;

      if (bPct !== aPct) return bPct - aPct;
      if (bW !== aW) return bW - aW;
      
      const aDiff = parseInt(a.points_for, 10) - parseInt(a.points_against, 10);
      const bDiff = parseInt(b.points_for, 10) - parseInt(b.points_against, 10);
      if (bDiff !== aDiff) return bDiff - aDiff;

      return parseInt(b.points_for, 10) - parseInt(a.points_for, 10);
    });

    rows.forEach((r, idx) => {
      r.position = String(idx + 1);
      sortedStandingsRows.push(r);
    });
  }

  if (isExecute) {
    const sOutputLines = [
      s2012Header.join(','),
      ...sortedStandingsRows.map(r => serializeCSVRow(s2012Header.map(h => r[h.trim()] || '')))
    ];
    fs.writeFileSync('data/BUAFL/standings2012.csv', sOutputLines.join('\n') + '\n');
    console.log(`Successfully updated data/BUAFL/standings2012.csv (${sortedStandingsRows.length} teams)`);
  }

  // -------------------------------------------------------------
  // STEP 4: Synchronize Supabase Database
  // -------------------------------------------------------------
  if (isExecute) {
    console.log('\n--- Step 4: Synchronizing Supabase Database ---');
    
    // 4a. Get team and phase maps from Supabase
    const { data: teamsData, error: teamsErr } = await supabase.from('teams').select('id, name').range(0, 999);
    if (teamsErr || !teamsData) {
      throw new Error(`Failed to load teams from Supabase: ${teamsErr?.message || 'No data'}`);
    }
    const dbTeamMap = {};
    teamsData.forEach(t => dbTeamMap[t.name] = t.id);

    const { data: aliasesData, error: aliasErr } = await supabase.from('team_aliases').select('name, team_id');
    if (!aliasErr && aliasesData) {
      aliasesData.forEach(a => {
        if (!dbTeamMap[a.name]) {
          dbTeamMap[a.name] = a.team_id;
        }
      });
    }

    const { data: buaflComp, error: compErr } = await supabase.from('competitions').select('id').eq('slug', 'buafl').single();
    if (compErr || !buaflComp) {
      throw new Error(`Failed to load BUAFL competition: ${compErr?.message || 'Not found'}`);
    }
    const { data: season2011, error: s11Err } = await supabase.from('seasons').select('id').eq('competition_id', buaflComp.id).eq('year', 2011).single();
    if (s11Err || !season2011) {
      throw new Error(`Failed to load 2011 BUAFL season: ${s11Err?.message || 'Not found'}`);
    }
    const { data: season2012, error: s12Err } = await supabase.from('seasons').select('id').eq('competition_id', buaflComp.id).eq('year', 2012).single();
    if (s12Err || !season2012) {
      throw new Error(`Failed to load 2012 BUAFL season: ${s12Err?.message || 'Not found'}`);
    }

    const { data: phases2012, error: phErr } = await supabase.from('phases').select('id, name').eq('season_id', season2012.id);
    if (phErr || !phases2012) {
      throw new Error(`Failed to load 2012 phases: ${phErr?.message || 'No data'}`);
    }
    const dbPhase2012Map = {};
    phases2012.forEach(p => dbPhase2012Map[p.name] = p.id);

    // 4b. Delete purged 2011 games in Supabase
    if (season2011) {
      console.log('Purging deleted 2011 games from Supabase...');
      const { data: deletedGames, error: delErr } = await supabase.from('games')
        .delete()
        .eq('season_id', season2011.id)
        .ilike('notes', '%BUCS contemporary records%')
        .select('id');
      if (delErr) {
        console.error('Error deleting 2011 games:', delErr.message);
      } else {
        console.log(`Successfully purged ${deletedGames?.length || 0} misplaced games from 2011 season in Supabase.`);
      }
    }

    // 4c. Update / Insert games in Supabase for 2012
    console.log('Upserting 2012 games in Supabase...');
    for (const g of final2012Games) {
      const homeId = dbTeamMap[g.home_team];
      const awayId = dbTeamMap[g.away_team];
      const phaseId = dbPhase2012Map[g.phase];
      const awayPhaseId = g.away_phase ? dbPhase2012Map[g.away_phase] : null;

      if (!homeId || !awayId) {
        console.warn(`Missing team ID for ${g.away_team} or ${g.home_team}`);
        continue;
      }

      const gamePayload = {
        season_id: season2012.id,
        phase_id: phaseId || null,
        away_phase_id: awayPhaseId || null,
        home_team_id: homeId,
        away_team_id: awayId,
        date: g.date || null,
        date_precision: g.date_precision || 'day',
        date_display: g.date_display || null,
        home_score: g.home_score !== '' ? parseInt(g.home_score) : null,
        away_score: g.away_score !== '' ? parseInt(g.away_score) : null,
        status: g.status || 'completed',
        confidence_level: g.confidence_level || 'high',
        is_playoff: g.is_playoff === 'TRUE',
        final_type: g.final_type || null,
        notes: g.notes || null
      };

      // Check if game exists by season, home, away, and date (or matchup if un-dated)
      let q = supabase.from('games')
        .select('id')
        .eq('season_id', season2012.id)
        .eq('home_team_id', homeId)
        .eq('away_team_id', awayId);
      
      if (g.date) {
        q = q.eq('date', g.date);
      } else {
        q = q.is('date', null);
      }
      let { data: existingG } = await q.maybeSingle();

      if (!existingG && g.date) {
        const { data: unDatedG } = await supabase.from('games')
          .select('id')
          .eq('season_id', season2012.id)
          .eq('home_team_id', homeId)
          .eq('away_team_id', awayId)
          .is('date', null)
          .maybeSingle();
        if (unDatedG) {
          existingG = unDatedG;
        }
      }

      if (!existingG) {
        let revQ = supabase.from('games')
          .select('id')
          .eq('season_id', season2012.id)
          .eq('home_team_id', awayId)
          .eq('away_team_id', homeId);
        if (g.date) {
          revQ = revQ.eq('date', g.date);
        } else {
          revQ = revQ.is('date', null);
        }
        const { data: revG } = await revQ.maybeSingle();
        if (revG) {
          existingG = revG;
        }
      }

      if (existingG) {
        const { error: updErr } = await supabase.from('games').update(gamePayload).eq('id', existingG.id);
        if (updErr) console.error(`Error updating game ${g.away_team} @ ${g.home_team}:`, updErr.message);
      } else {
        const { error: insErr } = await supabase.from('games').insert(gamePayload);
        if (insErr) console.error(`Error inserting game ${g.away_team} @ ${g.home_team}:`, insErr.message);
      }
    }
    console.log('Finished upserting 2012 games in Supabase.');

    // 4d. Sync participations in Supabase for 2012
    console.log('Syncing 2012 participations in Supabase...');
    for (const st of sortedStandingsRows) {
      const teamId = dbTeamMap[st.team];
      const phaseId = dbPhase2012Map[st.phase];
      if (!teamId || !phaseId) continue;

      const { error: partErr } = await supabase.from('participations')
        .update({
          wins: parseInt(st.wins),
          losses: parseInt(st.losses),
          ties: parseInt(st.ties),
          points_for: parseInt(st.points_for),
          points_against: parseInt(st.points_against)
        })
        .eq('team_id', teamId)
        .eq('phase_id', phaseId);

      if (partErr) {
        console.error(`Error updating participation for ${st.team}:`, partErr.message);
      }
    }
    console.log('Finished syncing 2012 participations in Supabase.');
  }

  console.log('\n=== RECONCILIATION COMPLETED SUCCESSFULLY ===');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
