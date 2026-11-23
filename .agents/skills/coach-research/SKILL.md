---
name: coach-research
description: >-
  Reusable workflow and CLI runbook for auditing, researching, verifying, and registering
  head coaches for all active teams in a UK American football season (BUAFL, BAFANL, NWFL)
  while strictly enforcing AGENTS.md Rules 5 and 6.
---

# Active Roster Head Coach Research & Registration

Use this skill whenever the user asks to find, audit, refresh, or update head coaches for all active teams in a season/competition (e.g., 2026/27 BUCS/BUAFL University teams, 2026 BAFANL, or 2026 NWFL).

## Components

- `data/mappings/team_sources.json`: Persistent directory of official club, Students' Union, university sport, social, and wiki URLs keyed by canonical team name.
- `scripts/coach_roster_audit.mjs` (`npm run coaches:audit`): Audits `data/<COMP>/standings<YEAR>.csv` against `data/evidence/verified_coaches.json`, classifying teams into `verified_synced`, `verified_unsynced`, and `missing` (with `team_sources.json` URLs and prior-season context-only hints).
- `scripts/fetch_team_source_pages.mjs` (`npm run coaches:scan`): Deterministic offline-capable/live HTTP utility to:
  1. `--scan-sources`: Scrape known official SU/club pages in `team_sources.json` for coaching lines (`data/evidence/source_page_scan_<comp>_<year>.json`).
  2. `--resolve-redirects <candidates.json>`: Follow `vertexaisearch.cloud.google.com/grounding-api-redirect/...` links to canonical `source_url`s.
- `scripts/workflows/search_active_coaches.py`: Dynamic `run_workflow` script that runs `coach_roster_audit.mjs`, fans out throttled `research` agents in batches (`concurrency=2`, `model="flash"`), checkpoints after every wave, and saves `data/evidence/coach_candidates_<comp>_<year>.json`.
- `scripts/apply_verified_coaches.mjs` (`npm run coaches:apply`): Enforces strict validation gates (`AGENTS.md` Rules 5 & 6) and safely writes `data/evidence/verified_coaches.json`, `data/<COMP>/standings<YEAR>.csv`, `data/mappings/team_sources.json`, and Supabase (`--sync-db`).

## Standard Runbook

### 1. Audit Active Teams
```bash
npm run coaches:audit -- --competition BUAFL --season 2026 --format markdown
```

### 2. Optional Live Official-Page Scan (requires outbound network access)
Pre-scan known SU/club URLs before or alongside web search:
```bash
npm run coaches:scan -- --scan-sources --competition BUAFL --season 2026
```
(Add `--dry-run` inside sandboxed/offline environments to preview queued URLs.)

### 3. Run the Dynamic Coach Search Workflow
Invoke `run_workflow` with:
- `ScriptPath`: `<workspace>/scripts/workflows/search_active_coaches.py`
- `Args`:
  ```json
  {
    "competition": "BUAFL",
    "season": 2026,
    "batch_size": 5,
    "concurrency": 2,
    "resume": true
  }
  ```
Pass `"teams_filter": ["Team A", "Team B"]` if only refreshing specific teams.

### 4. Resolve Any Grounding Redirect URLs (requires outbound network access)
If any `verified_current_season` candidate has `needs_url_resolution: true` (`source_url == ""` with `redirect_url` populated):
```bash
npm run coaches:scan -- --resolve-redirects data/evidence/coach_candidates_buafl_2026.json
```

### 5. Review & Present Mandatory Evidence Table (`AGENTS.md` Rule 6)
- NEVER auto-write `likely_needs_verification`, `historical_only`, or `unconfirmed` leads into `verified_coaches.json` or `standings<YEAR>.csv`.
- NEVER store `vertexaisearch.cloud.google.com/grounding-api-redirect/...` in `verified_coaches.json` or `team_sources.json`.
- Always present a **Mandatory Evidence Table** to the user for approval before running `--apply`.

### 6. Merge Discovered Sources & Apply Approved Coaches
Preview first (safe dry-run):
```bash
npm run coaches:apply -- --competition BUAFL --season 2026 --input data/evidence/coach_candidates_buafl_2026.json --sync-existing --dry-run
```
Merge clean canonical official URLs into `team_sources.json` (without modifying coach records):
```bash
npm run coaches:apply -- --competition BUAFL --season 2026 --input data/evidence/coach_candidates_buafl_2026.json --merge-sources
```
After user approval, apply verified coaches + sync Supabase + verify via `sense_check_season.py`:
```bash
npm run coaches:apply -- --competition BUAFL --season 2026 --input data/evidence/coach_candidates_buafl_2026.json --sync-existing --apply --sync-db --merge-sources
```
