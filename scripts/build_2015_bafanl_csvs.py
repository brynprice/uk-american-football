import csv
import re
from bs4 import BeautifulSoup
from collections import defaultdict

ALIAS_MAP = {
    'Tamworth Phoenix': 'Coventry Phoenix',
    'Leicester Falcons': 'Leicester Panthers',
    'Lancashire Wolverines': 'Lancashire Buccaneers',
    'Carlisle Sentinels': 'Carlisle Kestrels',
    'Cornish Sharks': 'Cornwall Monarchs',
    'Farnham Knights': 'Rushmoor Knights',
    'Walney Terriers': 'Furness Phantoms',
    'Sheffield Predators': 'Sheffield Giants',
}

PARENT_PHASE_MAP = {
    'Premiership North': 'Premiership',
    'Premiership South': 'Premiership',
    'NFC 1': 'Northern Football Conference',
    'SFC 1': 'Southern Football Conference',
    'NFC 2 North': 'Northern Football Conference',
    'NFC 2 West': 'Northern Football Conference',
    'NFC 2 South': 'Northern Football Conference',
    'SFC 2 West': 'Southern Football Conference',
    'SFC 2 East': 'Southern Football Conference',
    'SFC 2 South': 'Southern Football Conference',
}

VERIFIED_COACHES_2015 = {
    'London Warriors': 'Tony Allen',
    'London Blitz': 'Mark Moss',
    'East Kilbride Pirates': 'Ross Templeton',
    'Coventry Phoenix': 'Martin Hilton',
    'Merseyside Nighthawks': 'Craig Pennington',
    'Rushmoor Knights': 'Steve Rains',
    'Edinburgh Wolves': 'Don Edmonston',
    'Sandwell Steelers': 'Jay Alexander',
    'Bury Saints': 'Chris Wallis',
    'Oxford Saints': 'Andrew Day',
}

MONTHS_IT = {
    'gennaio': '01', 'febbraio': '02', 'marzo': '03', 'aprile': '04',
    'maggio': '05', 'giugno': '06', 'luglio': '07', 'agosto': '08',
    'settembre': '09', 'ottobre': '10', 'novembre': '11', 'dicembre': '12'
}

def resolve_team(name):
    cleaned = re.sub(r'\[.*?\]', '', name).strip()
    return ALIAS_MAP.get(cleaned, cleaned)

def parse_date(date_str):
    cleaned = re.sub(r'\[\d+\]', ' ', date_str)
    cleaned = re.sub(r'[º°]', '', cleaned)
    m = re.search(r'(\d{1,2})\s+([a-z]+)\s+(\d{4})', cleaned.lower())
    if m:
        day = int(m.group(1))
        month_name = m.group(2)
        year = m.group(3)
        month = MONTHS_IT.get(month_name)
        if month:
            return f"{year}-{month}-{day:02d}"
    return None

def build_data():
    files = [
        ('/Users/brynprice/.gemini/antigravity/brain/29afc068-86b4-41f5-b685-4e55f014f3ce/scratch/2015_premiership.html', 'Premiership', 'https://it.wikipedia.org/wiki/BAFA_NL_Premiership_2015'),
        ('/Users/brynprice/.gemini/antigravity/brain/29afc068-86b4-41f5-b685-4e55f014f3ce/scratch/2015_div1.html', 'Division One', 'https://it.wikipedia.org/wiki/BAFA_NL_Division_One_2015'),
        ('/Users/brynprice/.gemini/antigravity/brain/29afc068-86b4-41f5-b685-4e55f014f3ce/scratch/2015_div2.html', 'Division Two', 'https://it.wikipedia.org/wiki/BAFA_NL_Division_Two_2015')
    ]

    all_standings_rows = []
    all_games_rows = []
    team_to_div = {}

    # 1. Parse Standings first
    for filepath, tier, src_url in files:
        with open(filepath, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')

        for table in soup.find_all('table'):
            if 'PCT' in table.get_text() and ('V' in table.get_text() or 'Vinte' in table.get_text()):
                prev = table.find_previous(['h3', 'h4', 'h2'])
                d_name = prev.get_text(strip=True) if prev else ''
                d_name = re.sub(r'\[.*?\]', '', d_name).strip()

                if d_name not in PARENT_PHASE_MAP:
                    continue

                parent = PARENT_PHASE_MAP[d_name]
                rows = table.find_all('tr')[1:]
                for pos, r in enumerate(rows, 1):
                    cells = [td.get_text(strip=True) for td in r.find_all(['th', 'td'])]
                    if len(cells) >= 9:
                        raw_team = cells[1]
                        team = resolve_team(raw_team)
                        team_to_div[raw_team] = d_name
                        team_to_div[team] = d_name

                        def safe_int(v, default=0):
                            nums = re.findall(r'\d+', v)
                            return int(nums[0]) if nums else default

                        g = safe_int(cells[3])
                        w = safe_int(cells[4])
                        t = safe_int(cells[5])
                        l = safe_int(cells[6])
                        pf = safe_int(cells[7])
                        pa = safe_int(cells[8])

                        is_champ = 'TRUE' if pos == 1 else 'FALSE'
                        coach = VERIFIED_COACHES_2015.get(team, '')
                        notes = f"Source: Wikipedia contemporary records ({src_url})"

                        all_standings_rows.append({
                            'competition_name': 'BAFA National Leagues',
                            'parent_phase': parent,
                            'phase': d_name,
                            'year': '2015',
                            'team': team,
                            'position': str(pos),
                            'games_played': str(g),
                            'wins': str(w),
                            'losses': str(l),
                            'ties': str(t),
                            'points_for': str(pf),
                            'points_against': str(pa),
                            'streak': '',
                            'is_champion': is_champ,
                            'notes': notes,
                            'head_coach': coach
                        })

    print(f"Parsed {len(all_standings_rows)} standings rows across 10 divisions.")

    # 2. Parse Games
    for filepath, tier, src_url in files:
        with open(filepath, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')

        playoff_h = None
        for h in soup.find_all(['h2', 'h3']):
            if 'playoff' in h.get_text().lower():
                playoff_h = h
                break

        for table in soup.find_all('table'):
            curr = table
            is_po = False
            while curr:
                if curr == playoff_h:
                    is_po = True
                    break
                prev = curr.find_previous(['h2', 'h3'])
                if prev and 'playoff' in prev.get_text().lower():
                    is_po = True
                    break
                curr = prev

            for r in table.find_all('tr'):
                cells = [td.get_text(strip=True) for td in r.find_all(['th', 'td'])]
                score_idx = -1
                for idx, c in enumerate(cells):
                    m_score = re.search(r'(\d+)\s*[-–\xa0]\s*(\d+)', c)
                    if m_score and idx >= 2:
                        score_idx = idx
                        s1 = int(m_score.group(1))
                        s2 = int(m_score.group(2))
                        break

                if score_idx != -1:
                    d_str = cells[0]
                    t1_raw = cells[1]
                    t2_raw = cells[score_idx + 1] if len(cells) > score_idx + 1 else ''

                    if not t2_raw or '1N' in t1_raw or '2S' in t1_raw or 'Ospiti' in t1_raw or 'Casa' in t1_raw:
                        continue

                    date_iso = parse_date(d_str)
                    home_team = resolve_team(t1_raw)
                    away_team = resolve_team(t2_raw)
                    home_score = s1
                    away_score = s2

                    raw_score_cell = cells[score_idx]
                    is_walkover = 'a tavolino' in raw_score_cell.lower()
                    is_ot = 'd.t.s.' in raw_score_cell.lower() or 'supplementari' in raw_score_cell.lower()

                    game_notes = f"Source: Wikipedia contemporary records ({src_url})"
                    if is_walkover:
                        game_notes += " | Walkover awarded (a tavolino)"
                    elif is_ot:
                        game_notes += " | Decided in overtime (d.t.s.)"

                    venue = ''
                    mvp = ''
                    is_title_game = 'FALSE'
                    final_type = ''
                    title_name = ''
                    playoff_round = ''

                    if not is_po:
                        game_phase = team_to_div.get(t1_raw, team_to_div.get(home_team, ''))
                        parent_phase = PARENT_PHASE_MAP.get(game_phase, tier)
                        is_playoff = 'FALSE'
                    else:
                        game_phase = 'Playoffs'
                        parent_phase = tier
                        is_playoff = 'TRUE'

                        prev_ctx = table.find_previous(['h3', 'h4', 'h5', 'p', 'b'])
                        ctx_text = prev_ctx.get_text(strip=True).lower() if prev_ctx else ''

                        if tier == 'Premiership' and date_iso == '2015-09-05':
                            title_name = 'Britbowl XXIX'
                            is_title_game = 'TRUE'
                            final_type = 'title'
                            playoff_round = 'Final'
                            venue = 'Barnet Copthall Stadium, London'
                            game_notes = f"Britbowl XXIX. Venue: {venue}. Source: {src_url}"
                        elif tier == 'Division One' and date_iso == '2015-09-13' and (home_team == 'Merseyside Nighthawks' or away_team == 'Merseyside Nighthawks'):
                            title_name = 'Division One North Bowl'
                            is_title_game = 'TRUE'
                            final_type = 'bowl'
                            playoff_round = 'Final'
                            venue = 'John Charles Centre for Sport, Leeds'
                            game_notes = f"Division One North Bowl. Venue: {venue}. Source: {src_url}"
                        elif tier == 'Division One' and date_iso == '2015-09-13' and (home_team == 'Rushmoor Knights' or away_team == 'Rushmoor Knights'):
                            title_name = 'Division One South Bowl'
                            is_title_game = 'TRUE'
                            final_type = 'bowl'
                            playoff_round = 'Final'
                            venue = 'Leicester Road Stadium, Hinckley'
                            game_notes = f"Division One South Bowl (Oak Bowl). Venue: {venue}. Source: {src_url}"
                        elif tier == 'Division Two' and date_iso == '2015-09-12':
                            title_name = 'Division Two North Bowl'
                            is_title_game = 'TRUE'
                            final_type = 'bowl'
                            playoff_round = 'Final'
                            venue = 'John Charles Centre for Sport, Leeds'
                            game_notes = f"Division Two North Bowl. Venue: {venue}. Source: {src_url}"
                        elif tier == 'Division Two' and date_iso == '2015-09-13':
                            title_name = 'Division Two South Bowl'
                            is_title_game = 'TRUE'
                            final_type = 'bowl'
                            playoff_round = 'Final'
                            venue = 'Leicester Road Stadium, Hinckley'
                            game_notes = f"Division Two South Bowl. Venue: {venue}. Source: {src_url}"
                        elif 'semifinali' in ctx_text or (tier == 'Premiership' and date_iso == '2015-08-23') or (tier == 'Division One' and date_iso in ('2015-08-23', '2015-08-29')) or (tier == 'Division Two' and date_iso == '2015-09-06'):
                            playoff_round = 'Semifinal'
                        elif 'quarti' in ctx_text or (tier == 'Division Two' and date_iso == '2015-08-23'):
                            playoff_round = 'Quarterfinal'

                    home_coach = VERIFIED_COACHES_2015.get(home_team, '')
                    away_coach = VERIFIED_COACHES_2015.get(away_team, '')

                    all_games_rows.append({
                        'competition': 'BAFA National Leagues',
                        'year': '2015',
                        'phase': game_phase,
                        'date': date_iso,
                        'away_team': away_team,
                        'home_team': home_team,
                        'away_score': str(away_score),
                        'home_score': str(home_score),
                        'venue': venue,
                        'notes': game_notes,
                        'away_coach': away_coach,
                        'home_coach': home_coach,
                        'is_double_header': 'FALSE',
                        'date_precision': 'day',
                        'date_display': '',
                        'time': '',
                        'status': 'completed',
                        'confidence_level': 'high',
                        'is_playoff': is_playoff,
                        'is_title_game': is_title_game,
                        'final_type': final_type,
                        'title_name': title_name,
                        'playoff_round': playoff_round,
                        'parent_phase': parent_phase,
                        'away_phase': ''
                    })

    print(f"Parsed {len(all_games_rows)} total games (regular + playoff).")

    div_order = [
        'Premiership North', 'Premiership South',
        'NFC 1', 'SFC 1',
        'NFC 2 North', 'NFC 2 West', 'NFC 2 South', 'SFC 2 West', 'SFC 2 East', 'SFC 2 South'
    ]
    all_standings_rows.sort(key=lambda r: (div_order.index(r['phase']) if r['phase'] in div_order else 99, int(r['position'])))
    all_games_rows.sort(key=lambda r: (r['date'], r['phase'], r['home_team']))

    # Write standings2015.csv
    standings_fields = [
        'competition_name', 'parent_phase', 'phase', 'year', 'team',
        'position', 'games_played', 'wins', 'losses', 'ties',
        'points_for', 'points_against', 'streak', 'is_champion',
        'notes', 'head_coach'
    ]
    with open('/Users/brynprice/uk-football-history/data/BAFANL/standings2015.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=standings_fields)
        w.writeheader()
        w.writerows(all_standings_rows)
    print("Wrote data/BAFANL/standings2015.csv")

    # Write games2015.csv
    games_fields = [
        'competition', 'year', 'phase', 'date', 'away_team', 'home_team',
        'away_score', 'home_score', 'venue', 'notes', 'away_coach',
        'home_coach', 'is_double_header', 'date_precision', 'date_display',
        'time', 'status', 'confidence_level', 'is_playoff', 'is_title_game',
        'final_type', 'title_name', 'playoff_round', 'parent_phase', 'away_phase'
    ]
    with open('/Users/brynprice/uk-football-history/data/BAFANL/games2015.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=games_fields)
        w.writeheader()
        w.writerows(all_games_rows)
    print("Wrote data/BAFANL/games2015.csv")

if __name__ == '__main__':
    build_data()
