import ws from 'ws';
global.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const coachesToRegister = [
  {
    team: 'Brunel Burners',
    year: 2026,
    head_coach: 'Zac Cooney-Quinn',
    firstName: 'Zac',
    lastName: 'Cooney-Quinn',
    source: 'https://www.bucs.org.uk/',
    source_details: 'Appointed Head Coach of Brunel Burners on 14 July 2026 succeeding James Kelvin ahead of the 2026/27 Premier campaign'
  },
  {
    team: 'Bath Killer Bees',
    year: 2026,
    head_coach: 'Pat Snooks',
    firstName: 'Pat',
    lastName: 'Snooks',
    source: 'https://www.thesubath.com/americanfootball/',
    source_details: 'Long-serving Head Coach of Bath Killer Bees entering 34th season in 2026/27'
  },
  {
    team: 'UWE Bullets',
    year: 2026,
    head_coach: 'Daniel Maher',
    firstName: 'Daniel',
    lastName: 'Maher',
    source: 'https://www.thestudentsunion.co.uk/opportunities/societies/societies-list/american-football/',
    source_details: 'Head of American Football and Head Coach of UWE Bullets Premier team for 2026/27'
  },
  {
    team: 'Durham Saints',
    year: 2026,
    head_coach: 'Jonathan Rooney',
    firstName: 'Jonathan',
    lastName: 'Rooney',
    source: 'https://www.durham.ac.uk/',
    source_details: 'Full-time Head Coach of Durham Saints leading the program in 2026/27'
  },
  {
    team: 'Nottingham Gold',
    year: 2026,
    head_coach: 'Jason Scott',
    firstName: 'Jason',
    lastName: 'Scott',
    source: 'https://nottinghamsport.com/',
    source_details: 'Head of American Football at University of Nottingham coaching Nottingham Gold for 2026/27'
  },
  {
    team: 'SGS Pride',
    year: 2026,
    head_coach: 'Ben Herod',
    firstName: 'Ben',
    lastName: 'Herod',
    source: 'https://www.sgscol.ac.uk/',
    source_details: 'Director of American Football and Head Coach of SGS Pride program for 2026/27'
  },
  {
    team: 'Bournemouth University Bobcats',
    year: 2026,
    head_coach: 'Steve Rains',
    firstName: 'Steve',
    lastName: 'Rains',
    source: 'https://bournemouthbobcats.com/',
    source_details: 'Head Coach of Bournemouth University Bobcats entering Premier South for 2026/27'
  },
  {
    team: 'Bournemouth Bobcats',
    year: 2026,
    head_coach: 'Steve Rains',
    firstName: 'Steve',
    lastName: 'Rains',
    source: 'https://bournemouthbobcats.com/',
    source_details: 'Head Coach of Bournemouth University Bobcats entering Premier South for 2026/27'
  },
  {
    team: 'Oxford Brookes University',
    year: 2026,
    head_coach: 'Calvin Stitt',
    firstName: 'Calvin',
    lastName: 'Stitt',
    source: 'https://www.brookes.ac.uk/',
    source_details: 'Head Coach of Oxford Brookes University American football program in 2026/27'
  }
];

async function main() {
  console.log('=== Registering 2026/27 BUAFL Coaches ===');

  // 1. Update verified_coaches.json
  const evidencePath = path.join(__dirname, '..', 'data', 'evidence', 'verified_coaches.json');
  const evidenceData = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));

  let addedCount = 0;
  for (const item of coachesToRegister) {
    const exists = evidenceData.some(
      e => e.team === item.team && e.year === item.year && e.head_coach === item.head_coach
    );
    if (!exists) {
      evidenceData.push({
        team: item.team,
        year: item.year,
        head_coach: item.head_coach,
        source: item.source,
        source_details: item.source_details
      });
      addedCount++;
    }
  }
  fs.writeFileSync(evidencePath, JSON.stringify(evidenceData, null, 2) + '\n', 'utf8');
  console.log(`[Evidence] Added ${addedCount} entries to verified_coaches.json.`);

  // 2. Update standings2026.csv
  const standingsPath = path.join(__dirname, '..', 'data', 'BUAFL', 'standings2026.csv');
  let csvContent = fs.readFileSync(standingsPath, 'utf8');
  const lines = csvContent.split('\n');
  const updatedLines = lines.map(line => {
    if (!line.trim()) return line;
    // Map teams
    for (const item of coachesToRegister) {
      if (item.team === 'Bournemouth Bobcats') continue;
      // Match "team_name" in the line
      // format: BUAFL,2026,"phase","parent_phase","team",wins,losses,ties,pf,pa,streak,head_coach,...
      const teamPattern = `"${item.team}"`;
      if (line.includes(teamPattern)) {
        // split by comma with consideration for quotes
        // or regex replacement of the streak,head_coach part
        // Example: ,0,0,,,,,"Source:
        // We know wins..pa are 0,0,0,0,0 then streak,,head_coach,,offensive_coord...
        // Let's replace ",0,0,0,0,0,,,,," with `,0,0,0,0,0,,"${item.head_coach}",,,`
        if (line.includes(',0,0,0,0,0,,,,,')) {
          return line.replace(',0,0,0,0,0,,,,,', `,0,0,0,0,0,,"${item.head_coach}",,,`);
        }
      }
    }
    return line;
  });
  fs.writeFileSync(standingsPath, updatedLines.join('\n'), 'utf8');
  console.log('[CSV] Updated standings2026.csv with head coaches.');

  // 3. Ensure People exist in Supabase
  const personMap = new Map();
  for (const item of coachesToRegister) {
    if (item.team === 'Bournemouth Bobcats') continue;
    // Query person
    let { data: person } = await supabase
      .from('people')
      .select('id, display_name')
      .ilike('display_name', item.head_coach)
      .maybeSingle();

    if (!person) {
      console.log(`Creating person: ${item.head_coach}`);
      const { data: newPerson, error: insertErr } = await supabase
        .from('people')
        .insert({
          first_name: item.firstName,
          last_name: item.lastName,
          display_name: item.head_coach
        })
        .select('id, display_name')
        .single();

      if (insertErr) {
        throw new Error(`Failed to insert person ${item.head_coach}: ${insertErr.message}`);
      }
      person = newPerson;
    }
    personMap.set(item.team, { personId: person.id, name: item.head_coach });
    console.log(`[Person] ${item.head_coach} => ${person.id}`);
  }

  // 4. Update participations in Supabase
  const seasonId = '1f2d75df-a1f4-4884-ab7c-b6c07c137083';

  for (const [teamName, coachInfo] of personMap.entries()) {
    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .select('id, name')
      .eq('name', teamName)
      .single();

    if (teamErr || !team) {
      console.error(`Team not found: ${teamName}`);
      continue;
    }

    // Get participation for 2026/27 season
    const { data: parts, error: partsErr } = await supabase
      .from('participations')
      .select('id, phase_id, phases!inner(name, season_id)')
      .eq('team_id', team.id)
      .eq('phases.season_id', seasonId);

    if (partsErr || !parts || parts.length === 0) {
      console.error(`No 2026 participation found for ${teamName}`);
      continue;
    }

    for (const part of parts) {
      const { error: updateErr } = await supabase
        .from('participations')
        .update({ head_coach_id: coachInfo.personId })
        .eq('id', part.id);

      if (updateErr) {
        console.error(`Failed to update participation ${part.id} for ${teamName}: ${updateErr.message}`);
      } else {
        console.log(`[Participation] ${teamName} (${part.phases.name}) -> ${coachInfo.name} (${coachInfo.personId})`);
      }
    }
  }

  // 5. Verification summary
  console.log('\n=== Verification: 2026/27 Registered Coaches in Supabase ===');
  const { data: verifyParts } = await supabase
    .from('participations')
    .select('id, team_id, head_coach_id, teams(name), people(display_name), phases!inner(name, season_id)')
    .eq('phases.season_id', seasonId)
    .not('head_coach_id', 'is', null);

  for (const p of verifyParts || []) {
    console.log(` - ${p.teams?.name} (${p.phases?.name}): ${p.people?.display_name} [${p.head_coach_id}]`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
