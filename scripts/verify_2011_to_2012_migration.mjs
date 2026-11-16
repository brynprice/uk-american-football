import fs from 'fs';
import xlsx from 'xlsx';

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function loadCSV(path) {
  if (!fs.existsSync(path)) return [];
  const content = fs.readFileSync(path, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const header = parseCSVLine(lines[0]);
  return lines.slice(1).map(l => {
    const row = parseCSVLine(l);
    const obj = {};
    header.forEach((h, idx) => obj[h.trim()] = (row[idx] || '').trim());
    return obj;
  });
}

// Load canonical mappings
const bucsTeamMap = JSON.parse(fs.readFileSync('data/mappings/bucs_teams.json', 'utf-8'));
const g2011 = loadCSV('data/BUAFL/games2011.csv');
const g2012 = loadCSV('data/BUAFL/games2012.csv');
const s2012 = loadCSV('data/BUAFL/standings2012.csv');

// Load Double Coverage posts for cross-referencing
let dblPosts = [];
if (fs.existsSync('scratch/dblcoverage_2012_all_full_posts.json')) {
  dblPosts = JSON.parse(fs.readFileSync('scratch/dblcoverage_2012_all_full_posts.json', 'utf-8'));
}

const wb = xlsx.readFile('data/BUCS_2011_12_Results.xlsx');
const s = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(s, { header: 1 });
const afRows = rows.filter(r => (r[1] || '').toString().toLowerCase().includes('american football'));

function resolveTeam(name) {
  if (!name) return '';
  const trimmed = name.trim();
  if (bucsTeamMap[trimmed]) return bucsTeamMap[trimmed];
  return trimmed;
}

function excelDateToDate(excelDate) {
  if (!excelDate || isNaN(excelDate)) return null;
  const d = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
  return d.toISOString().split('T')[0];
}

function flipDate(isoDate) {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  if (d <= 12 && d !== m) {
    const fy = y;
    const fm = String(d).padStart(2, '0');
    const fd = String(m).padStart(2, '0');
    return `${fy}-${fm}-${fd}`;
  }
  return null;
}

console.log(`Analyzing ${afRows.length} BUCS 2011-12 rows for potential 2012-13 migration...`);

const report = [];

afRows.forEach((r, idx) => {
  const rawDate = excelDateToDate(r[4]);
  const flipped = flipDate(rawDate);
  const rawHome = r[6];
  const homeScore = r[7] !== undefined ? Number(r[7]) : null;
  const awayScore = r[8] !== undefined ? Number(r[8]) : null;
  const rawAway = r[9];
  const comp = r[3];
  const noScoreType = r[11] || '';

  const home = resolveTeam(rawHome);
  const away = resolveTeam(rawAway);

  // Check existence in 2011
  const in2011 = g2011.filter(g => 
    (g.home_team === home && g.away_team === away) ||
    (g.home_team === away && g.away_team === home)
  );

  // Check existence in 2012
  const in2012 = g2012.filter(g => 
    (g.home_team === home && g.away_team === away) ||
    (g.home_team === away && g.away_team === home)
  );

  // Check standings in 2012 for home and away
  const homeStanding = s2012.find(s => s.team === home);
  const awayStanding = s2012.find(s => s.team === away);

  // Check Double Coverage posts for evidence around flipped date
  let dblEvidence = [];
  if (flipped) {
    const searchTerms = [home.split(' ')[0], away.split(' ')[0]];
    for (const post of dblPosts) {
      const text = (post.body_text || '').toLowerCase();
      if (searchTerms.every(term => text.includes(term.toLowerCase()))) {
        // snippet around match
        const idxMatch = text.indexOf(searchTerms[0].toLowerCase());
        const snippet = text.substring(Math.max(0, idxMatch - 80), Math.min(text.length, idxMatch + 120))
          .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        dblEvidence.push({
          title: post.title,
          snippet
        });
      }
    }
  }

  report.push({
    rowNum: idx + 1,
    comp,
    rawDate,
    flippedDate: flipped,
    home,
    away,
    homeScore,
    awayScore,
    noScoreType,
    in2011,
    in2012,
    homeStanding: homeStanding ? `${homeStanding.phase} (${homeStanding.wins}-${homeStanding.losses}-${homeStanding.ties})` : 'NOT IN 2012 STANDINGS',
    awayStanding: awayStanding ? `${awayStanding.phase} (${awayStanding.wins}-${awayStanding.losses}-${awayStanding.ties})` : 'NOT IN 2012 STANDINGS',
    dblEvidenceCount: dblEvidence.length,
    dblSample: dblEvidence.length > 0 ? dblEvidence[0] : null
  });
});

fs.writeFileSync('scratch/bucs_migration_prep_report.json', JSON.stringify(report, null, 2));
console.log('Saved detailed report to scratch/bucs_migration_prep_report.json');
