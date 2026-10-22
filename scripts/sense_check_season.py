#!/usr/bin/env python3
"""
UK American Football Archive - Season Dataset Sense-Check Suite

Validates games<year>.csv files against structural, logical, provenance,
and postseason rules.

Usage:
  python3 scripts/sense_check_season.py data/BUAFL/games2008.csv
"""

import sys, os, csv, re
from datetime import datetime

ALIAS_MAP = {
    'Brighton Panthers': 'Brighton Tsunami',
    'Anglia Ruskin Phantoms': 'Anglia Ruskin Siege',
    'Anglia Ruskin Rhinos': 'Anglia Ruskin Siege',
    'Royal Holloway Vikings': 'Royal Holloway Bears',
    'Napier Mavericks': 'Edinburgh Napier Knights',
    'GCU Roughriders': 'Caledonian Roughriders',
    'Bristol Bullets': 'Bristol Barracuda',
    'Aberdeen Bulls': 'Aberdeen Roughnecks University Team',
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

    first_comp = (games[0].get('competition') or '').strip().upper() if games else ''
    is_adult_contact = 'BAFA' in first_comp or 'ADULT' in first_comp or 'data/BAFANL' in csv_path.replace('\\', '/')

    # 1. Mandatory Schema & Non-Null Checks
    required_fields = ['competition', 'year', 'away_team', 'home_team', 'status', 'confidence_level']
    for idx, g in enumerate(games, 1):
        for rf in required_fields:
            if not g.get(rf):
                issues.append(f"Row {idx}: Missing mandatory field '{rf}' for {g.get('away_team')} @ {g.get('home_team')}")
        if g.get('status') not in ('cancelled', 'abandoned', 'postponed'):
            for rf in ['away_score', 'home_score']:
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

    # 3b. Team Type vs Competition Level Classification Checks
    teams_csv_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'teams.csv')
    team_type_map = {}
    if os.path.exists(teams_csv_path):
        with open(teams_csv_path, 'r', encoding='utf-8') as tf:
            for trow in csv.DictReader(tf):
                tname = trow.get('name', '').strip()
                ttype = trow.get('team_type', '').strip()
                if tname and ttype:
                    team_type_map[tname] = ttype

    norm_path = csv_path.replace('\\', '/')
    if any(kw in first_comp for kw in ['BAFA', 'ADULT', 'SENIOR']) or 'data/BAFANL' in norm_path or 'data/Seniors' in norm_path:
        expected_team_type = 'Adult'
    elif any(kw in first_comp for kw in ['BUAFL', 'BCAFL', 'BUCS', 'COLLEGIATE', 'UNIVERSIT']) or 'data/BUAFL' in norm_path:
        expected_team_type = 'University'
    elif any(kw in first_comp for kw in ['NWFL', 'WAFN', 'WOMEN']) or 'data/Womens' in norm_path:
        expected_team_type = 'Womens'
    elif any(kw in first_comp for kw in ['FLAG']) or 'data/Flag' in norm_path:
        expected_team_type = 'Flag'
    elif any(kw in first_comp for kw in ['U19', 'YOUTH']) or 'data/U19' in norm_path:
        expected_team_type = 'U19s'
    else:
        expected_team_type = None

    if expected_team_type and team_type_map:
        for idx, g in enumerate(games, 1):
            for side in ['away_team', 'home_team']:
                raw_team = (g.get(side) or '').strip()
                canonical_team = ALIAS_MAP.get(raw_team, raw_team)
                if canonical_team in team_type_map:
                    act_type = team_type_map[canonical_team]
                    if act_type != expected_team_type:
                        hint = ""
                        if canonical_team == 'Glasgow Tigers' and expected_team_type == 'University':
                            hint = " Did you mean 'Glasgow University Tigers'?"
                        elif canonical_team == 'Glasgow University Tigers' and expected_team_type == 'Adult':
                            hint = " Did you mean 'Glasgow Tigers'?"
                        elif canonical_team == 'Aberdeen Roughnecks' and expected_team_type == 'University':
                            hint = " Did you mean 'Aberdeen Roughnecks University Team'?"
                        elif canonical_team == 'Aberdeen Roughnecks University Team' and expected_team_type == 'Adult':
                            hint = " Did you mean 'Aberdeen Roughnecks'?"
                        issues.append(
                            f"Row {idx}: Team Type Mismatch - '{canonical_team}' is classified as a '{act_type}' team, "
                            f"but this file is for a '{expected_team_type}' competition ({first_comp or norm_path})!{hint}"
                        )

    # 4. Phase & Parent Phase Population Checks
    # Look up whether phases in this season have parent phases defined
    phases_with_parents = set()
    year_match = re.search(r'games(\d{4})\.csv', filename)
    if year_match:
        season_year = year_match.group(1)
        dir_name = os.path.dirname(csv_path)
        phases_path = os.path.join(dir_name, f"phases{season_year}.csv")
        if os.path.exists(phases_path):
            with open(phases_path, 'r', encoding='utf-8') as pf:
                for prow in csv.DictReader(pf):
                    if (prow.get('parent_phase') or '').strip():
                        phases_with_parents.add((prow.get('phase_name') or prow.get('phase') or '').strip())

    missing_phases = 0
    missing_parent_phases = 0
    for idx, g in enumerate(games, 1):
        phase = (g.get('phase') or '').strip()
        parent_phase = (g.get('parent_phase') or '').strip()
        if not phase:
            missing_phases += 1
            issues.append(f"Row {idx}: Game missing 'phase': {g.get('away_team')} @ {g.get('home_team')}")
        elif phase in phases_with_parents and not parent_phase:
            missing_parent_phases += 1
            issues.append(f"Row {idx}: Game in child phase '{phase}' missing 'parent_phase': {g.get('away_team')} @ {g.get('home_team')}")

    # 4b. Inter-Phase / Conference Verification (cross-referenced with standings<year>.csv)
    year_match = re.search(r'games(\d{4})\.csv', filename)
    if year_match:
        season_year = year_match.group(1)
        dir_name = os.path.dirname(csv_path)
        standings_path = os.path.join(dir_name, f"standings{season_year}.csv")
        if os.path.exists(standings_path):
            team_phase_map = {}
            with open(standings_path, 'r', encoding='utf-8') as sf:
                for srow in csv.DictReader(sf):
                    t = srow.get('team', '').strip()
                    # Resolve aliases in standings just in case
                    canonical_t = ALIAS_MAP.get(t, t)
                    p = (srow.get('phase') or srow.get('phase_name') or '').strip()
                    pp = (srow.get('parent_phase') or '').strip()
                    if canonical_t and p:
                        team_phase_map[canonical_t] = {'phase': p, 'parent_phase': pp}

            for idx, g in enumerate(games, 1):
                if g.get('is_playoff', '').upper() == 'TRUE':
                    continue
                a_team = ALIAS_MAP.get(g.get('away_team', '').strip(), g.get('away_team', '').strip())
                h_team = ALIAS_MAP.get(g.get('home_team', '').strip(), g.get('home_team', '').strip())
                game_phase = g.get('phase', '').strip()
                away_phase = g.get('away_phase', '').strip()

                if a_team in team_phase_map:
                    expected_away_phase = team_phase_map[a_team]['phase']
                    if expected_away_phase and game_phase and expected_away_phase != game_phase:
                        if not away_phase:
                            issues.append(
                                f"Row {idx}: Inter-phase game error: '{a_team}' belongs to '{expected_away_phase}' (per standings) "
                                f"but played @ '{h_team}' in phase '{game_phase}' without 'away_phase' set!"
                            )
                        elif away_phase != expected_away_phase:
                            issues.append(
                                f"Row {idx}: Inter-phase phase mismatch: '{a_team}' has 'away_phase'='{away_phase}', "
                                f"but belongs to '{expected_away_phase}' according to standings!"
                            )

                if h_team in team_phase_map:
                    expected_home_phase = team_phase_map[h_team]['phase']
                    if expected_home_phase and game_phase and expected_home_phase != game_phase:
                        issues.append(
                            f"Row {idx}: Host team phase mismatch: Host '{h_team}' belongs to '{expected_home_phase}' "
                            f"(per standings) but game phase is '{game_phase}'!"
                        )

    # 4c. Strict Head Coach Verification (AGENTS.md Rule 6)
    # Load verified coaches registry
    verified_coaches = set()
    evidence_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'evidence', 'verified_coaches.json')
    if os.path.exists(evidence_path):
        import json
        with open(evidence_path, 'r', encoding='utf-8') as ef:
            for c in json.load(ef):
                verified_coaches.add((c.get('team', '').strip(), int(c.get('year', 0)), c.get('head_coach', '').strip()))

    for idx, g in enumerate(games, 1):
        g_year = int(g.get('year') or 0)
        ac = (g.get('away_coach') or '').strip()
        hc = (g.get('home_coach') or '').strip()
        a_team = ALIAS_MAP.get(g.get('away_team', '').strip(), g.get('away_team', '').strip())
        h_team = ALIAS_MAP.get(g.get('home_team', '').strip(), g.get('home_team', '').strip())

        if ac and (a_team, g_year, ac) not in verified_coaches:
            issues.append(
                f"Row {idx}: Unverified away head coach '{ac}' for '{a_team}' ({g_year}). "
                f"Violates AGENTS.md Rule 6 (no evidence in data/evidence/verified_coaches.json)."
            )
        if hc and (h_team, g_year, hc) not in verified_coaches:
            issues.append(
                f"Row {idx}: Unverified home head coach '{hc}' for '{h_team}' ({g_year}). "
                f"Violates AGENTS.md Rule 6 (no evidence in data/evidence/verified_coaches.json)."
            )

    # Check standings head coaches and team types if standings file exists
    if year_match and os.path.exists(standings_path):
        s_year = int(season_year)
        with open(standings_path, 'r', encoding='utf-8') as sf:
            for s_idx, srow in enumerate(csv.DictReader(sf), 1):
                coach = (srow.get('head_coach') or '').strip()
                t = srow.get('team', '').strip()
                canonical_t = ALIAS_MAP.get(t, t)
                if coach and (canonical_t, s_year, coach) not in verified_coaches:
                    issues.append(
                        f"Standings Row {s_idx}: Unverified head coach '{coach}' for '{canonical_t}' ({s_year}). "
                        f"Violates AGENTS.md Rule 6 (no evidence in data/evidence/verified_coaches.json)."
                    )
                if expected_team_type and team_type_map and canonical_t in team_type_map:
                    act_type = team_type_map[canonical_t]
                    if act_type != expected_team_type:
                        hint = ""
                        if canonical_t == 'Glasgow Tigers' and expected_team_type == 'University':
                            hint = " Did you mean 'Glasgow University Tigers'?"
                        elif canonical_t == 'Glasgow University Tigers' and expected_team_type == 'Adult':
                            hint = " Did you mean 'Glasgow Tigers'?"
                        elif canonical_t == 'Aberdeen Roughnecks' and expected_team_type == 'University':
                            hint = " Did you mean 'Aberdeen Roughnecks University Team'?"
                        elif canonical_t == 'Aberdeen Roughnecks University Team' and expected_team_type == 'Adult':
                            hint = " Did you mean 'Aberdeen Roughnecks'?"
                        issues.append(
                            f"Standings Row {s_idx}: Team Type Mismatch - '{canonical_t}' is classified as a '{act_type}' team, "
                            f"but this file is for a '{expected_team_type}' competition!{hint}"
                        )

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
                    notes = g.get('notes', '')
                    if not any(kw in notes.lower() for kw in ['advanced', 'overtime', 'tie', 'progressed', 'seed']):
                        issues.append(f"Row {idx}: Playoff game ended in a tie without advancement explanation in notes: {g.get('away_team')} {g.get('away_score')} - {g.get('home_score')} {g.get('home_team')}")

        # Title game canonical styling check
        is_title = g.get('is_title_game', '').upper() == 'TRUE'
        final_type = (g.get('final_type') or '').lower().strip()
        title_name = (g.get('title_name') or '').strip()

        if is_adult_contact:
            if final_type == 'title' or (is_title and 'britbowl' in title_name.lower()):
                if not re.match(r'^Britbowl [IVXLCDM]+$', title_name):
                    issues.append(
                        f"Row {idx}: Invalid Adult National Championship Title Game name '{title_name}'. "
                        f"Must be canonically styled as 'Britbowl <Roman Numerals>' (e.g. 'Britbowl XXXVIII')."
                    )
        else:
            if final_type == 'title' or (is_title and ('college bowl' in title_name.lower() or 'national championship' in title_name.lower() or 'buafl' in title_name.lower() or 'bcafl' in title_name.lower())):
                if not re.match(r'^College Bowl [IVXLCDM]+$', title_name):
                    issues.append(
                        f"Row {idx}: Invalid National Championship Title Game name '{title_name}'. "
                        f"Must be canonically styled as 'College Bowl <Roman Numerals>' (e.g. 'College Bowl XXIII')."
                    )

    # Check playoff bracket progression continuity
    if playoff_games:
        teams_playoff_history = {}
        for g in sorted(playoff_games, key=lambda x: x.get('date', '')):
            if g.get('status') == 'cancelled':
                continue
            as_num, hs_num = int(g['away_score']), int(g['home_score'])
            notes = g.get('notes', '')
            if as_num > hs_num:
                winner, loser = g['away_team'], g['home_team']
            elif hs_num > as_num:
                winner, loser = g['home_team'], g['away_team']
            else:
                # Tied game: check notes for advancement
                if f"{g['away_team']} advanced" in notes or f"{g['away_team']} progressed" in notes:
                    winner, loser = g['away_team'], g['home_team']
                elif f"{g['home_team']} advanced" in notes or f"{g['home_team']} progressed" in notes:
                    winner, loser = g['home_team'], g['away_team']
                else:
                    winner, loser = None, None

            if loser:
                if loser not in teams_playoff_history:
                    teams_playoff_history[loser] = []
                teams_playoff_history[loser].append(('L', g.get('date'), g.get('playoff_round'), g.get('title_name')))

            if winner:
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
        if g.get('is_double_header', '').upper() == 'TRUE':
            continue
        teams = tuple(sorted([g.get('away_team', ''), g.get('home_team', '')]))
        key = (teams, g.get('date')) if g.get('date') else (teams, g.get('away_score'), g.get('home_score'))
        if key in seen:
            issues.append(f"Row {idx}: Duplicate game record of Row {seen[key]} ({teams}, date={g.get('date')})")
        else:
            seen[key] = idx

    # 7. Score Sanity & Extremes
    for idx, g in enumerate(games, 1):
        if g.get('away_score') and g.get('home_score'):
            try:
                as_num, hs_num = int(g['away_score']), int(g['home_score'])
            except ValueError:
                issues.append(f"Row {idx}: Non-integer score detected: away='{g.get('away_score')}', home='{g.get('home_score')}'")
                continue
            if as_num < 0 or hs_num < 0:
                issues.append(f"Row {idx}: Negative score detected: {g.get('away_team')} {as_num} - {hs_num} {g.get('home_team')}")
            if as_num > 100 or hs_num > 100:
                warnings.append(f"Row {idx}: High score (>100): {g.get('away_team')} {as_num} - {hs_num} {g.get('home_team')}")

    # 8. Date & Month Sanity Checks
    month_names = {1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June', 7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December'}
    for idx, g in enumerate(games, 1):
        d_str = (g.get('date') or '').strip()
        if not d_str:
            continue
        try:
            dt = datetime.strptime(d_str, '%Y-%m-%d')
        except ValueError:
            issues.append(f"Row {idx}: Malformed date string '{d_str}' (expected YYYY-MM-DD)")
            continue

        month = dt.month
        is_playoff = g.get('is_playoff', '').upper() == 'TRUE'

        if is_adult_contact:
            # Adult contact season: April to September (October permitted for 2021 COVID delayed season)
            allowed_months = (4, 5, 6, 7, 8, 9, 10) if season_year == '2021' else (4, 5, 6, 7, 8, 9)
            if month not in allowed_months:
                issues.append(
                    f"Row {idx}: Invalid adult contact game month ({month_names[month]} / {d_str}). "
                    f"Adult contact games must be played between April and September."
                )
        else:
            # University football: October to April
            # Rule 1: No regular games in May, and no games in June, July, August, or September (Critical)
            if month in (6, 7, 8, 9) or (month == 5 and not is_playoff):
                issues.append(
                    f"Row {idx}: Invalid game month ({month_names[month]} / {d_str}). "
                    f"Games should not be played in May, June, July, August, or September."
                )
            elif month == 5 and is_playoff:
                warnings.append(
                    f"Row {idx}: Playoff game in May ({month_names[month]} / {d_str}). "
                    f"May is unusually late for university playoffs; verify weather/rescheduling."
                )
            # Rule 2: April should strictly only be playoffs (Critical)
            elif month == 4 and not is_playoff:
                issues.append(
                    f"Row {idx}: Invalid regular season game date ({month_names[month]} / {d_str}). "
                    f"April games must be playoff games."
                )
            # Rule 3: March regular season games flagged as a Warning (makeup/rescheduled games)
            elif month == 3 and not is_playoff:
                warnings.append(
                    f"Row {idx}: Regular season game in March ({month_names[month]} / {d_str}). "
                    f"March is typically reserved for playoffs; check if this was a weather makeup game."
                )

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
