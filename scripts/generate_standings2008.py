import csv
from collections import defaultdict

# 1. Load games
with open('data/BUAFL/games2008.csv') as f:
    games = list(csv.DictReader(f))

# 2. Determine team to division mapping and parent phase
team_div = {}
team_parent = {}

# Parent mapping for the 8 divisions
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
        ht = g['home_team']
        hp = g['phase']
        at = g['away_team']
        ap = g['away_phase'] if g['away_phase'] else g['phase']
        
        team_div[ht] = hp
        team_div[at] = ap

# 3. Compute stats from game log
stats = {t: {'w': 0, 'l': 0, 't': 0, 'pf': 0, 'pa': 0, 'gp': 0} for t in team_div}

for g in games:
    if g['is_playoff'] != 'TRUE':
        ht = g['home_team']
        at = g['away_team']
        try:
            hs = int(g['home_score'])
            as_ = int(g['away_score'])
        except ValueError:
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

# Known overrides: Birmingham Lions went 8-0-0 in regular season
# Let's check if Birmingham Lions has 3-0 in game logs, keep PF/PA but adjust W to 8? Or user instruction:
# "I think we should use the standings taht we can find (Birmingham 8-0-0 and divisional champions for example)
# and supplement those standings with the game log data that we have. Obviously means that some teams might only
# show 1 game but that shows us later where we need to work on finding the game log data"
# So for Birmingham Lions: W=8, L=0, T=0, GP=8 (or from logs? Britball wiki confirms Birmingham was 8-0-0).
stats['Birmingham Lions']['w'] = 8
stats['Birmingham Lions']['l'] = 0
stats['Birmingham Lions']['t'] = 0
stats['Birmingham Lions']['gp'] = 8

# Group teams by division
div_teams = defaultdict(list)
for t, d in team_div.items():
    div_teams[d].append(t)

# Divisional champions (from wiki / playoff seeds / results):
div_champions = {
    'Conference 1 - North': 'Newcastle Raiders',
    'Conference 1 - South': 'Loughborough Aces',
    'Conference 2 - North': 'Sheffield Sabres',
    'Conference 2 - South': 'Birmingham Lions',
    'Conference 3 - South West': 'UWE Bullets',
    'Conference 3 - Wales': 'Cardiff Cobras',
    'Conference 4 - East': 'UEA Pirates',
    'Conference 4 - South': 'Southampton Stags',
}

rows = []
for div, teams in sorted(div_teams.items()):
    parent = parent_map[div]
    # Sort teams by Win% (or W, then diff, then PF)
    # Win pct = (w + 0.5 * t) / gp if gp > 0 else 0
    def sort_key(t):
        st = stats[t]
        pct = (st['w'] + 0.5 * st['t']) / st['gp'] if st['gp'] > 0 else 0
        diff = st['pf'] - st['pa']
        # If divisional champion, give top priority
        is_champ = (t == div_champions.get(div))
        return (1 if is_champ else 0, pct, st['w'], diff, st['pf'])
    
    sorted_teams = sorted(teams, key=sort_key, reverse=True)
    
    for pos, t in enumerate(sorted_teams, 1):
        st = stats[t]
        is_champ = 'TRUE' if t == div_champions.get(div) else 'FALSE'
        rows.append({
            'competition_name': 'BUAFL',
            'parent_phase': parent,
            'phase': div,
            'year': '2008',
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
            'notes': 'https://britball.fandom.com/wiki/2008-09_BUAFL_Season'
        })

fieldnames = [
    'competition_name', 'parent_phase', 'phase', 'year', 'team',
    'position', 'games_played', 'wins', 'losses', 'ties',
    'points_for', 'points_against', 'streak', 'is_champion', 'notes'
]

with open('data/BUAFL/standings2008.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"Generated {len(rows)} standings records across {len(div_teams)} divisions.")
