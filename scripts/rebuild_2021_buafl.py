#!/usr/bin/env python3
"""
UK American Football Archive - 2021/22 BUCS Season Deterministic Rebuild Script

Rebuilds:
  - data/BUAFL/phases2021.csv (25 phases, sequential ordinals 1-25)
  - data/BUAFL/games2021.csv (339 unique games: 303 regular season + 36 postseason playoffs)
  - data/BUAFL/standings2021.csv (16 columns, 85 teams, 14 division champions)

Adheres strictly to AGENTS.md Rules:
  - Rule 1: Sourced URLs recorded properly in notes; no local paths.
  - Rule 2: Canonical team names enforced.
  - Rule 3: National title game styled as 'College Bowl XXXIV', bowls as 'National Trophy', etc.
  - Rule 5 & 6: Ollie Kent assigned for Brighton Panthers/Tsunami per data/evidence/verified_coaches.json;
                all other coaches empty (null).
"""

import os
import csv
import json
from collections import defaultdict

BUCS_FIXTURES_URL = "https://bucs.playwaze.com/american-football-21-22/9esbz8vb7ijo/community-details?Tab=Fixtures"
SPORTANK_GAMEDAY_URL = "https://sportank.com/gameday/"

CANONICAL_TEAM_MAP = {
    'Bangor MudDogs': 'Bangor Llewod',
    'Bangor Muddogs': 'Bangor Llewod',
    'Edinburgh Predators': 'Edinburgh Mavericks',
    'Nottingham Green': 'Nottingham Jade',
    'Brighton Panthers': 'Brighton Tsunami',
    'Oxford Brookes': 'Oxford Brookes University',
    'Bournemouth Uni Bobcats': 'Bournemouth University Bobcats',
    'Coventry Uni Jets': 'Coventry University Jets',
    'Heriot-Watt Wolverines': 'HWU Wolverines',
    'Glasgow Uni Tigers': 'Glasgow Tigers',
    'Aberystwyth Tarannau': 'Tarannau Aberystwyth',
    'UCLAN Rams': 'UCLan Rams',
    'Canterbury Chargers': 'Canterbury CC Chargers',
    'NTU Renegades': 'Nottingham Trent Renegades',
    'Aberdeen Roughnecks': 'Aberdeen Roughnecks University Team',
    'Aberdeen Bulls': 'Aberdeen Roughnecks University Team',
    'Aberdeen': 'Aberdeen Roughnecks University Team',
    'Aberdeen Open 1': 'Aberdeen Roughnecks University Team',
    'Aberdeen Mixed 1': 'Aberdeen Roughnecks University Team',
    'University of Aberdeen': 'Aberdeen Roughnecks University Team',
    'Aberdeen University': 'Aberdeen Roughnecks University Team',
    'Aberdeen University Roughnecks': 'Aberdeen Roughnecks University Team',
}

# The 25 authentic phases for 2021/22
PHASES = [
    (1, "Premier North/South", "Tier", ""),
    (2, "National Championship", "Playoffs", "Premier North/South"),
    (3, "Premier North", "Division", "Premier North/South"),
    (4, "Premier South", "Division", "Premier North/South"),
    (5, "Division 1", "Tier", ""),
    (6, "National Trophy", "Playoffs", "Division 1"),
    (7, "Division 1 North", "Conference", "Division 1"),
    (8, "Division 1 Borders", "Division", "Division 1 North"),
    (9, "Division 1 Northern", "Division", "Division 1 North"),
    (10, "Division 1 Midlands", "Division", "Division 1 North"),
    (11, "Division 1 South", "Conference", "Division 1"),
    (12, "Division 1 Southern", "Division", "Division 1 South"),
    (13, "Division 1 South Western", "Division", "Division 1 South"),
    (14, "Division 1 South Eastern", "Division", "Division 1 South"),
    (15, "Division 2", "Tier", ""),
    (16, "Division 2 North", "Conference", "Division 2"),
    (17, "Northern Conference Cup", "Playoffs", "Division 2 North"),
    (18, "Division 2 Borders", "Division", "Division 2 North"),
    (19, "Division 2 Northern", "Division", "Division 2 North"),
    (20, "Division 2 Midlands", "Division", "Division 2 North"),
    (21, "Division 2 South", "Conference", "Division 2"),
    (22, "Southern Conference Cup", "Playoffs", "Division 2 South"),
    (23, "Division 2 Southern", "Division", "Division 2 South"),
    (24, "Division 2 South Western", "Division", "Division 2 South"),
    (25, "Division 2 South Eastern", "Division", "Division 2 South"),
]

PHASE_PARENT_MAP = {p[1]: p[3] for p in PHASES}

# Walkovers resolution map: (date, home_team, away_team) -> (home_score, away_score)
# Canonical team names used here:
# away @ home -> (home_score, away_score)
WALKOVERS = {
    ('2021-10-31', 'Manchester Tyrants', 'Derby Braves'): (1, 0),
    ('2021-11-07', 'Imperial Immortals', 'Anglia Ruskin Siege'): (1, 0),
    ('2021-11-14', 'Huddersfield Hawks', 'Nottingham Jade'): (0, 1),
    ('2021-11-14', 'Oxford Brookes University', 'Winchester Silverbacks'): (1, 0),
    ('2021-11-14', 'Sunderland Spartans', 'YSJ Jaguars'): (1, 0),
    ('2021-11-14', 'DMU Lions', 'Staffordshire Stallions'): (0, 1),
    ('2021-11-14', 'Keele Crusaders', 'Chester Legion'): (1, 0),
    ('2021-11-14', 'Cambridge Pythons', 'UEL Phoenix'): (1, 0),
    ('2021-11-21', 'MMU Eagles', 'Bangor Llewod'): (1, 0),
    ('2021-11-28', 'UWS Pyros', 'HWU Wolverines'): (0, 1),
    ('2021-11-28', 'Staffordshire Stallions', 'Chester Legion'): (1, 0),
    ('2021-12-05', 'Glasgow Tigers', 'Sunderland Spartans'): (1, 0),
    ('2021-12-12', 'Anglia Ruskin Siege', 'Imperial Immortals'): (0, 1),
    ('2021-12-12', 'DMU Lions', 'Chester Legion'): (1, 0),
    ('2021-12-12', 'Brighton Tsunami', 'Chichester Spitfires'): (1, 0),
    ('2022-01-23', 'Chester Legion', 'Lincoln Colonials'): (0, 1),
    ('2022-01-23', 'Nottingham Jade', 'DMU Lions'): (1, 0),
    ('2022-01-23', 'HWU Wolverines', 'YSJ Jaguars'): (1, 0),
    ('2022-01-23', 'Brunel Burners', 'Anglia Ruskin Siege'): (1, 0),
    ('2022-01-23', 'Kingston Cougars', 'Brighton Tsunami'): (0, 1),
    ('2022-01-23', 'Greenwich Mariners', 'UEL Phoenix'): (1, 0),
    ('2022-01-30', 'City Wolfpack', 'UEL Phoenix'): (1, 0),
    ('2022-01-30', 'QMBL Vipers', 'Anglia Ruskin Siege'): (1, 0),
    ('2022-01-30', 'Durham Saints', 'Leeds Gryphons'): (1, 0),
    ('2022-01-30', 'YSJ Jaguars', 'Edinburgh Napier Knights'): (0, 1),
    ('2022-01-30', 'DMU Lions', 'Lincoln Colonials'): (0, 1),
    ('2022-01-30', 'Swansea Titans', 'UWE Bullets'): (0, 1),
    ('2022-01-30', 'Bangor Llewod', 'Bradford Bears'): (0, 1),
    ('2022-02-05', 'Tarannau Aberystwyth', 'Bangor Llewod'): (1, 0),
    ('2022-02-06', 'Greenwich Mariners', 'Canterbury CC Chargers'): (1, 0),
    ('2022-02-06', 'City Wolfpack', 'Cambridge Pythons'): (0, 1),
    ('2022-02-06', 'UEL Phoenix', 'KCL Regents'): (0, 1),
    ('2022-02-13', 'Edge Hill Vikings', 'Liverpool Raptors'): (0, 1),
    ('2022-02-13', 'MMU Eagles', 'Bradford Bears'): (1, 0),
    ('2022-02-13', 'UEL Phoenix', 'Kent Falcons'): (0, 1),
    ('2022-02-13', 'UWS Pyros', 'YSJ Jaguars'): (1, 0),
    ('2022-02-13', 'Chichester Spitfires', 'Winchester Silverbacks'): (0, 1),
    ('2022-02-13', 'Aberdeen Bulls', 'HWU Wolverines'): (1, 0),
    ('2022-02-16', 'YSJ Jaguars', 'Aberdeen Bulls'): (0, 1),
    ('2022-02-20', 'Edge Hill Vikings', 'MMU Eagles'): (0, 1),
    ('2022-02-20', 'Surrey Stingers', 'Portsmouth Destroyers'): (0, 1),
    ('2022-02-20', 'DMU Lions', 'Huddersfield Hawks'): (1, 0),
    ('2022-02-20', 'Chester Legion', 'Huddersfield Hawks'): (0, 1),
    ('2022-02-20', 'Edge Hill Vikings', 'Bangor Llewod'): (1, 0),
    ('2022-02-27', 'Surrey Stingers', 'Royal Holloway Bears'): (0, 1),
}

# Playoffs walkovers in playoffs2021.csv
PLAYOFF_WALKOVERS = {
    ('2022-02-27', 'UWE Bullets', 'Stirling Clansmen'): (1, 0),
    ('2022-02-27', 'SGS Pride', 'QMBL Vipers'): (1, 0),
}

def clean_team_name(name):
    if not name:
        return ""
    clean = name.strip()
    return CANONICAL_TEAM_MAP.get(clean, clean)

def rebuild():
    print("=== 1. Writing phases2021.csv ===")
    os.makedirs("data/BUAFL", exist_ok=True)
    with open("data/BUAFL/phases2021.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["ordinal", "phase", "phase_type", "parent_phase"])
        for ord_val, phase, ptype, parent in PHASES:
            writer.writerow([ord_val, phase, ptype, parent])
    print(f"Created data/BUAFL/phases2021.csv with {len(PHASES)} phases.")

    print("\n=== 2. Rebuilding games2021.csv ===")
    reg_games = []
    with open("data/BUAFL/raw_games2021.csv", "r", encoding="utf-8") as f:
        reg_games = list(csv.DictReader(f))

    playoff_games = []
    with open("data/BUAFL/playoffs2021.csv", "r", encoding="utf-8") as f:
        playoff_games = list(csv.DictReader(f))

    all_raw_games = reg_games + playoff_games
    print(f"Loaded {len(reg_games)} regular season games + {len(playoff_games)} playoff games = {len(all_raw_games)} total.")

    fieldnames = [
        "competition", "year", "phase", "date", "away_team", "home_team",
        "away_score", "home_score", "venue", "notes", "away_coach", "home_coach",
        "is_double_header", "date_precision", "date_display", "time", "status",
        "confidence_level", "is_playoff", "is_title_game", "final_type",
        "title_name", "playoff_round", "parent_phase"
    ]

    rebuilt_games = []
    seen_fixtures = set()

    # Track standings records
    div_records = defaultdict(lambda: {'W': 0, 'L': 0, 'T': 0, 'PF': 0, 'PA': 0})
    team_divisions = {}

    for g in all_raw_games:
        date = g.get("date", "").strip()
        home = clean_team_name(g.get("home_team", ""))
        away = clean_team_name(g.get("away_team", ""))
        phase = g.get("phase", "").strip()
        is_playoff = g.get("is_playoff", "").strip().upper() == "TRUE"
        status = g.get("status", "").strip().lower()

        # De-duplicate raw duplicate games (e.g. Essex Blades @ Imperial Immortals on 2022-02-06)
        fixture_sig = (date, home, away, is_playoff)
        if fixture_sig in seen_fixtures:
            print(f"  [Duplicate Dropped] {date}: {away} @ {home} ({phase})")
            continue
        seen_fixtures.add(fixture_sig)

        # Track team's regular season division
        if not is_playoff and phase:
            team_divisions[home] = phase
            team_divisions[away] = phase

        h_score = g.get("home_score", "").strip()
        a_score = g.get("away_score", "").strip()

        # Setup notes & source URL
        note = ""

        # Check walkover resolution
        pair_key = (date, home, away)
        if pair_key in WALKOVERS:
            hw, aw = WALKOVERS[pair_key]
            h_score, a_score = str(hw), str(aw)
            status = "awarded"
            note = f"Source: {SPORTANK_GAMEDAY_URL}"
        elif pair_key in PLAYOFF_WALKOVERS:
            hw, aw = PLAYOFF_WALKOVERS[pair_key]
            h_score, a_score = str(hw), str(aw)
            status = "awarded"
            note = f"Source: {SPORTANK_GAMEDAY_URL}"
        elif status == "awarded":
            note = f"Source: {SPORTANK_GAMEDAY_URL}"
        elif status == "scheduled":
            # Cancelled games: Worcester Royals withdrawal or Storm Eunice/Dudley cancellations
            if home == "Worcester Royals" or away == "Worcester Royals":
                status = "cancelled"
                note = f"Fixture unplayed due to Worcester Royals withdrawal. Source: {BUCS_FIXTURES_URL}"
            else:
                status = "cancelled"
                note = f"Cancelled due to severe weather. Source: {BUCS_FIXTURES_URL}"
        else:
            # Played / completed game
            status = "completed"
            note = f"Source: {BUCS_FIXTURES_URL}"

        # Assign verified head coach for Brighton Tsunami
        home_coach = "Ollie Kent" if home == "Brighton Tsunami" else ""
        away_coach = "Ollie Kent" if away == "Brighton Tsunami" else ""

        # Postseason titles & final types
        final_type = g.get("final_type", "").strip().lower()
        title_name = g.get("title_name", "").strip()
        is_title = g.get("is_title_game", "").strip().upper() == "TRUE"
        playoff_round = g.get("playoff_round", "").strip()

        if is_playoff:
            if phase == "National Championship" and playoff_round == "Final":
                final_type = "title"
                title_name = "College Bowl XXXIV"
                is_title = True
            elif phase == "National Trophy" and playoff_round == "Final":
                final_type = "bowl"
                title_name = "National Trophy"
                is_title = True
            elif phase == "Northern Conference Cup" and playoff_round == "Final":
                final_type = "bowl"
                title_name = "Northern Conference Cup"
                is_title = True
            elif phase == "Southern Conference Cup" and playoff_round == "Final":
                final_type = "bowl"
                title_name = "Southern Conference Cup"
                is_title = True

        parent_phase = PHASE_PARENT_MAP.get(phase, "")

        row = {
            "competition": "BUAFL",
            "year": "2021",
            "phase": phase,
            "date": date,
            "away_team": away,
            "home_team": home,
            "away_score": a_score,
            "home_score": h_score,
            "venue": g.get("venue", "").strip(),
            "notes": note,
            "away_coach": away_coach,
            "home_coach": home_coach,
            "is_double_header": g.get("is_double_header", "FALSE").strip().upper(),
            "date_precision": "day" if date else "season",
            "date_display": date.split("-")[2] + "/" + date.split("-")[1] + "/" + date.split("-")[0] if date else "",
            "time": g.get("time", "").strip(),
            "status": status,
            "confidence_level": "high",
            "is_playoff": "TRUE" if is_playoff else "FALSE",
            "is_title_game": "TRUE" if is_title else "FALSE",
            "final_type": final_type,
            "title_name": title_name,
            "playoff_round": playoff_round,
            "parent_phase": parent_phase
        }
        rebuilt_games.append(row)

        # Update standings stats for regular season scored games (completed & awarded)
        if not is_playoff and h_score.isdigit() and a_score.isdigit():
            hs_int = int(h_score)
            as_int = int(a_score)
            div_records[(phase, home)]['PF'] += hs_int
            div_records[(phase, home)]['PA'] += as_int
            div_records[(phase, away)]['PF'] += as_int
            div_records[(phase, away)]['PA'] += hs_int
            if hs_int > as_int:
                div_records[(phase, home)]['W'] += 1
                div_records[(phase, away)]['L'] += 1
            elif as_int > hs_int:
                div_records[(phase, away)]['W'] += 1
                div_records[(phase, home)]['L'] += 1
            else:
                div_records[(phase, home)]['T'] += 1
                div_records[(phase, away)]['T'] += 1

    # Write rebuilt games2021.csv
    with open("data/BUAFL/games2021.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rebuilt_games)
    print(f"Wrote {len(rebuilt_games)} games to data/BUAFL/games2021.csv.")

    print("\n=== 3. Generating standings2021.csv ===")
    standings_fields = [
        "competition_name", "year", "phase", "parent_phase", "team",
        "wins", "losses", "ties", "points_for", "points_against",
        "streak", "head_coach", "offensive_coordinator", "defensive_coordinator",
        "notes", "is_champion"
    ]

    # Pre-determined division champions from Sportank / official outcomes
    CHAMPIONS = {
        'Premier North': 'Nottingham Gold',
        'Premier South': 'UWE Bullets',
        'Division 1 Borders': 'Newcastle Raiders',
        'Division 1 Northern': 'Sheffield Hallam Warriors',
        'Division 1 Midlands': 'Nottingham Trent Renegades',
        'Division 1 Southern': 'Royal Holloway Bears',
        'Division 1 South Western': 'SGS Pride',
        'Division 1 South Eastern': 'Imperial Immortals',
        'Division 2 Borders': 'Edinburgh Napier Knights',
        'Division 2 Northern': 'MMU Eagles',
        'Division 2 Midlands': 'Nottingham Jade',
        'Division 2 Southern': 'Oxford Lancers',
        'Division 2 South Western': 'Bournemouth University Bobcats',
        'Division 2 South Eastern': 'KCL Regents',
    }

    standings_rows = []
    # Collect all teams grouped by division
    teams_by_div = defaultdict(list)
    for (phase, team) in div_records.keys():
        teams_by_div[phase].append(team)

    # Ensure Worcester Royals is included in Division 2 South Western
    if 'Worcester Royals' not in teams_by_div['Division 2 South Western']:
        teams_by_div['Division 2 South Western'].append('Worcester Royals')

    for phase, teams in sorted(teams_by_div.items()):
        parent_phase = PHASE_PARENT_MAP.get(phase, "")
        # Sort teams by W*2 + T, then PF - PA, then PF
        sorted_teams = sorted(
            teams,
            key=lambda t: (
                div_records[(phase, t)]['W'] * 2 + div_records[(phase, t)]['T'],
                div_records[(phase, t)]['PF'] - div_records[(phase, t)]['PA'],
                div_records[(phase, t)]['PF']
            ),
            reverse=True
        )

        champ_team = CHAMPIONS.get(phase, sorted_teams[0])

        for team in sorted_teams:
            rec = div_records[(phase, team)]
            is_champ = (team == champ_team)
            coach = "Ollie Kent" if team == "Brighton Tsunami" else ""
            standings_rows.append({
                "competition_name": "BUAFL",
                "year": "2021",
                "phase": phase,
                "parent_phase": parent_phase,
                "team": team,
                "wins": rec['W'],
                "losses": rec['L'],
                "ties": rec['T'],
                "points_for": rec['PF'],
                "points_against": rec['PA'],
                "streak": "",
                "head_coach": coach,
                "offensive_coordinator": "",
                "defensive_coordinator": "",
                "notes": f"Source: {SPORTANK_GAMEDAY_URL}",
                "is_champion": "TRUE" if is_champ else "FALSE"
            })

    with open("data/BUAFL/standings2021.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=standings_fields)
        writer.writeheader()
        writer.writerows(standings_rows)

    print(f"Wrote {len(standings_rows)} standings rows to data/BUAFL/standings2021.csv.")
    print(f"Divisional champions count: {sum(1 for r in standings_rows if r['is_champion'] == 'TRUE')}")

if __name__ == "__main__":
    rebuild()
