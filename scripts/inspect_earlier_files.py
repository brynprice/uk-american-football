import os
import glob
from bs4 import BeautifulSoup

target_files = ["201342.htm", "201343.htm", "201344.htm", "201345.htm", "201346.htm", "201401.htm", "201402.htm", "201403.htm"]

for fname in target_files:
    fpath = os.path.join("scratch/bafra_html", fname)
    if not os.path.exists(fpath):
        print(f"File {fname} does not exist")
        continue
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        html = f.read()
    soup = BeautifulSoup(html, 'html.parser')
    text = soup.get_text()
    
    print(f"\n================ {fname} ================")
    print("Length of text:", len(text))
    # Search for any digits with hyphen/dash/v or score patterns
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    score_lines = [l for l in lines if any(char.isdigit() for char in l) and any(sep in l for sep in ['-', '–', '—', ' v ', ' v. '])]
    print(f"Found {len(score_lines)} potential score lines")
    for sl in score_lines[:15]:
        print("  ", sl)
