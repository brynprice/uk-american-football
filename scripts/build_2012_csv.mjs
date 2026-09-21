import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function build2012Csv() {
    console.log("Fetching teams & aliases from Supabase for 2012...");
    const { data: teams } = await supabase.from('teams').select('id, name');
    const { data: aliases } = await supabase.from('team_aliases').select('alias, name, team_id, team:teams(name)');

    const aliasMap = new Map();
    if (aliases) {
        for (const a of aliases) {
            const aliasName = a.alias || a.name;
            if (aliasName && a.team && a.team.name) {
                aliasMap.set(aliasName.toLowerCase().trim(), a.team.name);
            }
        }
    }

    const teamNamesList = (teams || []).map(t => t.name);

    const bafraCustomMap = {
        'predators': 'Edinburgh Predators',
        'edinburgh predators': 'Edinburgh Predators',
        'stirling clansmen': 'Stirling Clansmen',
        'stirling': 'Stirling Clansmen',
        'tigers': 'Glasgow Tigers',
        'glasgow tigers': 'Glasgow Tigers',
        'uws pyros': 'UWS Pyros',
        'pyros': 'UWS Pyros',
        'bears': 'Bradford Bears',
        'bradford bears': 'Bradford Bears',
        'sunderland spartans': 'Sunderland Spartans',
        'spartans': 'Sunderland Spartans',
        'celtics': 'Leeds Celtics',
        'leeds celtics': 'Leeds Celtics',
        'teesside cougars': 'Teesside Cougars',
        'cougars': 'Teesside Cougars',
        'carnegie': 'Leeds Met Carnegie',
        'leeds carnegie': 'Leeds Met Carnegie',
        'northumbria mustangs': 'Northumbria Mustangs',
        'mustangs': 'Northumbria Mustangs',
        'braves': 'Derby Braves',
        'derby braves': 'Derby Braves',
        'bangor muddogs': 'Bangor MudDogs',
        'muddogs': 'Bangor MudDogs',
        'ljm fury': 'LJMU Fury',
        'fury': 'LJMU Fury',
        'mmu eagles': 'MMU Eagles',
        'eagles': 'MMU Eagles',
        'lions': 'Birmingham Lions',
        'birmingham lions': 'Birmingham Lions',
        'ntu renegades': 'Nottingham Trent Renegades',
        'renegades': 'Nottingham Trent Renegades',
        'outlaws': 'Nottingham Outlaws',
        'nottingham outlaws': 'Nottingham Outlaws',
        'loughborough aces': 'Loughborough Aces',
        'aces': 'Loughborough Aces',
        'wolves': 'Warwick Wolves',
        'warwick wolves': 'Warwick Wolves',
        'leicester longhorns': 'Leicester Longhorns',
        'longhorns': 'Leicester Longhorns',
        'wildcats': 'Wolverhampton Wildcats',
        'wolverhampton wildcats': 'Wolverhampton Wildcats',
        'lincoln colonials': 'Lincoln Colonials',
        'colonials': 'Lincoln Colonials',
        'bullets': 'UWE Bullets',
        'uwe bullets': 'UWE Bullets',
        'swansea titans': 'Swansea Titans',
        'titans': 'Swansea Titans',
        'panthers': 'OBU Panthers',
        'obu panthers': 'OBU Panthers',
        'solent redhawks': 'Solent Redhawks',
        'redhawks': 'Solent Redhawks',
        'buccaneers': 'BNU Buccaneers',
        'bnu buccaneers': 'BNU Buccaneers',
        'southampton stags': 'Southampton Stags',
        'stags': 'Southampton Stags',
        'rhul bears': 'Royal Holloway Bears',
        'brighton tsunami': 'Brighton Tsunami',
        'tsunami': 'Brighton Tsunami',
        'pirates': 'UEA Pirates',
        'uea pirates': 'UEA Pirates',
        'canterbury chargers': 'Canterbury CC Chargers',
        'chargers': 'Canterbury CC Chargers',
        'hurricanes': 'Hertfordshire Hurricanes',
        'hertfordshire hurricanes': 'Hertfordshire Hurricanes',
        'imperial immortals': 'Imperial Immortals',
        'immortals': 'Imperial Immortals',
        'blades': 'Essex Blades',
        'essex blades': 'Essex Blades',
        'cambridge pythons': 'Cambridge Pythons',
        'centurions': 'York Centurions',
        'york centurions': 'York Centurions',
        'raiders': 'Newcastle Raiders',
        'newcastle raiders': 'Newcastle Raiders',
        'sabres': 'Sheffield Sabres',
        'sheffield sabres': 'Sheffield Sabres',
        'bombers': 'Lancaster Bombers',
        'lancaster bombers': 'Lancaster Bombers',
        'stallions': 'Staffordshire Stallions',
        'staffordshire stallions': 'Staffordshire Stallions',
        'tyrants': 'Manchester Tyrants',
        'manchester tyrants': 'Manchester Tyrants',
        'hawks': 'Huddersfield Hawks',
        'huddersfield hawks': 'Huddersfield Hawks',
        'liverpool fury': 'LJMU Fury',
        'nemesis': 'Northampton Nemesis',
        'northampton nemesis': 'Northampton Nemesis',
        'falcons': 'DMU Falcons',
        'dmu falcons': 'DMU Falcons',
        'demons': 'Exeter Demons',
        'exeter demons': 'Exeter Demons',
        'worcester royals': 'Worcester Royals',
        'royals': 'Worcester Royals',
        'aberystwyth': 'Tarannau Aberystwyth',
        'tarannau aberystwyth': 'Tarannau Aberystwyth',
        'cardiff cobras': 'Cardiff Cobras',
        'cobras': 'Cardiff Cobras',
        'killer bees': 'Bath Killer Bees',
        'bath killer bees': 'Bath Killer Bees',
        'bath spa bulldogs': 'Bath Spa Bulldogs',
        'bulldogs': 'Bath Spa Bulldogs',
        'kingston cougars': 'Kingston Cougars',
        'kcl regents': 'KCL Regents',
        'regents': 'KCL Regents',
        'aru rhinos': 'Anglia Ruskin Rhinos',
        'rhinos': 'Anglia Ruskin Rhinos',
        'greenwich mariners': 'Greenwich Mariners',
        'mariners': 'Greenwich Mariners',
        'kent falcons': 'Kent Falcons'
    };

    function resolveTeam(raw) {
        if (!raw) return '';
        let clean = raw.replace(/RESULTS/gi, '').replace(/[.:;]$/, '').replace(/\s+/g, ' ').trim();
        let lower = clean.toLowerCase();
        
        if (bafraCustomMap[lower]) return bafraCustomMap[lower];
        if (aliasMap.has(lower)) return aliasMap.get(lower);
        
        for (const t of teamNamesList) {
            if (t.toLowerCase() === lower) return t;
        }

        for (const [key, val] of Object.entries(bafraCustomMap)) {
            if (lower.endsWith(key) || lower.startsWith(key)) return val;
        }
        for (const t of teamNamesList) {
            if (lower.endsWith(t.toLowerCase()) || lower.startsWith(t.toLowerCase())) return t;
        }

        return clean;
    }

    const issueDates = {
        "201242.htm": "2012-11-18",
        "201243.htm": "2012-11-25",
        "201245.htm": "2012-12-09",
        "201301.htm": "2013-01-20",
        "201302.htm": "2013-01-27",
        "201303.htm": "2013-02-03",
        "201304.htm": "2013-02-10"
    };

    const dirPath = "scratch/bafra_2012_html";
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.htm')).sort();

    const games = [];

    for (const file of files) {
        const filePath = path.join(dirPath, file);
        const html = fs.readFileSync(filePath, 'utf-8');
        const text = html.replace(/<style[\s\S]*?<\/style>/gi, '')
                         .replace(/<script[\s\S]*?<\/script>/gi, '')
                         .replace(/<[^>]+>/g, '\n')
                         .replace(/&nbsp;/g, ' ');

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const gdate = issueDates[file] || "2012-11-25";

        let inResults = false;
        let isPlayoff = false;
        let playoffRound = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.toUpperCase().includes('RESULTS')) {
                inResults = true;
            }

            if (inResults) {
                if (["DISCIPLINARY", "GAME MANAGEMENT", "NEXT WEEKEND", "THIS WEEKEND", "CALENDAR", "BAFANL", "MECHANICS"].some(w => line.toUpperCase().includes(w))) {
                    if (games.length > 0) inResults = false;
                }

                if (line.toUpperCase().includes("PLAYOFF") || line.toUpperCase().includes("CHAMPIONSHIP") || line.toUpperCase().includes("TROPHY") || line.toUpperCase().includes("FINAL")) {
                    isPlayoff = true;
                    if (line.toUpperCase().includes("FINAL")) playoffRound = "Final";
                }

                for (const len of [1, 2, 3, 4]) {
                    const str = lines.slice(i, i + len).join(' ');

                    // Pattern 1: Team1 Score1 - Score2 Team2
                    const m1 = str.match(/^([A-Za-z\s\'.&]+?)\s+(\d{1,3})\s*(?:-|–|—)\s*(\d{1,3})\s+([A-Za-z\s\'.&]+)$/);
                    // Pattern 2: Team1 Score1 v Team2 Score2
                    const m2 = str.match(/^([A-Za-z\s\'.&]+?)\s+(\d{1,3})\s+v\s+([A-Za-z\s\'.&]+?)\s+(\d{1,3})$/);

                    let t1, s1, s2, t2;
                    if (m1) {
                        [, t1, s1, s2, t2] = m1;
                    } else if (m2) {
                        [, t1, s1, t2, s2] = m2;
                    }

                    if (t1 && s1 !== undefined && s2 !== undefined && t2) {
                        const homeTeam = resolveTeam(t1);
                        const awayTeam = resolveTeam(t2);

                        if (homeTeam.length >= 3 && awayTeam.length >= 3 && homeTeam !== awayTeam) {
                            games.push({
                                competition: 'BUAFL',
                                year: '2012',
                                phase: isPlayoff ? 'Playoffs' : 'Regular Season',
                                date: gdate,
                                away_team: awayTeam,
                                home_team: homeTeam,
                                away_score: parseInt(s2),
                                home_score: parseInt(s1),
                                venue: '',
                                notes: `Scraped from BAFRA Newsflash ${file}`,
                                away_coach: '',
                                home_coach: '',
                                is_double_header: 'FALSE',
                                date_precision: 'day',
                                date_display: '',
                                time: '13:00',
                                status: 'completed',
                                confidence_level: 'high',
                                is_playoff: isPlayoff ? 'TRUE' : 'FALSE',
                                is_title_game: 'FALSE',
                                final_type: '',
                                title_name: '',
                                playoff_round: playoffRound || '',
                                parent_phase: ''
                            });
                            i += len - 1;
                            break;
                        }
                    }
                }
            }
        }
    }

    // Add specific awarded game from 201242.htm audit text if not present
    // e.g., Solent Redhawks 30-0 Reading Knights (Dec 2, 2012)
    games.push({
        competition: 'BUAFL',
        year: '2012',
        phase: 'Regular Season',
        date: '2012-12-02',
        away_team: 'Reading Knights',
        home_team: 'Solent Redhawks',
        away_score: 0,
        home_score: 30,
        venue: '',
        notes: 'Scraped from BAFRA Newsflash 201242.htm (Awarded game)',
        away_coach: '',
        home_coach: '',
        is_double_header: 'FALSE',
        date_precision: 'day',
        date_display: '',
        time: '13:00',
        status: 'completed',
        confidence_level: 'high',
        is_playoff: 'FALSE',
        is_title_game: 'FALSE',
        final_type: '',
        title_name: '',
        playoff_round: '',
        parent_phase: ''
    });

    // De-duplicate games
    const uniqueGames = [];
    const seen = new Set();
    for (const g of games) {
        const key = `${g.date}|${g.home_team}|${g.away_team}|${g.home_score}|${g.away_score}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueGames.push(g);
        }
    }

    console.log(`De-duplicated to ${uniqueGames.length} unique game records for 2012/13.`);

    // Write CSV
    const headers = [
        'competition', 'year', 'phase', 'date', 'away_team', 'home_team',
        'away_score', 'home_score', 'venue', 'notes', 'away_coach', 'home_coach',
        'is_double_header', 'date_precision', 'date_display', 'time', 'status',
        'confidence_level', 'is_playoff', 'is_title_game', 'final_type',
        'title_name', 'playoff_round', 'parent_phase'
    ];

    let csvContent = headers.join(',') + '\n';
    for (const g of uniqueGames) {
        const row = headers.map(h => {
            let val = g[h] ?? '';
            val = String(val).replace(/"/g, '""');
            if (val.includes(',') || val.includes('\n') || val.includes('"')) {
                val = `"${val}"`;
            }
            return val;
        });
        csvContent += row.join(',') + '\n';
    }

    if (!fs.existsSync('data/BUAFL')) {
        fs.mkdirSync('data/BUAFL', { recursive: true });
    }

    fs.writeFileSync('data/BUAFL/games2012.csv', csvContent, 'utf-8');
    fs.writeFileSync('games2012.csv', csvContent, 'utf-8');
    console.log("Saved data/BUAFL/games2012.csv and games2012.csv successfully!");
}

build2012Csv();
