import csv
import os
import re
from collections import defaultdict

input_file = 'britball_wiki_games.csv'
output_dir = 'data/BUAFL'

os.makedirs(output_dir, exist_ok=True)

with open(input_file, encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    rows = list(reader)

games_by_yyyy = defaultdict(list)

for r in rows:
    season = r['season']
    if not season:
        continue
    m = re.search(r'(\d{4})', season)
    if m:
        yyyy = m.group(1)
        games_by_yyyy[yyyy].append(r)

created_files = []
skipped_files = []

for yyyy, game_list in sorted(games_by_yyyy.items()):
    out_filename = f"games{yyyy}.csv"
    out_path = os.path.join(output_dir, out_filename)
    
    # Do not overwrite pre-existing comprehensive season files (like games2015.csv and games2023.csv)
    if os.path.exists(out_path):
        skipped_files.append((out_filename, len(game_list)))
        print(f"Skipped overwriting existing {out_path} ({len(game_list)} Britball Wiki games).")
        continue

    with open(out_path, 'w', newline='', encoding='utf-8') as out_f:
        writer = csv.DictWriter(out_f, fieldnames=fieldnames)
        writer.writeheader()
        for g in game_list:
            writer.writerow(g)
            
    created_files.append((out_filename, len(game_list)))
    print(f"Created {out_path} with {len(game_list)} games.")

print("\nSummary of created season files in data/BUAFL:")
for fname, count in created_files:
    print(f"  {fname}: {count} games")

if skipped_files:
    print("\nSummary of pre-existing files preserved in data/BUAFL:")
    for fname, count in skipped_files:
        print(f"  {fname}: preserved existing file ({count} Britball Wiki games)")
