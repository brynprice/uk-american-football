#!/usr/bin/env node
/**
 * Reusable Active Roster Head Coach Audit CLI
 *
 * Audits any competition + season standings CSV against data/evidence/verified_coaches.json
 * and data/mappings/team_sources.json, classifying active teams into:
 *   - verified_synced
 *   - verified_unsynced
 *   - missing
 *
 * Usage:
 *   node scripts/coach_roster_audit.mjs --competition BUAFL --season 2026 --format markdown
 *   node scripts/coach_roster_audit.mjs --competition BUAFL --season 2026 --format json --out /tmp/audit.json
 */

import fs from 'fs';
import path from 'path';
import {
  ROOT_DIR,
  parseCliArgs,
  readCsvRecords,
  loadVerifiedCoaches,
  loadTeamSources,
  buildUniversityLookup,
  resolveCanonicalTeam,
} from './lib/coach_utils.mjs';

function printHelp() {
  console.log(`
Usage:
  node scripts/coach_roster_audit.mjs [options]

Options:
  --competition <NAME>   Competition folder under data/ (default: BUAFL)
  --season <YYYY>        Season year (default: 2026)
  --format <fmt>         Output format: markdown | json (default: markdown)
  --out <path>           Write output to file instead of stdout
  --help                 Show this help message
`);
}

function buildAuditReport({ competition, season }) {
  const standingsPath = path.join(ROOT_DIR, 'data', competition, `standings${season}.csv`);
  if (!fs.existsSync(standingsPath)) {
    throw new Error(`Standings file not found: ${standingsPath}`);
  }

  const { rows } = readCsvRecords(standingsPath);
  const verifiedAll = loadVerifiedCoaches();
  const teamSources = loadTeamSources();
  const uniLookup = buildUniversityLookup(teamSources);

  // Index verified_coaches.json by canonical team -> entries
  const verifiedByCanon = new Map();
  for (const entry of verifiedAll) {
    const rawTeam = (entry.team || '').trim();
    const canon = resolveCanonicalTeam(rawTeam, competition);
    if (!verifiedByCanon.has(canon)) verifiedByCanon.set(canon, []);
    verifiedByCanon.get(canon).push(entry);
  }

  // Deduplicate active teams from standings<YEAR>.csv (preserving encounter order)
  const activeTeamsMap = new Map();
  for (const row of rows) {
    const team = (row.team || '').trim();
    if (!team) continue;
    const canonicalTeam = resolveCanonicalTeam(team, competition);
    const key = `${team}||${canonicalTeam}`;
    if (!activeTeamsMap.has(key)) {
      activeTeamsMap.set(key, {
        team,
        canonical_team: canonicalTeam,
        phase: (row.phase || '').trim(),
        parent_phase: (row.parent_phase || '').trim(),
        phases: new Set([(row.phase || '').trim()].filter(Boolean)),
        csv_coaches: new Set([(row.head_coach || '').trim()].filter(Boolean)),
      });
    } else {
      const rec = activeTeamsMap.get(key);
      if (row.phase) rec.phases.add(row.phase.trim());
      if (row.head_coach && row.head_coach.trim()) rec.csv_coaches.add(row.head_coach.trim());
    }
  }

  const verifiedSynced = [];
  const verifiedUnsynced = [];
  const missing = [];
  const unverifiedInCsv = [];

  for (const rec of activeTeamsMap.values()) {
    const allEntries = verifiedByCanon.get(rec.canonical_team) || [];
    const currentEntries = allEntries.filter((e) => Number(e.year) === season);
    const priorEntries = allEntries
      .filter((e) => Number(e.year) < season)
      .sort((a, b) => Number(b.year) - Number(a.year));

    const csvCoach = [...rec.csv_coaches][0] || '';
    const sourceEntry = teamSources[rec.canonical_team] || teamSources[rec.team] || null;
    const university = uniLookup.get(rec.canonical_team) || uniLookup.get(rec.team) || '';
    const knownUrls = sourceEntry
      ? [
          ...(sourceEntry.official_urls || []),
          ...(sourceEntry.social_handles || []),
          ...(sourceEntry.wiki_urls || []),
        ]
      : [];

    const latestPrior = priorEntries[0]
      ? {
          year: Number(priorEntries[0].year),
          head_coach: priorEntries[0].head_coach,
          source: priorEntries[0].source,
          warning: 'DO_NOT_CARRY_OVER_CONTEXT_ONLY',
        }
      : null;

    if (currentEntries.length > 0) {
      const verifiedCoachNames = [...new Set(currentEntries.map((e) => e.head_coach.trim()))];
      const primaryVerified = currentEntries[currentEntries.length - 1];
      if (csvCoach && verifiedCoachNames.includes(csvCoach)) {
        verifiedSynced.push({
          team: rec.team,
          canonical_team: rec.canonical_team,
          phase: rec.phase,
          parent_phase: rec.parent_phase,
          university,
          head_coach: csvCoach,
          source: primaryVerified.source,
          source_details: primaryVerified.source_details || '',
        });
      } else if (!csvCoach) {
        verifiedUnsynced.push({
          team: rec.team,
          canonical_team: rec.canonical_team,
          phase: rec.phase,
          parent_phase: rec.parent_phase,
          university,
          head_coach: primaryVerified.head_coach,
          source: primaryVerified.source,
          source_details: primaryVerified.source_details || '',
        });
      } else {
        unverifiedInCsv.push({
          team: rec.team,
          canonical_team: rec.canonical_team,
          phase: rec.phase,
          parent_phase: rec.parent_phase,
          csv_head_coach: csvCoach,
          verified_head_coaches: verifiedCoachNames,
          warning: 'CSV head_coach differs from verified_coaches.json',
        });
      }
    } else if (csvCoach) {
      unverifiedInCsv.push({
        team: rec.team,
        canonical_team: rec.canonical_team,
        phase: rec.phase,
        parent_phase: rec.parent_phase,
        csv_head_coach: csvCoach,
        verified_head_coaches: [],
        warning: 'CSV has head_coach with no entry in verified_coaches.json (violates AGENTS.md Rule 6)',
      });
    } else {
      missing.push({
        team: rec.team,
        canonical_team: rec.canonical_team,
        phase: rec.phase,
        parent_phase: rec.parent_phase,
        university,
        known_urls: knownUrls,
        historical_prior_coach: latestPrior,
      });
    }
  }

  return {
    competition,
    season,
    standings_file: path.relative(ROOT_DIR, standingsPath),
    generated_at: new Date().toISOString(),
    summary: {
      total_active_teams: activeTeamsMap.size,
      verified_synced: verifiedSynced.length,
      verified_unsynced: verifiedUnsynced.length,
      missing: missing.length,
      unverified_in_csv: unverifiedInCsv.length,
    },
    verified_synced: verifiedSynced,
    verified_unsynced: verifiedUnsynced,
    missing,
    unverified_in_csv: unverifiedInCsv,
  };
}

function formatMarkdown(report) {
  const lines = [];
  lines.push(`# Active Roster Head Coach Audit — ${report.competition} ${report.season}`);
  lines.push('');
  lines.push(`- **Standings File:** \`${report.standings_file}\``);
  lines.push(`- **Total Active Teams:** ${report.summary.total_active_teams}`);
  lines.push(`- **Verified & Synced (in CSV + Registry):** ${report.summary.verified_synced}`);
  lines.push(`- **Verified but Unsynced (in Registry, missing in CSV):** ${report.summary.verified_unsynced}`);
  lines.push(`- **Missing Head Coach:** ${report.summary.missing}`);
  if (report.summary.unverified_in_csv > 0) {
    lines.push(`- **CSV Mismatch / Unverified Warning:** ${report.summary.unverified_in_csv}`);
  }
  lines.push('');

  if (report.verified_synced.length > 0) {
    lines.push('## Verified & Synced');
    lines.push('| Phase | Team | Head Coach | Source |');
    lines.push('| :--- | :--- | :--- | :--- |');
    for (const r of report.verified_synced) {
      lines.push(`| ${r.phase} | ${r.team} | ${r.head_coach} | ${r.source} |`);
    }
    lines.push('');
  }

  if (report.verified_unsynced.length > 0) {
    lines.push('## Verified in Registry, Unsynced in Standings CSV');
    lines.push('| Phase | Team | Head Coach | Source |');
    lines.push('| :--- | :--- | :--- | :--- |');
    for (const r of report.verified_unsynced) {
      lines.push(`| ${r.phase} | ${r.team} | ${r.head_coach} | ${r.source} |`);
    }
    lines.push('');
  }

  if (report.unverified_in_csv.length > 0) {
    lines.push('## Warnings: Unverified or Mismatched CSV Coaches');
    lines.push('| Phase | Team | CSV Coach | Warning |');
    lines.push('| :--- | :--- | :--- | :--- |');
    for (const r of report.unverified_in_csv) {
      lines.push(`| ${r.phase} | ${r.team} | ${r.csv_head_coach} | ${r.warning} |`);
    }
    lines.push('');
  }

  lines.push('## Missing Head Coaches (To Research)');
  lines.push('| Phase | Team | University | Known URLs | Prior Historical Coach (Context Only — Do Not Carry Over) |');
  lines.push('| :--- | :--- | :--- | :--- | :--- |');
  for (const r of report.missing) {
    const urls = r.known_urls.length > 0 ? r.known_urls.join(', ') : 'None seeded';
    const prior = r.historical_prior_coach
      ? `${r.historical_prior_coach.head_coach} (${r.historical_prior_coach.year})`
      : 'None';
    lines.push(`| ${r.phase} | ${r.team} | ${r.university || '-'} | ${urls} | ${prior} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }
  const competition = String(opts.competition || 'BUAFL').trim();
  const season = parseInt(String(opts.season || '2026'), 10);
  const format = String(opts.format || 'markdown').toLowerCase();

  if (Number.isNaN(season)) {
    console.error('Invalid --season value.');
    process.exit(1);
  }

  const report = buildAuditReport({ competition, season });
  const output = format === 'json' ? JSON.stringify(report, null, 2) + '\n' : formatMarkdown(report);

  if (opts.out) {
    const outPath = path.resolve(opts.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, output, 'utf8');
    console.error(`Audit written to ${outPath}`);
  } else {
    process.stdout.write(output);
  }
}

main();
