import ws from 'ws';
globalThis.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BAFL_COMPETITION_ID = '6ddbc634-26bf-43a9-ad4d-f66e1fe18f33';

async function getOrCreateSeason(year) {
  const { data: existing } = await supabase
    .from('seasons')
    .select('id')
    .eq('year', year)
    .eq('competition_id', BAFL_COMPETITION_ID)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('seasons')
    .insert({
      year,
      competition_id: BAFL_COMPETITION_ID
    })
    .select('id')
    .single();

  if (error) throw error;
  console.log(`[Created] Season ${year}: ID ${created.id}`);
  return created.id;
}

async function getOrCreatePhase(seasonId, name, type) {
  const { data: existing } = await supabase
    .from('phases')
    .select('id')
    .eq('season_id', seasonId)
    .ilike('name', name)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('phases')
    .insert({
      season_id: seasonId,
      name,
      type
    })
    .select('id')
    .single();

  if (error) throw error;
  console.log(`[Created] Phase "${name}": ID ${created.id}`);
  return created.id;
}

async function insertGames() {
  console.log('Ensuring seasons and phases...');
  const season1984Id = await getOrCreateSeason(1984);
  const season1986Id = await getOrCreateSeason(1986);
  const season1988Id = await getOrCreateSeason(1988);
  const season1989Id = await getOrCreateSeason(1989);
  const season1991Id = await getOrCreateSeason(1991);
  const season1995Id = await getOrCreateSeason(1995);
  const season1996Id = await getOrCreateSeason(1996);
  const season1997Id = await getOrCreateSeason(1997);
  const season2001Id = await getOrCreateSeason(2001);
  const season2006Id = await getOrCreateSeason(2006);
  const season2009Id = await getOrCreateSeason(2009);

  // Playoff phase for 1995 D3
  const phase1995D3Id = await getOrCreatePhase(season1995Id, 'Division Three Playoffs', 'Playoffs');

  // Exact team IDs from DB
  const TEAMS = {
    colchester: '10f8d422-fd07-44fe-b10b-a6919d7721c3',
    portsmouth_warriors: 'f6f76928-71ed-444c-a0d3-78f7dd3e0073',
    leicester_huntsmen: '488a20ab-ff51-4c0b-b72e-d5da97c7bb64',
    southern_sundevils: '2c50c766-132d-4b8d-a8ec-b80212f27f60',
    southend_sabres: '50529762-7730-41f4-adb1-93c2be169c6a',
    london_mets: '7f938477-c126-4264-b980-923252315321',
    lancashire_wolverines: '5afc1736-1d90-4182-8e9b-fa49f79cfa8f',
    staffordshire_surge: 'f8ef1d3f-d469-40af-a2e8-9ed30583b4d2',
    bristol_aztecs: '7d2da0dd-5e36-482b-b8cc-7c0d263b4b1a',
    east_kent_mavericks: '148f0c23-4f13-41ac-a61e-f3ffd90ba67e',
    london_gators: '55164636-513e-4c53-afe6-7dfaafd187e0',
    coventry_jets: '9099c9d6-794a-4adb-972a-7e240a7b2ae1',
    black_country_nailers: '7e444cf0-446c-47be-879b-07e61324b938',
    plymouth_admirals: 'fe37f8fd-0050-4ef7-b58a-707f2865b76f',
    weston_wolfpack: '3a088414-ca0c-464a-a67c-e30558c0cbbc',
    hertfordshire_cheetahs: '8c81a1cc-d125-461a-8e9d-7984080eba9f',
    f14_tomcats: '2d5bdf7f-f46b-4665-9235-7a3dccde1ab8',
    bristol_blackhawks: 'e39c4192-863e-472b-91a3-cc52bf0e9483',
    chiltern_panthers: '5a3e5e53-9a69-44b4-a056-036612740cac',
    shropshire_revolution: 'b353af2c-2dd0-4d5a-86ef-120fb26d8c8c',
    lincolnshire_bombers: 'de8c73a8-7f55-4c83-9b1f-449d0880c7c9',
    bournemouth_bobcats: 'e4b8b341-b34d-4f1b-ad8d-98ccf496ed55',
    bristol_apache: '7b86530f-7678-4365-8741-f6db5f6351cf'
  };

  const GAMES_TO_INSERT = [
    // --- CATEGORY A: PLAYOFF FIXTURES ---
    {
      home_team_id: TEAMS.colchester,
      away_team_id: TEAMS.portsmouth_warriors,
      home_score: 30,
      away_score: 0,
      date: '1988-08-07',
      date_precision: 'day',
      season_id: season1988Id,
      phase_id: '0507765a-f495-4c91-8836-d9eb049fe271', // 1988 Budweiser Premier Playoffs
      is_playoff: true,
      playoff_round: 'First Round',
      final_type: null,
      title_name: null,
      game_type: 'league',
      notes: 'Source: https://en.wikipedia.org/wiki/Colchester_Gladiators (Budweiser Premier Division First Round)'
    },
    {
      home_team_id: TEAMS.colchester,
      away_team_id: TEAMS.leicester_huntsmen,
      home_score: 49,
      away_score: 14,
      date: '1989-08-06',
      date_precision: 'day',
      season_id: season1989Id,
      phase_id: 'e147021b-0ca1-4edc-9dbe-7a68d30cd8db', // 1989 CGL Crown National Playoffs
      is_playoff: true,
      playoff_round: 'Quarter-Final',
      final_type: null,
      title_name: null,
      game_type: 'league',
      notes: 'Source: https://en.wikipedia.org/wiki/Colchester_Gladiators (CGL Crown National Quarter-final)'
    },
    {
      home_team_id: TEAMS.southern_sundevils,
      away_team_id: TEAMS.southend_sabres,
      home_score: 30,
      away_score: 16,
      date: '1995-08-06',
      date_precision: 'day',
      season_id: season1995Id,
      phase_id: phase1995D3Id,
      is_playoff: true,
      playoff_round: 'Quarter-Final',
      final_type: null,
      title_name: null,
      game_type: 'league',
      notes: 'Source: https://en.wikipedia.org/wiki/Southern_Sundevils (BAFA Division Three Quarter-final)'
    },
    {
      home_team_id: TEAMS.southern_sundevils,
      away_team_id: TEAMS.london_mets,
      home_score: 10,
      away_score: 6,
      date: '1995-08-13',
      date_precision: 'day',
      season_id: season1995Id,
      phase_id: phase1995D3Id,
      is_playoff: true,
      playoff_round: 'Semi-Final',
      final_type: null,
      title_name: null,
      game_type: 'league',
      notes: 'Source: https://en.wikipedia.org/wiki/Southern_Sundevils (BAFA Division Three Semi-final)'
    },
    {
      home_team_id: TEAMS.southern_sundevils,
      away_team_id: TEAMS.lancashire_wolverines,
      home_score: 22,
      away_score: 16,
      date: '1995-08-27',
      date_precision: 'day',
      season_id: season1995Id,
      phase_id: phase1995D3Id,
      is_playoff: true,
      playoff_round: 'Final',
      final_type: 'bowl',
      title_name: 'Division Three Bowl',
      game_type: 'league',
      notes: 'Source: https://en.wikipedia.org/wiki/Southern_Sundevils (BAFA Division Three National Championship)'
    },
    {
      home_team_id: TEAMS.southern_sundevils,
      away_team_id: TEAMS.staffordshire_surge,
      home_score: 48,
      away_score: 3,
      date: '1996-08-11',
      date_precision: 'day',
      season_id: season1996Id,
      phase_id: 'b9e18f0a-6fe1-47e4-b732-fe7c950ba0cb', // 1996 BSL Division Three Playoffs
      is_playoff: true,
      playoff_round: 'Semi-Final',
      final_type: null,
      title_name: null,
      game_type: 'league',
      notes: 'Source: https://en.wikipedia.org/wiki/Southern_Sundevils (BSL Division Three Semi-final)'
    },
    {
      home_team_id: TEAMS.southern_sundevils,
      away_team_id: TEAMS.bristol_aztecs,
      home_score: 32,
      away_score: 0,
      date: '1996-08-25',
      date_precision: 'day',
      season_id: season1996Id,
      phase_id: 'b9e18f0a-6fe1-47e4-b732-fe7c950ba0cb', // 1996 BSL Division Three Playoffs
      is_playoff: true,
      playoff_round: 'Final',
      final_type: 'bowl',
      title_name: 'Division Three Bowl',
      game_type: 'league',
      notes: 'Source: https://en.wikipedia.org/wiki/Southern_Sundevils (BSL Division Three National Championship)'
    },
    {
      home_team_id: TEAMS.southern_sundevils,
      away_team_id: TEAMS.bristol_aztecs,
      home_score: 6,
      away_score: 16,
      date: '1997-08-10',
      date_precision: 'day',
      season_id: season1997Id,
      phase_id: '3408e864-9b9b-435b-bf09-7f45d37b2c43', // 1997 BSL Division One Playoffs
      is_playoff: true,
      playoff_round: 'Quarter-Final',
      final_type: null,
      title_name: null,
      game_type: 'league',
      notes: 'Source: https://en.wikipedia.org/wiki/Southern_Sundevils (BSL Division One Quarter-final)'
    },
    {
      home_team_id: TEAMS.east_kent_mavericks,
      away_team_id: TEAMS.london_gators,
      home_score: 14,
      away_score: 22,
      date: '2001-08-26',
      date_precision: 'day',
      season_id: season2001Id,
      phase_id: '2d8f4b12-74b4-43ff-ac38-572fbb4d4be1', // 2001 BSFL Division Two Playoffs
      is_playoff: true,
      playoff_round: 'Final',
      final_type: 'bowl',
      title_name: 'Division Two Bowl',
      game_type: 'league',
      notes: 'Source: https://en.wikipedia.org/wiki/East_Kent_Mavericks (BSFL Division Two Final)'
    },

    // --- CATEGORY B: INAUGURAL & ASSOCIATE EXHIBITIONS (Strictly Quarantined) ---
    {
      home_team_id: TEAMS.coventry_jets,
      away_team_id: TEAMS.black_country_nailers,
      home_score: 100,
      away_score: 0,
      date: null,
      date_precision: 'season',
      date_display: '1984',
      season_id: season1984Id,
      phase_id: null,
      is_playoff: false,
      playoff_round: null,
      final_type: null,
      title_name: null,
      game_type: 'friendly',
      notes: 'Source: https://en.wikipedia.org/wiki/Coventry_Jets (First recorded game in Coventry American football history)'
    },
    {
      home_team_id: TEAMS.plymouth_admirals,
      away_team_id: TEAMS.weston_wolfpack,
      home_score: 91,
      away_score: 0,
      date: null,
      date_precision: 'season',
      date_display: '1984',
      season_id: season1984Id,
      phase_id: null,
      is_playoff: false,
      playoff_round: null,
      final_type: null,
      title_name: null,
      game_type: 'friendly',
      notes: 'Source: https://en.wikipedia.org/wiki/Plymouth_Admirals (First recorded game in Plymouth Admirals history)'
    },
    {
      home_team_id: TEAMS.hertfordshire_cheetahs,
      away_team_id: TEAMS.f14_tomcats,
      home_score: 18,
      away_score: 6,
      date: null,
      date_precision: 'season',
      date_display: '1986',
      season_id: season1986Id,
      phase_id: null,
      is_playoff: false,
      playoff_round: null,
      final_type: null,
      title_name: null,
      game_type: 'friendly',
      notes: 'Source: https://en.wikipedia.org/wiki/Hertfordshire_Cheetahs (Inaugural summer friendly following club formation)'
    },
    {
      home_team_id: TEAMS.hertfordshire_cheetahs,
      away_team_id: TEAMS.bristol_blackhawks,
      home_score: 41,
      away_score: 2,
      date: null,
      date_precision: 'season',
      date_display: '1986',
      season_id: season1986Id,
      phase_id: null,
      is_playoff: false,
      playoff_round: null,
      final_type: null,
      title_name: null,
      game_type: 'friendly',
      notes: 'Source: https://en.wikipedia.org/wiki/Hertfordshire_Cheetahs (Inaugural summer friendly following club formation)'
    },
    {
      home_team_id: TEAMS.hertfordshire_cheetahs,
      away_team_id: TEAMS.chiltern_panthers,
      home_score: 34,
      away_score: 9,
      date: null,
      date_precision: 'season',
      date_display: '1986',
      season_id: season1986Id,
      phase_id: null,
      is_playoff: false,
      playoff_round: null,
      final_type: null,
      title_name: null,
      game_type: 'friendly',
      notes: 'Source: https://en.wikipedia.org/wiki/Hertfordshire_Cheetahs (Inaugural summer friendly following club formation)'
    },
    {
      home_team_id: TEAMS.shropshire_revolution,
      away_team_id: TEAMS.lincolnshire_bombers,
      home_score: 30,
      away_score: 6,
      date: null,
      date_precision: 'season',
      date_display: '2006',
      season_id: season2006Id,
      phase_id: null,
      is_playoff: false,
      playoff_round: null,
      final_type: null,
      title_name: null,
      game_type: 'associate',
      notes: 'Source: https://en.wikipedia.org/wiki/Shropshire_Revolution (Inaugural associate process match)'
    },
    {
      home_team_id: TEAMS.bournemouth_bobcats,
      away_team_id: TEAMS.bristol_apache,
      home_score: 34,
      away_score: 12,
      date: null,
      date_precision: 'season',
      date_display: '2009',
      season_id: season2009Id,
      phase_id: null,
      is_playoff: false,
      playoff_round: null,
      final_type: null,
      title_name: null,
      game_type: 'associate',
      notes: 'Source: https://en.wikipedia.org/wiki/Bournemouth_Bobcats (Inaugural associate process match following club reformation)'
    }
  ];

  console.log(`\nInserting ${GAMES_TO_INSERT.length} games...`);

  for (const g of GAMES_TO_INSERT) {
    // Check if match already exists
    let query = supabase.from('games').select('id, home_score, away_score, date')
      .eq('home_team_id', g.home_team_id)
      .eq('away_team_id', g.away_team_id)
      .eq('home_score', g.home_score)
      .eq('away_score', g.away_score);

    if (g.date) query = query.eq('date', g.date);
    else query = query.eq('season_id', g.season_id);

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      console.log(`[EXISTS] Game ${g.date || g.date_display} (${g.home_score}-${g.away_score}): ID ${existing.id}`);
    } else {
      const payload = {
        ...g,
        status: 'completed',
        confidence_level: 'high'
      };
      const { data: inserted, error } = await supabase.from('games').insert(payload).select().single();
      if (error) {
        console.error(`[ERROR] Failed to insert ${g.date || g.date_display}:`, error);
      } else {
        console.log(`[INSERTED] Game ${g.date || g.date_display} (${g.game_type}): ID ${inserted.id}`);
      }
    }
  }
}

insertGames().catch(console.error);
