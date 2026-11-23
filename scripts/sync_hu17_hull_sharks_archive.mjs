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

async function ensurePerson(displayName, firstName, lastName) {
  const { data: existing, error: findErr } = await supabase
    .from('people')
    .select('id, display_name')
    .eq('display_name', displayName)
    .maybeSingle();

  if (findErr) throw findErr;
  if (existing) return existing.id;

  const { data: created, error: insErr } = await supabase
    .from('people')
    .insert({ display_name: displayName, first_name: firstName, last_name: lastName })
    .select('id')
    .single();

  if (insErr) throw insErr;
  console.log(`Created person ${displayName}: ${created.id}`);
  return created.id;
}

async function ensureGameStaff(gameId, teamId, personId, role) {
  const { data: existing, error: findErr } = await supabase
    .from('game_staff')
    .select('id')
    .match({ game_id: gameId, team_id: teamId, person_id: personId, role })
    .maybeSingle();

  if (findErr) throw findErr;
  if (existing) return existing.id;

  const { data: inserted, error: insErr } = await supabase
    .from('game_staff')
    .insert({ game_id: gameId, team_id: teamId, person_id: personId, role })
    .select('id')
    .single();

  if (insErr) throw insErr;
  console.log(`Inserted game_staff (${role}) for game ${gameId}: ${inserted.id}`);
  return inserted.id;
}

async function run() {
  console.log('=== Syncing Remaining HU17.net Hull Sharks Archive Updates ===');

  const season2012Id = 'd4e61940-f44a-4b9a-84e7-23d01db775be';
  const natChamp2012PhaseId = '2f901cc0-b4a4-48ef-b20e-5e19278fd197';
  const hullTeamId = 'bcb71b06-08fa-45f1-8812-1c6905e80597';
  const bathTeamId = 'db7cc037-1ae7-4884-9175-9d9cc3e8d9ca';
  const martinGardhamId = 'beb3ef22-fca6-4740-a91c-8448e74b7923';

  // 1. Ensure venue 'Hull University West Campus' (city: 'Hull')
  let westCampusId = null;
  const { data: existingVenue, error: vFindErr } = await supabase
    .from('venues')
    .select('id, name, city')
    .eq('name', 'Hull University West Campus')
    .maybeSingle();

  if (vFindErr) throw vFindErr;
  if (existingVenue) {
    westCampusId = existingVenue.id;
    console.log('Found existing venue:', existingVenue);
  } else {
    const { data: createdVenue, error: vInsErr } = await supabase
      .from('venues')
      .insert({ name: 'Hull University West Campus', city: 'Hull' })
      .select('id, name, city')
      .single();
    if (vInsErr) throw vInsErr;
    westCampusId = createdVenue.id;
    console.log('Created venue:', createdVenue);
  }

  // 2. Update 8 2013-03-03 2012 playoff games -> playoff_round = 'Wild Card'
  const wildCardIds = [
    '63dffaa9-eb02-4cfd-8c11-f0c3589eecce',
    '72101b1a-30e4-4bf0-b93f-27f764ce80fd',
    '7582dad3-eae2-42b5-ad6a-9350429cb8e1',
    '2900a80d-6976-4cb9-8721-daabce1d7503',
    '5d9f3a9f-40e2-485b-82e0-f734506c3dd1',
    'c71b4cea-4b60-4f55-bb38-ffb6826d75dc',
    'bfdb9a89-3207-459e-879c-1573ca37d9d1',
    '5bca9a30-3ad7-44df-94c1-bcc3f4694e67'
  ];

  const { data: updatedWC, error: wcErr } = await supabase
    .from('games')
    .update({ playoff_round: 'Wild Card' })
    .in('id', wildCardIds)
    .select('id, playoff_round');

  if (wcErr) throw wcErr;
  console.log(`Updated ${updatedWC.length} 2013-03-03 playoff games to Wild Card.`);

  // 3. Insert 2013-03-10 Bath Killer Bees 13-6 @ Hull Sharks
  let qfGameId = null;
  const { data: existingQF, error: qfFindErr } = await supabase
    .from('games')
    .select('id, date, away_score, home_score, playoff_round')
    .match({
      season_id: season2012Id,
      away_team_id: bathTeamId,
      home_team_id: hullTeamId,
      date: '2013-03-10'
    })
    .maybeSingle();

  if (qfFindErr) throw qfFindErr;
  if (existingQF) {
    qfGameId = existingQF.id;
    console.log('2013-03-10 Quarter-Final already exists:', existingQF);
  } else {
    const { data: insertedQF, error: qfInsErr } = await supabase
      .from('games')
      .insert({
        season_id: season2012Id,
        phase_id: natChamp2012PhaseId,
        date: '2013-03-10',
        date_precision: 'day',
        date_display: '10/03/2013',
        away_team_id: bathTeamId,
        home_team_id: hullTeamId,
        away_score: 13,
        home_score: 6,
        status: 'completed',
        confidence_level: 'high',
        is_playoff: true,
        final_type: 'playoff',
        playoff_round: 'quarter_final',
        is_double_header: false,
        game_type: 'league',
        game_level: 'University',
        notes: 'Source: https://www.hu17.net/2013/03/11/american-football-hull-sharks-stung-by-killer-bees/'
      })
      .select('id, date, away_score, home_score, playoff_round')
      .single();

    if (qfInsErr) throw qfInsErr;
    qfGameId = insertedQF.id;
    console.log('Inserted 2013-03-10 Quarter-Final:', insertedQF);
  }

  // Ensure game_staff (head_coach = Martin Gardham) for 2013-03-10 game
  await ensureGameStaff(qfGameId, hullTeamId, martinGardhamId, 'head_coach');

  // Ensure Hull Sharks National Championship 2012 participation row with Martin Gardham
  const { data: existingPart, error: partFindErr } = await supabase
    .from('participations')
    .select('id, head_coach_id')
    .match({ team_id: hullTeamId, phase_id: natChamp2012PhaseId })
    .maybeSingle();

  if (partFindErr) throw partFindErr;
  if (existingPart) {
    if (!existingPart.head_coach_id) {
      const { error: partUpdErr } = await supabase
        .from('participations')
        .update({ head_coach_id: martinGardhamId })
        .eq('id', existingPart.id);
      if (partUpdErr) throw partUpdErr;
      console.log('Updated Hull Sharks 2012 National Championship participation head_coach_id.');
    } else {
      console.log('Hull Sharks 2012 National Championship participation already has head_coach_id:', existingPart.head_coach_id);
    }
  } else {
    const { data: insPart, error: partInsErr } = await supabase
      .from('participations')
      .insert({
        team_id: hullTeamId,
        phase_id: natChamp2012PhaseId,
        head_coach_id: martinGardhamId
      })
      .select('id, phase_id, head_coach_id')
      .single();
    if (partInsErr) throw partInsErr;
    console.log('Inserted Hull Sharks 2012 National Championship participation:', insPart);
  }

  // 4. Update the 4 existing 2013/14 Hull Sharks games
  const updates2013 = [
    {
      id: '9179ec81-3f92-415f-8718-c5326a33253a',
      payload: {
        venue_id: westCampusId,
        notes: 'Man of the Match: Jonathan Farrow. Source: BAFRA Newsflash Issue 2013-42 & https://www.hu17.net/2013/11/03/american-football-farrow-touchdown-give-sharks-a-perfect-start/'
      }
    },
    {
      id: '7beab7fd-c93f-40c2-a3e3-3499cda0bb97',
      payload: {
        venue_id: westCampusId,
        time: '13:30',
        notes: 'Source: BAFRA Newsflash Issue 2013-44 & https://www.hu17.net/2013/11/17/american-football-sharks-remain-unbeaten-after-victory-over-celtics/'
      }
    },
    {
      id: 'b43009ad-c456-4bfb-b3ba-664dda5ac110',
      payload: {
        venue_id: westCampusId,
        notes: 'Source: BAFRA Newsflash Issue 2013-47 & https://www.hu17.net/2013/12/11/american-football-sharks-too-good-for-bradford-bears/'
      }
    },
    {
      id: '5b16aeb4-daca-4917-be20-1230201519e5',
      payload: {
        confidence_level: 'high',
        notes: 'Offensive MVP: Matthew Kay; Defensive MVP: Dave Iles. Source: https://www.hu17.net/2014/02/24/hull-sharks-reach-play-offs-with-convincing-home-win/ & https://www.hu17.net/2014/02/27/american-football-sharks-qb-full-of-praise-for-team-mates/'
      }
    }
  ];

  for (const upd of updates2013) {
    const { data: uRow, error: uErr } = await supabase
      .from('games')
      .update(upd.payload)
      .eq('id', upd.id)
      .select('id, date, time, venue_id, confidence_level');
    if (uErr) throw uErr;
    console.log('Updated 2013 game:', uRow[0]);
  }

  // 5. Create/Ensure MVP people & link game_staff (role: 'game_mvp')
  const jonathanFarrowId = await ensurePerson('Jonathan Farrow', 'Jonathan', 'Farrow');
  const daveIlesId = await ensurePerson('Dave Iles', 'Dave', 'Iles');
  const matthewKayId = await ensurePerson('Matthew Kay', 'Matthew', 'Kay');

  await ensureGameStaff('9179ec81-3f92-415f-8718-c5326a33253a', hullTeamId, jonathanFarrowId, 'game_mvp');
  await ensureGameStaff('5b16aeb4-daca-4917-be20-1230201519e5', hullTeamId, daveIlesId, 'game_mvp');
  await ensureGameStaff('5b16aeb4-daca-4917-be20-1230201519e5', hullTeamId, matthewKayId, 'game_mvp');

  console.log('=== All HU17.net Hull Sharks Archive Updates Complete ===');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
