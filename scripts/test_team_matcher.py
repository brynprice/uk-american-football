import json
import re

with open('scratch_university_teams.json') as f:
    teams_db = json.load(f)

# Build a lookup map of normalized name -> team dict
name_to_team = {}

def normalize(name):
    if not name:
        return ""
    name = re.sub(r'\[\[|\]\]', '', name)
    name = re.sub(r'http\S+', '', name)
    name = re.sub(r'\([^\)]*\)', '', name) # remove parens e.g. (BUAFL) or (3)
    name = name.strip()
    name = re.sub(r'^\d+\s*', '', name) # remove leading seeds e.g. (8)
    name = re.sub(r'^(the|a)\s+', '', name, flags=re.IGNORECASE)
    name = name.strip()
    return name.lower()

# Map team names and aliases
team_lookup = {}

for t in teams_db:
    tname = t['name']
    norm_main = normalize(tname)
    team_lookup[norm_main] = t
    
    # Also add stripped versions without city/prefix if needed, or specific manual mappings
    for alias in t.get('team_aliases', []):
        aname = alias['name']
        team_lookup[normalize(aname)] = t

# Add manual variations commonly found in wiki texts
alias_additions = {
    "bristol bullets": "UWE Bullets",
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
    "manchester mps": "Manchester Tyrants", # wait, let's check Manchester MPs!
}

def match_team(raw_name):
    norm = normalize(raw_name)
    if norm in team_lookup:
        return team_lookup[norm]
    if norm in alias_additions:
        canonical_name = alias_additions[norm]
        for t in teams_db:
            if t['name'] == canonical_name:
                return t
    # Partial match attempt
    for key, team in team_lookup.items():
        if key and (key in norm or norm in key) and len(key) > 4 and len(norm) > 4:
            return team
    return None

if __name__ == "__main__":
    test_names = [
        "Cardiff Cobras", "Stirling Clansmen", "Hull Sharks", "UCH Sharks",
        "Bristol Bullets", "UT Cougars", "Leicester Lemmings", "Bath Bees",
        "Strathclyde Hawks", "Newcastle Scholars", "RHUL Bears"
    ]
    for n in test_names:
        m = match_team(n)
        print(f"'{n}' -> {m['name'] if m else 'NOT FOUND'}")
