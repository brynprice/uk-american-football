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
  console.log('--- Applying Brunel, RHUL, and 2011/12 Participation Updates ---');

  // 1. Update data/BUAFL/games2012.csv
  const g2012Path = 'data/BUAFL/games2012.csv';
  const g2012Content = fs.readFileSync(g2012Path, 'utf-8');
  const g2012Lines = g2012Content.split('\n').filter(l => l.trim().length > 0);
  const g2012Header = parseCSVLine(g2012Lines[0]);
  const newG2012Rows = [serializeCSVRow(g2012Header)];

  let brunelUpdated = false;
  for (let i = 1; i < g2012Lines.length; i++) {
    const row = parseCSVLine(g2012Lines[i]);
    const obj = {};
    g2012Header.forEach((h, idx) => {
      obj[h.trim()] = row[idx] !== undefined ? row[idx].trim() : '';
    });

    if (obj.away_team === 'Brunel Burners' && obj.home_team === 'Oxford Lancers') {
      obj.phase = 'Oyster Card Conference';
      obj.game_type = 'league';
      obj.away_score = '40';
      obj.home_score = '6';
      obj.status = 'completed';
      obj.notes = 'Source: Oxford Lancers historic database / BUCS contemporary records';
      brunelUpdated = true;
      console.log('Updated Brunel game to Oyster Card Conference league match in games2012.csv');
    }

    newG2012Rows.push(serializeCSVRow(g2012Header.map(h => obj[h.trim()] || '')));
  }

  // Bring back RHUL voided game if not present
  const hasRHUL = newG2012Rows.some(l => l.includes('Royal Holloway Bears') && l.includes('Oxford Lancers'));
  if (!hasRHUL) {
    const rhulObj = {
      competition: 'BUAFL',
      year: '2012',
      date: '2013-02-20',
      date_precision: 'day',
      date_display: '20/02/2013',
      phase: 'Oyster Card Conference',
      parent_phase: '',
      away_phase: '',
      away_parent_phase: '',
      away_team: 'Oxford Lancers',
      away_score: '0',
      home_score: '0',
      home_team: 'Royal Holloway Bears',
      is_playoff: 'FALSE',
      playoff_round: '',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: '',
      nickname: '',
      is_double_header: 'FALSE',
      game_type: 'league',
      status: 'cancelled',
      confidence_level: 'high',
      venue: '',
      home_coach: '',
      away_coach: '',
      notes: 'Source: BUCS historical records (BUCS record: Void)'
    };
    newG2012Rows.push(serializeCSVRow(g2012Header.map(h => rhulObj[h.trim()] || '')));
    console.log('Restored RHUL voided game in games2012.csv');
  }

  fs.writeFileSync(g2012Path, newG2012Rows.join('\n') + '\n');
  console.log(`Updated ${g2012Path}`);

  // 2. Remove Oxford Lancers from standings2011.csv
  const s2011Path = 'data/BUAFL/standings2011.csv';
  const s2011Content = fs.readFileSync(s2011Path, 'utf-8');
  const s2011Lines = s2011Content.split('\n').filter(l => l.trim().length > 0);
  const s2011Filtered = s2011Lines.filter((l, idx) => {
    if (idx === 0) return true;
    return !l.includes('Oxford Lancers');
  });
  fs.writeFileSync(s2011Path, s2011Filtered.join('\n') + '\n');
  console.log(`Updated ${s2011Path} (removed Oxford Lancers)`);

  // 3. Update standings2012.csv
  const s2012Path = 'data/BUAFL/standings2012.csv';
  const s2012Content = fs.readFileSync(s2012Path, 'utf-8');
  const s2012Lines = s2012Content.split('\n').filter(l => l.trim().length > 0);
  const s2012Header = parseCSVLine(s2012Lines[0]);
  const newS2012Rows = [serializeCSVRow(s2012Header)];

  for (let i = 1; i < s2012Lines.length; i++) {
    const row = parseCSVLine(s2012Lines[i]);
    const obj = {};
    s2012Header.forEach((h, idx) => {
      obj[h.trim()] = row[idx] !== undefined ? row[idx].trim() : '';
    });

    if (obj.team === 'Oxford Lancers' && obj.phase === 'Oyster Card Conference') {
      obj.games_played = '7';
      obj.wins = '0';
      obj.losses = '7';
      obj.ties = '0';
      obj.points_for = '6';
      obj.points_against = '293';
      obj.notes = 'Source: BUCS historical records & Double Coverage contemporary reports & Oxford Lancers historic database';
      console.log('Updated Oxford Lancers standing in standings2012.csv');
    }

    if (obj.team === 'Brunel Burners' && obj.phase === 'Oyster Card Conference') {
      obj.games_played = '8';
      obj.wins = '5';
      obj.losses = '3';
      obj.ties = '0';
      obj.points_for = '187';
      obj.points_against = '99';
      console.log('Updated Brunel Burners standing in standings2012.csv');
    }

    if (obj.team === 'BNU Buccaneers' && obj.phase === 'Oyster Card Conference') {
      obj.games_played = '9';
      obj.wins = '8';
      obj.losses = '1';
      obj.ties = '0';
      obj.points_for = '252';
      obj.points_against = '102';
      console.log('Updated BNU Buccaneers standing in standings2012.csv');
    }

    newS2012Rows.push(serializeCSVRow(s2012Header.map(h => obj[h.trim()] || '')));
  }

  fs.writeFileSync(s2012Path, newS2012Rows.join('\n') + '\n');
  console.log(`Updated ${s2012Path}`);

  // 4. Supabase updates
  const { data: oxfordTeam } = await supabase.from('teams').select('id, name').ilike('name', '%oxford lancers%').single();
  const { data: rhulTeam } = await supabase.from('teams').select('id, name').ilike('name', '%royal holloway bears%').single();
  const { data: brunelTeam } = await supabase.from('teams').select('id, name').ilike('name', '%brunel burners%').single();
  const { data: bnuTeam } = await supabase.from('teams').select('id, name').ilike('name', '%bnu buccaneers%').single();

  const season2011Id = '60c4fa58-3675-47f9-ad47-bef29f3d0f5c';
  const season2012Id = 'd4e61940-f44a-4b9a-84e7-23d01db775be';
  const oysterPhaseId = '0f6fb902-514c-496f-b335-25bd273bf0b9';

  // 4a. Delete 2011 Oxford participation
  const { data: delParts } = await supabase.from('participations')
    .delete()
    .eq('team_id', oxfordTeam.id)
    .eq('id', 'a3731ca3-338b-4f8a-961e-9238df90e438')
    .select();
  console.log('Deleted 2011 Oxford participation from Supabase:', delParts?.length);

  // 4b. Update Brunel game in Supabase to Oyster Card Conference league match
  const { data: brunelGame } = await supabase.from('games')
    .select('id')
    .eq('season_id', season2012Id)
    .eq('home_team_id', oxfordTeam.id)
    .eq('away_team_id', brunelTeam.id)
    .maybeSingle();

  if (brunelGame) {
    await supabase.from('games').update({
      phase_id: oysterPhaseId,
      game_type: 'league',
      notes: 'Source: Oxford Lancers historic database / BUCS contemporary records'
    }).eq('id', brunelGame.id);
    console.log('Updated Brunel game in Supabase to Oyster Card Conference league game');
  }

  // 4c. Restore RHUL voided game in Supabase
  const { data: existingRHUL } = await supabase.from('games')
    .select('id')
    .eq('season_id', season2012Id)
    .eq('home_team_id', rhulTeam.id)
    .eq('away_team_id', oxfordTeam.id)
    .maybeSingle();

  if (!existingRHUL) {
    await supabase.from('games').insert({
      season_id: season2012Id,
      phase_id: oysterPhaseId,
      home_team_id: rhulTeam.id,
      away_team_id: oxfordTeam.id,
      home_score: 0,
      away_score: 0,
      date: '2013-02-20',
      date_display: '20/02/2013',
      date_precision: 'day',
      game_type: 'league',
      status: 'cancelled',
      confidence_level: 'high',
      notes: 'Source: BUCS historical records (BUCS record: Void)'
    });
    console.log('Restored RHUL voided game in Supabase');
  }

  // 4d. Update 2012 participations in Supabase
  // Oxford: 0-7-0, 6 PF, 293 PA
  await supabase.from('participations').update({
    wins: 0,
    losses: 7,
    ties: 0,
    points_for: 6,
    points_against: 293,
    notes: 'Source: BUCS historical records & Double Coverage contemporary reports & Oxford Lancers historic database'
  }).eq('id', '5baddb9d-b82f-4cfc-8b10-7ad2f9422378');
  console.log('Updated Oxford Lancers 2012 participation in Supabase');

  // Brunel: 5-3-0, 187 PF, 99 PA
  const { data: brunelPart } = await supabase.from('participations')
    .select('id')
    .eq('phase_id', oysterPhaseId)
    .eq('team_id', brunelTeam.id)
    .maybeSingle();
  if (brunelPart) {
    await supabase.from('participations').update({
      wins: 5,
      losses: 3,
      ties: 0,
      points_for: 187,
      points_against: 99
    }).eq('id', brunelPart.id);
    console.log('Updated Brunel Burners 2012 participation in Supabase');
  }

  // BNU: 8-1-0, 252 PF, 102 PA
  const { data: bnuPart } = await supabase.from('participations')
    .select('id')
    .eq('phase_id', oysterPhaseId)
    .eq('team_id', bnuTeam.id)
    .maybeSingle();
  if (bnuPart) {
    await supabase.from('participations').update({
      wins: 8,
      losses: 1,
      ties: 0,
      points_for: 252,
      points_against: 102
    }).eq('id', bnuPart.id);
    console.log('Updated BNU Buccaneers 2012 participation in Supabase');
  }

  console.log('--- Completed All Updates Successfully ---');
}

run();
