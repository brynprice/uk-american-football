import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
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
  console.log('=== REAPPLYING OXFORD ARCHIVE UPDATES & SYNCING TO SUPABASE ===\n');

  const s12Id = 'd4e61940-f44a-4b9a-84e7-23d01db775be';

  // 1. Process data/BUAFL/games2012.csv
  const g12Path = 'data/BUAFL/games2012.csv';
  const g12Lines = fs.readFileSync(g12Path, 'utf-8').split('\n').filter(l => l.trim().length > 0);
  const g12Header = parseCSVLine(g12Lines[0]);

  const cleanG12 = [serializeCSVRow(g12Header)];
  let updatedBNU = false;
  let removedRHUL = false;

  for (let i = 1; i < g12Lines.length; i++) {
    const row = parseCSVLine(g12Lines[i]);
    const obj = {};
    g12Header.forEach((h, idx) => obj[h.trim()] = (row[idx] || '').trim());

    // Filter out RHUL vs Oxford voided
    const isRHULOxford = (obj.away_team === 'Royal Holloway Bears' && obj.home_team === 'Oxford Lancers') ||
                         (obj.home_team === 'Royal Holloway Bears' && obj.away_team === 'Oxford Lancers');
    if (isRHULOxford && obj.status === 'cancelled') {
      console.log(`[Removed] RHUL vs Oxford voided game on ${obj.date}`);
      removedRHUL = true;
      continue;
    }

    // Update BNU @ Oxford Lancers to 82-0 completed win
    const isBNUOxford = (obj.home_team === 'Oxford Lancers' && obj.away_team === 'BNU Buccaneers');
    if (isBNUOxford) {
      obj.away_score = '82';
      obj.home_score = '0';
      obj.status = 'completed';
      obj.notes = 'Oxford Lancers historic database records on-field 82-0 blowout (officially voided by BUCS). Source: Oxford Lancers historic database';
      console.log(`[Updated] BNU @ Oxford Lancers to 82-0 completed win on ${obj.date}`);
      updatedBNU = true;
    }

    // Solent @ Oxford Lancers note
    if (obj.home_team === 'Oxford Lancers' && obj.away_team === 'Solent Redhawks') {
      if (!obj.notes.includes('Oxford Lancers historic database')) {
        obj.notes = `${obj.notes} [Oxford Lancers historic database records score as 0-28]`.trim();
      }
    }

    // Brighton @ Oxford Lancers note
    if (obj.home_team === 'Oxford Lancers' && (obj.away_team === 'Brighton Tsunami' || obj.away_team === 'Brighton Panthers')) {
      if (!obj.notes.includes('Oxford Lancers historic database')) {
        obj.notes = `${obj.notes} [Oxford Lancers historic database records score as 0-27, matching BUCS official records]`.trim();
      }
    }

    // Varsity Bowl (Cambridge Pythons @ Oxford Lancers)
    if (obj.away_team === 'Cambridge Pythons' && obj.home_team === 'Oxford Lancers' && (obj.title_name === 'Varsity Bowl' || obj.notes.includes('Varsity Bowl'))) {
      obj.phase = '';
      obj.parent_phase = '';
      obj.game_type = 'friendly';
      obj.title_name = 'Varsity Bowl';
      obj.nickname = 'Varsity Bowl';
      obj.home_coach = '';
    }

    cleanG12.push(serializeCSVRow(g12Header.map(h => obj[h.trim()] || '')));
  }

  fs.writeFileSync(g12Path, cleanG12.join('\n') + '\n');
  console.log(`Updated ${g12Path} (total games: ${cleanG12.length - 1})`);

  // 2. Recompute standings2012.csv
  console.log('\n--- Recomputing standings2012.csv ---');
  const gamesList = cleanG12.slice(1).map(l => {
    const row = parseCSVLine(l);
    const obj = {};
    g12Header.forEach((h, idx) => obj[h.trim()] = (row[idx] || '').trim());
    return obj;
  });

  const s12Path = 'data/BUAFL/standings2012.csv';
  const s12Lines = fs.readFileSync(s12Path, 'utf-8').split('\n').filter(l => l.trim().length > 0);
  const s12Header = parseCSVLine(s12Lines[0]);

  const teamStats = {};
  for (const g of gamesList) {
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

  const newStandingsRows = [];
  for (let i = 1; i < s12Lines.length; i++) {
    const row = parseCSVLine(s12Lines[i]);
    const obj = {};
    s12Header.forEach((h, idx) => obj[h.trim()] = (row[idx] || '').trim());

    const st = teamStats[obj.team] || { gp: 0, w: 0, l: 0, t: 0, pf: 0, pa: 0 };
    obj.games_played = String(st.gp);
    obj.wins = String(st.w);
    obj.losses = String(st.l);
    obj.ties = String(st.t);
    obj.points_for = String(st.pf);
    obj.points_against = String(st.pa);

    newStandingsRows.push(obj);
  }

  // Re-rank within phases
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

  // Print BNU and Oxford standings
  const bnuStandings = newStandingsRows.find(r => r.team === 'BNU Buccaneers');
  const oxfordStandings = newStandingsRows.find(r => r.team === 'Oxford Lancers');
  console.log('BNU Buccaneers updated standing:', bnuStandings);
  console.log('Oxford Lancers updated standing:', oxfordStandings);

  // 3. Supabase Synchronization
  console.log('\n--- Synchronizing to Supabase ---');
  const { data: bnuTeam } = await supabase.from('teams').select('id').eq('name', 'BNU Buccaneers').single();
  const { data: oxfordTeam } = await supabase.from('teams').select('id').eq('name', 'Oxford Lancers').single();
  const { data: rhulTeam } = await supabase.from('teams').select('id').eq('name', 'Royal Holloway Bears').single();
  const { data: cambridgeTeam } = await supabase.from('teams').select('id').eq('name', 'Cambridge Pythons').single();

  // 3a. Update BNU @ Oxford game
  const { data: bnuG } = await supabase.from('games')
    .select('id')
    .eq('season_id', s12Id)
    .eq('home_team_id', oxfordTeam.id)
    .eq('away_team_id', bnuTeam.id)
    .maybeSingle();

  if (bnuG) {
    await supabase.from('games').update({
      home_score: 0,
      away_score: 82,
      status: 'completed',
      notes: 'Oxford Lancers historic database records on-field 82-0 blowout (officially voided by BUCS). Source: Oxford Lancers historic database'
    }).eq('id', bnuG.id);
    console.log(`Updated BNU @ Oxford Lancers game in Supabase (ID: ${bnuG.id}) to 82-0.`);
  }

  // 3b. Delete RHUL @ Oxford voided game
  const { data: rhulDel } = await supabase.from('games')
    .delete()
    .eq('season_id', s12Id)
    .eq('home_team_id', oxfordTeam.id)
    .eq('away_team_id', rhulTeam.id)
    .eq('status', 'cancelled')
    .select('id');
  console.log(`Deleted RHUL vs Oxford voided game from Supabase (count: ${rhulDel?.length || 0}).`);

  // 3c. Update Varsity Bowl in Supabase
  const { data: vbG } = await supabase.from('games')
    .select('id')
    .eq('season_id', s12Id)
    .eq('home_team_id', oxfordTeam.id)
    .eq('away_team_id', cambridgeTeam.id)
    .is('date', null)
    .maybeSingle();

  if (vbG) {
    await supabase.from('games').update({
      phase_id: null,
      away_phase_id: null,
      game_type: 'friendly',
      title_name: 'Varsity Bowl',
      nickname: 'Varsity Bowl'
    }).eq('id', vbG.id);
    console.log(`Updated Varsity Bowl in Supabase (unphased friendly).`);
  }

  // 3d. Sync participations for Oyster Card Conference
  const { data: ocPhase } = await supabase.from('phases').select('id').eq('season_id', s12Id).eq('name', 'Oyster Card Conference').single();
  
  if (bnuStandings && ocPhase) {
    await supabase.from('participations').update({
      wins: parseInt(bnuStandings.wins),
      losses: parseInt(bnuStandings.losses),
      ties: parseInt(bnuStandings.ties),
      points_for: parseInt(bnuStandings.points_for),
      points_against: parseInt(bnuStandings.points_against)
    }).eq('team_id', bnuTeam.id).eq('phase_id', ocPhase.id);
    console.log(`Updated BNU Buccaneers participation in Supabase: ${bnuStandings.wins}-${bnuStandings.losses}-${bnuStandings.ties}, PF: ${bnuStandings.points_for}, PA: ${bnuStandings.points_against}`);
  }

  if (oxfordStandings && ocPhase) {
    await supabase.from('participations').update({
      wins: parseInt(oxfordStandings.wins),
      losses: parseInt(oxfordStandings.losses),
      ties: parseInt(oxfordStandings.ties),
      points_for: parseInt(oxfordStandings.points_for),
      points_against: parseInt(oxfordStandings.points_against)
    }).eq('team_id', oxfordTeam.id).eq('phase_id', ocPhase.id);
    console.log(`Updated Oxford Lancers participation in Supabase: ${oxfordStandings.wins}-${oxfordStandings.losses}-${oxfordStandings.ties}, PF: ${oxfordStandings.points_for}, PA: ${oxfordStandings.points_against}`);
  }

  // Final verification
  const { count: finalGameCount } = await supabase.from('games')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', s12Id);

  const finalCsvCount = cleanG12.length - 1;
  console.log(`\n=== FINAL VERIFICATION ===`);
  console.log(`CSV 2012 games count: ${finalCsvCount}`);
  console.log(`DB 2012 games count:  ${finalGameCount}`);
}

run().catch(console.error);
