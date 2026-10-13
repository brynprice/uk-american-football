# Project Rules & Conventions for UK Football History

## 1. Data Provenance & Notes Rules
- **NEVER** include internal file paths (e.g. `data/...`, `data/gamesbrighton.csv`, `gamesbrighton.csv`) in the `notes` field or source fields of dataset CSVs or database records.
- For games sourced from internal program archives (e.g. Brighton Tsunami archives), use `"Source: Brighton Tsunami historical records"` (or `"Brighton Tsunami historical records"`).
- **Brighton Historical Records Authority**: If a game, score, date, or standing statistic exists in the Brighton historical records (`data/gamesbrighton.csv`), that is treated as the definitive and correct primary source of truth, taking precedence over BUCS, Sportank, Double Coverage, or any other external sources if they disagree.
- For all other games, record the exact primary public URL (e.g., `https://britball.fandom.com/wiki/...`).

## 2. Canonical Team Naming
- Always map historical team aliases to their canonical database team names (e.g. `Brighton Panthers` -> `Brighton Tsunami`, `Anglia Ruskin Phantoms` / `Anglia Ruskin Rhinos` -> `Anglia Ruskin Siege`, `Royal Holloway Vikings` -> `Royal Holloway Bears`, `Napier Mavericks` -> `Edinburgh Napier Knights`, `GCU Roughriders` -> `Caledonian Roughriders`, `Liverpool Fury` -> `LJMU Fury`).

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

