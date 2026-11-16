import fs from 'fs';

// 1. 2012
const g2012Path = 'data/BUAFL/games2012.csv';
const g2012Line = 'BUAFL,2012,,season,,Varsity Bowl,Varsity Fixtures,,,Cambridge Pythons,20,13,Oxford Lancers,FALSE,,FALSE,,,,FALSE,league,completed,high,,,,"Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database"';
if (!fs.readFileSync(g2012Path, 'utf-8').includes('Varsity Bowl')) {
  fs.appendFileSync(g2012Path, '\n' + g2012Line);
  console.log('Added 2012 Varsity Bowl');
}

// 2. 2013
const g2013Path = 'data/BUAFL/games2013.csv';
const g2013Line = 'BUAFL,2013,Varsity Bowl,,Cambridge Pythons,Oxford Lancers,33,6,,"Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database",,,FALSE,season,,,completed,high,FALSE,FALSE,,,,Varsity Fixtures,,';
if (!fs.readFileSync(g2013Path, 'utf-8').includes('Varsity Bowl')) {
  fs.appendFileSync(g2013Path, '\n' + g2013Line);
  console.log('Added 2013 Varsity Bowl');
}

// 3. 2015
const g2015Path = 'data/BUAFL/games2015.csv';
const g2015Line = 'BUAFL,2015,Varsity Bowl,Varsity Fixtures,,,Cambridge Pythons,Oxford Lancers,0,49,,"Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database",,,FALSE,season,,,completed,high,FALSE,FALSE,,,,';
if (!fs.readFileSync(g2015Path, 'utf-8').includes('Varsity Bowl')) {
  fs.appendFileSync(g2015Path, '\n' + g2015Line);
  console.log('Added 2015 Varsity Bowl');
}

// 4. 2016
const g2016Path = 'data/BUAFL/games2016.csv';
const g2016Line = 'BUAFL,2016,Varsity Bowl,Varsity Fixtures,,,Cambridge Pythons,Oxford Lancers,20,14,,"Varsity Bowl / Cavalier Cup (Double OT). Source: Oxford Lancers historic database",,,FALSE,season,,,completed,high,FALSE,FALSE,,,,';
if (!fs.readFileSync(g2016Path, 'utf-8').includes('Varsity Bowl')) {
  fs.appendFileSync(g2016Path, '\n' + g2016Line);
  console.log('Added 2016 Varsity Bowl');
}

// 5. 2017
const g2017Path = 'data/BUAFL/games2017.csv';
const g2017Line = 'BUAFL,2017,Varsity Bowl,Varsity Fixtures,,,Cambridge Pythons,Oxford Lancers,6,48,,"Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database",,,FALSE,season,,,completed,high,FALSE,FALSE,,,,';
if (!fs.readFileSync(g2017Path, 'utf-8').includes('Varsity Bowl')) {
  fs.appendFileSync(g2017Path, '\n' + g2017Line);
  console.log('Added 2017 Varsity Bowl');
}

// 6. 2018
const g2018Path = 'data/BUAFL/games2018.csv';
const g2018Line = 'BUAFL,2018,Varsity Bowl,Varsity Fixtures,,,Cambridge Pythons,Oxford Lancers,9,19,,"Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database",,,FALSE,season,,,completed,high,FALSE,FALSE,,,,';
if (!fs.readFileSync(g2018Path, 'utf-8').includes('Varsity Bowl')) {
  fs.appendFileSync(g2018Path, '\n' + g2018Line);
  console.log('Added 2018 Varsity Bowl');
}

// 7. 2019
const g2019Path = 'data/BUAFL/games2019.csv';
const g2019Line = 'BUAFL,2019,Varsity Bowl,Varsity Fixtures,,,Cambridge Pythons,Oxford Lancers,,,,"Varsity Bowl / Cavalier Cup (Cancelled due to COVID-19). Source: Oxford Lancers historic database",,,FALSE,season,,,cancelled,high,FALSE,FALSE,,,,';
if (!fs.readFileSync(g2019Path, 'utf-8').includes('Varsity Bowl')) {
  fs.appendFileSync(g2019Path, '\n' + g2019Line);
  console.log('Added 2019 Varsity Bowl');
}

// 8. 2020
const g2020Path = 'data/BUAFL/games2020.csv';
if (!fs.existsSync(g2020Path)) {
  const g2020Header = 'competition,year,phase,date,away_team,home_team,away_score,home_score,venue,notes,away_coach,home_coach,is_double_header,date_precision,date_display,time,status,confidence_level,is_playoff,is_title_game,final_type,title_name,nickname,playoff_round,parent_phase';
  const g2020Line = 'BUAFL,2020,Varsity Bowl,,Cambridge Pythons,Oxford Lancers,0,36,,"Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database",,,FALSE,season,,,completed,high,FALSE,FALSE,,,,Varsity Fixtures';
  fs.writeFileSync(g2020Path, g2020Header + '\n' + g2020Line + '\n');
  console.log('Created 2020 games CSV with Varsity Bowl');
}

// 9. 2021
const g2021Path = 'data/BUAFL/games2021.csv';
const g2021Line = 'BUAFL,2021,Varsity Bowl,,Cambridge Pythons,Oxford Lancers,14,12,,"Varsity Bowl / Cavalier Cup. Source: Oxford Lancers historic database",,,FALSE,season,,,completed,high,FALSE,FALSE,,,,Varsity Fixtures';
if (!fs.readFileSync(g2021Path, 'utf-8').includes('Varsity Bowl')) {
  fs.appendFileSync(g2021Path, '\n' + g2021Line);
  console.log('Added 2021 Varsity Bowl');
}

// 10. 2022
const g2022Path = 'data/BUAFL/games2022.csv';
const g2022Line = 'BUAFL,2022,Varsity Bowl,2023-05-13,Cambridge Pythons,Oxford Lancers,7,41,,"Varsity Bowl / Cavalier Cup (Varsity Bowl XVI). Source: Oxford Lancers historic database",,,FALSE,day,13/05/2023,,completed,high,FALSE,FALSE,,,,Varsity Fixtures';
if (!fs.readFileSync(g2022Path, 'utf-8').includes('Varsity Bowl')) {
  fs.appendFileSync(g2022Path, '\n' + g2022Line);
  console.log('Added 2022 Varsity Bowl');
}

// 11. 2023
const g2023Path = 'data/BUAFL/games2023.csv';
const g2023Line = 'BUAFL,2023,Varsity Bowl,2024-05-12,Cambridge Pythons,Oxford Lancers,3,48,,"Varsity Bowl / Cavalier Cup (Varsity Bowl XVII). Source: Oxford Lancers historic database",,,FALSE,day,12/05/2024,,completed,high,FALSE,FALSE,,,,Varsity Fixtures';
if (!fs.readFileSync(g2023Path, 'utf-8').includes('Varsity Bowl')) {
  fs.appendFileSync(g2023Path, '\n' + g2023Line);
  console.log('Added 2023 Varsity Bowl');
}

// 12. 2024
const g2024Path = 'data/BUAFL/games2024.csv';
const g2024Line = 'BUAFL,2024,Varsity Bowl,2025-05-11,Cambridge Pythons,Oxford Lancers,0,48,,"Varsity Bowl / Cavalier Cup (Varsity Bowl XVIII). Source: Oxford Lancers historic database",,,FALSE,day,11/05/2025,,completed,high,FALSE,FALSE,,,,Varsity Fixtures';
if (!fs.readFileSync(g2024Path, 'utf-8').includes('Varsity Bowl')) {
  fs.appendFileSync(g2024Path, '\n' + g2024Line);
  console.log('Added 2024 Varsity Bowl');
}

// 13. 2025
const g2025Path = 'data/BUAFL/games2025.csv';
const g2025Line = 'BUAFL,2025,Varsity Bowl,,Cambridge Pythons,Oxford Lancers,26,12,,"Varsity Bowl / Cavalier Cup (Varsity Bowl XIX). Source: Oxford Lancers historic database",,,FALSE,season,,,completed,high,FALSE,FALSE,,,,Varsity Fixtures';
if (!fs.readFileSync(g2025Path, 'utf-8').includes('Varsity Bowl')) {
  fs.appendFileSync(g2025Path, '\n' + g2025Line);
  console.log('Added 2025 Varsity Bowl');
}

// 14. 2026: Update Hertfordshire Hurricanes game on 2026-11-08
const g2026Path = 'data/BUAFL/games2026.csv';
let g2026Content = fs.readFileSync(g2026Path, 'utf-8');
const targetLine = 'BUAFL,2026,Division 1 Southern,2026-11-08,Hertfordshire Hurricanes,Oxford Lancers,,,,Source: BUCS Play historical records (https://bucs.playwaze.com/bucs-american-football-26-27/ifxdwhhz1xyc/community-details),,,FALSE,day,08/11/2026,12:30,scheduled,high,FALSE,FALSE,,,,,Division 1 South';
const replacementLine = 'BUAFL,2026,Division 1 Southern,2026-11-08,Hertfordshire Hurricanes,Oxford Lancers,6,23,,Source: Oxford Lancers historic database,,,FALSE,day,08/11/2026,12:30,completed,high,FALSE,FALSE,,,,,Division 1 South';

if (g2026Content.includes(targetLine)) {
  g2026Content = g2026Content.replace(targetLine, replacementLine);
  fs.writeFileSync(g2026Path, g2026Content);
  console.log('Updated 2026-11-08 fixture vs Herts to completed (23-6)');
} else {
  console.log('2026 target line not found or already updated');
}
