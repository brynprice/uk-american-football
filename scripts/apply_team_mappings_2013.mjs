import fs from 'fs';
import path from 'path';

const teamMapping = {
    // User-specified explicit mappings
    'ARU Rhinos': 'Anglia Ruskin Rhinos',
    'Leeds Carnegie': 'Leeds Carnegie',
    'Leeds Met Carnegie': 'Leeds Carnegie',
    'City Sentinels': 'London City Sentinels',
    'London City Sentinels': 'London City Sentinels',
    'Bangor Muddogs': 'Bangor MudDogs',
    'DMU Falcons': 'DMU Falcons',
    'Liverpool Fury': 'LJMU Fury',
    'LJM Fury': 'LJMU Fury',
    'Edinburgh Predators': 'Edinburgh Predators',

    // Preserved Aliases
    'Brighton Tsunami': 'Brighton Tsunami',

    // Shorthand & Truncated Team Names
    'UH Sharks': 'Hull Sharks',
    'Hallam Warriors': 'Sheffield Hallam Warriors',
    'UCL Rams': 'UCLan Rams',
    'UCLAN Rams': 'UCLan Rams',
    'RHUL Bears': 'Royal Holloway Bears',
    'Royal Holloway': 'Royal Holloway Bears',
    'OBU Panthers': 'Oxford Brookes University',
    'Napier Knights': 'Edinburgh Napier Knights',
    'Canterbury Chargers': 'Canterbury CC Chargers',
    'Coventry Jets': 'Coventry University Jets',
    'NTU Renegades': 'Nottingham Trent Renegades',
    'NTU': 'Nottingham Trent Renegades',
    'Loughborough': 'Loughborough Aces',
    'Aces': 'Loughborough Aces',
    'Stallions': 'Staffordshire Stallions',
    'Wildcats': 'Wolverhampton Wildcats',
    'Destroyers': 'Portsmouth Destroyers',
    'Gladiators': 'Gloucestershire Gladiators',
    'Gloucester Gladiators': 'Gloucestershire Gladiators',

    // Single word city / county shorthands
    'Birmingham': 'Birmingham Lions',
    'Glasgow': 'Glasgow Tigers',
    'Exeter': 'Exeter Demons',
    'Hertfordshire': 'Hertfordshire Hurricanes',
    'Imperial': 'Imperial Immortals',
    'Derby': 'Derby Braves',
    'Bath': 'Bath Killer Bees',
    'Sheffield': 'Sheffield Sabres',
    'Nottingham': 'Nottingham Outlaws',
    'Kent': 'Kent Falcons',
    'Surrey': 'Surrey Stingers'
};

function applyMappings() {
    const csvPath = 'data/BUAFL/games2013.csv';
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(Boolean);

    if (lines.length <= 1) return;

    const headers = lines[0].split(',');
    const awayIdx = headers.indexOf('away_team');
    const homeIdx = headers.indexOf('home_team');

    const updatedLines = [lines[0]];
    let updatedCount = 0;

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');

        let away = parts[awayIdx]?.trim();
        let home = parts[homeIdx]?.trim();

        if (teamMapping[away]) {
            parts[awayIdx] = teamMapping[away];
            updatedCount++;
        }
        if (teamMapping[home]) {
            parts[homeIdx] = teamMapping[home];
            updatedCount++;
        }

        updatedLines.push(parts.join(','));
    }

    fs.writeFileSync(csvPath, updatedLines.join('\n') + '\n', 'utf-8');
    console.log(`Applied team name mappings to ${updatedCount} team entries in ${csvPath}!`);
}

applyMappings();
