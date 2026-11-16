import ws from 'ws';
globalThis.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function mergeSteelers() {
  const fromTeamId = '6b61b92d-cd82-4f74-aa92-3f7d2c6630da'; // Black Country Steelers (new duplicate)
  const toTeamId = 'c17400f7-fe82-4e93-857d-b9a682d42004';   // Sandwell Steelers (original full history)

  console.log(`Starting merge of ${fromTeamId} -> ${toTeamId}...`);

  // Step 1: Check both teams
  const { data: fromTeam, error: eFrom } = await supabase.from('teams').select('*').eq('id', fromTeamId).maybeSingle();
  const { data: toTeam, error: eTo } = await supabase.from('teams').select('*').eq('id', toTeamId).maybeSingle();

  if (eFrom || eTo) {
    console.error('Error fetching teams:', eFrom || eTo);
    process.exit(1);
  }

  if (!toTeam) {
    console.error(`Target team ${toTeamId} not found!`);
    process.exit(1);
  }

  console.log('Target team:', toTeam.name, `(${toTeam.id})`);
  if (fromTeam) {
    console.log('Source team:', fromTeam.name, `(${fromTeam.id})`);
  } else {
    console.log('Source team already removed or not found.');
  }

  // Step 2: Move home games
  const { data: homeGames, error: eHome } = await supabase
    .from('games')
    .update({ home_team_id: toTeamId })
    .eq('home_team_id', fromTeamId)
    .select('id');
  if (eHome) {
    console.error('Error moving home games:', eHome);
    process.exit(1);
  }
  console.log(`Updated ${homeGames?.length || 0} home games.`);

  // Step 3: Move away games
  const { data: awayGames, error: eAway } = await supabase
    .from('games')
    .update({ away_team_id: toTeamId })
    .eq('away_team_id', fromTeamId)
    .select('id');
  if (eAway) {
    console.error('Error moving away games:', eAway);
    process.exit(1);
  }
  console.log(`Updated ${awayGames?.length || 0} away games.`);

  // Step 4: Move participations
  const { data: parts, error: eParts } = await supabase
    .from('participations')
    .update({ team_id: toTeamId })
    .eq('team_id', fromTeamId)
    .select('id');
  if (eParts) {
    console.error('Error moving participations:', eParts);
    process.exit(1);
  }
  console.log(`Updated ${parts?.length || 0} participations.`);

  // Step 5: Update the target team row to current canonical name and logo
  const { error: eUpdate } = await supabase
    .from('teams')
    .update({
      name: 'Black Country Steelers',
      logo_url: '/images/logos/black-country-steelers.jpeg',
      founded_year: 2014,
      team_type: 'Adult'
    })
    .eq('id', toTeamId);
  if (eUpdate) {
    console.error('Error updating target team:', eUpdate);
    process.exit(1);
  }
  console.log(`Updated target team ${toTeamId} to name: "Black Country Steelers" and logo: "/images/logos/black-country-steelers.jpeg".`);

  // Step 6: Create or update alias for historical name "Sandwell Steelers" (2014 - 2025)
  const { data: existingAlias } = await supabase
    .from('team_aliases')
    .select('*')
    .eq('team_id', toTeamId)
    .eq('name', 'Sandwell Steelers')
    .maybeSingle();

  if (!existingAlias) {
    const { data: newAlias, error: eAlias } = await supabase
      .from('team_aliases')
      .insert({
        team_id: toTeamId,
        name: 'Sandwell Steelers',
        start_year: 2014,
        end_year: 2025,
        logo_url: '/images/logos/sandwell-steelers.png'
      })
      .select()
      .single();
    if (eAlias) {
      console.error('Error inserting alias:', eAlias);
      process.exit(1);
    }
    console.log('Inserted alias:', newAlias);
  } else {
    const { data: updatedAlias, error: eAliasUpdate } = await supabase
      .from('team_aliases')
      .update({
        start_year: 2014,
        end_year: 2025,
        logo_url: '/images/logos/sandwell-steelers.png'
      })
      .eq('id', existingAlias.id)
      .select()
      .single();
    if (eAliasUpdate) {
      console.error('Error updating existing alias:', eAliasUpdate);
      process.exit(1);
    }
    console.log('Updated existing alias:', updatedAlias);
  }

  // Step 7: Delete source team if it still exists
  if (fromTeam) {
    const { error: eDel } = await supabase
      .from('teams')
      .delete()
      .eq('id', fromTeamId);
    if (eDel) {
      console.error('Error deleting source team:', eDel);
      process.exit(1);
    }
    console.log(`Successfully deleted duplicate team ${fromTeamId}.`);
  }

  // Step 8: Verification
  console.log('\n=== VERIFICATION ===');
  const { data: verifySource } = await supabase.from('teams').select('id').eq('id', fromTeamId).maybeSingle();
  console.log('Source team deleted:', verifySource === null);

  const { data: verifyTarget } = await supabase
    .from('teams')
    .select('*, team_aliases(*)')
    .eq('id', toTeamId)
    .single();
  console.log('Target team:', verifyTarget);

  const { count: hCount } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('home_team_id', toTeamId);
  const { count: aCount } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('away_team_id', toTeamId);
  const { count: pCount } = await supabase.from('participations').select('*', { count: 'exact', head: true }).eq('team_id', toTeamId);

  console.log(`Total games for ${toTeamId}: ${hCount} home + ${aCount} away = ${(hCount || 0) + (aCount || 0)} games`);
  console.log(`Total participations for ${toTeamId}: ${pCount}`);
}

mergeSteelers().catch(console.error);
