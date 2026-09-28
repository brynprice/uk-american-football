# Project Rules & Conventions for UK Football History

## 1. Data Provenance & Notes Rules
- **NEVER** include internal file paths (e.g. `data/...`, `data/gamesbrighton.csv`, `gamesbrighton.csv`) in the `notes` field or source fields of dataset CSVs or database records.
- For games sourced from internal program archives (e.g. Brighton Tsunami archives), use `"Source: Brighton Tsunami historical records"` (or `"Brighton Tsunami historical records"`).
- For all other games, record the exact primary public URL (e.g., `https://britball.fandom.com/wiki/...`).

## 2. Canonical Team Naming
- Always map historical team aliases to their canonical database team names (e.g. `Brighton Panthers` -> `Brighton Tsunami`, `Anglia Ruskin Phantoms` -> `Anglia Ruskin Rhinos`, `Royal Holloway Vikings` -> `Royal Holloway Bears`, `Napier Mavericks` -> `Edinburgh Napier Knights`, `GCU Roughriders` -> `Caledonian Roughriders`).
