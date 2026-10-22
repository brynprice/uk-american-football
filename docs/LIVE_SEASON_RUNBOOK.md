# Live Season Runbook: Managing the BUAFL Season (2026/27+)

This runbook outlines the operational cadence, administrative tools, and automated pipelines for maintaining the UK American Football Archive in real-time during an active university football season.

---

## 1. Core Operating Principles

1. **Default-to-Null Rule**: Never invent or carry forward unverified head coaches, scores, venues, or dates.
2. **Canonical Team Aliases**: Always map legacy or rebranded names to database canonicals (e.g. `Edinburgh Wildcats`, `Nottingham Jade`, `Brighton Tsunami`).
3. **Walkover Protocol**: Forfeited matches are strictly recorded as **`1–0`** (home win) or **`0–1`** (away win) with `status = 'awarded'` and an explanatory note citing BUCS regulations.
4. **Reschedule vs Duplicate**: Never create a new row for a rescheduled game. Update the existing scheduled row's `date` and `time` to preserve its canonical UUID.
5. **Title Game Conventions**: National Championship Title Games must **always** be styled as `College Bowl <Roman Numerals>` (e.g. `College Bowl XXXIX`) with `final_type = 'title'` and `is_title_game = TRUE`.

---

## 2. Pre-Season Setup (October)

Run the pre-season bootstrap to configure the competition year and verify the 27 BUCS phases tree:

```bash
# 1. Verify/create 2026 season record and canonical 27 phases
node scripts/setup_2026_season.mjs

# 2. Ingest initial fixture matrix (when published by BUCS Play)
node scripts/setup_2026_season.mjs --fixtures data/BUAFL/games2026.csv

# 3. Verify database integrity
node scripts/audit_database_integrity.mjs --year 2026 --severity CRITICAL
```

---

## 3. Weekly In-Season Rhythm (November – March)

Games take place primarily on **Sundays** between 12:00 and 15:00 UTC.

### Step 1: Sunday Evening Score Entry (17:00 – 21:00 UTC)
Use the **Gameday Scoreboard** for rapid mobile or desktop score submission:
1. Navigate to [`/admin/gameday`](http://localhost:3000/admin/gameday).
2. Filter by Sunday's date or select a specific Conference / Phase.
3. Type in scores for completed fixtures.
4. For games affected by weather or travel:
   - Click **Postpone** if deferred to a later date.
   - Click **Award Home (1-0)** or **Award Away (0-1)** if a team forfeited.
5. Click **Save All Changes**. The dashboard automatically saves scores and recomputes the division standings.

### Step 2: Monday Morning BUCS Play Sync & Verification (09:00 – 12:00 UTC)
By Monday midday, all university athletic unions must officially confirm results to BUCS:
1. Run the sync tool to preview official BUCS Play results against current DB state:
   ```bash
   node scripts/sync_bucs_weekly.mjs --file data/weekly_feed.csv
   ```
2. Apply confirmed scores and trigger standings recalculation:
   ```bash
   node scripts/sync_bucs_weekly.mjs --file data/weekly_feed.csv --apply --recompute
   ```

### Step 3: Review Community Proposals
1. Check [`/admin/proposals`](http://localhost:3000/admin/proposals) for score submissions, MVP nominations, and coaching confirmations from club media officers and players.
2. Verify citations (e.g. team Instagram / Double Coverage GOTW report) before approving.

---

## 4. Handling Disruptions Cleanly

| Incident | Action in Admin / DB |
| :--- | :--- |
| **Postponed / Frozen Pitch** | In `/admin/gameday`, click **Postpone** (or set `status = 'postponed'`). Once a replay date is confirmed, update the date and set `status = 'scheduled'`. |
| **Home / Away Swap** | If unplayable grass requires moving to the opponent's 4G ground, edit the game record and swap `home_team_id` and `away_team_id`. |
| **Forfeit / Walkover** | Click **Award Home (1-0)** or **Award Away (0-1)**. Note: `"Walkover awarded per BUCS regulations. Conceded by [Team]."` |
| **Cancelled / Void Game** | Click **Cancel / Void** (`status = 'cancelled'`). Standings will completely ignore the match, and the team schedule displays a `CANCELLED` badge. |

---

## 5. Postseason & Championship Phase (February – April)

1. **Lock Regular Season Champions**:
   - Go to [`/admin/champions`](http://localhost:3000/admin/champions) to verify the automatic 1st-place seeds and designate division champions.
2. **Seed Playoff Brackets**:
   - National Championship & National Vase (Premier Playoffs)
   - National Trophy (Division 1 Playoffs)
   - Northern & Southern Conference Cups (Division 2 Playoffs)
3. **National Title Game (`College Bowl XXXIX`)**:
   - Ingest the championship game with `final_type = 'title'`, `title_name = 'College Bowl XXXIX'`, and `is_title_game = TRUE`.

---

## 6. Maintenance & Verification Commands

```bash
# 1. Recompute all divisional standings for the season
node scripts/recompute_standings.mjs --year 2026

# 2. Run the database sanity and integrity audit
node scripts/audit_database_integrity.mjs --year 2026 --severity CRITICAL

# 3. Trigger manual frontend cache invalidation
curl -X POST "https://your-domain.com/api/revalidate?secret=YOUR_SERVICE_KEY&season=2026"
```
