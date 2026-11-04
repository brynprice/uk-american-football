# Project Rules & Conventions for UK Football History

## 1. Data Provenance & Notes Rules
- **NEVER** include internal file paths (e.g. `data/...`, `data/gamesbrighton.csv`, `gamesbrighton.csv`) in the `notes` field or source fields of dataset CSVs or database records.
- For games sourced from internal program archives (e.g. Brighton Tsunami archives), use `"Source: Brighton Tsunami historical records"` (or `"Brighton Tsunami historical records"`).
- **Brighton Historical Records Authority**: If a game, score, date, or standing statistic exists in the Brighton historical records (`data/gamesbrighton.csv`), that is treated as the definitive and correct primary source of truth, taking precedence over BUCS, Sportank, Double Coverage, or any other external sources if they disagree.
- For all other games, record the exact primary public URL (e.g., `https://britball.fandom.com/wiki/...`).

## 2. Canonical Team Naming
- Always map historical team aliases to their canonical database team names (e.g. `Brighton Panthers` -> `Brighton Tsunami`, `Anglia Ruskin Phantoms` / `Anglia Ruskin Rhinos` -> `Anglia Ruskin Siege`, `Royal Holloway Vikings` -> `Royal Holloway Bears`, `Napier Mavericks` -> `Edinburgh Napier Knights`, `GCU Roughriders` -> `Caledonian Roughriders`, `Liverpool Fury` -> `LJMU Fury`, `Aberdeen Bulls` -> `Aberdeen Roughnecks University Team`).

## 3. Title Game & Postseason Conventions
- National Championship Title Games must **always** be styled as `College Bowl <Roman Numerals>` (e.g. `College Bowl XXII`, `College Bowl XXIII`) with `final_type = 'title'` and `is_title_game = TRUE`.
- Secondary bowl / trophy finals (e.g. Challenge Trophy) must have `final_type = 'bowl'` and `is_title_game = TRUE`.

## 4. Completed Pre-1992 Divisional/Conference Champions Review (1985–1991)
- All seasons 1985–1991 have been thoroughly reviewed against contemporary Britball Wiki and Wikipedia archives, standardized in `standings1985.csv` through `standings1991.csv` to the canonical 16-column schema with `is_champion`, and synced to Supabase `participations`.

## 5. Strict Data Integrity & Verification Principles
- **NEVER invent, assume, or extrapolate data**: Do not carry over head coaches, personnel, game scores, or dates from adjacent seasons based on assumptions.
- If a head coach, venue, score, or exact date cannot be confirmed via primary or contemporary sources (e.g. Britball Wiki, contemporary news coverage, official league documents), leave the field blank/empty (`null` in DB).
- When fixture dates are unconfirmed or defaulted by league administrative systems (e.g., BUCS end-of-term deadline dates like `11/04/2012`), set `date` to empty with `date_precision = 'season'` rather than recording placeholder dates as factual match days.

## 6. Strict Evidence-Based Personnel & Fact Protocol
- **Default-to-Null Rule**: Every sensitive field (`head_coach`, `venue`, `mvp`, exact score/date) defaults to empty/null. It is strictly forbidden to populate a head coach without verified contemporary evidence specifically dated to that season.
- **Evidence Registry**: All verified head coaches must be registered in `data/evidence/verified_coaches.json` with team name, season year, coach name, and exact primary source citation.
- **Mandatory Evidence Table in Plans**: Every season implementation plan must include an explicit Evidence Table listing the proposed non-null personnel, the primary source URL or document, the source date, and direct citation.
- **Ban on Hardcoded Dictionaries**: Never create ad-hoc hardcoded personnel maps (e.g. `const headCoaches = { ... }`) in rebuild scripts unless they are validated against `data/evidence/verified_coaches.json`.
- **Sense-Check Enforcement**: `scripts/sense_check_season.py` strictly validates that every non-empty `head_coach` has a corresponding verified record in `data/evidence/verified_coaches.json`. Any unverified coach fails the check as a CRITICAL error.

## 7. Weekly Interesting Facts Protocol
- When asked "what is interesting about the past week", "what happened in the past week", or requested for weekly highlights or trivia:
  - Run `node scripts/weekly_facts.mjs` (or `npm run facts`), optionally with `--week <N>`, `--season <YYYY>`, `--start <YYYY-MM-DD> --end <YYYY-MM-DD>`, or `--format brief|markdown|json`.
  - The script deterministically cross-references all completed fixtures against the 40+ year historical archive in Supabase to surface:
    - **Scorigamis**: All-time totally unique scores (across 40+ years) and level-specific unique scores.
    - **Program Records & Milestones**: Top scoring performances in program history, heaviest defeats, milestone wins (25th, 50th, 75th, etc.).
    - **Rivalry Context**: Inaugural matchups, multi-year hiatuses, revenge wins, and head-to-head win streaks.
    - **Extremes**: Shootouts, defensive slugfests, blowouts, and nailbiters (≤ 7 pts).
    - **The Shutout Wall**: Clean sheets pitched and consecutive shutout streaks.
    - **Standings Momentum**: Unblemished 2-0 starts, 0-2 struggles, and bounce-back wins.
    - **Brighton Tsunami / Panthers Spotlight**: Performance and historical series context for Brighton.
  - Present the output with engaging, journalistic sports flair while strictly adhering to the facts extracted from the database.

## 8. Weekly Upcoming Slate Preview Protocol
- When asked "what's coming up this week", "preview the upcoming week", "what games should I watch", or requested for upcoming week highlights, predictions, or matchup previews:
  - Run `node scripts/weekly_preview.mjs` (or `npm run preview`), optionally with `--week <N>`, `--season <YYYY>`, `--start <YYYY-MM-DD> --end <YYYY-MM-DD>`, `--pdf`, or `--format brief|markdown|json`.
  - The script deterministically cross-references all scheduled fixtures against the 40+ year historical archive and stored model predictions in Supabase to surface:
    - **Marquee Matchups & Clash of Unbeatens**: Top fixtures between undefeated squads, division title implications, and high-stakes showdowns.
    - **Inaugural Encounters**: First-ever meetings in 40+ years between programs.
    - **Multi-Year Hiatus Breakers**: First time programs are clashing in 4+ seasons.
    - **Series Dominance & Revenge Opportunities**: Teams looking to snap multi-game losing streaks against opponents.
    - **Form & Defense Watch**: Teams defending clean sheet streaks (e.g. Shutout Wall) and winless 0-2 desperation bowls.
    - **Model Score Predictions**: Win probabilities, projected scores, and spreads.
    - **Brighton Tsunami / Panthers Spotlight**: Historical matchup context, all-time record, and model projections for Brighton's upcoming fixture.
  - Present the preview with crisp, engaging journalistic sports flair while strictly adhering to the facts and model lines extracted from the database.


