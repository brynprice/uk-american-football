import fs from 'fs';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function ensurePerson(name) {
  const { data: existing } = await supabase
    .from('people')
    .select('id')
    .eq('display_name', name)
    .maybeSingle();
  if (existing) return existing.id;

  const parts = name.trim().split(/\s+/);
  const first_name = parts[0] || '';
  const last_name = parts.slice(1).join(' ') || '';
  const { data: created, error } = await supabase
    .from('people')
    .insert({ display_name: name, first_name, last_name })
    .select('id')
    .single();
  if (error) throw error;
  console.log(`Created person ${name}: ${created.id}`);
  return created.id;
}

async function ensureStaff(gameId, teamId, personId) {
  if (!gameId || !teamId || !personId) return;
  const { data: existing } = await supabase
    .from('game_staff')
    .select('id, person_id')
    .match({ game_id: gameId, team_id: teamId, role: 'head_coach' })
    .maybeSingle();

  if (existing) {
    if (existing.person_id !== personId) {
      await supabase.from('game_staff').update({ person_id: personId }).eq('id', existing.id);
    }
  } else {
    const { error } = await supabase.from('game_staff').insert({
      game_id: gameId,
      team_id: teamId,
      person_id: personId,
      role: 'head_coach'
    });
    if (error) console.error(`Error inserting game_staff (${gameId}):`, error.message);
  }
}

async function run() {
  console.log('=== Syncing 2011 Double Coverage Updates & Coaches to Supabase ===');

  // 1. Find 2011 BUAFL season
  const { data: seasons } = await supabase
    .from('seasons')
    .select('id, year, competition:competitions(name)')
    .eq('year', 2011);
  const buafl2011 = (seasons || []).find(s => s.competition?.name?.includes('British Universities') || s.competition?.name === 'BUAFL');
  if (!buafl2011) throw new Error('Could not find 2011 BUAFL season');
  const seasonId = buafl2011.id;
  console.log('Season 2011 BUAFL:', seasonId);

  // 2. Load 2011 phases & all teams
  const { data: phases } = await supabase.from('phases').select('id, name').eq('season_id', seasonId);
  const phaseIdByName = Object.fromEntries((phases || []).map(p => [p.name, p.id]));

  const { data: teams } = await supabase.from('teams').select('id, name');
  const teamIdByName = Object.fromEntries((teams || []).map(t => [t.name, t.id]));

  // 3. Ensure Martin Hume & update Solent Redhawks 2011 participation
  const martinHumeId = await ensurePerson('Martin Hume');
  const solentId = teamIdByName['Solent Redhawks'];
  const { error: partErr } = await supabase
    .from('participations')
    .update({ head_coach_id: martinHumeId })
    .match({ team_id: solentId, phase_id: phaseIdByName['South Eastern 1B'] });
  if (partErr) console.error('Error updating Solent participation:', partErr);
  else console.log('Updated Solent Redhawks 2011 participation with Martin Hume');

  // 4. Fetch all existing 2011 games
  const { data: dbGames } = await supabase
    .from('games')
    .select('id, date, away_team_id, home_team_id, away_score, home_score')
    .eq('season_id', seasonId);

  const findGame = (awayId, homeId) => (dbGames || []).find(g => g.away_team_id === awayId && g.home_team_id === homeId);

  // 5. Update BNU Buccaneers @ Solent Redhawks -> 22-27
  const bnuSolent = findGame(teamIdByName['BNU Buccaneers'], solentId);
  if (bnuSolent) {
    const { error } = await supabase
      .from('games')
      .update({
        away_score: 22,
        home_score: 27,
        notes: 'Source: https://dblcoverage.blogspot.com/2012/02/buafl-match-report-solents-run.html & https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html'
      })
      .eq('id', bnuSolent.id);
    if (error) console.error('Error updating BNU @ Solent:', error);
    else console.log(`Updated BNU @ Solent (${bnuSolent.id}) -> 22-27`);
  }

  // 6. Update undated Bath Killer Bees games
  const bathId = teamIdByName['Bath Killer Bees'];
  const bristolBath = findGame(teamIdByName['Bristol Barracuda'], bathId);
  if (bristolBath && !bristolBath.date) {
    await supabase.from('games').update({
      date: '2012-02-19',
      date_precision: 'day',
      date_display: '19/02/2012',
      notes: 'Source: Britball Wiki (https://britball.fandom.com/wiki/Bath_Killer_Bees) & https://dblcoverage.blogspot.com/2012/02/buafl-week-10-results.html'
    }).eq('id', bristolBath.id);
    console.log(`Updated Bristol @ Bath date (${bristolBath.id}) -> 2012-02-19`);
  }
  const bathSpaBath = findGame(teamIdByName['Bath Spa Bulldogs'], bathId);
  if (bathSpaBath && !bathSpaBath.date) {
    await supabase.from('games').update({
      date: '2012-02-26',
      date_precision: 'day',
      date_display: '26/02/2012',
      notes: 'Source: Britball Wiki (https://britball.fandom.com/wiki/Bath_Killer_Bees) & https://dblcoverage.blogspot.com/2012/02/buafl-week-12-results.html'
    }).eq('id', bathSpaBath.id);
    console.log(`Updated Bath Spa @ Bath date (${bathSpaBath.id}) -> 2012-02-26`);
  }

  // 7. Ensure Martin Hume on all existing 2011 Solent Redhawks games
  for (const g of dbGames || []) {
    if (g.away_team_id === solentId || g.home_team_id === solentId) {
      await ensureStaff(g.id, solentId, martinHumeId);
    }
  }
  console.log('Linked Martin Hume in game_staff for all 2011 Solent Redhawks games.');

  // 8. Parse games2011.csv and insert any missing games
  const gLines = fs.readFileSync('data/BUAFL/games2011.csv', 'utf-8').split('\n').filter(l => l.trim().length > 0);
  const gHeader = parseCSVLine(gLines[0]);
  const idx = Object.fromEntries(gHeader.map((h, i) => [h.trim(), i]));

  const coachIdCache = { 'Martin Hume': martinHumeId };
  let insertedCount = 0;
  let hullYorkId = null;

  for (let i = 1; i < gLines.length; i++) {
    const row = parseCSVLine(gLines[i]);
    const awayName = row[idx.away_team]?.trim();
    const homeName = row[idx.home_team]?.trim();
    const awayId = teamIdByName[awayName];
    const homeId = teamIdByName[homeName];
    if (!awayId || !homeId) {
      console.warn(`Unknown team ID in row ${i}: ${awayName} @ ${homeName}`);
      continue;
    }

    const existing = (dbGames || []).find(g =>
      (g.away_team_id === awayId && g.home_team_id === homeId) ||
      (g.away_team_id === homeId && g.home_team_id === awayId)
    );
    if (existing) {
      if (awayName === 'Hull Sharks' && homeName === 'York Centurions') hullYorkId = existing.id;
      continue;
    }

    const dateVal = row[idx.date]?.trim() || null;
    const phaseId = phaseIdByName[row[idx.phase]?.trim()];
    const awayPhaseName = row[idx.away_phase]?.trim();
    const awayPhaseId = awayPhaseName ? phaseIdByName[awayPhaseName] : null;

    const payload = {
      season_id: seasonId,
      phase_id: phaseId,
      away_phase_id: awayPhaseId || null,
      date: dateVal,
      date_precision: row[idx.date_precision]?.trim() || (dateVal ? 'day' : 'season'),
      date_display: row[idx.date_display]?.trim() || null,
      time: row[idx.time]?.trim() || null,
      away_team_id: awayId,
      home_team_id: homeId,
      away_score: parseInt(row[idx.away_score], 10),
      home_score: parseInt(row[idx.home_score], 10),
      status: row[idx.status]?.trim() || 'completed',
      confidence_level: row[idx.confidence_level]?.trim() || 'high',
      is_playoff: row[idx.is_playoff]?.trim() === 'TRUE',
      is_double_header: row[idx.is_double_header]?.trim() === 'TRUE',
      game_type: 'league',
      game_level: 'University',
      notes: row[idx.notes]?.trim() || null
    };

    const { data: inserted, error: insErr } = await supabase
      .from('games')
      .insert(payload)
      .select('id')
      .single();

    if (insErr) {
      console.error(`Error inserting ${awayName} @ ${homeName}:`, insErr.message);
      continue;
    }
    insertedCount++;
    if (awayName === 'Hull Sharks' && homeName === 'York Centurions') {
      hullYorkId = inserted.id;
    }

    const ac = row[idx.away_coach]?.trim();
    if (ac) {
      if (!coachIdCache[ac]) coachIdCache[ac] = await ensurePerson(ac);
      await ensureStaff(inserted.id, awayId, coachIdCache[ac]);
    }
    const hc = row[idx.home_coach]?.trim();
    if (hc) {
      if (!coachIdCache[hc]) coachIdCache[hc] = await ensurePerson(hc);
      await ensureStaff(inserted.id, homeId, coachIdCache[hc]);
    }
  }
  console.log(`Inserted ${insertedCount} new games into Supabase.`);

  // 9. Approve Hull Sharks @ York Centurions proposal
  if (hullYorkId) {
    const proposalId = '48ad7396-4f8b-4b13-baed-26d136cc3345';
    const { data: prop, error: propErr } = await supabase
      .from('game_proposals')
      .update({
        status: 'approved',
        game_id: hullYorkId,
        admin_notes: 'Approved: Recorded Hull Sharks 33-6 @ York Centurions (adjusted date to Sunday 2012-02-26 to match the actual Sunday of Week 12, as Double Coverage mislabeled Sat 25 / Sun 26 as Sat 24 / Sun 25). Also ingested remaining missing Week 10 & Week 12 results from dblcoverage.blogspot.com.',
        updated_at: new Date().toISOString()
      })
      .eq('id', proposalId)
      .select('id, status, game_id')
      .single();
    if (propErr) console.error('Error approving proposal:', propErr);
    else console.log('Approved proposal:', prop);
  }

  console.log('=== Supabase Sync Complete ===');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
