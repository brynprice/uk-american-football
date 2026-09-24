import glob
import json
import re
import csv
import urllib.parse
from datetime import datetime

# Load University teams and aliases from Supabase
with open('scratch_university_teams.json') as f:
    teams_db = json.load(f)

db_names_set = set()

def norm_key(s):
    if not s:
        return ""
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]+)\]\]', r'\1', s)
    s = re.sub(r'http\S+', '', s)
    s = re.sub(r"'''?", "", s)
    s = re.sub(r'\([^\)]*\)', '', s)
    s = re.sub(r'^\s*\(?\d+\)?\s*', '', s)
    s = re.sub(r'^\d+\s*[-–—]\s*', '', s)
    s = re.sub(r'^(the|a)\s+', '', s, flags=re.IGNORECASE)
    s = s.strip().lower()
    return s

for t in teams_db:
    db_names_set.add(norm_key(t['name']))
    for alias in t.get('team_aliases', []):
        db_names_set.add(norm_key(alias['name']))

shorthand_aliases = {
    "bristol bullets", "ut cougars", "uch sharks", "rhul bears", "bath bees",
    "staffs stallions", "tarranau aberystwyth", "exeter deamons", "sunderland kings",
    "destroyers", "destroyers ot", "liverpool fury", "ntu renegades",
    "hallam warriors", "lees carnegie", "team solent", "sheffield sabress",
    "david chorley bullets"
}

for sa in shorthand_aliases:
    db_names_set.add(sa)

def clean_webpage_team_name(raw_name):
    if not raw_name:
        return ""
    name = re.sub(r'<[^>]+>', '', raw_name)
    name = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]+)\]\]', r'\1', name)
    name = re.sub(r'http\S+', '', name)
    name = re.sub(r"'''?", "", name)
    name = re.sub(r'^\s*\(?\d+\)?\s*', '', name)
    name = re.sub(r'^\d+\s*[-–—]\s*', '', name)
    name = name.strip()
    
    if name == "Destroyers" or name == "Destroyers OT":
        return "Portsmouth Destroyers"
    if "destroyers are crap" in name.lower():
        return "Portsmouth Destroyers"
    if "derby braves. match forfitted" in name.lower():
        return "Derby Braves"
    if "david chorley bullets" in name.lower():
        return "Bristol Bullets"
        
    return name

def is_db_team(raw_name):
    cleaned = clean_webpage_team_name(raw_name)
    nk = norm_key(cleaned)
    if not nk:
        return False
    return nk in db_names_set

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

def make_wiki_url(title):
    formatted_title = title.replace(' ', '_')
    return f"https://britball.fandom.com/wiki/{urllib.parse.quote(formatted_title)}"

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

        # Wiki table parser
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
                            
                            t1_name = clean_webpage_team_name(team1_raw)
                            t2_name = clean_webpage_team_name(team2_raw)
                            
                            if t1_name and t2_name and (is_db_team(t1_name) or is_db_team(t2_name)):
                                games_found.append({
                                    'date': row_date or '',
                                    'home_team': t1_name,
                                    'away_team': t2_name,
                                    'home_score': score_a,
                                    'away_score': score_b,
                                    'season': effective_season or '',
                                    'source_page': make_wiki_url(page_title),
                                    'notes': comment or row.strip().replace('\n', ' ')
                                })
            i += 1
            continue

        # Line parser
        line_date, line_season = parse_date(line_clean)
        line_explicit_season = None
        line_season_m = re.search(r'(\d{4}\s*[-–—/]\s*\d{2,4})', line_clean)
        if line_season_m:
            line_explicit_season = format_season(line_season_m.group(1))
            
        effective_season = line_explicit_season or line_season or current_season or page_season
        
        m = re.search(r'(?:\*\s*)?(?:\d{4}\s*[-–—/]\s*\d{2,4}\s*[-–—]\s*)?(?:\d{1,2}[/\.-]\d{1,2}[/\.-]\d{2,4}\s*[-–—]\s*)?(?:\(\d+\)\s*)?([A-Za-z0-9\s\'\.]+?)\s+(\d{1,3})\s*[-–—]\s*(\d{1,3})\s+(?:\(\d+\)\s*)?([A-Za-z0-9\s\'\.]+)', line_clean)
        if m:
            t1_raw, s1, s2, t2_raw = m.group(1).strip(), int(m.group(2)), int(m.group(3)), m.group(4).strip()
            if not any(w in t1_raw.lower() or w in t2_raw.lower() for w in ['season', 'bowl', 'conference', 'division', 'record', 'round', 'roster', 'rosters']):
                t1_name = clean_webpage_team_name(t1_raw)
                t2_name = clean_webpage_team_name(t2_raw)
                if t1_name and t2_name and (is_db_team(t1_name) or is_db_team(t2_name)):
                    games_found.append({
                        'date': line_date or '',
                        'home_team': t1_name,
                        'away_team': t2_name,
                        'home_score': s1,
                        'away_score': s2,
                        'season': effective_season or '',
                        'source_page': make_wiki_url(page_title),
                        'notes': line_clean
                    })
        
        i += 1

# Deduplicate
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

# Removed 'notes' from fieldnames
fieldnames = ['date', 'season', 'home_team', 'away_team', 'home_score', 'away_score', 'is_playoff', 'source_page']

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
            'source_page': g['source_page']
        })

print(f"Successfully written CSV to {output_file}")
