#!/usr/bin/env python3
"""
UK American Football Archive - Season Dataset Sense-Check Suite

Validates games<year>.csv files against structural, logical, provenance,
and postseason rules.

Usage:
  python3 scripts/sense_check_season.py data/BUAFL/games2008.csv
"""

import sys, os, csv, re

ALIAS_MAP = {
    'Brighton Panthers': 'Brighton Tsunami',
    'Anglia Ruskin Phantoms': 'Anglia Ruskin Rhinos',
    'Royal Holloway Vikings': 'Royal Holloway Bears',
    'Napier Mavericks': 'Edinburgh Napier Knights',
    'GCU Roughriders': 'Caledonian Roughriders',
}

def sense_check_season(csv_path):
    if not os.path.exists(csv_path):
        print(f"Error: File '{csv_path}' not found.")
        sys.exit(1)

    filename = os.path.basename(csv_path)
    print("=" * 65)
    print(f"       SEASON SENSE-CHECK REPORT: {filename}")
    print("=" * 65)

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        games = list(reader)
        fieldnames = reader.fieldnames

    print(f"Total Game Records Examined: {len(games)}")

    issues = []
    warnings = []

    # 1. Mandatory Schema & Non-Null Checks
    required_fields = ['competition', 'year', 'away_team', 'home_team', 'away_score', 'home_score', 'status', 'confidence_level']
    for idx, g in enumerate(games, 1):
        for rf in required_fields:
            if not g.get(rf):
                issues.append(f"Row {idx}: Missing mandatory field '{rf}' for {g.get('away_team')} @ {g.get('home_team')}")

    # 2. Data Provenance & AGENTS.md Rules
    for idx, g in enumerate(games, 1):
        notes = g.get('notes', '')
        if any(p in notes for p in ['data/', '.csv', 'scratch/']):
            issues.append(f"Row {idx}: AGENTS.md Violation - Notes contains internal file path: '{notes}'")
        if not notes:
            warnings.append(f"Row {idx}: Missing provenance citation/notes: {g.get('away_team')} @ {g.get('home_team')}")

    # 3. Canonical Team Naming Checks
    for idx, g in enumerate(games, 1):
        for side in ['away_team', 'home_team']:
            team = g.get(side, '')
            if team in ALIAS_MAP:
                issues.append(f"Row {idx}: Non-canonical team alias '{team}' should be '{ALIAS_MAP[team]}'")

    # 4. Phase & Parent Phase Population Checks
    missing_phases = 0
    missing_parent_phases = 0
    for idx, g in enumerate(games, 1):
        if not g.get('phase'):
            missing_phases += 1
            issues.append(f"Row {idx}: Game missing 'phase': {g.get('away_team')} @ {g.get('home_team')}")
        if not g.get('parent_phase'):
            missing_parent_phases += 1
            issues.append(f"Row {idx}: Game missing 'parent_phase': {g.get('away_team')} @ {g.get('home_team')}")

    # 5. Playoff Logic & Bracket Progression Checks
    playoff_games = [g for g in games if g.get('is_playoff', '').upper() == 'TRUE']
    title_games = [g for g in games if g.get('is_title_game', '').upper() == 'TRUE']

    print(f"Playoff Games Found:       {len(playoff_games)}")
    print(f"Title Games Found:         {len(title_games)}")

    for idx, g in enumerate(games, 1):
        if g.get('is_playoff', '').upper() == 'TRUE':
            if not g.get('playoff_round'):
                issues.append(f"Row {idx}: Playoff game missing 'playoff_round'")
            if g.get('away_score') and g.get('home_score'):
                if int(g['away_score']) == int(g['home_score']):
                    issues.append(f"Row {idx}: Playoff game ended in a tie: {g.get('away_team')} {g.get('away_score')} - {g.get('home_score')} {g.get('home_team')}")

    # Check playoff bracket progression continuity
    if playoff_games:
        teams_playoff_history = {}
        for g in sorted(playoff_games, key=lambda x: x.get('date', '')):
            as_num, hs_num = int(g['away_score']), int(g['home_score'])
            winner = g['away_team'] if as_num > hs_num else g['home_team']
            loser = g['home_team'] if as_num > hs_num else g['away_team']

            if loser not in teams_playoff_history:
                teams_playoff_history[loser] = []
            teams_playoff_history[loser].append(('L', g.get('date'), g.get('playoff_round'), g.get('title_name')))

            if winner not in teams_playoff_history:
                teams_playoff_history[winner] = []
            teams_playoff_history[winner].append(('W', g.get('date'), g.get('playoff_round'), g.get('title_name')))

        for team, hist in teams_playoff_history.items():
            eliminated = False
            for outcome, date, round_name, title in hist:
                if eliminated and outcome == 'W':
                    issues.append(f"Bracket Error: '{team}' won a playoff game ({date} {round_name}) after being eliminated in a previous round!")
                if outcome == 'L':
                    eliminated = True

    # 6. Duplicate Detection
    seen = {}
    for idx, g in enumerate(games, 1):
        teams = tuple(sorted([g.get('away_team', ''), g.get('home_team', '')]))
        key = (teams, g.get('date')) if g.get('date') else (teams, g.get('away_score'), g.get('home_score'))
        if key in seen:
            issues.append(f"Row {idx}: Duplicate game record of Row {seen[key]} ({teams}, date={g.get('date')})")
        else:
            seen[key] = idx

    # 7. Score Sanity & Extremes
    for idx, g in enumerate(games, 1):
        if g.get('away_score') and g.get('home_score'):
            as_num, hs_num = int(g['away_score']), int(g['home_score'])
            if as_num < 0 or hs_num < 0:
                issues.append(f"Row {idx}: Negative score detected: {g.get('away_team')} {as_num} - {hs_num} {g.get('home_team')}")
            if as_num > 100 or hs_num > 100:
                warnings.append(f"Row {idx}: High score (>100): {g.get('away_team')} {as_num} - {hs_num} {g.get('home_team')}")

    # Summary Output
    print("\n" + "-" * 65)
    print(f"CRITICAL ISSUES FOUND: {len(issues)}")
    print(f"WARNINGS FOUND:        {len(warnings)}")
    print("-" * 65)

    if issues:
        print("\n[FAIL] CRITICAL ISSUES DETECTED:")
        for i in issues:
            print(f"  ❌ {i}")
    else:
        print("\n[PASS] ZERO CRITICAL ISSUES DETECTED!")

    if warnings:
        print("\n[WARN] WARNINGS:")
        for w in warnings:
            print(f"  ⚠️  {w}")
    else:
        print("[PASS] ZERO WARNINGS DETECTED!")

    print("=" * 65)
    return len(issues) == 0

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else 'data/BUAFL/games2008.csv'
    sense_check_season(path)
