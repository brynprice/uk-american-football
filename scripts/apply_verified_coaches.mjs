#!/usr/bin/env node
/**
 * Reusable Verified Head Coach Registration & Sync CLI
 *
 * Validates candidate coaches against AGENTS.md Rules 5 & 6, optionally merges
 * discovered official URLs into data/mappings/team_sources.json, updates
 * data/evidence/verified_coaches.json and data/<COMP>/standings<YEAR>.csv,
 * and optionally syncs people + participations.head_coach_id to Supabase.
 *
 * Usage:
 *   node scripts/apply_verified_coaches.mjs --competition BUAFL --season 2026 --input data/evidence/coach_candidates_buafl_2026.json --sync-existing --dry-run
 *   node scripts/apply_verified_coaches.mjs --competition BUAFL --season 2026 --input data/evidence/coach_candidates_buafl_2026.json --merge-sources
 *   node scripts/apply_verified_coaches.mjs --competition BUAFL --season 2026 --input data/evidence/coach_candidates_buafl_2026.json --sync-existing --apply --sync-db --merge-sources
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import ws from 'ws';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  ROOT_DIR,
  parseCliArgs,
  readCsvRecords,
  writeCsvRecords,
  loadVerifiedCoaches,
  loadTeamSources,
  saveTeamSources,
  resolveCanonicalTeam,
  isRedirectUrl,
  isValidCanonicalUrl,
  validateCandidateForRegistration,
} from './lib/coach_utils.mjs';

function printHelp() {
  console.log(`
Usage:
  node scripts/apply_verified_coaches.mjs [options]

Options:
  --competition <NAME>   Competition folder under data/ (default: BUAFL)
  --season <YYYY>        Season year (default: 2026)
  --multi-season         Expand candidates with year or years[] across multiple seasons
  --input <path>         Path to candidate JSON file from search_active_coaches workflow
  --sync-existing        Also sync verified_unsynced entries already in verified_coaches.json into standings CSV (and DB if --sync-db)
  --dry-run              Preview changes without writing verified_coaches.json or standings CSV (default if --apply not set)
  --apply                Write verified_coaches.json and standings<YEAR>.csv
  --sync-db              With --apply, upsert people and update participations.head_coach_id in Supabase
  --merge-sources        Merge clean canonical discovered official/wiki/social URLs into data/mappings/team_sources.json
  --help                 Show this help message
`);
}

function loadCandidates(inputPath) {
  const absPath = path.resolve(ROOT_DIR, inputPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Input file not found: ${absPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.results)) return raw.results;
  if (Array.isArray(raw.teams)) return raw.teams;
  throw new Error(`Unsupported candidate JSON structure in ${absPath}`);
}

function classifyAndMergeUrl(entry, urlStr) {
  if (!isValidCanonicalUrl(urlStr)) return false;
  let u;
  try {
    u = new URL(urlStr.trim());
  } catch {
    return false;
  }
  const cleanUrl = u.toString();
  const host = u.hostname.replace(/^www\./, '').toLowerCase();

  if (host.includes('fandom.com') || host.includes('wikipedia.org')) {
    if (!entry.wiki_urls.includes(cleanUrl)) {
      entry.wiki_urls.push(cleanUrl);
      return true;
    }
    return false;
  }
  if (['instagram.com', 'facebook.com', 'x.com', 'twitter.com'].includes(host)) {
    // Only store profile/club pages in social_handles, not individual posts
    const isSinglePost = /\/(p|reel|status|posts|videos)\//i.test(u.pathname);
    if (!isSinglePost && !entry.social_handles.includes(cleanUrl)) {
      entry.social_handles.push(cleanUrl);
      return true;
    }
    return false;
  }

  // Filter out generic aggregators, third-party media, and dated news/blog/PDF URLs from official_urls
  const nonOfficialHosts = [
    'linkedin.com',
    'fieldlevel.com',
    'bucs.org.uk',
    'britishamericanfootball.org',
    'dblcoverage.blogspot.com',
    'americanfootballinternational.com',
    'youtube.com',
    'devonlive.com',
    'theboar.org',
    'enrg.scot',
    'bristol247.com',
    'eveningnews24.co.uk',
    'uclpimedia.com',
    'sparksunderland.com',
    'salfordnow.co.uk',
    'herefordstampede.co.uk',
    'thelinc.co.uk',
    'britball.io',
    'aflepro.com',
    'versusperformance.com',
    'hubbub.net',
    'wixsite.com',
  ];
  if (nonOfficialHosts.some((d) => host === d || host.endsWith('.' + d))) {
    return false;
  }
  const isDatedOrNewsOrPdf =
    /\/\d{4}\/\d{2}\//.test(u.pathname) ||
    /\/student-news\//.test(u.pathname) ||
    /\.pdf$/i.test(u.pathname) ||
    /^(blogs|news|sportsbyte)\./i.test(host);
  if (isDatedOrNewsOrPdf) {
    return false;
  }
  if (!entry.official_urls.includes(cleanUrl)) {
    entry.official_urls.push(cleanUrl);
    return true;
  }
  return false;
}

function mergeDiscoveredSources(candidates, competition, dryRunOnly) {
  const teamSources = loadTeamSources();
  let addedUrls = 0;
  let updatedTeams = 0;

  for (const c of candidates) {
    const canon = resolveCanonicalTeam(c.team, competition);
    if (!canon) continue;
    if (!teamSources[canon]) {
      teamSources[canon] = {
        team: canon,
        university: c.university || '',
        official_urls: [],
        social_handles: [],
        wiki_urls: [],
        notes: '',
      };
    }
    const target = teamSources[canon];
    const pool = [...(Array.isArray(c.discovered_official_urls) ? c.discovered_official_urls : [])];
    if (c.source_url && isValidCanonicalUrl(c.source_url)) {
      pool.push(c.source_url);
    }
    let teamChanged = false;
    for (const u of pool) {
      if (classifyAndMergeUrl(target, u)) {
        addedUrls++;
        teamChanged = true;
      }
    }
    if (teamChanged) updatedTeams++;
  }

  if (dryRunOnly) {
    console.log(`[Sources Dry-Run] Would add ${addedUrls} clean canonical URL(s) across ${updatedTeams} team(s) in data/mappings/team_sources.json.`);
  } else {
    saveTeamSources(teamSources);
    console.log(`[Sources] Merged ${addedUrls} clean canonical URL(s) across ${updatedTeams} team(s) into data/mappings/team_sources.json.`);
  }
}

async function resolveSupabaseCompetition(supabase, competition) {
  const compUpper = competition.toUpperCase();
  let res;

  if (compUpper === 'BUAFL') {
    res = await supabase
      .from('competitions')
      .select('id, name, slug')
      .or('slug.eq.buafl,name.ilike.%British Universities%')
      .limit(1)
      .maybeSingle();
  } else if (compUpper === 'BAFANL') {
    res = await supabase
      .from('competitions')
      .select('id, name, slug')
      .or('slug.eq.bafanl,name.ilike.%BAFA National%')
      .limit(1)
      .maybeSingle();
  } else if (compUpper === 'NWFL') {
    res = await supabase
      .from('competitions')
      .select('id, name, slug')
      .or('slug.eq.nwfl,name.eq.NWFL')
      .limit(1)
      .maybeSingle();
  } else {
    res = await supabase
      .from('competitions')
      .select('id, name, slug')
      .or(`slug.eq.${competition.toLowerCase()},name.ilike.%${competition}%`)
      .limit(1)
      .maybeSingle();
  }

  if (res.error) {
    throw new Error(`Supabase query failed for competition '${competition}': ${res.error.message}`);
  }
  if (!res.data) {
    throw new Error(`Competition '${competition}' not found in Supabase.`);
  }
  return res.data;
}

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return {
    first_name: parts.slice(0, -1).join(' '),
    last_name: parts[parts.length - 1],
  };
}

async function resolveTeamIds(supabase, names) {
  const teamNames = [...new Set(names.filter(Boolean))];
  if (teamNames.length === 0) return [];

  const [{ data: directTeams }, { data: aliasTeams }] = await Promise.all([
    supabase.from('teams').select('id').in('name', teamNames),
    supabase.from('team_aliases').select('team_id').in('name', teamNames),
  ]);

  const ids = new Set();
  for (const t of directTeams || []) ids.add(t.id);
  for (const a of aliasTeams || []) {
    if (a.team_id) ids.add(a.team_id);
  }
  return [...ids];
}

async function syncCoachesToSupabase(coachAssignments, competition) {
  dotenv.config({ path: path.join(ROOT_DIR, '.env.local'), quiet: true });
  global.WebSocket = ws;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const comp = await resolveSupabaseCompetition(supabase, competition);

  // Group assignments by year sorted ascending
  const byYear = new Map();
  for (const item of coachAssignments) {
    const yr = Number(item.year);
    if (!byYear.has(yr)) byYear.set(yr, []);
    byYear.get(yr).push(item);
  }

  const personCache = new Map();
  const teamIdsCache = new Map();
  let peopleCreated = 0;
  let updatedCount = 0;

  for (const yr of [...byYear.keys()].sort((a, b) => a - b)) {
    const { data: seasonRec, error: sErr } = await supabase
      .from('seasons')
      .select('id, year, name')
      .eq('competition_id', comp.id)
      .eq('year', yr)
      .maybeSingle();

    if (sErr) {
      throw new Error(`Supabase error fetching season ${yr}: ${sErr.message}`);
    }
    if (!seasonRec) {
      console.log(`\n[DB Info] No Supabase season record for ${comp.name} ${yr}; skipping DB sync for ${yr}.`);
      continue;
    }

    console.log(`\n[DB Sync] Target: ${comp.name} — ${seasonRec.name || seasonRec.year} (${seasonRec.id})`);

    for (const item of byYear.get(yr)) {
      const coachName = item.head_coach.trim();
      let personId = personCache.get(coachName.toLowerCase());
      if (!personId) {
        let { data: peopleMatches, error: pQueryErr } = await supabase
          .from('people')
          .select('id, display_name')
          .ilike('display_name', coachName)
          .limit(1);
        if (pQueryErr) {
          throw new Error(`Failed querying person '${coachName}': ${pQueryErr.message}`);
        }
        let person = peopleMatches?.[0] || null;

        if (!person) {
          const { first_name, last_name } = splitName(coachName);
          const { data: inserted, error: insErr } = await supabase
            .from('people')
            .insert({
              first_name: first_name || null,
              last_name: last_name || null,
              display_name: coachName,
            })
            .select('id, display_name')
            .single();
          if (insErr) {
            throw new Error(`Failed to insert person '${coachName}': ${insErr.message}`);
          }
          person = inserted;
          peopleCreated++;
          console.log(`  [DB Person Created] ${coachName} -> ${person.id}`);
        }
        personId = person.id;
        personCache.set(coachName.toLowerCase(), personId);
      }

      const lookupKey = `${item.canonical_team}||${item.standings_team || ''}`;
      let teamIds = teamIdsCache.get(lookupKey);
      if (!teamIds) {
        teamIds = await resolveTeamIds(supabase, [item.canonical_team, item.standings_team]);
        teamIdsCache.set(lookupKey, teamIds);
      }

      if (teamIds.length === 0) {
        console.error(`  [DB Warning] Team not found in Supabase (teams/team_aliases): ${item.canonical_team}`);
        continue;
      }

      const { data: parts, error: pErr } = await supabase
        .from('participations')
        .select('id, team_id, head_coach_id, phases!inner(name, season_id), teams(name)')
        .in('team_id', teamIds)
        .eq('phases.season_id', seasonRec.id);

      if (pErr) {
        console.error(`  [DB Error] Querying participations for ${item.canonical_team} (${yr}): ${pErr.message}`);
        continue;
      }
      if (!parts || parts.length === 0) {
        console.log(`  [DB Info] No ${yr} participations found for ${item.canonical_team}; skipping DB update.`);
        continue;
      }

      for (const part of parts) {
        if (part.head_coach_id === personId) continue;
        const { error: upErr } = await supabase
          .from('participations')
          .update({ head_coach_id: personId })
          .eq('id', part.id);
        if (upErr) {
          console.error(`  [DB Error] Failed updating participation ${part.id} for ${item.canonical_team} (${yr}): ${upErr.message}`);
        } else {
          updatedCount++;
          console.log(`  [DB Updated] ${yr} ${part.teams?.name || item.canonical_team} (${part.phases?.name}) -> ${coachName}`);
        }
      }
    }
  }

  console.log(`\n[DB Sync] Completed (${peopleCreated} people created, ${updatedCount} participation row(s) updated).`);
}

function runSenseCheckForYear(competition, yr) {
  const gamesCsvPath = path.join(ROOT_DIR, 'data', competition, `games${yr}.csv`);
  if (!fs.existsSync(gamesCsvPath)) {
    console.log(`[Sense Check] No games${yr}.csv found; skipping.`);
    return true;
  }
  let out = '';
  try {
    out = execFileSync('python3', [path.join(ROOT_DIR, 'scripts', 'sense_check_season.py'), gamesCsvPath], {
      encoding: 'utf8',
    });
  } catch (err) {
    out = (err.stdout || '') + '\n' + (err.stderr || '');
  }
  const coachErrors = out.split('\n').filter((line) => /Unverified.*head coach/i.test(line));
  if (coachErrors.length > 0) {
    console.error(`[Sense Check FAIL ${yr}] Unverified head coach issues found:`);
    coachErrors.forEach((e) => console.error(' ', e));
    return false;
  }
  console.log(`[Sense Check PASS ${yr}] Zero unverified head coach errors.`);
  return true;
}

function loadStandingsYearCache(competition) {
  const cache = new Map();
  return function getYearData(yr) {
    if (cache.has(yr)) return cache.get(yr);
    const standingsPath = path.join(ROOT_DIR, 'data', competition, `standings${yr}.csv`);
    if (!fs.existsSync(standingsPath)) {
      cache.set(yr, null);
      return null;
    }
    const parsed = readCsvRecords(standingsPath);
    const byCanon = new Map();
    for (const row of parsed.rows) {
      const rawTeam = (row.team || '').trim();
      if (!rawTeam) continue;
      const canon = resolveCanonicalTeam(rawTeam, competition);
      if (!byCanon.has(canon)) byCanon.set(canon, []);
      byCanon.get(canon).push(row);
    }
    const entry = { standingsPath, ...parsed, byCanon };
    cache.set(yr, entry);
    return entry;
  };
}

async function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const competition = String(opts.competition || 'BUAFL').trim();
  const season = parseInt(String(opts.season || '2026'), 10);
  const isMultiSeason = Boolean(opts['multi-season']);
  const inputPath = opts.input ? String(opts.input) : null;
  const syncExisting = Boolean(opts['sync-existing']);
  const isApply = Boolean(opts.apply);
  const isExplicitDryRun = Boolean(opts['dry-run']);
  const isDryRun = isExplicitDryRun || !isApply;
  const syncDb = Boolean(opts['sync-db']);
  const mergeSources = Boolean(opts['merge-sources']);

  if (!isMultiSeason && Number.isNaN(season)) {
    console.error('Invalid --season value.');
    process.exit(1);
  }
  if (!inputPath && !syncExisting) {
    console.error('Provide --input <candidates.json> and/or --sync-existing.');
    printHelp();
    process.exit(1);
  }
  if (syncDb && !isApply) {
    console.log('[Notice] --sync-db is ignored unless --apply is also passed.');
  }

  const evidencePath = path.join(ROOT_DIR, 'data', 'evidence', 'verified_coaches.json');
  const verifiedAll = loadVerifiedCoaches(evidencePath);
  const getStandingsYear = loadStandingsYearCache(competition);

  if (!isMultiSeason) {
    const baseData = getStandingsYear(season);
    if (!baseData) {
      throw new Error(`Standings CSV not found: ${path.join(ROOT_DIR, 'data', competition, `standings${season}.csv`)}`);
    }
    if (!baseData.headers.includes('head_coach')) {
      throw new Error(`Standings CSV ${baseData.standingsPath} is missing 'head_coach' column.`);
    }
  }

  // Merge sources if requested (safe even without --apply, unless --dry-run explicitly passed)
  let rawCandidates = [];
  if (inputPath) {
    rawCandidates = loadCandidates(inputPath);
    if (mergeSources) {
      mergeDiscoveredSources(rawCandidates, competition, isExplicitDryRun);
    }
  }

  // Expand items into per-season assignments when --multi-season is set
  const expandedCandidates = [];
  for (const c of rawCandidates) {
    if (isMultiSeason) {
      const yrList = Array.isArray(c.years)
        ? c.years
        : c.year !== undefined
          ? [c.year]
          : [season];
      for (const yrVal of yrList) {
        expandedCandidates.push({ candidate: c, year: Number(yrVal) });
      }
    } else {
      expandedCandidates.push({ candidate: c, year: season });
    }
  }

  const acceptedFromInput = [];
  const rejectedFromInput = [];

  for (const { candidate: c, year: yr } of expandedCandidates) {
    const rawTeam = (c.team || '').trim();
    const canon = resolveCanonicalTeam(rawTeam, competition);
    const check = validateCandidateForRegistration(c);

    if (!Number.isInteger(yr) || yr < 1980 || yr > 2100) {
      rejectedFromInput.push({
        team: `${rawTeam} (${yr})`,
        status: c.status || 'unknown',
        reasons: [`Invalid season year '${yr}'.`],
      });
      continue;
    }

    const yrData = getStandingsYear(yr);
    if (!isMultiSeason && (!yrData || !yrData.byCanon.has(canon))) {
      rejectedFromInput.push({
        team: rawTeam,
        status: c.status || 'unknown',
        reasons: [`Team '${rawTeam}' (canonical: '${canon}') is not active in ${competition} standings${yr}.csv.`],
      });
      continue;
    }

    if (!check.valid) {
      rejectedFromInput.push({
        team: isMultiSeason ? `${rawTeam} (${yr})` : rawTeam,
        status: c.status || 'unknown',
        reasons: check.errors,
      });
      continue;
    }

    const csvRows = yrData?.byCanon.get(canon);
    acceptedFromInput.push({
      standings_team: csvRows?.[0]?.team || rawTeam,
      canonical_team: canon,
      year: yr,
      head_coach: c.head_coach.trim(),
      source: c.source_url.trim(),
      source_details: `[${c.source_date.trim()}] ${c.source_details.trim()}`,
      origin: 'input_candidate',
    });
  }

  // Collect already-verified unsynced records if --sync-existing
  const syncExistingQueue = [];
  if (syncExisting) {
    const targetYears = isMultiSeason
      ? [...new Set(acceptedFromInput.map((x) => x.year))]
      : [season];
    const acceptedKeys = new Set(acceptedFromInput.map((x) => `${x.canonical_team}||${x.year}`));
    const seenExistingKeys = new Set();

    for (const yr of targetYears) {
      const yrData = getStandingsYear(yr);
      if (!yrData) continue;
      for (const v of verifiedAll) {
        if (Number(v.year) !== yr) continue;
        const canon = resolveCanonicalTeam(v.team, competition);
        const key = `${canon}||${yr}`;
        if (!yrData.byCanon.has(canon) || acceptedKeys.has(key) || seenExistingKeys.has(key)) continue;
        const csvRows = yrData.byCanon.get(canon);
        const needsCsvSync = csvRows.some((r) => !(r.head_coach || '').trim());
        if (needsCsvSync || syncDb) {
          seenExistingKeys.add(key);
          syncExistingQueue.push({
            standings_team: csvRows[0].team,
            canonical_team: canon,
            year: yr,
            head_coach: v.head_coach.trim(),
            source: v.source,
            source_details: v.source_details || '',
            origin: 'verified_registry_existing',
          });
        }
      }
    }
  }

  const modeTitle = isMultiSeason ? `${competition} multi-season` : `${competition} ${season}`;
  console.log(`\n=== Apply Verified Coaches (${modeTitle}) — ${isDryRun ? 'DRY RUN' : 'LIVE APPLY'} ===`);
  console.log(`Accepted verified assignments from input: ${acceptedFromInput.length}`);
  for (const a of acceptedFromInput) {
    console.log(`  [ACCEPT] ${a.year} ${a.canonical_team}: ${a.head_coach} (${a.source})`);
  }

  if (syncExisting) {
    console.log(`Existing verified registry entries to sync: ${syncExistingQueue.length}`);
    for (const s of syncExistingQueue) {
      console.log(`  [SYNC-EXISTING] ${s.year} ${s.standings_team} (${s.canonical_team}): ${s.head_coach}`);
    }
  }

  console.log(`Rejected / skipped candidates from input: ${rejectedFromInput.length}`);
  const redirectCount = rejectedFromInput.filter((r) =>
    r.reasons.some((msg) => msg.includes('redirect_url') || msg.includes('vertexaisearch'))
  ).length;
  for (const r of rejectedFromInput) {
    console.log(`  [REJECT] ${r.team} (${r.status}): ${r.reasons.join(' | ')}`);
  }
  if (redirectCount > 0) {
    console.log(`\n[Action Required] ${redirectCount} candidate(s) have unresolved grounding redirect URLs.`);
    console.log(`Run: node scripts/fetch_team_source_pages.mjs --resolve-redirects ${inputPath}`);
  }

  if (isDryRun) {
    console.log('\n[Dry-Run Complete] No changes written to verified_coaches.json, standings CSVs, or Supabase.');
    return;
  }

  // 1. Append newly accepted coaches to verified_coaches.json (deduplicated)
  let addedEvidence = 0;
  for (const item of acceptedFromInput) {
    const exists = verifiedAll.some(
      (v) =>
        resolveCanonicalTeam(v.team, competition) === item.canonical_team &&
        Number(v.year) === item.year &&
        (v.head_coach || '').trim().toLowerCase() === item.head_coach.toLowerCase()
    );
    if (!exists) {
      verifiedAll.push({
        team: item.canonical_team,
        year: item.year,
        head_coach: item.head_coach,
        source: item.source,
        source_details: item.source_details,
      });
      addedEvidence++;
    }
  }
  if (addedEvidence > 0) {
    fs.writeFileSync(evidencePath, JSON.stringify(verifiedAll, null, 2) + '\n', 'utf8');
  }
  console.log(`\n[Evidence] Added ${addedEvidence} new record(s) to data/evidence/verified_coaches.json.`);

  // 2. Update standings<YEAR>.csv safely per year via parsed rows + RFC-4180 serialization
  const allToSync = [...acceptedFromInput, ...syncExistingQueue];
  const syncByYear = new Map();
  for (const item of allToSync) {
    if (!syncByYear.has(item.year)) syncByYear.set(item.year, []);
    syncByYear.get(item.year).push(item);
  }

  let totalUpdatedCsvRows = 0;
  const modifiedYears = [];
  for (const yr of [...syncByYear.keys()].sort((a, b) => a - b)) {
    const yrData = getStandingsYear(yr);
    if (!yrData) {
      console.log(`[CSV Info] No standings${yr}.csv; skipping CSV sync for ${yr}.`);
      continue;
    }
    if (!yrData.headers.includes('head_coach')) {
      console.log(`[CSV Info] standings${yr}.csv has no 'head_coach' column; skipping CSV sync for ${yr}.`);
      continue;
    }

    const yearItems = syncByYear.get(yr);
    const coachByCanon = new Map(yearItems.map((x) => [x.canonical_team, x.head_coach]));
    for (const item of yearItems) {
      if (!yrData.byCanon.has(item.canonical_team)) {
        console.log(`[CSV Info] ${item.canonical_team} not present in standings${yr}.csv; registered in evidence only.`);
      }
    }

    let updatedRowsForYear = 0;
    for (const row of yrData.rows) {
      const canon = resolveCanonicalTeam(row.team, competition);
      if (!coachByCanon.has(canon)) continue;
      const newCoach = coachByCanon.get(canon);
      if ((row.head_coach || '').trim() !== newCoach) {
        row.head_coach = newCoach;
        updatedRowsForYear++;
      }
    }
    if (updatedRowsForYear > 0) {
      writeCsvRecords(yrData.standingsPath, yrData.headers, yrData.rows);
      totalUpdatedCsvRows += updatedRowsForYear;
      modifiedYears.push(yr);
      console.log(`[CSV] Updated ${updatedRowsForYear} row(s) in ${path.relative(ROOT_DIR, yrData.standingsPath)}.`);
    } else {
      console.log(`[CSV] Updated 0 row(s) in ${path.relative(ROOT_DIR, yrData.standingsPath)}.`);
    }
  }
  console.log(`[CSV Total] Updated ${totalUpdatedCsvRows} row(s) across ${modifiedYears.length} standings file(s).`);

  // 3. Optional Supabase sync
  if (syncDb && allToSync.length > 0) {
    await syncCoachesToSupabase(allToSync, competition);
  }

  // 4. Run sense_check_season.py on modified seasons (or target single season)
  const yearsToSenseCheck = modifiedYears.length > 0
    ? modifiedYears
    : (!isMultiSeason ? [season] : []);
  if (yearsToSenseCheck.length > 0) {
    console.log(`\n[Sense Check] Running head coach verification across ${yearsToSenseCheck.length} season(s)...`);
    let allPassed = true;
    for (const yr of yearsToSenseCheck) {
      if (!runSenseCheckForYear(competition, yr)) {
        allPassed = false;
      }
    }
    if (!allPassed) {
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
