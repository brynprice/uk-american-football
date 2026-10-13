#!/usr/bin/env python3
"""
Rebuild 2019/20 BUAFL Dataset.
Standardizes phases, standings, and games in strict compliance with AGENTS.md Rules 1, 2, 3, 5, and 6.
Handles COVID-19 pandemic shutdown with status='interrupted' / status='cancelled'.
"""

import csv
import os
from collections import defaultdict

PHASES_FILE = 'data/BUAFL/phases2019.csv'
RAW_GAMES_FILE = 'data/BUAFL/raw_games2019.csv'
RAW_PLAYOFFS_FILE = 'data/BUAFL/playoffs2019.csv'
OUTPUT_GAMES = 'data/BUAFL/games2019.csv'
OUTPUT_STANDINGS = 'data/BUAFL/standings2019.csv'

ALIAS_MAP = {
    'Brighton Panthers': 'Brighton Tsunami',
    'Bangor MudDogs': 'Bangor Llewod',
    'Edinburgh Predators': 'Edinburgh Mavericks',
    'Nottingham Green': 'Nottingham Jade'
}

AWARDED_WALKOVERS = {
    ('Coventry University Jets', 'Leeds Beckett Carnegie', '2019-11-03'): (0, 1, 'Leeds Beckett Carnegie'),
    ('UWS Pyros', 'Teesside Cougars', '2019-11-24'): (0, 1, 'Teesside Cougars'),
    ('Greenwich Mariners', 'Canterbury CC Chargers', '2019-11-24'): (0, 1, 'Canterbury CC Chargers'),
    ('Gloucestershire Gladiators', 'Plymouth Blitz', '2020-01-26'): (0, 1, 'Plymouth Blitz'),
    ('Worcester Royals', 'Cardiff Cobras', '2020-01-26'): (0, 1, 'Cardiff Cobras'),
    ('Winchester Silverbacks', 'UCL Emperors', '2020-01-26'): (0, 1, 'UCL Emperors'),
    ('Gloucestershire Gladiators', 'Bournemouth University Bobcats', '2020-02-02'): (0, 1, 'Bournemouth University Bobcats'),
    ('Manchester Tyrants', 'MMU Eagles', '2020-02-02'): (1, 0, 'Manchester Tyrants'),
    ('Liverpool Raptors', 'Tarannau Aberystwyth', '2020-02-16'): (1, 0, 'Liverpool Raptors'),
    ('Nottingham Green', 'Keele Crusaders', '2020-02-16'): (0, 1, 'Keele Crusaders'),
    ('Solent Redhawks', 'Gloucestershire Gladiators', '2020-02-16'): (1, 0, 'Solent Redhawks')
}

# 1. Load phases and parent relationships
phase_parents = {}
with open(PHASES_FILE, 'r', encoding='utf-8') as f:
    for row in csv.DictReader(f):
        phase_parents[row['phase_name']] = row['parent_phase']

# 2. Process games
final_games = []
seen_game_keys = set()
standings_map = defaultdict(lambda: {'p': 0, 'w': 0, 'l': 0, 'd': 0, 'pf': 0, 'pa': 0})
division_teams = defaultdict(set)

# Load existing regular season games
with open(RAW_GAMES_FILE, 'r', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        # Canonicalize team names
        away = ALIAS_MAP.get(r['away_team'], r['away_team'])
        home = ALIAS_MAP.get(r['home_team'], r['home_team'])
        phase = r['phase']
        parent_phase = phase_parents.get(phase, '')
        date = r['date']
        status = r['status']

        key = (away, home, date, phase)
        if key in seen_game_keys:
            continue
        seen_game_keys.add(key)
        
        division_teams[phase].add(away)
        division_teams[phase].add(home)
        
        # Check Brighton coaching
        away_coach = 'Chris Denny' if away == 'Brighton Tsunami' else ''
        home_coach = 'Chris Denny' if home == 'Brighton Tsunami' else ''
        
        venue = r.get('venue') or ''
        time_val = r.get('time') or ''
        
        if 'Brighton Tsunami' in (away, home):
            notes = 'Source: Brighton Tsunami historical records'
        else:
            notes = 'Source: BUCS Play historical records'
            
        away_score = ''
        home_score = ''
        
        if status == 'completed':
            away_score = r['away_score']
            home_score = r['home_score']
            as_num = int(away_score)
            hs_num = int(home_score)
            standings_map[(phase, home)]['p'] += 1
            standings_map[(phase, away)]['p'] += 1
            standings_map[(phase, home)]['pf'] += hs_num
            standings_map[(phase, home)]['pa'] += as_num
            standings_map[(phase, away)]['pf'] += as_num
            standings_map[(phase, away)]['pa'] += hs_num
            if hs_num > as_num:
                standings_map[(phase, home)]['w'] += 1
                standings_map[(phase, away)]['l'] += 1
            elif as_num > hs_num:
                standings_map[(phase, away)]['w'] += 1
                standings_map[(phase, home)]['l'] += 1
            else:
                standings_map[(phase, home)]['d'] += 1
                standings_map[(phase, away)]['d'] += 1
                
        elif status == 'awarded':
            key_lookup = (r['away_team'], r['home_team'], date)
            if key_lookup in AWARDED_WALKOVERS:
                as_val, hs_val, winner = AWARDED_WALKOVERS[key_lookup]
                away_score = str(as_val)
                home_score = str(hs_val)
                notes = f"Forfeit/walkover awarded to {winner}. Source: BUCS Play historical records"
                
                standings_map[(phase, home)]['p'] += 1
                standings_map[(phase, away)]['p'] += 1
                standings_map[(phase, home)]['pf'] += hs_val
                standings_map[(phase, home)]['pa'] += as_val
                standings_map[(phase, away)]['pf'] += as_val
                standings_map[(phase, away)]['pa'] += hs_val
                if hs_val > as_val:
                    standings_map[(phase, home)]['w'] += 1
                    standings_map[(phase, away)]['l'] += 1
                else:
                    standings_map[(phase, away)]['w'] += 1
                    standings_map[(phase, home)]['l'] += 1
                    
        elif status == 'scheduled':
            status = 'cancelled'
            notes = 'Unplayed/cancelled prior to postseason. Source: BUCS Play historical records'
            away_score = ''
            home_score = ''

        game_rec = {
            'competition': 'BUAFL',
            'year': '2019',
            'phase': phase,
            'parent_phase': parent_phase,
            'away_phase': '',
            'away_parent_phase': '',
            'date': date,
            'away_team': away,
            'home_team': home,
            'away_score': away_score,
            'home_score': home_score,
            'venue': venue,
            'notes': notes,
            'away_coach': away_coach,
            'home_coach': home_coach,
            'is_double_header': 'FALSE',
            'date_precision': 'day',
            'date_display': '',
            'time': time_val,
            'status': status,
            'confidence_level': 'high',
            'is_playoff': 'FALSE',
            'is_title_game': 'FALSE',
            'final_type': '',
            'title_name': '',
            'playoff_round': ''
        }
        final_games.append(game_rec)

# Load playoffs
with open(RAW_PLAYOFFS_FILE, 'r', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        away = ALIAS_MAP.get(r['away_team'], r['away_team'])
        home = ALIAS_MAP.get(r['home_team'], r['home_team'])
        phase = r['phase']
        parent_phase = phase_parents.get(phase, '')
        date = r['date']
        status = r['status']
        playoff_round = r.get('playoff_round', '')
        time_val = r.get('time', '')
        venue = r.get('venue', '')
        
        away_score = r.get('away_score', '')
        home_score = r.get('home_score', '')
        
        if status == 'cancelled':
            notes = 'Cancelled due to the Covid-19 Pandemic. Source: BUCS Play historical records'
            away_score = ''
            home_score = ''
        elif status == 'awarded':
            notes = 'Forfeit/walkover awarded to Royal Holloway Bears. Source: BUCS Play historical records'
        else:
            notes = 'Source: BUCS Play historical records'
            
        game_rec = {
            'competition': 'BUAFL',
            'year': '2019',
            'phase': phase,
            'parent_phase': parent_phase,
            'away_phase': '',
            'away_parent_phase': '',
            'date': date,
            'away_team': away,
            'home_team': home,
            'away_score': away_score,
            'home_score': home_score,
            'venue': venue,
            'notes': notes,
            'away_coach': '',
            'home_coach': '',
            'is_double_header': 'FALSE',
            'date_precision': 'day',
            'date_display': '',
            'time': time_val,
            'status': status,
            'confidence_level': 'high',
            'is_playoff': 'TRUE',
            'is_title_game': 'FALSE',
            'final_type': '',
            'title_name': phase,
            'playoff_round': playoff_round
        }
        final_games.append(game_rec)

# Sort games chronologically
final_games.sort(key=lambda x: (x['date'], x['time'], x['phase']))

# Write games2019.csv
games_fields = [
    'competition', 'year', 'phase', 'parent_phase', 'away_phase', 'away_parent_phase',
    'date', 'away_team', 'home_team', 'away_score', 'home_score', 'venue', 'notes',
    'away_coach', 'home_coach', 'is_double_header', 'date_precision', 'date_display',
    'time', 'status', 'confidence_level', 'is_playoff', 'is_title_game', 'final_type',
    'title_name', 'playoff_round'
]

with open(OUTPUT_GAMES, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=games_fields)
    writer.writeheader()
    writer.writerows(final_games)

print(f"Successfully generated {OUTPUT_GAMES} ({len(final_games)} records).")

# 3. Generate standings2019.csv
standings_rows = []
for phase in sorted(division_teams.keys()):
    parent_p = phase_parents.get(phase, '')
    teams = list(division_teams[phase])
    sorted_teams = sorted(teams, key=lambda t: (
        standings_map[(phase, t)]['w']*2 + standings_map[(phase, t)]['d'],
        standings_map[(phase, t)]['pf'] - standings_map[(phase, t)]['pa'],
        standings_map[(phase, t)]['pf']
    ), reverse=True)
    
    for rank, t in enumerate(sorted_teams, 1):
        st = standings_map[(phase, t)]
        is_champ = 'TRUE' if rank == 1 else 'FALSE'
        head_coach = 'Chris Denny' if t == 'Brighton Tsunami' else ''
        notes = 'Source: Brighton Tsunami historical records' if t == 'Brighton Tsunami' else 'Source: BUCS Play historical records'
        
        row = {
            'competition_name': 'BUAFL',
            'parent_phase': parent_p,
            'phase': phase,
            'year': '2019',
            'team': t,
            'position': str(rank),
            'games_played': str(st['p']),
            'wins': str(st['w']),
            'losses': str(st['l']),
            'ties': str(st['d']),
            'points_for': str(st['pf']),
            'points_against': str(st['pa']),
            'streak': '',
            'is_champion': is_champ,
            'notes': notes,
            'head_coach': head_coach
        }
        standings_rows.append(row)

standings_fields = [
    'competition_name', 'parent_phase', 'phase', 'year', 'team', 'position',
    'games_played', 'wins', 'losses', 'ties', 'points_for', 'points_against',
    'streak', 'is_champion', 'notes', 'head_coach'
]

with open(OUTPUT_STANDINGS, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=standings_fields)
    writer.writeheader()
    writer.writerows(standings_rows)

print(f"Successfully generated {OUTPUT_STANDINGS} ({len(standings_rows)} records).")
