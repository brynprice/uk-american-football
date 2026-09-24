import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function syncDB() {
  console.log('=== SYNCING SUPABASE DB WITH UPDATED GAME RECORDS ===\n');

  // 1. 2014/15 Herts vs Brighton (78-0)
  const { data: g2014 } = await supabase
    .from('games')
    .select('id')
    .eq('date', '2015-02-15');
  if (g2014 && g2014.length > 0) {
    await supabase.from('games').update({
      home_score: 78,
      away_score: 0,
      notes: 'Some sources have 73-0 as the score but 78-0 is verified as correct.'
    }).eq('id', g2014[0].id);
    console.log('✓ Updated DB 2015-02-15 game: Herts vs Brighton 78-0 with verification note.');
  }

  // 2. 2018/19 Dates
  const { data: g2018_1 } = await supabase.from('games').select('id').eq('date', '2019-01-26');
  if (g2018_1 && g2018_1.length > 0) {
    await supabase.from('games').update({ date: '2019-02-23' }).eq('id', g2018_1[0].id);
    console.log('✓ Updated DB 2018 game date: 2019-01-26 -> 2019-02-23.');
  }
  const { data: g2018_2 } = await supabase.from('games').select('id').eq('date', '2019-02-24');
  if (g2018_2 && g2018_2.length > 0) {
    await supabase.from('games').update({ date: '2019-01-27' }).eq('id', g2018_2[0].id);
    console.log('✓ Updated DB 2018 game date: 2019-02-24 -> 2019-01-27.');
  }

  // 3. 2019/20 Dates
  const dateMap2019 = {
    '2019-11-17': '2019-11-16',
    '2020-01-26': '2020-01-25',
    '2020-02-02': '2020-02-01',
    '2020-02-16': '2020-02-15'
  };
  for (const [oldD, newD] of Object.entries(dateMap2019)) {
    const { data: gList } = await supabase.from('games').select('id').eq('date', oldD);
    if (gList && gList.length > 0) {
      for (const g of gList) {
        await supabase.from('games').update({ date: newD }).eq('id', g.id);
        console.log(`✓ Updated DB 2019 game date: ${oldD} -> ${newD}.`);
      }
    }
  }

  // 4. 2023/24 Surrey Game Score (28-20 win for Brighton)
  const { data: g2023 } = await supabase.from('games').select('id').eq('date', '2024-01-28');
  if (g2023 && g2023.length > 0) {
    await supabase.from('games').update({
      home_score: 28,
      away_score: 20,
      status: 'completed'
    }).eq('id', g2023[0].id);
    console.log('✓ Updated DB 2024-01-28 game: Brighton Panthers 28, Surrey Stingers 20.');
  }

  // 5. 2024/25 Oxford Lancers Away Game (Cancelled)
  const { data: g2024 } = await supabase.from('games').select('id').eq('date', '2025-01-29');
  if (g2024 && g2024.length > 0) {
    await supabase.from('games').update({
      status: 'cancelled',
      home_score: null,
      away_score: null,
      notes: 'Game was cancelled rather than awarded and did not affect any standings.'
    }).eq('id', g2024[0].id);
    console.log('✓ Updated DB 2025-01-29 game: Oxford Lancers vs Brighton Panthers set to cancelled with note.');
  }

  console.log('\n=== DB SYNC COMPLETED SUCCESSFULLY ===');
}

syncDB().catch(console.error);
