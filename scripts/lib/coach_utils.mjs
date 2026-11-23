import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, '..', '..');

/**
 * Canonical team alias mapping mirroring scripts/sense_check_season.py.
 */
export const ALIAS_MAP = {
  'Brighton Panthers': 'Brighton Tsunami',
  'Nottingham Outlaws': 'Nottingham Gold',
  'Anglia Ruskin Phantoms': 'Anglia Ruskin Siege',
  'Anglia Ruskin Rhinos': 'Anglia Ruskin Siege',
  'Royal Holloway Vikings': 'Royal Holloway Bears',
  'Napier Mavericks': 'Edinburgh Napier Knights',
  'GCU Roughriders': 'Caledonian Roughriders',
  'Bristol Bullets': 'UWE Bullets',
  'Aberdeen Bulls': 'Aberdeen Roughnecks University Team',
  'Leeds Carnegie Chargers': 'Leeds Chargers',
  'Hertfordshire Tornadoes': 'Hertfordshire Cheetahs',
  'Chester Romans Ladies': 'Cheshire Bears',
  'London Cobras': 'London Warriors',
  'Coventry Cassidy Jets': 'Coventry Jets',
  'Farnham Fast Lane Knights': 'Rushmoor Knights',
  'Farnham Knights': 'Rushmoor Knights',
  'Tamworth Phoenix': 'Coventry Phoenix',
  'Lancashire Wolverines': 'Lancashire Buccaneers',
  'Leicester Falcons': 'Leicester Panthers',
  'Bournemouth Bobcats': 'Bournemouth University Bobcats',
  'Strathclyde Sheriffs': 'Glasgow Tigers',
  'East Kilbridge Pirates': 'East Kilbride Pirates',
  'Oxford Bulldogs': 'Oxford Saints',
  'Reading Renegades': 'Berkshire Renegades',
  'South Yorkshire Mustangs': 'Doncaster Mustangs',
  'Cornish Sharks': 'Cornwall Monarchs',
  'Gloucester Banshees': 'Gloucester Centurions',
  'Hampshire Thrashers': 'Solent Thrashers',
  'Andover Thrashers': 'Solent Thrashers',
};

const INVALID_COACH_VALUES = new Set([
  '',
  'unknown',
  'unconfirmed',
  'tbc',
  'tbd',
  'n/a',
  'na',
  'none',
  'vacant',
  'president',
  'club president',
  'captain',
  'club captain',
  'chairman',
  'chair',
]);

/**
 * Resolve a team name to its canonical archive name.
 */
export function resolveCanonicalTeam(teamName, competition = '') {
  const raw = (teamName || '').trim();
  if (!raw) return '';
  if (competition.toUpperCase() === 'NWFL' && raw === 'Portsmouth Destroyers') {
    return 'Portsmouth Dreadnoughts';
  }
  return ALIAS_MAP[raw] || raw;
}

/**
 * Parse simple CLI flags (--key value or --flag).
 */
export function parseCliArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const eqIdx = token.indexOf('=');
    if (eqIdx !== -1) {
      opts[token.slice(2, eqIdx)] = token.slice(eqIdx + 1);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      opts[key] = next;
      i++;
    } else {
      opts[key] = true;
    }
  }
  return opts;
}

/**
 * Read a CSV file into headers + row objects using csv-parse/sync.
 */
export function readCsvRecords(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawRows = parse(content, {
    bom: true,
    skip_empty_lines: true,
    relax_quotes: true,
  });
  if (rawRows.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = rawRows[0].map((h) => String(h || '').trim());
  const rows = [];
  for (let r = 1; r < rawRows.length; r++) {
    const values = rawRows[r];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] !== undefined ? String(values[idx]).trim() : '';
    });
    rows.push(obj);
  }
  return { headers, rows };
}

/**
 * Serialize a single CSV value safely per RFC-4180.
 */
export function escapeCsvCell(val) {
  const s = val === null || val === undefined ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Write headers + row objects back to CSV cleanly.
 */
export function writeCsvRecords(filePath, headers, rows) {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvCell(row[h] ?? '')).join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

/**
 * Load verified coach evidence records from data/evidence/verified_coaches.json.
 */
export function loadVerifiedCoaches(evidencePath = path.join(ROOT_DIR, 'data', 'evidence', 'verified_coaches.json')) {
  if (!fs.existsSync(evidencePath)) return [];
  return JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
}

/**
 * Load persistent official source directory from data/mappings/team_sources.json.
 */
export function loadTeamSources(sourcesPath = path.join(ROOT_DIR, 'data', 'mappings', 'team_sources.json')) {
  if (!fs.existsSync(sourcesPath)) return {};
  return JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
}

/**
 * Write persistent official source directory cleanly sorted by team name.
 */
export function saveTeamSources(sourcesObj, sourcesPath = path.join(ROOT_DIR, 'data', 'mappings', 'team_sources.json')) {
  const sorted = {};
  for (const key of Object.keys(sourcesObj).sort((a, b) => a.localeCompare(b))) {
    sorted[key] = sourcesObj[key];
  }
  fs.writeFileSync(sourcesPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

/**
 * Check whether a URL is a Vertex/Google grounding redirect that must be resolved.
 */
export function isRedirectUrl(url) {
  if (!url) return false;
  return /vertexaisearch\.cloud\.google\.com\/grounding-api-redirect/i.test(url);
}

/**
 * Check whether a URL is a valid canonical HTTP(S) URL (not a grounding redirect or placeholder).
 */
export function isValidCanonicalUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!/^https?:\/\/[^/\s]+\.[^/\s]+/i.test(trimmed)) return false;
  if (isRedirectUrl(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname || parsed.hostname === 'example.com') return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a candidate coach record against AGENTS.md Rules 5 & 6 before registration.
 * Returns { valid: boolean, errors: string[] }.
 */
export function validateCandidateForRegistration(candidate) {
  const errors = [];
  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, errors: ['Candidate record is not an object.'] };
  }
  if (candidate.status !== 'verified_current_season') {
    errors.push(`Status is '${candidate.status || 'missing'}' (must be 'verified_current_season').`);
  }
  const coach = (candidate.head_coach || '').trim();
  if (!coach || INVALID_COACH_VALUES.has(coach.toLowerCase())) {
    errors.push(`Invalid or empty head_coach ('${coach}').`);
  }
  const sourceUrl = (candidate.source_url || '').trim();
  const isUserConfirmed = candidate.verified_by_user === true;
  if (!sourceUrl) {
    if (candidate.redirect_url && isRedirectUrl(candidate.redirect_url)) {
      errors.push('Missing canonical source_url; only grounding redirect_url present (run --resolve-redirects first).');
    } else {
      errors.push('Missing canonical source_url.');
    }
  } else if (isRedirectUrl(sourceUrl)) {
    errors.push('source_url is a vertexaisearch grounding redirect URL; must resolve to canonical public URL.');
  } else if (/(^|\/)data\/|\.csv\b/i.test(sourceUrl)) {
    errors.push(`source_url contains internal file path ('${sourceUrl}'), violating AGENTS.md Rule 1.`);
  } else if (!isUserConfirmed && !isValidCanonicalUrl(sourceUrl)) {
    errors.push(`Invalid canonical source_url '${sourceUrl}'.`);
  }
  const sourceDetails = (candidate.source_details || '').trim();
  if (!sourceDetails) {
    errors.push('Missing source_details.');
  } else if (/(^|[\s(])data\/|\.csv\b/i.test(sourceDetails)) {
    errors.push('source_details contains internal file path, violating AGENTS.md Rule 1.');
  }
  if (!(candidate.source_date || '').trim()) {
    errors.push('Missing source_date.');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Build university name hints from data/mappings/bucs_teams.json & team_sources.json.
 */
export function buildUniversityLookup(teamSources = {}) {
  const map = new Map();
  for (const [team, info] of Object.entries(teamSources)) {
    if (info && info.university) {
      map.set(team, info.university);
    }
  }
  const bucsPath = path.join(ROOT_DIR, 'data', 'mappings', 'bucs_teams.json');
  if (fs.existsSync(bucsPath)) {
    const bucs = JSON.parse(fs.readFileSync(bucsPath, 'utf8'));
    for (const [raw, canon] of Object.entries(bucs)) {
      if (map.has(canon)) continue;
      if (/University|College|Imperial|School/i.test(raw)) {
        const cleaned = raw
          .replace(/&#39;/g, "'")
          .replace(/\s+(Open|Mixed|Men's)\s+\d+(st|nd|rd)?(\s*\(.*\))?$/i, '')
          .trim();
        if (cleaned) map.set(canon, cleaned);
      }
    }
  }
  return map;
}
