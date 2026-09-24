import glob
import json
import re
import csv
from datetime import datetime

with open('scratch_university_teams.json') as f:
    teams_db = json.load(f)

# Build a lookup map of normalized name -> canonical team name
team_lookup = {}

def normalize(name):
    if not name:
        return ""
    # Strip HTML tags, wiki links, formatting
    name = re.sub(r'<[^>]+>', '', name)
    name = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]+)\]\]', r'\1', name)
    name = re.sub(r'http\S+', '', name)
    name = re.sub(r"'''?", "", name)
    name = re.sub(r'\([^\)]*\)', '', name) # remove parens e.g. (BUAFL) or (3)
    name = re.sub(r'^\s*\(?\d+\)?\s*', '', name) # remove leading seeds e.g. (8)
    name = re.sub(r'^\d+\s*[-–—]\s*', '', name) # remove leading numbers
    name = re.sub(r'^(the|a)\s+', '', name, flags=re.IGNORECASE)
    name = name.strip()
    return name.lower()

for t in teams_db:
    tname = t['name']
    norm_main = normalize(tname)
    team_lookup[norm_main] = t['name']
    
    for alias in t.get('team_aliases', []):
        aname = alias['name']
        team_lookup[normalize(aname)] = t['name']

# Additional historical aliases / shorthand found on Britball Wiki
manual_aliases = {
    "bristol bullets": "UWE Bullets",
    "bristol": "UWE Bullets",
    "ut cougars": "Teesside Cougars",
    "teesside demons": "Teesside Cougars",
    "teesside cougars": "Teesside Cougars",
    "uch sharks": "Hull Sharks",
    "hull sharks": "Hull Sharks",
    "newcastle scholars": "Newcastle Raiders",
    "newcastle raiders": "Newcastle Raiders",
    "leicester lemmings": "Leicester Longhorns",
    "leicester lightning": "Leicester Longhorns",
    "leicester longhorns": "Leicester Longhorns",
    "nottingham outlaws": "Nottingham Gold",
    "nottingham gold": "Nottingham Gold",
    "apu phantoms": "Anglia Ruskin Siege",
    "aru phantoms": "Anglia Ruskin Siege",
    "brighton tsunami": "Brighton Panthers",
    "rhul bears": "Royal Holloway Bears",
    "royal holloway bears": "Royal Holloway Bears",
    "bath bees": "Bath Killer Bees",
    "bath killer bees": "Bath Killer Bees",
    "manchester mps": "Manchester Tyrants",
    "leeds celtics": "Leeds Gryphons",
    "loughborough aces": "Loughborough Students",
    "glasgow hawks": "Glasgow Tigers",
    "glasgow tigers": "Glasgow Tigers",
    "derby braves": "Derby Braves",
    "cardiff cobras": "Cardiff Cobras",
    "stirling clansmen": "Stirling Clansmen",
    "birmingham lions": "Birmingham Lions",
    "hertfordshire hurricanes": "Hertfordshire Hurricanes",
    "southampton stags": "Southampton Stags",
    "surrey stingers": "Surrey Stingers",
    "greenwich mariners": "Greenwich Mariners",
    "essex blades": "Essex Blades",
    "uea pirates": "UEA Pirates",
    "reading knights": "Reading Knights",
    "sheffield sabres": "Sheffield Sabres",
    "sheffield hallam warriors": "Sheffield Hallam Warriors",
    "lancaster bombers": "Lancaster Bombers",
    "staffordshire stallions": "Staffordshire Stallions",
    "tarannau aberystwyth": "Tarannau Aberystwyth",
    "aberystwyth": "Tarannau Aberystwyth",
    "bath spa bulldogs": "Bath Spa Bulldogs",
    "worcester royals": "Worcester Royals",
    "uel phoenix": "UEL Phoenix",
    "huddersfield hawks": "Huddersfield Hawks",
    "durham saints": "Durham Saints",
    "edinburgh napier knights": "Edinburgh Napier Knights",
    "exeter demons": "Exeter Demons",
    "gloucestershire gladiators": "Gloucestershire Gladiators",
    "imperial immortals": "Imperial Immortals",
    "kent falcons": "Kent Falcons",
    "lincoln colonials": "Lincoln Colonials",
    "plymouth blitz": "Plymouth Blitz",
    "portsmouth destroyers": "Portsmouth Destroyers",
    "solent redhawks": "Solent Redhawks",
    "team solent redhawks": "Solent Redhawks",
    "sunderland spartans": "Sunderland Spartans",
    "sunderland kings": "Sunderland Spartans",
    "sussex saxons": "Sussex Saxons",
    "uws pyros": "UWS Pyros",
    "warwick wolves": "Warwick Wolves",
    "liverpool fury": "LJMU Fury"
}

for k, v in manual_aliases.items():
    team_lookup[k] = v

def match_team(raw_name):
    norm = normalize(raw_name)
    if not norm:
        return None
    if norm in team_lookup:
        return team_lookup[norm]
    cleaned = re.sub(r'[^\w\s]', '', norm).strip()
    if cleaned in team_lookup:
        return team_lookup[cleaned]
    return None

def clean_text(text):
    text = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]+)\]\]', r'\1', text)
    text = re.sub(r"'''?", "", text)
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()

def parse_date(date_str):
    if not date_str:
        return None, None
    date_str = date_str.strip()
    # Try DD/MM/YY or DD/MM/YYYY
    m = re.search(r'(\d{1,2})[/\.-](\d{1,2})[/\.-](\d{2,4})', date_str)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if year < 100:
            year = 2000 + year if year < 80 else 1900 + year
        try:
            dt = datetime(year, month, day)
            iso_date = dt.strftime('%Y-%m-%d')
            season_year = f"{year}-{str(year+1)[-2:]}" if month >= 8 else f"{year-1}-{str(year)[-2:]}"
            return iso_date, season_year
        except ValueError:
            pass
    return None, None

def format_season(season_str):
    if not season_str:
        return ""
    season_str = season_str.replace('/', '-').strip()
    m = re.search(r'(\d{4})\s*[-–—]\s*(\d{2,4})', season_str)
    if m:
        start, end = m.group(1), m.group(2)
        if len(end) == 4:
            end = end[-2:]
        return f"{start}-{end}"
    return season_str

games_found = []

files = glob.glob('scratch/britball_wikitext/*.json')

for fpath in files:
    with open(fpath) as f:
        data = json.load(f)
    
    page_title = data['title']
    content = data['content']
    
    page_season = None
    season_match = re.search(r'(\d{4}\s*[-–—/]\s*\d{2,4})', page_title)
    if season_match:
        page_season = format_season(season_match.group(1))

    # Parse wikitext line by line, keeping track of current section heading
    current_section_season = page_season
    
    lines = content.split('\n')
    for line in lines:
        line_clean = clean_text(line)
        
        # Check section heading
        heading_m = re.search(r'==+\s*(.*?)\s*==+', line_clean)
        if heading_m:
            sec_text = heading_m.group(1)
            sec_season_m = re.search(r'(\d{4}\s*[-–—/]\s*\d{2,4})', sec_text)
            if sec_season_m:
                current_section_season = format_season(sec_season_m.group(1))
            elif page_season:
                current_section_season = page_season

        # Check for date in line
        line_date, inferred_season = parse_date(line_clean)
        game_season = inferred_season or current_section_season or page_season

        # --- PARSER 1: Wiki Tables (`{| ... |}`) ---
        # Look for table rows with scores
        if '|' in line and re.search(r'\d{1,3}\s*[-–—]\s*\d{1,3}', line_clean):
            pass # handled via block parser below

        # --- PARSER 2: Pattern: *(seed) Team A scoreA-scoreB (seed) Team B or Date - Team A scoreA - scoreB Team B ---
        m = re.search(r'(?:\*\s*)?(?:\d{1,2}[/\.-]\d{1,2}[/\.-]\d{2,4}\s*[-–—]\s*)?(?:\(\d+\)\s*)?([A-Za-z0-9\s\'\.]+?)\s+(\d{1,3})\s*[-–—]\s*(\d{1,3})\s+(?:\(\d+\)\s*)?([A-Za-z0-9\s\'\.]+)', line_clean)
        if m:
            t1_raw, s1, s2, t2_raw = m.group(1).strip(), int(m.group(2)), int(m.group(3)), m.group(4).strip()
            if not any(w in t1_raw.lower() or w in t2_raw.lower() for w in ['season', 'bowl', 'conference', 'division', 'record', 'round', 'roster', 'rosters']):
                t1_match = match_team(t1_raw)
                t2_match = match_team(t2_raw)
                if t1_match and t2_match and t1_match != t2_match:
                    games_found.append({
                        'date': line_date or '',
                        'home_team': t1_match,
                        'away_team': t2_match,
                        'home_score': s1,
                        'away_score': s2,
                        'season': game_season or '',
                        'source_page': page_title,
                        'notes': line_clean,
                        'type': 'line_match'
                    })

        # Pattern 2b: Team A scoreA, Team B scoreB (e.g. "Cardiff Cobras 26, Stirling Clansmen 6")
        m2 = re.search(r'([A-Za-z0-9\s\'\.]+?)\s+(\d{1,3})\s*,\s*([A-Za-z0-9\s\'\.]+?)\s+(\d{1,3})', line_clean)
        if m2:
            t1_raw, s1, t2_raw, s2 = m2.group(1).strip(), int(m2.group(2)), m2.group(3).strip(), int(m2.group(4))
            t1_match = match_team(t1_raw)
            t2_match = match_team(t2_raw)
            if t1_match and t2_match and t1_match != t2_match:
                games_found.append({
                    'date': line_date or '',
                    'home_team': t1_match,
                    'away_team': t2_match,
                    'home_score': s1,
                    'away_score': s2,
                    'season': game_season or '',
                    'source_page': page_title,
                    'notes': line_clean,
                    'type': 'line_comma'
                })

    # --- PARSER 3: Wiki Tables block parser ---
    table_blocks = re.findall(r'\{\|(?:.*?)\|\}', content, re.DOTALL)
    for tbl in table_blocks:
        rows = tbl.split('|-')
        for row in rows:
            cells = [clean_text(c) for c in row.split('\n|') if c.strip() and not c.strip().startswith('{') and not c.strip().startswith('}')]
            if len(cells) >= 3:
                for idx, c in enumerate(cells):
                    score_m = re.search(r'^\s*(\d{1,3})\s*[-–—]\s*(\d{1,3})\s*$', c)
                    if score_m:
                        score_a = int(score_m.group(1))
                        score_b = int(score_m.group(2))
                        team1_raw = cells[idx-1] if idx > 0 else ""
                        team2_raw = cells[idx+1] if idx+1 < len(cells) else ""
                        comment = cells[idx+2] if idx+2 < len(cells) else ""
                        
                        team1_match = match_team(team1_raw)
                        team2_match = match_team(team2_raw)
                        
                        if team1_match and team2_match:
                            games_found.append({
                                'date': '',
                                'home_team': team2_match,
                                'away_team': team1_match,
                                'home_score': score_b,
                                'away_score': score_a,
                                'season': page_season or '',
                                'source_page': page_title,
                                'notes': comment,
                                'type': 'table'
                            })

# Deduplicate games by (home_team, away_team, home_score, away_score, season)
deduped_games = {}
for g in games_found:
    key = (g['home_team'], g['away_team'], g['home_score'], g['away_score'], g['season'])
    rev_key = (g['away_team'], g['home_team'], g['away_score'], g['home_score'], g['season'])
    
    # If key already exists, merge missing date or season
    if key in deduped_games:
        if not deduped_games[key]['date'] and g['date']:
            deduped_games[key]['date'] = g['date']
        if not deduped_games[key]['season'] and g['season']:
            deduped_games[key]['season'] = g['season']
    elif rev_key in deduped_games:
        if not deduped_games[rev_key]['date'] and g['date']:
            deduped_games[rev_key]['date'] = g['date']
        if not deduped_games[rev_key]['season'] and g['season']:
            deduped_games[rev_key]['season'] = g['season']
    else:
        deduped_games[key] = g

print(f"Total raw extractions: {len(games_found)}")
print(f"Total deduplicated games: {len(deduped_games)}")

fieldnames = ['date', 'season', 'home_team', 'away_team', 'home_score', 'away_score', 'is_playoff', 'notes', 'source_page']

output_file = 'britball_wiki_games.csv'

with open(output_file, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    for g in deduped_games.values():
        is_playoff = any(k in g['notes'].lower() for k in ['playoff', 'bowl', 'round', 'quarter', 'semi', 'wildcard'])
        writer.writerow({
            'date': g['date'],
            'season': g['season'],
            'home_team': g['home_team'],
            'away_team': g['away_team'],
            'home_score': g['home_score'],
            'away_score': g['away_score'],
            'is_playoff': is_playoff,
            'notes': g['notes'],
            'source_page': g['source_page']
        })

print(f"Successfully wrote CSV to {output_file}")
