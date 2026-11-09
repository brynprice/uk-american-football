import ws from 'ws';
globalThis.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const aliasesToEnsure = [
    {
      team_name: 'Leeds Chargers',
      team_type: 'Womens',
      alias_name: 'Leeds Carnegie Chargers',
      start_year: 2014,
      end_year: 2019
    },
    {
      team_name: 'Hertfordshire Cheetahs',
      team_type: 'Womens',
      alias_name: 'Hertfordshire Tornadoes',
      start_year: 2014,
      end_year: 2019
    },
    {
      team_name: 'Cheshire Bears',
      team_type: 'Womens',
      alias_name: 'Chester Romans',
      start_year: 2014,
      end_year: 2019
    },
    {
      team_name: 'Cheshire Bears',
      team_type: 'Womens',
      alias_name: 'Chester Romans Ladies',
      start_year: 2014,
      end_year: 2019
    },
    {
      team_name: 'Portsmouth Dreadnoughts',
      team_type: 'Womens',
      alias_name: 'Portsmouth Destroyers',
      start_year: 2014,
      end_year: 2019
    }
  ];

  for (const item of aliasesToEnsure) {
    const { data: team, error: tErr } = await supabase.from('teams')
      .select('id, name, team_type')
      .eq('name', item.team_name)
      .eq('team_type', item.team_type)
      .single();

    if (tErr || !team) {
      console.error(`Team not found: ${item.team_name} (${item.team_type})`);
      continue;
    }

    const { data: existing } = await supabase.from('team_aliases')
      .select('id, name, team_id')
      .eq('team_id', team.id)
      .eq('name', item.alias_name)
      .maybeSingle();

    if (existing) {
      console.log(`[Exists] Alias "${item.alias_name}" already exists for ${item.team_name} (ID: ${existing.id})`);
    } else {
      const { data: inserted, error: inErr } = await supabase.from('team_aliases').insert({
        team_id: team.id,
        name: item.alias_name,
        start_year: item.start_year,
        end_year: item.end_year
      }).select().single();

      if (inErr) {
        console.error(`Failed to insert alias ${item.alias_name}:`, inErr);
      } else {
        console.log(`[Success] Added alias "${item.alias_name}" -> ${item.team_name} (ID: ${inserted.id})`);
      }
    }
  }
}

run().catch(console.error);
