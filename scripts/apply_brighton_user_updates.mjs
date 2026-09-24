import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== APPLYING BRIGHTON USER REQUESTED UPDATES ===\n');

  // ----------------------------------------------------
  // 1. 2014/15 Herts Game Score (78-0)
  // ----------------------------------------------------
  console.log('1. Updating 2014/15 Herts vs Brighton game score to 78-0...');
  
  // CSV 1: data/BUAFL/games2014.csv
  const csv2014Path = 'data/BUAFL/games2014.csv';
  if (fs.existsSync(csv2014Path)) {
    const raw = fs.readFileSync(csv2014Path, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true });
    for (const r of records) {
      if (r.date === '2015-02-15' && (r.home_team.includes('Hertfordshire') || r.away_team.includes('Hertfordshire'))) {
        r.home_score = '78';
        r.away_score = '0';
        r.notes = 'Some sources have 73-0 as the score but 78-0 is verified as correct.';
        console.log('   Updated data/BUAFL/games2014.csv record.');
      }
    }
    fs.writeFileSync(csv2014Path, stringify(records, { header: true }));
  }

  // CSV 2: data/gamesbrighton.csv
  const gbPath = 'data/gamesbrighton.csv';
  if (fs.existsSync(gbPath)) {
    const raw = fs.readFileSync(gbPath, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true });
    for (const r of records) {
      if (r.year === '2014' && r.date === '15/02/2015') {
        r.home_score = '78';
        r.away_score = '0';
        r.notes = 'Some sources have 73-0 as the score but 78-0 is verified as correct.';
        console.log('   Updated data/gamesbrighton.csv 2014 Herts record.');
      }
    }
    fs.writeFileSync(gbPath, stringify(records, { header: true }));
  }

  // DB update for 2014 game
  const { data: g2014 } = await supabase
    .from('games')
    .select('id, date, home_score, away_score')
    .eq('date', '2015-02-15');
  if (g2014 && g2014.length > 0) {
    await supabase.from('games').update({
      home_score: 78,
      away_score: 0,
      notes: 'Some sources have 73-0 as the score but 78-0 is verified as correct.'
    }).eq('id', g2014[0].id);
    console.log('   Updated DB game record for 2015-02-15.');
  }

  // ----------------------------------------------------
  // 2. 2018/19 Season Dates
  // ----------------------------------------------------
  console.log('\n2. Updating 2018/19 dates in games2018.csv...');
  const csv2018Path = 'data/BUAFL/games2018.csv';
  if (fs.existsSync(csv2018Path)) {
    const raw = fs.readFileSync(csv2018Path, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true });
    for (const r of records) {
      // 14-8 game: Brighton vs Reading -> 2019-02-23
      if (r.home_score === '14' && r.away_score === '8' && (r.home_team.includes('Brighton') || r.away_team.includes('Brighton'))) {
        r.date = '2019-02-23';
        console.log('   Updated 14-8 game date to 2019-02-23 in games2018.csv');
      }
      // 22-16 game: Reading vs Brighton -> 2019-01-27
      if (r.home_score === '22' && r.away_score === '16' && (r.home_team.includes('Brighton') || r.away_team.includes('Brighton'))) {
        r.date = '2019-01-27';
        console.log('   Updated 22-16 game date to 2019-01-27 in games2018.csv');
      }
    }
    fs.writeFileSync(csv2018Path, stringify(records, { header: true }));
  }

  // DB update for 2018 games
  const { data: g2018_1 } = await supabase.from('games').select('id').eq('date', '2019-01-26');
  if (g2018_1 && g2018_1.length > 0) {
    await supabase.from('games').update({ date: '2019-02-23' }).eq('id', g2018_1[0].id);
    console.log('   Updated DB game date 2019-01-26 -> 2019-02-23.');
  }
  const { data: g2018_2 } = await supabase.from('games').select('id').eq('date', '2019-02-24');
  if (g2018_2 && g2018_2.length > 0) {
    await supabase.from('games').update({ date: '2019-01-27' }).eq('id', g2018_2[0].id);
    console.log('   Updated DB game date 2019-02-24 -> 2019-01-27.');
  }

  // ----------------------------------------------------
  // 3. 2019/20 Season Dates
  // ----------------------------------------------------
  console.log('\n3. Updating 2019/20 dates in games2019.csv...');
  const csv2019Path = 'data/BUAFL/games2019.csv';
  if (fs.existsSync(csv2019Path)) {
    const raw = fs.readFileSync(csv2019Path, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true });
    for (const r of records) {
      if (r.home_team.includes('Brighton') || r.away_team.includes('Brighton')) {
        if (r.date === '2019-11-17') r.date = '2019-11-16';
        else if (r.date === '2020-01-26') r.date = '2020-01-25';
        else if (r.date === '2020-02-02') r.date = '2020-02-01';
        else if (r.date === '2020-02-16') r.date = '2020-02-15';
      }
    }
    fs.writeFileSync(csv2019Path, stringify(records, { header: true }));
    console.log('   Updated games2019.csv dates for Brighton.');
  }

  // Update DB 2019 games
  const dateMap2019 = {
    '2019-11-17': '2019-11-16',
    '2020-01-26': '2020-01-25',
    '2020-02-02': '2020-02-01',
    '2020-02-16': '2020-02-15'
  };
  for (const [oldD, newD] of Object.entries(dateMap2019)) {
    const { data: gList } = await supabase.from('games').select('id, home_team_id, away_team_id').eq('date', oldD);
    if (gList && gList.length > 0) {
      for (const g of gList) {
        await supabase.from('games').update({ date: newD }).eq('id', g.id);
        console.log(`   Updated DB date ${oldD} -> ${newD}.`);
      }
    }
  }

  // ----------------------------------------------------
  // 4. 2023/24 Surrey Game Score (28-20 win for Brighton)
  // ----------------------------------------------------
  console.log('\n4. Verifying/updating 2023/24 Brighton vs Surrey game score (28-20)...');
  const csv2023Path = 'data/BUAFL/games2023.csv';
  if (fs.existsSync(csv2023Path)) {
    const raw = fs.readFileSync(csv2023Path, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true });
    for (const r of records) {
      if (r.date === '2024-01-28' && (r.home_team.includes('Brighton') || r.away_team.includes('Brighton'))) {
        r.home_team = 'Brighton Panthers';
        r.away_team = 'Surrey Stingers';
        r.home_score = '28';
        r.away_score = '20';
        r.status = 'completed';
      }
    }
    fs.writeFileSync(csv2023Path, stringify(records, { header: true }));
    console.log('   Updated data/BUAFL/games2023.csv 28/01/2024 score.');
  }

  // Update DB for 2024-01-28 Brighton vs Surrey
  const { data: g2023 } = await supabase.from('games').select('id').eq('date', '2024-01-28');
  if (g2023 && g2023.length > 0) {
    await supabase.from('games').update({
      home_score: 28,
      away_score: 20,
      status: 'completed'
    }).eq('id', g2023[0].id);
    console.log('   Updated DB game record for 2024-01-28.');
  }

  // ----------------------------------------------------
  // 5. 2024/25 Oxford Lancers Away Game Cancelled
  // ----------------------------------------------------
  console.log('\n5. Updating 2024/25 Oxford Lancers Away Game status to cancelled...');
  const csv2024Path = 'data/BUAFL/games2024.csv';
  if (fs.existsSync(csv2024Path)) {
    const raw = fs.readFileSync(csv2024Path, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true });
    for (const r of records) {
      if (r.date === '2025-01-29' && r.home_team.includes('Oxford Lancers')) {
        r.status = 'cancelled';
        r.home_score = '';
        r.away_score = '';
        r.notes = 'Game was cancelled rather than awarded and did not affect any standings.';
        console.log('   Updated data/BUAFL/games2024.csv 2025-01-29 record.');
      }
    }
    fs.writeFileSync(csv2024Path, stringify(records, { header: true }));
  }

  // DB update for 2025-01-29 game
  const { data: g2024 } = await supabase.from('games').select('id').eq('date', '2025-01-29');
  if (g2024 && g2024.length > 0) {
    await supabase.from('games').update({
      status: 'cancelled',
      home_score: null,
      away_score: null,
      notes: 'Game was cancelled rather than awarded and did not affect any standings.'
    }).eq('id', g2024[0].id);
    console.log('   Updated DB game record for 2025-01-29 to cancelled.');
  }

  console.log('\n=== ALL UPDATES APPLIED SUCCESSFULLY ===');
}

main().catch(console.error);
