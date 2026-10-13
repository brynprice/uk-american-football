#!/usr/bin/env python3
"""
Rebuild 2014/15 BUAFL Dataset using Double Coverage archives.
Ensures strict compliance with AGENTS.md Rules 1, 2, 3, 5, and 6.
"""

import csv
import re
from bs4 import BeautifulSoup

# Canonical Team Aliases Mapping
ALIAS_MAP = {
    'ARU Rhinos': 'Anglia Ruskin Siege',
    'Anglia Ruskin Rhinos': 'Anglia Ruskin Siege',
    'Bournemouth Bobcats': 'Bournemouth University Bobcats',
    'Brighton Tsunami (R)': 'Brighton Tsunami',
    'Canterbury Chargers': 'Canterbury CC Chargers',
    'City Sentinels': 'City Wolfpack',
    'Coventry Jets': 'Coventry University Jets',
    'DMU Falcons': 'DMU Lions',
    'Hallam Warriors': 'Sheffield Hallam Warriors',
    'LJM Fury': 'LJMU Fury',
    'Leeds Carnegie': 'Leeds Beckett Carnegie',
    'Leeds Celtics': 'Leeds Gryphons',
    'NTU Renegades': 'Nottingham Trent Renegades',
    'Nottingham': 'Nottingham Gold',
    'OBU Panthers': 'Oxford Brookes University',
    'RHUL Bears': 'Royal Holloway Bears',
    'Sheffield Sabres (R)': 'Sheffield Sabres',
    'Bangor Muddogs': 'Bangor MudDogs'
}

CONF_MAP = {
    'PREMIER NORTH': ('Premier North', 'Premier North/South'),
    'PREMIER SOUTH': ('Premier South', 'Premier North/South'),
    'BORDER CONFERENCE': ('Borders Division', 'Division 1'),
    'NORTH WEST CONFERENCE': ('North West Division', 'Division 1'),
    'YORKSHIRE CONFERENCE': ('Yorkshire Division', 'Division 1'),
    'EAST MIDLANDS CONFERENCE': ('Midlands Division', 'Division 1'),
    'SOUTH WEST CONFERENCE': ('South West Division', 'Division 1'),
    'SOUTH EAST CONFERENCE': ('South East Division', 'Division 1'),
    'LONDON CONFERENCE': ('London Division', 'Division 1'),
    'EAST CONFERENCE': ('East Division', 'Division 1'),
    # Fixture short names
    'Premier North': ('Premier North', 'Premier North/South'),
    'Premier South': ('Premier South', 'Premier North/South'),
    'Border': ('Borders Division', 'Division 1'),
    'North West': ('North West Division', 'Division 1'),
    'Yorkshire': ('Yorkshire Division', 'Division 1'),
    'East Midlands': ('Midlands Division', 'Division 1'),
    'South West': ('South West Division', 'Division 1'),
    'South East': ('South East Division', 'Division 1'),
    'London': ('London Division', 'Division 1'),
    'East': ('East Division', 'Division 1'),
}

def clean_team_name(raw_name):
    clean = raw_name.replace(' (C)', '').replace(' (R)', '').replace(' (+)', '').strip()
    return ALIAS_MAP.get(clean, clean)

def parse_standings(html_path):
    with open(html_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')
    
    standings = []
    for t in soup.find_all('table'):
        prev = t.find_previous(['h1', 'h2', 'h3', 'h4', 'p', 'strong', 'b'])
        title = prev.get_text(strip=True) if prev else ''
        conf_info = None
        for key in CONF_MAP:
            if key in title.upper():
                conf_info = CONF_MAP[key]
                break
        if not conf_info:
            print(f'Warning: Could not match conference title: {title}')
            continue
        
        phase, parent_phase = conf_info
        rows = t.find_all('tr')[1:]
        for idx, r in enumerate(rows, start=1):
            cols = [td.get_text(strip=True) for td in r.find_all(['td', 'th'])]
            if not cols or not cols[0]:
                continue
            raw_name = cols[0]
            is_champ = 'TRUE' if '(C)' in raw_name else 'FALSE'
            team = clean_team_name(raw_name)
            
            wins = int(cols[1])
            losses = int(cols[2])
            ties = int(cols[3])
            pts_for = int(cols[4])
            pts_against = int(cols[5])
            gp = wins + losses + ties
            
            # Head coach: strictly Rule 5 & 6 (only verified coaches)
            coach = 'Chris Denny' if team == 'Brighton Tsunami' else ''
            
            standings.append({
                'competition_name': 'BUAFL',
                'parent_phase': parent_phase,
                'phase': phase,
                'year': '2014',
                'team': team,
                'position': str(idx),
                'games_played': str(gp),
                'wins': str(wins),
                'losses': str(losses),
                'ties': str(ties),
                'points_for': str(pts_for),
                'points_against': str(pts_against),
                'streak': '',
                'is_champion': is_champ,
                'notes': 'Source: https://dblcoverage.com/university/bucs-standings-201415/',
                'head_coach': coach
            })
    return standings

def parse_fixtures(html_path):
    with open(html_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')
    
    table = soup.find('table')
    games = []
    
    for r in table.find_all('tr')[1:]:
        cols = [td.get_text(strip=True) for td in r.find_all(['td', 'th'])]
        if len(cols) < 6:
            continue
        
        date_str = cols[0]
        week_str = cols[1]
        conf_str = cols[2]
        home_raw = cols[3]
        score_str = cols[4]
        away_raw = cols[5]
        
        # Skip unplayed / postponed / uncompleted games
        if not ('-' in score_str):
            continue
        nums = re.findall(r'\d+', score_str)
        if len(nums) < 2:
            continue
        
        home_score = int(nums[0])
        away_score = int(nums[1])
        home_team = clean_team_name(home_raw)
        away_team = clean_team_name(away_raw)
        
        # Format date as YYYY-MM-DD
        d_parts = date_str.split('/')
        if len(d_parts) == 3:
            iso_date = f'{d_parts[2]}-{d_parts[1].zfill(2)}-{d_parts[0].zfill(2)}'
        else:
            iso_date = date_str
            
        # Determine phase and playoff attributes
        is_playoff = 'FALSE'
        is_title = 'FALSE'
        final_type = ''
        title_name = ''
        playoff_round = ''
        
        if 'Semi Final' in conf_str or 'Final' in conf_str:
            is_playoff = 'TRUE'
            if 'Premier Semi Final' in conf_str:
                phase = 'National Championship'
                parent_phase = 'Premier North/South'
                playoff_round = 'Semi-Final'
            elif conf_str == 'Premier Final':
                phase = 'National Championship'
                parent_phase = 'Premier North/South'
                playoff_round = 'Final'
                is_title = 'TRUE'
                final_type = 'title'
                title_name = 'College Bowl XXIX'
            elif 'Div 1 North Semi Final' in conf_str:
                phase = 'National Trophy (North)'
                parent_phase = 'Playoffs'
                playoff_round = 'Semi-Final'
            elif conf_str == 'Div 1 North Final':
                phase = 'National Trophy (North)'
                parent_phase = 'Playoffs'
                playoff_round = 'Final'
                is_title = 'TRUE'
                final_type = 'bowl'
                title_name = 'National Trophy (North)'
            elif 'Div 1 South Semi Final' in conf_str:
                phase = 'National Trophy (South)'
                parent_phase = 'Playoffs'
                playoff_round = 'Semi-Final'
            elif conf_str == 'Div 1 South Final':
                phase = 'National Trophy (South)'
                parent_phase = 'Playoffs'
                playoff_round = 'Final'
                is_title = 'TRUE'
                final_type = 'bowl'
                title_name = 'National Trophy (South)'
            else:
                phase = 'Playoffs'
                parent_phase = 'Division 1'
        else:
            conf_info = CONF_MAP.get(conf_str)
            if conf_info:
                phase, parent_phase = conf_info
            else:
                print(f'Warning: Unknown conference in fixture: {conf_str}')
                phase = conf_str
                parent_phase = 'Division 1'
                
        games.append({
            'competition': 'BUAFL',
            'year': '2014',
            'phase': phase,
            'parent_phase': parent_phase,
            'away_phase': '',
            'away_parent_phase': '',
            'date': iso_date,
            'away_team': away_team,
            'home_team': home_team,
            'away_score': str(away_score),
            'home_score': str(home_score),
            'venue': '',
            'notes': 'Source: https://dblcoverage.com/university/bucs-fixturesresults-201415/',
            'away_coach': '',
            'home_coach': '',
            'is_double_header': 'FALSE',
            'date_precision': 'day',
            'date_display': '',
            'time': '',
            'status': 'completed',
            'confidence_level': 'high',
            'is_playoff': is_playoff,
            'is_title_game': is_title,
            'final_type': final_type,
            'title_name': title_name,
            'playoff_round': playoff_round
        })
        
    return games

if __name__ == '__main__':
    standings = parse_standings('scratch/standings_201415.html')
    games = parse_fixtures('scratch/fixtures_201415.html')
    
    print(f'Parsed {len(standings)} standings records.')
    print(f'Parsed {len(games)} scored game fixtures.')
    
    # Write standings2014.csv
    standings_fields = ['competition_name', 'parent_phase', 'phase', 'year', 'team', 'position', 'games_played', 'wins', 'losses', 'ties', 'points_for', 'points_against', 'streak', 'is_champion', 'notes', 'head_coach']
    with open('data/BUAFL/standings2014.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=standings_fields)
        writer.writeheader()
        writer.writerows(standings)
    print('Successfully wrote data/BUAFL/standings2014.csv')
    
    # Write games2014.csv
    games_fields = ['competition', 'year', 'phase', 'parent_phase', 'away_phase', 'away_parent_phase', 'date', 'away_team', 'home_team', 'away_score', 'home_score', 'venue', 'notes', 'away_coach', 'home_coach', 'is_double_header', 'date_precision', 'date_display', 'time', 'status', 'confidence_level', 'is_playoff', 'is_title_game', 'final_type', 'title_name', 'playoff_round']
    with open('data/BUAFL/games2014.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=games_fields)
        writer.writeheader()
        writer.writerows(games)
    print('Successfully wrote data/BUAFL/games2014.csv')
