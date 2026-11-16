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
  console.log('=== ADDING SURREY 1-0 WALKOVER WIN OVER OXFORD (2013/14) ===\n');

  const g13Path = 'data/BUAFL/games2013.csv';
  const g13Lines = fs.readFileSync(g13Path, 'utf-8').split('\n').filter(l => l.trim().length > 0);
  const g13Header = parseCSVLine(g13Lines[0]);

  // Check if already in games2013.csv
  const alreadyExists = g13Lines.some(l => l.includes('Surrey Stingers') && l.includes('Oxford Lancers'));
  if (alreadyExists) {
    console.log('Fixture already exists in games2013.csv!');
  } else {
    const walkoverRow = {
      competition: 'BUAFL',
      year: '2013',
      phase: 'South Coast Conference',
      date: '',
      away_team: 'Oxford Lancers',
      home_team: 'Surrey Stingers',
      away_score: '0',
      home_score: '1',
      venue: '',
      notes: 'Unplayed walkover conceded by Oxford Lancers; awarded 1-0 win to Surrey Stingers per league regulations. Source: BAFRA contemporary records & BUAFL South Coast Conference standings',
      away_coach: '',
      home_coach: '',
      is_double_header: 'FALSE',
      date_precision: 'season',
      date_display: '',
      time: '',
      status: 'awarded',
      confidence_level: 'high',
      is_playoff: 'FALSE',
      is_title_game: 'FALSE',
      final_type: '',
      title_name: '',
      nickname: '',
      playoff_round: '',
      parent_phase: '',
      away_phase: '',
      away_parent_phase: ''
    };

    g13Lines.push(serializeCSVRow(g13Header.map(h => walkoverRow[h.trim()] || '')));
    fs.writeFileSync(g13Path, g13Lines.join('\n') + '\n');
    console.log(`Successfully appended walkover to ${g13Path} (total games now: ${g13Lines.length - 1})`);
  }

  // 2. Add to Supabase
  const s13Id = '80be72d5-cce5-4814-b665-922c810646f7';
  const phaseId = 'e129092e-3810-4ac4-b5b6-1480cbf12382'; // South Coast Conference
  const surreyId = '5d960c03-f506-4095-b0e7-e027c5f03056';
  const oxfordId = 'dc8e12ef-f6dc-45b6-b412-a85bda4d6d8a';

  const { data: existingG } = await supabase.from('games')
    .select('id')
    .eq('season_id', s13Id)
    .eq('home_team_id', surreyId)
    .eq('away_team_id', oxfordId)
    .maybeSingle();

  if (existingG) {
    await supabase.from('games').update({
      home_score: 1,
      away_score: 0,
      status: 'awarded',
      notes: 'Unplayed walkover conceded by Oxford Lancers; awarded 1-0 win to Surrey Stingers per league regulations. Source: BAFRA contemporary records & BUAFL South Coast Conference standings'
    }).eq('id', existingG.id);
    console.log(`Updated existing walkover record in Supabase (ID: ${existingG.id})`);
  } else {
    const { data: inserted, error: insErr } = await supabase.from('games').insert({
      season_id: s13Id,
      phase_id: phaseId,
      home_team_id: surreyId,
      away_team_id: oxfordId,
      home_score: 1,
      away_score: 0,
      date: null,
      date_precision: 'season',
      status: 'awarded',
      confidence_level: 'high',
      is_playoff: false,
      notes: 'Unplayed walkover conceded by Oxford Lancers; awarded 1-0 win to Surrey Stingers per league regulations. Source: BAFRA contemporary records & BUAFL South Coast Conference standings'
    }).select('id');

    if (insErr) {
      console.error('Error inserting walkover in Supabase:', insErr.message);
    } else {
      console.log(`Inserted walkover into Supabase (ID: ${inserted[0]?.id})`);
    }
  }

  // 3. Count verification
  const { count: finalCount } = await supabase.from('games')
    .select('*', { count: 'exact', head: true })
    .eq('season_id', s13Id);

  console.log(`\n=== 2013 FIXTURE COUNT VERIFICATION ===`);
  console.log(`games2013.csv total fixtures:  ${g13Lines.length - 1}`);
  console.log(`Supabase 2013 total fixtures:   ${finalCount}`);
}

run().catch(console.error);
