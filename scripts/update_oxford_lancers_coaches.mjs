import fs from 'fs';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function serializeCSVRow(fields) {
  return fields.map(val => {
    const s = String(val === null || val === undefined ? '' : val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }).join(',');
}

async function run() {
  console.log('=== Step 1: Register in data/evidence/verified_coaches.json ===');
  const evidencePath = 'data/evidence/verified_coaches.json';
  const evidenceList = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));

  const newVerified = [
    {
      team: 'Oxford Lancers',
      year: 2014,
      head_coach: 'Andy McKenzie',
      source: 'Oxford Lancers official club records',
      source_details: 'Took over as head coach mid-season in 2014/15, leading the team to promotion per club history and Double Coverage.'
    },
    {
      team: 'Oxford Lancers',
      year: 2015,
      head_coach: 'Andy McKenzie',
      source: 'Oxford Lancers official club records',
      source_details: 'Head coach for undefeated promotion season and Cavaliers Cup championship per club history and Double Coverage.'
    },
    {
      team: 'Oxford Lancers',
      year: 2016,
      head_coach: 'Adam Goldstein',
      source: 'Oxford Lancers official club records',
      source_details: 'Appointed head coach and offensive coordinator for 2016/17 per Cherwell and club archives.'
    },
    {
      team: 'Oxford Lancers',
      year: 2017,
      head_coach: 'Adam Goldstein',
      source: 'Oxford Lancers official club records',
      source_details: 'Head coach for 2017/18 season per club archives and Cherwell coverage.'
    },
    {
      team: 'Oxford Lancers',
      year: 2018,
      head_coach: 'Ian Hiscock',
      source: 'Oxford Lancers official club records',
      source_details: 'Took over as head coach in 2018 per club history and BAFCA.'
    },
    {
      team: 'Oxford Lancers',
      year: 2019,
      head_coach: 'Ian Hiscock',
      source: 'Oxford Lancers official club records',
      source_details: 'Head coach for 2019/20 season per club records.'
    },
    {
      team: 'Oxford Lancers',
      year: 2020,
      head_coach: 'Ian Hiscock',
      source: 'Oxford Lancers official club records',
      source_details: 'Head coach for 2020/21 season per club records.'
    },
    {
      team: 'Oxford Lancers',
      year: 2021,
      head_coach: 'Ian Hiscock',
      source: 'Oxford Lancers official club records',
      source_details: 'Head coach for 2021/22 undefeated regular season per club records.'
    },
    {
      team: 'Oxford Lancers',
      year: 2022,
      head_coach: 'Ian Hiscock',
      source: 'Oxford Lancers official club records',
      source_details: 'Head coach for 2022/23 season per club records and BUCS Play.'
    },
    {
      team: 'Oxford Lancers',
      year: 2023,
      head_coach: 'Ian Hiscock',
      source: 'Oxford Lancers official club records',
      source_details: 'Head coach for 2023/24 season per club records and BUCS Play.'
    },
    {
      team: 'Oxford Lancers',
      year: 2024,
      head_coach: 'Ian Hiscock',
      source: 'Oxford Lancers official club records',
      source_details: 'Head coach for 2024/25 season per club records and BUCS Play.'
    },
    {
      team: 'Oxford Lancers',
      year: 2025,
      head_coach: 'Ian Hiscock',
      source: 'Oxford Lancers official club records',
      source_details: 'Head coach for 2025/26 season per club records and BUCS Play.'
    },
    {
      team: 'Oxford Lancers',
      year: 2026,
      head_coach: 'Ian Hiscock',
      source: 'Oxford Lancers official club records',
      source_details: 'Head coach for 2026/27 season per club records and BUCS Play.'
    }
  ];

  for (const item of newVerified) {
    const existing = evidenceList.find(e => e.team === item.team && e.year === item.year && e.head_coach === item.head_coach);
    if (!existing) {
      evidenceList.push(item);
    }
  }

  fs.writeFileSync(evidencePath, JSON.stringify(evidenceList, null, 2) + '\n');
  console.log(`Updated ${evidencePath} with ${newVerified.length} records`);

  console.log('\n=== Step 2: Updating standings files ===');
  const coachByYear = {
    2014: 'Andy McKenzie',
    2015: 'Andy McKenzie',
    2016: 'Adam Goldstein',
    2017: 'Adam Goldstein',
    2018: 'Ian Hiscock',
    2019: 'Ian Hiscock',
    2020: 'Ian Hiscock',
    2021: 'Ian Hiscock',
    2022: 'Ian Hiscock',
    2023: 'Ian Hiscock',
    2024: 'Ian Hiscock',
    2025: 'Ian Hiscock',
    2026: 'Ian Hiscock'
  };

  for (const [yearStr, coachName] of Object.entries(coachByYear)) {
    const sPath = `data/BUAFL/standings${yearStr}.csv`;
    if (!fs.existsSync(sPath)) continue;
    const lines = fs.readFileSync(sPath, 'utf-8').split('\n').filter(l => l.trim().length > 0);
    const header = parseCSVLine(lines[0]);
    const hcIdx = header.findIndex(h => h.trim() === 'head_coach');
    const teamIdx = header.findIndex(h => h.trim() === 'team');

    if (hcIdx === -1 || teamIdx === -1) continue;

    const newRows = [lines[0]];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row[teamIdx] && row[teamIdx].trim() === 'Oxford Lancers') {
        row[hcIdx] = coachName;
        console.log(`Updated ${sPath} Oxford Lancers head_coach -> ${coachName}`);
      }
      newRows.push(serializeCSVRow(header.map((_, idx) => row[idx] || '')));
    }
    fs.writeFileSync(sPath, newRows.join('\n') + '\n');
  }

  console.log('\n=== Step 3: Updating games files ===');
  for (let y = 2014; y <= 2026; y++) {
    const gPath = `data/BUAFL/games${y}.csv`;
    if (!fs.existsSync(gPath)) continue;

    const lines = fs.readFileSync(gPath, 'utf-8').split('\n').filter(l => l.trim().length > 0);
    const header = parseCSVLine(lines[0]);
    const atIdx = header.findIndex(h => h.trim() === 'away_team');
    const htIdx = header.findIndex(h => h.trim() === 'home_team');
    const acIdx = header.findIndex(h => h.trim() === 'away_coach');
    const hcIdx = header.findIndex(h => h.trim() === 'home_coach');
    const dateIdx = header.findIndex(h => h.trim() === 'date');

    const newRows = [lines[0]];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const away = (row[atIdx] || '').trim();
      const home = (row[htIdx] || '').trim();
      const date = (row[dateIdx] || '').trim();

      let assignedCoach = coachByYear[y];
      if (y === 2014) {
        // Only games from 2015-02-01 onwards were coached by Andy McKenzie
        if (!date || date < '2015-02-01') {
          assignedCoach = ''; // Carl (leave blank)
        }
      }

      if (away === 'Oxford Lancers' && assignedCoach) {
        row[acIdx] = assignedCoach;
      }
      if (home === 'Oxford Lancers' && assignedCoach) {
        row[hcIdx] = assignedCoach;
      }

      newRows.push(serializeCSVRow(header.map((_, idx) => row[idx] || '')));
    }
    fs.writeFileSync(gPath, newRows.join('\n') + '\n');
    console.log(`Updated Oxford Lancers coaches in ${gPath}`);
  }

  console.log('\n=== Step 4: Supabase Database Synchronization ===');
  // 4a. Ensure People in Supabase
  const coachesToEnsure = [
    { first_name: 'Andy', last_name: 'McKenzie', display_name: 'Andy McKenzie' },
    { first_name: 'Adam', last_name: 'Goldstein', display_name: 'Adam Goldstein' },
    { first_name: 'Ian', last_name: 'Hiscock', display_name: 'Ian Hiscock' }
  ];

  const personIdMap = {};
  for (const c of coachesToEnsure) {
    const { data: existing } = await supabase.from('people')
      .select('id')
      .eq('display_name', c.display_name)
      .maybeSingle();

    if (existing) {
      personIdMap[c.display_name] = existing.id;
      console.log(`Found person: ${c.display_name} -> ${existing.id}`);
    } else {
      const { data: created, error } = await supabase.from('people')
        .insert(c)
        .select()
        .single();
      if (error) {
        console.error(`Error creating person ${c.display_name}:`, error.message);
      } else {
        personIdMap[c.display_name] = created.id;
        console.log(`Created person: ${c.display_name} -> ${created.id}`);
      }
    }
  }

  // 4b. Update participations in Supabase for Oxford Lancers
  const { data: oxfordTeam, error: teamErr } = await supabase.from('teams').select('id').eq('name', 'Oxford Lancers').single();
  if (teamErr || !oxfordTeam) {
    console.error('Could not find Oxford Lancers team in database:', teamErr);
    return;
  }

  const { data: oxfordParts, error: partErr } = await supabase
    .from('participations')
    .select('id, phase_id, phases(id, season_id, seasons(id, year))')
    .eq('team_id', oxfordTeam.id);

  if (partErr) {
    console.error('Error fetching Oxford Lancers participations:', partErr);
  } else {
    for (const part of oxfordParts || []) {
      const yr = part.phases?.seasons?.year;
      const coachName = coachByYear[yr];
      if (coachName && personIdMap[coachName]) {
        const { error: updateErr } = await supabase
          .from('participations')
          .update({ head_coach_id: personIdMap[coachName] })
          .eq('id', part.id);

        if (updateErr) {
          console.error(`Error updating participation ${part.id} for year ${yr}:`, updateErr.message);
        } else {
          console.log(`Updated Oxford Lancers participation id=${part.id} for season ${yr} -> ${coachName}`);
        }
      }
    }
  }

  console.log('\n=== All Head Coach updates completed successfully! ===');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
