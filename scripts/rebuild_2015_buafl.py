#!/usr/bin/env python3
"""
Rebuild 2015/16 BUAFL Dataset using Double Coverage archives.
Ensures strict compliance with AGENTS.md Rules 1, 2, 3, 5, and 6.
"""

import csv
import re
from bs4 import BeautifulSoup

ALIAS_MAP = {
    'ARU Rhinos': 'Anglia Ruskin Siege',
    'Anglia Ruskin Rhinos': 'Anglia Ruskin Siege',
    'Bournemouth Bobcats': 'Bournemouth University Bobcats',
    'Brighton Tsunami (R)': 'Brighton Tsunami',
    'Canterbury Chargers': 'Canterbury CC Chargers',
    'City Sentinels': 'City Wolfpack',
    'CIty Sentinels': 'City Wolfpack',
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
    'Bangor Muddogs': 'Bangor MudDogs',
    'Heriot-Watt': 'HWU Wolverines',
    'UEL Titans': 'UEL Phoenix',
    'BNU  Buccaneers': 'BNU Buccaneers'
}

CONF_MAP = {
    'PREMIER NORTH': ('Premier North', 'Premier North/South'),
    'PREMIER SOUTH': ('Premier South', 'Premier North/South'),
    'SCOTTISH/NORTHERN 1A (N)': ('Division 1 Scottish/Northern', 'Division 1 North'),
    'YORKSHIRE 1A (N)': ('Division 1 Yorkshire', 'Division 1 North'),
    'MIDLANDS 1A (N)': ('Division 1 Midlands', 'Division 1 North'),
    'WESTERN 1A (S)': ('Division 1 South Western', 'Division 1 South'),
    'SOUTH 1A (S)': ('Division 1 Southern', 'Division 1 South'),
    'SOUTH EAST 1A (S)': ('Division 1 South Eastern', 'Division 1 South'),
    'SCOTTISH/NORTHERN 2A (N)': ('Division 2 Scottish/Northern', 'Division 2 North'),
    'NORTH WEST 2A (N)': ('Division 2 North West', 'Division 2 North'),
    'NORTHERN 2A (N)': ('Division 2 Northern', 'Division 2 North'),
    'MIDLANDS 2A (N)': ('Division 2 Midlands', 'Division 2 North'),
    'WESTERN 2A (S)': ('Division 2 South Western', 'Division 2 South'),
    'SOUTH 2A (S)': ('Division 2 Southern', 'Division 2 South'),
    'LONDON 2A (S)': ('Division 2 London', 'Division 2 South'),
    'SOUTH EAST 2A (S)': ('Division 2 South Eastern', 'Division 2 South'),
    # Fixture short names
    'Premier North': ('Premier North', 'Premier North/South'),
    'Premier South': ('Premier South', 'Premier North/South'),
    'Scottish/Northern 1A': ('Division 1 Scottish/Northern', 'Division 1 North'),
    'Yorkshire 1A': ('Division 1 Yorkshire', 'Division 1 North'),
    'Midlands 1A': ('Division 1 Midlands', 'Division 1 North'),
    'Western 1A': ('Division 1 South Western', 'Division 1 South'),
    'South 1A': ('Division 1 Southern', 'Division 1 South'),
    'South East 1A': ('Division 1 South Eastern', 'Division 1 South'),
    'Scottish/Northern 2A': ('Division 2 Scottish/Northern', 'Division 2 North'),
    'North West 2A': ('Division 2 North West', 'Division 2 North'),
    'Northern 2A': ('Division 2 Northern', 'Division 2 North'),
    'Midlands 2A': ('Division 2 Midlands', 'Division 2 North'),
    'Western 2A': ('Division 2 South Western', 'Division 2 South'),
    'South 2A': ('Division 2 Southern', 'Division 2 South'),
    'London 2A': ('Division 2 London', 'Division 2 South'),
    'South East 2A': ('Division 2 South Eastern', 'Division 2 South'),
}

def clean_team_name(raw_name):
    clean = raw_name.replace(' (C)', '').replace(' (P)', '').replace(' (R)', '')
    clean = re.sub(r"\s*\([+\-\s]+\)", "", clean).strip()
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
            # In Premier South, Birmingham was marked (P) but was 8-0 division champ and College Bowl champ
            is_champ = 'TRUE' if ('(C)' in raw_name or (phase == 'Premier South' and 'Birmingham' in raw_name)) else 'FALSE'
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
                'year': '2015',
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
                'notes': 'Source: https://dblcoverage.com/university/bucs-standings-201516/',
                'head_coach': coach
            })
    return standings

def build_games(html_path):
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
        
        # Skip unplayed / postponed
        if not ('-' in score_str):
            continue
        nums = re.findall(r'\d+', score_str)
        if len(nums) < 2:
            continue
            
        home_score = int(nums[0])
        away_score = int(nums[1])
        home_team = clean_team_name(home_raw)
        away_team = clean_team_name(away_raw)
        
        # Date parsing: DD/MM/YY -> YYYY-MM-DD
        d_parts = date_str.split('/')
        if len(d_parts) == 3:
            yr = f'20{d_parts[2]}' if len(d_parts[2]) == 2 else d_parts[2]
            iso_date = f'{yr}-{d_parts[1].zfill(2)}-{d_parts[0].zfill(2)}'
        else:
            iso_date = date_str
            
        is_playoff = 'FALSE'
        is_title = 'FALSE'
        final_type = ''
        title_name = ''
        playoff_round = ''
        
        # Check postseason rounds
        if 'Premier QF' in conf_str:
            phase = 'National Championship'
            parent_phase = 'Premier North/South'
            is_playoff = 'TRUE'
            playoff_round = 'Quarter Finals'
        elif 'Premier SF' in conf_str:
            phase = 'National Championship'
            parent_phase = 'Premier North/South'
            is_playoff = 'TRUE'
            playoff_round = 'Semi-Final'
        elif conf_str == 'Premier Final':
            phase = 'National Championship'
            parent_phase = 'Premier North/South'
            is_playoff = 'TRUE'
            is_title = 'TRUE'
            final_type = 'title'
            title_name = 'College Bowl XXX'
            playoff_round = 'Final'
        elif 'Div 1 North QF' in conf_str or 'Div 1 South QF' in conf_str:
            phase = 'National Trophy'
            parent_phase = 'Division 1'
            is_playoff = 'TRUE'
            playoff_round = 'Last 16'
        elif 'Div 1 North SF' in conf_str or 'Div 1 South SF' in conf_str:
            phase = 'National Trophy'
            parent_phase = 'Division 1'
            is_playoff = 'TRUE'
            playoff_round = 'Quarter Finals'
        elif conf_str in ('Div 1 North Final', 'Div 1 South Final'):
            phase = 'National Trophy'
            parent_phase = 'Division 1'
            is_playoff = 'TRUE'
            playoff_round = 'Semi-Final'
        elif conf_str == 'Div 1 National Final':
            phase = 'National Trophy'
            parent_phase = 'Division 1'
            is_playoff = 'TRUE'
            is_title = 'TRUE'
            final_type = 'bowl'
            title_name = 'National Trophy'
            playoff_round = 'Final'
        elif 'Div 2 North SF' in conf_str:
            phase = 'Northern Conference Cup'
            parent_phase = 'Division 2 North'
            is_playoff = 'TRUE'
            playoff_round = 'Semi-Final'
        elif conf_str == 'Div 2 North Final':
            phase = 'Northern Conference Cup'
            parent_phase = 'Division 2 North'
            is_playoff = 'TRUE'
            is_title = 'TRUE'
            final_type = 'bowl'
            title_name = 'Northern Conference Cup'
            playoff_round = 'Final'
        elif 'Div 2 South SF' in conf_str:
            phase = 'Southern Conference Cup'
            parent_phase = 'Division 2 South'
            is_playoff = 'TRUE'
            playoff_round = 'Semi-Final'
        elif conf_str == 'Div 2 South Final':
            phase = 'Southern Conference Cup'
            parent_phase = 'Division 2 South'
            is_playoff = 'TRUE'
            is_title = 'TRUE'
            final_type = 'bowl'
            title_name = 'Southern Conference Cup'
            playoff_round = 'Final'
        else:
            conf_info = CONF_MAP.get(conf_str)
            if conf_info:
                phase, parent_phase = conf_info
            else:
                print(f'Warning: Unknown conf_str: {conf_str}')
                phase = conf_str
                parent_phase = 'Division 1'
                
        games.append({
            'competition': 'BUAFL',
            'year': '2015',
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
            'notes': 'Source: https://dblcoverage.com/university/bucs-fixturesresults-201516/',
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
    phases_rows = [
        ['BUAFL', '2015', 'Premier North/South', '', 'Tier', '1'],
        ['BUAFL', '2015', 'National Championship', 'Premier North/South', 'Playoffs', '2'],
        ['BUAFL', '2015', 'Premier North', 'Premier North/South', 'Division', '3'],
        ['BUAFL', '2015', 'Premier South', 'Premier North/South', 'Division', '4'],
        ['BUAFL', '2015', 'Division 1', '', 'Tier', '5'],
        ['BUAFL', '2015', 'National Trophy', 'Division 1', 'Playoffs', '6'],
        ['BUAFL', '2015', 'Division 1 North', 'Division 1', 'Conference', '7'],
        ['BUAFL', '2015', 'Division 1 Scottish/Northern', 'Division 1 North', 'Division', '8'],
        ['BUAFL', '2015', 'Division 1 Yorkshire', 'Division 1 North', 'Division', '9'],
        ['BUAFL', '2015', 'Division 1 Midlands', 'Division 1 North', 'Division', '10'],
        ['BUAFL', '2015', 'Division 1 South', 'Division 1', 'Conference', '11'],
        ['BUAFL', '2015', 'Division 1 South Western', 'Division 1 South', 'Division', '12'],
        ['BUAFL', '2015', 'Division 1 Southern', 'Division 1 South', 'Division', '13'],
        ['BUAFL', '2015', 'Division 1 South Eastern', 'Division 1 South', 'Division', '14'],
        ['BUAFL', '2015', 'Division 2', '', 'Tier', '15'],
        ['BUAFL', '2015', 'Division 2 North', 'Division 2', 'Conference', '16'],
        ['BUAFL', '2015', 'Northern Conference Cup', 'Division 2 North', 'Playoffs', '17'],
        ['BUAFL', '2015', 'Division 2 Scottish/Northern', 'Division 2 North', 'Division', '18'],
        ['BUAFL', '2015', 'Division 2 Northern', 'Division 2 North', 'Division', '19'],
        ['BUAFL', '2015', 'Division 2 North West', 'Division 2 North', 'Division', '20'],
        ['BUAFL', '2015', 'Division 2 Midlands', 'Division 2 North', 'Division', '21'],
        ['BUAFL', '2015', 'Division 2 South', 'Division 2', 'Conference', '22'],
        ['BUAFL', '2015', 'Southern Conference Cup', 'Division 2 South', 'Playoffs', '23'],
        ['BUAFL', '2015', 'Division 2 South Western', 'Division 2 South', 'Division', '24'],
        ['BUAFL', '2015', 'Division 2 Southern', 'Division 2 South', 'Division', '25'],
        ['BUAFL', '2015', 'Division 2 South Eastern', 'Division 2 South', 'Division', '26'],
        ['BUAFL', '2015', 'Division 2 London', 'Division 2 South', 'Division', '27'],
    ]
    with open('data/BUAFL/phases2015.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['competition_name', 'year', 'phase_name', 'parent_phase', 'type', 'ordinal'])
        w.writerows(phases_rows)
    print('Updated data/BUAFL/phases2015.csv (27 phases).')

    standings = parse_standings('scratch/standings_201516.html')
    print(f'Parsed {len(standings)} standings records.')
    standings_fields = ['competition_name', 'parent_phase', 'phase', 'year', 'team', 'position', 'games_played', 'wins', 'losses', 'ties', 'points_for', 'points_against', 'streak', 'is_champion', 'notes', 'head_coach']
    with open('data/BUAFL/standings2015.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=standings_fields)
        writer.writeheader()
        writer.writerows(standings)
    print('Successfully wrote data/BUAFL/standings2015.csv')

    games = build_games('scratch/fixtures_201516.html')
    print(f'Total games (regular + postseason): {len(games)}')
    games_fields = ['competition', 'year', 'phase', 'parent_phase', 'away_phase', 'away_parent_phase', 'date', 'away_team', 'home_team', 'away_score', 'home_score', 'venue', 'notes', 'away_coach', 'home_coach', 'is_double_header', 'date_precision', 'date_display', 'time', 'status', 'confidence_level', 'is_playoff', 'is_title_game', 'final_type', 'title_name', 'playoff_round']
    with open('data/BUAFL/games2015.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=games_fields)
        writer.writeheader()
        writer.writerows(games)
    print('Successfully wrote data/BUAFL/games2015.csv')
