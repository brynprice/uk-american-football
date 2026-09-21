import os
import glob
import re
from bs4 import BeautifulSoup
import pandas as pd

files = sorted(glob.glob("scratch/bafra_html/*.htm"))

def clean_name(name):
    name = re.sub(r'\s+', ' ', name).strip()
    # Normalize known abbreviations/aliases if needed
    replacements = {
        'RHUL Bears': 'Royal Holloway Bears',
        'OBU Panthers': 'Oxford Brookes University',
        'UH Sharks': 'Hull Sharks',
        'LJM Fury': 'LJMU Fury',
        'UCL Rams': 'UCLan Rams',
        'UCLAN Rams': 'UCLan Rams',
        'Stallions': 'Staffordshire Stallions',
        'Wildcats': 'Wolverhampton Wildcats',
        'Aces': 'Loughborough Aces',
        'Brighton Tsunami': 'Brighton Panthers', # Note: Brighton Tsunami was Brighton's team name in 2013/14
    }
    return replacements.get(name, name)

games = []

for fpath in files:
    fname = os.path.basename(fpath)
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        html = f.read()
    
    soup = BeautifulSoup(html, 'html.parser')
    text = soup.get_text()
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    
    # Extract Issue date
    issue_date = None
    for l in lines[:40]:
        m = re.search(r'(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(20\d\d)', l)
        if m:
            day, month_str, year = m.group(1), m.group(2), m.group(3)
            issue_date = f"{day} {month_str} {year}"
            break

    # Look for RESULTS section
    in_results = False
    current_phase = "Regular Season"
    is_playoff = False
    
    for i, line in enumerate(lines):
        if "RESULTS" in line.upper():
            in_results = True
            continue
        
        if in_results:
            if any(stop_word in line.upper() for stop_word in ["DISCIPLINARY", "GAME MANAGEMENT", "NEXT WEEKEND", "THIS WEEKEND", "CALENDAR", "BAFANL", "MECHANICS", "COLLEGE", "STANDINGS"]):
                in_results = False
                continue

            # Check if division header or playoff header
            if "PLAYOFF" in line.upper() or "CHAMPIONSHIP" in line.upper() or "TROPHY" in line.upper() or "FINAL" in line.upper():
                current_phase = line
                if "PLAYOFF" in line.upper() or "FINAL" in line.upper():
                    is_playoff = True

            # Match score patterns in single line:
            # e.g., "Edinburgh Predators 18-21 Glasgow Tigers"
            # "Stirling 38 – 0 Sheffield Hallam"
            # "Stirling Clansmen 48 v Sheffield Sabres 7"
            # "Stirling 20 - Birmingham 15"
            
            # Pattern 1: Team1 Score1 - Score2 Team2
            m1 = re.search(r'^([A-Za-z\s\'.&]+?)\s+(\d{1,3})\s*(?:-|–|—|v\.?)\s*(\d{1,3})\s+([A-Za-z\s\'.&]+)$', line)
            
            # Pattern 2: Team1 Score1 v Team2 Score2
            m2 = re.search(r'^([A-Za-z\s\'.&]+?)\s+(\d{1,3})\s+v\s+([A-Za-z\s\'.&]+?)\s+(\d{1,3})$', line)
            
            # Pattern 3: Team1 Score1 v/vs Team2 (no score 2 or v syntax)
            
            if m1:
                t1, s1, s2, t2 = m1.groups()
                games.append({
                    'file': fname,
                    'issue_date': issue_date,
                    'phase': current_phase,
                    'is_playoff': is_playoff,
                    'team1': clean_name(t1),
                    'score1': int(s1),
                    'score2': int(s2),
                    'team2': clean_name(t2),
                    'raw': line
                })
            elif m2:
                t1, s1, t2, s2 = m2.groups()
                games.append({
                    'file': fname,
                    'issue_date': issue_date,
                    'phase': current_phase,
                    'is_playoff': is_playoff,
                    'team1': clean_name(t1),
                    'score1': int(s1),
                    'score2': int(s2),
                    'team2': clean_name(t2),
                    'raw': line
                })

print(f"Total games parsed via regex pattern: {len(games)}")
df = pd.DataFrame(games)
print(df.head(20).to_string())
