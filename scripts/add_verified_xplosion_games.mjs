/**
 * Adds the 5 verified missing early xpLosION fixtures (2005, 2006, 2007, 2008, 2012)
 * to data/BUAFL/games<YYYY>.csv with canonical team names, primary citations, and nickname = 'xpLosION'.
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';

function toCSV(data, headers) {
    const rows = [headers];
    for (const row of data) {
        const values = headers.map(header => {
            const val = row[header];
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('\"') || str.includes('\n')) {
                return `\"${str.replace(/\"/g, '\"\"')}\"`;
            }
            return str;
        });
        rows.push(values);
    }
    return rows.map(r => r.join(',')).join('\n') + '\n';
}

const standardHeaders = [
    'competition', 'year', 'phase', 'date', 'away_team', 'home_team',
    'away_score', 'home_score', 'venue', 'notes', 'away_coach', 'home_coach',
    'is_double_header', 'date_precision', 'date_display', 'time', 'status',
    'confidence_level', 'is_playoff', 'is_title_game', 'final_type', 'title_name',
    'nickname', 'playoff_round', 'parent_phase', 'away_phase', 'away_parent_phase'
];

const games2012Headers = [
    'competition', 'year', 'date', 'date_precision', 'date_display', 'phase',
    'parent_phase', 'away_phase', 'away_parent_phase', 'away_team', 'away_score',
    'home_score', 'home_team', 'is_playoff', 'playoff_round', 'is_title_game',
    'final_type', 'title_name', 'nickname', 'is_double_header', 'game_type',
    'status', 'confidence_level', 'venue', 'home_coach', 'away_coach', 'notes'
];

// 1. 2005: Oxford Cavaliers 0 @ Birmingham Lions 59 (2005-11-05)
function update2005() {
    const file = 'data/BUAFL/games2005.csv';
    const raw = fs.readFileSync(file, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true });
    
    // Check if game already present
    const exists = records.some(r => r.date === '2005-11-05' && r.home_team === 'Birmingham Lions');
    if (!exists) {
        records.push({
            competition: 'bcafl',
            year: '2005',
            phase: 'Central Division',
            date: '2005-11-05',
            away_team: 'Oxford Cavaliers',
            home_team: 'Birmingham Lions',
            away_score: '0',
            home_score: '59',
            venue: '',
            notes: 'xpLosION 2005 (Inaugural edition). Source: BCAFL contemporary official archives',
            away_coach: '',
            home_coach: '',
            is_double_header: 'FALSE',
            date_precision: 'day',
            date_display: '05/11/2005',
            time: '18:30',
            status: 'completed',
            confidence_level: 'high',
            is_playoff: 'FALSE',
            is_title_game: 'FALSE',
            final_type: '',
            title_name: '',
            nickname: 'xpLosION',
            playoff_round: '',
            parent_phase: 'Southern Conference',
            away_phase: 'Central Division',
            away_parent_phase: 'Southern Conference'
        });
        fs.writeFileSync(file, toCSV(records, standardHeaders));
        console.log('Updated games2005.csv with xpLosION 2005 (Oxford Cavaliers @ Birmingham Lions)');
    }
}

// 2. 2006: Tarannau Aberystwyth 12 @ Birmingham Lions 28 (2006-11-04)
function update2006() {
    const file = 'data/BUAFL/games2006.csv';
    const raw = fs.readFileSync(file, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true });
    
    const exists = records.some(r => r.date === '2006-11-04' && r.home_team === 'Birmingham Lions');
    if (!exists) {
        records.push({
            competition: 'bcafl',
            year: '2006',
            phase: 'Central Division',
            date: '2006-11-04',
            away_team: 'Tarannau Aberystwyth',
            home_team: 'Birmingham Lions',
            away_score: '12',
            home_score: '28',
            venue: '',
            notes: 'xpLosION 2006. Source: BCAFL contemporary official archives & BAFRA Newsflash Issue 43/06',
            away_coach: '',
            home_coach: '',
            is_double_header: 'FALSE',
            date_precision: 'day',
            date_display: '04/11/2006',
            time: '18:30',
            status: 'completed',
            confidence_level: 'high',
            is_playoff: 'FALSE',
            is_title_game: 'FALSE',
            final_type: '',
            title_name: '',
            nickname: 'xpLosION',
            playoff_round: '',
            parent_phase: 'Southern Conference',
            away_phase: 'Central Division',
            away_parent_phase: 'Southern Conference'
        });
        fs.writeFileSync(file, toCSV(records, standardHeaders));
        console.log('Updated games2006.csv with xpLosION 2006 (Tarannau Aberystwyth @ Birmingham Lions)');
    }
}

// 3. 2007: Warwick Wolves 0 @ Birmingham Lions 49 (2007-11-10)
function update2007() {
    const file = 'data/BUAFL/games2007.csv';
    const raw = fs.readFileSync(file, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true });
    
    const exists = records.some(r => r.date === '2007-11-10' && r.home_team === 'Birmingham Lions');
    if (!exists) {
        records.push({
            competition: 'BUAFL',
            year: '2007',
            phase: 'Central Division',
            date: '2007-11-10',
            away_team: 'Warwick Wolves',
            home_team: 'Birmingham Lions',
            away_score: '0',
            home_score: '49',
            venue: '',
            notes: 'xpLosION 2007. Source: BAFRA Newsflash Issue 42/07',
            away_coach: '',
            home_coach: 'Tony Athersmith',
            is_double_header: 'FALSE',
            date_precision: 'day',
            date_display: '10/11/2007',
            time: '',
            status: 'completed',
            confidence_level: 'high',
            is_playoff: 'FALSE',
            is_title_game: 'FALSE',
            final_type: '',
            title_name: '',
            nickname: 'xpLosION',
            playoff_round: '',
            parent_phase: 'Southern Conference',
            away_phase: 'Central Division',
            away_parent_phase: 'Southern Conference'
        });
        fs.writeFileSync(file, toCSV(records, standardHeaders));
        console.log('Updated games2007.csv with xpLosION 2007 (Warwick Wolves @ Birmingham Lions)');
    }
}

// 4. 2008: Bath Killer Bees 0 @ Birmingham Lions 29 (2008-11-08)
function update2008() {
    const file = 'data/BUAFL/games2008.csv';
    const raw = fs.readFileSync(file, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true });
    
    const exists = records.some(r => r.date === '2008-11-08' && r.home_team === 'Birmingham Lions');
    if (!exists) {
        records.push({
            competition: 'BUAFL',
            year: '2008',
            phase: 'Conference 2 - South',
            date: '2008-11-08',
            away_team: 'Bath Killer Bees',
            home_team: 'Birmingham Lions',
            away_score: '0',
            home_score: '29',
            venue: '',
            notes: 'xpLosION 2008. Source: BAFRA Newsflash Issue 42/08 & 43/08',
            away_coach: '',
            home_coach: 'Tony Athersmith',
            is_double_header: 'FALSE',
            date_precision: 'day',
            date_display: '08/11/2008',
            time: '',
            status: 'completed',
            confidence_level: 'high',
            is_playoff: 'FALSE',
            is_title_game: 'FALSE',
            final_type: '',
            title_name: '',
            nickname: 'xpLosION',
            playoff_round: '',
            parent_phase: 'Conference 2',
            away_phase: 'Conference 3 - South West',
            away_parent_phase: 'Conference 3'
        });
        fs.writeFileSync(file, toCSV(records, standardHeaders));
        console.log('Updated games2008.csv with xpLosION 2008 (Bath Killer Bees @ Birmingham Lions)');
    }
}

// 5. 2012: Nottingham Gold 6 @ Birmingham Lions 71 (2012-11-03)
function update2012() {
    const file = 'data/BUAFL/games2012.csv';
    const raw = fs.readFileSync(file, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true });
    
    const exists = records.some(r => r.date === '2012-11-03' && r.home_team === 'Birmingham Lions');
    if (!exists) {
        records.push({
            competition: 'BUAFL',
            year: '2012',
            date: '2012-11-03',
            date_precision: 'day',
            date_display: '03/11/2012',
            phase: 'Midlands Athletics Conference',
            parent_phase: '',
            away_phase: 'Midlands Athletics Conference',
            away_parent_phase: '',
            away_team: 'Nottingham Gold',
            away_score: '6',
            home_score: '71',
            home_team: 'Birmingham Lions',
            is_playoff: 'FALSE',
            playoff_round: '',
            is_title_game: 'FALSE',
            final_type: '',
            title_name: '',
            nickname: 'xpLosION',
            is_double_header: 'FALSE',
            game_type: 'league',
            status: 'completed',
            confidence_level: 'high',
            venue: 'Bournbrook 3G',
            home_coach: 'Wayne Hill',
            away_coach: '',
            notes: 'xpLosION 2012. Source: Double Coverage contemporary archives & BAFRA Newsflash Issue 40/12'
        });
        fs.writeFileSync(file, toCSV(records, games2012Headers));
        console.log('Updated games2012.csv with xpLosION 2012 (Nottingham Gold @ Birmingham Lions)');
    }
}

update2005();
update2006();
update2007();
update2008();
update2012();
console.log('All 5 missing xpLosION games updated successfully.');
