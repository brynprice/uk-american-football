# Data Import Guide: UK American Football Archive

This guide explains how to use the data import scripts to populate the database with historical teams, seasons, competitions, and game data.

## Prerequisites

Before running any import scripts, you must configure your environment:

1. Install required dependencies:
   ```bash
   npm install csv-parse dotenv @supabase/supabase-js
   ```

2. Configure your `.env.local` file with your **Service Role Key** to bypass Row Level Security (RLS) during the import process:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
   > [!WARNING]
   > The `SUPABASE_SERVICE_ROLE_KEY` grants full database access. **Never commit it to version control.**

## Available Import Scripts

All data import scripts are located in the `scripts/` directory and are executed using Node.js. They process CSV (or JSON for phases) files and insert/update records in the Supabase database.

### 1. Teams Import (`import_teams.mjs`)
Imports team information.
* **Standard File**: `data/teams.csv`
* **Usage**: 
  ```bash
  node scripts/import_teams.mjs data/teams.csv
  ```
* **CSV Columns Required**: `name`
* **Optional Columns**: `location`, `founded_year`, `folded_year`, `notes`, `logo_url`
* **Behavior**: Matches teams by `name`. If found, updates the record; if not, creates a new team.

### 2. Competitions Import (`import_competitions.mjs`)
Imports league/competition data.
* **Standard File**: `data/competitions.csv`
* **Usage**:
  ```bash
  node scripts/import_competitions.mjs data/competitions.csv
  ```
* **CSV Columns Required**: `name`
* **Optional Columns**: `level`, `description`
* **Behavior**: Generates a slug from the name. Matches by `slug`. Updates existing or creates new competitions. Defaults `level` to 'Senior'.

### 3. Seasons Import (`import_seasons.mjs`)
Imports season data linked to specific competitions.
* **Standard File**: `data/seasons.csv`
* **Usage**:
  ```bash
  node scripts/import_seasons.mjs data/seasons.csv
  ```
* **CSV Columns Required**: `competition_name`, `year`
* **Optional Columns**: `season_name`, `start_date`, `end_date`, `confidence_level`
* **Behavior**: Looks up the competition by name/slug. Matches seasons by `competition_id` and `year`. Updates existing or creates new seasons.

### 4. Bulk Load Phases (`bulk-load-phases.js`)
Imports a hierarchical structure of phases (divisions, conferences, playoffs) for a specific season from a JSON file.
* **Standard File**: `scripts/phases.json`
* **Usage**:
  ```bash
  node scripts/bulk-load-phases.js scripts/phases.json --competition="<Competition Name>" --year=<YYYY> [--dry-run]
  ```
* **Format**: JSON array of phase objects with `name`, `type`, and optional nested `children`.
* **Behavior**: Requires the `--competition` and `--year` arguments to properly link the phases to their respective season by looking up the `season_id` in the database. Supports a `--dry-run` flag to test the import without writing to the database. Inserts phases recursively to maintain parent-child relationships.

### 5. Participations Import (`import_participations.mjs`)
Imports season-level team participation and default head coach linking for a given phase in a season.
* **Standard File**: `data/participations.csv`
* **Usage**:
  ```bash
  node scripts/import_participations.mjs data/participations.csv
  ```
* **CSV Columns Required**: `competition_name`, `year`, `team`
* **Optional Columns**: `phase` (defaults to "Regular Season"), `head_coach`
* **Behavior**: **Does not abstract parent entities**. It requires that the Competition, Season, Phase, and Team all exist. If they do not exist, the record is skipped. If `head_coach` is provided but not found in the `people` table, the person record is created. Updates existing participation records or creates new ones.

### 6. Unified Data Import (`import_data.mjs`)
A comprehensive script that imports game results and automatically creates missing related entities (competitions, seasons, phases, teams, venues).
* **Standard File**: `data/games.csv`
* **Usage**:
  ```bash
  node scripts/import_data.mjs data/games.csv
  ```
* **CSV Columns Required**: `competition`, `year`, `home_team`, `away_team`
* **Optional Columns**: `phase`, `date` (YYYY-MM-DD), `date_precision` (day/month/year/unknown), `date_display` (e.g. "Spring 1994"), `time` (HH:MM), `home_score`, `away_score`, `venue`, `notes`, `status` (completed/cancelled/postponed/awarded), `confidence_level` (high/medium/low), `is_playoff` (true/yes/1), `is_double_header` (true/yes/1), `home_coach`, `away_coach`
* **Behavior**: 
  1. Resolves or creates Competition, Season, and Phase.
  2. Resolves or creates Home and Away Teams.
  3. Resolves or creates Coaches and Venues.
  4. Inserts the game record (if it doesn't already exist for that date/phase/teams).
  5. Links head coaches to the specific game in `game_staff` **only if** a season-level participation record does not exist for that team/phase. It will never create a season-level `participations` record itself.

## Recommended Workflow

If you have isolated files for specific entities, import them in logical order from top to bottom (Parents -> Children):

1. `import_competitions.mjs`
2. `import_teams.mjs`
3. `import_seasons.mjs`
4. `bulk-load-phases.js` (if phase hierarchy is complex)
5. `import_participations.mjs` (to record season-level teams & coaches)
6. `import_data.mjs` (for games)

Alternatively, if you only have a flat spreadsheet of games, running `import_data.mjs` will do its best to automatically scaffold the required parent entities (competitions, seasons, phases, teams) on the fly, but it will no longer auto-enroll teams into the standings via `participations`. You must still use `import_participations.mjs` to establish team standings baselines.

## 4. Awards Import (`import_awards.mjs`)

This script bulk loads Hall of Fame inductions and Retired Jersey honors. 
*   **Command**: `node scripts/import_awards.mjs ./path/to/awards.csv`
*   **Behavior**: It looks up the team, finds or creates the honored person, and inserts either a `hall_of_fame` or `retired_jerseys` record based on the `award_type`. It skips exact duplicates.

### CSV Format Requirements
*   `award_type`: (Required) Must be exactly `hall_of_fame` or `retired_jersey`.
*   `team`: (Required) Name of the team.
*   `honoured_person`: (Required) Full name of the inducted/honored individual.
*   `year`: (Required) Year of the induction or jersey retirement.
*   `jersey_number`: (Required for `retired_jersey` only) The jersey number being retired.
*   `seasons_with_team`: (Optional, for HOF) String describing their tenure, e.g., "1988-1995"
*   `notes`: (Optional) Any additional context.

## 5. Season Phase Copy Utility (`copy_season_phases.mjs`)

Use this script to duplicate the phase structure (Divisions, Conferences, etc.) from one season to another. Highly useful if the league structure hasn't changed year-to-year.

*   **Command**: `node scripts/copy_season_phases.mjs "<Comp Name>" <Source Year> <Target Year>`
*   **Example**: `node scripts/copy_season_phases.mjs "BUAFL" 2024 2023`
*   **Behavior**: It recursively recreates the phase hierarchy for the target year.
*   **Safety**: It will skip execution if the target season already has phases (use `--force` to override).
