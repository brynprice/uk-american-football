import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('--- Syncing Oxford Lancers Updates to Supabase ---');

  // 1. Get team IDs
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

  console.log('Oxford team id:', oxfordTeam?.id);

  // 2. Remove 2012 Portsmouth @ Oxford
  if (portsmouthTeam) {
    const { data: pGame, error: pErr } = await supabase.from('games')
      .delete()
      .eq('year', 2012)
      .or(`and(home_team_id.eq.${oxfordTeam.id},away_team_id.eq.${portsmouthTeam.id}),and(home_team_id.eq.${portsmouthTeam.id},away_team_id.eq.${oxfordTeam.id})`)
      .select();
    console.log('Deleted 2012 Portsmouth game:', pGame?.length);
  }

  // 3. Remove 2012 RHUL @ Oxford voided
  if (rhulTeam) {
    const { data: rGame, error: rErr } = await supabase.from('games')
      .delete()
      .eq('year', 2012)
      .or(`and(home_team_id.eq.${oxfordTeam.id},away_team_id.eq.${rhulTeam.id}),and(home_team_id.eq.${rhulTeam.id},away_team_id.eq.${oxfordTeam.id})`)
      .select();
    console.log('Deleted 2012 Royal Holloway game:', rGame?.length);
  }

  // 4. Update 2012 BNU blowout (82-0 BNU win)
  if (bnuTeam) {
    const { data: bnuGame } = await supabase.from('games')
      .select('id, notes')
      .eq('year', 2012)
      .or(`and(home_team_id.eq.${oxfordTeam.id},away_team_id.eq.${bnuTeam.id}),and(home_team_id.eq.${bnuTeam.id},away_team_id.eq.${oxfordTeam.id})`)
      .maybeSingle();

    if (bnuGame) {
      await supabase.from('games').update({
        pts_home: 0,
        pts_away: 82,
        status: 'completed',
        notes: 'Oxford Lancers historic database records on-field 82-0 blowout (officially voided by BUCS). Source: Oxford Lancers historic database'
      }).eq('id', bnuGame.id);
      console.log('Updated 2012 BNU game to 82-0');
    }
  }

  // 5. Move 2011 Brunel game to 2012 as friendly
  if (brunelTeam) {
    const { data: brunel2011 } = await supabase.from('games')
      .select('id, notes')
      .eq('year', 2011)
      .or(`and(home_team_id.eq.${oxfordTeam.id},away_team_id.eq.${brunelTeam.id}),and(home_team_id.eq.${brunelTeam.id},away_team_id.eq.${oxfordTeam.id})`)
      .maybeSingle();

    if (brunel2011) {
      await supabase.from('games').update({
        year: 2012,
        phase_id: null,
        game_type: 'friendly',
        notes: 'Source: Oxford Lancers historic database / BUCS contemporary records'
      }).eq('id', brunel2011.id);
      console.log('Moved 2011 Brunel game to 2012');
    }
  }

  // 6. Update notes for scoreline discrepancies
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
      .eq('year', upd.year)
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

  // 7. Update 2026-11-08 fixture vs Herts
  if (hertsTeam) {
    const { data: g2026 } = await supabase.from('games')
      .select('id')
      .eq('year', 2026)
      .eq('date', '2026-11-08')
      .eq('home_team_id', oxfordTeam.id)
      .eq('away_team_id', hertsTeam.id)
      .maybeSingle();

    if (g2026) {
      await supabase.from('games').update({
        pts_home: 23,
        pts_away: 6,
        status: 'completed',
        notes: 'Source: Oxford Lancers historic database'
      }).eq('id', g2026.id);
      console.log('Updated 2026-11-08 vs Herts to completed (23-6)');
    }
  }

  // 8. Upsert Varsity Bowl games
  const varsityGames = [
    { year: 2012, us: 13, them: 20, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database' },
    { year: 2013, us: 6, them: 33, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database' },
    { year: 2015, us: 49, them: 0, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database' },
    { year: 2016, us: 14, them: 20, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup (Double OT). Source: Oxford Lancers historic database' },
    { year: 2017, us: 48, them: 6, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database' },
    { year: 2018, us: 19, them: 9, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database' },
    { year: 2019, us: null, them: null, status: 'cancelled', notes: 'Varsity Bowl / Cavalier Cup (Cancelled due to COVID-19). Source: Oxford Lancers historic database' },
    { year: 2020, us: 36, them: 0, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database' },
    { year: 2021, us: 12, them: 14, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database' },
    { year: 2022, us: 41, them: 7, date: '2023-05-13', status: 'completed', notes: 'Varsity Bowl / Cavalier Cup (Varsity Bowl XVI). Source: Oxford Lancers historic database' },
    { year: 2023, us: 48, them: 3, date: '2024-05-12', status: 'completed', notes: 'Varsity Bowl / Cavalier Cup (Varsity Bowl XVII). Source: Oxford Lancers historic database' },
    { year: 2024, us: 48, them: 0, date: '2025-05-11', status: 'completed', notes: 'Varsity Bowl / Cavalier Cup (Varsity Bowl XVIII). Source: Oxford Lancers historic database' },
    { year: 2025, us: 12, them: 26, status: 'completed', notes: 'Varsity Bowl / Cavalier Cup (Varsity Bowl XIX). Source: Oxford Lancers historic database' }
  ];

  for (const vg of varsityGames) {
    // Check if season exists in seasons table
    const { data: seasonObj } = await supabase.from('seasons').select('id').eq('year', vg.year).maybeSingle();
    
    // Check if already in games
    const { data: existing } = await supabase.from('games')
      .select('id')
      .eq('year', vg.year)
      .eq('home_team_id', oxfordTeam.id)
      .eq('away_team_id', pythonsTeam.id)
      .maybeSingle();

    const gameRecord = {
      season_id: seasonObj?.id || null,
      year: vg.year,
      date: vg.date || null,
      home_team_id: oxfordTeam.id,
      away_team_id: pythonsTeam.id,
      pts_home: vg.us,
      pts_away: vg.them,
      phase_id: null,
      game_type: 'friendly',
      status: vg.status,
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

  console.log('--- Database Sync Completed ---');
}

run();
