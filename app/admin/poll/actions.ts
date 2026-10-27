"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { assertPermission, isSuperAdmin } from "@/lib/auth/admin-guard";
import { isPlayoffPhase, getPhaseTierInfo } from "@/lib/utils/phase-utils";
import { resolveTeamIdentity } from "@/lib/utils/team-resolver";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

export interface PollGameResult {
    id: string;
    date: string | null;
    isHome: boolean;
    opponentId: string;
    opponentName: string;
    teamScore: number;
    opponentScore: number;
    outcome: "W" | "L" | "T";
    status: string;
}

export interface PollTeamItem {
    teamId: string;
    name: string;
    logoUrl: string | null;
    phaseId: string;
    phaseName: string;
    parentPhaseName: string | null;
    tierNumber: number;
    tierTitle: string;
    wins: number;
    losses: number;
    ties: number;
    pf: number;
    pa: number;
    diff: number;
    gp: number;
    winPct: number;
    headCoach: string | null;
    isChampion: boolean;
    gamesPlayed: PollGameResult[];
}

export interface PollDivisionGroup {
    phaseId: string;
    phaseName: string;
    parentPhaseName: string | null;
    tierNumber: number;
    tierTitle: string;
    subOrder: number;
    ordinal: number;
    teams: PollTeamItem[];
}

export interface SavedPollBallot {
    id: string;
    label: string;
    updatedAt: string;
    slots: (string | null)[];
    userId?: string;
    voterName?: string;
}

export async function fetchPollBuilderData(seasonId?: string) {
    const user = await assertPermission("poll");
    const userIsAdmin = isSuperAdmin(user);
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch all seasons with competition details
    const { data: allSeasons, error: seasonsErr } = await supabase
        .from("seasons")
        .select("id, year, name, competition_id, competition:competitions(id, name, slug, level)")
        .order("year", { ascending: false });

    if (seasonsErr) {
        throw new Error(`Failed to fetch seasons: ${seasonsErr.message}`);
    }

    const seasonsList = (allSeasons || []).map((s: any) => {
        const comp = Array.isArray(s.competition) ? s.competition[0] : s.competition;
        const isUniball =
            comp?.slug === "buafl" ||
            comp?.slug === "bcafl" ||
            comp?.level === "University" ||
            comp?.level === "Uniball" ||
            (comp?.name || "").toLowerCase().includes("universit");
        return {
            id: s.id,
            year: s.year,
            name: s.name,
            competitionName: comp?.name || "Unknown",
            competitionSlug: comp?.slug || "",
            isUniball,
        };
    });

    // Sort so Uniball seasons come first (newest to oldest), followed by other competitions
    seasonsList.sort((a, b) => {
        if (a.isUniball && !b.isUniball) return -1;
        if (!a.isUniball && b.isUniball) return 1;
        return b.year - a.year;
    });

    let activeSeasonId = seasonId;
    if (!activeSeasonId && seasonsList.length > 0) {
        const latestUniball = seasonsList.find((s) => s.isUniball);
        activeSeasonId = latestUniball ? latestUniball.id : seasonsList[0].id;
    }

    const activeSeason = seasonsList.find((s) => s.id === activeSeasonId) || seasonsList[0];
    if (!activeSeason) {
        return {
            seasons: [],
            activeSeasonId: "",
            activeSeasonYear: new Date().getFullYear(),
            divisions: [] as PollDivisionGroup[],
            savedBallots: [] as SavedPollBallot[],
            allBallots: [] as SavedPollBallot[],
            currentUserId: user.id,
        };
    }

    // 2. Fetch phases for activeSeasonId
    const { data: phasesData, error: phasesErr } = await supabase
        .from("phases")
        .select("id, name, type, ordinal, parent_phase_id")
        .eq("season_id", activeSeason.id);

    if (phasesErr) {
        throw new Error(`Failed to fetch phases: ${phasesErr.message}`);
    }

    const phases = phasesData || [];
    const phaseMap = new Map<string, any>(phases.map((p: any) => [p.id, p]));
    const phaseIds = phases.map((p: any) => p.id);

    if (phaseIds.length === 0) {
        return {
            seasons: seasonsList,
            activeSeasonId: activeSeason.id,
            activeSeasonYear: activeSeason.year,
            divisions: [] as PollDivisionGroup[],
            savedBallots: [] as SavedPollBallot[],
            allBallots: [] as SavedPollBallot[],
            currentUserId: user.id,
        };
    }

    // 3. Fetch participations, games, and saved poll ballots in parallel
    const [partRes, gamesRes, notesRes] = await Promise.all([
        supabase
            .from("participations")
            .select("*, person:people(display_name), team:teams(id, name, logo_url, team_aliases(*))")
            .in("phase_id", phaseIds),
        supabase
            .from("games")
            .select(`
                id,
                phase_id,
                away_phase_id,
                date,
                status,
                home_team_id,
                away_team_id,
                home_score,
                away_score,
                is_playoff,
                is_double_header,
                game_type,
                home_team:teams!home_team_id(id, name, logo_url, team_aliases(*)),
                away_team:teams!away_team_id(id, name, logo_url, team_aliases(*))
            `)
            .in("phase_id", phaseIds)
            .neq("status", "anomaly")
            .order("date", { ascending: true }),
        supabase
            .from("notes")
            .select("id, content, created_at")
            .eq("entity_type", "writers_poll")
            .eq("entity_id", activeSeason.id)
            .order("created_at", { ascending: false }),
    ]);

    if (partRes.error) {
        throw new Error(`Failed to fetch participations: ${partRes.error.message}`);
    }
    if (gamesRes.error) {
        throw new Error(`Failed to fetch games: ${gamesRes.error.message}`);
    }

    const participations = partRes.data || [];
    const allGames = gamesRes.data || [];

    // Filter regular season completed/awarded games for standings computation
    const completedLeagueGames = allGames.filter((g: any) => {
        const status = (g.status || "").toLowerCase();
        const isCompleted = status === "completed" || status === "awarded";
        const isLeague = !g.game_type || g.game_type === "league";
        const isPlayoff = g.is_playoff === true;
        return isCompleted && isLeague && !isPlayoff;
    });

    // Group participations by phase_id
    const partsByPhase = new Map<string, any[]>();
    for (const p of participations) {
        if (!partsByPhase.has(p.phase_id)) {
            partsByPhase.set(p.phase_id, []);
        }
        partsByPhase.get(p.phase_id)!.push(p);
    }

    const divisions: PollDivisionGroup[] = [];

    for (const [phaseId, phaseParts] of partsByPhase.entries()) {
        const phase = phaseMap.get(phaseId);
        if (!phase) continue;
        if (isPlayoffPhase(phase)) continue;

        const parentPhase = phase.parent_phase_id ? phaseMap.get(phase.parent_phase_id) : null;
        const tierInfo = getPhaseTierInfo(phase.name, parentPhase?.name, phase.ordinal);

        const teams: PollTeamItem[] = phaseParts.map((p: any) => {
            const rawTeam = Array.isArray(p.team) ? p.team[0] : p.team;
            const resolved = rawTeam
                ? resolveTeamIdentity(rawTeam, activeSeason.year)
                : { name: "Unknown Team", logo_url: null };

            const teamGames = completedLeagueGames.filter(
                (g: any) => g.home_team_id === p.team_id || g.away_team_id === p.team_id
            );

            let wins = 0;
            let losses = 0;
            let ties = 0;
            let pf = 0;
            let pa = 0;
            const gamesPlayed: PollGameResult[] = [];

            if (teamGames.length > 0) {
                for (const g of teamGames) {
                    const isHome = g.home_team_id === p.team_id;
                    const myScore = isHome ? g.home_score : g.away_score;
                    const oppScore = isHome ? g.away_score : g.home_score;
                    const mult = g.is_double_header ? 2 : 1;

                    if (myScore !== null && oppScore !== null) {
                        pf += myScore;
                        pa += oppScore;
                        let outcome: "W" | "L" | "T" = "T";
                        if (myScore > oppScore) {
                            wins += mult;
                            outcome = "W";
                        } else if (myScore < oppScore) {
                            losses += mult;
                            outcome = "L";
                        } else {
                            ties += mult;
                            outcome = "T";
                        }

                        const rawOpp = isHome ? g.away_team : g.home_team;
                        const oppObj = Array.isArray(rawOpp) ? rawOpp[0] : rawOpp;
                        const oppResolved = oppObj
                            ? resolveTeamIdentity(oppObj as any, activeSeason.year)
                            : { name: "Opponent", logo_url: null };

                        gamesPlayed.push({
                            id: g.id,
                            date: g.date,
                            isHome,
                            opponentId: isHome ? g.away_team_id : g.home_team_id,
                            opponentName: oppResolved.name,
                            teamScore: myScore,
                            opponentScore: oppScore,
                            outcome,
                            status: g.status,
                        });
                    }
                }
            } else {
                // Fallback to stored participation numbers
                wins = p.wins || 0;
                losses = p.losses || 0;
                ties = p.ties || 0;
                pf = p.points_for || 0;
                pa = p.points_against || 0;
            }

            const gp = wins + losses + ties;
            const winPct = gp > 0 ? (wins + 0.5 * ties) / gp : 0;
            const diff = pf - pa;
            const coachObj = Array.isArray(p.person) ? p.person[0] : p.person;

            return {
                teamId: p.team_id,
                name: resolved.name,
                logoUrl: resolved.logo_url,
                phaseId: phase.id,
                phaseName: phase.name,
                parentPhaseName: parentPhase?.name || null,
                tierNumber: tierInfo.tierNumber,
                tierTitle: tierInfo.tierTitle,
                wins,
                losses,
                ties,
                pf,
                pa,
                diff,
                gp,
                winPct,
                headCoach: coachObj?.display_name || null,
                isChampion: !!p.is_champion,
                gamesPlayed,
            };
        });

        // Sort teams within the division by standings
        teams.sort((a, b) => {
            if (b.winPct !== a.winPct) return b.winPct - a.winPct;
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.diff !== a.diff) return b.diff - a.diff;
            if (b.pf !== a.pf) return b.pf - a.pf;
            return a.name.localeCompare(b.name);
        });

        divisions.push({
            phaseId: phase.id,
            phaseName: phase.name,
            parentPhaseName: parentPhase?.name || null,
            tierNumber: tierInfo.tierNumber,
            tierTitle: tierInfo.tierTitle,
            subOrder: tierInfo.subOrder,
            ordinal: phase.ordinal || 0,
            teams,
        });
    }

    // Sort divisions in tiered order: Tier 1 (Premier National -> North -> South) -> Tier 2 (Div 1) -> Tier 3 (Div 2)
    divisions.sort((a, b) => {
        if (a.tierNumber !== b.tierNumber) return a.tierNumber - b.tierNumber;
        if (a.subOrder !== b.subOrder) return a.subOrder - b.subOrder;
        if (a.ordinal !== b.ordinal) return a.ordinal - b.ordinal;
        return a.phaseName.localeCompare(b.phaseName);
    });

    // Parse saved ballots (both user-specific and all writers for consensus)
    const savedBallots: SavedPollBallot[] = [];
    const allBallots: SavedPollBallot[] = [];
    for (const note of notesRes.data || []) {
        try {
            const parsed = JSON.parse(note.content);
            if (parsed && Array.isArray(parsed.slots)) {
                const item: SavedPollBallot = {
                    id: note.id,
                    label: parsed.label || "Saved Poll",
                    updatedAt: parsed.updatedAt || note.created_at,
                    slots: parsed.slots,
                    userId: parsed.userId || undefined,
                    voterName: parsed.voterName || "Writer",
                };
                allBallots.push(item);

                // Include in "My Saved Ballots" if it belongs to this user, or if it's a legacy ballot and user is admin
                if (parsed.userId === user.id || (!parsed.userId && userIsAdmin)) {
                    savedBallots.push(item);
                }
            }
        } catch {
            // Ignore malformed note
        }
    }

    return {
        seasons: seasonsList,
        activeSeasonId: activeSeason.id,
        activeSeasonYear: activeSeason.year,
        divisions,
        savedBallots,
        allBallots,
        currentUserId: user.id,
    };
}

export async function savePollBallotAction(
    seasonId: string,
    label: string,
    slots: (string | null)[]
) {
    try {
        const user = await assertPermission("poll");
        const userIsAdmin = isSuperAdmin(user);
        const supabase = createClient(supabaseUrl, supabaseKey);

        const cleanLabel = (label || "Current Ballot").trim();
        const normalizedSlots = Array.from({ length: 25 }, (_, i) => slots[i] || null);
        const voterName =
            user.user_metadata?.display_name ||
            user.user_metadata?.name ||
            (user.email ? user.email.split("@")[0] : "Writer");

        const contentPayload = JSON.stringify({
            label: cleanLabel,
            updatedAt: new Date().toISOString(),
            slots: normalizedSlots,
            userId: user.id,
            voterName,
        });

        // Check if a ballot with the same label exists for THIS user in this season
        const { data: existingNotes } = await supabase
            .from("notes")
            .select("id, content")
            .eq("entity_type", "writers_poll")
            .eq("entity_id", seasonId);

        let matchingNoteId: string | null = null;
        for (const note of existingNotes || []) {
            try {
                const parsed = JSON.parse(note.content);
                const sameLabel = parsed?.label?.toLowerCase() === cleanLabel.toLowerCase();
                const sameOwner =
                    parsed?.userId === user.id || (!parsed?.userId && userIsAdmin);
                if (sameLabel && sameOwner) {
                    matchingNoteId = note.id;
                    break;
                }
            } catch {
                // ignore
            }
        }

        if (matchingNoteId) {
            const { error } = await supabase
                .from("notes")
                .update({ content: contentPayload })
                .eq("id", matchingNoteId);
            if (error) throw error;
        } else {
            const { error } = await supabase.from("notes").insert({
                entity_type: "writers_poll",
                entity_id: seasonId,
                content: contentPayload,
            });
            if (error) throw error;
        }

        revalidatePath("/admin/poll");
        return { success: true };
    } catch (err: any) {
        console.error("Error saving poll ballot:", err);
        return { success: false, error: err.message || "Failed to save ballot." };
    }
}

export async function deletePollBallotAction(noteId: string) {
    try {
        const user = await assertPermission("poll");
        const userIsAdmin = isSuperAdmin(user);
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: note } = await supabase
            .from("notes")
            .select("id, content")
            .eq("id", noteId)
            .eq("entity_type", "writers_poll")
            .maybeSingle();

        if (!note) {
            return { success: false, error: "Ballot not found." };
        }

        if (!userIsAdmin) {
            try {
                const parsed = JSON.parse(note.content);
                if (parsed?.userId !== user.id) {
                    return {
                        success: false,
                        error: "You can only delete your own saved ballots.",
                    };
                }
            } catch {
                return { success: false, error: "Unauthorized." };
            }
        }

        const { error } = await supabase
            .from("notes")
            .delete()
            .eq("id", noteId)
            .eq("entity_type", "writers_poll");

        if (error) throw error;

        revalidatePath("/admin/poll");
        return { success: true };
    } catch (err: any) {
        console.error("Error deleting poll ballot:", err);
        return { success: false, error: err.message || "Failed to delete ballot." };
    }
}
