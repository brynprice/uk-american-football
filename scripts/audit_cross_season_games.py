import csv
import glob
import os
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
    # If d <= 12 and d != m, flip month and day
    if 1 <= d <= 12 and d != m:
        return y, d, m
    return None

def main():
    print("=" * 80)
    print("COMPREHENSIVE AUDIT: CROSS-SEASON FIXTURE & DATE ANOMALIES (BUAFL / BUCS)")
    print("=" * 80)

    season_files = sorted(glob.glob('data/BUAFL/games*.csv'))
    games_by_season = {}
    
    for sf in season_files:
        m = re.search(r'games(\d{4})\.csv', sf)
        if not m:
            continue
        season_year = int(m.group(1))
        games = []
        with open(sf, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f)
            for idx, row in enumerate(reader):
                row['_row_num'] = idx + 2
                row['_file'] = sf
                row['_season'] = season_year
                games.append(row)
        games_by_season[season_year] = games

    print(f"Loaded {len(games_by_season)} seasons.")

    # ---------------------------------------------------------
    # 1. DATE BOUNDARY AUDIT: Games falling outside academic window
    # ---------------------------------------------------------
    print("\n" + "=" * 60)
    print("1. DATE BOUNDARY AUDIT (Academic year window: Sept Year Y to June Year Y+1)")
    print("=" * 60)
    
    date_outliers = []
    for yr, games in sorted(games_by_season.items()):
        if yr < 2000:
            continue
        for g in games:
            d_parts = parse_date(g.get('date'))
            if not d_parts:
                continue
            gy, gm, gd = d_parts
            
            # An academic season Y covers roughly Sept Y (month 9) to June Y+1 (month 6)
            is_valid_academic = False
            if gy == yr and gm >= 8: # Aug-Dec Year Y
                is_valid_academic = True
            elif gy == yr + 1 and gm <= 7: # Jan-July Year Y+1
                is_valid_academic = True
            
            if not is_valid_academic:
                date_outliers.append((yr, g, gy, gm, gd))

    print(f"Found {len(date_outliers)} games with dates OUTSIDE normal academic year:")
    for yr, g, gy, gm, gd in date_outliers:
        away = g.get('away_team')
        home = g.get('home_team')
        score = f"{g.get('away_score')}-{g.get('home_score')}"
        notes = g.get('notes', '')[:60]
        print(f"  [Season {yr}] Date: {g.get('date')} | {away} @ {home} ({score}) | Notes: {notes}")

    # ---------------------------------------------------------
    # 2. CROSS-SEASON EXACT OR CLOSE MATCHES (Season Y vs Season Y+1)
    # ---------------------------------------------------------
    print("\n" + "=" * 60)
    print("2. CROSS-SEASON DUPLICATE FIXTURE AUDIT (Same matchup & score across adjacent seasons)")
    print("=" * 60)
    
    cross_season_dupes = []
    all_years = sorted(games_by_season.keys())
    
    for i in range(len(all_years) - 1):
        y1 = all_years[i]
        y2 = all_years[i+1]
        
        # Only check recent / modern seasons
        if y1 < 2005:
            continue
            
        g_y1 = games_by_season[y1]
        g_y2 = games_by_season[y2]
        
        # Index g_y2 by teams and score
        for g1 in g_y1:
            t1_away = (g1.get('away_team') or '').strip()
            t1_home = (g1.get('home_team') or '').strip()
            s1_away = (g1.get('away_score') or '').strip()
            s1_home = (g1.get('home_score') or '').strip()
            d1 = g1.get('date', '').strip()
            notes1 = g1.get('notes', '')
            
            if not t1_away or not t1_home:
                continue
                
            for g2 in g_y2:
                t2_away = (g2.get('away_team') or '').strip()
                t2_home = (g2.get('home_team') or '').strip()
                s2_away = (g2.get('away_score') or '').strip()
                s2_home = (g2.get('home_score') or '').strip()
                d2 = g2.get('date', '').strip()
                notes2 = g2.get('notes', '')
                
                # Check match: Same teams in same orientation
                match = False
                reversed_match = False
                
                if t1_away == t2_away and t1_home == t2_home:
                    if s1_away != '' and s2_away != '' and s1_away == s2_away and s1_home == s2_home:
                        # Exclude 0-0 walkovers or common scores unless dates are suspicious
                        match = True
                elif t1_away == t2_home and t1_home == t2_away:
                    if s1_away != '' and s2_home != '' and s1_away == s2_home and s1_home == s2_away:
                        reversed_match = True
                        
                if match:
                    # Let's see if date in y1 is flipped from y2, or if date is identical, or blank
                    date_flip = False
                    p1 = parse_date(d1)
                    p2 = parse_date(d2)
                    if p1 and p2:
                        f1 = flip_date(*p1)
                        if f1 and f1 == p2:
                            date_flip = True
                    
                    cross_season_dupes.append({
                        'y1': y1, 'y2': y2,
                        'g1': g1, 'g2': g2,
                        'teams': f"{t1_away} @ {t1_home}",
                        'score': f"{s1_away}-{s1_home}",
                        'd1': d1, 'd2': d2,
                        'date_flip': date_flip,
                        'notes1': notes1,
                        'notes2': notes2
                    })

    print(f"Found {len(cross_season_dupes)} identical cross-season scorelines in adjacent seasons:")
    for d in cross_season_dupes:
        flip_tag = " [DATE FLIP DETECTED!]" if d['date_flip'] else ""
        print(f"  {d['y1']} vs {d['y2']}: {d['teams']} ({d['score']}) | d1={d['d1']} vs d2={d['d2']}{flip_tag}")
        if d['date_flip'] or 'BUCS' in d['notes1'] or 'BUCS' in d['notes2']:
            print(f"     -> Notes 1 ({d['y1']}): {d['notes1'][:60]}")
            print(f"     -> Notes 2 ({d['y2']}): {d['notes2'][:60]}")

    # ---------------------------------------------------------
    # 3. DATE FLIP CANDIDATES ACROSS ADJACENT SEASONS
    # ---------------------------------------------------------
    print("\n" + "=" * 60)
    print("3. FLIPPED DATE AUDIT (Any game with DD/MM transposed landing in adjacent season)")
    print("=" * 60)
    
    flipped_matches = []
    for yr, games in games_by_season.items():
        if yr < 2010:
            continue
        for g in games:
            d = g.get('date', '').strip()
            p = parse_date(d)
            if not p:
                continue
            gy, gm, gd = p
            flipped = flip_date(gy, gm, gd)
            if not flipped:
                continue
            
            fy, fm, fd = flipped
            f_iso = f"{fy:04d}-{fm:02d}-{fd:02d}"
            
            # Determine which season the flipped date would naturally belong to
            f_season = fy if fm >= 8 else fy - 1
            
            if f_season != yr and f_season in games_by_season:
                # Check if this fixture exists in f_season on that flipped date
                target_games = games_by_season[f_season]
                away = (g.get('away_team') or '').strip()
                home = (g.get('home_team') or '').strip()
                for tg in target_games:
                    t_away = (tg.get('away_team') or '').strip()
                    t_home = (tg.get('home_team') or '').strip()
                    t_date = tg.get('date', '').strip()
                    
                    if (away == t_away and home == t_home) or (away == t_home and home == t_away):
                        flipped_matches.append({
                            'source_season': yr,
                            'target_season': f_season,
                            'source_game': g,
                            'target_game': tg,
                            'orig_date': d,
                            'flipped_date': f_iso,
                            'target_date': t_date
                        })

    print(f"Found {len(flipped_matches)} flipped date cross-season matches:")
    for fm in flipped_matches:
        g = fm['source_game']
        tg = fm['target_game']
        print(f"  Source {fm['source_season']} ({fm['orig_date']}): {g.get('away_team')} @ {g.get('home_team')} ({g.get('away_score')}-{g.get('home_score')})")
        print(f"    -> Matches Target {fm['target_season']} ({tg.get('date')}): {tg.get('away_team')} @ {tg.get('home_team')} ({tg.get('away_score')}-{tg.get('home_score')})")

    # ---------------------------------------------------------
    # 4. ABNORMAL REGULAR SEASON GAME COUNTS PER TEAM
    # ---------------------------------------------------------
    print("\n" + "=" * 60)
    print("4. TEAM REGULAR SEASON GAME COUNT AUDIT (Identifying teams with too many games)")
    print("=" * 60)
    
    for yr in range(2011, 2027):
        if yr not in games_by_season:
            continue
        games = games_by_season[yr]
        team_reg_counts = defaultdict(int)
        head_to_head = defaultdict(int)
        
        for g in games:
            if (g.get('is_playoff') or '').strip().upper() == 'TRUE':
                continue
            away = (g.get('away_team') or '').strip()
            home = (g.get('home_team') or '').strip()
            if not away or not home:
                continue
            team_reg_counts[away] += 1
            team_reg_counts[home] += 1
            
            pair = tuple(sorted([away, home]))
            head_to_head[pair] += 1
            
        # Count frequencies of game counts
        count_dist = defaultdict(int)
        for t, c in team_reg_counts.items():
            count_dist[c] += 1
            
        modal_count = max(count_dist.items(), key=lambda x: x[1])[0] if count_dist else 8
        
        # Check teams with count > modal_count + 1 or count > 8
        high_game_teams = [(t, c) for t, c in team_reg_counts.items() if c > 8]
        if high_game_teams:
            print(f"\n[Season {yr}] Teams with > 8 regular season games (modal={modal_count}):")
            for t, c in sorted(high_game_teams, key=lambda x: -x[1]):
                print(f"    - {t}: {c} regular season games")
                
        # Check matchups played > 2 times in regular season
        many_matchups = [(pair, c) for pair, c in head_to_head.items() if c > 2]
        if many_matchups:
            print(f"  [Season {yr}] Matchups played > 2 times in regular season:")
            for pair, c in many_matchups:
                print(f"    - {pair[0]} vs {pair[1]}: {c} times!")

if __name__ == '__main__':
    main()
