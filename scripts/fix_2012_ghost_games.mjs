import fs from 'fs';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

async function run() {
  console.log('=== Step 1: Processing data/BUAFL/games2011.csv ===');
  const g11Path = 'data/BUAFL/games2011.csv';
  const g11Lines = fs.readFileSync(g11Path, 'utf-8').split('\n').filter(l => l.trim().length > 0);
  const g11Header = parseCSVLine(g11Lines[0]);
  
  // Filter out Kingston Cougars 36-22 BNU Buccaneers
  const filteredG11 = [serializeCSVRow(g11Header)];
  let removedFrom11 = 0;
  for (let i = 1; i < g11Lines.length; i++) {
    const row = parseCSVLine(g11Lines[i]);
    const obj = {};
    g11Header.forEach((h, idx) => obj[h.trim()] = (row[idx] || '').trim());
    
    if (obj.away_team === 'Kingston Cougars' && obj.home_team === 'BNU Buccaneers' && obj.away_score === '36' && obj.home_score === '22') {
      console.log('Removed Kingston 36-22 BNU from games2011.csv');
      removedFrom11++;
      continue;
    }
    filteredG11.push(serializeCSVRow(g11Header.map(h => obj[h.trim()] || '')));
  }
  fs.writeFileSync(g11Path, filteredG11.join('\n') + '\n');
  console.log(`Updated ${g11Path} (removed ${removedFrom11} rows)`);

  console.log('\n=== Step 2: Processing data/BUAFL/games2012.csv ===');
  const g12Path = 'data/BUAFL/games2012.csv';
  const g12Lines = fs.readFileSync(g12Path, 'utf-8').split('\n').filter(l => l.trim().length > 0);
  const g12Header = parseCSVLine(g12Lines[0]);

  const g13Path = 'data/BUAFL/games2013.csv';
  const g13Lines = fs.readFileSync(g13Path, 'utf-8').split('\n').filter(l => l.trim().length > 0);
  const g13Header = parseCSVLine(g13Lines[0]);

  // Index 2013 games from the 3 Autumn 2013 weeks
  const g13Index = new Map();
  for (let i = 1; i < g13Lines.length; i++) {
    const row = parseCSVLine(g13Lines[i]);
    const obj = {};
    g13Header.forEach((h, idx) => obj[h.trim()] = (row[idx] || '').trim());
    if (['2013-11-03', '2013-12-01', '2013-12-08'].includes(obj.date)) {
      const teams = [obj.away_team, obj.home_team].sort().join(' vs ');
      const scores = [obj.away_score, obj.home_score].sort().join('-');
      g13Index.set(`${teams}|${scores}`, obj);
    }
  }

  const cleanG12Rows = [serializeCSVRow(g12Header)];
  const ghostGamesToDelete = [];
  let updatedOxfordReading = false;
  let updatedReadingBNU = false;

  for (let i = 1; i < g12Lines.length; i++) {
    const row = parseCSVLine(g12Lines[i]);
    const obj = {};
    g12Header.forEach((h, idx) => obj[h.trim()] = (row[idx] || '').trim());

    // Row 45: MMU 0 @ Derby 58 on 2012-11-11 is a real 2012 game
    if (obj.date === '2012-11-11' && obj.away_team === 'MMU Eagles' && obj.home_team === 'Derby Braves') {
      cleanG12Rows.push(serializeCSVRow(g12Header.map(h => obj[h.trim()] || '')));
      continue;
    }

    // Row 7: Napier 0 @ Stirling 55 walkover on 2013-02-20 is a real 2012 walkover
    if (obj.date === '2013-02-20' && obj.away_team === 'Edinburgh Napier Knights' && obj.home_team === 'Stirling Clansmen') {
      cleanG12Rows.push(serializeCSVRow(g12Header.map(h => obj[h.trim()] || '')));
      continue;
    }

    // Check if this is Oxford vs Reading (Row 4 in 2012)
    const isOxfordReading = (obj.away_team === 'Oxford Lancers' && obj.home_team === 'Reading Knights') ||
                           (obj.away_team === 'Reading Knights' && obj.home_team === 'Oxford Lancers');
    if (isOxfordReading && !obj.date) {
      // Update to real 2012 fixture (Reading won 20-0 on 2013-02-10 per DC & Oxford DB)
      obj.date = '2013-02-10';
      obj.date_precision = 'day';
      obj.date_display = '10/02/2013';
      obj.away_team = 'Oxford Lancers';
      obj.away_score = '0';
      obj.home_score = '20';
      obj.home_team = 'Reading Knights';
      obj.status = 'completed';
      obj.notes = 'Double Coverage contemporary reports and Oxford Lancers historic database (BUCS recorded 30-0 from subsequent season). Source: Double Coverage / Oxford Lancers historic database';
      cleanG12Rows.push(serializeCSVRow(g12Header.map(h => obj[h.trim()] || '')));
      updatedOxfordReading = true;
      console.log('Updated Oxford Lancers vs Reading Knights to real 2012 game (20-0 on 2013-02-10)');
      continue;
    }

    // Check if this is Reading vs BNU
    const isReadingBNU = (obj.away_team === 'Reading Knights' && obj.home_team === 'BNU Buccaneers') ||
                         (obj.away_team === 'BNU Buccaneers' && obj.home_team === 'Reading Knights');
    if (isReadingBNU && obj.is_playoff !== 'TRUE') {
      // Update to completed 28-6 BNU win on 2013-01-27
      obj.date = '2013-01-27';
      obj.date_precision = 'day';
      obj.date_display = '27/01/2013';
      obj.away_team = 'Reading Knights';
      obj.away_score = '6';
      obj.home_score = '28';
      obj.home_team = 'BNU Buccaneers';
      obj.status = 'completed';
      obj.home_coach = 'Luke Plastow';
      obj.away_coach = 'Andy Hollands';
      obj.notes = 'Double Coverage contemporary reports 28-6 on-field BNU victory (officially voided by BUCS). Source: https://dblcoverage.blogspot.com/p/buafl-fixtures.html';
      cleanG12Rows.push(serializeCSVRow(g12Header.map(h => obj[h.trim()] || '')));
      updatedReadingBNU = true;
      console.log('Updated Reading Knights @ BNU Buccaneers to completed 28-6 on 2013-01-27');
      continue;
    }

    // Check if exact match to 2013 ghost games
    const teamsKey = [obj.away_team, obj.home_team].sort().join(' vs ');
    const scoresKey = [obj.away_score, obj.home_score].sort().join('-');
    const lookupKey = `${teamsKey}|${scoresKey}`;

    if (g13Index.has(lookupKey) && obj.away_score !== '' && obj.home_score !== '') {
      ghostGamesToDelete.push(obj);
      console.log(`Identified ghost duplicate to remove: ${obj.away_team} ${obj.away_score}-${obj.home_score} ${obj.home_team} (2012 date='${obj.date}')`);
      continue;
    }

    cleanG12Rows.push(serializeCSVRow(g12Header.map(h => obj[h.trim()] || '')));
  }

  // Add Kingston Cougars 36-22 BNU Buccaneers (Week 1, 2012-11-04)
  const kingstonBNUObj = {
    competition: 'BUAFL',
    year: '2012',
    date: '2012-11-04',
    date_precision: 'day',
    date_display: '04/11/2012',
    phase: 'Oyster Card Conference',
    parent_phase: '',
    away_phase: '',
    away_parent_phase: '',
    away_team: 'Kingston Cougars',
    away_score: '36',
    home_score: '22',
    home_team: 'BNU Buccaneers',
    is_playoff: 'FALSE',
    playoff_round: '',
    is_title_game: 'FALSE',
    final_type: '',
    title_name: '',
    nickname: '',
    is_double_header: 'FALSE',
    game_type: 'league',
    status: 'completed',
    confidence_level: 'high',
    venue: '',
    home_coach: 'Luke Plastow',
    away_coach: '',
    notes: 'Week 1 TVC regular season game. Source: https://dblcoverage.blogspot.com/p/buafl-fixtures.html'
  };
  cleanG12Rows.push(serializeCSVRow(g12Header.map(h => kingstonBNUObj[h.trim()] || '')));
  console.log('Added Kingston Cougars 36-22 BNU Buccaneers on 2012-11-04');

  fs.writeFileSync(g12Path, cleanG12Rows.join('\n') + '\n');
  console.log(`Updated ${g12Path}: Removed ${ghostGamesToDelete.length} ghost games, total rows now ${cleanG12Rows.length}`);

  console.log('\n=== Step 3: Recomputing data/BUAFL/standings2012.csv ===');
  // Recompute standings from the cleaned games
  const cleanGamesList = cleanG12Rows.slice(1).map(line => {
    const row = parseCSVLine(line);
    const obj = {};
    g12Header.forEach((h, idx) => obj[h.trim()] = (row[idx] || '').trim());
    return obj;
  });

  const teamStats = {};
  for (const g of cleanGamesList) {
    if (g.is_playoff === 'TRUE' || g.game_type === 'friendly') continue;
    if (!['completed', 'awarded'].includes(g.status)) continue;
    
    const a = g.away_team;
    const h = g.home_team;
    const as = parseInt(g.away_score, 10);
    const hs = parseInt(g.home_score, 10);
    if (isNaN(as) || isNaN(hs)) continue;

    for (const t of [a, h]) {
      if (!teamStats[t]) {
        teamStats[t] = { gp: 0, w: 0, l: 0, t: 0, pf: 0, pa: 0 };
      }
    }

    teamStats[a].gp++;
    teamStats[a].pf += as;
    teamStats[a].pa += hs;
    teamStats[h].gp++;
    teamStats[h].pf += hs;
    teamStats[h].pa += as;

    if (as > hs) {
      teamStats[a].w++;
      teamStats[h].l++;
    } else if (hs > as) {
      teamStats[h].w++;
      teamStats[a].l++;
    } else {
      teamStats[a].t++;
      teamStats[h].t++;
    }
  }

  const s12Path = 'data/BUAFL/standings2012.csv';
  const s12Lines = fs.readFileSync(s12Path, 'utf-8').split('\n').filter(l => l.trim().length > 0);
  const s12Header = parseCSVLine(s12Lines[0]);

  const newStandingsRows = [];
  const teamsToRemove = new Set(['Keele Crusaders', 'City Wolfpack', 'Sussex Saxons']);

  for (let i = 1; i < s12Lines.length; i++) {
    const row = parseCSVLine(s12Lines[i]);
    const obj = {};
    s12Header.forEach((h, idx) => obj[h.trim()] = (row[idx] || '').trim());

    if (teamsToRemove.has(obj.team)) {
      console.log(`Removing ${obj.team} from standings2012.csv (0 games in 2012)`);
      continue;
    }

    const st = teamStats[obj.team] || { gp: 0, w: 0, l: 0, t: 0, pf: 0, pa: 0 };
    obj.games_played = String(st.gp);
    obj.wins = String(st.w);
    obj.losses = String(st.l);
    obj.ties = String(st.t);
    obj.points_for = String(st.pf);
    obj.points_against = String(st.pa);

    newStandingsRows.push(obj);
  }

  // Re-rank within each phase by win_pct desc, diff desc, pf desc
  const phases = {};
  for (const row of newStandingsRows) {
    if (!phases[row.phase]) phases[row.phase] = [];
    phases[row.phase].push(row);
  }

  const finalStandingsRows = [serializeCSVRow(s12Header)];
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
      finalStandingsRows.push(serializeCSVRow(s12Header.map(h => r[h.trim()] || '')));
    });
  }

  fs.writeFileSync(s12Path, finalStandingsRows.join('\n') + '\n');
  console.log(`Updated ${s12Path}`);

  console.log('\n=== Step 4: Supabase Database Synchronization ===');
  const season2012Id = 'd4e61940-f44a-4b9a-84e7-23d01db775be';
  const season2011Id = '60c4fa58-3675-47f9-ad47-bef29f3d0f5c';

  // 4a. Delete ghost duplicate games from Supabase season 2012
  console.log(`Deleting ${ghostGamesToDelete.length} ghost games from Supabase 2012...`);
  let deletedCount = 0;
  for (const gg of ghostGamesToDelete) {
    const { data: awayT } = await supabase.from('teams').select('id').eq('name', gg.away_team).maybeSingle();
    const { data: homeT } = await supabase.from('teams').select('id').eq('name', gg.home_team).maybeSingle();
    if (awayT && homeT) {
      let q = supabase.from('games').delete()
        .eq('season_id', season2012Id)
        .eq('away_team_id', awayT.id)
        .eq('home_team_id', homeT.id)
        .eq('away_score', parseInt(gg.away_score, 10))
        .eq('home_score', parseInt(gg.home_score, 10));
      if (gg.date) {
        q = q.eq('date', gg.date);
      }
      const { data: delResult } = await q.select();
      if (delResult && delResult.length > 0) {
        deletedCount += delResult.length;
      }
    }
  }
  console.log(`Deleted ${deletedCount} ghost game records from Supabase`);

  // 4b. Remove Kingston 36-22 BNU from 2011 games and add to 2012 games
  const { data: bnuTeam } = await supabase.from('teams').select('id').eq('name', 'BNU Buccaneers').single();
  const { data: kingstonTeam } = await supabase.from('teams').select('id').eq('name', 'Kingston Cougars').single();
  const { data: readingTeam } = await supabase.from('teams').select('id').eq('name', 'Reading Knights').single();
  const { data: oxfordTeam } = await supabase.from('teams').select('id').eq('name', 'Oxford Lancers').single();
  const oysterPhaseId = '0f6fb902-514c-496f-b335-25bd273bf0b9';

  await supabase.from('games').delete()
    .eq('season_id', season2011Id)
    .eq('away_team_id', kingstonTeam.id)
    .eq('home_team_id', bnuTeam.id)
    .eq('away_score', 36)
    .eq('home_score', 22);
  console.log('Deleted Kingston 36-22 BNU from 2011 in Supabase');

  const { data: existingKBNU } = await supabase.from('games')
    .select('id')
    .eq('season_id', season2012Id)
    .eq('away_team_id', kingstonTeam.id)
    .eq('home_team_id', bnuTeam.id)
    .maybeSingle();

  if (!existingKBNU) {
    await supabase.from('games').insert({
      season_id: season2012Id,
      phase_id: oysterPhaseId,
      date: '2012-11-04',
      date_precision: 'day',
      date_display: '04/11/2012',
      away_team_id: kingstonTeam.id,
      home_team_id: bnuTeam.id,
      away_score: 36,
      home_score: 22,
      game_type: 'league',
      status: 'completed',
      confidence_level: 'high',
      notes: 'Week 1 TVC regular season game. Source: https://dblcoverage.blogspot.com/p/buafl-fixtures.html'
    });
    console.log('Inserted Kingston 36-22 BNU into 2012 in Supabase');
  }

  // 4c. Update Reading vs BNU to 28-6 on 2013-01-27
  await supabase.from('games').update({
    date: '2013-01-27',
    date_precision: 'day',
    date_display: '27/01/2013',
    away_team_id: readingTeam.id,
    home_team_id: bnuTeam.id,
    away_score: 6,
    home_score: 28,
    status: 'completed',
    notes: 'Double Coverage contemporary reports 28-6 on-field BNU victory (officially voided by BUCS). Source: https://dblcoverage.blogspot.com/p/buafl-fixtures.html'
  })
  .eq('season_id', season2012Id)
  .or(`and(away_team_id.eq.${readingTeam.id},home_team_id.eq.${bnuTeam.id}),and(away_team_id.eq.${bnuTeam.id},home_team_id.eq.${readingTeam.id})`);
  console.log('Updated Reading vs BNU in Supabase to 28-6 completed on 2013-01-27');

  // 4d. Update Oxford vs Reading to 20-0 on 2013-02-10
  await supabase.from('games').update({
    date: '2013-02-10',
    date_precision: 'day',
    date_display: '10/02/2013',
    away_team_id: oxfordTeam.id,
    home_team_id: readingTeam.id,
    away_score: 0,
    home_score: 20,
    status: 'completed',
    notes: 'Double Coverage contemporary reports and Oxford Lancers historic database (BUCS recorded 30-0 from subsequent season). Source: Double Coverage / Oxford Lancers historic database'
  })
  .eq('season_id', season2012Id)
  .or(`and(away_team_id.eq.${oxfordTeam.id},home_team_id.eq.${readingTeam.id}),and(away_team_id.eq.${readingTeam.id},home_team_id.eq.${oxfordTeam.id})`);
  console.log('Updated Oxford vs Reading in Supabase to 20-0 completed on 2013-02-10');

  // 4e. Delete participations for Keele, City Wolfpack, and Sussex Saxons in 2012
  const { data: delParts } = await supabase.from('participations')
    .delete()
    .in('id', [
      '0605aed2-58b3-4470-838f-b5702af4186e', // Sussex Saxons Oyster Card
      '26641bc2-4bd4-4912-85b3-e30b73633c6b', // City Wolfpack Oyster Card
      'abc1cbf3-16be-489f-88df-ebbd8788fcda'  // Keele Crusaders Big North Western
    ])
    .select();
  console.log('Deleted 2012 participations for 0-game teams:', delParts?.length);

  // 4f. Update all 2012 participations in Supabase with clean stats
  console.log('Updating 2012 participations in Supabase with clean standings...');
  const { data: allPhases } = await supabase.from('phases').select('id, name').eq('season_id', season2012Id);
  const phaseMap = new Map((allPhases || []).map(p => [p.name, p.id]));

  for (const row of newStandingsRows) {
    const pId = phaseMap.get(row.phase);
    if (!pId) continue;
    const { data: tData } = await supabase.from('teams').select('id').eq('name', row.team).maybeSingle();
    if (!tData) continue;

    const { error: upErr } = await supabase.from('participations')
      .update({
        position: parseInt(row.position, 10),
        games_played: parseInt(row.games_played, 10),
        wins: parseInt(row.wins, 10),
        losses: parseInt(row.losses, 10),
        ties: parseInt(row.ties, 10),
        points_for: parseInt(row.points_for, 10),
        points_against: parseInt(row.points_against, 10)
      })
      .eq('team_id', tData.id)
      .eq('phase_id', pId);

    if (upErr) {
      console.error(`Error updating participation for ${row.team}:`, upErr.message);
    }
  }
  console.log('Finished updating participations in Supabase!');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
