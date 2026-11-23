import fs from 'fs';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const csvOnly = process.argv.includes('--csv-only');
const dbOnly = process.argv.includes('--db-only');
const runCsv = !dbOnly;
const runDb = !csvOnly;

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
    const s = String(val === null || val === undefined ? '' : val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }).join(',');
}

function readCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = parseCSVLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(l => {
    const vals = parseCSVLine(l);
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = vals[i] !== undefined ? vals[i] : '';
    });
    return obj;
  });
  return { header, rows };
}

function writeCSV(filePath, header, rows) {
  const out = [serializeCSVRow(header)];
  for (const r of rows) {
    out.push(serializeCSVRow(header.map(h => r[h] !== undefined ? r[h] : '')));
  }
  fs.writeFileSync(filePath, out.join('\n') + '\n');
}

function appendNote(existing, addition) {
  const cur = (existing || '').trim();
  if (cur.includes(addition)) return cur;
  return cur ? `${cur} ${addition}` : addition;
}

function applyCsvUpdates() {
  console.log('=== Step 1: Register Adrian Giles in data/evidence/verified_coaches.json ===');
  const evidencePath = 'data/evidence/verified_coaches.json';
  const evidenceList = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));

  const newCoachRecords = [
    {
      team: 'Nottingham Trent Renegades',
      year: 2011,
      head_coach: 'Adrian Giles',
      source: 'https://nturenegades.wordpress.com/2016/08/19/coaches-corner-offensive-coordinator-scott-messom/',
      source_details: 'OC Scott Messom interview states he was "convinced at the start of the 2011 season to return as Offensive Coordinator at the Renegades by good friend and Head Coach Adrian Giles".'
    },
    {
      team: 'Nottingham Trent Renegades',
      year: 2015,
      head_coach: 'Adrian Giles',
      source: 'https://nturenegades.wordpress.com/2016/03/04/renegades-squeak-past-leeds-beckett-carnegie-in-playoff-opener/',
      source_details: 'Contemporaneous 2015/16 playoff recap quotes "head coach Adi Giles" (also confirmed by 2016-03-18 Swansea preview and 2016-08-10 Coaches Corner profile).'
    },
    {
      team: 'Nottingham Trent Renegades',
      year: 2016,
      head_coach: 'Adrian Giles',
      source: 'https://nturenegades.wordpress.com/2016/08/10/coaches-corner-head-coach-adrian-giles/',
      source_details: '2016/17 preseason Coaches Corner interview profiling Head Coach Adrian Giles.'
    }
  ];

  for (const rec of newCoachRecords) {
    const exists = evidenceList.some(
      e => e.team === rec.team && Number(e.year) === rec.year && e.head_coach === rec.head_coach
    );
    if (!exists) {
      evidenceList.push(rec);
      console.log(`Added verified coach: ${rec.head_coach} (${rec.team}, ${rec.year})`);
    }
  }
  fs.writeFileSync(evidencePath, JSON.stringify(evidenceList, null, 2) + '\n');

  console.log('\n=== Step 2: Update Standings 2011, 2015, 2016 ===');
  for (const yr of [2011, 2015, 2016]) {
    const sPath = `data/BUAFL/standings${yr}.csv`;
    const { header, rows } = readCSV(sPath);
    let updated = 0;
    for (const r of rows) {
      if (r.team === 'Nottingham Trent Renegades' && r.head_coach !== 'Adrian Giles') {
        r.head_coach = 'Adrian Giles';
        updated++;
      }
    }
    writeCSV(sPath, header, rows);
    console.log(`Updated ${sPath}: ${updated} row(s)`);
  }

  console.log('\n=== Step 3: Update Games & Playoffs CSVs ===');
  // 3a. 2011 games: populate Adrian Giles coach
  {
    const gPath = 'data/BUAFL/games2011.csv';
    const { header, rows } = readCSV(gPath);
    let cnt = 0;
    for (const r of rows) {
      if (r.away_team === 'Nottingham Trent Renegades') { r.away_coach = 'Adrian Giles'; cnt++; }
      if (r.home_team === 'Nottingham Trent Renegades') { r.home_coach = 'Adrian Giles'; cnt++; }
    }
    writeCSV(gPath, header, rows);
    console.log(`Updated ${gPath}: set Adrian Giles on ${cnt} slot(s)`);
  }

  // 3b. 2012 games: add missing 2012-13 Varsity (NTU 28 - 0 Nottingham Gold)
  {
    const gPath = 'data/BUAFL/games2012.csv';
    const { header, rows } = readCSV(gPath);
    const hasVarsity12 = rows.some(
      r => r.game_type === 'friendly' &&
        ((r.home_team === 'Nottingham Trent Renegades' && r.away_team === 'Nottingham Gold') ||
         (r.away_team === 'Nottingham Trent Renegades' && r.home_team === 'Nottingham Gold'))
    );
    if (!hasVarsity12) {
      rows.push({
        competition: 'BUAFL',
        year: '2012',
        date: '',
        date_precision: 'season',
        date_display: '',
        phase: '',
        parent_phase: '',
        away_phase: '',
        away_parent_phase: '',
        away_team: 'Nottingham Gold',
        away_score: '0',
        home_score: '28',
        home_team: 'Nottingham Trent Renegades',
        is_playoff: 'FALSE',
        playoff_round: '',
        is_title_game: 'FALSE',
        final_type: '',
        title_name: '',
        nickname: 'Nottingham Varsity',
        is_double_header: 'FALSE',
        game_type: 'friendly',
        status: 'completed',
        confidence_level: 'high',
        venue: '',
        home_coach: 'Adrian Giles',
        away_coach: '',
        notes: 'Nottingham Varsity (exact date, venue, and designated home team unconfirmed in contemporary archives). Source: https://nturenegades.wordpress.com/2016/07/06/team-history/'
      });
      writeCSV(gPath, header, rows);
      console.log(`Added 2012-13 Nottingham Varsity (28-0) to ${gPath}`);
    } else {
      console.log(`2012-13 Nottingham Varsity already present in ${gPath}`);
    }
  }

  // 3c. 2013 games: add missing 2013-14 National Trophy Wild Card vs Exeter Demons (score unknown)
  {
    const gPath = 'data/BUAFL/games2013.csv';
    const { header, rows } = readCSV(gPath);
    const hasExeter13 = rows.some(
      r => r.is_playoff === 'TRUE' &&
        ((r.away_team === 'Exeter Demons' && r.home_team === 'Nottingham Trent Renegades') ||
         (r.home_team === 'Exeter Demons' && r.away_team === 'Nottingham Trent Renegades'))
    );
    if (!hasExeter13) {
      rows.push({
        competition: 'BUAFL',
        year: '2013',
        phase: 'Trophy Playoffs',
        date: '',
        away_team: 'Exeter Demons',
        home_team: 'Nottingham Trent Renegades',
        away_score: '',
        home_score: '',
        venue: '',
        notes: "2013/14 National Trophy playoff matchup: Exeter Demons defeated Nottingham Trent Renegades on a last-second touchdown prior to Exeter's 2014-03-16 Quarterfinal vs Leeds Met Carnegie (exact score, date, venue, and home/away unrecorded in contemporary archives). Source: https://nturenegades.wordpress.com/2016/07/06/team-history/",
        away_coach: '',
        home_coach: '',
        is_double_header: 'FALSE',
        date_precision: 'season',
        date_display: '',
        time: '',
        status: 'completed',
        confidence_level: 'high',
        is_playoff: 'TRUE',
        is_title_game: 'FALSE',
        final_type: 'playoff',
        title_name: '',
        nickname: '',
        playoff_round: 'Wild Card',
        parent_phase: 'Playoffs',
        away_phase: '',
        away_parent_phase: ''
      });
      writeCSV(gPath, header, rows);
      console.log(`Added 2013-14 NTU vs Exeter Demons playoff game to ${gPath}`);
    } else {
      console.log(`2013-14 NTU vs Exeter Demons already present in ${gPath}`);
    }
  }

  // 3d. 2015 games & playoffs2015.csv: Adrian Giles coach + 2016-04-29 Varsity + 13-9 Northern Final sync
  {
    const gPath = 'data/BUAFL/games2015.csv';
    const { header, rows } = readCSV(gPath);
    for (const r of rows) {
      if (r.away_team === 'Nottingham Trent Renegades') r.away_coach = 'Adrian Giles';
      if (r.home_team === 'Nottingham Trent Renegades') r.home_coach = 'Adrian Giles';
      if (r.date === '2016-03-13' && r.away_team === 'Nottingham Trent Renegades' && r.home_team === 'Glasgow University Tigers') {
        r.notes = appendNote(
          r.notes,
          '[NTU March 14 play-by-play recap confirms 13-9 final score; NTU May 19 season summary table lists 15-9. Source: https://nturenegades.wordpress.com/2016/03/14/ntus-last-minute-comeback-over-glasgow-earns-promotion-to-premiership/]'
        );
      }
      if (r.date === '2016-02-28' && r.away_team === 'Leeds Beckett Carnegie' && r.home_team === 'Nottingham Trent Renegades') {
        r.notes = appendNote(
          r.notes,
          '[NTU May 19 results summary and BUCS list 27-20; March 4 recap intro mentions 27-21]'
        );
      }
    }
    const hasVarsity15 = rows.some(
      r => r.date === '2016-04-29' &&
        ((r.home_team === 'Nottingham Gold' && r.away_team === 'Nottingham Trent Renegades') ||
         (r.away_team === 'Nottingham Gold' && r.home_team === 'Nottingham Trent Renegades'))
    );
    if (!hasVarsity15) {
      rows.push({
        competition: 'BUAFL',
        year: '2015',
        phase: '',
        parent_phase: '',
        away_phase: '',
        away_parent_phase: '',
        date: '2016-04-29',
        away_team: 'Nottingham Trent Renegades',
        home_team: 'Nottingham Gold',
        away_score: '7',
        home_score: '19',
        venue: 'Lady Bay Sports Ground, Nottingham',
        notes: 'Nottingham Varsity at Lady Bay Sports Ground, Nottingham (University of Nottingham won 19-7; friendly exhibition). Source: https://nturenegades.wordpress.com/2016/05/04/ntu-falls-to-the-university-of-nottingham-in-varsity/',
        away_coach: 'Adrian Giles',
        home_coach: '',
        is_double_header: 'FALSE',
        date_precision: 'day',
        date_display: '29/04/2016',
        time: '18:30',
        status: 'completed',
        confidence_level: 'high',
        is_playoff: 'FALSE',
        is_title_game: 'FALSE',
        final_type: '',
        title_name: '',
        nickname: 'Nottingham Varsity',
        playoff_round: ''
      });
      console.log(`Added 2016-04-29 Nottingham Varsity (UoN 19 - 7 NTU) to ${gPath}`);
    }
    writeCSV(gPath, header, rows);

    const pPath = 'data/BUAFL/playoffs2015.csv';
    const { header: pHdr, rows: pRows } = readCSV(pPath);
    for (const r of pRows) {
      if (r.away_team === 'Nottingham Trent Renegades') r.away_coach = 'Adrian Giles';
      if (r.home_team === 'Nottingham Trent Renegades') r.home_coach = 'Adrian Giles';
      if (r.date === '2016-03-13' && r.away_team === 'Nottingham Trent Renegades' && r.home_team === 'Glasgow University Tigers') {
        r.away_score = '13';
        r.home_score = '9';
        r.notes = appendNote(
          r.notes,
          'NTU March 14 play-by-play recap confirms 13-9 (NTU May 19 summary table listed 15-9). Source: https://nturenegades.wordpress.com/2016/03/14/ntus-last-minute-comeback-over-glasgow-earns-promotion-to-premiership/'
        );
      }
    }
    writeCSV(pPath, pHdr, pRows);
    console.log(`Updated ${pPath} (Adrian Giles + 13-9 Northern Final sync)`);
  }

  // 3e. 2016 games: Adrian Giles coach, Durham walkover/on-field note, Derby Jan 22 home/away swap, venues/times, 2017-05-13 Varsity
  {
    const gPath = 'data/BUAFL/games2016.csv';
    const { header, rows } = readCSV(gPath);
    for (const r of rows) {
      if (r.date === '2016-11-13' && r.away_team === 'Nottingham Trent Renegades' && r.home_team === 'Durham Saints') {
        r.status = 'awarded';
        r.venue = 'Sports and Wellbeing Park(Maiden Castle)';
        r.time = '13:00';
        r.notes = 'On-field result: Durham Saints 28, Nottingham Trent Renegades 23 at Maiden Castle Sports Centre (subsequently recorded as a 1-0 BUCS walkover/forfeit awarded to NTU). Source: https://dblcoverage.com/university/bucs-fixturesresults-201617/ & https://nturenegades.wordpress.com/2016/11/15/ntu-renegades-lose-back-and-forth-opener-to-durham-saints/';
      }
      if (r.date === '2016-11-27' && r.home_team === 'Nottingham Trent Renegades' && r.away_team === 'Loughborough Students') {
        r.venue = 'Clifton Sports Hub';
        r.time = '13:00';
        r.notes = appendNote(r.notes, '& https://nturenegades.wordpress.com/2016/11/29/renegades-fall-short-to-loughborough-despite-late-game-push/');
      }
      if (r.date === '2016-12-11' && r.away_team === 'Nottingham Trent Renegades' && r.home_team === 'Stirling Clansmen') {
        r.time = '12:00';
        r.notes = appendNote(r.notes, '& https://nturenegades.wordpress.com/2016/12/16/ntu-at-stirling-recap-with-video-highlights/');
      }
      if (r.date === '2017-01-22' &&
          ((r.home_team === 'Nottingham Trent Renegades' && r.away_team === 'Derby Braves') ||
           (r.away_team === 'Nottingham Trent Renegades' && r.home_team === 'Derby Braves'))) {
        r.away_team = 'Nottingham Trent Renegades';
        r.away_score = '14';
        r.home_team = 'Derby Braves';
        r.home_score = '17';
        r.away_coach = 'Adrian Giles';
        r.home_coach = '';
        r.venue = 'University of Derby, Kedleston Road';
        r.time = '13:00';
        r.notes = 'Rescheduled from 2016-11-20 postponement (lack of medical staff); played at University of Derby Kedleston Road (Double Coverage listed NTU as home from original Nov 20 schedule). Source: https://dblcoverage.com/university/bucs-fixturesresults-201617/ & https://nturenegades.wordpress.com/2017/01/20/ntu-vs-derby-game-time-and-streaming-information/';
      }
      if (r.date === '2017-01-29' && r.home_team === 'Nottingham Trent Renegades' && r.away_team === 'Stirling Clansmen') {
        r.venue = 'Clifton Sports Hub';
        r.time = '13:00';
        r.notes = appendNote(r.notes, '& https://nturenegades.wordpress.com/2017/01/27/ntu-vs-stirling-game-times-and-live-stream-information/');
      }

      if (r.away_team === 'Nottingham Trent Renegades') r.away_coach = 'Adrian Giles';
      if (r.home_team === 'Nottingham Trent Renegades') r.home_coach = 'Adrian Giles';
    }

    const hasVarsity16 = rows.some(
      r => r.date === '2017-05-13' &&
        ((r.home_team === 'Nottingham Trent Renegades' && r.away_team === 'Nottingham Gold') ||
         (r.away_team === 'Nottingham Trent Renegades' && r.home_team === 'Nottingham Gold'))
    );
    if (!hasVarsity16) {
      rows.push({
        competition: 'BUAFL',
        year: '2016',
        phase: '',
        parent_phase: '',
        away_phase: '',
        away_parent_phase: '',
        date: '2017-05-13',
        away_team: 'Nottingham Gold',
        home_team: 'Nottingham Trent Renegades',
        away_score: '12',
        home_score: '25',
        venue: 'Harvey Hadden, Nottingham',
        notes: 'Nottingham Varsity at Harvey Hadden Stadium, Nottingham (NTU Renegades won 25-12; friendly exhibition). Source: https://nturenegades.wordpress.com/2017/05/18/watch-the-entire-2017-notts-varsity-victory/',
        away_coach: '',
        home_coach: 'Adrian Giles',
        is_double_header: 'FALSE',
        date_precision: 'day',
        date_display: '13/05/2017',
        time: '18:00',
        status: 'completed',
        confidence_level: 'high',
        is_playoff: 'FALSE',
        is_title_game: 'FALSE',
        final_type: '',
        title_name: '',
        nickname: 'Nottingham Varsity',
        playoff_round: ''
      });
      console.log(`Added 2017-05-13 Nottingham Varsity (NTU 25 - 12 UoN) to ${gPath}`);
    }
    writeCSV(gPath, header, rows);
  }
}

async function applyDbUpdates() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('\n=== Step 4: Supabase Sync ===');

  const ntuId = 'b6fbbbf9-ba21-4f5f-be15-1c29f2be099d';
  const uonId = '15b29445-9f4d-46d3-ad6c-114130691493';
  const exeterId = 'dc06b6ef-a77a-407a-8e91-12097ba916a6';
  const derbyId = '559dfaea-87f1-4005-809c-e0b3ac167afd';
  const durhamId = '30b70907-4a98-4ddf-a25f-022ab292dd3c';
  const loughboroughId = '713be9b4-9f8e-4821-8176-899416254a02';
  const stirlingId = '7c4d96cf-1db6-4cdd-a911-a4a8506bf23b';
  const glasgowId = 'e73d1778-9d60-4d5a-8033-33fef5428194';
  const leedsBeckettId = '57ca4802-9f52-4931-8c83-b2bd7a3e01bd';

  const BUAFL_SEASONS = {
    2011: '60c4fa58-3675-47f9-ad47-bef29f3d0f5c',
    2012: 'd4e61940-f44a-4b9a-84e7-23d01db775be',
    2013: '80be72d5-cce5-4814-b665-922c810646f7',
    2015: 'edcf6aa4-3109-41e5-84dd-58949894d6ab',
    2016: 'ed48c77d-b45b-4aad-99a3-a5c403d9b59b'
  };

  const VENUES = {
    maidenCastle: '065561eb-0f8c-490a-ae0c-a74823cc5945',
    cliftonHub: '7bba994e-2d72-4a4a-8272-7e902b3a082f',
    derbyKedleston: '7bf36ba1-d03b-4c36-8e89-c6a6748fd1c7',
    harveyHadden: 'ce3ab083-33ad-4539-89da-b5db13d3deb5'
  };

  // Ensure Adrian Giles person exists
  let adrianId = '1b8b070c-5038-416c-830f-ac105ccb5819';
  const { data: adrianCheck } = await supabase.from('people').select('id').eq('id', adrianId).maybeSingle();
  if (!adrianCheck) throw new Error('Expected Adrian Giles person not found');

  // Ensure Lady Bay venue exists
  let ladyBayId = null;
  const { data: existingLB } = await supabase
    .from('venues')
    .select('id')
    .eq('name', 'Lady Bay Sports Ground, Nottingham')
    .maybeSingle();
  if (existingLB) {
    ladyBayId = existingLB.id;
  } else {
    const { data: insLB, error: lbErr } = await supabase
      .from('venues')
      .insert({ name: 'Lady Bay Sports Ground, Nottingham', city: 'Nottingham' })
      .select('id')
      .single();
    if (lbErr) throw lbErr;
    ladyBayId = insLB.id;
    console.log('Inserted venue Lady Bay Sports Ground, Nottingham:', ladyBayId);
  }

  // 4a. Update participations head_coach_id for 2011, 2015, 2016
  const { data: ntuParts } = await supabase
    .from('participations')
    .select('id, phases(season_id)')
    .eq('team_id', ntuId);

  const targetSeasonIds = new Set([BUAFL_SEASONS[2011], BUAFL_SEASONS[2015], BUAFL_SEASONS[2016]]);
  for (const p of ntuParts || []) {
    if (targetSeasonIds.has(p.phases?.season_id)) {
      const { error } = await supabase
        .from('participations')
        .update({ head_coach_id: adrianId })
        .eq('id', p.id);
      if (error) throw error;
      console.log(`Updated participation ${p.id} head_coach_id -> Adrian Giles`);
    }
  }

  // 4b. Insert 2012-13 Varsity if missing
  {
    const { data: ex } = await supabase
      .from('games')
      .select('id')
      .eq('season_id', BUAFL_SEASONS[2012])
      .eq('game_type', 'friendly')
      .or(`and(home_team_id.eq.${ntuId},away_team_id.eq.${uonId}),and(home_team_id.eq.${uonId},away_team_id.eq.${ntuId})`)
      .maybeSingle();
    if (!ex) {
      const { error } = await supabase.from('games').insert({
        season_id: BUAFL_SEASONS[2012],
        phase_id: null,
        date: null,
        date_precision: 'season',
        date_display: null,
        home_team_id: ntuId,
        away_team_id: uonId,
        home_score: 28,
        away_score: 0,
        status: 'completed',
        confidence_level: 'high',
        is_playoff: false,
        is_double_header: false,
        game_type: 'friendly',
        game_level: 'University',
        nickname: 'Nottingham Varsity',
        notes: 'Nottingham Varsity (exact date, venue, and designated home team unconfirmed in contemporary archives). Source: https://nturenegades.wordpress.com/2016/07/06/team-history/'
      });
      if (error) throw error;
      console.log('Inserted 2012-13 Nottingham Varsity (28-0) in DB');
    } else {
      console.log('2012-13 Nottingham Varsity already in DB:', ex.id);
    }
  }

  // 4c. Insert 2013-14 Exeter Demons vs NTU playoff game if missing
  {
    const trophy2013PhaseId = '093afa70-ef1a-48ba-9941-aa3b6b2025d3';
    const { data: ex } = await supabase
      .from('games')
      .select('id')
      .eq('season_id', BUAFL_SEASONS[2013])
      .eq('is_playoff', true)
      .or(`and(home_team_id.eq.${ntuId},away_team_id.eq.${exeterId}),and(home_team_id.eq.${exeterId},away_team_id.eq.${ntuId})`)
      .maybeSingle();
    if (!ex) {
      const { error } = await supabase.from('games').insert({
        season_id: BUAFL_SEASONS[2013],
        phase_id: trophy2013PhaseId,
        date: null,
        date_precision: 'season',
        date_display: null,
        home_team_id: ntuId,
        away_team_id: exeterId,
        home_score: null,
        away_score: null,
        status: 'completed',
        confidence_level: 'high',
        is_playoff: true,
        final_type: 'playoff',
        playoff_round: 'Wild Card',
        is_double_header: false,
        game_type: 'league',
        game_level: 'University',
        notes: "2013/14 National Trophy playoff matchup: Exeter Demons defeated Nottingham Trent Renegades on a last-second touchdown prior to Exeter's 2014-03-16 Quarterfinal vs Leeds Met Carnegie (exact score, date, venue, and home/away unrecorded in contemporary archives). Source: https://nturenegades.wordpress.com/2016/07/06/team-history/"
      });
      if (error) throw error;
      console.log('Inserted 2013-14 NTU vs Exeter Demons playoff game in DB');
    } else {
      console.log('2013-14 NTU vs Exeter Demons already in DB:', ex.id);
    }
  }

  // 4d. Update 2015 playoff notes & insert 2016-04-29 Varsity
  {
    const { data: gl } = await supabase
      .from('games')
      .select('id, notes')
      .eq('season_id', BUAFL_SEASONS[2015])
      .eq('date', '2016-03-13')
      .eq('away_team_id', ntuId)
      .eq('home_team_id', glasgowId)
      .maybeSingle();
    if (gl) {
      await supabase.from('games').update({
        notes: appendNote(
          gl.notes,
          '[NTU March 14 play-by-play recap confirms 13-9 final score; NTU May 19 season summary table lists 15-9. Source: https://nturenegades.wordpress.com/2016/03/14/ntus-last-minute-comeback-over-glasgow-earns-promotion-to-premiership/]'
        )
      }).eq('id', gl.id);
      console.log('Updated 2016-03-13 Northern Final notes in DB');
    }

    const { data: lb } = await supabase
      .from('games')
      .select('id, notes')
      .eq('season_id', BUAFL_SEASONS[2015])
      .eq('date', '2016-02-28')
      .eq('away_team_id', leedsBeckettId)
      .eq('home_team_id', ntuId)
      .maybeSingle();
    if (lb) {
      await supabase.from('games').update({
        notes: appendNote(lb.notes, '[NTU May 19 results summary and BUCS list 27-20; March 4 recap intro mentions 27-21]')
      }).eq('id', lb.id);
    }

    const { data: ex15 } = await supabase
      .from('games')
      .select('id')
      .eq('season_id', BUAFL_SEASONS[2015])
      .eq('date', '2016-04-29')
      .or(`and(home_team_id.eq.${ntuId},away_team_id.eq.${uonId}),and(home_team_id.eq.${uonId},away_team_id.eq.${ntuId})`)
      .maybeSingle();
    if (!ex15) {
      const { error } = await supabase.from('games').insert({
        season_id: BUAFL_SEASONS[2015],
        phase_id: null,
        date: '2016-04-29',
        date_precision: 'day',
        date_display: '29/04/2016',
        time: '18:30:00',
        home_team_id: uonId,
        away_team_id: ntuId,
        home_score: 19,
        away_score: 7,
        venue_id: ladyBayId,
        status: 'completed',
        confidence_level: 'high',
        is_playoff: false,
        is_double_header: false,
        game_type: 'friendly',
        game_level: 'University',
        nickname: 'Nottingham Varsity',
        notes: 'Nottingham Varsity at Lady Bay Sports Ground, Nottingham (University of Nottingham won 19-7; friendly exhibition). Source: https://nturenegades.wordpress.com/2016/05/04/ntu-falls-to-the-university-of-nottingham-in-varsity/'
      });
      if (error) throw error;
      console.log('Inserted 2016-04-29 Nottingham Varsity in DB');
    }
  }

  // 4e. Update 2016 games (Durham awarded/on-field, Loughborough venue/time, Stirling time/venue/time, Derby Jan 22 swap) + insert 2017-05-13 Varsity
  {
    const { data: durhamG } = await supabase
      .from('games')
      .select('id')
      .eq('season_id', BUAFL_SEASONS[2016])
      .eq('date', '2016-11-13')
      .eq('away_team_id', ntuId)
      .eq('home_team_id', durhamId)
      .maybeSingle();
    if (durhamG) {
      await supabase.from('games').update({
        status: 'awarded',
        venue_id: VENUES.maidenCastle,
        time: '13:00:00',
        notes: 'On-field result: Durham Saints 28, Nottingham Trent Renegades 23 at Maiden Castle Sports Centre (subsequently recorded as a 1-0 BUCS walkover/forfeit awarded to NTU). Source: https://dblcoverage.com/university/bucs-fixturesresults-201617/ & https://nturenegades.wordpress.com/2016/11/15/ntu-renegades-lose-back-and-forth-opener-to-durham-saints/'
      }).eq('id', durhamG.id);
      console.log('Updated 2016-11-13 Durham @ Maiden Castle walkover in DB');
    }

    const { data: lboroG } = await supabase
      .from('games')
      .select('id, notes')
      .eq('season_id', BUAFL_SEASONS[2016])
      .eq('date', '2016-11-27')
      .eq('home_team_id', ntuId)
      .maybeSingle();
    if (lboroG) {
      await supabase.from('games').update({
        venue_id: VENUES.cliftonHub,
        time: '13:00:00',
        notes: appendNote(lboroG.notes, '& https://nturenegades.wordpress.com/2016/11/29/renegades-fall-short-to-loughborough-despite-late-game-push/')
      }).eq('id', lboroG.id);
      console.log('Updated 2016-11-27 Loughborough venue/time in DB');
    }

    const { data: stirAwayG } = await supabase
      .from('games')
      .select('id, notes')
      .eq('season_id', BUAFL_SEASONS[2016])
      .eq('date', '2016-12-11')
      .eq('away_team_id', ntuId)
      .eq('home_team_id', stirlingId)
      .maybeSingle();
    if (stirAwayG) {
      await supabase.from('games').update({
        time: '12:00:00',
        notes: appendNote(stirAwayG.notes, '& https://nturenegades.wordpress.com/2016/12/16/ntu-at-stirling-recap-with-video-highlights/')
      }).eq('id', stirAwayG.id);
      console.log('Updated 2016-12-11 Stirling time (12:00) in DB');
    }

    const { data: derbyJanG } = await supabase
      .from('games')
      .select('id')
      .eq('season_id', BUAFL_SEASONS[2016])
      .eq('date', '2017-01-22')
      .or(`and(home_team_id.eq.${ntuId},away_team_id.eq.${derbyId}),and(home_team_id.eq.${derbyId},away_team_id.eq.${ntuId})`)
      .maybeSingle();
    if (derbyJanG) {
      await supabase.from('games').update({
        away_team_id: ntuId,
        away_score: 14,
        home_team_id: derbyId,
        home_score: 17,
        venue_id: VENUES.derbyKedleston,
        time: '13:00:00',
        notes: 'Rescheduled from 2016-11-20 postponement (lack of medical staff); played at University of Derby Kedleston Road (Double Coverage listed NTU as home from original Nov 20 schedule). Source: https://dblcoverage.com/university/bucs-fixturesresults-201617/ & https://nturenegades.wordpress.com/2017/01/20/ntu-vs-derby-game-time-and-streaming-information/'
      }).eq('id', derbyJanG.id);
      console.log('Updated 2017-01-22 Derby home/away & venue in DB');
    }

    const { data: stirHomeG } = await supabase
      .from('games')
      .select('id, notes')
      .eq('season_id', BUAFL_SEASONS[2016])
      .eq('date', '2017-01-29')
      .eq('home_team_id', ntuId)
      .eq('away_team_id', stirlingId)
      .maybeSingle();
    if (stirHomeG) {
      await supabase.from('games').update({
        venue_id: VENUES.cliftonHub,
        time: '13:00:00',
        notes: appendNote(stirHomeG.notes, '& https://nturenegades.wordpress.com/2017/01/27/ntu-vs-stirling-game-times-and-live-stream-information/')
      }).eq('id', stirHomeG.id);
      console.log('Updated 2017-01-29 Stirling home venue/time in DB');
    }

    const { data: ex16 } = await supabase
      .from('games')
      .select('id')
      .eq('season_id', BUAFL_SEASONS[2016])
      .eq('date', '2017-05-13')
      .or(`and(home_team_id.eq.${ntuId},away_team_id.eq.${uonId}),and(home_team_id.eq.${uonId},away_team_id.eq.${ntuId})`)
      .maybeSingle();
    if (!ex16) {
      const { error } = await supabase.from('games').insert({
        season_id: BUAFL_SEASONS[2016],
        phase_id: null,
        date: '2017-05-13',
        date_precision: 'day',
        date_display: '13/05/2017',
        time: '18:00:00',
        home_team_id: ntuId,
        away_team_id: uonId,
        home_score: 25,
        away_score: 12,
        venue_id: VENUES.harveyHadden,
        status: 'completed',
        confidence_level: 'high',
        is_playoff: false,
        is_double_header: false,
        game_type: 'friendly',
        game_level: 'University',
        nickname: 'Nottingham Varsity',
        notes: 'Nottingham Varsity at Harvey Hadden Stadium, Nottingham (NTU Renegades won 25-12; friendly exhibition). Source: https://nturenegades.wordpress.com/2017/05/18/watch-the-entire-2017-notts-varsity-victory/'
      });
      if (error) throw error;
      console.log('Inserted 2017-05-13 Nottingham Varsity in DB');
    }
  }

  // 4f. Upsert game_staff for all NTU games in 2011, 2012, 2015, 2016
  {
    const coachSeasons = [BUAFL_SEASONS[2011], BUAFL_SEASONS[2012], BUAFL_SEASONS[2015], BUAFL_SEASONS[2016]];
    const { data: ntuGames, error: gErr } = await supabase
      .from('games')
      .select('id, season_id, date')
      .in('season_id', coachSeasons)
      .or(`home_team_id.eq.${ntuId},away_team_id.eq.${ntuId}`);
    if (gErr) throw gErr;

    let staffInserted = 0;
    let staffUpdated = 0;
    for (const g of ntuGames || []) {
      const { data: exStaff } = await supabase
        .from('game_staff')
        .select('id, person_id')
        .match({ game_id: g.id, team_id: ntuId, role: 'head_coach' })
        .maybeSingle();
      if (exStaff) {
        if (exStaff.person_id !== adrianId) {
          await supabase.from('game_staff').update({ person_id: adrianId }).eq('id', exStaff.id);
          staffUpdated++;
        }
      } else {
        const { error: iErr } = await supabase.from('game_staff').insert({
          game_id: g.id,
          team_id: ntuId,
          person_id: adrianId,
          role: 'head_coach'
        });
        if (iErr) throw iErr;
        staffInserted++;
      }
    }
    console.log(`Synced game_staff (Adrian Giles): inserted=${staffInserted}, updated=${staffUpdated}`);
  }

  console.log('\n=== Supabase Sync Complete ===');
}

async function main() {
  if (runCsv) applyCsvUpdates();
  if (runDb) await applyDbUpdates();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
