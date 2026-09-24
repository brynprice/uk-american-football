import glob
import json
import re
import csv
from datetime import datetime

with open('scratch_university_teams.json') as f:
    teams_db = json.load(f)

team_lookup = {}

def normalize(name):
    if not name:
        return ""
    name = re.sub(r'<[^>]+>', '', name)
    name = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]+)\]\]', r'\1', name)
    name = re.sub(r'http\S+', '', name)
    name = re.sub(r"'''?", "", name)
    name = re.sub(r'\([^\)]*\)', '', name)
    name = re.sub(r'^\s*\(?\d+\)?\s*', '', name)
    name = re.sub(r'^\d+\s*[-–—]\s*', '', name)
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
    "royal holloway vikings": "Royal Holloway Bears",
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
    "staffs stallions": "Staffordshire Stallions",
    "tarannau aberystwyth": "Tarannau Aberystwyth",
    "tarranau aberystwyth": "Tarannau Aberystwyth",
    "aberystwyth": "Tarannau Aberystwyth",
    "bath spa bulldogs": "Bath Spa Bulldogs",
    "worcester royals": "Worcester Royals",
    "uel phoenix": "UEL Phoenix",
    "huddersfield hawks": "Huddersfield Hawks",
    "durham saints": "Durham Saints",
    "edinburgh napier knights": "Edinburgh Napier Knights",
    "exeter demons": "Exeter Demons",
    "exeter deamons": "Exeter Demons",
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
    m = re.search(r'(\d{4})\s*[-–—/]\s*(\d{2,4})', season_str)
    if m:
        start, end = m.group(1), m.group(2)
        if len(end) == 4:
            end = end[-2:]
        return f"{start}-{end}"
    m2 = re.search(r'^(\d{2})\s*[-–—/]\s*(\d{2})$', season_str)
    if m2:
        s1, s2 = int(m2.group(1)), m2.group(2)
        start_full = 2000 + s1 if s1 < 80 else 1900 + s1
        return f"{start_full}-{s2}"
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

    current_season = page_season
    in_summary_section = False
    
    lines = content.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i]
        line_clean = clean_text(line)
        
        # Heading check
        heading_m = re.search(r'==+\s*(.*?)\s*==+', line_clean)
        if heading_m:
            sec_text = heading_m.group(1)
            sec_lower = sec_text.lower()
            
            if any(s in sec_lower for s in ['summary', 'per opponent', 'team records by season', 'all time records', 'single season', 'single game', 'roster', 'statistical records']):
                in_summary_section = True
            else:
                in_summary_section = False
                sec_season_m = re.search(r'(\d{2,4}\s*[-–—/]\s*\d{2,4})', sec_text)
                if sec_season_m:
                    current_season = format_season(sec_season_m.group(1))
                elif page_season:
                    current_season = page_season
        
        if in_summary_section:
            i += 1
            continue

        # Check for wiki table start
        if line.strip().startswith('{|'):
            table_lines = []
            while i < len(lines) and not lines[i].strip().startswith('|}'):
                table_lines.append(lines[i])
                i += 1
            if i < len(lines):
                table_lines.append(lines[i])
            
            tbl_full = '\n'.join(table_lines)
            tbl_lower = tbl_full.lower()
            
            if not any(h in tbl_lower for h in ['percentage', 'per opponent', 'all time total', 'carries', 'touchdowns', 'points for']):
                rows = tbl_full.split('|-')
                header_text = rows[0].lower() if len(rows) > 0 else ""
                
                for row in rows[1:]:
                    cells = [clean_text(c) for c in row.split('\n|') if c.strip() and not c.strip().startswith('{') and not c.strip().startswith('}')]
                    if not cells:
                        continue
                    
                    row_date, row_season = None, None
                    for cell in cells:
                        d, s = parse_date(cell)
                        if d:
                            row_date, row_season = d, s
                            break
                    
                    effective_season = row_season or current_season or page_season
                    
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
                            
                            if team1_match and team2_match and team1_match != team2_match:
                                games_found.append({
                                    'date': row_date or '',
                                    'home_team': team1_match,
                                    'away_team': team2_match,
                                    'home_score': score_a,
                                    'away_score': score_b,
                                    'season': effective_season or '',
                                    'source_page': page_title,
                                    'notes': comment or row.strip().replace('\n', ' '),
                                    'type': 'table'
                                })
            i += 1
            continue

        # Line parsing for non-table lines
        line_date, line_season = parse_date(line_clean)
        
        # Check if line contains explicit season e.g. "2007-08 - Team A 52-20 Team B"
        line_explicit_season = None
        line_season_m = re.search(r'(\d{4}\s*[-–—/]\s*\d{2,4})', line_clean)
        if line_season_m:
            line_explicit_season = format_season(line_season_m.group(1))
            
        effective_season = line_explicit_season or line_season or current_season or page_season
        
        # Pattern 2a: Team A scoreA-scoreB Team B
        m = re.search(r'(?:\*\s*)?(?:\d{4}\s*[-–—/]\s*\d{2,4}\s*[-–—]\s*)?(?:\d{1,2}[/\.-]\d{1,2}[/\.-]\d{2,4}\s*[-–—]\s*)?(?:\(\d+\)\s*)?([A-Za-z0-9\s\'\.]+?)\s+(\d{1,3})\s*[-–—]\s*(\d{1,3})\s+(?:\(\d+\)\s*)?([A-Za-z0-9\s\'\.]+)', line_clean)
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
                        'season': effective_season or '',
                        'source_page': page_title,
                        'notes': line_clean,
                        'type': 'line_match'
                    })
        
        i += 1

# Deduplicate games by (home_team, away_team, home_score, away_score, season)
deduped_games = {}
for g in games_found:
    key = (g['home_team'], g['away_team'], g['home_score'], g['away_score'], g['season'])
    rev_key = (g['away_team'], g['home_team'], g['away_score'], g['home_score'], g['season'])
    
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

empty_seasons = [g for g in deduped_games.values() if not g['season']]
print(f"Games with empty season: {len(empty_seasons)} / {len(deduped_games)}")

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
