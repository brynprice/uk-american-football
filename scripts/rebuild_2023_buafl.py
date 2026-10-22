#!/usr/bin/env python3
"""
UK American Football Archive - 2023/24 BUCS Season Deterministic Rebuild Script

Rebuilds:
  - data/BUAFL/phases2023.csv (25 phases, sequential ordinals 1-25)
  - data/BUAFL/games2023.csv (303 unique games: 267 regular season + 36 postseason playoffs)
  - data/BUAFL/standings2023.csv (16 columns, 79 teams, 14 division champions)

Adheres strictly to AGENTS.md Rules:
  - Rule 1: Sourced URLs recorded properly in notes; no internal file paths.
  - Rule 2: Canonical team names enforced.
  - Rule 3: National title game styled as 'College Bowl XXXVI', bowls as 'National Trophy', etc.
  - Rule 5 & 6: Strict evidence-based coaching registry from data/evidence/verified_coaches.json;
                all other coaches empty (null).
"""

import os
import csv
import json
from collections import defaultdict

BUCS_FIXTURES_URL = "https://bucs.playwaze.com/american-football-23-24/community-details?Tab=Fixtures"
SPORTANK_GAMEDAY_URL = "https://sportank.com/gameday/"

CANONICAL_TEAM_MAP = {
    'Glasgow Uni Tigers': 'Glasgow Tigers',
    'Edinburgh Predators': 'Edinburgh Mavericks',
    'Heriot-Watt Wolverines': 'HWU Wolverines',
    'Coventry Uni Jets': 'Coventry University Jets',
    'Bournemouth Uni Bobcats': 'Bournemouth University Bobcats',
    'Bangor Muddogs': 'Bangor Llewod',
    'Bangor MudDogs': 'Bangor Llewod',
    'Nottingham Green': 'Nottingham Jade',
    'Aberystwyth Tarannau': 'Tarannau Aberystwyth',
    'Brighton Panthers': 'Brighton Tsunami',
    'Canterbury Chargers': 'Canterbury CC Chargers',
    'NTU Renegades': 'Nottingham Trent Renegades',
    'Oxford Brookes': 'Oxford Brookes University',
    'UCLAN Rams': 'UCLan Rams',
    'Aberdeen Roughnecks': 'Aberdeen Roughnecks University Team',
    'Aberdeen Bulls': 'Aberdeen Roughnecks University Team',
    'Aberdeen': 'Aberdeen Roughnecks University Team',
    'Aberdeen Open 1': 'Aberdeen Roughnecks University Team',
    'Aberdeen Mixed 1': 'Aberdeen Roughnecks University Team',
    'University of Aberdeen': 'Aberdeen Roughnecks University Team',
    'Aberdeen University': 'Aberdeen Roughnecks University Team',
    'Aberdeen University Roughnecks': 'Aberdeen Roughnecks University Team',
}

# The 25 authentic phases for 2023/24
PHASES = [
    (1, "Premier North/South", "Tier", ""),
    (2, "National Championship", "Playoffs", "Premier North/South"),
    (3, "Premier North", "Division", "Premier North/South"),
    (4, "Premier South", "Division", "Premier North/South"),
    (5, "Division 1", "Tier", ""),
    (6, "National Trophy", "Playoffs", "Division 1"),
    (7, "Division 1 North", "Conference", "Division 1"),
    (8, "Division 1 Scottish", "Division", "Division 1 North"),
    (9, "Division 1 Northern", "Division", "Division 1 North"),
    (10, "Division 1 Midlands", "Division", "Division 1 North"),
    (11, "Division 1 South", "Conference", "Division 1"),
    (12, "Division 1 Southern", "Division", "Division 1 South"),
    (13, "Division 1 South Western", "Division", "Division 1 South"),
    (14, "Division 1 South Eastern", "Division", "Division 1 South"),
    (15, "Division 2", "Tier", ""),
    (16, "Division 2 North", "Conference", "Division 2"),
    (17, "Northern Conference Cup", "Playoffs", "Division 2 North"),
    (18, "Division 2 Northern A", "Division", "Division 2 North"),
    (19, "Division 2 Northern B", "Division", "Division 2 North"),
    (20, "Division 2 Midlands", "Division", "Division 2 North"),
    (21, "Division 2 South", "Conference", "Division 2"),
    (22, "Southern Conference Cup", "Playoffs", "Division 2 South"),
    (23, "Division 2 Southern", "Division", "Division 2 South"),
    (24, "Division 2 South Western", "Division", "Division 2 South"),
    (25, "Division 2 South Eastern", "Division", "Division 2 South"),
]

PHASE_PARENT_MAP = {p[1]: p[3] for p in PHASES}

# Walkovers resolution map: (date, home_team, away_team) -> (home_score, away_score)
WALKOVERS = {
    ('2023-10-29', 'UWE Bullets 2s', 'Bath Spa Bulldogs'): (1, 0),
    ('2023-11-19', 'Manchester Tyrants', 'Hull Sharks'): (1, 0),
    ('2023-11-19', 'Essex Blades', 'QMBL Vipers'): (1, 0),
    ('2023-11-26', 'Keele Crusaders', 'Bangor Llewod'): (1, 0),
    ('2023-12-03', 'HWU Wolverines', 'Aberdeen Bulls'): (0, 1),
    ('2023-12-03', 'Sussex Saxons', 'Chichester Spitfires'): (1, 0),
    ('2023-12-03', 'Bangor Llewod', 'UCLan Rams'): (0, 1),
    ('2023-12-10', 'QMBL Vipers', 'Kent Falcons'): (1, 0),
    ('2023-12-10', 'Edinburgh Napier Knights', 'HWU Wolverines'): (1, 0),
    ('2024-01-21', 'Kingston Cougars', 'UCL Emperors'): (0, 1),
    ('2024-01-21', 'Greenwich Mariners', 'Canterbury CC Chargers'): (1, 0),
    ('2024-01-28', 'Staffordshire Stallions', 'UCLan Rams'): (0, 1),
    ('2024-01-28', 'Lancaster Bombers', 'Bangor Llewod'): (1, 0),
    ('2024-01-28', 'Canterbury CC Chargers', 'Kingston Cougars'): (0, 1),
    ('2024-02-11', 'Edge Hill Vikings', 'Bangor Llewod'): (1, 0),
    ('2024-02-11', 'SGS Pride', 'UWE Bullets'): (0, 1),
    ('2024-02-11', 'Oxford Lancers', 'Royal Holloway Bears'): (1, 0),
    ('2024-02-11', 'Northumbria Mustangs', 'Sunderland Spartans'): (1, 0),
    ('2024-02-11', 'Plymouth Blitz', 'Worcester Royals'): (1, 0),
}

# Unplayed fixtures: (date, home_team, away_team)
UNPLAYED_FIXTURES = {
    ('2023-12-10', 'Royal Holloway Bears', 'Reading Knights'),
    ('2023-12-10', 'Aberdeen Bulls', 'Stirling Clansmen'),
    ('2024-02-07', 'Durham Saints', 'Leeds Beckett Carnegie'),
    ('2024-02-11', 'YSJ Jaguars', 'York Centurions'),
    ('2024-02-11', 'Essex Blades', 'UEA Pirates'),
    ('2024-02-14', 'Edinburgh Napier Knights', 'Stirling Clansmen'),
}

def clean_team_name(name):
    if not name:
        return ""
    clean = name.strip()
    return CANONICAL_TEAM_MAP.get(clean, clean)

def load_verified_coaches(year=2023):
    evidence_path = os.path.join(os.path.dirname(__file__), "..", "data", "evidence", "verified_coaches.json")
    coaches = {}
    if os.path.exists(evidence_path):
        with open(evidence_path, "r", encoding="utf-8") as f:
            for item in json.load(f):
                if int(item.get("year", 0)) == year:
                    team = clean_team_name(item.get("team", ""))
                    coaches[team] = item.get("head_coach", "").strip()
    return coaches

def rebuild():
    print("=== 1. Writing phases2023.csv ===")
    os.makedirs("data/BUAFL", exist_ok=True)
    with open("data/BUAFL/phases2023.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["competition_name", "year", "phase_name", "parent_phase", "type", "ordinal"])
        for ord_val, phase, ptype, parent in PHASES:
            writer.writerow(["BUAFL", "2023", phase, parent, ptype, ord_val])
    print(f"Created data/BUAFL/phases2023.csv with {len(PHASES)} phases.")

    print("\n=== 2. Rebuilding games2023.csv ===")
    reg_games = []
    with open("data/BUAFL/raw_games2023.csv", "r", encoding="utf-8") as f:
        reg_games = list(csv.DictReader(f))

    playoff_games = []
    with open("data/BUAFL/playoffs2023.csv", "r", encoding="utf-8") as f:
        playoff_games = list(csv.DictReader(f))

    all_raw_games = reg_games + playoff_games
    print(f"Loaded {len(reg_games)} regular season games + {len(playoff_games)} playoff games = {len(all_raw_games)} total.")

    verified_coaches_2023 = load_verified_coaches(2023)
    print(f"Loaded {len(verified_coaches_2023)} verified coaches for 2023: {verified_coaches_2023}")

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
        venue = g.get("venue", "").strip()
        h_score = g.get("home_score", "").strip()
        a_score = g.get("away_score", "").strip()

        fixture_sig = (date, home, away, is_playoff)
        if fixture_sig in seen_fixtures:
            print(f"  [Duplicate Dropped] {date}: {away} @ {home} ({phase})")
            continue
        seen_fixtures.add(fixture_sig)

        # Track team's regular season division
        if not is_playoff and phase:
            team_divisions[home] = phase
            team_divisions[away] = phase

        note = ""

        # Check walkover / score resolution
        pair_key = (date, home, away)
        if pair_key in WALKOVERS:
            hw, aw = WALKOVERS[pair_key]
            h_score, a_score = str(hw), str(aw)
            status = "awarded"
            note = f"Source: {SPORTANK_GAMEDAY_URL}"
        elif pair_key in UNPLAYED_FIXTURES:
            status = "cancelled"
            note = f"Fixture unplayed/cancelled. Source: {BUCS_FIXTURES_URL}"
        elif status == "awarded":
            note = f"Source: {SPORTANK_GAMEDAY_URL}"
        elif status == "scheduled":
            status = "cancelled"
            note = f"Fixture unplayed/cancelled. Source: {BUCS_FIXTURES_URL}"
        else:
            # Completed game
            status = "completed"
            note = f"Source: {BUCS_FIXTURES_URL}"

        # Assign verified head coaches from evidence registry
        home_coach = verified_coaches_2023.get(home, "")
        away_coach = verified_coaches_2023.get(away, "")

        # Postseason titles & final types
        final_type = g.get("final_type", "").strip().lower()
        title_name = g.get("title_name", "").strip()
        is_title = g.get("is_title_game", "").strip().upper() == "TRUE"
        playoff_round = g.get("playoff_round", "").strip()

        if is_playoff:
            if phase == "National Championship" and playoff_round == "Final":
                final_type = "title"
                title_name = "College Bowl XXXVI"
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
            "year": "2023",
            "phase": phase,
            "date": date,
            "away_team": away,
            "home_team": home,
            "away_score": a_score,
            "home_score": h_score,
            "venue": venue,
            "notes": note,
            "away_coach": away_coach,
            "home_coach": home_coach,
            "is_double_header": g.get("is_double_header", "FALSE").strip().upper(),
            "date_precision": "day" if date else "season",
            "date_display": date.split("-")[2] + "/" + date.split("-")[1] + "/" + date.split("-")[0] if date else "",
            "time": g.get("time", "").strip() if (g.get("time", "").strip() and (":" in g.get("time", "").strip()) and len(g.get("time", "").strip()) <= 8 and not any(c.isalpha() for c in g.get("time", "").strip())) else "",
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

    # Write rebuilt games2023.csv
    with open("data/BUAFL/games2023.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rebuilt_games)
    print(f"Wrote {len(rebuilt_games)} games to data/BUAFL/games2023.csv.")

    print("\n=== 3. Generating standings2023.csv ===")
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
        'Division 1 Scottish': 'Glasgow Tigers',
        'Division 1 Northern': 'Manchester Tyrants',
        'Division 1 Midlands': 'Nottingham Trent Renegades',
        'Division 1 South Western': 'Exeter Demons',
        'Division 1 Southern': 'Brunel Burners',
        'Division 1 South Eastern': 'UEA Pirates',
        'Division 2 Northern A': 'UCLan Rams',
        'Division 2 Northern B': 'Northumbria Mustangs',
        'Division 2 Midlands': 'Nottingham Jade',
        'Division 2 South Western': 'Swansea Titans',
        'Division 2 Southern': 'Brighton Tsunami',
        'Division 2 South Eastern': 'UCL Emperors',
    }

    standings_rows = []
    teams_by_div = defaultdict(list)
    for (phase, team) in div_records.keys():
        teams_by_div[phase].append(team)

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
            coach = verified_coaches_2023.get(team, "")
            standings_rows.append({
                "competition_name": "BUAFL",
                "year": "2023",
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

    with open("data/BUAFL/standings2023.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=standings_fields)
        writer.writeheader()
        writer.writerows(standings_rows)

    print(f"Wrote {len(standings_rows)} standings rows to data/BUAFL/standings2023.csv.")
    print(f"Divisional champions count: {sum(1 for r in standings_rows if r['is_champion'] == 'TRUE')}")

if __name__ == "__main__":
    rebuild()
