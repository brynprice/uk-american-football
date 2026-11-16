import fs from 'fs';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

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
  console.log('=== Step 1: Register Carl Marshall in data/evidence/verified_coaches.json ===');
  const evidencePath = 'data/evidence/verified_coaches.json';
  const evidenceList = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));

  const newRecords = [
    {
      team: 'Oxford Lancers',
      year: 2012,
      head_coach: 'Carl Marshall',
      source: 'Oxford Lancers official club records',
      source_details: 'Inaugural Head Coach of the Oxford Lancers for their debut 2012/13 BUAFL season, confirmed by Oxford Lancers club records.'
    },
    {
      team: 'Oxford Lancers',
      year: 2013,
      head_coach: 'Carl Marshall',
      source: 'Oxford Lancers official club records',
      source_details: 'Head Coach of the Oxford Lancers for the 2013/14 BUAFL season, confirmed by Oxford Lancers club records.'
    },
    {
      team: 'Oxford Lancers',
      year: 2014,
      head_coach: 'Carl Marshall',
      source: 'Oxford Lancers official club records',
      source_details: 'Head Coach of the Oxford Lancers for early 2014/15 season (through Dec 2014) prior to mid-season handover to Andy McKenzie, confirmed by Oxford Lancers club records.'
    }
  ];

  for (const item of newRecords) {
    const exists = evidenceList.some(e => e.team === item.team && e.year === item.year && e.head_coach === item.head_coach);
    if (!exists) {
      evidenceList.push(item);
      console.log(`Added verified coach: ${item.head_coach} (${item.team}, ${item.year})`);
    }
  }

  fs.writeFileSync(evidencePath, JSON.stringify(evidenceList, null, 2) + '\n');

  console.log('\n=== Step 2: Update Standings 2012 and 2013 ===');
  for (const yr of [2012, 2013]) {
    const sPath = `data/BUAFL/standings${yr}.csv`;
    if (!fs.existsSync(sPath)) continue;
    const lines = fs.readFileSync(sPath, 'utf-8').split('\n').filter(l => l.trim().length > 0);
    const header = parseCSVLine(lines[0]);
    const hcIdx = header.findIndex(h => h.trim() === 'head_coach');
    const teamIdx = header.findIndex(h => h.trim() === 'team');

    if (hcIdx === -1 || teamIdx === -1) {
      console.warn(`Could not find head_coach or team in ${sPath}`);
      continue;
    }

    const newRows = [lines[0]];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row[teamIdx] && row[teamIdx].trim() === 'Oxford Lancers') {
        row[hcIdx] = 'Carl Marshall';
        console.log(`Updated ${sPath} Oxford Lancers head_coach -> Carl Marshall`);
      }
      newRows.push(serializeCSVRow(header.map((_, idx) => row[idx] || '')));
    }
    fs.writeFileSync(sPath, newRows.join('\n') + '\n');
  }

  console.log('\n=== Step 3: Update Games 2012, 2013, 2014 ===');
  // 2012 games
  {
    const gPath = 'data/BUAFL/games2012.csv';
    const lines = fs.readFileSync(gPath, 'utf-8').split('\n').filter(l => l.trim().length > 0);
    const header = parseCSVLine(lines[0]);
    const atIdx = header.findIndex(h => h.trim() === 'away_team');
    const htIdx = header.findIndex(h => h.trim() === 'home_team');
    const acIdx = header.findIndex(h => h.trim() === 'away_coach');
    const hcIdx = header.findIndex(h => h.trim() === 'home_coach');

    const newRows = [lines[0]];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const away = (row[atIdx] || '').trim();
      const home = (row[htIdx] || '').trim();
      if (away === 'Oxford Lancers') row[acIdx] = 'Carl Marshall';
      if (home === 'Oxford Lancers') row[hcIdx] = 'Carl Marshall';
      newRows.push(serializeCSVRow(header.map((_, idx) => row[idx] || '')));
    }
    fs.writeFileSync(gPath, newRows.join('\n') + '\n');
    console.log(`Updated 2012 games with Carl Marshall`);
  }

  // 2013 games
  {
    const gPath = 'data/BUAFL/games2013.csv';
    const lines = fs.readFileSync(gPath, 'utf-8').split('\n').filter(l => l.trim().length > 0);
    const header = parseCSVLine(lines[0]);
    const atIdx = header.findIndex(h => h.trim() === 'away_team');
    const htIdx = header.findIndex(h => h.trim() === 'home_team');
    const acIdx = header.findIndex(h => h.trim() === 'away_coach');
    const hcIdx = header.findIndex(h => h.trim() === 'home_coach');

    const newRows = [lines[0]];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const away = (row[atIdx] || '').trim();
      const home = (row[htIdx] || '').trim();
      if (away === 'Oxford Lancers') row[acIdx] = 'Carl Marshall';
      if (home === 'Oxford Lancers') row[hcIdx] = 'Carl Marshall';
      newRows.push(serializeCSVRow(header.map((_, idx) => row[idx] || '')));
    }
    fs.writeFileSync(gPath, newRows.join('\n') + '\n');
    console.log(`Updated 2013 games with Carl Marshall`);
  }

  // 2014 games (before 2015-02-01)
  {
    const gPath = 'data/BUAFL/games2014.csv';
    const lines = fs.readFileSync(gPath, 'utf-8').split('\n').filter(l => l.trim().length > 0);
    const header = parseCSVLine(lines[0]);
    const atIdx = header.findIndex(h => h.trim() === 'away_team');
    const htIdx = header.findIndex(h => h.trim() === 'home_team');
    const acIdx = header.findIndex(h => h.trim() === 'away_coach');
    const hcIdx = header.findIndex(h => h.trim() === 'home_coach');
    const dateIdx = header.findIndex(h => h.trim() === 'date');

    const newRows = [lines[0]];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const away = (row[atIdx] || '').trim();
      const home = (row[htIdx] || '').trim();
      const date = (row[dateIdx] || '').trim();

      if (date && date < '2015-02-01') {
        if (away === 'Oxford Lancers') row[acIdx] = 'Carl Marshall';
        if (home === 'Oxford Lancers') row[hcIdx] = 'Carl Marshall';
      }
      newRows.push(serializeCSVRow(header.map((_, idx) => row[idx] || '')));
    }
    fs.writeFileSync(gPath, newRows.join('\n') + '\n');
    console.log(`Updated 2014 pre-Feb games with Carl Marshall`);
  }

  console.log('\n=== Step 4: Supabase Database Synchronization ===');
  // 4a. Ensure Carl Marshall in `people`
  let carlId = null;
  const { data: existingCarl } = await supabase
    .from('people')
    .select('id')
    .eq('display_name', 'Carl Marshall')
    .maybeSingle();

  if (existingCarl) {
    carlId = existingCarl.id;
    console.log(`Found Carl Marshall person id: ${carlId}`);
  } else {
    const { data: newCarl, error: carlErr } = await supabase
      .from('people')
      .insert({
        display_name: 'Carl Marshall',
        first_name: 'Carl',
        last_name: 'Marshall'
      })
      .select('id')
      .single();

    if (carlErr) {
      console.error('Error creating Carl Marshall:', carlErr);
      process.exit(1);
    }
    carlId = newCarl.id;
    console.log(`Created Carl Marshall person id: ${carlId}`);
  }

  // 4b. Ensure Andy McKenzie id
  const { data: mckenziePerson } = await supabase
    .from('people')
    .select('id')
    .eq('display_name', 'Andy McKenzie')
    .maybeSingle();
  const mckenzieId = mckenziePerson?.id;

  // 4c. Update participations in 2012 and 2013 for Oxford Lancers
  const oxfordTeamId = 'dc8e12ef-f6dc-45b6-b412-a85bda4d6d8a';
  const part2012Id = '5baddb9d-b82f-4cfc-8b10-7ad2f9422378';
  const part2013Id = '63516c5a-dff2-4d24-9b55-ce5887ff54e5';

  const { error: p12Err } = await supabase
    .from('participations')
    .update({ head_coach_id: carlId })
    .eq('id', part2012Id);
  if (p12Err) console.error('Error updating 2012 participation:', p12Err);
  else console.log('Updated 2012 Oxford Lancers participation with Carl Marshall');

  const { error: p13Err } = await supabase
    .from('participations')
    .update({ head_coach_id: carlId })
    .eq('id', part2013Id);
  if (p13Err) console.error('Error updating 2013 participation:', p13Err);
  else console.log('Updated 2013 Oxford Lancers participation with Carl Marshall');

  // 4d. Update game_staff for Oxford Lancers games across 2012, 2013, 2014
  const { data: oxfordGames, error: gErr } = await supabase
    .from('games')
    .select('id, date, seasons(year)')
    .or(`home_team_id.eq.${oxfordTeamId},away_team_id.eq.${oxfordTeamId}`);

  if (gErr) {
    console.error('Error fetching oxford games:', gErr);
  } else {
    for (const g of oxfordGames || []) {
      const yr = g.seasons?.year;
      if (![2012, 2013, 2014].includes(yr)) continue;

      let coachId = carlId;
      if (yr === 2014 && g.date && g.date >= '2015-02-01') {
        coachId = mckenzieId;
      }

      if (!coachId) continue;

      // Check existing staff
      const { data: existingStaff } = await supabase
        .from('game_staff')
        .select('id, person_id')
        .match({
          game_id: g.id,
          team_id: oxfordTeamId,
          role: 'head_coach'
        })
        .maybeSingle();

      if (existingStaff) {
        if (existingStaff.person_id !== coachId) {
          await supabase
            .from('game_staff')
            .update({ person_id: coachId })
            .eq('id', existingStaff.id);
          console.log(`Updated game_staff for game ${g.id} (${g.date || yr}) -> ${coachId === carlId ? 'Carl Marshall' : 'Andy McKenzie'}`);
        }
      } else {
        await supabase
          .from('game_staff')
          .insert({
            game_id: g.id,
            team_id: oxfordTeamId,
            person_id: coachId,
            role: 'head_coach'
          });
        console.log(`Inserted game_staff for game ${g.id} (${g.date || yr}) -> ${coachId === carlId ? 'Carl Marshall' : 'Andy McKenzie'}`);
      }
    }
  }

  console.log('\n=== All Carl Marshall updates completed successfully! ===');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
