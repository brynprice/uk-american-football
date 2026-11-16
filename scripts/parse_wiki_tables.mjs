import ws from 'ws';
globalThis.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TEAMS_WITH_TABLES = [
  'Bedfordshire Blue Raiders',
  'Berkshire Renegades',
  'Birmingham Bulls (American football)',
  'Bournemouth Bobcats',
  'Colchester Gladiators',
  'Cornwall Monarchs',
  'Coventry Jets',
  'Dundee Hurricanes',
  'East Kent Mavericks',
  'Essex Tridents',
  'Hertfordshire Cheetahs',
  'Hull Hornets',
  'Leeds Bobcats',
  'Lincolnshire Bombers',
  'London Warriors',
  'Maidstone Pumas',
  'Ness Monsters AFC',
  'Nottingham Caesars',
  'Peterborough Saxons',
  'Plymouth Admirals',
  'Rushmoor Knights',
  'South Wales Warriors',
  'Tiger Bay Warriors',
  'West Coast Trojans'
];

async function loadDb() {
  const { data: teams } = await supabase.from('teams').select('id, name, team_type, team_aliases(id, name)');
  const teamMap = new Map();
  const idToName = new Map();

  teams?.forEach(t => {
    idToName.set(t.id, t.name);
    const norm = t.name.toLowerCase().trim();
    if (!teamMap.has(norm) || t.team_type === 'Adult') {
      teamMap.set(norm, t.id);
    }
    const stripped = norm.replace(/\b(afc|rfc|american football|team)\b/g, '').trim();
    if (stripped.length > 3 && (!teamMap.has(stripped) || t.team_type === 'Adult')) {
      teamMap.set(stripped, t.id);
    }

    t.team_aliases?.forEach(a => {
      const aNorm = a.name.toLowerCase().trim();
      if (!teamMap.has(aNorm) || t.team_type === 'Adult') {
        teamMap.set(aNorm, t.id);
      }
    });
  });

  return { teamMap, idToName, teams };
}

function resolveTeam(raw, teamMap) {
  if (!raw) return null;
  const clean = raw.replace(/\[\[|\]\]/g, '').replace(/\|.*/, '').replace(/@.*/, '').replace(/\b(the|afc|warriors|chargers)\b/gi, '').trim();
  const lower = clean.toLowerCase();
  if (teamMap.has(lower)) return teamMap.get(lower);

  for (const [k, id] of teamMap.entries()) {
    if (k.length > 4 && (lower.includes(k) || k.includes(lower))) {
      return id;
    }
  }
  return null;
}

async function run() {
  const { teamMap, idToName } = await loadDb();

  console.log('Analyzing tables in 24 Wikipedia articles...');

  for (const teamTitle of TEAMS_WITH_TABLES) {
    const text = fs.readFileSync(`scratch/wiki_cache/${teamTitle}.txt`, 'utf8');
    const primaryId = resolveTeam(teamTitle, teamMap);
    const primaryName = idToName.get(primaryId) || teamTitle;

    // Split text into table chunks
    const tableRegex = /\{\|class="wikitable"[^]*?\n\|\}/gi;
    let tableMatch;
    const teamGames = [];

    while ((tableMatch = tableRegex.exec(text)) !== null) {
      const tableContent = tableMatch[0];
      // Check if table contains game results (Date, Fixture, Result, etc.)
      if (!tableContent.includes('Result') && !tableContent.includes('Score') && !tableContent.includes('Points')) {
        continue;
      }

      // Find the year context from the preceding text
      const beforeTable = text.substring(0, tableMatch.index);
      const lastHeader = beforeTable.match(/==+\s*.*?\b(19\d\d|20\d\d)\b.*?==+/g);
      let yearContext = null;
      if (lastHeader && lastHeader.length > 0) {
        const last = lastHeader[lastHeader.length - 1];
        const ym = last.match(/\b(19\d\d|20\d\d)\b/);
        if (ym) yearContext = parseInt(ym[1]);
      }

      const rows = tableContent.split('\n|-');
      for (const row of rows) {
        // Look for score: \d+[-–]\d+
        const scoreMatch = row.match(/\b(\d{1,3})\s*[-–]\s*(\d{1,3})\b/);
        if (!scoreMatch) continue;

        const s1 = parseInt(scoreMatch[1]);
        const s2 = parseInt(scoreMatch[2]);

        // Look for date in row: e.g. 24 April 2011, 24 April, 24/04/2011
        const dateMatch = row.match(/\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+\d{4})?)\b/i);
        const rawDate = dateMatch ? dateMatch[1] : null;

        // Year
        let rowYear = yearContext;
        const yearInRow = row.match(/\b(19\d\d|20\d\d)\b/);
        if (yearInRow) rowYear = parseInt(yearInRow[1]);

        // Find opponent in row
        // Extract all [[Wiki Links]] in the row that are not dates
        const links = [];
        const linkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
        let lm;
        while ((lm = linkRegex.exec(row)) !== null) {
          const target = lm[2] || lm[1];
          if (!/^(january|february|march|april|may|june|july|august|september|october|november|december|\d{4})$/i.test(target.trim())) {
            links.push(target.trim());
          }
        }

        let oppName = links.length > 0 ? links[0] : null;
        let oppId = oppName ? resolveTeam(oppName, teamMap) : null;

        // If no link, check cell content
        if (!oppId) {
          const cells = row.split('\n|').map(c => c.trim()).filter(Boolean);
          for (const cell of cells) {
            const cleanCell = cell.replace(/\[\[|\]\]/g, '').replace(/^[a-z]+="[^"]*"\s*\|\s*/i, '').trim();
            const candId = resolveTeam(cleanCell, teamMap);
            if (candId && candId !== primaryId) {
              oppId = candId;
              oppName = idToName.get(oppId);
              break;
            }
          }
        }

        if (oppId && primaryId && oppId !== primaryId) {
          teamGames.push({
            teamId: primaryId,
            teamName: primaryName,
            oppId,
            oppName: idToName.get(oppId) || oppName,
            s1,
            s2,
            year: rowYear,
            rawDate,
            row: row.replace(/\s+/g, ' ').trim()
          });
        }
      }
    }

    if (teamGames.length > 0) {
      console.log(`\n=== ${primaryName} (${teamGames.length} table rows parsed) ===`);

      // Check each against DB
      let missingCount = 0;
      for (const g of teamGames) {
        const { data: dbMatches } = await supabase
          .from('games')
          .select('id, date, home_score, away_score, season:seasons(year)')
          .or(`and(home_team_id.eq.${g.teamId},away_team_id.eq.${g.oppId}),and(home_team_id.eq.${g.oppId},away_team_id.eq.${g.teamId})`);

        const exact = (dbMatches || []).find(db => {
          return (db.home_score === g.s1 && db.away_score === g.s2) ||
                 (db.home_score === g.s2 && db.away_score === g.s1);
        });

        if (!exact) {
          // Check if same year has matches
          const sameYear = (dbMatches || []).filter(db => {
            const y = db.date ? parseInt(db.date.substring(0, 4)) : db.season?.year;
            return g.year && y === g.year;
          });

          if (sameYear.length === 0) {
            console.log(`  [MISSING] ${g.year || '?'}: ${g.teamName} vs ${g.oppName} [${g.s1}–${g.s2}] (Date: ${g.rawDate || '?'})`);
            missingCount++;
          }
        }
      }
      if (missingCount === 0) {
        console.log(`  -> ALL ${teamGames.length} games already present and verified in DB!`);
      }
    }
  }
}

run().catch(console.error);
