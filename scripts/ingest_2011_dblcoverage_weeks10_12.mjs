import fs from 'fs';

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function serializeCSVRow(fields) {
  return fields.map(val => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }).join(',');
}

// 1. Register Martin Hume (Solent Redhawks, 2011) in verified_coaches.json
const evidencePath = 'data/evidence/verified_coaches.json';
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));
if (!evidence.some(e => e.team === 'Solent Redhawks' && e.year === 2011 && e.head_coach === 'Martin Hume')) {
  evidence.push({
    team: 'Solent Redhawks',
    year: 2011,
    head_coach: 'Martin Hume',
    source: 'https://dblcoverage.blogspot.com/2012/02/buafl-match-report-solents-run.html',
    source_details: 'Explicitly quoted as Solent Head Coach in Double Coverage BUAFL Week 10 match report (Solent Redhawks vs BNU Buccaneers, 2012-02-19).'
  });
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
  console.log('Added Martin Hume to verified_coaches.json');
}

// 2. Update standings2011.csv for Solent Redhawks
{
  const sPath = 'data/BUAFL/standings2011.csv';
  const lines = fs.readFileSync(sPath, 'utf-8').split('\n').filter(l => l.trim().length > 0);
  const header = parseCSVLine(lines[0]);
  const teamIdx = header.indexOf('team');
  const hcIdx = header.indexOf('head_coach');
  const phaseMap = {};
  const coachMap = {};

  const out = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    const team = row[teamIdx]?.trim();
    if (team === 'Solent Redhawks') {
      row[hcIdx] = 'Martin Hume';
    }
    if (team) {
      phaseMap[team] = row[header.indexOf('phase')]?.trim();
      coachMap[team] = row[hcIdx]?.trim() || '';
    }
    out.push(serializeCSVRow(header.map((_, idx) => row[idx] || '')));
  }
  fs.writeFileSync(sPath, out.join('\n') + '\n');
  console.log('Updated standings2011.csv with Martin Hume');

  // 3. Update & append games2011.csv
  const gPath = 'data/BUAFL/games2011.csv';
  const gLines = fs.readFileSync(gPath, 'utf-8').split('\n').filter(l => l.trim().length > 0);
  const gHeader = parseCSVLine(gLines[0]);
  const idx = Object.fromEntries(gHeader.map((h, i) => [h.trim(), i]));

  const gOut = [gLines[0]];
  const existingPairs = new Set();

  for (let i = 1; i < gLines.length; i++) {
    const row = parseCSVLine(gLines[i]);
    const away = row[idx.away_team]?.trim();
    const home = row[idx.home_team]?.trim();
    existingPairs.add([away, home].sort().join('||'));

    // Fix Solent Redhawks HC across all 2011 games
    if (away === 'Solent Redhawks' && !row[idx.away_coach]) {
      row[idx.away_coach] = 'Martin Hume';
    }
    if (home === 'Solent Redhawks' && !row[idx.home_coach]) {
      row[idx.home_coach] = 'Martin Hume';
    }

    // Fix BNU Buccaneers @ Solent Redhawks score: 13-27 -> 22-27
    if (away === 'BNU Buccaneers' && home === 'Solent Redhawks' && row[idx.date] === '2012-02-19') {
      row[idx.away_score] = '22';
      row[idx.home_score] = '27';
      row[idx.notes] = 'Source: https://dblcoverage.blogspot.com/2012/02/buafl-match-report-solents-run.html & https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html';
      console.log('Updated BNU Buccaneers @ Solent Redhawks score to 22-27');
    }

    // Fill missing dates on Bath Killer Bees games
    if (away === 'Bristol Barracuda' && home === 'Bath Killer Bees' && !row[idx.date]) {
      row[idx.date] = '2012-02-19';
      row[idx.date_precision] = 'day';
      row[idx.date_display] = '19/02/2012';
      row[idx.notes] = 'Source: Britball Wiki (https://britball.fandom.com/wiki/Bath_Killer_Bees) & https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html';
      console.log('Filled date 2012-02-19 for Bristol Barracuda @ Bath Killer Bees');
    }
    if (away === 'Bath Spa Bulldogs' && home === 'Bath Killer Bees' && !row[idx.date]) {
      row[idx.date] = '2012-02-26';
      row[idx.date_precision] = 'day';
      row[idx.date_display] = '26/02/2012';
      row[idx.notes] = 'Source: Britball Wiki (https://britball.fandom.com/wiki/Bath_Killer_Bees) & https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html';
      console.log('Filled date 2012-02-26 for Bath Spa Bulldogs @ Bath Killer Bees');
    }

    gOut.push(serializeCSVRow(gHeader.map((_, j) => row[j] || '')));
  }

  const newGames = [
    // Week 10 (2012-02-19)
    { date: '2012-02-19', away: 'Sunderland Spartans', as: 0, hs: 34, home: 'Newcastle Raiders', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html' },
    { date: '2012-02-19', away: 'Sheffield Hallam Warriors', as: 55, hs: 0, home: 'Manchester Tyrants', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html' },
    { date: '2012-02-19', away: 'Leeds Gryphons', as: 24, hs: 16, home: 'Huddersfield Hawks', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html' },
    { date: '2012-02-19', away: 'Lancaster Bombers', as: 0, hs: 28, home: 'Bradford Bears', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html' },
    { date: '2012-02-19', away: 'Northampton Nemesis', as: 12, hs: 6, home: 'Warwick Wolves', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html' },
    { date: '2012-02-19', away: 'Lincoln Colonials', as: 23, hs: 8, home: 'Coventry University Jets', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html' },
    { date: '2012-02-19', away: 'Leicester Longhorns', as: 22, hs: 0, home: 'Staffordshire Stallions', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html' },
    { date: '2012-02-19', away: 'UWE Bullets', as: 21, hs: 22, home: 'Exeter Demons', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html' },
    { date: '2012-02-19', away: 'Gloucestershire Gladiators', as: 0, hs: 39, home: 'Oxford Brookes University', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html' },
    { date: '2012-02-19', away: 'Portsmouth Destroyers', as: 4, hs: 12, home: 'Reading Knights', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html' },
    { date: '2012-02-19', away: 'Brunel Burners', as: 12, hs: 14, home: 'Imperial Immortals', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html' },
    { date: '2012-02-19', away: 'Surrey Stingers', as: 0, hs: 50, home: 'Southampton Stags', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html', extraNote: 'Game called at halftime. ' },
    { date: '2012-02-19', away: 'Royal Holloway Bears', as: 0, hs: 35, home: 'Canterbury CC Chargers', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html' },
    { date: '2012-02-19', away: 'LSBU Spartans', as: 32, hs: 35, home: 'Greenwich Mariners', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html' },
    { date: '2012-02-19', away: 'Anglia Ruskin Siege', as: 0, hs: 34, home: 'KCL Regents', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html' },

    // Week 12 (2012-02-26, except LSBU @ CCCC blank date per user)
    { date: '2012-02-26', away: 'Sunderland Spartans', as: 0, hs: 34, home: 'Edinburgh Napier Knights', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html' },
    { date: '2012-02-26', away: 'Edinburgh Predators', as: 14, hs: 0, home: 'Durham Saints', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html' },
    { date: '2012-02-26', away: 'Teesside Cougars', as: 26, hs: 12, home: 'UWS Pyros', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html' },
    { date: '2012-02-26', away: 'Sheffield Hallam Warriors', as: 54, hs: 8, home: 'Leeds Beckett Carnegie', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html' },
    { date: '2012-02-26', away: 'Bangor MudDogs', as: 26, hs: 20, home: 'Tarannau Aberystwyth', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html' },
    { date: '2012-02-26', away: 'Bradford Bears', as: 6, hs: 14, home: 'Sheffield Sabres', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html' },
    { date: '2012-02-26', away: 'Hull Sharks', as: 33, hs: 6, home: 'York Centurions', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html' },
    { date: '2012-02-26', away: 'Lancaster Bombers', as: 3, hs: 0, home: 'Huddersfield Hawks', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html' },
    { date: '2012-02-26', away: 'DMU Lions', as: 13, hs: 30, home: 'Coventry University Jets', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html' },
    { date: '2012-02-26', away: 'Staffordshire Stallions', as: 36, hs: 0, home: 'Worcester Royals', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html' },
    { date: '2012-02-26', away: 'Swansea Titans', as: 14, hs: 16, home: 'Bristol Barracuda', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html' },
    { date: '2012-02-26', away: 'Gloucestershire Gladiators', as: 12, hs: 6, home: 'Westminster Dragons', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html' },
    { date: '2012-02-26', away: 'Southampton Stags', as: 19, hs: 6, home: 'Portsmouth Destroyers', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html' },
    { date: '2012-02-26', away: 'Brunel Burners', as: 0, hs: 25, home: 'Essex Blades', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html' },
    { date: '2012-02-26', away: 'Kent Falcons', as: 0, hs: 22, home: 'KCL Regents', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html' },
    { date: '', away: 'LSBU Spartans', as: 28, hs: 8, home: 'Canterbury CC Chargers', src: 'https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html', extraNote: '[Date left blank; Brighton Tsunami historical records place LSBU Spartans vs Brighton Tsunami on 2012-02-26] ' }
  ];

  let added = 0;
  for (const ng of newGames) {
    const key = [ng.away, ng.home].sort().join('||');
    if (existingPairs.has(key)) {
      console.warn(`Skipping already-present pair: ${ng.away} @ ${ng.home}`);
      continue;
    }
    const homePhase = phaseMap[ng.home];
    const awayPhase = phaseMap[ng.away];
    const dateDisp = ng.date ? `${ng.date.slice(8,10)}/${ng.date.slice(5,7)}/${ng.date.slice(0,4)}` : '';
    const note = `${ng.extraNote || ''}Source: ${ng.src}`.trim();

    const row = new Array(gHeader.length).fill('');
    row[idx.competition] = 'BUAFL';
    row[idx.year] = '2011';
    row[idx.phase] = homePhase;
    row[idx.date] = ng.date;
    row[idx.away_team] = ng.away;
    row[idx.home_team] = ng.home;
    row[idx.away_score] = String(ng.as);
    row[idx.home_score] = String(ng.hs);
    row[idx.notes] = note;
    row[idx.away_coach] = coachMap[ng.away] || '';
    row[idx.home_coach] = coachMap[ng.home] || '';
    row[idx.is_double_header] = 'FALSE';
    row[idx.date_precision] = ng.date ? 'day' : 'season';
    row[idx.date_display] = dateDisp;
    row[idx.time] = ng.date ? '13:00' : '';
    row[idx.status] = 'completed';
    row[idx.confidence_level] = 'high';
    row[idx.is_playoff] = 'FALSE';
    row[idx.is_title_game] = 'FALSE';
    if (awayPhase && awayPhase !== homePhase) {
      row[idx.away_phase] = awayPhase;
    }

    gOut.push(serializeCSVRow(row));
    added++;
  }

  fs.writeFileSync(gPath, gOut.join('\n') + '\n');
  console.log(`Added ${added} missing games to games2011.csv`);
}
