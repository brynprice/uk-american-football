import fs from 'fs';

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

function updateCSV(filePath, rowModifier, filterPredicate = () => true) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const header = parseCSVLine(lines[0]);
  const newRows = [serializeCSVRow(header)];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    const obj = {};
    header.forEach((h, idx) => {
      obj[h.trim()] = row[idx] !== undefined ? row[idx].trim() : '';
    });

    if (!filterPredicate(obj)) {
      console.log(`[Removed] in ${filePath}: ${obj.away_team} @ ${obj.home_team} (${obj.date || obj.year})`);
      continue;
    }

    rowModifier(obj);
    const serialized = serializeCSVRow(header.map(h => obj[h.trim()] || ''));
    newRows.push(serialized);
  }

  return { header, newRows };
}

// 1. Remove Brunel from games2011.csv
{
  const p = 'data/BUAFL/games2011.csv';
  const { newRows } = updateCSV(p, () => {}, obj => {
    if (obj.home_team === 'Oxford Lancers' && obj.away_team === 'Brunel Burners') {
      return false; // remove
    }
    return true;
  });
  fs.writeFileSync(p, newRows.join('\n') + '\n');
  console.log(`Updated ${p}`);
}

// 2. games2012.csv:
// - Remove Portsmouth 40 - Oxford 7
// - Remove RHUL - Oxford voided
// - Update BNU to 82-0 BNU win completed
// - Update Solent, Brighton, Reading notes
// - Add Brunel 40 - Oxford 6 friendly
// - Update Varsity Bowl: no phase, friendly
{
  const p = 'data/BUAFL/games2012.csv';
  const { header, newRows } = updateCSV(p, obj => {
    // BNU game
    if (obj.home_team === 'Oxford Lancers' && obj.away_team === 'BNU Buccaneers') {
      obj.away_score = '82';
      obj.home_score = '0';
      obj.status = 'completed';
      obj.notes = 'Oxford Lancers historic database records on-field 82-0 blowout (officially voided by BUCS). Source: Oxford Lancers historic database';
      console.log(`[Updated BNU blowout] in ${p}`);
    }

    // Solent game
    if (obj.home_team === 'Oxford Lancers' && obj.away_team === 'Solent Redhawks') {
      if (!obj.notes.includes('Oxford Lancers historic database')) {
        obj.notes = (obj.notes ? obj.notes + ' ' : '') + '[Oxford Lancers historic database records score as 0-28]';
      }
    }

    // Brighton game
    if (obj.home_team === 'Oxford Lancers' && (obj.away_team === 'Brighton Tsunami' || obj.away_team === 'Brighton Panthers')) {
      if (!obj.notes.includes('Oxford Lancers historic database')) {
        obj.notes = (obj.notes ? obj.notes + ' ' : '') + '[Oxford Lancers historic database records score as 0-27, matching BUCS official records]';
      }
    }

    // Reading game
    if ((obj.home_team === 'Reading Knights' && obj.away_team === 'Oxford Lancers') || (obj.home_team === 'Oxford Lancers' && obj.away_team === 'Reading Knights')) {
      if (!obj.notes.includes('Oxford Lancers historic database')) {
        obj.notes = (obj.notes ? obj.notes + ' ' : '') + '[Oxford Lancers historic database records score as 0-20]';
      }
    }

    // Varsity Bowl game
    if (obj.phase === 'Varsity Bowl' || (obj.away_team === 'Cambridge Pythons' && obj.home_team === 'Oxford Lancers')) {
      obj.phase = '';
      obj.parent_phase = '';
      obj.game_type = 'friendly';
      obj.title_name = 'Varsity Bowl';
      obj.nickname = 'Varsity Bowl';
    }
  }, obj => {
    // Filter out Portsmouth 40 - Oxford 7
    if ((obj.away_team === 'Portsmouth Destroyers' && obj.home_team === 'Oxford Lancers') ||
        (obj.home_team === 'Portsmouth Destroyers' && obj.away_team === 'Oxford Lancers')) {
      return false;
    }
    // Filter out RHUL - Oxford voided
    if ((obj.away_team === 'Royal Holloway Bears' && obj.home_team === 'Oxford Lancers') ||
        (obj.home_team === 'Royal Holloway Bears' && obj.away_team === 'Oxford Lancers')) {
      return false;
    }
    return true;
  });

  // Check if Brunel game is present, if not add it
  const hasBrunel = newRows.some(l => l.includes('Brunel Burners') && l.includes('Oxford Lancers'));
  if (!hasBrunel) {
    const brunelObj = {
      competition: 'BUAFL',
      year: '2012',
      phase: '',
      parent_phase: '',
      away_team: 'Brunel Burners',
      home_team: 'Oxford Lancers',
      away_score: '40',
      home_score: '6',
      date: '',
      date_precision: 'season',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      is_double_header: 'FALSE',
      game_type: 'friendly',
      notes: 'Source: Oxford Lancers historic database / BUCS contemporary records'
    };
    newRows.push(serializeCSVRow(header.map(h => brunelObj[h.trim()] || '')));
    console.log(`[Added Brunel friendly] to ${p}`);
  }

  fs.writeFileSync(p, newRows.join('\n') + '\n');
  console.log(`Updated ${p}`);
}

// 3. games2013.csv:
// - Reading note: 0-22
// - Portsmouth note: 6-33
// - Solent note: 0-66
// - Varsity Bowl: no phase, friendly
{
  const p = 'data/BUAFL/games2013.csv';
  const { newRows } = updateCSV(p, obj => {
    if (obj.home_team === 'Oxford Lancers' && obj.away_team === 'Reading Knights') {
      if (!obj.notes.includes('Oxford Lancers historic database')) {
        obj.notes = (obj.notes ? obj.notes + ' ' : '') + '[Oxford Lancers historic database records on-field score as 0-22]';
      }
    }
    if (obj.away_team === 'Oxford Lancers' && obj.home_team === 'Portsmouth Destroyers') {
      if (!obj.notes.includes('Oxford Lancers historic database')) {
        obj.notes = (obj.notes ? obj.notes + ' ' : '') + '[Oxford Lancers historic database records score as 6-33]';
      }
    }
    if (obj.away_team === 'Oxford Lancers' && obj.home_team === 'Solent Redhawks') {
      if (!obj.notes.includes('Oxford Lancers historic database')) {
        obj.notes = (obj.notes ? obj.notes + ' ' : '') + '[Oxford Lancers historic database records score as 0-66]';
      }
    }
    if (obj.phase === 'Varsity Bowl' || (obj.away_team === 'Cambridge Pythons' && obj.home_team === 'Oxford Lancers')) {
      obj.phase = '';
      obj.parent_phase = '';
      obj.game_type = 'friendly';
      obj.title_name = 'Varsity Bowl';
      obj.nickname = 'Varsity Bowl';
    }
  });
  fs.writeFileSync(p, newRows.join('\n') + '\n');
  console.log(`Updated ${p}`);
}

// 4. games2014.csv:
// - Anglia Ruskin note: 62-0
{
  const p = 'data/BUAFL/games2014.csv';
  const { newRows } = updateCSV(p, obj => {
    if (obj.home_team === 'Oxford Lancers' && obj.away_team === 'Anglia Ruskin Siege') {
      if (!obj.notes.includes('Oxford Lancers historic database')) {
        obj.notes = (obj.notes ? obj.notes + ' ' : '') + '[Oxford Lancers historic database records score as 62-0]';
      }
    }
  });
  fs.writeFileSync(p, newRows.join('\n') + '\n');
  console.log(`Updated ${p}`);
}

// 5. games2017.csv:
// - Bristol Barracuda note: 26-0
// - Oxford Brookes note: 7-27
// - Bournemouth note: 22-20
// - Varsity Bowl: no phase, friendly
{
  const p = 'data/BUAFL/games2017.csv';
  const { newRows } = updateCSV(p, obj => {
    if (obj.home_team === 'Oxford Lancers' && obj.away_team === 'Bristol Barracuda') {
      if (!obj.notes.includes('Oxford Lancers historic database')) {
        obj.notes = (obj.notes ? obj.notes + ' ' : '') + '[Oxford Lancers historic database records score as 26-0]';
      }
    }
    if (obj.away_team === 'Oxford Lancers' && obj.home_team === 'Oxford Brookes University') {
      if (!obj.notes.includes('Oxford Lancers historic database')) {
        obj.notes = (obj.notes ? obj.notes + ' ' : '') + '[Oxford Lancers historic database records score as 7-27]';
      }
    }
    if (obj.home_team === 'Oxford Lancers' && obj.away_team === 'Bournemouth University Bobcats') {
      if (!obj.notes.includes('Oxford Lancers historic database')) {
        obj.notes = (obj.notes ? obj.notes + ' ' : '') + '[Oxford Lancers historic database records score as 22-20]';
      }
    }
    if (obj.phase === 'Varsity Bowl' || (obj.away_team === 'Cambridge Pythons' && obj.home_team === 'Oxford Lancers')) {
      obj.phase = '';
      obj.parent_phase = '';
      obj.game_type = 'friendly';
      obj.title_name = 'Varsity Bowl';
      obj.nickname = 'Varsity Bowl';
    }
  });
  fs.writeFileSync(p, newRows.join('\n') + '\n');
  console.log(`Updated ${p}`);
}

// 6. games2018.csv:
// - Gladiators note: 37-14
// - Varsity Bowl: no phase, friendly
{
  const p = 'data/BUAFL/games2018.csv';
  const { newRows } = updateCSV(p, obj => {
    if (obj.home_team === 'Oxford Lancers' && obj.away_team === 'Gloucestershire Gladiators') {
      if (!obj.notes.includes('Oxford Lancers historic database')) {
        obj.notes = (obj.notes ? obj.notes + ' ' : '') + '[Oxford Lancers historic database records score as 37-14]';
      }
    }
    if (obj.phase === 'Varsity Bowl' || (obj.away_team === 'Cambridge Pythons' && obj.home_team === 'Oxford Lancers')) {
      obj.phase = '';
      obj.parent_phase = '';
      obj.game_type = 'friendly';
      obj.title_name = 'Varsity Bowl';
      obj.nickname = 'Varsity Bowl';
    }
  });
  fs.writeFileSync(p, newRows.join('\n') + '\n');
  console.log(`Updated ${p}`);
}

// 7. games2024.csv:
// - Hertfordshire note: 36-6
// - Varsity Bowl: no phase, friendly
{
  const p = 'data/BUAFL/games2024.csv';
  const { newRows } = updateCSV(p, obj => {
    if (obj.home_team === 'Oxford Lancers' && obj.away_team === 'Hertfordshire Hurricanes') {
      if (!obj.notes.includes('Oxford Lancers historic database')) {
        obj.notes = (obj.notes ? obj.notes + ' ' : '') + '[Oxford Lancers historic database records score as 36-6]';
      }
    }
    if (obj.phase === 'Varsity Bowl' || (obj.away_team === 'Cambridge Pythons' && obj.home_team === 'Oxford Lancers')) {
      obj.phase = '';
      obj.parent_phase = '';
      obj.game_type = 'friendly';
      obj.title_name = 'Varsity Bowl';
      obj.nickname = 'Varsity Bowl';
    }
  });
  fs.writeFileSync(p, newRows.join('\n') + '\n');
  console.log(`Updated ${p}`);
}

// 8. games2025.csv:
// - Hertfordshire note: 7-35
// - Varsity Bowl: no phase, friendly
{
  const p = 'data/BUAFL/games2025.csv';
  const { newRows } = updateCSV(p, obj => {
    if (obj.away_team === 'Oxford Lancers' && obj.home_team === 'Hertfordshire Hurricanes') {
      if (!obj.notes.includes('Oxford Lancers historic database')) {
        obj.notes = (obj.notes ? obj.notes + ' ' : '') + '[Oxford Lancers historic database records score as 7-35]';
      }
    }
    if (obj.phase === 'Varsity Bowl' || (obj.away_team === 'Cambridge Pythons' && obj.home_team === 'Oxford Lancers')) {
      obj.phase = '';
      obj.parent_phase = '';
      obj.game_type = 'friendly';
      obj.title_name = 'Varsity Bowl';
      obj.nickname = 'Varsity Bowl';
    }
  });
  fs.writeFileSync(p, newRows.join('\n') + '\n');
  console.log(`Updated ${p}`);
}

// 9. Update Varsity Bowl in remaining years: 2015, 2016, 2019, 2020, 2021, 2022, 2023
for (const y of [2015, 2016, 2019, 2020, 2021, 2022, 2023]) {
  const p = `data/BUAFL/games${y}.csv`;
  const { newRows } = updateCSV(p, obj => {
    if (obj.phase === 'Varsity Bowl' || (obj.away_team === 'Cambridge Pythons' && obj.home_team === 'Oxford Lancers')) {
      obj.phase = '';
      obj.parent_phase = '';
      obj.game_type = 'friendly';
      obj.title_name = 'Varsity Bowl';
      obj.nickname = 'Varsity Bowl';
    }
  });
  fs.writeFileSync(p, newRows.join('\n') + '\n');
  console.log(`Updated ${p} (Varsity Bowl unphased friendly)`);
}
