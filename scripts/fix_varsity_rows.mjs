import fs from 'fs';

function buildRow(header, values) {
  const row = new Array(header.length).fill('');
  for (const [k, v] of Object.entries(values)) {
    const idx = header.indexOf(k);
    if (idx !== -1) {
      row[idx] = v;
    } else {
      console.warn(`Column "${k}" not found in header!`);
    }
  }
  return row.map(val => {
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }).join(',');
}

const additions = [
  {
    year: 2012,
    values: {
      competition: 'BUAFL',
      year: '2012',
      phase: 'Varsity Bowl',
      parent_phase: 'Varsity Fixtures',
      away_team: 'Cambridge Pythons',
      home_team: 'Oxford Lancers',
      away_score: '20',
      home_score: '13',
      date: '',
      date_precision: 'season',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      is_double_header: 'FALSE',
      game_type: 'league',
      notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database'
    }
  },
  {
    year: 2013,
    values: {
      competition: 'BUAFL',
      year: '2013',
      phase: 'Varsity Bowl',
      parent_phase: 'Varsity Fixtures',
      away_team: 'Cambridge Pythons',
      home_team: 'Oxford Lancers',
      away_score: '33',
      home_score: '6',
      date: '',
      date_precision: 'season',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      is_double_header: 'FALSE',
      notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database'
    }
  },
  {
    year: 2015,
    values: {
      competition: 'BUAFL',
      year: '2015',
      phase: 'Varsity Bowl',
      parent_phase: 'Varsity Fixtures',
      away_team: 'Cambridge Pythons',
      home_team: 'Oxford Lancers',
      away_score: '0',
      home_score: '49',
      date: '',
      date_precision: 'season',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      is_double_header: 'FALSE',
      notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database'
    }
  },
  {
    year: 2016,
    values: {
      competition: 'BUAFL',
      year: '2016',
      phase: 'Varsity Bowl',
      parent_phase: 'Varsity Fixtures',
      away_team: 'Cambridge Pythons',
      home_team: 'Oxford Lancers',
      away_score: '20',
      home_score: '14',
      date: '',
      date_precision: 'season',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      is_double_header: 'FALSE',
      notes: 'Varsity Bowl / Cavalier Cup (Double OT). Source: Oxford Lancers historic database'
    }
  },
  {
    year: 2017,
    values: {
      competition: 'BUAFL',
      year: '2017',
      phase: 'Varsity Bowl',
      parent_phase: 'Varsity Fixtures',
      away_team: 'Cambridge Pythons',
      home_team: 'Oxford Lancers',
      away_score: '6',
      home_score: '48',
      date: '',
      date_precision: 'season',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      is_double_header: 'FALSE',
      notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database'
    }
  },
  {
    year: 2018,
    values: {
      competition: 'BUAFL',
      year: '2018',
      phase: 'Varsity Bowl',
      parent_phase: 'Varsity Fixtures',
      away_team: 'Cambridge Pythons',
      home_team: 'Oxford Lancers',
      away_score: '9',
      home_score: '19',
      date: '',
      date_precision: 'season',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      is_double_header: 'FALSE',
      notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database'
    }
  },
  {
    year: 2019,
    values: {
      competition: 'BUAFL',
      year: '2019',
      phase: 'Varsity Bowl',
      parent_phase: 'Varsity Fixtures',
      away_team: 'Cambridge Pythons',
      home_team: 'Oxford Lancers',
      away_score: '0',
      home_score: '0',
      date: '',
      date_precision: 'season',
      status: 'cancelled',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      is_double_header: 'FALSE',
      notes: 'Varsity Bowl / Cavalier Cup (Cancelled due to COVID-19). Source: Oxford Lancers historic database'
    }
  },
  {
    year: 2020,
    values: {
      competition: 'BUAFL',
      year: '2020',
      phase: 'Varsity Bowl',
      parent_phase: 'Varsity Fixtures',
      away_team: 'Cambridge Pythons',
      home_team: 'Oxford Lancers',
      away_score: '0',
      home_score: '36',
      date: '',
      date_precision: 'season',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      is_double_header: 'FALSE',
      notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database'
    }
  },
  {
    year: 2021,
    values: {
      competition: 'BUAFL',
      year: '2021',
      phase: 'Varsity Bowl',
      parent_phase: 'Varsity Fixtures',
      away_team: 'Cambridge Pythons',
      home_team: 'Oxford Lancers',
      away_score: '14',
      home_score: '12',
      date: '',
      date_precision: 'season',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      is_double_header: 'FALSE',
      notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database'
    }
  },
  {
    year: 2022,
    values: {
      competition: 'BUAFL',
      year: '2022',
      phase: 'Varsity Bowl',
      parent_phase: 'Varsity Fixtures',
      away_team: 'Cambridge Pythons',
      home_team: 'Oxford Lancers',
      away_score: '7',
      home_score: '41',
      date: '2023-05-13',
      date_display: '13/05/2023',
      date_precision: 'day',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      is_double_header: 'FALSE',
      notes: 'Varsity Bowl / Cavalier Cup (Varsity Bowl XVI). Source: Oxford Lancers historic database'
    }
  },
  {
    year: 2023,
    values: {
      competition: 'BUAFL',
      year: '2023',
      phase: 'Varsity Bowl',
      parent_phase: 'Varsity Fixtures',
      away_team: 'Cambridge Pythons',
      home_team: 'Oxford Lancers',
      away_score: '3',
      home_score: '48',
      date: '2024-05-12',
      date_display: '12/05/2024',
      date_precision: 'day',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      is_double_header: 'FALSE',
      notes: 'Varsity Bowl / Cavalier Cup (Varsity Bowl XVII). Source: Oxford Lancers historic database'
    }
  },
  {
    year: 2024,
    values: {
      competition: 'BUAFL',
      year: '2024',
      phase: 'Varsity Bowl',
      parent_phase: 'Varsity Fixtures',
      away_team: 'Cambridge Pythons',
      home_team: 'Oxford Lancers',
      away_score: '0',
      home_score: '48',
      date: '2025-05-11',
      date_display: '11/05/2025',
      date_precision: 'day',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      is_double_header: 'FALSE',
      notes: 'Varsity Bowl / Cavalier Cup (Varsity Bowl XVIII). Source: Oxford Lancers historic database'
    }
  },
  {
    year: 2025,
    values: {
      competition: 'BUAFL',
      year: '2025',
      phase: 'Varsity Bowl',
      parent_phase: 'Varsity Fixtures',
      away_team: 'Cambridge Pythons',
      home_team: 'Oxford Lancers',
      away_score: '26',
      home_score: '12',
      date: '',
      date_precision: 'season',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      is_double_header: 'FALSE',
      notes: 'Varsity Bowl / Cavalier Cup (Varsity Bowl XIX). Source: Oxford Lancers historic database'
    }
  }
];

for (const add of additions) {
  const p = `data/BUAFL/games${add.year}.csv`;
  let content = fs.readFileSync(p, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const header = lines[0].split(',');
  
  // Remove existing Varsity Bowl line if present
  const filtered = lines.filter((l, idx) => idx === 0 || !l.includes('Varsity Bowl'));
  
  const newRow = buildRow(header, add.values);
  filtered.push(newRow);
  
  fs.writeFileSync(p, filtered.join('\n') + '\n');
  console.log(`Updated ${p}`);
}
