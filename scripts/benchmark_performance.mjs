import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import dotenv from 'dotenv';
import fs from 'fs';
import { generateWeeklyFacts } from '../lib/facts/weekly-facts-core.mjs';
import { generateWeeklyPreview } from '../lib/facts/weekly-preview-core.mjs';

// Load environment variables (.env.local, then .env)
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing required environment variables for benchmark:');
  if (!supabaseUrl) console.error('  - NEXT_PUBLIC_SUPABASE_URL is missing or empty');
  if (!supabaseKey) console.error('  - NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) is missing or empty');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Instrumented fetch: records every HTTP request issued during a benchmark so we
// can report request count, bytes on the wire and the number of sequential
// network "waves" (the critical-path depth of dependent round-trips).
// ---------------------------------------------------------------------------
let activeRecorder = null;
const rawFetch = globalThis.fetch.bind(globalThis);

async function instrumentedFetch(input, init) {
  const recorder = activeRecorder;
  const start = performance.now();
  const res = await rawFetch(input, init);
  if (recorder) {
    const entry = { start, end: performance.now(), bytes: 0 };
    recorder.push(entry);
    // Read a clone to measure the full body size and the time the body finished arriving
    recorder.pending.push(
      res.clone().arrayBuffer().then(
        buf => { entry.bytes = buf.byteLength; entry.end = performance.now(); },
        () => {}
      )
    );
  }
  return res;
}

function createRecorder() {
  const entries = [];
  entries.pending = [];
  return entries;
}

// Critical-path depth: a request belongs to wave N+1 if it started after a wave-N request finished.
function computeWaves(entries) {
  const sorted = [...entries].sort((a, b) => a.start - b.start);
  const depth = [];
  let maxDepth = 0;
  for (let i = 0; i < sorted.length; i++) {
    let d = 1;
    for (let j = 0; j < i; j++) {
      if (sorted[j].end <= sorted[i].start) d = Math.max(d, depth[j] + 1);
    }
    depth.push(d);
    maxDepth = Math.max(maxDepth, d);
  }
  return maxDepth;
}

const supabase = createClient(supabaseUrl, supabaseKey, { global: { fetch: instrumentedFetch } });

const isStrict = process.argv.includes('--strict');

// Samples per benchmark (median is reported). Override with BENCH_SAMPLES=n.
const SAMPLES = Math.max(1, Number(process.env.BENCH_SAMPLES) || 3);

// Budgets were calibrated against a GitHub Actions -> Supabase (EU) round-trip of ~200 ms.
// When the measured network floor is slower than this reference, each sequential wave
// receives the excess as allowance, so runner placement noise is not reported as a DB regression.
const REFERENCE_RTT_MS = 200;
let networkFloorMs = 0;

const median = arr => {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

async function measureNetworkFloor() {
  const samples = [];
  for (let i = 0; i < 7; i++) {
    const start = performance.now();
    await rawFetch(`${supabaseUrl}/rest/v1/competitions?select=id&limit=1`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    }).then(r => r.arrayBuffer());
    samples.push(performance.now() - start);
  }
  // Discard the first (TLS handshake) sample
  return median(samples.slice(1));
}

async function measureQuery(name, budgetMs, fn) {
  const durations = [];
  let result = null;
  let lastRecorder = null;
  try {
    for (let i = 0; i < SAMPLES; i++) {
      const recorder = createRecorder();
      activeRecorder = recorder;
      const start = performance.now();
      result = await fn();
      durations.push(performance.now() - start);
      activeRecorder = null;
      await Promise.all(recorder.pending);
      lastRecorder = recorder;
    }

    const duration = median(durations);
    const spread = Math.max(...durations) - Math.min(...durations);
    const count = Array.isArray(result) ? result.length : (result ? 1 : 0);
    const size = Buffer.byteLength(JSON.stringify(result || ''));
    const requests = lastRecorder.length;
    const wireBytes = lastRecorder.reduce((sum, e) => sum + e.bytes, 0);
    const waves = computeWaves(lastRecorder);
    const effectiveBudget = budgetMs + waves * Math.max(0, networkFloorMs - REFERENCE_RTT_MS);
    const netMs = Math.max(0, duration - waves * networkFloorMs);

    let status = '🟢 PASS';
    if (duration > effectiveBudget * 1.5) {
      status = '🔴 CRITICAL';
    } else if (duration > effectiveBudget) {
      status = '🟡 WARNING';
    }

    return {
      name,
      durationMs: duration,
      spreadMs: spread,
      budgetMs,
      effectiveBudget,
      netMs,
      count,
      sizeBytes: size,
      wireBytes,
      requests,
      waves,
      status,
      error: null
    };
  } catch (err) {
    activeRecorder = null;
    return {
      name,
      durationMs: durations.length ? median(durations) : 0,
      spreadMs: 0,
      budgetMs,
      effectiveBudget: budgetMs,
      netMs: 0,
      count: 0,
      sizeBytes: 0,
      wireBytes: 0,
      requests: 0,
      waves: 0,
      status: '❌ ERROR',
      error: err.message
    };
  }
}

async function runBenchmark() {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log('========================================================================');
  console.log(` BRITBALL.IO PERFORMANCE BENCHMARK (${timestamp} UTC)`);
  console.log('========================================================================\n');

  // 1. Table Counts
  console.log('--- 1. DATABASE VOLUME ---');
  const tables = [
    'competitions',
    'seasons',
    'phases',
    'teams',
    'team_aliases',
    'people',
    'participations',
    'venues',
    'games',
    'game_staff',
    'hall_of_fame',
    'retired_jerseys',
    'game_proposals',
    'predictions',
    'notes',
    'sources'
  ];

  const tableCounts = {};
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    tableCounts[table] = count ?? (error ? 'ERR' : 0);
    console.log(`  ${table.padEnd(16)}: ${String(tableCounts[table]).padStart(6)} rows`);
  }

  // 2. Sample Entities for representative queries
  const [
    { data: recentSeason },
    { data: samplePhase },
    { data: sampleTeams },
    { data: sampleGame },
    { data: sampleCoachPart }
  ] = await Promise.all([
    supabase.from('seasons').select('id, year').order('year', { ascending: false }).limit(1).single(),
    supabase.from('phases').select('id, name, season_id').limit(1).single(),
    supabase.from('teams').select('id, name').limit(2),
    supabase.from('games').select('id, phase_id, home_team_id, away_team_id').limit(1).single(),
    supabase.from('participations').select('head_coach_id').not('head_coach_id', 'is', null).limit(1).single()
  ]);
  const sampleTeam = sampleTeams?.[0] || null;
  const sampleOpponent = sampleTeams?.[1] || sampleTeam;
  const samplePersonId = sampleCoachPart?.head_coach_id || null;

  console.log('\n--- 2. CRITICAL QUERY LATENCY BENCHMARKS ---');
  networkFloorMs = await measureNetworkFloor();
  const rttAllowance = Math.max(0, networkFloorMs - REFERENCE_RTT_MS);
  console.log(`  Network floor (median PostgREST RTT): ${networkFloorMs.toFixed(1)} ms`);
  console.log(`  Reference RTT: ${REFERENCE_RTT_MS} ms -> per-wave allowance: +${rttAllowance.toFixed(1)} ms`);
  console.log(`  Samples per benchmark: ${SAMPLES} (median reported)\n`);

  const benchmarks = [
    // Homepage Archive Stats (indexed parallel queries)
    {
      name: 'getArchiveStats',
      budget: 450,
      fn: async () => {
        const [totalGamesRes, anomalyGamesRes, teamsRes, titleRes, scoresRes] = await Promise.all([
          supabase.from('games').select('*', { count: 'exact', head: true }),
          supabase.from('games').select('*', { count: 'exact', head: true }).eq('status', 'anomaly'),
          supabase.from('teams').select('*', { count: 'exact', head: true }),
          supabase.from('games').select('*', { count: 'exact', head: true }).not('final_type', 'is', null).not('title_name', 'is', null),
          supabase.from('seasons').select('completeness_score')
        ]);
        if (totalGamesRes.error) throw totalGamesRes.error;
        return {
          totalGames: (totalGamesRes.count || 0) - (anomalyGamesRes.count || 0),
          totalSeasons: scoresRes.data?.length || 0,
          totalTeams: teamsRes.count,
          titleGames: titleRes.count
        };
      }
    },
    // Competitions list
    {
      name: 'getCompetitions',
      budget: 250,
      fn: async () => {
        const { data, error } = await supabase.from('competitions').select('*').order('name');
        if (error) throw error;
        return data;
      }
    },
    // Competition Overview (/competitions/[id])
    {
      name: 'getCompetitionById',
      budget: 300,
      fn: async () => {
        if (!recentSeason) return null;
        const { data: comp } = await supabase
          .from('competitions')
          .select('*, seasons(*)')
          .limit(1)
          .single();
        return comp;
      }
    },
    // Season Details (unphased games + notes)
    {
      name: 'getSeasonDetails',
      budget: 450,
      fn: async () => {
        if (!recentSeason) return null;
        const [seasonRes, notesRes, gamesRes] = await Promise.all([
          supabase.from('seasons').select('*, competition:competitions (*), phases (*, ordinal)').eq('id', recentSeason.id).single(),
          supabase.from('notes').select('*').eq('entity_id', recentSeason.id).eq('entity_type', 'seasons'),
          supabase.from('games').select(`
            *, 
            home_team:teams!home_team_id (*, team_aliases (*)), 
            away_team:teams!away_team_id (*, team_aliases (*)),
            venue:venues (*)
          `).eq('season_id', recentSeason.id).is('phase_id', null).neq('status', 'anomaly')
        ]);
        if (seasonRes.error) throw seasonRes.error;
        return { season: seasonRes.data, notes: notesRes.data, games: gamesRes.data };
      }
    },
    // Phase Data (games + participations)
    {
      name: 'getPhaseData',
      budget: 450,
      fn: async () => {
        if (!samplePhase) return null;
        const phaseId = samplePhase.id;
        const [phaseRes, gamesRes, partRes] = await Promise.all([
          supabase.from('phases').select('*, season:seasons(id, year, competition:competitions(name))').eq('id', phaseId).single(),
          supabase.from('games').select(`
            *, 
            home_team:teams!home_team_id (*, team_aliases (*)), 
            away_team:teams!away_team_id (*, team_aliases (*)), 
            phase:phases!games_phase_id_fkey(name, season:seasons(year)),
            away_phase:phases!away_phase_id(name)
          `).or(`phase_id.eq.${phaseId},away_phase_id.eq.${phaseId}`).neq('status', 'anomaly'),
          supabase.from('participations').select('*, person:people (*), team:teams (*, team_aliases (*)), phase:phases(id, name, type, ordinal)').eq('phase_id', phaseId)
        ]);
        if (phaseRes.error) throw phaseRes.error;
        return { phase: phaseRes.data, games: gamesRes.data, participations: partRes.data };
      }
    },
    // Team History (team + games + championships)
    {
      name: 'getTeamHistory',
      budget: 350,
      fn: async () => {
        if (!sampleTeam) return null;
        const [teamRes, gamesRes, champRes] = await Promise.all([
          supabase.from('teams').select(`
            *, 
            team_aliases (id, name, start_year, end_year, logo_url), 
            participations (*, phase:phases (*, season:seasons (*, competition:competitions (*)))),
            hall_of_fame (*, person:people (*)),
            retired_jerseys (*, person:people (*))
          `).eq('id', sampleTeam.id).single(),
          supabase.from('games').select(`
            id, date, date_display, date_precision, time, home_team_id, away_team_id, home_score, away_score,
            status, is_playoff, playoff_round, final_type, title_name, is_title_game, is_double_header,
            is_unique_score, is_totally_unique, game_level, nickname, notes, phase_id, away_phase_id, season_id, venue_id,
            phase:phases!games_phase_id_fkey (id, name, type, ordinal, parent_phase_id, season:seasons (year, id, name, competition:competitions (id, name, slug, level))),
            away_phase:phases!away_phase_id (id, name, type, ordinal, parent_phase_id, season:seasons (year, id, name, competition:competitions (id, name, slug, level))),
            home_team:teams!home_team_id (id, name, logo_url, team_type, team_aliases (id, name, start_year, end_year, logo_url)),
            away_team:teams!away_team_id (id, name, logo_url, team_type, team_aliases (id, name, start_year, end_year, logo_url))
          `).or(`home_team_id.eq.${sampleTeam.id},away_team_id.eq.${sampleTeam.id}`).neq('status', 'anomaly'),
          supabase.from('notes').select('entity_id').eq('entity_type', 'divisional_champion').eq('content', sampleTeam.id)
        ]);
        if (teamRes.error) throw teamRes.error;
        return { team: teamRes.data, games: gamesRes.data, champ: champRes.data };
      }
    },
    // Head-to-Head Rivalry Series (2 basic teams + H2H games)
    {
      name: 'getH2HSeries',
      budget: 250,
      fn: async () => {
        if (!sampleTeam || !sampleOpponent) return null;
        const [t1Res, t2Res, gamesRes] = await Promise.all([
          supabase.from('teams').select('id, name, logo_url, team_type, location, founded_year, folded_year, notes, team_aliases (id, name, start_year, end_year, logo_url)').eq('id', sampleTeam.id).single(),
          supabase.from('teams').select('id, name, logo_url, team_type, location, founded_year, folded_year, notes, team_aliases (id, name, start_year, end_year, logo_url)').eq('id', sampleOpponent.id).single(),
          supabase.from('games').select(`
            id, date, date_display, time, home_score, away_score, status, is_playoff, playoff_round,
            final_type, title_name, is_double_header, is_unique_score, is_totally_unique, game_level,
            nickname, notes, home_team_id, away_team_id, phase_id, away_phase_id,
            phase:phases!games_phase_id_fkey (id, name, type, season:seasons (year, id, competition:competitions (name))),
            home_team:teams!home_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
            away_team:teams!away_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
            venue:venues (id, name, city)
          `).or(`and(home_team_id.eq.${sampleTeam.id},away_team_id.eq.${sampleOpponent.id}),and(home_team_id.eq.${sampleOpponent.id},away_team_id.eq.${sampleTeam.id})`).neq('status', 'anomaly').order('date', { ascending: false })
        ]);
        if (t1Res.error) throw t1Res.error;
        return { team1: t1Res.data, team2: t2Res.data, games: gamesRes.data };
      }
    },
    // Game Details (game + staff + sources + scoped participations in single parallel step)
    {
      name: 'getGameDetails',
      budget: 250,
      fn: async () => {
        if (!sampleGame) return null;
        const [gameRes, sourcesRes, notesRes] = await Promise.all([
          supabase.from('games').select(`
            *, 
            home_team:teams!home_team_id (*, team_aliases (*)), 
            away_team:teams!away_team_id (*, team_aliases (*)), 
            venue:venues (*), 
            phase:phases!games_phase_id_fkey (*, participations (*, person:people (*)), season:seasons (id, year, competition:competitions (name, level))), 
            away_phase:phases!away_phase_id (name, participations (*, person:people (*))),
            season:seasons!games_season_id_fkey (id, year, competition:competitions (name, level)),
            game_staff (*, person:people (*))
          `).eq('id', sampleGame.id).single(),
          supabase.from('sources').select('*').eq('entity_id', sampleGame.id).eq('entity_type', 'games'),
          supabase.from('notes').select('*').eq('entity_id', sampleGame.id).eq('entity_type', 'games')
        ]);
        if (gameRes.error) throw gameRes.error;
        const g = gameRes.data;
        const teamIds = new Set([g.home_team_id, g.away_team_id].filter(Boolean));
        const rawParts = [
          ...(g.phase?.participations || []),
          ...(g.away_phase?.participations || [])
        ];
        const seen = new Set();
        const parts = rawParts.filter(p => p && teamIds.has(p.team_id) && !seen.has(p.id) && seen.add(p.id));
        return { g, sources: sourcesRes.data || [], notes: notesRes.data || [], parts };
      }
    },
    // Champions & Bowls query
    {
      name: 'getChampions',
      budget: 400,
      fn: async () => {
        const [compsRes, gamesRes] = await Promise.all([
          supabase.from('competitions').select('*'),
          supabase.from('games').select(`
            id, title_name, final_type, date, home_score, away_score, season_id, phase_id, home_team_id, away_team_id,
            home_team:teams!home_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
            away_team:teams!away_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
            phase:phases!games_phase_id_fkey (
              id, name, type,
              season:seasons (
                id, year, name, competition_id,
                competition:competitions (id, name, level, slug)
              )
            ),
            venue:venues (id, name, city)
          `).in('final_type', ['title', 'bowl']).neq('status', 'anomaly')
        ]);
        if (gamesRes.error) throw gamesRes.error;
        return gamesRes.data;
      }
    },
    // Scorigami query
    {
      name: 'searchGamesByScore',
      budget: 300,
      fn: async () => {
        const { data, error } = await supabase.from('games').select(`
          id, date, date_display, time, home_score, away_score, status, is_unique_score, is_totally_unique,
          game_level, final_type, title_name, nickname, is_playoff, playoff_round, is_double_header,
          phase_id, away_phase_id, home_team_id, away_team_id,
          phase:phases!games_phase_id_fkey(id, name, season:seasons(id, year, competition:competitions(id, name, level, slug))),
          away_phase:phases!away_phase_id(name),
          home_team:teams!home_team_id(id, name, logo_url, team_type, team_aliases(id, name, start_year, end_year, logo_url)),
          away_team:teams!away_team_id(id, name, logo_url, team_type, team_aliases(id, name, start_year, end_year, logo_url))
        `).or('and(home_score.eq.20,away_score.eq.14),and(home_score.eq.14,away_score.eq.20)').neq('status', 'anomaly');
        if (error) throw error;
        return data;
      }
    },
    // Scorigami Unique Score Games (/scorigami/unique) — paginated across 2 pages (2,000 capacity)
    {
      name: 'getUniqueScoreGames',
      budget: 700,
      fn: async () => {
        const pageSize = 1000;
        const fetchPage = p =>
          supabase.from('games').select(`
            id, date, date_display, time, home_score, away_score, status, is_unique_score, is_totally_unique,
            game_level, final_type, title_name, nickname, is_playoff, playoff_round, is_double_header,
            phase_id, away_phase_id, home_team_id, away_team_id,
            phase:phases!games_phase_id_fkey(id, name, season:seasons(id, year, competition:competitions(name, level))),
            away_phase:phases!away_phase_id(name)
          `).eq('is_unique_score', true).neq('status', 'anomaly').neq('status', 'cancelled').order('date', { ascending: false, nullsFirst: false }).range(p * pageSize, (p + 1) * pageSize - 1);

        const [page0Res, page1Res, teamsRes] = await Promise.all([
          fetchPage(0),
          fetchPage(1),
          supabase.from('teams').select('id, name, logo_url, team_type, team_aliases(id, name, start_year, end_year, logo_url)')
        ]);
        if (page0Res.error) throw page0Res.error;
        if (page1Res.error) throw page1Res.error;
        const allGames = [...(page0Res.data || []), ...(page1Res.data || [])];
        const teamMap = new Map((teamsRes.data || []).map(t => [t.id, t]));
        return allGames.map(g => ({
          ...g,
          home_team: teamMap.get(g.home_team_id) || null,
          away_team: teamMap.get(g.away_team_id) || null
        }));
      }
    },
    // Uniball Historical Timeline (/timeline)
    {
      name: 'getTimelineData',
      budget: 650,
      fn: async () => {
        const pageSize = 1000;
        const fetchUniballParts = async () => {
          const pages = await Promise.all(
            [0, 1, 2, 3].map(p =>
              supabase
                .from('participations')
                .select('id, team_id, phase_id, is_champion, wins, losses, ties, points_for, points_against, phases!inner(season:seasons!inner(competition:competitions!inner(slug)))')
                .in('phases.season.competition.slug', ['bcafl', 'buafl'])
                .range(p * pageSize, (p + 1) * pageSize - 1)
            )
          );
          const rows = [];
          for (const res of pages) {
            if (res.data) rows.push(...res.data);
          }
          return rows;
        };

        const [seasonsRes, phasesRes, gamesRes, parts, seasonNotesRes, champNotesRes, teamsRes] = await Promise.all([
          supabase.from('seasons').select('id, year, name, competition_id, completeness_score, competition:competitions!inner(id, name, slug, level)').in('competition.slug', ['bcafl', 'buafl']).order('year', { ascending: true }),
          supabase.from('phases').select('id, season_id, name, type, ordinal, parent_phase_id, season:seasons!inner(competition:competitions!inner(slug))').in('season.competition.slug', ['bcafl', 'buafl']).limit(5000),
          supabase.from('games').select(`
            id, season_id, date, home_score, away_score, final_type, title_name, notes,
            home_team:teams!home_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
            away_team:teams!away_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
            venue:venues (id, name, city),
            season:seasons!games_season_id_fkey!inner(competition:competitions!inner(slug))
          `).in('season.competition.slug', ['bcafl', 'buafl']).or('final_type.in.(title,bowl),title_name.ilike.%College Bowl%').neq('status', 'anomaly').order('date', { ascending: true }),
          fetchUniballParts(),
          supabase.from('notes').select('entity_id, content').eq('entity_type', 'seasons'),
          supabase.from('notes').select('entity_id, content').eq('entity_type', 'divisional_champion'),
          supabase.from('teams').select('id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)')
        ]);
        if (seasonsRes.error) throw seasonsRes.error;
        if (phasesRes.error) throw phasesRes.error;
        if (gamesRes.error) throw gamesRes.error;
        return {
          seasons: seasonsRes.data?.length || 0,
          phases: phasesRes.data?.length || 0,
          games: gamesRes.data?.length || 0,
          participations: parts.length,
          teams: teamsRes.data?.length || 0,
          notes: (seasonNotesRes.data?.length || 0) + (champNotesRes.data?.length || 0)
        };
      }
    },
    // Women's Historical Timeline (/timeline?league=womens)
    {
      name: 'getWomensTimeline',
      budget: 450,
      fn: async () => {
        const slugs = ['sapphire-series', 'nwfl'];
        const [seasonsRes, phasesRes, gamesRes, partsRes, seasonNotesRes, champNotesRes, teamsRes] = await Promise.all([
          supabase.from('seasons').select('id, year, name, competition_id, completeness_score, competition:competitions!inner(id, name, slug, level)').in('competition.slug', slugs).order('year', { ascending: true }),
          supabase.from('phases').select('id, season_id, name, type, ordinal, parent_phase_id, season:seasons!inner(competition:competitions!inner(slug))').in('season.competition.slug', slugs).limit(1000),
          supabase.from('games').select(`
            id, season_id, date, home_score, away_score, final_type, title_name, notes,
            home_team:teams!home_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
            away_team:teams!away_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
            venue:venues (id, name, city),
            season:seasons!games_season_id_fkey!inner(competition:competitions!inner(slug))
          `).in('season.competition.slug', slugs).or('final_type.in.(title,bowl),title_name.ilike.%College Bowl%').neq('status', 'anomaly').order('date', { ascending: true }),
          supabase.from('participations').select('id, team_id, phase_id, is_champion, wins, losses, ties, points_for, points_against, phases!inner(season:seasons!inner(competition:competitions!inner(slug)))').in('phases.season.competition.slug', slugs).range(0, 999),
          supabase.from('notes').select('entity_id, content').eq('entity_type', 'seasons'),
          supabase.from('notes').select('entity_id, content').eq('entity_type', 'divisional_champion'),
          supabase.from('teams').select('id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)')
        ]);
        if (seasonsRes.error) throw seasonsRes.error;
        return {
          seasons: seasonsRes.data?.length || 0,
          phases: phasesRes.data?.length || 0,
          games: gamesRes.data?.length || 0,
          participations: partsRes.data?.length || 0,
          teams: teamsRes.data?.length || 0,
          notes: (seasonNotesRes.data?.length || 0) + (champNotesRes.data?.length || 0)
        };
      }
    },
    // Phase CSV Export Route (/api/export/phase/[id])
    {
      name: 'exportPhaseCsv',
      budget: 400,
      fn: async () => {
        if (!samplePhase) return null;
        const { data: phase, error: pErr } = await supabase
          .from('phases')
          .select('*, season:seasons(id, year, competition:competitions(name), phases(id, name, parent_phase_id, type))')
          .eq('id', samplePhase.id)
          .single();
        if (pErr) throw pErr;
        const allPhases = phase?.season?.phases || [];
        const getDescendants = parentId => {
          const children = allPhases.filter(p => p.parent_phase_id === parentId);
          return [parentId, ...children.flatMap(c => getDescendants(c.id))];
        };
        const descendantIds = getDescendants(samplePhase.id);
        const [gamesRes, partsRes] = await Promise.all([
          supabase.from('games').select(`
            *,
            home_team:teams!home_team_id (*, team_aliases (*)),
            away_team:teams!away_team_id (*, team_aliases (*)),
            venue:venues (name),
            phase:phases!games_phase_id_fkey (name, parent_phase:phases!parent_phase_id (name)),
            game_staff (game_id, team_id, role, person:people(display_name))
          `).in('phase_id', descendantIds).neq('status', 'anomaly').order('date', { ascending: true }),
          supabase.from('participations').select('phase_id, team_id, person:people(display_name)').in('phase_id', descendantIds)
        ]);
        if (gamesRes.error) throw gamesRes.error;
        return { games: gamesRes.data?.length || 0, participations: partsRes.data?.length || 0 };
      }
    },
    // Teams List (with historical aliases)
    {
      name: 'getTeams',
      budget: 350,
      fn: async () => {
        const { data, error } = await supabase.from('teams').select('*, team_aliases (*)').order('name');
        if (error) throw error;
        return data;
      }
    },
    // People List (with coaching participations & competitions)
    {
      name: 'getPeople',
      budget: 350,
      fn: async () => {
        const { data, error } = await supabase.from('people').select(`
          *,
          participations (
            teams (name, team_type),
            phases (
              seasons (
                year,
                name,
                competitions (slug, level)
              )
            )
          )
        `).order('display_name');
        if (error) throw error;
        return data;
      }
    },
    // Coach / Person Profile (/people/[id])
    {
      name: 'getPersonProfile',
      budget: 400,
      fn: async () => {
        if (!samplePersonId) return null;
        const gameFields = `
          id, date, date_display, time, home_score, away_score, status, is_playoff, playoff_round,
          final_type, title_name, is_double_header, is_unique_score, is_totally_unique, game_level,
          nickname, notes, home_team_id, away_team_id, phase_id, away_phase_id,
          phase:phases!games_phase_id_fkey (id, name, type, season:seasons (year, id, competition:competitions (name))),
          home_team:teams!home_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
          away_team:teams!away_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url))
        `;
        const [personRes, partsRes, staffRes] = await Promise.all([
          supabase.from('people').select('*, game_staff (*, game:games (*, phase:phases!games_phase_id_fkey (*, season:seasons (*, competition:competitions (*))))), participations (*, team:teams (*, team_aliases (*)), phase:phases (*, season:seasons (*, competition:competitions (*)))), hall_of_fame (*, team:teams (*, team_aliases (*))), retired_jerseys (*, team:teams (*, team_aliases (*)))').eq('id', samplePersonId).single(),
          supabase.from('participations').select(`team_id, phase_id, phase:phases!inner(id, home_games:games!games_phase_id_fkey(${gameFields}), away_games:games!away_phase_id(${gameFields}))`).eq('head_coach_id', samplePersonId),
          supabase.from('game_staff').select(`game_id, team_id, person_id, game:games(${gameFields})`).eq('role', 'head_coach')
        ]);
        if (personRes.error) throw personRes.error;
        return { person: personRes.data, parts: partsRes.data?.length || 0, staff: staffRes.data?.length || 0 };
      }
    },
    // Venues List
    {
      name: 'getVenues',
      budget: 250,
      fn: async () => {
        const { data, error } = await supabase.from('venues').select('*').order('name');
        if (error) throw error;
        return data;
      }
    },
    // Admin Operations
    {
      name: 'adminAuthPing',
      budget: 300,
      fn: async () => {
        // Measure round-trip latency to Supabase Auth endpoint
        const res = await instrumentedFetch(`${supabaseUrl}/auth/v1/health`, {
          headers: { apikey: supabaseKey }
        });
        if (!res.ok && res.status !== 404) {
          // If /health isn't exposed, fallback to auth settings or head
          const settingsRes = await instrumentedFetch(`${supabaseUrl}/auth/v1/settings`, {
            headers: { apikey: supabaseKey }
          });
          if (!settingsRes.ok) throw new Error(`Auth endpoint returned ${settingsRes.status}`);
          return await settingsRes.json();
        }
        return res.status === 200 ? await res.json() : { status: 'ok' };
      }
    },
    {
      name: 'adminWalkovers',
      budget: 250,
      fn: async () => {
        const { data, error } = await supabase
          .from('games')
          .select('id, date, home_score, away_score, status')
          .eq('status', 'awarded')
          .is('home_score', null)
          .is('away_score', null)
          .limit(50);
        if (error) throw error;
        return data;
      }
    },
    {
      name: 'adminAnomalies',
      budget: 250,
      fn: async () => {
        const { data, error } = await supabase
          .from('games')
          .select('id, date, home_score, away_score, status')
          .eq('status', 'anomaly')
          .order('date', { ascending: false })
          .limit(50);
        if (error) throw error;
        return data;
      }
    },
    {
      name: 'adminProposals',
      budget: 200,
      fn: async () => {
        const { data, error } = await supabase
          .from('game_proposals')
          .select('id, game_id, status, created_at')
          .eq('status', 'pending')
          .limit(50);
        if (error) throw error;
        return data;
      }
    },
    {
      name: 'adminGameCounts',
      budget: 400,
      fn: async () => {
        const [{ data: phases, error: pErr }, { data: teams, error: tErr }] = await Promise.all([
          supabase
            .from('phases')
            .select('id, name, max_games_per_team, games_validated, season:seasons(id, year, competition:competitions(name)), games:games!games_phase_id_fkey(home_team_id, away_team_id, status)')
            .not('max_games_per_team', 'is', null)
            .eq('games_validated', false),
          supabase.from('teams').select('id, name')
        ]);
        if (pErr) throw pErr;
        if (tErr) throw tErr;
        const totalGames = (phases || []).reduce((sum, p) => sum + (p.games?.filter(g => g.status !== 'anomaly').length || 0), 0);
        return { phases: phases?.length || 0, teams: teams?.length || 0, games: totalGames };
      }
    },
    {
      name: 'adminPollBuilder',
      budget: 450,
      fn: async () => {
        if (!recentSeason) return null;
        const [phasesRes, partRes, gamesRes, notesRes] = await Promise.all([
          supabase.from('phases').select('id, name, type, ordinal, parent_phase_id').eq('season_id', recentSeason.id),
          supabase.from('participations').select('*, person:people(display_name), team:teams(id, name, logo_url, team_aliases(id, name, start_year, end_year, logo_url)), phases!inner(season_id)').eq('phases.season_id', recentSeason.id),
          supabase.from('games').select('id, phase_id, away_phase_id, date, status, home_team_id, away_team_id, home_score, away_score, is_playoff, is_double_header, game_type, home_team:teams!home_team_id(id, name, logo_url, team_aliases(id, name, start_year, end_year, logo_url)), away_team:teams!away_team_id(id, name, logo_url, team_aliases(id, name, start_year, end_year, logo_url)), phases!games_phase_id_fkey!inner(season_id)').eq('phases.season_id', recentSeason.id).neq('status', 'anomaly').order('date', { ascending: true }),
          supabase.from('notes').select('id, content, created_at').eq('entity_id', recentSeason.id).eq('entity_type', 'writers_poll').order('created_at', { ascending: false })
        ]);
        if (phasesRes.error) throw phasesRes.error;
        if (partRes.error) throw partRes.error;
        if (gamesRes.error) throw gamesRes.error;
        return { phases: phasesRes.data?.length || 0, participations: partRes.data?.length || 0, games: gamesRes.data?.length || 0, ballots: notesRes.data?.length || 0 };
      }
    },
    // Gameday Live Score Hub (/admin/gameday)
    {
      name: 'adminGamedayLoader',
      budget: 450,
      fn: async () => {
        if (!recentSeason) return null;
        const [seasonsRes, phasesRes, gamesRes, venuesRes, peopleRes, partRes] = await Promise.all([
          supabase.from('seasons').select('id, year, name, competition:competitions(name)').order('year', { ascending: false }),
          supabase.from('phases').select('id, name, type, ordinal, parent_phase_id').eq('season_id', recentSeason.id).order('ordinal', { ascending: true }),
          supabase.from('games').select(`
            id, phase_id, date, time, status, home_score, away_score, is_playoff, is_double_header, notes,
            home_team:teams!home_team_id(id, name, logo_url),
            away_team:teams!away_team_id(id, name, logo_url),
            phase:phases!phase_id(id, name),
            venue:venues!venue_id(id, name),
            game_staff(game_id, team_id, person_id, role, person:people(display_name))
          `).eq('season_id', recentSeason.id).order('date', { ascending: true }).order('time', { ascending: true }),
          supabase.from('venues').select('id, name').order('name', { ascending: true }),
          supabase.from('people').select('id, display_name').order('display_name', { ascending: true }),
          supabase.from('participations').select('phase_id, team_id, person:people(display_name), phases!inner(season_id)').eq('phases.season_id', recentSeason.id).not('head_coach_id', 'is', null)
        ]);
        if (gamesRes.error) throw gamesRes.error;
        return {
          seasons: seasonsRes.data?.length || 0,
          phases: phasesRes.data?.length || 0,
          games: gamesRes.data?.length || 0,
          venues: venuesRes.data?.length || 0,
          people: peopleRes.data?.length || 0,
          defaultCoaches: partRes.data?.length || 0
        };
      }
    },
    // Batch Slate Predictor (/admin/predictions)
    {
      name: 'adminPredictionsSlate',
      budget: 600,
      fn: async () => {
        const { data: slate, error: sErr } = await supabase
          .from('games')
          .select('id, date, home_team_id, away_team_id')
          .gte('date', '2026-11-14')
          .lte('date', '2026-11-15');
        if (sErr) throw sErr;
        const games = slate || [];
        if (games.length === 0) return { games: 0 };
        const ids = Array.from(new Set(games.flatMap(g => [g.home_team_id, g.away_team_id]).filter(Boolean)));
        const pairClauses = games.slice(0, 25).flatMap(g => [
          `and(home_team_id.eq.${g.home_team_id},away_team_id.eq.${g.away_team_id})`,
          `and(home_team_id.eq.${g.away_team_id},away_team_id.eq.${g.home_team_id})`
        ]).join(',');
        const histSelect = 'id, date, home_team_id, away_team_id, home_score, away_score, is_playoff, phase:phases!games_phase_id_fkey!inner(name, season:seasons!inner(year))';
        const [residualsRes, homeRecent, awayRecent, h2hRes] = await Promise.all([
          supabase.from('games').select('id, home_team_id, away_team_id, home_score, away_score, date, status, phase:phases!games_phase_id_fkey!inner(name, season:seasons!inner(year))').eq('status', 'completed').not('home_score', 'is', null).not('away_score', 'is', null).eq('phase.season.year', 2026).lt('date', '2026-11-14'),
          supabase.from('games').select(histSelect).in('home_team_id', ids).eq('status', 'completed').not('home_score', 'is', null).not('away_score', 'is', null).gte('phase.season.year', 2024),
          supabase.from('games').select(histSelect).in('away_team_id', ids).eq('status', 'completed').not('home_score', 'is', null).not('away_score', 'is', null).gte('phase.season.year', 2024),
          supabase.from('games').select(histSelect).or(pairClauses).eq('status', 'completed').not('home_score', 'is', null).not('away_score', 'is', null)
        ]);
        if (homeRecent.error) throw homeRecent.error;
        return {
          slateGames: games.length,
          inSeasonGames: residualsRes.data?.length || 0,
          recentGames: (homeRecent.data?.length || 0) + (awayRecent.data?.length || 0),
          h2hGames: h2hRes.data?.length || 0
        };
      }
    },
    // Model Calibration & Accuracy (/admin/predictions/accuracy)
    {
      name: 'adminPredictionAccuracy',
      budget: 350,
      fn: async () => {
        const [seasonRes, predsRes] = await Promise.all([
          supabase.from('seasons').select('id, competitions!inner(name)').eq('year', 2026).ilike('competitions.name', '%Universities%').maybeSingle(),
          supabase.from('predictions').select(`
            id, game_id, home_team_id, away_team_id, predicted_home_score, predicted_away_score, win_probability, confidence, created_at,
            home_team:teams!predictions_home_team_id_fkey(id, name),
            away_team:teams!predictions_away_team_id_fkey(id, name),
            game:games!predictions_game_id_fkey(id, date, home_score, away_score, status, season_id, home_team_id, away_team_id)
          `).order('created_at', { ascending: false })
        ]);
        if (predsRes.error) throw predsRes.error;
        return { seasonId: seasonRes.data?.id || null, predictions: predsRes.data?.length || 0 };
      }
    },
    // Weekly Interesting Facts Engine (/api/facts?mode=recap & npm run facts)
    {
      name: 'weeklyFactsEngine',
      budget: 850,
      fn: async () => {
        const facts = await generateWeeklyFacts(supabase, { week: 3, season: 2026 });
        return { completedGames: facts.summary?.completedCount || 0, window: facts.window?.label };
      }
    },
    // Weekly Upcoming Preview Engine (/api/facts?mode=preview & npm run preview)
    {
      name: 'weeklyPreviewEngine',
      budget: 800,
      fn: async () => {
        const preview = await generateWeeklyPreview(supabase, { week: 5, season: 2026 });
        return { upcomingGames: preview.summary?.totalScheduled || 0, window: preview.window?.label };
      }
    }
  ];

  const results = [];
  for (const b of benchmarks) {
    const res = await measureQuery(b.name, b.budget, b.fn);
    results.push(res);
  }

  // Console output
  const line = '-'.repeat(118);
  console.log(line);
  console.log(' Query Name                Median   Spread   Budget  Eff.Budget   Net(DB)  Reqs  Waves    Wire KB    Status');
  console.log(line);
  for (const r of results) {
    const nameCol = r.name.padEnd(23);
    const latCol = `${r.durationMs.toFixed(1)}ms`.padStart(9);
    const sprCol = `±${(r.spreadMs / 2).toFixed(0)}ms`.padStart(8);
    const budCol = `${r.budgetMs}ms`.padStart(8);
    const effCol = `${r.effectiveBudget.toFixed(0)}ms`.padStart(11);
    const netCol = `${r.netMs.toFixed(0)}ms`.padStart(9);
    const reqCol = String(r.requests).padStart(5);
    const wavCol = String(r.waves).padStart(6);
    const wireCol = `${(r.wireBytes / 1024).toFixed(1)}`.padStart(10);
    console.log(` ${nameCol} ${latCol} ${sprCol} ${budCol} ${effCol} ${netCol} ${reqCol} ${wavCol} ${wireCol}    ${r.status}${r.error ? ` (${r.error})` : ''}`);
  }
  console.log(line);
  console.log(' Net(DB) = median latency minus (waves x network floor): an estimate of server + transfer time independent of runner placement.');

  // 3. PostgREST 1,000-Row Capacity & Silent Truncation Guardrails
  console.log('\n--- 3. POSTGREST ROW-CAP & PAGINATION GUARDRAILS ---');
  const champsBench = results.find(r => r.name === 'getChampions');
  const uniqueBench = results.find(r => r.name === 'getUniqueScoreGames');
  const [{ count: uniballPhasesCount }, { count: uniballPartsCount }] = await Promise.all([
    supabase
      .from('phases')
      .select('id, season:seasons!inner(competition:competitions!inner(slug))', { count: 'exact', head: true })
      .in('season.competition.slug', ['bcafl', 'buafl']),
    supabase
      .from('participations')
      .select('id, phases!inner(season:seasons!inner(competition:competitions!inner(slug)))', { count: 'exact', head: true })
      .in('phases.season.competition.slug', ['bcafl', 'buafl'])
  ]);

  const capacityChecks = [
    { name: 'teams (single fetch)', rows: Number(tableCounts.teams) || 0, limit: 1000 },
    { name: 'venues (single fetch)', rows: Number(tableCounts.venues) || 0, limit: 1000 },
    { name: 'people (single fetch)', rows: Number(tableCounts.people) || 0, limit: 1000 },
    { name: 'seasons (single fetch)', rows: Number(tableCounts.seasons) || 0, limit: 1000 },
    { name: 'notes (single fetch)', rows: Number(tableCounts.notes) || 0, limit: 1000 },
    { name: 'getChampions (single fetch)', rows: champsBench?.count || 0, limit: 1000 },
    { name: 'uniballPhases (single fetch)', rows: uniballPhasesCount || 0, limit: 1000 },
    { name: 'getUniqueScoreGames (2 pages)', rows: uniqueBench?.count || 0, limit: 2000 },
    { name: 'getAllPhases (3 pages)', rows: Number(tableCounts.phases) || 0, limit: 3000 },
    { name: 'uniballParticipations (4 pages)', rows: uniballPartsCount || 0, limit: 4000 }
  ].map(c => {
    const pct = (c.rows / c.limit) * 100;
    let status = '🟢 PASS';
    if (pct >= 95) status = '🔴 CRITICAL';
    else if (pct >= 85) status = '🟡 WARNING';
    return { ...c, pct, status };
  });

  console.log('---------------------------------------------------------------------------');
  console.log(' Guardrail Scope                  Rows    Ceiling   Utilization     Status');
  console.log('---------------------------------------------------------------------------');
  for (const c of capacityChecks) {
    const nameCol = c.name.padEnd(31);
    const rowsCol = String(c.rows).padStart(6);
    const limCol = String(c.limit).padStart(9);
    const pctCol = `${c.pct.toFixed(1)}%`.padStart(12);
    console.log(` ${nameCol} ${rowsCol}  ${limCol}  ${pctCol}    ${c.status}`);
  }
  console.log('---------------------------------------------------------------------------');

  const passedCount = results.filter(r => r.status.includes('PASS')).length;
  const warnCount = results.filter(r => r.status.includes('WARNING')).length;
  const critCount = results.filter(r => r.status.includes('CRITICAL')).length;
  const errCount = results.filter(r => r.status.includes('ERROR')).length;
  const capWarnCount = capacityChecks.filter(c => c.status.includes('WARNING')).length;
  const capCritCount = capacityChecks.filter(c => c.status.includes('CRITICAL')).length;

  console.log(`\nLatency Summary : ${passedCount} Passed | ${warnCount} Warnings | ${critCount} Critical | ${errCount} Errors`);
  console.log(`Capacity Summary: ${capacityChecks.length - capWarnCount - capCritCount} Passed | ${capWarnCount} Warnings | ${capCritCount} Critical\n`);

  // Append to GitHub Actions Job Summary if running in CI
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summaryMd = `
## ⚡ Weekly Database Performance Benchmark (${timestamp} UTC)

### 📊 Database Row Counts
| Table | Row Count |
|---|---|
${Object.entries(tableCounts).map(([k, v]) => `| \`${k}\` | **${v}** |`).join('\n')}

### ⏱️ Query Latencies vs Budgets
**Network floor:** \`${networkFloorMs.toFixed(1)} ms\` median PostgREST RTT (reference \`${REFERENCE_RTT_MS} ms\`, per-wave allowance \`+${rttAllowance.toFixed(1)} ms\`) · **Samples:** ${SAMPLES} per query (median reported)

| Query | Median | Spread | Budget | Eff. Budget | Net (DB) | Reqs | Waves | Wire | Status |
|---|---|---|---|---|---|---|---|---|---|
${results.map(r => `| **\`${r.name}\`** | \`${r.durationMs.toFixed(1)} ms\` | \`±${(r.spreadMs / 2).toFixed(0)} ms\` | \`${r.budgetMs} ms\` | \`${r.effectiveBudget.toFixed(0)} ms\` | \`${r.netMs.toFixed(0)} ms\` | ${r.requests} | ${r.waves} | \`${(r.wireBytes / 1024).toFixed(1)} KB\` | ${r.status} |`).join('\n')}

_Net (DB) = median − waves × network floor: approximates server + transfer time independent of runner placement. Waves = sequential round-trips on the critical path._

### 🛡️ PostgREST Row-Cap & Pagination Guardrails
| Scope | Current Rows | Max Capacity | Utilization | Status |
|---|---|---|---|---|
${capacityChecks.map(c => `| **\`${c.name}\`** | \`${c.rows}\` | \`${c.limit}\` | \`${c.pct.toFixed(1)}%\` | ${c.status} |`).join('\n')}

**Overall Health**: ${critCount === 0 && errCount === 0 && capCritCount === 0 ? '✅ All queries and capacity guardrails healthy' : '⚠️ Latency or capacity warnings detected'}
`;
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMd);
  }

  if (isStrict && (critCount > 0 || errCount > 0 || capCritCount > 0)) {
    console.error('Benchmark failed with critical regressions in strict mode.');
    process.exit(1);
  }
}

runBenchmark();
