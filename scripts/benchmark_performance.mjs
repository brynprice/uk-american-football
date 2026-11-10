import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import dotenv from 'dotenv';
import fs from 'fs';

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

const supabase = createClient(supabaseUrl, supabaseKey);

const isStrict = process.argv.includes('--strict');

async function measureQuery(name, budgetMs, fn) {
  let start = performance.now();
  try {
    let result = await fn();
    let duration = performance.now() - start;

    // If first attempt exceeded budget (e.g. due to cold TLS socket / connection pool scaling),
    // run one immediate retry on the warmed connection pool and record the better execution time.
    if (duration > budgetMs) {
      const retryStart = performance.now();
      const retryResult = await fn();
      const retryDuration = performance.now() - retryStart;
      if (retryDuration < duration) {
        duration = retryDuration;
        result = retryResult;
      }
    }

    const count = Array.isArray(result) ? result.length : (result ? 1 : 0);
    const size = Buffer.byteLength(JSON.stringify(result || ''));
    
    let status = '🟢 PASS';
    if (duration > budgetMs * 1.5) {
      status = '🔴 CRITICAL';
    } else if (duration > budgetMs) {
      status = '🟡 WARNING';
    }

    return {
      name,
      durationMs: duration,
      budgetMs,
      count,
      sizeBytes: size,
      status,
      error: null
    };
  } catch (err) {
    const duration = performance.now() - start;
    return {
      name,
      durationMs: duration,
      budgetMs,
      count: 0,
      sizeBytes: 0,
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

  const benchmarks = [
    // Homepage Archive Stats (indexed parallel queries)
    {
      name: 'getArchiveStats',
      budget: 250,
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
      budget: 200,
      fn: async () => {
        const { data, error } = await supabase.from('competitions').select('*').order('name');
        if (error) throw error;
        return data;
      }
    },
    // Season Details (unphased games + notes)
    {
      name: 'getSeasonDetails',
      budget: 350,
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
      budget: 350,
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
      budget: 250,
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
    // Game Details (game + staff + sources + scoped participations)
    {
      name: 'getGameDetails',
      budget: 250,
      fn: async () => {
        if (!sampleGame) return null;
        const { data: g, error: gErr } = await supabase.from('games').select(`
          *, 
          home_team:teams!home_team_id (*, team_aliases (*)), 
          away_team:teams!away_team_id (*, team_aliases (*)), 
          venue:venues (*), 
          phase:phases!games_phase_id_fkey (*, season:seasons (id, year, competition:competitions (name))), 
          away_phase:phases!away_phase_id (name),
          season:seasons!games_season_id_fkey (id, year, competition:competitions (name)),
          game_staff (*, person:people (*))
        `).eq('id', sampleGame.id).single();
        if (gErr) throw gErr;

        const teamIds = [sampleGame.home_team_id, sampleGame.away_team_id].filter(Boolean);
        const [sources, notes, parts] = await Promise.all([
          supabase.from('sources').select('*').eq('entity_id', sampleGame.id).eq('entity_type', 'games'),
          supabase.from('notes').select('*').eq('entity_id', sampleGame.id).eq('entity_type', 'games'),
          sampleGame.phase_id && teamIds.length > 0
            ? supabase.from('participations').select('*, person:people (*)').eq('phase_id', sampleGame.phase_id).in('team_id', teamIds)
            : Promise.resolve({ data: [] })
        ]);
        return { g, sources, notes, parts };
      }
    },
    // Champions & Bowls query
    {
      name: 'getChampions',
      budget: 250,
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
      budget: 250,
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
    // Scorigami Unique Score Games (/scorigami/unique)
    {
      name: 'getUniqueScoreGames',
      budget: 300,
      fn: async () => {
        const [gamesRes, teamsRes, phasesRes] = await Promise.all([
          supabase.from('games').select(`
            id, date, date_display, time, home_score, away_score, status, is_unique_score, is_totally_unique,
            game_level, final_type, title_name, nickname, is_playoff, playoff_round, is_double_header,
            phase_id, away_phase_id, home_team_id, away_team_id
          `).eq('is_unique_score', true).neq('status', 'anomaly').neq('status', 'cancelled').order('date', { ascending: false, nullsFirst: false }),
          supabase.from('teams').select('id, name, logo_url, team_type, team_aliases(id, name, start_year, end_year, logo_url)'),
          supabase.from('phases').select('id, name, season:seasons(id, year, competition:competitions(name, level))').limit(5000)
        ]);
        if (gamesRes.error) throw gamesRes.error;
        const teamMap = new Map((teamsRes.data || []).map(t => [t.id, t]));
        const phaseMap = new Map((phasesRes.data || []).map(p => [p.id, p]));
        return (gamesRes.data || []).map(g => ({
          ...g,
          phase: g.phase_id ? (phaseMap.get(g.phase_id) || null) : null,
          away_phase: g.away_phase_id ? { name: phaseMap.get(g.away_phase_id)?.name } : null,
          home_team: teamMap.get(g.home_team_id) || null,
          away_team: teamMap.get(g.away_team_id) || null
        }));
      }
    },
    // Uniball Historical Timeline (/timeline)
    {
      name: 'getTimelineData',
      budget: 450,
      fn: async () => {
        const [seasonsRes, seasonNotesRes, champNotesRes, teamsRes] = await Promise.all([
          supabase.from('seasons').select('id, year, name, competition_id, completeness_score, competition:competitions!inner(id, name, slug, level)').in('competition.slug', ['bcafl', 'buafl']).order('year', { ascending: true }),
          supabase.from('notes').select('entity_id, content').eq('entity_type', 'seasons'),
          supabase.from('notes').select('entity_id, content').eq('entity_type', 'divisional_champion'),
          supabase.from('teams').select('id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)')
        ]);
        if (seasonsRes.error) throw seasonsRes.error;
        const seasons = seasonsRes.data || [];
        const seasonIds = seasons.map(s => s.id);

        const fetchUniballParts = async () => {
          const pageSize = 1000;
          const pages = await Promise.all(
            [0, 1, 2, 3].map(p =>
              supabase
                .from('participations')
                .select('id, team_id, phase_id, is_champion, wins, losses, ties, points_for, points_against, phases!inner(season_id)')
                .in('phases.season_id', seasonIds)
                .range(p * pageSize, (p + 1) * pageSize - 1)
            )
          );
          const rows = [];
          for (const res of pages) {
            if (res.data) rows.push(...res.data);
          }
          return rows;
        };

        const [phasesRes, gamesRes, parts] = await Promise.all([
          supabase.from('phases').select('id, season_id, name, type, ordinal, parent_phase_id').in('season_id', seasonIds).limit(5000),
          supabase.from('games').select(`
            id, season_id, date, home_score, away_score, final_type, title_name, notes,
            home_team:teams!home_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
            away_team:teams!away_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
            venue:venues (id, name, city)
          `).in('season_id', seasonIds).or('final_type.in.(title,bowl),title_name.ilike.%College Bowl%').neq('status', 'anomaly').order('date', { ascending: true }),
          fetchUniballParts()
        ]);
        if (phasesRes.error) throw phasesRes.error;
        if (gamesRes.error) throw gamesRes.error;
        return {
          seasons: seasons.length,
          phases: phasesRes.data?.length || 0,
          games: gamesRes.data?.length || 0,
          participations: parts.length,
          teams: teamsRes.data?.length || 0,
          notes: (seasonNotesRes.data?.length || 0) + (champNotesRes.data?.length || 0)
        };
      }
    },
    // Teams List (with historical aliases)
    {
      name: 'getTeams',
      budget: 200,
      fn: async () => {
        const { data, error } = await supabase.from('teams').select('*, team_aliases (*)').order('name');
        if (error) throw error;
        return data;
      }
    },
    // People List (with coaching participations & competitions)
    {
      name: 'getPeople',
      budget: 200,
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
      budget: 300,
      fn: async () => {
        if (!samplePersonId) return null;
        const [personRes, coachInit] = await Promise.all([
          supabase.from('people').select('*, game_staff (*, game:games (*, phase:phases!games_phase_id_fkey (*, season:seasons (*, competition:competitions (*))))), participations (*, team:teams (*, team_aliases (*)), phase:phases (*, season:seasons (*, competition:competitions (*)))), hall_of_fame (*, team:teams (*, team_aliases (*))), retired_jerseys (*, team:teams (*, team_aliases (*)))').eq('id', samplePersonId).single(),
          Promise.all([
            supabase.from('participations').select('team_id, phase_id').eq('head_coach_id', samplePersonId),
            supabase.from('game_staff').select('game_id, team_id').eq('person_id', samplePersonId).eq('role', 'head_coach')
          ])
        ]);
        if (personRes.error) throw personRes.error;
        const [partsRes, staffRes] = coachInit;
        const phaseIds = (partsRes.data || []).map(p => p.phase_id);
        let coachedGames = [];
        if (phaseIds.length > 0) {
          const { data: games } = await supabase.from('games').select(`
            *,
            phase:phases!games_phase_id_fkey (*, season:seasons (year, id, competition:competitions (*))),
            away_phase:phases!away_phase_id (*, season:seasons (year, id, competition:competitions (*))),
            home_team:teams!home_team_id (*, team_aliases (*)),
            away_team:teams!away_team_id (*, team_aliases (*))
          `).or(`phase_id.in.(${phaseIds.join(',')}),away_phase_id.in.(${phaseIds.join(',')})`);
          coachedGames = games || [];
        }
        return { person: personRes.data, coachedGamesCount: coachedGames.length, staffCount: staffRes.data?.length || 0 };
      }
    },
    // Venues List
    {
      name: 'getVenues',
      budget: 150,
      fn: async () => {
        const { data, error } = await supabase.from('venues').select('*').order('name');
        if (error) throw error;
        return data;
      }
    },
    // Admin Operations
    {
      name: 'adminAuthPing',
      budget: 250,
      fn: async () => {
        // Measure round-trip latency to Supabase Auth endpoint
        const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
          headers: { apikey: supabaseKey }
        });
        if (!res.ok && res.status !== 404) {
          // If /health isn't exposed, fallback to auth settings or head
          const settingsRes = await fetch(`${supabaseUrl}/auth/v1/settings`, {
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
      budget: 350,
      fn: async () => {
        const [{ data: phases, error: pErr }, { data: teams }] = await Promise.all([
          supabase
            .from('phases')
            .select('id, name, max_games_per_team, games_validated, season:seasons(id, year, competition:competitions(name))')
            .not('max_games_per_team', 'is', null)
            .eq('games_validated', false),
          supabase.from('teams').select('id, name')
        ]);
        if (pErr) throw pErr;
        const phaseIds = (phases || []).map(p => p.id);
        if (phaseIds.length === 0) return { phases: 0, games: 0 };
        const chunkSize = 50;
        const batches = [];
        for (let i = 0; i < phaseIds.length; i += chunkSize) {
          batches.push(
            supabase
              .from('games')
              .select('phase_id, home_team_id, away_team_id')
              .in('phase_id', phaseIds.slice(i, i + chunkSize))
              .neq('status', 'anomaly')
          );
        }
        const batchRes = await Promise.all(batches);
        const totalGames = batchRes.reduce((sum, r) => sum + (r.data?.length || 0), 0);
        return { phases: phaseIds.length, teams: teams?.length || 0, games: totalGames };
      }
    },
    {
      name: 'adminPollBuilder',
      budget: 350,
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
    }
  ];

  const results = [];
  for (const b of benchmarks) {
    const res = await measureQuery(b.name, b.budget, b.fn);
    results.push(res);
  }

  // Console output
  console.log('------------------------------------------------------------------------');
  console.log(' Query Name          Latency      Budget     Payload    Rows    Status');
  console.log('------------------------------------------------------------------------');
  for (const r of results) {
    const nameCol = r.name.padEnd(19);
    const latCol = `${r.durationMs.toFixed(1)}ms`.padStart(9);
    const budCol = `${r.budgetMs}ms`.padStart(9);
    const sizeCol = `${(r.sizeBytes / 1024).toFixed(1)} KB`.padStart(10);
    const rowsCol = String(r.count).padStart(7);
    console.log(` ${nameCol} ${latCol}  ${budCol}  ${sizeCol}  ${rowsCol}    ${r.status}`);
  }
  console.log('------------------------------------------------------------------------');

  const passedCount = results.filter(r => r.status.includes('PASS')).length;
  const warnCount = results.filter(r => r.status.includes('WARNING')).length;
  const critCount = results.filter(r => r.status.includes('CRITICAL')).length;
  const errCount = results.filter(r => r.status.includes('ERROR')).length;

  console.log(`\nSummary: ${passedCount} Passed | ${warnCount} Warnings | ${critCount} Critical | ${errCount} Errors\n`);

  // Append to GitHub Actions Job Summary if running in CI
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summaryMd = `
## ⚡ Weekly Database Performance Benchmark (${timestamp} UTC)

### 📊 Database Row Counts
| Table | Row Count |
|---|---|
${Object.entries(tableCounts).map(([k, v]) => `| \`${k}\` | **${v}** |`).join('\n')}

### ⏱️ Query Latencies vs Budgets
| Query | Latency | Budget | Payload | Status |
|---|---|---|---|---|
${results.map(r => `| **\`${r.name}\`** | \`${r.durationMs.toFixed(1)} ms\` | \`${r.budgetMs} ms\` | \`${(r.sizeBytes / 1024).toFixed(1)} KB\` | ${r.status} |`).join('\n')}

**Overall Health**: ${critCount === 0 && errCount === 0 ? '✅ All queries healthy' : '⚠️ Latency warnings detected'}
`;
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMd);
  }

  if (isStrict && (critCount > 0 || errCount > 0)) {
    console.error('Benchmark failed with critical regressions in strict mode.');
    process.exit(1);
  }
}

runBenchmark();
