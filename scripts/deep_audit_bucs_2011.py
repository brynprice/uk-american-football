import csv
import openpyxl

wb = openpyxl.load_workbook('data/BUCS_2011_12_Results.xlsx', data_only=True)
sheet = wb.active

af_rows = []
for row in sheet.iter_rows(values_only=True):
    sport = str(row[1] or '')
    if 'american football' in sport.lower():
        af_rows.append(row)

print(f"Total AF rows in BUCS_2011_12_Results.xlsx: {len(af_rows)}")

# Load games2011.csv and games2012.csv
with open('data/BUAFL/games2011.csv', 'r') as f:
    g2011 = list(csv.DictReader(f))
with open('data/BUAFL/games2012.csv', 'r') as f:
    g2012 = list(csv.DictReader(f))

print(f"Loaded {len(g2011)} games in games2011.csv and {len(g2012)} games in games2012.csv")

for idx, r in enumerate(af_rows):
    season_str = r[0]
    comp = r[3]
    date_val = str(r[4])
    home = r[6]
    home_score = r[7]
    away_score = r[8]
    away = r[9]
    notes = r[12]
    
    # Check if this exact score appears in 2011 or 2012
    found_2011 = []
    for g in g2011:
        if (home.split()[0] in g['home_team'] or home.split()[0] in g['away_team']) and (away.split()[0] in g['away_team'] or away.split()[0] in g['home_team']):
            found_2011.append(g)
            
    found_2012 = []
    for g in g2012:
        if (home.split()[0] in g['home_team'] or home.split()[0] in g['away_team']) and (away.split()[0] in g['away_team'] or away.split()[0] in g['home_team']):
            found_2012.append(g)
            
    print(f"\nRow {idx+1}: {comp} | Date: {date_val} | {home} {home_score} - {away_score} {away}")
    if found_2011:
        for f in found_2011:
            print(f"   In 2011: date={f['date']} | {f['away_team']} @ {f['home_team']} ({f['away_score']}-{f['home_score']}) | source={f.get('notes', '')[:40]}")
    else:
        print("   In 2011: NOT FOUND")
    if found_2012:
        for f in found_2012:
            print(f"   In 2012: date={f['date']} | {f['away_team']} @ {f['home_team']} ({f['away_score']}-{f['home_score']}) | source={f.get('notes', '')[:40]}")
    else:
        print("   In 2012: NOT FOUND")
