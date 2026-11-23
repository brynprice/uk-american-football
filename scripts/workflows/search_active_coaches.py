"""
Reusable Active Roster Head Coach Discovery Workflow

Dynamically audits active teams via scripts/coach_roster_audit.mjs, optionally incorporates
offline/live source page scan results if available, fans out throttled research agents
to discover and verify current-season head coaches under AGENTS.md Rules 5 & 6,
checkpoints progress after every wave, and saves structured candidates JSON.

Intended to be executed via Antigravity's `run_workflow` tool.
"""

import asyncio
import json
import os
import subprocess
from datetime import datetime, timezone

_args = args if isinstance(globals().get("args"), dict) else {}

COMPETITION = str(_args.get("competition", "BUAFL")).strip()
SEASON = int(_args.get("season", 2026))
BATCH_SIZE = max(1, int(_args.get("batch_size", 5)))
CONCURRENCY = max(1, int(_args.get("concurrency", 2)))
RESUME = bool(_args.get("resume", True))
TEAMS_FILTER = _args.get("teams_filter") or []
OUTPUT_PATH = str(
    _args.get(
        "output_path",
        f"data/evidence/coach_candidates_{COMPETITION.lower()}_{SEASON}.json",
    )
)

ROOT_DIR = WORKSPACES[0] if WORKSPACES else os.getcwd()
ABS_OUTPUT_PATH = os.path.join(ROOT_DIR, OUTPUT_PATH) if not os.path.isabs(OUTPUT_PATH) else OUTPUT_PATH
SCAN_FILE_PATH = os.path.join(
    ROOT_DIR,
    "data",
    "evidence",
    f"source_page_scan_{COMPETITION.lower()}_{SEASON}.json",
)

BATCH_SCHEMA = {
    "type": "object",
    "properties": {
        "teams": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "team": {"type": "string"},
                    "phase": {"type": "string"},
                    "status": {
                        "type": "string",
                        "enum": [
                            "verified_current_season",
                            "likely_needs_verification",
                            "historical_only",
                            "unconfirmed",
                            "search_error",
                        ],
                    },
                    "head_coach": {"type": "string"},
                    "source_url": {"type": "string"},
                    "source_domain": {"type": "string"},
                    "redirect_url": {"type": "string"},
                    "source_date": {"type": "string"},
                    "source_details": {"type": "string"},
                    "discovered_official_urls": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": [
                    "team",
                    "phase",
                    "status",
                    "head_coach",
                    "source_url",
                    "source_domain",
                    "redirect_url",
                    "source_date",
                    "source_details",
                    "discovered_official_urls",
                ],
            },
        }
    },
    "required": ["teams"],
}


def is_redirect_url(url: str) -> bool:
    return bool(url) and "vertexaisearch.cloud.google.com/grounding-api-redirect" in url


def season_label(comp: str, year: int) -> str:
    if comp.upper() == "BUAFL":
        return f"{year}/{str(year + 1)[-2:]}"
    return str(year)


def sanitize_record(raw: dict, fallback_team: dict) -> dict:
    rec = {
        "team": str(raw.get("team") or fallback_team["team"]).strip(),
        "canonical_team": fallback_team.get("canonical_team", fallback_team["team"]),
        "university": fallback_team.get("university", ""),
        "phase": str(raw.get("phase") or fallback_team.get("phase", "")).strip(),
        "status": str(raw.get("status") or "search_error").strip(),
        "head_coach": str(raw.get("head_coach") or "").strip(),
        "source_url": str(raw.get("source_url") or "").strip(),
        "source_domain": str(raw.get("source_domain") or "").strip(),
        "redirect_url": str(raw.get("redirect_url") or "").strip(),
        "source_date": str(raw.get("source_date") or "").strip(),
        "source_details": str(raw.get("source_details") or "").strip(),
        "discovered_official_urls": [],
        "needs_url_resolution": False,
    }

    if is_redirect_url(rec["source_url"]):
        if not rec["redirect_url"]:
            rec["redirect_url"] = rec["source_url"]
        rec["source_url"] = ""
        rec["needs_url_resolution"] = True
    elif not rec["source_url"] and is_redirect_url(rec["redirect_url"]):
        rec["needs_url_resolution"] = True

    raw_urls = raw.get("discovered_official_urls") or []
    clean_urls = []
    for u in raw_urls:
        u_str = str(u or "").strip()
        if u_str.startswith("http") and not is_redirect_url(u_str):
            if u_str not in clean_urls:
                clean_urls.append(u_str)
    rec["discovered_official_urls"] = clean_urls

    if rec["status"] in ("unconfirmed", "search_error"):
        rec["head_coach"] = ""

    return rec


def make_batches(items: list, batch_size: int) -> list:
    # Group cleanly by phase first so similar divisions stay together, splitting large phases
    by_phase = {}
    phase_order = []
    for item in items:
        ph = item.get("phase") or "Other"
        if ph not in by_phase:
            by_phase[ph] = []
            phase_order.append(ph)
        by_phase[ph].append(item)

    batches = []
    current_batch = []
    for ph in phase_order:
        group = by_phase[ph]
        for item in group:
            current_batch.append(item)
            if len(current_batch) >= batch_size:
                batches.append(current_batch)
                current_batch = []
    if current_batch:
        batches.append(current_batch)
    return batches


def build_batch_prompt(batch: list, scan_hits_by_team: dict) -> str:
    s_label = season_label(COMPETITION, SEASON)
    comp_desc = (
        "BUCS / BUAFL University American Football"
        if COMPETITION.upper() == "BUAFL"
        else f"{COMPETITION} UK American Football"
    )

    team_lines = []
    for idx, t in enumerate(batch, 1):
        known_urls = ", ".join(t.get("known_urls") or []) or "None seeded"
        prior = t.get("historical_prior_coach")
        prior_str = (
            f"{prior['head_coach']} ({prior['year']}) — DO NOT CARRY OVER WITHOUT {s_label} PROOF"
            if prior
            else "None recorded"
        )
        scan_hits = scan_hits_by_team.get(t["canonical_team"], [])
        scan_str = ""
        if scan_hits:
            snippets = [f"{h['url']}: {h['snippet']}" for h in scan_hits[:2]]
            scan_str = f"\n   - Pre-scanned SU/club page hits: {' | '.join(snippets)}"

        team_lines.append(
            f"{idx}. Team: {t['team']} (Canonical: {t['canonical_team']})\n"
            f"   - University/Club: {t.get('university') or t['team']}\n"
            f"   - Division/Phase: {t.get('phase', '')} ({t.get('parent_phase', '')})\n"
            f"   - Known official/wiki URLs: {known_urls}\n"
            f"   - Latest historical coach in archive: {prior_str}{scan_str}"
        )

    teams_block = "\n".join(team_lines)

    return f"""Research the current {s_label} Head Coach for these {len(batch)} active {comp_desc} teams.

TARGET SEASON: {s_label} (season year key: {SEASON}; today is November 2026; coaching appointments for {s_label} typically occur Apr–Nov {SEASON}).

TEAMS TO RESEARCH:
{teams_block}

STRICT RULES — READ CAREFULLY:
1. RATE-LIMIT PROTECTION (CRITICAL):
   - Call `search_web` only 1 or 2 queries per turn! NEVER fire 5+ parallel `search_web` calls in a single turn (that triggers 503 capacity limits).
   - Start with 1–2 concise queries per team, e.g.:
     `"<Team Name>" OR "<University>" "American Football" "head coach" {SEASON} OR {SEASON + 1}`
   - If `search_web` returns a 503 Unavailable error, wait/try one more single query on the next turn; if still failing, set `status: "search_error"` for that team rather than guessing.

2. ANTI-CONFLATION & ANTI-HALLUCINATION RULES (`AGENTS.md` Rules 5 & 6):
   - NEVER invent, assume, or carry over a coach from an older season without dated {s_label} evidence.
   - Loughborough Students (BUCS team) is NOT the NFL Academy (Steve Hagen coaches NFL Academy, NOT Loughborough Students).
   - Do NOT confuse university BUCS teams with adult BAFA clubs in the same city:
     * Edinburgh Wildcats (uni) ≠ Edinburgh Wolves (adult)
     * Glasgow University Tigers (uni) ≠ Glasgow Tigers (adult)
     * Nottingham Gold/Jade/Green (uni) ≠ Nottingham Caesars (adult)
     * Manchester Tyrants / MMU Eagles (uni) ≠ Manchester Titans (adult)
     * Coventry University Jets (uni) ≠ Coventry Jets (adult)
     * UEA Pirates (uni) ≠ East Kilbride Pirates (adult)
     * Kent Falcons (uni) ≠ Kent Exiles (adult)
     * Portsmouth Destroyers (uni) ≠ Portsmouth Dreadnoughts (women's)
     * Solent Redhawks (uni) ≠ Solent Thrashers (adult)
     * Bristol Barracuda (uni) ≠ Bristol Aztecs / Apache (adult)
     * Staffordshire Stallions (uni) ≠ Staffordshire Surge (adult)
     * Sheffield Sabres / Hallam Warriors (uni) ≠ Sheffield Giants (adult)
     * Leeds Gryphons / Beckett Carnegie (uni) ≠ Yorkshire Rams / Leeds Bobcats (adult)
   - Do NOT assign a 1st-team Head Coach to a 2nd/3rd team (`UWE Bullets 2s`, `Nottingham Jade`, `Nottingham Green`) unless a source specifically states they coach that exact 2nd/3rd squad.
   - Do NOT confuse a Student Club President, Captain, Chair, or Welfare Officer on an SU committee page with the Head Coach.
   - Do NOT confuse Women's Contact or Flag coaches with the Open/Mixed Contact BUCS team unless explicitly confirmed.

3. EVIDENCE CLASSIFICATION TIERS:
   - `verified_current_season`: ONLY when a primary/contemporary source explicitly confirms this person as Head Coach for the **{s_label}** season (e.g., an appointment/announcement dated Apr–Nov {SEASON}, a {s_label} BUCS match report/preview, or a live official SU/university/club page explicitly labelled {s_label}).
   - `likely_needs_verification`: Use when a coach is named on an **undated** live SU/club page, a LinkedIn/FieldLevel profile saying e.g. "2024–Present" without explicit {s_label} confirmation, or confirmed for {SEASON - 1}/{str(SEASON)[-2:]} with no reported departure. NEVER classify these as `verified_current_season`!
   - `historical_only`: Only pre-{SEASON - 1}/{str(SEASON)[-2:]} coach(es) found (put the most recent historical name + year in `head_coach` and `source_date`, or leave `head_coach` empty if multiple/unclear, and explain in `source_details`).
   - `unconfirmed`: No credible head coach found in public search (`head_coach: ""`).
   - `search_error`: Web search failed/timed out due to 503 errors (`head_coach: ""`).

4. SOURCE URL RULES (CRITICAL):
   - NEVER put a `https://vertexaisearch.cloud.google.com/grounding-api-redirect/...` URL in `source_url` or `discovered_official_urls`!
   - If `search_web` only gives you a grounding redirect URL and you did NOT directly observe the real canonical `https://...` URL, leave `source_url` as `""`, put the redirect URL in `redirect_url`, and put the domain shown by `search_web` (e.g. `thesubath.com` or `instagram.com`) in `source_domain`.
   - Never guess or fabricate a canonical URL.
   - In `discovered_official_urls`, only include clean, directly observed canonical official SU/club/university/Instagram/Wiki URLs (never redirect URLs).

Return results for ALL {len(batch)} teams in `teams` using the exact `team` string listed above."""


def write_checkpoint(
    audit_data: dict,
    results_by_team: dict,
    ordered_missing: list,
):
    ordered_results = []
    seen = set()
    for t in ordered_missing:
        name = t["team"]
        if name in results_by_team:
            ordered_results.append(results_by_team[name])
            seen.add(name)
    for name, rec in results_by_team.items():
        if name not in seen:
            ordered_results.append(rec)

    counts = {
        "verified_current_season": 0,
        "likely_needs_verification": 0,
        "historical_only": 0,
        "unconfirmed": 0,
        "search_error": 0,
    }
    for r in ordered_results:
        st = r.get("status", "search_error")
        counts[st] = counts.get(st, 0) + 1

    payload = {
        "competition": COMPETITION,
        "season": SEASON,
        "season_label": season_label(COMPETITION, SEASON),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "audit_summary": audit_data.get("summary", {}),
        "already_verified_synced": audit_data.get("verified_synced", []),
        "already_verified_unsynced": audit_data.get("verified_unsynced", []),
        "research_counts": counts,
        "total_researched": len(ordered_results),
        "results": ordered_results,
    }

    os.makedirs(os.path.dirname(ABS_OUTPUT_PATH), exist_ok=True)
    with open(ABS_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    return counts


async def safe_research_batch(batch: list, batch_idx: int, scan_hits_by_team: dict) -> list:
    label = ", ".join(t["team"] for t in batch[:2]) + ("..." if len(batch) > 2 else "")
    prompt = build_batch_prompt(batch, scan_hits_by_team)

    last_err = None
    for attempt in range(2):
        try:
            res = await agent(
                prompt=prompt,
                schema=BATCH_SCHEMA,
                role=f"Coach search #{batch_idx + 1}: {label}",
                type_name="research",
                model="flash",
            )
            raw_teams = res.get("teams", []) if isinstance(res, dict) else []
            by_name = {str(item.get("team", "")).strip().lower(): item for item in raw_teams}
            sanitized = []
            for t in batch:
                match = by_name.get(t["team"].lower()) or by_name.get(t["canonical_team"].lower())
                if match:
                    sanitized.append(sanitize_record(match, t))
                else:
                    sanitized.append(
                        {
                            "team": t["team"],
                            "canonical_team": t["canonical_team"],
                            "university": t.get("university", ""),
                            "phase": t.get("phase", ""),
                            "status": "search_error",
                            "head_coach": "",
                            "source_url": "",
                            "source_domain": "",
                            "redirect_url": "",
                            "source_date": "",
                            "source_details": "Batch agent omitted this team from returned output.",
                            "discovered_official_urls": [],
                            "needs_url_resolution": False,
                        }
                    )
            return sanitized
        except Exception as err:
            last_err = err
            log(f"[Batch #{batch_idx + 1}] Attempt {attempt + 1} failed: {err}")

    return [
        {
            "team": t["team"],
            "canonical_team": t["canonical_team"],
            "university": t.get("university", ""),
            "phase": t.get("phase", ""),
            "status": "search_error",
            "head_coach": "",
            "source_url": "",
            "source_domain": "",
            "redirect_url": "",
            "source_date": "",
            "source_details": f"Batch research failed after retry: {last_err}",
            "discovered_official_urls": [],
            "needs_url_resolution": False,
        }
        for t in batch
    ]


phase("Audit Active Roster")
log(f"Running coach_roster_audit.mjs for {COMPETITION} {SEASON}...")
audit_proc = subprocess.run(
    [
        "node",
        os.path.join(ROOT_DIR, "scripts", "coach_roster_audit.mjs"),
        "--competition",
        COMPETITION,
        "--season",
        str(SEASON),
        "--format",
        "json",
    ],
    cwd=ROOT_DIR,
    capture_output=True,
    text=True,
    check=True,
)
audit_data = json.loads(audit_proc.stdout)
summary = audit_data["summary"]
log(
    f"Roster summary: {summary['total_active_teams']} active | "
    f"{summary['verified_synced']} synced | "
    f"{summary['verified_unsynced']} verified_unsynced | "
    f"{summary['missing']} missing"
)

missing_teams = audit_data.get("missing", [])
if TEAMS_FILTER:
    filter_set = {x.strip().lower() for x in TEAMS_FILTER}
    missing_teams = [
        t
        for t in missing_teams
        if t["team"].lower() in filter_set or t["canonical_team"].lower() in filter_set
    ]
    log(f"Filtered missing teams to {len(missing_teams)} matching teams_filter.")

# Load optional pre-scanned source page hits if present
scan_hits_by_team = {}
if os.path.exists(SCAN_FILE_PATH):
    with open(SCAN_FILE_PATH, "r", encoding="utf-8") as sf:
        scan_data = json.load(sf)
    for item in scan_data.get("results", []):
        if item.get("match_count", 0) > 0:
            canon = item.get("canonical_team") or item.get("team")
            snippet = "; ".join(m.get("line", "") for m in item.get("matches", [])[:2])
            scan_hits_by_team.setdefault(canon, []).append(
                {"url": item.get("final_url") or item.get("requested_url"), "snippet": snippet[:240]}
            )
    log(f"Loaded pre-scanned page hits for {len(scan_hits_by_team)} team(s).")

# Load existing checkpoint if resume=True
results_by_team = {}
if RESUME and os.path.exists(ABS_OUTPUT_PATH):
    with open(ABS_OUTPUT_PATH, "r", encoding="utf-8") as rf:
        existing = json.load(rf)
    for rec in existing.get("results", []):
        if rec.get("team"):
            results_by_team[rec["team"]] = rec
    completed_ok = sum(1 for r in results_by_team.values() if r.get("status") != "search_error")
    log(f"Resume mode: found {len(results_by_team)} prior records ({completed_ok} non-error skipped).")

to_research = [
    t
    for t in missing_teams
    if not RESUME
    or t["team"] not in results_by_team
    or results_by_team[t["team"]].get("status") == "search_error"
]

phase("Search Missing Coaches")
log(f"Teams queued for research: {len(to_research)} (batch_size={BATCH_SIZE}, concurrency={CONCURRENCY})")

if to_research:
    batches = make_batches(to_research, BATCH_SIZE)
    for w_start in range(0, len(batches), CONCURRENCY):
        wave = batches[w_start : w_start + CONCURRENCY]
        wave_num = (w_start // CONCURRENCY) + 1
        total_waves = (len(batches) + CONCURRENCY - 1) // CONCURRENCY
        log(f"Starting wave {wave_num}/{total_waves} ({len(wave)} batch(es))...")

        wave_results = await parallel(
            list(enumerate(wave)),
            lambda pair, _base=w_start: safe_research_batch(pair[1], _base + pair[0], scan_hits_by_team),
        )
        for batch_res in wave_results:
            for rec in batch_res:
                results_by_team[rec["team"]] = rec

        counts = write_checkpoint(audit_data, results_by_team, missing_teams)
        log(f"Wave {wave_num} checkpoint saved. Counts so far: {counts}")
else:
    counts = write_checkpoint(audit_data, results_by_team, missing_teams)

# Automatic single retry wave for any search_error teams
error_teams = [
    t
    for t in missing_teams
    if results_by_team.get(t["team"], {}).get("status") == "search_error"
]

if error_teams:
    phase("Retry Search Errors")
    log(f"Retrying {len(error_teams)} team(s) that hit search_error...")
    retry_batches = make_batches(error_teams, BATCH_SIZE)
    for r_idx, r_batch in enumerate(retry_batches):
        retry_res = await safe_research_batch(r_batch, r_idx, scan_hits_by_team)
        for rec in retry_res:
            results_by_team[rec["team"]] = rec
        counts = write_checkpoint(audit_data, results_by_team, missing_teams)
        log(f"Retry batch {r_idx + 1}/{len(retry_batches)} saved. Counts: {counts}")

phase("Summary")
final_counts = write_checkpoint(audit_data, results_by_team, missing_teams)
log(f"Finished {COMPETITION} {SEASON} coach search. Saved to {OUTPUT_PATH}")
log(f"Final breakdown: {json.dumps(final_counts)}")
print(json.dumps({"output_path": OUTPUT_PATH, "counts": final_counts}, indent=2))
