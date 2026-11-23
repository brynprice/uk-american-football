#!/usr/bin/env node
/**
 * Direct Official-Page Scanner & Grounding Redirect Resolver
 *
 * Deterministic, zero-AI-key Node.js utility with two modes:
 *   1) --scan-sources: Fetches known official SU/club pages from data/mappings/team_sources.json
 *      for active teams in a competition/season and extracts lines around coaching keywords.
 *   2) --resolve-redirects <candidates.json>: Resolves vertexaisearch grounding redirect URLs
 *      into canonical public source_url values in place (or to --out).
 *
 * Note: Network requests require an environment with outbound DNS/HTTP access.
 * Use --dry-run to inspect targets offline.
 *
 * Usage:
 *   node scripts/fetch_team_source_pages.mjs --scan-sources --competition BUAFL --season 2026 --dry-run
 *   node scripts/fetch_team_source_pages.mjs --scan-sources --competition BUAFL --season 2026
 *   node scripts/fetch_team_source_pages.mjs --resolve-redirects data/evidence/coach_candidates_buafl_2026.json --dry-run
 */

import fs from 'fs';
import path from 'path';
import {
  ROOT_DIR,
  parseCliArgs,
  readCsvRecords,
  loadTeamSources,
  resolveCanonicalTeam,
  isRedirectUrl,
  isValidCanonicalUrl,
} from './lib/coach_utils.mjs';

const USER_AGENT = 'uk-football-history-coach-audit/1.0 (+https://britball.io)';
const COACH_KEYWORDS = [
  'head coach',
  'coaching staff',
  'director of football',
  'director of american football',
  'head of american football',
  'hc:',
  'coach:',
];

function printHelp() {
  console.log(`
Usage:
  node scripts/fetch_team_source_pages.mjs --scan-sources [options]
  node scripts/fetch_team_source_pages.mjs --resolve-redirects <candidates.json> [options]

Options:
  --scan-sources                 Fetch official_urls from team_sources.json for active teams
  --include-wiki                 Also include wiki_urls when scanning
  --competition <NAME>           Competition folder (default: BUAFL)
  --season <YYYY>                Season year (default: 2026)
  --resolve-redirects <path>     Resolve grounding redirect URLs in a candidates JSON file
  --out <path>                   Optional custom output file path
  --concurrency <N>              Max concurrent HTTP requests (default: 4)
  --dry-run                      Preview queued URLs without network calls
  --help                         Show this help message
`);
}

function htmlToLines(html) {
  const withoutBlocks = html
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h1|h2|h3|h4|h5|h6|br|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');

  return withoutBlocks
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
}

function extractCoachingMatches(lines) {
  const matches = [];
  const seenIndices = new Set();

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    const matchedKeyword = COACH_KEYWORDS.find((kw) => lower.includes(kw));
    if (!matchedKeyword) continue;

    if (seenIndices.has(i)) continue;
    const start = Math.max(0, i - 1);
    const end = Math.min(lines.length - 1, i + 2);
    for (let k = start; k <= end; k++) seenIndices.add(k);

    matches.push({
      keyword: matchedKeyword,
      line: lines[i],
      context: lines.slice(start, end + 1),
    });
  }
  return matches;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIdx = 0;
  async function runner() {
    while (true) {
      const idx = nextIdx++;
      if (idx >= items.length) break;
      results[idx] = await worker(items[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length || 1) }, () => runner());
  await Promise.all(workers);
  return results;
}

async function handleScanSources(opts) {
  const competition = String(opts.competition || 'BUAFL').trim();
  const season = parseInt(String(opts.season || '2026'), 10);
  const concurrency = Math.max(1, parseInt(String(opts.concurrency || '4'), 10) || 4);
  const includeWiki = Boolean(opts['include-wiki']);
  const isDryRun = Boolean(opts['dry-run']);

  const standingsPath = path.join(ROOT_DIR, 'data', competition, `standings${season}.csv`);
  if (!fs.existsSync(standingsPath)) {
    throw new Error(`Standings CSV not found: ${standingsPath}`);
  }

  const { rows } = readCsvRecords(standingsPath);
  const teamSources = loadTeamSources();
  const seenTeams = new Set();
  const queue = [];

  for (const r of rows) {
    const rawTeam = (r.team || '').trim();
    if (!rawTeam) continue;
    const canon = resolveCanonicalTeam(rawTeam, competition);
    if (seenTeams.has(canon)) continue;
    seenTeams.add(canon);

    const src = teamSources[canon] || teamSources[rawTeam];
    const urls = [
      ...(src?.official_urls || []),
      ...(includeWiki ? src?.wiki_urls || [] : []),
    ].filter((u) => isValidCanonicalUrl(u));

    if (urls.length > 0) {
      queue.push({
        team: rawTeam,
        canonical_team: canon,
        university: src?.university || '',
        urls: [...new Set(urls)],
      });
    }
  }

  const totalUrls = queue.reduce((acc, q) => acc + q.urls.length, 0);
  const defaultOut = path.join(
    ROOT_DIR,
    'data',
    'evidence',
    `source_page_scan_${competition.toLowerCase()}_${season}.json`
  );
  const outPath = opts.out ? path.resolve(ROOT_DIR, String(opts.out)) : defaultOut;

  console.log(`\n=== Source Page Scanner (${competition} ${season}) ===`);
  console.log(`Active teams in standings: ${seenTeams.size}`);
  console.log(`Active teams with official URLs queued: ${queue.length} (${totalUrls} URLs)`);
  console.log(`Concurrency: ${concurrency} | Output: ${path.relative(ROOT_DIR, outPath)}`);

  if (isDryRun) {
    for (const item of queue) {
      console.log(`  [QUEUE] ${item.canonical_team}: ${item.urls.join(', ')}`);
    }
    console.log('\n[Dry-Run Complete] No HTTP requests made and no output written.');
    return;
  }

  const flatTasks = [];
  for (const item of queue) {
    for (const url of item.urls) {
      flatTasks.push({ ...item, url });
    }
  }

  const scanned = await runPool(flatTasks, concurrency, async (task) => {
    try {
      const res = await fetchWithTimeout(task.url, { method: 'GET', redirect: 'follow' });
      const html = await res.text();
      const lines = htmlToLines(html);
      const matches = extractCoachingMatches(lines);
      return {
        team: task.team,
        canonical_team: task.canonical_team,
        university: task.university,
        requested_url: task.url,
        final_url: res.url || task.url,
        http_status: res.status,
        ok: res.ok,
        match_count: matches.length,
        matches,
      };
    } catch (err) {
      return {
        team: task.team,
        canonical_team: task.canonical_team,
        university: task.university,
        requested_url: task.url,
        final_url: null,
        http_status: null,
        ok: false,
        error: err.cause?.code || err.message || 'fetch failed',
        match_count: 0,
        matches: [],
      };
    }
  });

  const payload = {
    competition,
    season,
    scanned_at: new Date().toISOString(),
    total_urls: scanned.length,
    succeeded: scanned.filter((s) => s.ok).length,
    with_coaching_hits: scanned.filter((s) => s.match_count > 0).length,
    results: scanned,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`\nScan complete: ${payload.succeeded}/${payload.total_urls} succeeded, ${payload.with_coaching_hits} with coaching keyword hits.`);
}

async function resolveSingleRedirect(redirectUrl) {
  // Try HEAD first, then GET if server rejects HEAD or fails to redirect
  try {
    const headRes = await fetchWithTimeout(redirectUrl, { method: 'HEAD', redirect: 'follow' });
    if (headRes.url && !isRedirectUrl(headRes.url) && isValidCanonicalUrl(headRes.url)) {
      return { resolved: headRes.url, status: headRes.status };
    }
  } catch {
    // Fallback to GET
  }

  const getRes = await fetchWithTimeout(redirectUrl, { method: 'GET', redirect: 'follow' });
  const finalUrl = getRes.url || '';
  if (finalUrl && !isRedirectUrl(finalUrl) && isValidCanonicalUrl(finalUrl)) {
    return { resolved: finalUrl, status: getRes.status };
  }
  throw new Error(`Did not resolve away from redirect URL (status: ${getRes.status})`);
}

async function handleResolveRedirects(opts) {
  const rawPath = String(opts['resolve-redirects']);
  const inputPath = path.resolve(ROOT_DIR, rawPath);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Candidates file not found: ${inputPath}`);
  }
  const outPath = opts.out ? path.resolve(ROOT_DIR, String(opts.out)) : inputPath;
  const concurrency = Math.max(1, parseInt(String(opts.concurrency || '4'), 10) || 4);
  const isDryRun = Boolean(opts['dry-run']);

  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const list = Array.isArray(data) ? data : data.results || data.teams || [];

  const toResolve = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const hasValidSource = isValidCanonicalUrl(item.source_url);
    const candidateRedirect = isRedirectUrl(item.source_url)
      ? item.source_url
      : isRedirectUrl(item.redirect_url)
        ? item.redirect_url
        : '';

    if (!hasValidSource && candidateRedirect) {
      toResolve.push({ index: i, item, redirectUrl: candidateRedirect });
    }
  }

  console.log(`\n=== Grounding Redirect URL Resolver ===`);
  console.log(`File: ${path.relative(ROOT_DIR, inputPath)}`);
  console.log(`Total records: ${list.length} | Unresolved redirect URLs: ${toResolve.length}`);

  if (isDryRun) {
    for (const r of toResolve) {
      console.log(`  [NEEDS RESOLVE] ${r.item.team}: ${r.redirectUrl.slice(0, 80)}...`);
    }
    console.log('\n[Dry-Run Complete] No HTTP requests made.');
    return;
  }

  let resolvedCount = 0;
  let failedCount = 0;

  await runPool(toResolve, concurrency, async (task) => {
    try {
      const { resolved } = await resolveSingleRedirect(task.redirectUrl);
      task.item.source_url = resolved;
      try {
        task.item.source_domain = new URL(resolved).hostname.replace(/^www\./, '');
      } catch {
        // ignore domain parse failure
      }
      task.item.needs_url_resolution = false;
      resolvedCount++;
      console.log(`  [RESOLVED] ${task.item.team} -> ${resolved}`);
    } catch (err) {
      task.item.needs_url_resolution = true;
      failedCount++;
      console.error(`  [FAILED] ${task.item.team}: ${err.message}`);
    }
  });

  if (Array.isArray(data)) {
    fs.writeFileSync(outPath, JSON.stringify(list, null, 2) + '\n', 'utf8');
  } else {
    if (Array.isArray(data.results)) data.results = list;
    else if (Array.isArray(data.teams)) data.teams = list;
    data.redirects_resolved_at = new Date().toISOString();
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
  console.log(`\nDone: ${resolvedCount} resolved, ${failedCount} failed. Saved to ${path.relative(ROOT_DIR, outPath)}.`);
}

async function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  if (opts.help || (!opts['scan-sources'] && !opts['resolve-redirects'])) {
    printHelp();
    process.exit(opts.help ? 0 : 1);
  }

  if (opts['scan-sources']) {
    await handleScanSources(opts);
  } else if (opts['resolve-redirects']) {
    await handleResolveRedirects(opts);
  }
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
