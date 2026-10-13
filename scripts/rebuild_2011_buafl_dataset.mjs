import fs from 'fs';
import { parse } from 'csv-parse/sync';

// Canonical team mappings
const CANONICAL_MAP = {
  'Brighton Panthers': 'Brighton Tsunami',
  'Anglia Ruskin Phantoms': 'Anglia Ruskin Siege',
  'Anglia Ruskin Rhinos': 'Anglia Ruskin Siege',
  'Royal Holloway Vikings': 'Royal Holloway Bears',
  'Napier Mavericks': 'Edinburgh Napier Knights',
  'GCU Roughriders': 'Caledonian Roughriders',
  'Loughborough Students': 'Loughborough Aces',
  'Liverpool Fury': 'LJMU Fury',
  'UH Sharks': 'Hull Sharks',
  'Leeds Celtics': 'Leeds Gryphons',
  'OBU Panthers': 'Oxford Brookes University',
  'Hallam Warriors': 'Sheffield Hallam Warriors',
  'NTU Renegades': 'Nottingham Trent Renegades',
  'Bangor MudDogs': 'Bangor MudDogs'
};

function canonicalTeam(name) {
  if (!name) return name;
  const trimmed = name.trim();
  return CANONICAL_MAP[trimmed] || trimmed;
}

function toCsv(rows, headers) {
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escapeCell(row[h])).join(','));
  }
  return lines.join('\n') + '\n';
}

function rebuildDataset() {
  console.log('Rebuilding 2011 BUAFL dataset...');

  // 1. Load verified coaches for 2011 from data/evidence/verified_coaches.json
  const verifiedCoachesRaw = JSON.parse(fs.readFileSync('data/evidence/verified_coaches.json', 'utf-8'));
  const verifiedCoaches2011 = {};
  for (const vc of verifiedCoachesRaw) {
    if (parseInt(vc.year) === 2011) {
      verifiedCoaches2011[vc.team] = vc.head_coach;
    }
  }
  console.log('Verified coaches for 2011:', verifiedCoaches2011);

  // 2. Phases
  const phaseHeaders = ['competition_name', 'year', 'phase_name', 'parent_phase', 'type', 'ordinal'];
  const phases = [
    { competition_name: 'BUAFL', year: '2011', phase_name: 'Playoffs', parent_phase: '', type: 'Playoffs', ordinal: '1' },
    { competition_name: 'BUAFL', year: '2011', phase_name: 'National Championship', parent_phase: 'Playoffs', type: 'Playoffs', ordinal: '2' },
    { competition_name: 'BUAFL', year: '2011', phase_name: 'National Trophy', parent_phase: 'Playoffs', type: 'Playoffs', ordinal: '3' },
    { competition_name: 'BUAFL', year: '2011', phase_name: 'Midlands', parent_phase: '', type: 'Division', ordinal: '4' },
    { competition_name: 'BUAFL', year: '2011', phase_name: 'North Eastern', parent_phase: '', type: 'Division', ordinal: '5' },
    { competition_name: 'BUAFL', year: '2011', phase_name: 'North Western', parent_phase: '', type: 'Division', ordinal: '6' },
    { competition_name: 'BUAFL', year: '2011', phase_name: 'Scottish', parent_phase: '', type: 'Division', ordinal: '7' },
    { competition_name: 'BUAFL', year: '2011', phase_name: 'South Eastern 1A', parent_phase: '', type: 'Division', ordinal: '8' },
    { competition_name: 'BUAFL', year: '2011', phase_name: 'South Eastern 1B', parent_phase: '', type: 'Division', ordinal: '9' },
    { competition_name: 'BUAFL', year: '2011', phase_name: 'South Western', parent_phase: '', type: 'Division', ordinal: '10' }
  ];
  fs.writeFileSync('data/BUAFL/phases2011.csv', toCsv(phases, phaseHeaders));
  console.log('Wrote data/BUAFL/phases2011.csv');

  // 3. Load authoritative standings to get team-division mappings
  const rawStandings = fs.readFileSync('data/BUAFL/standings2011.csv', 'utf-8');
  const existingStandings = parse(rawStandings, { columns: true, skip_empty_lines: true });
  const teamPhaseMap = {};
  for (const s of existingStandings) {
    const t = canonicalTeam(s.team);
    teamPhaseMap[t] = s.phase.trim();
  }

  // 4. Clean Regular Season Games
  const rawGames = fs.readFileSync('data/BUAFL/games2011.csv', 'utf-8');
  const existingGames = parse(rawGames, { columns: true, skip_empty_lines: true });

  const gameHeaders = [
    'competition', 'year', 'phase', 'date', 'away_team', 'home_team',
    'away_score', 'home_score', 'venue', 'notes', 'away_coach', 'home_coach',
    'is_double_header', 'date_precision', 'date_display', 'time', 'status',
    'confidence_level', 'is_playoff', 'is_title_game', 'final_type',
    'title_name', 'playoff_round', 'parent_phase', 'away_phase', 'away_parent_phase'
  ];

  const cleanedGames = [];

  for (const g of existingGames) {
    // Skip any previously appended playoff games
    if (g.is_playoff === 'TRUE' || (g.phase || '').toLowerCase().includes('playoff') || (g.phase || '').toLowerCase().includes('national')) {
      continue;
    }

    const awayTeam = canonicalTeam(g.away_team);
    const homeTeam = canonicalTeam(g.home_team);

    // Skip NTU vs Coventry (verified Week 1 of 2012/13 season)
    if (awayTeam === 'Nottingham Trent Renegades' && homeTeam === 'Coventry University Jets') {
      continue;
    }

    let date = (g.date || '').trim();
    let datePrecision = (g.date_precision || 'day').trim();
    let dateDisplay = (g.date_display || '').trim();
    let notes = (g.notes || '').trim();
    let time = (g.time || '').trim();

    const isBucs = notes.toLowerCase().includes('bucs') || notes === '';
    const isBrightonGame = awayTeam === 'Brighton Tsunami' || homeTeam === 'Brighton Tsunami';
    const isNottinghamGoldGame = awayTeam === 'Nottingham Gold' || homeTeam === 'Nottingham Gold';

    if (isBucs && !isBrightonGame && !isNottinghamGoldGame) {
      if (date === '2012-04-11' || date === '2012-08-12' || date === '2012-01-12') {
        date = '';
        datePrecision = 'season';
        dateDisplay = '';
        time = '';
        if (notes.includes('Void')) {
          notes = 'Source: BUCS contemporary records (Void; exact date unconfirmed)';
        } else {
          notes = 'Source: BUCS contemporary records (Exact date unconfirmed)';
        }
      } else {
        datePrecision = 'day';
        if (date && !dateDisplay) {
          const [y, m, d] = date.split('-');
          dateDisplay = `${d}/${m}/${y}`;
        }
        if (!time) time = '13:00';
        if (notes.includes('Void')) {
          notes = 'Source: BUCS contemporary records (Void)';
        } else {
          notes = 'Source: BUCS contemporary records';
        }
      }
    } else if (isBrightonGame) {
      datePrecision = 'day';
      if (date && !dateDisplay) {
        const [y, m, d] = date.split('-');
        dateDisplay = `${d}/${m}/${y}`;
      }
      if (!time) time = '13:00';
      if (notes.includes('Overtime')) {
        notes = 'Source: Brighton Tsunami historical records (Quadruple Overtime. 6-6 at the end of regulation.)';
      } else {
        notes = 'Source: Brighton Tsunami historical records';
      }
    } else if (isNottinghamGoldGame) {
      datePrecision = 'day';
      if (date && !dateDisplay) {
        const [y, m, d] = date.split('-');
        dateDisplay = `${d}/${m}/${y}`;
      }
      if (!time) time = '13:00';
      notes = 'Source: Nottingham Outlaws contemporary records (https://nottinghamunioutlaws.wordpress.com/11-12-season/)';
    }

    // Inter-phase alignment
    let phase = g.phase;
    let awayPhase = g.away_phase || '';
    if (teamPhaseMap[homeTeam]) {
      phase = teamPhaseMap[homeTeam];
    }
    if (teamPhaseMap[awayTeam] && teamPhaseMap[awayTeam] !== phase) {
      awayPhase = teamPhaseMap[awayTeam];
    } else {
      awayPhase = '';
    }

    cleanedGames.push({
      competition: 'BUAFL',
      year: '2011',
      phase: phase,
      date: date,
      away_team: awayTeam,
      home_team: homeTeam,
      away_score: g.away_score,
      home_score: g.home_score,
      venue: g.venue || '',
      notes: notes,
      away_coach: verifiedCoaches2011[awayTeam] || '',
      home_coach: verifiedCoaches2011[homeTeam] || '',
      is_double_header: g.is_double_header || 'FALSE',
      date_precision: datePrecision,
      date_display: dateDisplay,
      time: time,
      status: g.status || 'completed',
      confidence_level: g.confidence_level || 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: '',
      playoff_round: '',
      parent_phase: '',
      away_phase: awayPhase,
      away_parent_phase: ''
    });
  }

  // Load and merge Double Coverage regular season games (data/evidence/dblcoverage_2011_games.json)
  const dblGamesRaw = JSON.parse(fs.readFileSync('data/evidence/dblcoverage_2011_games.json', 'utf-8'));
  console.log(`Loaded ${dblGamesRaw.length} Double Coverage games from evidence...`);

  for (const dg of dblGamesRaw) {
    const awayTeam = canonicalTeam(dg.away_team);
    const homeTeam = canonicalTeam(dg.home_team);

    // Check if this game is already in cleanedGames (by date and teams, or by teams if existing was placeholder)
    const existingIndex = cleanedGames.findIndex(cg => {
      const matchExact = (cg.away_team === awayTeam && cg.home_team === homeTeam && cg.date === dg.date) ||
                         (cg.away_team === homeTeam && cg.home_team === awayTeam && cg.date === dg.date);
      if (matchExact) return true;

      // Also match if existing has placeholder date (2012-02-12 or empty) and same teams & score
      const sameTeams = (cg.away_team === awayTeam && cg.home_team === homeTeam) ||
                        (cg.away_team === homeTeam && cg.home_team === awayTeam);
      const isPlaceholder = !cg.date || cg.date === '2012-02-12';
      const sameScore = (cg.away_score === dg.away_score && cg.home_score === dg.home_score) ||
                        (cg.away_score === dg.home_score && cg.home_score === dg.away_score);
      return sameTeams && isPlaceholder && sameScore;
    });

    const phase = teamPhaseMap[homeTeam] || dg.phase;
    const awayPhase = (teamPhaseMap[awayTeam] && teamPhaseMap[awayTeam] !== phase) ? teamPhaseMap[awayTeam] : '';

    const newGameObj = {
      competition: 'BUAFL',
      year: '2011',
      phase: phase,
      date: dg.date,
      away_team: awayTeam,
      home_team: homeTeam,
      away_score: String(dg.away_score),
      home_score: String(dg.home_score),
      venue: '',
      notes: dg.notes,
      away_coach: verifiedCoaches2011[awayTeam] || '',
      home_coach: verifiedCoaches2011[homeTeam] || '',
      is_double_header: 'FALSE',
      date_precision: 'day',
      date_display: dg.date_display,
      time: dg.time || '13:00',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: '',
      playoff_round: '',
      parent_phase: '',
      away_phase: awayPhase,
      away_parent_phase: ''
    };

    if (existingIndex >= 0) {
      // If existing game was from BUCS with placeholder date, upgrade with Double Coverage date/source
      const existing = cleanedGames[existingIndex];
      const isBrightonOrNottingham = existing.notes.includes('Brighton') || existing.notes.includes('Nottingham');
      if (!isBrightonOrNottingham) {
        cleanedGames[existingIndex] = newGameObj;
      }
    } else {
      cleanedGames.push(newGameObj);
    }
  }

  // Deduplicate any exact duplicate games by (date, away_team, home_team)
  const uniqueCleanedGames = [];
  const seenGameKeys = new Set();
  for (const cg of cleanedGames) {
    const key = `${cg.date}|${cg.away_team}|${cg.home_team}`;
    if (!seenGameKeys.has(key)) {
      seenGameKeys.add(key);
      uniqueCleanedGames.push(cg);
    }
  }
  cleanedGames.length = 0;
  cleanedGames.push(...uniqueCleanedGames);


  // 5. Add All 22 Postseason Playoff Games
  const playoffGames = [
    // --- National Championship: First Round (04/03/2012) ---
    {
      phase: 'National Championship',
      date: '2012-03-04',
      date_display: '04/03/2012',
      time: '13:00',
      away_team: 'Hull Sharks',
      home_team: 'Sheffield Hallam Warriors',
      away_score: '6',
      home_score: '46',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'First Round',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },
    {
      phase: 'National Championship',
      date: '2012-03-04',
      date_display: '04/03/2012',
      time: '13:00',
      away_team: 'Loughborough Aces',
      home_team: 'Stirling Clansmen',
      away_score: '42',
      home_score: '6',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'First Round',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },
    {
      phase: 'National Championship',
      date: '2012-03-04',
      date_display: '04/03/2012',
      time: '13:00',
      away_team: 'Essex Blades',
      home_team: 'UWE Bullets',
      away_score: '6',
      home_score: '31',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'First Round',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },
    {
      phase: 'National Championship',
      date: '2012-03-04',
      date_display: '04/03/2012',
      time: '13:00',
      away_team: 'Cardiff Cobras',
      home_team: 'Oxford Brookes University',
      away_score: '16',
      home_score: '7',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'First Round',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },

    // --- National Championship: Quarter Finals (11/03/2012) ---
    {
      phase: 'National Championship',
      date: '2012-03-11',
      date_display: '11/03/2012',
      time: '13:00',
      away_team: 'Loughborough Aces',
      home_team: 'Newcastle Raiders',
      away_score: '21',
      home_score: '8',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'Quarter Final',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },
    {
      phase: 'National Championship',
      date: '2012-03-11',
      date_display: '11/03/2012',
      time: '13:00',
      away_team: 'Sheffield Hallam Warriors',
      home_team: 'Birmingham Lions',
      away_score: '8',
      home_score: '47',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'Quarter Final',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },
    {
      phase: 'National Championship',
      date: '2012-03-11',
      date_display: '11/03/2012',
      time: '13:00',
      away_team: 'Cardiff Cobras',
      home_team: 'Hertfordshire Hurricanes',
      away_score: '0',
      home_score: '63',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'Quarter Final',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },
    {
      phase: 'National Championship',
      date: '2012-03-11',
      date_display: '11/03/2012',
      time: '13:00',
      away_team: 'UWE Bullets',
      home_team: 'Southampton Stags',
      away_score: '15',
      home_score: '23',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'Quarter Final',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },

    // --- National Championship: Semi Finals (18/03/2012) ---
    {
      phase: 'National Championship',
      date: '2012-03-18',
      date_display: '18/03/2012',
      time: '13:00',
      away_team: 'Southampton Stags',
      home_team: 'Birmingham Lions',
      away_score: '16',
      home_score: '46',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'Semi Final',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },
    {
      phase: 'National Championship',
      date: '2012-03-18',
      date_display: '18/03/2012',
      time: '13:00',
      away_team: 'Loughborough Aces',
      home_team: 'Hertfordshire Hurricanes',
      away_score: '13',
      home_score: '24',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'Semi Final',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },

    // --- National Championship: Final / College Bowl XXVI (25/03/2012) ---
    {
      phase: 'National Championship',
      date: '2012-03-25',
      date_display: '25/03/2012',
      time: '16:00',
      away_team: 'Hertfordshire Hurricanes',
      home_team: 'Birmingham Lions',
      away_score: '37',
      home_score: '19',
      venue: 'John Charles Centre',
      notes: 'Source: BAFRA contemporary records & https://en.wikipedia.org/wiki/British_Universities_American_Football_League',
      playoff_round: 'Final',
      is_title_game: 'TRUE',
      final_type: 'title',
      title_name: 'College Bowl XXVI'
    },

    // --- National Trophy: First Round (04/03/2012) ---
    {
      phase: 'National Trophy',
      date: '2012-03-04',
      date_display: '04/03/2012',
      time: '13:00',
      away_team: 'Nottingham Trent Renegades',
      home_team: 'Northampton Nemesis',
      away_score: '34',
      home_score: '0',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'First Round',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },
    {
      phase: 'National Trophy',
      date: '2012-03-04',
      date_display: '04/03/2012',
      time: '13:00',
      away_team: 'Edinburgh Predators',
      home_team: 'Leeds Gryphons',
      away_score: '30',
      home_score: '22',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'First Round',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },
    {
      phase: 'National Trophy',
      date: '2012-03-04',
      date_display: '04/03/2012',
      time: '13:00',
      away_team: 'Kent Falcons',
      home_team: 'UEA Pirates',
      away_score: '13',
      home_score: '28',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'First Round',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },
    {
      phase: 'National Trophy',
      date: '2012-03-04',
      date_display: '04/03/2012',
      time: '13:00',
      away_team: 'Bath Killer Bees',
      home_team: 'Portsmouth Destroyers',
      away_score: '27',
      home_score: '6',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'First Round',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },

    // --- National Trophy: Quarter Finals (11/03/2012) ---
    {
      phase: 'National Trophy',
      date: '2012-03-11',
      date_display: '11/03/2012',
      time: '13:00',
      away_team: 'Edinburgh Predators',
      home_team: 'Sheffield Sabres',
      away_score: '0',
      home_score: '10',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'Quarter Final',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },
    {
      phase: 'National Trophy',
      date: '2012-03-11',
      date_display: '11/03/2012',
      time: '13:00',
      away_team: 'Nottingham Trent Renegades',
      home_team: 'Northumbria Mustangs',
      away_score: '46',
      home_score: '22',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'Quarter Final',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },
    {
      phase: 'National Trophy',
      date: '2012-03-11',
      date_display: '11/03/2012',
      time: '13:00',
      away_team: 'Bath Killer Bees',
      home_team: 'Plymouth Blitz',
      away_score: '14',
      home_score: '12',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'Quarter Final',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },
    {
      phase: 'National Trophy',
      date: '2012-03-11',
      date_display: '11/03/2012',
      time: '13:00',
      away_team: 'UEA Pirates',
      home_team: 'Solent Redhawks',
      away_score: '33',
      home_score: '23',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'Quarter Final',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },

    // --- National Trophy: Semi Finals (18/03/2012) ---
    {
      phase: 'National Trophy',
      date: '2012-03-18',
      date_display: '18/03/2012',
      time: '13:00',
      away_team: 'UEA Pirates',
      home_team: 'Sheffield Sabres',
      away_score: '16',
      home_score: '34',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'Semi Final',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },
    {
      phase: 'National Trophy',
      date: '2012-03-18',
      date_display: '18/03/2012',
      time: '13:00',
      away_team: 'Nottingham Trent Renegades',
      home_team: 'Bath Killer Bees',
      away_score: '21',
      home_score: '23',
      venue: '',
      notes: 'Source: BAFRA contemporary records',
      playoff_round: 'Semi Final',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: ''
    },

    // --- National Trophy: Final / National Trophy (25/03/2012) ---
    {
      phase: 'National Trophy',
      date: '2012-03-25',
      date_display: '25/03/2012',
      time: '12:00',
      away_team: 'Bath Killer Bees',
      home_team: 'Sheffield Sabres',
      away_score: '8',
      home_score: '25',
      venue: 'John Charles Centre',
      notes: 'Source: BAFRA contemporary records & https://en.wikipedia.org/wiki/British_Universities_American_Football_League',
      playoff_round: 'Final',
      is_title_game: 'TRUE',
      final_type: 'bowl',
      title_name: 'National Trophy'
    }
  ];

  for (const pg of playoffGames) {
    const awayTeam = canonicalTeam(pg.away_team);
    const homeTeam = canonicalTeam(pg.home_team);

    cleanedGames.push({
      competition: 'BUAFL',
      year: '2011',
      phase: pg.phase,
      date: pg.date,
      away_team: awayTeam,
      home_team: homeTeam,
      away_score: pg.away_score,
      home_score: pg.home_score,
      venue: pg.venue,
      notes: pg.notes,
      away_coach: verifiedCoaches2011[awayTeam] || '',
      home_coach: verifiedCoaches2011[homeTeam] || '',
      is_double_header: 'FALSE',
      date_precision: 'day',
      date_display: pg.date_display,
      time: pg.time,
      status: 'completed',
      confidence_level: 'high',
      is_playoff: 'TRUE',
      is_title_game: pg.is_title_game,
      final_type: pg.final_type,
      title_name: pg.title_name,
      playoff_round: pg.playoff_round,
      parent_phase: 'Playoffs',
      away_phase: '',
      away_parent_phase: ''
    });
  }

  fs.writeFileSync('data/BUAFL/games2011.csv', toCsv(cleanedGames, gameHeaders));
  console.log(`Wrote data/BUAFL/games2011.csv with ${cleanedGames.length} games (${cleanedGames.length - 22} regular season, 22 playoffs).`);

  // 6. Validate & Write Standings
  const standingsHeaders = [
    'competition_name', 'parent_phase', 'phase', 'year', 'team',
    'position', 'games_played', 'wins', 'losses', 'ties', 'points_for',
    'points_against', 'streak', 'is_champion', 'notes', 'head_coach'
  ];

  const standingsRows = existingStandings.map(s => {
    const t = canonicalTeam(s.team);
    let notes = (s.notes || '').trim();
    if (notes.includes('.xlsx')) {
      notes = 'Source: BAFRA contemporary records';
    }
    return {
      competition_name: 'BUAFL',
      parent_phase: '',
      phase: s.phase.trim(),
      year: '2011',
      team: t,
      position: s.position.trim(),
      games_played: s.games_played.trim(),
      wins: s.wins.trim(),
      losses: s.losses.trim(),
      ties: s.ties.trim(),
      points_for: s.points_for.trim(),
      points_against: s.points_against.trim(),
      streak: (s.streak || '').trim(),
      is_champion: (s.is_champion || '').toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE',
      notes: notes,
      head_coach: verifiedCoaches2011[t] || ''
    };
  });

  fs.writeFileSync('data/BUAFL/standings2011.csv', toCsv(standingsRows, standingsHeaders));
  console.log(`Wrote data/BUAFL/standings2011.csv with ${standingsRows.length} team standings.`);
}

rebuildDataset();
