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

async function build2013Csv() {
    console.log("Fetching teams & aliases from Supabase...");
    const { data: teams } = await supabase.from('teams').select('id, name');
    const { data: aliases } = await supabase.from('team_aliases').select('alias, team_id, team:teams(name)');

    const aliasMap = new Map();
    if (aliases) {
        for (const a of aliases) {
            if (a.team && a.team.name) {
                aliasMap.set(a.alias.toLowerCase().trim(), a.team.name);
            }
        }
    }

    const teamNamesList = (teams || []).map(t => t.name);

    const bafraCustomMap = {
        'rhul bears': 'Royal Holloway Bears',
        'obu panthers': 'Oxford Brookes University',
        'uh sharks': 'Hull Sharks',
        'ljm fury': 'LJMU Fury',
        'ucl rams': 'UCLan Rams',
        'uclan rams': 'UCLan Rams',
        'stallions': 'Staffordshire Stallions',
        'wildcats': 'Wolverhampton Wildcats',
        'aces': 'Loughborough Aces',
        'brighton tsunami': 'Brighton Panthers',
        'brighton': 'Brighton Panthers',
        'stirling': 'Stirling Clansmen',
        'hertfordshire': 'Hertfordshire Hurricanes',
        'birmingham': 'Birmingham Lions',
        'durham': 'Durham Saints',
        'imperial': 'Imperial Immortals',
        'derby': 'Derby Braves',
        'bath': 'Bath Killer Bees',
        'sheffield': 'Sheffield Sabres',
        'swansea': 'Swansea Titans',
        'portsmouth': 'Portsmouth Destroyers',
        'leeds carnegie': 'Leeds Beckett Carnegie',
        'nottingham': 'Nottingham Outlaws',
        'ntu': 'Nottingham Trent Renegades',
        'ntu renegades': 'Nottingham Trent Renegades',
        'exeter': 'Exeter Demons',
        'royal holloway': 'Royal Holloway Bears',
        'east anglia': 'UEA Pirates',
        'kent': 'Kent Falcons',
        'surrey': 'Surrey Stingers',
        'glasgow': 'Glasgow Tigers',
        'hallam warriors': 'Sheffield Hallam Warriors',
        'sheffield hallam': 'Sheffield Hallam Warriors',
        'sheffield hallam warriors': 'Sheffield Hallam Warriors',
        'uclan': 'UCLan Rams',
        'sunderland': 'Sunderland Spartans',
        'cambridge': 'Cambridge Pythons',
        'loughborough': 'Loughborough Aces',
        'kingston': 'Kingston Cougars',
        'southampton': 'Southampton Stags',
        'newcastle': 'Newcastle Raiders',
        'leeds': 'Leeds Beckett Carnegie',
        'city': 'City Wolfpack',
        'city sentinels': 'City Wolfpack',
        'canterbury chargers': 'Canterbury CC Chargers',
        'coventry jets': 'Coventry University Jets',
        'gladiators': 'Gloucester Gladiators'
    };

    function resolveTeam(raw) {
        if (!raw) return '';
        let clean = raw.replace(/RESULTS/gi, '').replace(/\s+/g, ' ').trim();
        let lower = clean.toLowerCase();
        
        if (bafraCustomMap[lower]) return bafraCustomMap[lower];
        if (aliasMap.has(lower)) return aliasMap.get(lower);
        
        for (const t of teamNamesList) {
            if (t.toLowerCase() === lower) return t;
        }

        // Try extracting sub-phrases matching known teams from clean string
        for (const [key, val] of Object.entries(bafraCustomMap)) {
            if (lower.endsWith(key) || lower.startsWith(key)) return val;
        }
        for (const t of teamNamesList) {
            if (lower.endsWith(t.toLowerCase()) || lower.startsWith(t.toLowerCase())) return t;
        }

        return clean;
    }

    const issueDates = {
        "201342.htm": "2013-11-03",
        "201343.htm": "2013-11-10",
        "201344.htm": "2013-11-17",
        "201345.htm": "2013-11-24",
        "201346.htm": "2013-12-01",
        "201347.htm": "2013-12-08",
        "201401.htm": "2014-01-19",
        "201402.htm": "2014-01-26",
        "201403.htm": "2014-01-26",
        "201404.htm": "2014-01-26",
        "201405.htm": "2014-02-02",
        "201406.htm": "2014-02-09",
        "201407.htm": "2014-02-16",
        "201408.htm": "2014-02-23",
        "201409.htm": "2014-03-02",
        "201410.htm": "2014-03-09",
        "201411.htm": "2014-03-16",
        "201412.htm": "2014-03-23",
        "201413.htm": "2014-03-29",
    };

    const dirPath = "scratch/bafra_html";
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
        const gdate = issueDates[file] || "2013-11-01";

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
                    else if (file.includes("10")) playoffRound = "Wildcard";
                    else if (file.includes("11")) playoffRound = "Quarterfinal";
                    else if (file.includes("12")) playoffRound = "Semifinal";
                }

                for (const len of [1, 2, 3]) {
                    const str = lines.slice(i, i + len).join(' ');

                    // Pattern 1: Team1 Score1 - Score2 Team2
                    const m1 = str.match(/^([A-Za-z\s\'.&]+?)\s+(\d{1,3})\s*(?:-|–|—)\s*(\d{1,3})\s+([A-Za-z\s\'.&]+)$/);
                    // Pattern 2: Team1 Score1 v Team2 Score2
                    const m2 = str.match(/^([A-Za-z\s\'.&]+?)\s+(\d{1,3})\s+v\s+([A-Za-z\s\'.&]+?)\s+(\d{1,3})$/);
                    // Pattern 3: Championship Final: Team1 Score1 - Team2 Score2
                    const m3 = str.match(/^([A-Za-z\s\'.&]+?)\s+Final:\s*([A-Za-z\s\'.&]+?)\s+(\d{1,3})\s*(?:-|–|—)\s*(\d{1,3})\s+([A-Za-z\s\'.&]+)$/);

                    let t1, s1, s2, t2;
                    if (m3) {
                        [, , t1, s1, s2, t2] = m3;
                    } else if (m1) {
                        [, t1, s1, s2, t2] = m1;
                    } else if (m2) {
                        [, t1, s1, t2, s2] = m2;
                    }

                    if (t1 && s1 !== undefined && s2 !== undefined && t2) {
                        const homeTeam = resolveTeam(t1);
                        const awayTeam = resolveTeam(t2);

                        // Basic sanity checks for team names
                        if (homeTeam.length >= 3 && awayTeam.length >= 3 && homeTeam !== awayTeam) {
                            games.push({
                                competition: 'BUAFL',
                                year: '2013',
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
                                is_title_game: playoffRound === 'Final' ? 'TRUE' : 'FALSE',
                                final_type: playoffRound === 'Final' ? 'title' : (isPlayoff ? 'playoff' : ''),
                                title_name: playoffRound === 'Final' ? 'National Championship' : '',
                                playoff_round: playoffRound || '',
                                parent_phase: ''
                            });
                            i += len - 1; // Advance loop index past matched lines
                            break;
                        }
                    }
                }
            }
        }
    }

    // De-duplicate games (by date, home_team, away_team, home_score, away_score)
    const uniqueGames = [];
    const seen = new Set();
    for (const g of games) {
        const key = `${g.date}|${g.home_team}|${g.away_team}|${g.home_score}|${g.away_score}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueGames.push(g);
        }
    }

    console.log(`De-duplicated to ${uniqueGames.length} unique game records.`);

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

    fs.writeFileSync('data/BUAFL/games2013.csv', csvContent, 'utf-8');
    console.log("Saved data/BUAFL/games2013.csv successfully!");
}

build2013Csv();
