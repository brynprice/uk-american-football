import fs from 'fs';

const rawStandings = JSON.parse(
  fs.readFileSync('/Users/brynprice/.gemini/antigravity/brain/29afc068-86b4-41f5-b685-4e55f014f3ce/scratch/standings_2025_raw.json', 'utf8')
);

const DIV_URL_MAP = {
  'Premiership North': 'https://bafanle.leaguerepublic.com/standingsForDate/656942751/2/-1/-1.html',
  'Premiership South': 'https://bafanle.leaguerepublic.com/standingsForDate/535416520/2/-1/-1.html',
  'NFC 1 Scottish': 'https://bafanle.leaguerepublic.com/standingsForDate/28839696/2/-1/-1.html',
  'NFC 1 North': 'https://bafanle.leaguerepublic.com/standingsForDate/897676537/2/-1/-1.html',
  'NFC 1 Midlands': 'https://bafanle.leaguerepublic.com/standingsForDate/150572177/2/-1/-1.html',
  'SFC 1 East': 'https://bafanle.leaguerepublic.com/standingsForDate/227155536/2/-1/-1.html',
  'SFC 1 Central': 'https://bafanle.leaguerepublic.com/standingsForDate/43969571/2/-1/-1.html',
  'SFC 1 West': 'https://bafanle.leaguerepublic.com/standingsForDate/699665873/2/-1/-1.html',
  'NFC 2 North': 'https://bafanle.leaguerepublic.com/standingsForDate/42415565/2/-1/-1.html',
  'NFC 2 Midlands': 'https://bafanle.leaguerepublic.com/standingsForDate/866007508/2/-1/-1.html',
  'SFC 2 East': 'https://bafanle.leaguerepublic.com/standingsForDate/111518784/2/-1/-1.html',
  'SFC 2 West': 'https://bafanle.leaguerepublic.com/standingsForDate/522327898/2/-1/-1.html',
};

const VERIFIED_COACHES_2025 = {
  'Bristol Aztecs': 'Pete Jones',
  'London Warriors': 'Tony Allen',
  'Manchester Titans': 'George Foster',
  'East Kilbride Pirates': 'Matthew Davies',
  'London Blitz': 'Heath Thomas',
  'Rushmoor Knights': 'Calvin Stitt',
  'Hertfordshire Cheetahs': 'Rich Moult',
  'Solent Thrashers': 'Dave Gibbs',
  'Wembley Stallions': 'Warren Smart',
  'Glasgow Tigers': 'Ryan McCluskey',
  'Sussex Thunder': 'Billy Walker',
};

const rows = [
  'competition_name,parent_phase,phase,year,team,position,games_played,wins,losses,ties,points_for,points_against,streak,is_champion,notes,head_coach'
];

for (const s of rawStandings) {
  const comp = 'BAFA National Leagues';
  const parent = s.parent;
  const phase = s.division;
  const year = '2025';
  const team = s.team;
  const pos = s.position;
  const gp = s.played;
  const w = s.wins;
  const l = s.losses;
  const t = s.ties;
  const pf = s.points_for;
  const pa = s.points_against;
  const streak = s.streak;
  const isChamp = pos === '1' ? 'TRUE' : 'FALSE';
  const url = DIV_URL_MAP[s.division] || 'https://bafanle.leaguerepublic.com/';
  const notes = `Source: League Republic official standings (${url})`;
  const headCoach = VERIFIED_COACHES_2025[team] || '';

  rows.push(
    `"${comp}","${parent}","${phase}",${year},"${team}",${pos},${gp},${w},${l},${t},${pf},${pa},"${streak}",${isChamp},"${notes}","${headCoach}"`
  );
}

fs.writeFileSync('data/BAFANL/standings2025.csv', rows.join('\n') + '\n');
console.log(`Generated data/BAFANL/standings2025.csv with ${rows.length - 1} records.`);
