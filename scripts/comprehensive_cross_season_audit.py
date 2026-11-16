import csv
import glob
import re
from collections import defaultdict

def parse_date(date_str):
    if not date_str:
        return None
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})$', date_str.strip())
    if m:
        return int(m.group(1)), int(m.group(2)), int(m.group(3))
    return None

def flip_date(y, m, d):
    if 1 <= d <= 12 and d != m:
        return y, d, m
    return None

def check_dataset(name, files, is_academic_year=True):
    print("\n" + "=" * 80)
    print(f"AUDITING DATASET: {name} ({len(files)} files)")
    print("=" * 80)

    games_by_year = {}
    for f in sorted(files):
        m = re.search(r'games(\d{4})\.csv', f)
        if not m:
            continue
        yr = int(m.group(1))
        games = []
        with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
            reader = csv.DictReader(fp)
            for idx, r in enumerate(reader):
                r['_row'] = idx + 2
                r['_file'] = f
                games.append(r)
        games_by_year[yr] = games

    # 1. Date window outliers
    outliers = []
    for yr, games in sorted(games_by_year.items()):
        for g in games:
            p = parse_date(g.get('date'))
            if not p:
                continue
            gy, gm, gd = p
            
            if is_academic_year:
                # Academic year: Sept Y to July Y+1
                valid = (gy == yr and gm >= 8) or (gy == yr + 1 and gm <= 7)
            else:
                # Calendar year (Senior / Sapphire typically spring/summer): Year Y
                valid = (gy == yr)

            if not valid:
                outliers.append((yr, g, gy, gm, gd))

    print(f"\n1. DATE WINDOW OUTLIERS (Dates outside season window): {len(outliers)}")
    for yr, g, gy, gm, gd in outliers:
        print(f"  [Season {yr}] Row {g['_row']} in {g['_file']}: Date '{g.get('date')}' | {g.get('away_team')} @ {g.get('home_team')} ({g.get('away_score')}-{g.get('home_score')}) | notes: {g.get('notes', '')[:60]}")

    # 2. Cross-season identical fixtures in adjacent years (Y vs Y+1)
    years = sorted(games_by_year.keys())
    cross_dupes = []
    for i in range(len(years) - 1):
        y1 = years[i]
        y2 = years[i + 1]
        for g1 in games_by_year[y1]:
            t1_away = (g1.get('away_team') or '').strip()
            t1_home = (g1.get('home_team') or '').strip()
            s1_away = (g1.get('away_score') or '').strip()
            s1_home = (g1.get('home_score') or '').strip()
            d1 = (g1.get('date') or '').strip()

            if not t1_away or not t1_home or s1_away == '' or s1_home == '':
                continue
            if s1_away == '0' and s1_home == '0':
                continue # ignore unplayed 0-0

            for g2 in games_by_year[y2]:
                t2_away = (g2.get('away_team') or '').strip()
                t2_home = (g2.get('home_team') or '').strip()
                s2_away = (g2.get('away_score') or '').strip()
                s2_home = (g2.get('home_score') or '').strip()
                d2 = (g2.get('date') or '').strip()

                if t1_away == t2_away and t1_home == t2_home and s1_away == s2_away and s1_home == s2_home:
                    # check date flip
                    p1 = parse_date(d1)
                    p2 = parse_date(d2)
                    is_flip = False
                    if p1 and p2:
                        f1 = flip_date(*p1)
                        if f1 == p2:
                            is_flip = True
                    cross_dupes.append({
                        'y1': y1, 'y2': y2,
                        'teams': f"{t1_away} @ {t1_home}",
                        'score': f"{s1_away}-{s1_home}",
                        'd1': d1, 'd2': d2,
                        'flip': is_flip,
                        'g1': g1, 'g2': g2
                    })

    print(f"\n2. CROSS-SEASON IDENTICAL FIXTURES & SCORES: {len(cross_dupes)}")
    for cd in cross_dupes:
        flip_tag = " *** [DATE FLIP MATCH!] ***" if cd['flip'] else ""
        print(f"  {cd['y1']} vs {cd['y2']}: {cd['teams']} ({cd['score']}) | d1={cd['d1']} vs d2={cd['d2']}{flip_tag}")
        print(f"     -> Season {cd['y1']} notes: {cd['g1'].get('notes', '')[:60]}")
        print(f"     -> Season {cd['y2']} notes: {cd['g2'].get('notes', '')[:60]}")

    # 3. Flipped-date candidates that would cross into another season
    print(f"\n3. FLIPPED-DATE LEAKAGE SEARCH (Any game with DD/MM flip landing in another season):")
    leakage = []
    for yr, games in games_by_year.items():
        if yr < 2011:
            continue
        for g in games:
            p = parse_date(g.get('date'))
            if not p:
                continue
            gy, gm, gd = p
            flipped = flip_date(gy, gm, gd)
            if not flipped:
                continue
            fy, fm, fd = flipped
            f_iso = f"{fy:04d}-{fm:02d}-{fd:02d}"

            if is_academic_year:
                f_season = fy if fm >= 8 else fy - 1
            else:
                f_season = fy

            if f_season != yr and f_season in games_by_year:
                # Check if this matchup exists in target season
                away = (g.get('away_team') or '').strip()
                home = (g.get('home_team') or '').strip()
                target_matches = [tg for tg in games_by_year[f_season] if (tg.get('away_team') == away and tg.get('home_team') == home) or (tg.get('away_team') == home and tg.get('home_team') == away)]
                if target_matches:
                    leakage.append((yr, f_season, g, target_matches[0], g.get('date'), f_iso))

    print(f"  Found {len(leakage)} flipped date matches connecting to another season:")
    for lyr, tyr, sg, tg, orig_d, flip_d in leakage:
        print(f"    Source Season {lyr} ({orig_d}) -> Flipped {flip_d} in Season {tyr} ({tg.get('date')}): {sg.get('away_team')} vs {sg.get('home_team')} ({sg.get('away_score')}-{sg.get('home_score')} vs {tg.get('away_score')}-{tg.get('home_score')})")

check_dataset('BUAFL / BUCS University Football', glob.glob('data/BUAFL/games*.csv'), is_academic_year=True)
check_dataset('NWFL Womens Series', glob.glob('data/NWFL/games*.csv'), is_academic_year=False)
