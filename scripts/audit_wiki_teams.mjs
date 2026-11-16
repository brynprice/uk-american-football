import ws from 'ws';
globalThis.WebSocket = ws;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CACHE_DIR = 'scratch/wiki_cache';
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const WIKI_TEAMS = [
  'Aberdeen Roughnecks',
  'Bedfordshire Blue Raiders',
  'Berkshire Renegades',
  'Birmingham Bulls (American football)',
  'Bournemouth Bobcats',
  'Bristol Aztecs',
  'Bristol Packers',
  'Cambridgeshire Cats',
  'Carlisle Border Reivers',
  'Chester Romans',
  'Clyde Valley Blackhawks',
  'Colchester Gladiators',
  'Cornwall Monarchs',
  'Coventry Jets',
  'Crawley Raiders',
  'Crewe Railroaders',
  'DC Presidents',
  'Doncaster Mustangs',
  'Dundee Hurricanes',
  'East Kent Mavericks',
  'East Kilbride Pirates',
  'Edinburgh Wolves',
  'Essex Tridents',
  'Gateshead Senators',
  'Glasgow Tigers (American football)',
  'Gloucester Centurions',
  'Halton Spartans',
  'Hertfordshire Cheetahs',
  'Highland Wildcats',
  'Hull Hornets',
  'Humber Warhawks',
  'Ipswich Cardinals',
  'Lancashire Buccaneers',
  'Leeds Bobcats',
  'Leicester Panthers',
  'Lincolnshire Bombers',
  'London Blitz (American football)',
  'London Olympians',
  'London Warriors',
  'Maidstone Pumas',
  'Manchester Spartans',
  'Manchester Titans',
  'Merseyside Nighthawks',
  'Morecambe Bay Storm',
  'Ness Monsters AFC',
  'Newcastle Vikings',
  'Norwich Devils',
  'Nottingham Caesars',
  'Ouse Valley Eagles',
  'Oxford Saints',
  'Peterborough Saxons',
  'Plymouth Admirals',
  'Portsmouth Dreadnoughts',
  'Redditch Arrows',
  'Rushmoor Knights',
  'Scunthorpe Alphas',
  'Sheffield Giants',
  'Shropshire Revolution',
  'South Wales Warriors',
  'Southern Sundevils',
  'Sussex Thunder',
  'Tiger Bay Warriors',
  'West Coast Trojans',
  'Wolverhampton Outlaws',
  'Wrekin Giants',
  'Yorkshire Rams'
];

async function fetchWikiPages() {
  const batchSize = 30;
  for (let i = 0; i < WIKI_TEAMS.length; i += batchSize) {
    const chunk = WIKI_TEAMS.slice(i, i + batchSize);
    const needed = chunk.filter(t => !fs.existsSync(path.join(CACHE_DIR, `${t.replace(/[/\\?%*:|"<>]/g, '_')}.txt`)));
    if (needed.length === 0) continue;

    console.log(`Fetching batch: ${needed.join(', ')}`);
    const titlesParam = needed.map(encodeURIComponent).join('|');
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${titlesParam}&prop=revisions&rvprop=content&format=json&rvslots=main`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'UKFootballHistoryBot/1.0 (https://britball.io; contact@britball.io)' }
    });
    const data = await res.json();
    const pages = data.query?.pages || {};

    for (const p of Object.values(pages)) {
      const content = p.revisions?.[0]?.slots?.main?.['*'] || '';
      const filePath = path.join(CACHE_DIR, `${p.title.replace(/[/\\?%*:|"<>]/g, '_')}.txt`);
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
}

async function loadDbData() {
  console.log('Loading teams and aliases from Supabase...');
  const { data: teams } = await supabase.from('teams').select('id, name, team_aliases(id, name)');
  const teamMap = new Map(); // normalized name -> team_id
  const idToName = new Map();

  teams?.forEach(t => {
    idToName.set(t.id, t.name);
    const norm = t.name.toLowerCase().trim();
    teamMap.set(norm, t.id);
    // remove common words for matching
    const stripped = norm.replace(/\b(afc|rfc|american football|team)\b/g, '').trim();
    if (stripped.length > 3) teamMap.set(stripped, t.id);

    t.team_aliases?.forEach(a => {
      const aNorm = a.name.toLowerCase().trim();
      teamMap.set(aNorm, t.id);
      const aStripped = aNorm.replace(/\b(afc|rfc|american football|team)\b/g, '').trim();
      if (aStripped.length > 3) teamMap.set(aStripped, t.id);
    });
  });

  return { teamMap, idToName, teams };
}

function resolveTeamId(rawName, teamMap) {
  if (!rawName) return null;
  const clean = rawName.replace(/\[\[|\]\]/g, '').replace(/\|.*/, '').toLowerCase().trim();
  if (teamMap.has(clean)) return teamMap.get(clean);

  // try stripped
  const stripped = clean.replace(/\b(afc|rfc|american football|the)\b/g, '').trim();
  if (teamMap.has(stripped)) return teamMap.get(stripped);

  // try substring matches
  for (const [key, id] of teamMap.entries()) {
    if (key.length > 4 && (clean.includes(key) || key.includes(clean))) {
      return id;
    }
  }
  return null;
}

async function audit() {
  await fetchWikiPages();
  const { teamMap, idToName, teams } = await loadDbData();

  console.log('Scanning cached Wikipedia articles for candidate fixtures...');
  const candidates = [];

  for (const pageTitle of WIKI_TEAMS) {
    const filePath = path.join(CACHE_DIR, `${pageTitle.replace(/[/\\?%*:|"<>]/g, '_')}.txt`);
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, 'utf8');

    const primaryTeamId = resolveTeamId(pageTitle, teamMap);
    const primaryTeamName = idToName.get(primaryTeamId) || pageTitle;

    // Pattern 1: Table rows containing score: | Date | Opponent | Score | ...
    // Pattern 2: Narrative text: "beat [Opponent] 24–7", "lost to [Opponent] 14–6", "defeating [Opponent] 31-10"
    // Pattern 3: Bowl / playoff results: "Bowl ... defeated [Opponent] 28–20"

    // Let's parse narrative and tables
    const lines = text.split('\n');
    let currentYear = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track year from headings like == 2012 season == or == 1989 ==
      const yearMatch = line.match(/==+\s*.*?\b(19\d\d|20\d\d)\b.*?==+/);
      if (yearMatch) {
        currentYear = parseInt(yearMatch[1]);
      }

      // Check for score patterns: e.g. 24–7, 24-7
      // Regex looking for: (beat|defeated|lost to|won|lost|victory over) (Opponent) (\d+)[-–](\d+)
      // or (Opponent) (\d+)[-–](\d+)
      const narrativeRegex = /(?:(?:beat|defeating|defeated|lost to|overcame|edged|fell to|rout of|victory over|win over)\s+([A-Za-z0-9\s\[\]|]+?)\s*(\d{1,3})\s*[-–]\s*(\d{1,3})|(\d{1,3})\s*[-–]\s*(\d{1,3})\s+(?:victory|win|defeat|loss)\s+(?:over|against|to)\s+([A-Za-z0-9\s\[\]|]+))/gi;

      let match;
      while ((match = narrativeRegex.exec(line)) !== null) {
        const oppRaw = match[1] || match[6];
        const s1 = parseInt(match[2] || match[4]);
        const s2 = parseInt(match[3] || match[5]);

        if (oppRaw && !isNaN(s1) && !isNaN(s2)) {
          // Filter out false positives like "season 10-0", "record 8-2"
          if (match[0].toLowerCase().includes('record') || match[0].toLowerCase().includes('went')) continue;

          // Check if oppRaw looks like a team
          const oppClean = oppRaw.replace(/\[\[|\]\]/g, '').replace(/\|.*/, '').replace(/\b(the)\b/gi, '').trim();
          if (oppClean.length < 3 || oppClean.length > 40) continue;
          if (/^(january|february|march|april|may|june|july|august|september|october|november|december|points|touchdowns|yards)$/i.test(oppClean)) continue;

          const oppId = resolveTeamId(oppClean, teamMap);

          // Find year from line or currentYear
          let year = currentYear;
          const inlineYear = line.match(/\b(19\d\d|20\d\d)\b/);
          if (inlineYear) year = parseInt(inlineYear[1]);

          candidates.push({
            sourceTitle: pageTitle,
            teamId: primaryTeamId,
            teamName: primaryTeamName,
            oppRaw: oppClean,
            oppId,
            oppName: idToName.get(oppId) || oppClean,
            score1: s1,
            score2: s2,
            year,
            context: line.trim()
          });
        }
      }
    }
  }

  console.log(`Extracted ${candidates.length} candidate fixture mentions from Wikipedia text.`);

  // Now cross-reference against Supabase games table
  console.log('Querying Supabase games table to check candidate matches...');
  const missingGames = [];
  const scoreDiscrepancies = [];
  const confirmedExisting = [];

  for (const c of candidates) {
    if (!c.teamId || !c.oppId) {
      // One of the teams could not be resolved to DB
      continue;
    }

    // Query all games between these two teams across all time
    const query = supabase
      .from('games')
      .select('id, date, home_score, away_score, home_team_id, away_team_id, title_name, is_playoff, season:seasons(year)')
      .or(`and(home_team_id.eq.${c.teamId},away_team_id.eq.${c.oppId}),and(home_team_id.eq.${c.oppId},away_team_id.eq.${c.teamId})`);

    const { data: dbGames } = await query;

    // 1. Check if exact score match exists across ANY year
    const exactScoreMatch = (dbGames || []).find(g => {
      return (g.home_score === c.score1 && g.away_score === c.score2) ||
             (g.home_score === c.score2 && g.away_score === c.score1);
    });

    if (exactScoreMatch) {
      confirmedExisting.push({ ...c, dbGame: exactScoreMatch });
      continue;
    }

    // 2. Filter by year if we know the year
    const matchingYearGames = (dbGames || []).filter(g => {
      const gYear = g.date ? parseInt(g.date.substring(0, 4)) : g.season?.year;
      return c.year && gYear && gYear === c.year;
    });

    if (matchingYearGames.length > 0) {
      // Game exists in DB for this year, but score differs or DB score is null
      scoreDiscrepancies.push({ ...c, dbGames: matchingYearGames });
    } else {
      missingGames.push({ ...c, allH2H: dbGames || [] });
    }
  }

  console.log(`\n=== AUDIT RESULTS ===`);
  console.log(`Confirmed in DB: ${confirmedExisting.length}`);
  console.log(`Score Discrepancies / Missing Scores in DB: ${scoreDiscrepancies.length}`);
  console.log(`POTENTIALLY MISSING FROM DB: ${missingGames.length}`);

  // Deduplicate and group missing games by Team
  const missingByTeam = {};
  for (const m of missingGames) {
    const key = `${m.teamName} vs ${m.oppName} (${m.year || 'Unknown Year'}): ${m.score1}-${m.score2}`;
    if (!missingByTeam[m.teamName]) missingByTeam[m.teamName] = new Map();
    missingByTeam[m.teamName].set(key, m);
  }

  console.log('\n======================================================');
  console.log('TOP CANDIDATE MISSING GAMES DISCOVERED ON WIKIPEDIA:');
  console.log('======================================================');
  for (const [team, gamesMap] of Object.entries(missingByTeam)) {
    console.log(`\n### ${team} (${gamesMap.size} missing fixtures)`);
    for (const g of gamesMap.values()) {
      console.log(`  * Year ${g.year || '?'}: ${g.teamName} vs ${g.oppName} [${g.score1}–${g.score2}]`);
      console.log(`    Context: "${g.context.slice(0, 120)}..."`);
      console.log(`    Source: https://en.wikipedia.org/wiki/${encodeURIComponent(g.sourceTitle)}`);
    }
  }

  // Also print score discrepancies
  if (scoreDiscrepancies.length > 0) {
    console.log('\n======================================================');
    console.log('TOP SCORE DISCREPANCIES / NULL SCORES IN DB:');
    console.log('======================================================');
    const discMap = new Map();
    for (const d of scoreDiscrepancies) {
      const key = `${d.teamName} vs ${d.oppName} (${d.year}): Wiki ${d.score1}-${d.score2}`;
      discMap.set(key, d);
    }
    for (const d of discMap.values()) {
      console.log(`  * Year ${d.year}: ${d.teamName} vs ${d.oppName}`);
      console.log(`    Wiki Score: ${d.score1}–${d.score2}`);
      console.log(`    DB Games in that year:`, d.dbGames.map(g => `ID ${g.id} (Date: ${g.date}, Score: ${g.home_score}-${g.away_score})`));
      console.log(`    Context: "${d.context.slice(0, 100)}..."`);
    }
  }
}

audit().catch(console.error);
