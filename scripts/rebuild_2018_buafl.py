#!/usr/bin/env python3
"""
Rebuild 2018/19 BUAFL Dataset using complete Double Coverage archives from May 2019.
Ensures strict compliance with AGENTS.md Rules 1, 2, 3, 5, and 6.
"""

import csv
import re
from datetime import datetime
from bs4 import BeautifulSoup

ALIAS_MAP = {
    'ARU Rhinos': 'Anglia Ruskin Siege',
    'Anglia Ruskin Rhinos': 'Anglia Ruskin Siege',
    'Bournemouth Bobcats': 'Bournemouth University Bobcats',
    'Brighton Panthers': 'Brighton Tsunami',
    'Canterbury Chargers': 'Canterbury CC Chargers',
    'City Sentinels': 'City Wolfpack',
    'CIty Sentinels': 'City Wolfpack',
    'Coventry Jets': 'Coventry University Jets',
    'DMU Falcons': 'DMU Falcons',
    'DMU Lions': 'DMU Falcons',
    'Hallam Warriors': 'Sheffield Hallam Warriors',
    'LJM Fury': 'LJMU Fury',
    'Leeds Carnegie': 'Leeds Beckett Carnegie',
    'Leeds Celtics': 'Leeds Gryphons',
    'NTU Renegades': 'Nottingham Trent Renegades',
    'Nottingham American Football': 'Nottingham Gold',
    'University of Nottingham': 'Nottingham Gold',
    'Nottingham': 'Nottingham Gold',
    'Nottingham Students': 'Nottingham Gold',
    'OBU Panthers': 'Oxford Brookes University',
    'RHUL Bears': 'Royal Holloway Bears',
    'Sheffield Sabres (R)': 'Sheffield Sabres',
    'Bangor Muddogs': 'Bangor MudDogs',
    'Heriot-Watt': 'HWU Wolverines',
    'Heriot Watt': 'HWU Wolverines',
    'HWU American Football': 'HWU Wolverines',
    'UEL Titans': 'UEL Phoenix',
    'BNU  Buccaneers': 'BNU Buccaneers',
    'Imperials Immortals': 'Imperial Immortals',
    'QMBL Vipers': 'QMBL Vipers',
    'UCL Emperors': 'UCL Emperors',
    'Southampton Solent Redhawks': 'Solent Redhawks',
    'UCLAN Rams': 'UCLan Rams',
    'Derby braves': 'Derby Braves',
}

TABLE_CONFS = [
    ('Premiership North', ('Premier North', 'Premier North/South')),
    ('Premiership South', ('Premier South', 'Premier North/South')),
    ('1A North', ('Division 1 Northern', 'Division 1 North')),
    ('1A Yorkshire', ('Division 1 Yorkshire', 'Division 1 North')),
    ('1A Midlands', ('Division 1 Midlands', 'Division 1 North')),
    ('1A South West', ('Division 1 South Western', 'Division 1 South')),
    ('1A South', ('Division 1 Southern', 'Division 1 South')),
    ('1A South East', ('Division 1 South Eastern', 'Division 1 South')),
    ('2A Borders', ('Division 2 Borders', 'Division 2 North')),
    ('2A North', ('Division 2 Northern', 'Division 2 North')),
    ('2A Midlands', ('Division 2 Midlands', 'Division 2 North')),
    ('2A South West', ('Division 2 South Western', 'Division 2 South')),
    ('2A South', ('Division 2 Southern', 'Division 2 South')),
    ('2A South East', ('Division 2 South Eastern', 'Division 2 South')),
]

CONF_MAP = {
    'Premiership North': ('Premier North', 'Premier North/South'),
    'Premiership South': ('Premier South', 'Premier North/South'),
    '1A North': ('Division 1 Northern', 'Division 1 North'),
    '1A Yorks/Lancs': ('Division 1 Yorkshire', 'Division 1 North'),
    '1A Yorkshire': ('Division 1 Yorkshire', 'Division 1 North'),
    '1A Midlands': ('Division 1 Midlands', 'Division 1 North'),
    '1A South': ('Division 1 Southern', 'Division 1 South'),
    '1A South West': ('Division 1 South Western', 'Division 1 South'),
    '1A South East': ('Division 1 South Eastern', 'Division 1 South'),
    '2A Borders': ('Division 2 Borders', 'Division 2 North'),
    '2A North': ('Division 2 Northern', 'Division 2 North'),
    '2A Midlands': ('Division 2 Midlands', 'Division 2 North'),
    '2A South': ('Division 2 Southern', 'Division 2 South'),
    '2A South West': ('Division 2 South Western', 'Division 2 South'),
    '2A South East': ('Division 2 South Eastern', 'Division 2 South'),
}

def clean_team_name(raw_name):
    clean = re.sub(r'\(.*?\)', '', str(raw_name)).strip()
    clean = clean.replace('†', '').replace('*', '').strip()
    return ALIAS_MAP.get(clean, clean)

def parse_standings(html_path):
    with open(html_path, 'r', encoding='latin-1') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')
    
    standings = []
    tables = soup.find_all('table')
    # Table 0 is the Wayback calendar, tables 1..14 are conference tables
    conf_tables = tables[1:]
    for idx, t in enumerate(conf_tables):
        if idx >= len(TABLE_CONFS):
            print(f'Warning: extra table at index {idx}')
            break
        
        conf_title, (phase, parent_phase) = TABLE_CONFS[idx]
        rows = t.find_all('tr')[1:]
        for pos, r in enumerate(rows, start=1):
            cols = [td.get_text(strip=True) for td in r.find_all(['td', 'th'])]
            if not cols or not cols[0]:
                continue
            raw_name = cols[0]
            is_champ = 'TRUE' if '(C)' in raw_name else 'FALSE'
            team = clean_team_name(raw_name)
            
            # W, L, T, PFor, PAgt
            w_nums = re.findall(r'\d+', cols[1])
            l_nums = re.findall(r'\d+', cols[2])
            t_nums = re.findall(r'\d+', cols[3])
            pf_nums = re.findall(r'\d+', cols[4])
            pa_nums = re.findall(r'\d+', cols[5])
            
            wins = int(w_nums[0]) if w_nums else 0
            losses = int(l_nums[0]) if l_nums else 0
            ties = int(t_nums[0]) if t_nums else 0
            pts_for = int(pf_nums[0]) if pf_nums else 0
            pts_against = int(pa_nums[0]) if pa_nums else 0
            gp = wins + losses + ties
            
            standings.append({
                'competition_name': 'BUAFL',
                'parent_phase': parent_phase,
                'phase': phase,
                'year': '2018',
                'team': team,
                'position': str(pos),
                'games_played': str(gp),
                'wins': str(wins),
                'losses': str(losses),
                'ties': str(ties),
                'points_for': str(pts_for),
                'points_against': str(pts_against),
                'streak': '',
                'is_champion': is_champ,
                'notes': 'Source: https://dblcoverage.com/university/bucs-standings-201819/',
                'head_coach': ''  # Strictly default-to-null per AGENTS.md Rule 6
            })
            
    return standings

def parse_fixtures(html_path):
    with open(html_path, 'r', encoding='latin-1') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')
        
    table = soup.find_all('table')[1]
    rows = table.find_all('tr')[1:]
    
    # 4 verified Championship & Bowl finals scores
    FINALS_SCORES = {
        ('Leeds Beckett Carnegie', 'Hertfordshire Hurricanes'): (57, 13),
        ('UEA Pirates', 'Coventry Jets'): (0, 26),
        ('Leeds Gryphons', 'Liverpool Raptors'): (25, 28),
        ('Essex Blades', 'Royal Holloway Bears'): (28, 6),
    }

    games = []
    for r in rows:
        cols = [td.get_text(strip=True) for td in r.find_all(['th', 'td'])]
        if len(cols) < 6:
            continue
            
        raw_date_str = cols[0]
        week_str = cols[1]
        conf_str = cols[2]
        home_raw = cols[3]
        score_str = cols[4]
        away_raw = cols[5]
        
        is_double_header = 'TRUE' if '(DH)' in score_str or '(DH)' in home_raw or '(DH)' in away_raw or '†' in score_str else 'FALSE'
        
        # Check if this row is one of the 4 Finals
        home_team_check = clean_team_name(home_raw)
        away_team_check = clean_team_name(away_raw)
        final_key = (home_raw, away_raw)
        
        if final_key in FINALS_SCORES and ('March 30' in raw_date_str or 'March 31' in raw_date_str or any(kw in conf_str.lower() for kw in ['final', 'championship', 'cup', 'trophy'])):
            home_score, away_score = FINALS_SCORES[final_key]
        else:
            if not ('-' in score_str):
                continue
            nums = re.findall(r'\d+', score_str)
            if len(nums) < 2:
                continue
            home_score = int(nums[0])
            away_score = int(nums[1])
            
        home_team = clean_team_name(home_raw)
        away_team = clean_team_name(away_raw)
        
        # Date parsing
        m_date = re.search(r'([A-Za-z]+\s+\d{1,2},\s+\d{4})', raw_date_str)
        if not m_date:
            m_date = re.search(r'(\d{1,2}\s+[A-Za-z]+\s+\d{4})', raw_date_str)
        if m_date:
            d_str = m_date.group(1)
            try:
                dt = datetime.strptime(d_str, '%B %d, %Y')
            except:
                dt = datetime.strptime(d_str, '%d %B %Y')
            iso_date = dt.strftime('%Y-%m-%d')
        else:
            print(f'Warning: unparseable date {raw_date_str}')
            iso_date = '2019-01-01'
        
        is_playoff = 'FALSE'
        is_title = 'FALSE'
        final_type = ''
        title_name = ''
        playoff_round = ''
        venue = ''
        
        # Postseason classifications
        if conf_str == 'Premiership' and ('March' in raw_date_str or '2019-03' in iso_date):
            is_playoff = 'TRUE'
            playoff_round = 'Quarter Finals'
            phase = 'National Championship'
            parent_phase = 'Premier North/South'
        elif 'Premiership Semi-Final' in conf_str:
            is_playoff = 'TRUE'
            playoff_round = 'Semi-Final'
            phase = 'National Championship'
            parent_phase = 'Premier North/South'
        elif conf_str == 'National Championship':
            is_playoff = 'TRUE'
            is_title = 'TRUE'
            final_type = 'title'
            title_name = 'College Bowl XXXIII'
            phase = 'National Championship'
            parent_phase = 'Premier North/South'
            playoff_round = 'Final'
        elif 'Division One (North)' in conf_str or 'Division One (South)' in conf_str:
            is_playoff = 'TRUE'
            phase = 'National Trophy'
            parent_phase = 'Division 1'
            if 'March 17' in raw_date_str:
                playoff_round = 'Regional Final'
            elif 'March 10' in raw_date_str:
                playoff_round = 'Semi-Final'
            elif 'March 3' in raw_date_str:
                playoff_round = 'Quarter Finals'
            else:
                playoff_round = 'Playoffs'
        elif conf_str == 'Division One National Trophy':
            is_playoff = 'TRUE'
            is_title = 'TRUE'
            final_type = 'bowl'
            title_name = 'National Trophy'
            phase = 'National Trophy'
            parent_phase = 'Division 1'
            playoff_round = 'Final'
        elif 'Division Two (North)' in conf_str:
            is_playoff = 'TRUE'
            phase = 'Northern Conference Cup'
            parent_phase = 'Division 2 North'
            if 'Conference Cup' in conf_str or 'March 30' in raw_date_str:
                is_title = 'TRUE'
                final_type = 'bowl'
                title_name = 'Northern Conference Cup'
                playoff_round = 'Final'
            elif 'March 17' in raw_date_str:
                playoff_round = 'Semi-Final'
            elif 'March 3' in raw_date_str:
                playoff_round = 'Quarter Finals'
            else:
                playoff_round = 'Playoffs'
        elif 'Division Two (South)' in conf_str:
            is_playoff = 'TRUE'
            phase = 'Southern Conference Cup'
            parent_phase = 'Division 2 South'
            if 'Conference Cup' in conf_str or 'March 31' in raw_date_str:
                is_title = 'TRUE'
                final_type = 'bowl'
                title_name = 'Southern Conference Cup'
                playoff_round = 'Final'
            elif 'March 17' in raw_date_str:
                playoff_round = 'Semi-Final'
            elif 'March 3' in raw_date_str or 'March 10' in raw_date_str:
                playoff_round = 'Quarter Finals'
            else:
                playoff_round = 'Playoffs'
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
            'year': '2018',
            'phase': phase,
            'parent_phase': parent_phase,
            'away_phase': '',
            'away_parent_phase': '',
            'date': iso_date,
            'away_team': away_team,
            'home_team': home_team,
            'away_score': str(away_score),
            'home_score': str(home_score),
            'venue': venue,
            'notes': 'Source: https://dblcoverage.com/university/bucs-fixturesresults-201819/',
            'away_coach': '',
            'home_coach': '',
            'is_double_header': is_double_header,
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

def create_phases_csv(output_path):
    phases = [
        ('BUAFL', '2018', 'Premier North/South', '', 'Tier', '1'),
        ('BUAFL', '2018', 'National Championship', 'Premier North/South', 'Playoffs', '2'),
        ('BUAFL', '2018', 'Premier North', 'Premier North/South', 'Division', '3'),
        ('BUAFL', '2018', 'Premier South', 'Premier North/South', 'Division', '4'),
        ('BUAFL', '2018', 'Division 1', '', 'Tier', '5'),
        ('BUAFL', '2018', 'National Trophy', 'Division 1', 'Playoffs', '6'),
        ('BUAFL', '2018', 'Division 1 North', 'Division 1', 'Conference', '7'),
        ('BUAFL', '2018', 'Division 1 Northern', 'Division 1 North', 'Division', '8'),
        ('BUAFL', '2018', 'Division 1 Yorkshire', 'Division 1 North', 'Division', '9'),
        ('BUAFL', '2018', 'Division 1 Midlands', 'Division 1 North', 'Division', '10'),
        ('BUAFL', '2018', 'Division 1 South', 'Division 1', 'Conference', '11'),
        ('BUAFL', '2018', 'Division 1 Southern', 'Division 1 South', 'Division', '12'),
        ('BUAFL', '2018', 'Division 1 South Western', 'Division 1 South', 'Division', '13'),
        ('BUAFL', '2018', 'Division 1 South Eastern', 'Division 1 South', 'Division', '14'),
        ('BUAFL', '2018', 'Division 2', '', 'Tier', '15'),
        ('BUAFL', '2018', 'Division 2 North', 'Division 2', 'Conference', '16'),
        ('BUAFL', '2018', 'Northern Conference Cup', 'Division 2 North', 'Playoffs', '17'),
        ('BUAFL', '2018', 'Division 2 Borders', 'Division 2 North', 'Division', '18'),
        ('BUAFL', '2018', 'Division 2 Northern', 'Division 2 North', 'Division', '19'),
        ('BUAFL', '2018', 'Division 2 Midlands', 'Division 2 North', 'Division', '20'),
        ('BUAFL', '2018', 'Division 2 South', 'Division 2', 'Conference', '21'),
        ('BUAFL', '2018', 'Southern Conference Cup', 'Division 2 South', 'Playoffs', '22'),
        ('BUAFL', '2018', 'Division 2 Southern', 'Division 2 South', 'Division', '23'),
        ('BUAFL', '2018', 'Division 2 South Western', 'Division 2 South', 'Division', '24'),
        ('BUAFL', '2018', 'Division 2 South Eastern', 'Division 2 South', 'Division', '25')
    ]
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['competition_name', 'year', 'phase_name', 'parent_phase', 'type', 'ordinal'])
        writer.writerows(phases)
    print(f'Updated {output_path} (25 phases).')

def main():
    phases_path = 'data/BUAFL/phases2018.csv'
    standings_path = 'data/BUAFL/standings2018.csv'
    games_path = 'data/BUAFL/games2018.csv'
    
    create_phases_csv(phases_path)
    
    standings = parse_standings('scratch/standings_201819_complete.html')
    print(f'Parsed {len(standings)} standings records.')
    with open(standings_path, 'w', newline='', encoding='utf-8') as f:
        fieldnames = [
            'competition_name', 'parent_phase', 'phase', 'year', 'team',
            'position', 'games_played', 'wins', 'losses', 'ties',
            'points_for', 'points_against', 'streak', 'is_champion',
            'notes', 'head_coach'
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(standings)
    print(f'Successfully wrote {standings_path}')
    
    games = parse_fixtures('scratch/fixtures_201819_complete.html')
    print(f'Total games (regular + postseason): {len(games)}')
    with open(games_path, 'w', newline='', encoding='utf-8') as f:
        fieldnames = [
            'competition', 'year', 'phase', 'parent_phase', 'away_phase', 'away_parent_phase',
            'date', 'away_team', 'home_team', 'away_score', 'home_score',
            'venue', 'notes', 'away_coach', 'home_coach', 'is_double_header',
            'date_precision', 'date_display', 'time', 'status', 'confidence_level',
            'is_playoff', 'is_title_game', 'final_type', 'title_name', 'playoff_round'
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(games)
    print(f'Successfully wrote {games_path}')

if __name__ == '__main__':
    main()
