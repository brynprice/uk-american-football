import ws from 'ws';
globalThis.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TEAMS_WITH_PLAYOFF_TABLES = [
  'Colchester Gladiators',
  'Coventry Jets',
  'East Kent Mavericks',
  'Essex Tridents',
  'Hertfordshire Cheetahs',
  'Hull Hornets',
  'Ipswich Cardinals',
  'Leeds Bobcats',
  'Lincolnshire Bombers',
  'Norwich Devils',
  'Nottingham Caesars',
  'Peterborough Saxons',
  'Plymouth Admirals',
  'Rushmoor Knights',
  'Southern Sundevils',
  'Tiger Bay Warriors'
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
    const stripped = norm.replace(/\b(afc|rfc|american football|team|club)\b/g, '').trim();
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

  return { teamMap, idToName };
}

function resolveTeam(raw, teamMap) {
  if (!raw) return null;
  const clean = raw.replace(/\[\[|\]\]/g, '').replace(/\|.*/, '').replace(/\b(the|afc|warriors|chargers|football)\b/gi, '').trim();
  const lower = clean.toLowerCase();
  if (teamMap.has(lower)) return teamMap.get(lower);

  for (const [k, id] of teamMap.entries()) {
    if (k.length > 4 && (lower.includes(k) || k.includes(lower))) {
      return id;
    }
  }
  return null;
}

async function auditPlayoffs() {
  const { teamMap, idToName } = await loadDb();

  const playoffCandidates = [];

  for (const teamTitle of TEAMS_WITH_PLAYOFF_TABLES) {
    const text = fs.readFileSync(`scratch/wiki_cache/${teamTitle}.txt`, 'utf8');
    const primaryId = resolveTeam(teamTitle, teamMap);
    const primaryName = idToName.get(primaryId) || teamTitle;

    // Parse table rows
    // In these tables, there is a Season column and a Playoff record column
    const rows = text.split('\n|-');
    for (const row of rows) {
      // Find year: 1985 to 2025
      const yearMatch = row.match(/\b(19\d\d|20\d\d)\b/);
      if (!yearMatch) continue;
      const year = parseInt(yearMatch[1]);

      // Look for matches inside the row:
      // Pattern: (Beat|Lost to|Drew with) [Opponent] (\d+)[-–](\d+) in [Round]
      // or Lost (\d+)[-–](\d+) to [Opponent]
      const playoffRegex = /(?:(beat|lost to|lost|defeated)\s+([A-Za-z0-9\s\[\]|]+?)\s*(\d{1,3})\s*[-–]\s*(\d{1,3})|(lost|beat)\s*(\d{1,3})\s*[-–]\s*(\d{1,3})\s*(?:to|against|over)\s+([A-Za-z0-9\s\[\]|]+?))\s+(?:in|at)\s+([A-Za-z0-9\s-]+?)(?:\.|<|\n|\|)/gi;

      let m;
      while ((m = playoffRegex.exec(row)) !== null) {
        const verb = (m[1] || m[5]).toLowerCase();
        let oppRaw = m[2] || m[8];
        let s1 = parseInt(m[3] || m[6]);
        let s2 = parseInt(m[4] || m[7]);
        const round = m[9] ? m[9].trim() : 'Playoff';

        if (verb.includes('lost')) {
          // If lost, the team score is the smaller one
          if (s1 > s2) {
            const tmp = s1; s1 = s2; s2 = tmp;
          }
        } else {
          // If beat, the team score is the larger one
          if (s1 < s2) {
            const tmp = s1; s1 = s2; s2 = tmp;
          }
        }

        const oppClean = oppRaw.replace(/\[\[|\]\]/g, '').replace(/\|.*/, '').replace(/\b(the)\b/gi, '').trim();
        const oppId = resolveTeam(oppClean, teamMap);

        if (oppId && primaryId && oppId !== primaryId) {
          playoffCandidates.push({
            year,
            teamTitle,
            teamId: primaryId,
            teamName: primaryName,
            oppId,
            oppName: idToName.get(oppId) || oppClean,
            teamScore: s1,
            oppScore: s2,
            round,
            verb,
            rawRow: row.replace(/\s+/g, ' ').slice(0, 150)
          });
        }
      }
    }
  }

  console.log(`Extracted ${playoffCandidates.length} playoff game candidates from Wikipedia tables.`);

  // Cross reference with DB
  const missing = [];
  const existing = [];

  for (const c of playoffCandidates) {
    const { data: dbGames } = await supabase
      .from('games')
      .select('id, date, home_score, away_score, is_playoff, title_name, season:seasons(year)')
      .or(`and(home_team_id.eq.${c.teamId},away_team_id.eq.${c.oppId}),and(home_team_id.eq.${c.oppId},away_team_id.eq.${c.teamId})`);

    // Match exact score and year
    const match = (dbGames || []).find(g => {
      const gYear = g.date ? parseInt(g.date.substring(0, 4)) : g.season?.year;
      const scoresMatch = (g.home_score === c.teamScore && g.away_score === c.oppScore) ||
                          (g.home_score === c.oppScore && g.away_score === c.teamScore);
      return scoresMatch && (!gYear || gYear === c.year);
    });

    if (match) {
      existing.push({ ...c, dbGameId: match.id });
    } else {
      missing.push({ ...c, dbGames: dbGames || [] });
    }
  }

  console.log(`\nExisting in DB: ${existing.length}`);
  console.log(`MISSING FROM DB: ${missing.length}`);

  // Deduplicate missing games
  const uniqueMissing = new Map();
  for (const m of missing) {
    const key = `${m.year}_${[m.teamId, m.oppId].sort().join('_')}_${[m.teamScore, m.oppScore].sort().join('_')}`;
    if (!uniqueMissing.has(key)) {
      uniqueMissing.set(key, m);
    }
  }

  console.log(`\nUNIQUE MISSING PLAYOFF GAMES: ${uniqueMissing.size}`);
  for (const m of uniqueMissing.values()) {
    console.log(`* [${m.year}] ${m.teamName} ${m.teamScore} - ${m.oppScore} ${m.oppName} (${m.round})`);
    console.log(`  Source: https://en.wikipedia.org/wiki/${encodeURIComponent(m.teamTitle)}`);
  }
}

auditPlayoffs().catch(console.error);
