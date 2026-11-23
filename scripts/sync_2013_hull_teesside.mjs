import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('=== Syncing 2013/14 Teesside Cougars @ Hull Sharks to Supabase ===');

  const seasonId = '80be72d5-cce5-4814-b665-922c810646f7';
  const phaseId = '78274a3f-8212-44d1-b24c-b74e4a44df85';
  const awayTeamId = '1e558050-934a-41ec-8013-3a4fe41f5c4c';
  const homeTeamId = 'bcb71b06-08fa-45f1-8812-1c6905e80597';
  const martinGardhamId = 'beb3ef22-fca6-4740-a91c-8448e74b7923';

  const { data: existingGame, error: findErr } = await supabase
    .from('games')
    .select('id, date, away_score, home_score, confidence_level')
    .match({
      season_id: seasonId,
      away_team_id: awayTeamId,
      home_team_id: homeTeamId
    })
    .maybeSingle();

  if (findErr) throw findErr;

  let gameId = null;
  if (existingGame) {
    gameId = existingGame.id;
    console.log('Game already exists:', existingGame);
  } else {
    const { data: insertedGame, error: insertErr } = await supabase
      .from('games')
      .insert({
        season_id: seasonId,
        phase_id: phaseId,
        date: '2014-02-23',
        date_precision: 'day',
        date_display: '23/02/2014',
        away_team_id: awayTeamId,
        home_team_id: homeTeamId,
        away_score: 0,
        home_score: 37,
        status: 'completed',
        confidence_level: 'medium',
        is_playoff: false,
        is_double_header: false,
        game_type: 'league',
        game_level: 'University',
        notes: 'Shutout home win confirmed by HU17.net; 37-0 score reconciled from official 2013/14 North Eastern Conference final standings (Hull Sharks 155 PF / 87 PA across 8 games). Source: https://www.hu17.net/2014/02/27/american-football-sharks-qb-full-of-praise-for-team-mates/ & BAFRA contemporary archives'
      })
      .select('id, date, away_score, home_score, confidence_level')
      .single();

    if (insertErr) throw insertErr;
    gameId = insertedGame.id;
    console.log('Inserted game:', insertedGame);
  }

  const { data: existingStaff, error: staffFindErr } = await supabase
    .from('game_staff')
    .select('id, person_id')
    .match({
      game_id: gameId,
      team_id: homeTeamId,
      role: 'head_coach'
    })
    .maybeSingle();

  if (staffFindErr) throw staffFindErr;

  if (existingStaff) {
    if (existingStaff.person_id !== martinGardhamId) {
      const { error: updErr } = await supabase
        .from('game_staff')
        .update({ person_id: martinGardhamId })
        .eq('id', existingStaff.id);
      if (updErr) throw updErr;
    }
    console.log('Verified/updated game_staff for Martin Gardham:', existingStaff.id);
  } else {
    const { data: insertedStaff, error: insErr } = await supabase
      .from('game_staff')
      .insert({
        game_id: gameId,
        team_id: homeTeamId,
        person_id: martinGardhamId,
        role: 'head_coach'
      })
      .select('id, game_id, team_id, person_id, role')
      .single();

    if (insErr) throw insErr;
    console.log('Inserted game_staff for Martin Gardham:', insertedStaff);
  }

  console.log('=== Sync Complete ===');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
