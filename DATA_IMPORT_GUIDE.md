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

## Global Flags

The following flags can be used with all import scripts:

- `--sample`: Any data created or updated during the import will be automatically tagged with a "sample" note in the database (`content: 'sample'`). Use this for test data or demonstration files to keep them distinct from real historical records.

## Available Import Scripts

All data import scripts are located in the `scripts/` directory and are executed using Node.js. They process CSV (or JSON for phases) files and insert/update records in the Supabase database.

### 1. Teams Import (`import_teams.mjs`)
Imports team information.
* **Standard File**: `data/teams.csv`
* **Usage**: 
  ```bash
  node scripts/import_teams.mjs data/teams.csv [--sample]
  ```
* **CSV Columns Required**: `name`
* **Optional Columns**: `location`, `founded_year`, `folded_year`, `notes`, `logo_url`
* **Behavior**: Matches teams by `name`. If found, updates the record; if not, creates a new team.

### 2. Competitions Import (`import_competitions.mjs`)
Imports league/competition data.
* **Standard File**: `data/competitions.csv`
* **Usage**:
  ```bash
  node scripts/import_competitions.mjs data/competitions.csv [--sample]
  ```
* **CSV Columns Required**: `name`
* **Optional Columns**: `level`, `description`
* **Behavior**: Generates a slug from the name. Matches by `slug`. Updates existing or creates new competitions. Defaults `level` to 'Senior'.

### 3. Seasons Import (`import_seasons.mjs`)
Imports season data linked to specific competitions.
* **Standard File**: `data/seasons.csv`
* **Usage**:
  ```bash
  node scripts/import_seasons.mjs data/seasons.csv [--sample]
  ```
* **CSV Columns Required**: `competition_name`, `year`
* **Optional Columns**: `season_name`, `start_date`, `end_date`, `confidence_level`, `expected_participants` (used for completeness scoring calculation)
* **Behavior**: Looks up the competition by name/slug. Matches seasons by `competition_id` and `year`. Updates existing or creates new seasons.

### 4. Phase Import (`import_phases.mjs`)
Imports a hierarchical structure of phases (divisions, conferences, playoffs) for a specific season from a CSV file.
* **Standard File**: `data/phases.csv`
* **Usage**:
  ```bash
  node scripts/import_phases.mjs data/phases.csv [--dry-run] [--sample]
  ```
* **CSV Columns**: `competition_name, year, phase_name, type, parent_phase, confidence_level, ordinal`
* **Behavior**: Requires the parent phase (if any) to be defined *above* the child phase in the same CSV file if you want them linked in a single run. Matches seasons by competition name/slug and year.
* **Example CSV**:
  ```csv
  competition_name,year,phase_name,type,parent_phase,ordinal
  BUAFL,2025,"Division 1",division,,1
  BUAFL,2025,"South Eastern",conference,"Division 1",1
  BUAFL,2025,"Group A",group,"South Eastern",1
  ```

### 5. Participations Import (`import_participations.mjs`)
Imports season-level team participation and default head coach linking for a given phase in a season.
* **Standard File**: `data/participations.csv`
* **Usage**:
  ```bash
  node scripts/import_participations.mjs data/participations.csv [--sample]
  ```
* **CSV Columns Required**: `competition_name`, `year`, `team`
* **Optional Columns**: `phase` (defaults to "Regular Season"), `head_coach`
* **Behavior**: **Does not abstract parent entities**. It requires that the Competition, Season, Phase, and Team all exist. If they do not exist, the record is skipped. If `head_coach` is provided but not found in the `people` table, the person record is created. Updates existing participation records or creates new ones.

### 6. Unified Data Import (`import_data.mjs`)
A comprehensive script that imports game results and automatically creates missing related entities (competitions, seasons, phases, teams, venues).
* **Standard File**: `data/games.csv`
* **Usage**:
  ```bash
  node scripts/import_data.mjs data/games.csv [--sample]
  ```
* **CSV Columns Required**: `competition`, `year`, `home_team`, `away_team`
* **Optional Columns**: `phase`, `parent_phase`, `date` (YYYY-MM-DD), `date_precision` (day/month/year/unknown), `date_display` (e.g. "Spring 1994"), `time` (HH:MM), `home_score`, `away_score`, `venue`, `notes`, `status` (completed/cancelled/postponed/awarded), `confidence_level` (high/medium/low), `is_playoff` (true/yes/1), `playoff_round` (e.g. "Quarter-Final"), `final_type` (title/bowl), `title_name` (e.g. "National Trophy"), `is_double_header` (true/yes/1), `home_coach`, `away_coach`
* **Behavior**: 
  1. Resolves or creates Competition, Season, and Phase (uses `parent_phase` to disambiguate identical phase names).
  2. Resolves or creates Home and Away Teams.
  3. Resolves or creates Coaches and Venues.
  4. **Upsert Behavior**: Matches games by `phase_id`, `home_team_id`, `away_team_id`, and `date`. 
     - If the game **does not exist**, it inserts a new record. 
     - If it **already exists**, it updates the existing record with the latest scores, venue, notes, status, and flags from the CSV.
  5. Links head coaches to the specific game in `game_staff` **only if** a season-level participation record does not exist for that team/phase. It will never create a season-level `participations` record itself.

### 7. Standings Import (`import_standings.mjs`)
Imports aggregate win/loss/points records for teams in a specific phase. Use this for historical seasons where individual game scores are missing.
* **Usage**:
  ```bash
  node scripts/import_standings.mjs data/standings.csv [--sample]
  ```
* **CSV Columns Required**: `competition_name`, `year`, `team`, `wins`, `losses`, `ties`, `points_for`, `points_against`
* **Optional Columns**: `phase` (defaults to "Regular Season"), `parent_phase` (used to disambiguate identical phase names)
* **Behavior**: Matches the team and phase in the `participations` table and updates the stats columns. If a participation record does not exist for the team in that phase, it will be automatically created.

## Recommended Workflow

If you have isolated files for specific entities, import them in logical order from top to bottom (Parents -> Children):

1. `import_competitions.mjs`
2. `import_teams.mjs`
3. `import_seasons.mjs`
4. `bulk-load-phases.js` (if phase hierarchy is complex)
5. `import_participations.mjs` (to record season-level teams & coaches)
6. `import_data.mjs` (for games)

Alternatively, if you only have a flat spreadsheet of games, running `import_data.mjs` will do its best to automatically scaffold the required parent entities (competitions, seasons, phases, teams) on the fly, but it will no longer auto-enroll teams into the standings via `participations`. You must still use `import_participations.mjs` to establish team standings baselines.

### 8. Awards Import (`import_awards.mjs`)

This script bulk loads Hall of Fame inductions and Retired Jersey honors. 
*   **Command**: `node scripts/import_awards.mjs ./path/to/awards.csv [--sample]`
*   **Behavior**: It looks up the team, finds or creates the honored person, and inserts either a `hall_of_fame` or `retired_jerseys` record based on the `award_type`. It skips exact duplicates.

* **Usage**:
  ```bash
  node scripts/import_awards.mjs data/awards.csv
  ```

### CSV Format Requirements
*   `award_type`: (Required) Must be exactly `hall_of_fame` or `retired_jersey`.
*   `team`: (Required) Name of the team.
*   `honoured_person`: (Required) Full name of the inducted/honored individual.
*   `year`: (Required) Year of the induction or jersey retirement.
*   `jersey_number`: (Required for `retired_jersey` only) The jersey number being retired.
*   `seasons_with_team`: (Optional, for HOF) String describing their tenure, e.g., "1988-1995"
*   `notes`: (Optional) Any additional context.

### 9. Season Phase Copy Utility (`copy_season_phases.mjs`)

Use this script to duplicate the phase structure (Divisions, Conferences, etc.) from one season to another. Highly useful if the league structure hasn't changed year-to-year.

*   **Command**: `node scripts/copy_season_phases.mjs "<Comp Name>" <Source Year> <Target Year>`
*   **Example**: `node scripts/copy_season_phases.mjs "BUAFL" 2024 2023`
*   **Behavior**: It recursively recreates the phase hierarchy for the target year.
*   **Safety**: It will skip execution if the target season already has phases (use `--force` to override).

## Data Utilities

### 10. Data Export (`export_data.mjs`)

Extracts historical game data from the database into a CSV file. The generated CSV exactly matches the structure and headers expected by the `import_data.mjs` script, making it perfect for backing up data or migrating environments.

*   **Command**: `node scripts/export_data.mjs [outputFile.csv]`
*   **Behavior**: It connects to Supabase, pulls down all games, matches them with their underlying competition, season, phase, teams, venues, and coaches (resolving both game-level overrides and season level fallbacks), and formats them safely into a CSV string. If no output file is provided, it returns a file named `exported_games.csv` in the current directory.

### 11. Custom Format Transformers (`transform_bucs.mjs`)

Often, historical data comes in unstructured formats (e.g., single-column Excel dumps from BUCS Play). Rather than creating a complex "universal importer", the recommended approach is to build throw-away scripts that parse the specific messy format and output a clean CSV that matches the 24 standard columns required by `import_data.mjs`.

*   **Example Script**: `node scripts/transform_bucs.mjs data/bucs_data.xlsx [outputFile.csv]`
*   **Behavior**:
    1. Reads an unstructured Excel file containing repeating chunks of unstructured game data.
    2. Identifies blocks corresponding to games (parsing phases, teams, scores, dates, venues, etc.).
    3. Truncates venues to the first comma and explicitly tags the competition as "BUAFL".
    4. Automatically maps team and phase names using `data/mappings/bucs_teams.json` and `bucs_phases.json`. If a team or phase is missing from the JSON, it will add it to the file with an empty string (`""`) value and log a warning so you can easily fill it in.
    5. Outputs a perfectly formatted standard CSV ready to be ingested by `import_data.mjs`.

### 12. Data Completeness Score (`calculate_completeness.mjs`)

The Archive features a dynamic Data Completeness Score (0-100%) for each season to indicate the depth and quality of the historical records available.

*   **Command**: `node scripts/calculate_completeness.mjs [season_id]`
*   **Behavior**: If run without arguments, it recalculates the score for *all* seasons in the database. If a specific UUID is provided, it only calculates for that season.

#### How the Score is Calculated
The 100-point score is weighted across four categories:
1.  **Structure (20 pts):**
    *   *Phases (10 pts):* Are there defined phases/divisions for the season?
    *   *Participations (10 pts):* Are teams actually enrolled in those phases?
2.  **Game Presence (30 pts):**
    *   *Has Games (30 pts):* Are there individual game logs recorded?
    *   *Standings Only (15 pts):* If there are no games, but we have final manual standings imported, the season gets partial credit here.
3.  **Game Quality (30 pts):** (Proportional based on the % of games with this data)
    *   *Scores (15 pts):* Do the games have both home and away scores?
    *   *Dates (10 pts):* Do the games have exact calendar dates (not just the year)?
    *   *Venues (5 pts):* Are venues logged for the games?
4.  **Context & Personnel (20 pts):**
    *   *Coaches (15 pts):* Percentage of participating teams that have a head coach assigned.
    *   *Title Game (5 pts):* Is there at least one game marked as a `title_game` for the season?
