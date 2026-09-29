import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables (.env.local, then .env)
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon key) must be set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const isStrict = process.argv.includes('--strict');

async function measureQuery(name, budgetMs, fn) {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
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
  console.log(` BRITBALL ARCHIVE PERFORMANCE BENCHMARK (${timestamp} UTC)`);
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
  const { data: recentSeason } = await supabase.from('seasons').select('id, year').order('year', { ascending: false }).limit(1).single();
  const { data: samplePhase } = await supabase.from('phases').select('id, name, season_id').limit(1).single();
  const { data: sampleTeam } = await supabase.from('teams').select('id, name').limit(1).single();
  const { data: sampleGame } = await supabase.from('games').select('id, phase_id, home_team_id, away_team_id').limit(1).single();

  console.log('\n--- 2. CRITICAL QUERY LATENCY BENCHMARKS ---');

  const benchmarks = [
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
            *,
            phase:phases!games_phase_id_fkey (*, season:seasons (year, id, competition:competitions (*))),
            away_phase:phases!away_phase_id (*, season:seasons (year, id, competition:competitions (*))),
            home_team:teams!home_team_id (*, team_aliases (*)),
            away_team:teams!away_team_id (*, team_aliases (*))
          `).or(`home_team_id.eq.${sampleTeam.id},away_team_id.eq.${sampleTeam.id}`).neq('status', 'anomaly'),
          supabase.from('notes').select('entity_id').eq('entity_type', 'divisional_champion').eq('content', sampleTeam.id)
        ]);
        if (teamRes.error) throw teamRes.error;
        return { team: teamRes.data, games: gamesRes.data, champ: champRes.data };
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
        const { data, error } = await supabase.from('games').select(`
          *,
          home_team:teams!home_team_id (*, team_aliases (*)),
          away_team:teams!away_team_id (*, team_aliases (*)),
          phase:phases!games_phase_id_fkey (
            id, name, type,
            season:seasons (
              id, year, name,
              competition:competitions (id, name, level, slug)
            )
          ),
          venue:venues (*)
        `).in('final_type', ['title', 'bowl']).neq('status', 'anomaly');
        if (error) throw error;
        return data;
      }
    },
    // Scorigami query
    {
      name: 'searchGamesByScore',
      budget: 250,
      fn: async () => {
        const { data, error } = await supabase.from('games').select(`
          *, 
          phase:phases!games_phase_id_fkey(*, season:seasons(*, competition:competitions(*))), 
          home_team:teams!home_team_id(*, team_aliases(*)), 
          away_team:teams!away_team_id(*, team_aliases(*)), 
          venue:venues(*)
        `).or('and(home_score.eq.20,away_score.eq.14),and(home_score.eq.14,away_score.eq.20)').neq('status', 'anomaly');
        if (error) throw error;
        return data;
      }
    },
    // Teams List
    {
      name: 'getTeams',
      budget: 150,
      fn: async () => {
        const { data, error } = await supabase.from('teams').select('*').order('name');
        if (error) throw error;
        return data;
      }
    },
    // People List
    {
      name: 'getPeople',
      budget: 150,
      fn: async () => {
        const { data, error } = await supabase.from('people').select('*').order('display_name');
        if (error) throw error;
        return data;
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
