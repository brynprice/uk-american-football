import csv
from collections import defaultdict

# 1. Load games
with open('data/BUAFL/games2009.csv') as f:
    games = list(csv.DictReader(f))

# 2. Determine team to division mapping and parent phase
team_div = {}

parent_map = {
    'Conference 1 - North': 'Conference 1',
    'Conference 1 - South': 'Conference 1',
    'Conference 2 - North': 'Conference 2',
    'Conference 2 - South': 'Conference 2',
    'Conference 3 - South West': 'Conference 3',
    'Conference 3 - Wales': 'Conference 3',
    'Conference 4 - East': 'Conference 4',
    'Conference 4 - South': 'Conference 4',
}

for g in games:
    if g['is_playoff'] != 'TRUE':
        ht = g['home_team'].strip()
        hp = g['phase'].strip()
        at = g['away_team'].strip()
        ap = g['away_phase'].strip() if g['away_phase'] else g['phase'].strip()
        
        team_div[ht] = hp
        team_div[at] = ap

# Birmingham and Loughborough played in National Championship
if 'Birmingham Lions' not in team_div:
    team_div['Birmingham Lions'] = 'Conference 2 - South'
if 'Loughborough Aces' not in team_div:
    team_div['Loughborough Aces'] = 'Conference 1 - South'

# 3. Compute stats from game log
stats = {t: {'w': 0, 'l': 0, 't': 0, 'pf': 0, 'pa': 0, 'gp': 0} for t in team_div}

for g in games:
    if g['is_playoff'] != 'TRUE':
        ht = g['home_team'].strip()
        at = g['away_team'].strip()
        try:
            hs = int(g['home_score'])
            as_ = int(g['away_score'])
        except (ValueError, TypeError):
            continue
        
        stats[ht]['gp'] += 1
        stats[at]['gp'] += 1
        stats[ht]['pf'] += hs
        stats[ht]['pa'] += as_
        stats[at]['pf'] += as_
        stats[at]['pa'] += hs
        
        if hs > as_:
            stats[ht]['w'] += 1
            stats[at]['l'] += 1
        elif as_ > hs:
            stats[at]['w'] += 1
            stats[ht]['l'] += 1
        else:
            stats[ht]['t'] += 1
            stats[at]['t'] += 1

# Known overrides from Britball Wiki:
# Birmingham Lions: 8-0-0
stats['Birmingham Lions']['w'] = 8
stats['Birmingham Lions']['l'] = 0
stats['Birmingham Lions']['t'] = 0
stats['Birmingham Lions']['gp'] = 8

# Loughborough Aces: 7-1-0 (2nd in Conf 2 South or Conf 1 South)
stats['Loughborough Aces']['w'] = 7
stats['Loughborough Aces']['l'] = 1
stats['Loughborough Aces']['t'] = 0
stats['Loughborough Aces']['gp'] = 8

div_teams = defaultdict(list)
for t, d in team_div.items():
    div_teams[d].append(t)

# Divisional champions (from wiki / results):
# Birmingham Lions won National Championship and their division (Conf 2 - South)
div_champions = {
    'Conference 2 - South': 'Birmingham Lions',
}

rows = []
for div, teams in sorted(div_teams.items()):
    parent = parent_map.get(div, '')
    def sort_key(t):
        st = stats[t]
        pct = (st['w'] + 0.5 * st['t']) / st['gp'] if st['gp'] > 0 else 0
        diff = st['pf'] - st['pa']
        is_champ = (t == div_champions.get(div))
        return (1 if is_champ else 0, pct, st['w'], diff, st['pf'])
    
    sorted_teams = sorted(teams, key=sort_key, reverse=True)
    
    for pos, t in enumerate(sorted_teams, 1):
        st = stats[t]
        is_champ = 'TRUE' if t == div_champions.get(div) else 'FALSE'
        coach = 'Tony Athersmith' if t == 'Birmingham Lions' else ''
        rows.append({
            'competition_name': 'BUAFL',
            'parent_phase': parent,
            'phase': div,
            'year': '2009',
            'team': t,
            'position': str(pos),
            'games_played': str(st['gp']),
            'wins': str(st['w']),
            'losses': str(st['l']),
            'ties': str(st['t']),
            'points_for': str(st['pf']),
            'points_against': str(st['pa']),
            'streak': '',
            'is_champion': is_champ,
            'notes': 'https://britball.fandom.com/wiki/2009-10_BUAFL_Season',
            'head_coach': coach
        })

fieldnames = [
    'competition_name', 'parent_phase', 'phase', 'year', 'team',
    'position', 'games_played', 'wins', 'losses', 'ties',
    'points_for', 'points_against', 'streak', 'is_champion', 'notes', 'head_coach'
]

with open('data/BUAFL/standings2009.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"Generated {len(rows)} standings records across {len(div_teams)} divisions.")
