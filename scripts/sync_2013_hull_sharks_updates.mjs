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
  console.log('=== Syncing 2013/14 Hull Sharks Updates to Supabase ===');

  const seasonId = '80be72d5-cce5-4814-b665-922c810646f7';
  const trophyPlayoffsPhaseId = '093afa70-ef1a-48ba-9941-aa3b6b2025d3';
  const hullTeamId = 'bcb71b06-08fa-45f1-8812-1c6905e80597';
  const ljmuTeamId = 'e1bdfbf0-5d88-4d3c-82a2-f8edb70290c1';
  const martinGardhamId = 'beb3ef22-fca6-4740-a91c-8448e74b7923';
  const participationIds = [
    'd113b163-ddda-4398-80ab-9dcbcc41598d',
    'f1e1b05c-9848-4492-a68d-5f5a52ca4e7e'
  ];
  const proposalId = '03252071-7881-48e6-a7d0-95029388421b';

  // Verify proposal is still pending
  const { data: proposalCheck, error: propCheckErr } = await supabase
    .from('game_proposals')
    .select('id, status')
    .eq('id', proposalId)
    .single();

  if (propCheckErr) throw propCheckErr;
  if (!proposalCheck || proposalCheck.status !== 'pending') {
    console.error(`Proposal ${proposalId} is no longer pending (status: ${proposalCheck?.status}).`);
    process.exit(2);
  }

  // 1. Insert game (idempotent check first)
  let gameId = null;
  const { data: existingGame, error: findGameErr } = await supabase
    .from('games')
    .select('id, date, away_score, home_score, playoff_round')
    .match({
      season_id: seasonId,
      away_team_id: ljmuTeamId,
      home_team_id: hullTeamId,
      date: '2014-03-09'
    })
    .maybeSingle();

  if (findGameErr) throw findGameErr;

  if (existingGame) {
    gameId = existingGame.id;
    console.log('Game already exists:', existingGame);
  } else {
    const { data: insertedGame, error: insertGameErr } = await supabase
      .from('games')
      .insert({
        season_id: seasonId,
        phase_id: trophyPlayoffsPhaseId,
        date: '2014-03-09',
        date_precision: 'day',
        date_display: '09/03/2014',
        away_team_id: ljmuTeamId,
        home_team_id: hullTeamId,
        away_score: 12,
        home_score: 16,
        status: 'completed',
        confidence_level: 'high',
        is_playoff: true,
        final_type: 'playoff',
        playoff_round: 'Wild Card',
        is_double_header: false,
        game_type: 'league',
        game_level: 'University',
        notes: 'Source: https://www.hu17.net/2014/03/09/american-football-eric-gui-touch-down-sends-sharks-through/'
      })
      .select('id, date, away_score, home_score, playoff_round')
      .single();

    if (insertGameErr) throw insertGameErr;
    gameId = insertedGame.id;
    console.log('Inserted game:', insertedGame);
  }

  // 2. Update Hull Sharks 2013 participations
  const { data: updatedParts, error: partErr } = await supabase
    .from('participations')
    .update({ head_coach_id: martinGardhamId })
    .in('id', participationIds)
    .select('id, phase_id, head_coach_id');

  if (partErr) throw partErr;
  console.log('Updated Hull Sharks 2013 participations:', updatedParts);

  // 3. Sync game_staff for all 2013 Hull Sharks games
  const { data: hullGames, error: gamesErr } = await supabase
    .from('games')
    .select('id, date, away_team_id, home_team_id')
    .eq('season_id', seasonId)
    .or(`home_team_id.eq.${hullTeamId},away_team_id.eq.${hullTeamId}`);

  if (gamesErr) throw gamesErr;
  console.log(`Found ${hullGames.length} Hull Sharks games in 2013 season.`);

  let staffSynced = 0;
  for (const g of hullGames) {
    const { data: existingStaff, error: staffFindErr } = await supabase
      .from('game_staff')
      .select('id, person_id')
      .match({
        game_id: g.id,
        team_id: hullTeamId,
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
    } else {
      const { error: insErr } = await supabase
        .from('game_staff')
        .insert({
          game_id: g.id,
          team_id: hullTeamId,
          person_id: martinGardhamId,
          role: 'head_coach'
        });
      if (insErr) throw insErr;
    }
    staffSynced++;
  }
  console.log(`Synced Martin Gardham in game_staff across ${staffSynced} Hull Sharks 2013 games.`);

  // 4. Approve/Close Proposal 03252071-7881-48e6-a7d0-95029388421b
  const { data: updatedProposal, error: propErr } = await supabase
    .from('game_proposals')
    .update({
      status: 'approved',
      game_id: gameId,
      admin_notes: 'Approved with corrections: Verified via HU17.net match report (9 March 2014) that this Trophy Playoffs Wild Card game occurred in the 2013/14 season (not 2012/13) on 2014-03-09 with final score LJMU Fury 12 - 16 Hull Sharks. Added to 2013/14 archive and confirmed Martin Gardham as 2013/14 Hull Sharks Head Coach.',
      updated_at: new Date().toISOString()
    })
    .eq('id', proposalId)
    .select('id, status, game_id, admin_notes')
    .single();

  if (propErr) throw propErr;
  console.log('Updated proposal:', updatedProposal);

  console.log('=== Sync Complete ===');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
