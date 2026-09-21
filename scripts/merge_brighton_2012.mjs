import fs from 'fs';
import { parse } from 'csv-parse/sync';

function formatCSVDate(dateStr) {
    if (!dateStr) return '';
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            return `${year}-${month}-${day}`;
        }
    }
    return dateStr;
}

function mergeBrighton2012() {
    console.log("Loading games2012.csv...");
    const games2012Content = fs.readFileSync('games2012.csv', 'utf-8');
    const games2012 = parse(games2012Content, { columns: true, skip_empty_lines: true, trim: true });

    console.log("Loading gamesbrighton.csv...");
    const brightonContent = fs.readFileSync('data/gamesbrighton.csv', 'utf-8');
    const brightonGames = parse(brightonContent, { columns: true, skip_empty_lines: true, trim: true });

    const brighton2012 = brightonGames.filter(g => g.year === '2012');
    console.log(`Found ${brighton2012.length} Brighton games for 2012/13 season.`);

    // Map Brighton games to standardized structure
    const formattedBrighton = brighton2012.map(g => {
        const dateISO = formatCSVDate(g.date);
        const homeTeam = g.home_team.trim();
        const awayTeam = g.away_team.trim();

        return {
            competition: 'BUAFL',
            year: '2012',
            phase: g.phase ? g.phase.trim() : 'South Eastern B',
            date: dateISO,
            away_team: awayTeam,
            home_team: homeTeam,
            away_score: parseInt(g.away_score),
            home_score: parseInt(g.home_score),
            venue: g.venue || '',
            notes: g.notes || 'Source: gamesbrighton.csv',
            away_coach: g.away_coach || '',
            home_coach: g.home_coach || '',
            is_double_header: g.is_double_header || 'FALSE',
            date_precision: g.date_precision || 'day',
            date_display: g.date_display || '',
            time: g.time || '13:00',
            status: g.status || 'completed',
            confidence_level: g.confidence_level || 'high',
            is_playoff: g.is_playoff || 'FALSE',
            is_title_game: 'FALSE',
            final_type: '',
            title_name: '',
            playoff_round: '',
            parent_phase: ''
        };
    });

    const isBrightonTeam = (name) => {
        if (!name) return false;
        const n = name.toLowerCase();
        return n.includes('brighton') || n.includes('tsunami');
    };

    // Filter out existing partial/un-detailed Brighton games from games2012 if we have a better record from gamesbrighton.csv
    const nonBrighton2012 = games2012.filter(g => {
        const homeIsBrighton = isBrightonTeam(g.home_team);
        const awayIsBrighton = isBrightonTeam(g.away_team);
        return !homeIsBrighton && !awayIsBrighton;
    });

    console.log(`Remaining non-Brighton games from 2012 newsflashes: ${nonBrighton2012.length}`);

    const mergedGames = [...nonBrighton2012, ...formattedBrighton];
    mergedGames.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    console.log(`Total merged 2012/13 games count: ${mergedGames.length}`);

    const headers = [
        'competition', 'year', 'phase', 'date', 'away_team', 'home_team',
        'away_score', 'home_score', 'venue', 'notes', 'away_coach', 'home_coach',
        'is_double_header', 'date_precision', 'date_display', 'time', 'status',
        'confidence_level', 'is_playoff', 'is_title_game', 'final_type',
        'title_name', 'playoff_round', 'parent_phase'
    ];

    let csvContent = headers.join(',') + '\n';
    for (const g of mergedGames) {
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

    fs.writeFileSync('games2012.csv', csvContent, 'utf-8');
    if (fs.existsSync('data/BUAFL')) {
        fs.writeFileSync('data/BUAFL/games2012.csv', csvContent, 'utf-8');
    }
    console.log("Successfully merged Brighton games into games2012.csv!");
}

mergeBrighton2012();
