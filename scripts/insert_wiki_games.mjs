import ws from 'ws';
globalThis.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('=== Adding New Games & Updating Existing ===\n');

  const gamesToInsert = [
    // 1. 2013 Associate Process Game (Adult)
    {
      season_id: '70ed3a53-dd7f-4eaa-a6be-191ccfe9162f', // 2013 BAFA NL
      phase_id: null, // Strictly null: unphased associate game
      away_phase_id: null,
      home_team_id: 'b353af2c-2dd0-4d5a-86ef-120fb26d8c8c', // Shropshire Revolution
      away_team_id: 'c17400f7-fe82-4e93-857d-b9a682d42004', // Black Country / Sandwell Steelers
      home_score: 42,
      away_score: 12,
      date: null,
      date_precision: 'season',
      date_display: '2013',
      game_type: 'associate',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: false,
      is_double_header: false,
      game_level: 'Adult',
      notes: 'Source: https://en.wikipedia.org/wiki/Sandwell_Steelers (Inaugural associate process match)'
    },
    // 2. August 2014 Women's Debut Friendly
    {
      season_id: '29084111-4440-45cc-8b6e-228182cf7318', // 2014 Sapphire Series
      phase_id: null, // Strictly null: unphased friendly game
      away_phase_id: null,
      home_team_id: 'a608747c-7207-4220-a802-9eb9ac75c8e6', // Sandwell Steelers Womens
      away_team_id: '4d8f1453-c421-4ec1-8cd0-e8b44c8cc92f', // Cheshire Bears / Chester Romans Womens
      home_score: 35,
      away_score: 0,
      date: '2014-08-01',
      date_precision: 'month',
      date_display: 'August 2014',
      game_type: 'friendly',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: false,
      is_double_header: false,
      game_level: 'Womens',
      notes: 'Source: https://en.wikipedia.org/wiki/Sandwell_Steelers (Inaugural friendly match. Sandwell Steelers Women defeated Chester Romans Ladies 35-0 at home.)'
    },
    // 3. 2018 Women's League Game (Cardiff Valkyries @ Sandwell Steelers)
    {
      season_id: '3184a37b-173b-46ed-b9a0-43a66117fadb', // 2018 Sapphire Series
      phase_id: 'e99b8ac0-95d7-4ed9-9c42-21c6ad0aa314', // Division Two A North
      away_phase_id: '8cecfa62-8804-4671-996e-0d97ae152a26', // Division Two A South
      home_team_id: 'a608747c-7207-4220-a802-9eb9ac75c8e6', // Sandwell Steelers Womens
      away_team_id: 'ea552449-7013-4d1b-ae82-13d7675a5b92', // Cardiff Valkyries Womens
      home_score: 51,
      away_score: 20,
      date: '2018-02-24',
      date_precision: 'day',
      date_display: '24/02/2018',
      game_type: 'league',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: false,
      is_double_header: false,
      game_level: 'Womens',
      notes: 'Source: BAFA Sapphire Series Division 2A official match record / Italian Wikipedia (https://it.wikipedia.org/wiki/Sapphire_Series_Division_2A_2018). Tournament 2 (Sandwell Bowl).'
    },
    // 4. 2018/19 Women's League Game (Portsmouth @ Sandwell)
    {
      season_id: 'ddfbd8be-e469-47bd-a217-9a38f6518551', // 2019 Sapphire Series
      phase_id: '4d14b6eb-ae1e-4c74-b4ea-5128c96d2cfb', // Division One South
      away_phase_id: null,
      home_team_id: 'a608747c-7207-4220-a802-9eb9ac75c8e6', // Sandwell Steelers Womens
      away_team_id: '2f26144e-1a5d-4974-b585-988bc7ff5039', // Portsmouth Dreadnoughts Womens
      home_score: 23,
      away_score: 6,
      date: '2018-12-01',
      date_precision: 'day',
      date_display: '01/12/2018',
      game_type: 'league',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: false,
      is_double_header: false,
      game_level: 'Womens',
      notes: 'Source: BAFA Sapphire Series Division One official match record / Italian Wikipedia (https://it.wikipedia.org/wiki/Sapphire_Series_Division_One_2018-2019). Tournament 1 (London Bowl).'
    },
    // 5. 2018/19 Women's League Game (Sandwell @ London Warriors)
    {
      season_id: 'ddfbd8be-e469-47bd-a217-9a38f6518551', // 2019 Sapphire Series
      phase_id: '4d14b6eb-ae1e-4c74-b4ea-5128c96d2cfb', // Division One South
      away_phase_id: null,
      home_team_id: '69e54876-cec8-4105-b048-ae566ce9edd4', // London Warriors Womens
      away_team_id: 'a608747c-7207-4220-a802-9eb9ac75c8e6', // Sandwell Steelers Womens
      home_score: 34,
      away_score: 0,
      date: '2018-12-01',
      date_precision: 'day',
      date_display: '01/12/2018',
      game_type: 'league',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: false,
      is_double_header: false,
      game_level: 'Womens',
      notes: 'Source: BAFA Sapphire Series Division One official match record / Italian Wikipedia (https://it.wikipedia.org/wiki/Sapphire_Series_Division_One_2018-2019). Tournament 1 (London Bowl).'
    },
    // 6. 2018/19 Women's League Game (Sandwell @ London Warriors)
    {
      season_id: 'ddfbd8be-e469-47bd-a217-9a38f6518551', // 2019 Sapphire Series
      phase_id: '4d14b6eb-ae1e-4c74-b4ea-5128c96d2cfb', // Division One South
      away_phase_id: null,
      home_team_id: '69e54876-cec8-4105-b048-ae566ce9edd4', // London Warriors Womens
      away_team_id: 'a608747c-7207-4220-a802-9eb9ac75c8e6', // Sandwell Steelers Womens
      home_score: 28,
      away_score: 0,
      date: '2019-02-02',
      date_precision: 'day',
      date_display: '02/02/2019',
      game_type: 'league',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: false,
      is_double_header: false,
      game_level: 'Womens',
      notes: 'Source: BAFA Sapphire Series Division One official match record / Italian Wikipedia (https://it.wikipedia.org/wiki/Sapphire_Series_Division_One_2018-2019). Tournament 4 (Birmingham Bowl).'
    },
    // 7. 2018/19 Women's League Game (Birmingham Lions @ Sandwell)
    {
      season_id: 'ddfbd8be-e469-47bd-a217-9a38f6518551', // 2019 Sapphire Series
      phase_id: '4d14b6eb-ae1e-4c74-b4ea-5128c96d2cfb', // Division One South
      away_phase_id: null,
      home_team_id: 'a608747c-7207-4220-a802-9eb9ac75c8e6', // Sandwell Steelers Womens
      away_team_id: 'cd81c5d7-24d8-45fb-a246-d9f04cee5fff', // Birmingham Lions Womens
      home_score: 0,
      away_score: 70,
      date: '2019-02-16',
      date_precision: 'day',
      date_display: '16/02/2019',
      game_type: 'league',
      status: 'completed',
      confidence_level: 'high',
      is_playoff: false,
      is_double_header: false,
      game_level: 'Womens',
      notes: 'Source: BAFA Sapphire Series Division One official match record / Italian Wikipedia (https://it.wikipedia.org/wiki/Sapphire_Series_Division_One_2018-2019). Tournament 5 (Sandwell Bowl).'
    }
  ];

  for (const g of gamesToInsert) {
    // Check if game already exists
    let q = supabase
      .from('games')
      .select('id')
      .eq('season_id', g.season_id)
      .eq('home_team_id', g.home_team_id)
      .eq('away_team_id', g.away_team_id);

    if (g.date) {
      q = q.eq('date', g.date);
    } else {
      q = q.is('date', null);
    }

    const { data: existing } = await q.maybeSingle();

    if (existing) {
      console.log(`[Exists] Game ${g.date || g.date_display} (${g.game_type}): ID ${existing.id}`);
      // Update fields
      const { error: upErr } = await supabase.from('games').update(g).eq('id', existing.id);
      if (upErr) console.error('  Update error:', upErr);
      else console.log('  Updated successfully.');
    } else {
      const { data: inserted, error: inErr } = await supabase.from('games').insert(g).select('id').single();
      if (inErr) console.error(`[Error] Inserting game ${g.date || g.date_display}:`, inErr);
      else console.log(`[Inserted] Game ${g.date || g.date_display} (${g.game_type}): ID ${inserted.id}`);
    }
  }

  // Also fix the 2019-02-16 Sandwell vs Hertfordshire score reversal if needed
  const { data: hertsGame } = await supabase
    .from('games')
    .select('id, home_score, away_score')
    .eq('season_id', 'ddfbd8be-e469-47bd-a217-9a38f6518551')
    .eq('home_team_id', 'a608747c-7207-4220-a802-9eb9ac75c8e6') // Sandwell
    .eq('away_team_id', 'af1c4ee8-dac3-498d-9e5c-377511800283') // Hertfordshire
    .eq('date', '2019-02-16')
    .maybeSingle();

  if (hertsGame) {
    if (hertsGame.home_score !== 0 || hertsGame.away_score !== 50) {
      console.log(`\nCorrecting 2019-02-16 score from ${hertsGame.home_score}-${hertsGame.away_score} to 0-50...`);
      const { error: upErr } = await supabase
        .from('games')
        .update({ home_score: 0, away_score: 50 })
        .eq('id', hertsGame.id);
      if (upErr) console.error('Error updating score:', upErr);
      else console.log('Successfully corrected score to 0-50.');
    } else {
      console.log('\n2019-02-16 score is already 0-50.');
    }
  }
}

run().catch(console.error);
