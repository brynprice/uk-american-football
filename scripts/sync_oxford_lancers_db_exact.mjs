import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const BUAFL_SEASONS = {
  2011: '60c4fa58-3675-47f9-ad47-bef29f3d0f5c',
  2012: 'd4e61940-f44a-4b9a-84e7-23d01db775be',
  2013: '80be72d5-cce5-4814-b665-922c810646f7',
  2014: '54c09a7b-ed8c-4a05-9b07-09c4df7e3aaf',
  2015: 'edcf6aa4-3109-41e5-84dd-58949894d6ab',
  2016: 'ed48c77d-b45b-4aad-99a3-a5c403d9b59b',
  2017: 'ca55bb7f-9681-49f9-b1b8-dd8f34e82eda',
  2018: '8afa2570-a5b8-4fa9-bdcc-900847cd35ee',
  2019: '44968ca2-4cc2-4381-9fdd-edc5c04c92d5',
  2020: 'f0890a25-ab1a-4773-9397-5ec0ba7d3676',
  2021: 'bed7f73b-de98-4e65-897b-abde26b9ea83',
  2022: 'e55554cd-5a75-4b5c-b853-5ed6afb34453',
  2023: 'd3284a58-cdb4-41c5-9688-d9f84d367e3e',
  2024: '6820cd9d-4f28-41f9-9ba0-3026f0736eec',
  2025: 'bae0848d-0776-418b-bf3b-48d2e78b057e',
  2026: '1f2d75df-a1f4-4884-ab7c-b6c07c137083'
};

async function run() {
  console.log('--- Syncing Exact Oxford Updates to Supabase ---');

  const { data: oxfordTeam } = await supabase.from('teams').select('id, name').ilike('name', '%oxford lancers%').single();
  const { data: pythonsTeam } = await supabase.from('teams').select('id, name').ilike('name', '%cambridge pythons%').single();
  const { data: brunelTeam } = await supabase.from('teams').select('id, name').ilike('name', '%brunel burners%').single();
  const { data: portsmouthTeam } = await supabase.from('teams').select('id, name').ilike('name', '%portsmouth destroyers%').single();
  const { data: rhulTeam } = await supabase.from('teams').select('id, name').ilike('name', '%royal holloway bears%').single();
  const { data: bnuTeam } = await supabase.from('teams').select('id, name').ilike('name', '%bnu buccaneers%').single();
  const { data: solentTeam } = await supabase.from('teams').select('id, name').ilike('name', '%solent redhawks%').single();
  const { data: brightonTeam } = await supabase.from('teams').select('id, name').or('name.ilike.%brighton panthers%,name.ilike.%brighton tsunami%').limit(1).single();
  const { data: readingTeam } = await supabase.from('teams').select('id, name').ilike('name', '%reading knights%').single();
  const { data: aruTeam } = await supabase.from('teams').select('id, name').ilike('name', '%anglia ruskin siege%').single();
  const { data: bristolTeam } = await supabase.from('teams').select('id, name').ilike('name', '%bristol barracuda%').single();
  const { data: brookesTeam } = await supabase.from('teams').select('id, name').ilike('name', '%oxford brookes%').single();
  const { data: bournemouthTeam } = await supabase.from('teams').select('id, name').ilike('name', '%bournemouth%bobcats%').single();
  const { data: gladiatorsTeam } = await supabase.from('teams').select('id, name').ilike('name', '%gloucestershire gladiators%').single();
  const { data: hertsTeam } = await supabase.from('teams').select('id, name').ilike('name', '%hertfordshire hurricanes%').single();

  console.log(`Oxford Lancers ID: ${oxfordTeam.id}`);

  // 1. Delete 2012 Portsmouth Destroyers @ Oxford Lancers
  if (portsmouthTeam) {
    const { data: delP } = await supabase.from('games')
      .delete()
      .eq('season_id', BUAFL_SEASONS[2012])
      .or(`and(home_team_id.eq.${oxfordTeam.id},away_team_id.eq.${portsmouthTeam.id}),and(home_team_id.eq.${portsmouthTeam.id},away_team_id.eq.${oxfordTeam.id})`)
      .select();
    console.log(`Deleted 2012 Portsmouth game(s):`, delP?.length);
  }

  // 2. Delete 2012 Royal Holloway Bears @ Oxford Lancers
  if (rhulTeam) {
    const { data: delR } = await supabase.from('games')
      .delete()
      .eq('season_id', BUAFL_SEASONS[2012])
      .or(`and(home_team_id.eq.${oxfordTeam.id},away_team_id.eq.${rhulTeam.id}),and(home_team_id.eq.${rhulTeam.id},away_team_id.eq.${oxfordTeam.id})`)
      .select();
    console.log(`Deleted 2012 RHUL game(s):`, delR?.length);
  }

  // 3. Move 2011 Brunel game to 2012 as friendly
  if (brunelTeam) {
    const { data: brunel2011 } = await supabase.from('games')
      .select('id, notes')
      .eq('season_id', BUAFL_SEASONS[2011])
      .or(`and(home_team_id.eq.${oxfordTeam.id},away_team_id.eq.${brunelTeam.id}),and(home_team_id.eq.${brunelTeam.id},away_team_id.eq.${oxfordTeam.id})`)
      .maybeSingle();

    if (brunel2011) {
      await supabase.from('games').update({
        season_id: BUAFL_SEASONS[2012],
        phase_id: null,
        game_type: 'friendly',
        notes: 'Source: Oxford Lancers historic database / BUCS contemporary records'
      }).eq('id', brunel2011.id);
      console.log('Moved Brunel game to 2012 in Supabase');
    }
  }

  // 4. Update 2012 BNU game to 82-0 BNU win
  if (bnuTeam) {
    const { data: bnuGame } = await supabase.from('games')
      .select('id')
      .eq('season_id', BUAFL_SEASONS[2012])
      .or(`and(home_team_id.eq.${oxfordTeam.id},away_team_id.eq.${bnuTeam.id}),and(home_team_id.eq.${bnuTeam.id},away_team_id.eq.${oxfordTeam.id})`)
      .maybeSingle();

    if (bnuGame) {
      await supabase.from('games').update({
        home_score: 0,
        away_score: 82,
        status: 'completed',
        notes: 'Oxford Lancers historic database records on-field 82-0 blowout (officially voided by BUCS). Source: Oxford Lancers historic database'
      }).eq('id', bnuGame.id);
      console.log('Updated 2012 BNU game to 82-0 completed in Supabase');
    }
  }

  // 5. Notes for scoreline discrepancies
  const noteUpdates = [
    { year: 2012, oppId: solentTeam?.id, note: '[Oxford Lancers historic database records score as 0-28]' },
    { year: 2012, oppId: brightonTeam?.id, note: '[Oxford Lancers historic database records score as 0-27, matching BUCS official records]' },
    { year: 2012, oppId: readingTeam?.id, note: '[Oxford Lancers historic database records score as 0-20]' },
    { year: 2013, oppId: readingTeam?.id, note: '[Oxford Lancers historic database records on-field score as 0-22]' },
    { year: 2013, oppId: portsmouthTeam?.id, note: '[Oxford Lancers historic database records score as 6-33]' },
    { year: 2013, oppId: solentTeam?.id, note: '[Oxford Lancers historic database records score as 0-66]' },
    { year: 2014, oppId: aruTeam?.id, note: '[Oxford Lancers historic database records score as 62-0]' },
    { year: 2017, oppId: bristolTeam?.id, note: '[Oxford Lancers historic database records score as 26-0]' },
    { year: 2017, oppId: brookesTeam?.id, note: '[Oxford Lancers historic database records score as 7-27]' },
    { year: 2017, oppId: bournemouthTeam?.id, note: '[Oxford Lancers historic database records score as 22-20]' },
    { year: 2018, oppId: gladiatorsTeam?.id, note: '[Oxford Lancers historic database records score as 37-14]' },
    { year: 2024, oppId: hertsTeam?.id, date: '2025-02-09', note: '[Oxford Lancers historic database records score as 36-6]' },
    { year: 2025, oppId: hertsTeam?.id, date: '2026-02-01', note: '[Oxford Lancers historic database records score as 7-35]' }
  ];

  for (const upd of noteUpdates) {
    if (!upd.oppId) continue;
    let query = supabase.from('games').select('id, notes')
      .eq('season_id', BUAFL_SEASONS[upd.year])
      .or(`and(home_team_id.eq.${oxfordTeam.id},away_team_id.eq.${upd.oppId}),and(home_team_id.eq.${upd.oppId},away_team_id.eq.${oxfordTeam.id})`);
    if (upd.date) query = query.eq('date', upd.date);

    const { data: gList } = await query;
    if (gList && gList.length > 0) {
      for (const g of gList) {
        if (!g.notes || !g.notes.includes(upd.note)) {
          const newNotes = (g.notes ? g.notes + ' ' : '') + upd.note;
          await supabase.from('games').update({ notes: newNotes }).eq('id', g.id);
          console.log(`Updated notes for ${upd.year} game (id: ${g.id})`);
        }
      }
    }
  }

  // 6. Update 2026-11-08 vs Herts
  if (hertsTeam) {
    const { data: g2026 } = await supabase.from('games')
      .select('id')
      .eq('season_id', BUAFL_SEASONS[2026])
      .eq('date', '2026-11-08')
      .eq('home_team_id', oxfordTeam.id)
      .eq('away_team_id', hertsTeam.id)
      .maybeSingle();

    if (g2026) {
      await supabase.from('games').update({
        home_score: 23,
        away_score: 6,
        status: 'completed',
        notes: 'Source: Oxford Lancers historic database'
      }).eq('id', g2026.id);
      console.log('Updated 2026-11-08 vs Herts to completed (23-6)');
    }
  }

  // 7. Upsert all Varsity Bowl fixtures
  const varsityGames = [
    { year: 2012, us: 13, them: 20, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database' },
    { year: 2013, us: 6, them: 33, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database' },
    { year: 2015, us: 49, them: 0, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database' },
    { year: 2016, us: 14, them: 20, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup (Double OT). Source: Oxford Lancers historic database' },
    { year: 2017, us: 48, them: 6, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database' },
    { year: 2018, us: 19, them: 9, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database' },
    { year: 2019, us: 0, them: 0, status: 'cancelled', notes: 'Varsity Bowl / Cavalier Cup (Cancelled due to COVID-19). Source: Oxford Lancers historic database' },
    { year: 2020, us: 36, them: 0, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database' },
    { year: 2021, us: 12, them: 14, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database' },
    { year: 2022, us: 41, them: 7, date: '2023-05-13', status: 'completed', notes: 'Varsity Bowl / Cavalier Cup (Varsity Bowl XVI). Source: Oxford Lancers historic database' },
    { year: 2023, us: 48, them: 3, date: '2024-05-12', status: 'completed', notes: 'Varsity Bowl / Cavalier Cup (Varsity Bowl XVII). Source: Oxford Lancers historic database' },
    { year: 2024, us: 48, them: 0, date: '2025-05-11', status: 'completed', notes: 'Varsity Bowl / Cavalier Cup (Varsity Bowl XVIII). Source: Oxford Lancers historic database' },
    { year: 2025, us: 12, them: 26, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup (Varsity Bowl XIX). Source: Oxford Lancers historic database' }
  ];

  for (const vg of varsityGames) {
    const seasonId = BUAFL_SEASONS[vg.year];
    const { data: existing } = await supabase.from('games')
      .select('id')
      .eq('season_id', seasonId)
      .eq('home_team_id', oxfordTeam.id)
      .eq('away_team_id', pythonsTeam.id)
      .maybeSingle();

    const gameRecord = {
      season_id: seasonId,
      date: vg.date || null,
      date_precision: vg.date ? 'day' : 'season',
      home_team_id: oxfordTeam.id,
      away_team_id: pythonsTeam.id,
      home_score: vg.us,
      away_score: vg.them,
      phase_id: null,
      game_type: 'friendly',
      status: vg.status,
      title_name: 'Varsity Bowl',
      nickname: 'Varsity Bowl',
      notes: vg.notes
    };

    if (existing) {
      await supabase.from('games').update(gameRecord).eq('id', existing.id);
      console.log(`Updated Varsity Bowl in DB for ${vg.year}`);
    } else {
      await supabase.from('games').insert(gameRecord);
      console.log(`Inserted Varsity Bowl in DB for ${vg.year}`);
    }
  }

  console.log('--- All Supabase sync operations successfully finished ---');
}

run();
