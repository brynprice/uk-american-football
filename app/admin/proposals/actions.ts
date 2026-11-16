"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { assertPermission, UnauthorizedError } from "@/lib/auth/admin-guard";
import {
    isValidFinalType,
    isValidGameStatus,
    isValidIsoDate,
    isValidTimeString,
    isValidUuid,
    parseOptionalScore,
} from "@/lib/utils/validation";

export async function approveGameProposal(proposalId: string, adminNotes?: string) {
    try {
        await assertPermission("proposals");

        if (!isValidUuid(proposalId)) {
            return { success: false, error: "Invalid proposal ID." };
        }
        if (adminNotes && adminNotes.length > 2000) {
            return { success: false, error: "Admin notes must be under 2,000 characters." };
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Missing Supabase configuration.");
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Get the proposal
        const { data: proposal, error: fetchErr } = await supabase
            .from("game_proposals")
            .select("*")
            .eq("id", proposalId)
            .single();

        if (fetchErr) throw fetchErr;
        if (!proposal) throw new Error("Proposal not found");
        if (proposal.status !== "pending") {
            return { success: false, error: `Proposal has already been ${proposal.status}.` };
        }

        const proposedData = proposal.proposed_data || {};

        // Validate update payload fields up front before claiming or mutating records
        let cleanUpdatePayload: Record<string, any> | null = null;
        if (proposal.proposal_type === "update" && proposal.game_id) {
            if (!isValidUuid(proposal.game_id)) {
                return { success: false, error: "Proposal references an invalid game ID." };
            }

            const rawDate = proposedData.date ? String(proposedData.date).trim() : "";
            if (rawDate && !isValidIsoDate(rawDate)) {
                return { success: false, error: "Proposed game date must be in YYYY-MM-DD format." };
            }

            const rawTime = proposedData.time ? String(proposedData.time).trim() : "";
            if (rawTime && !isValidTimeString(rawTime)) {
                return { success: false, error: "Proposed game time must be in HH:MM or HH:MM:SS format." };
            }

            const normalizedStatus = String(proposedData.status || "completed").trim().toLowerCase();
            if (!isValidGameStatus(normalizedStatus)) {
                return { success: false, error: "Proposed game status is invalid." };
            }

            const normalizedFinalType = String(proposedData.final_type || "none").trim().toLowerCase();
            if (!isValidFinalType(normalizedFinalType)) {
                return { success: false, error: "Proposed final type is invalid." };
            }

            cleanUpdatePayload = {
                date: rawDate || null,
                time: rawTime || null,
                home_score: parseOptionalScore(proposedData.home_score),
                away_score: parseOptionalScore(proposedData.away_score),
                status: normalizedStatus,
                is_playoff: Boolean(proposedData.is_playoff),
                playoff_round: proposedData.playoff_round ? String(proposedData.playoff_round).trim().slice(0, 100) : null,
                final_type: normalizedFinalType !== "none" ? normalizedFinalType : null,
                title_name: proposedData.title_name ? String(proposedData.title_name).trim().slice(0, 150) : null,
                is_double_header: Boolean(proposedData.is_double_header),
                notes: proposedData.notes ? String(proposedData.notes).trim().slice(0, 2000) : null,
            };
        }

        // 2. Atomically claim this pending proposal so concurrent requests cannot replay it
        const { data: claimedProposal, error: claimErr } = await supabase
            .from("game_proposals")
            .update({
                status: "approved",
                admin_notes: adminNotes?.trim() || null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", proposalId)
            .eq("status", "pending")
            .select("id")
            .maybeSingle();

        if (claimErr) throw claimErr;
        if (!claimedProposal) {
            return { success: false, error: "This proposal has already been processed." };
        }

        try {
            // 3. Resolve IDs
            // Resolve Phase ID
            let phaseId = null;
            if (proposedData.phase && proposedData.year) {
                const { data: seasons } = await supabase.from("seasons").select("id, year, competition:competitions (name)");
                const season = seasons?.find(s => `${(s.competition as any).name} ${s.year}` === proposedData.year);

                if (season) {
                    const { data: phase } = await supabase
                        .from("phases")
                        .select("id")
                        .eq("season_id", season.id)
                        .eq("name", proposedData.phase)
                        .single();
                    if (phase) phaseId = phase.id;
                }
            }

            // Resolve Team IDs
            const resolveTeam = async (name: string) => {
                const { data } = await supabase.from("teams").select("id").eq("name", name).single();
                return data?.id || null;
            };

            const homeTeamId = proposedData.home_team ? await resolveTeam(proposedData.home_team) : null;
            const awayTeamId = proposedData.away_team ? await resolveTeam(proposedData.away_team) : null;

            // Resolve Venue ID
            let venueId = null;
            if (proposedData.venue) {
                const { data } = await supabase.from("venues").select("id").eq("name", proposedData.venue).single();
                venueId = data?.id || null;
            }

            // 4. Apply changes for verified update proposals
            if (cleanUpdatePayload && proposal.game_id) {
                if (phaseId) cleanUpdatePayload.phase_id = phaseId;
                if (homeTeamId) cleanUpdatePayload.home_team_id = homeTeamId;
                if (awayTeamId) cleanUpdatePayload.away_team_id = awayTeamId;
                if (venueId) cleanUpdatePayload.venue_id = venueId;

                const { error: updateErr } = await supabase
                    .from("games")
                    .update(cleanUpdatePayload)
                    .eq("id", proposal.game_id);

                if (updateErr) {
                    console.error("Game update error:", updateErr);
                    throw updateErr;
                }

                // Handle Coaches
                const handleCoach = async (teamId: string | null, personIdOrName: string | null) => {
                    if (!teamId || !personIdOrName || !proposal.game_id) return;
                    const trimmedCoach = String(personIdOrName).trim();
                    if (!trimmedCoach || trimmedCoach.length > 120) return;

                    let personId = null;
                    if (isValidUuid(trimmedCoach)) {
                        personId = trimmedCoach;
                    } else {
                        const { data: existingPerson } = await supabase
                            .from("people")
                            .select("id")
                            .eq("display_name", trimmedCoach)
                            .maybeSingle();
                        if (existingPerson) {
                            personId = existingPerson.id;
                        } else {
                            const { data: newPerson, error: personErr } = await supabase
                                .from("people")
                                .insert({ display_name: trimmedCoach })
                                .select("id")
                                .single();
                            if (personErr) throw personErr;
                            personId = newPerson.id;
                        }
                    }

                    if (personId) {
                        const { error: staffErr } = await supabase
                            .from("game_staff")
                            .upsert({
                                game_id: proposal.game_id,
                                team_id: teamId,
                                person_id: personId,
                                role: "head_coach",
                            });
                        if (staffErr) {
                            console.warn("Staff upsert error (continuing):", staffErr);
                        }
                    }
                };

                let currentHomeTeamId = homeTeamId;
                let currentAwayTeamId = awayTeamId;

                if (!currentHomeTeamId || !currentAwayTeamId) {
                    const { data: currentGame } = await supabase
                        .from("games")
                        .select("home_team_id, away_team_id")
                        .eq("id", proposal.game_id)
                        .single();

                    if (!currentHomeTeamId) currentHomeTeamId = currentGame?.home_team_id;
                    if (!currentAwayTeamId) currentAwayTeamId = currentGame?.away_team_id;
                }

                if (proposedData.home_coach) {
                    await handleCoach(currentHomeTeamId, proposedData.home_coach);
                }

                if (proposedData.away_coach) {
                    await handleCoach(currentAwayTeamId, proposedData.away_coach);
                }

                // Recompute standings for the affected phase
                const targetPhaseId = phaseId || (await supabase.from("games").select("phase_id").eq("id", proposal.game_id).single()).data?.phase_id;
                if (targetPhaseId) {
                    await recomputePhaseStandings(supabase, targetPhaseId);
                    revalidatePath(`/phases/${targetPhaseId}`);
                }

                if (currentHomeTeamId) revalidatePath(`/teams/${currentHomeTeamId}`);
                if (currentAwayTeamId) revalidatePath(`/teams/${currentAwayTeamId}`);
            }
        } catch (applyErr) {
            // Roll back claim to pending if applying the update failed
            await supabase
                .from("game_proposals")
                .update({
                    status: "pending",
                    admin_notes: proposal.admin_notes || null,
                    updated_at: proposal.updated_at || new Date().toISOString(),
                })
                .eq("id", proposalId)
                .eq("status", "approved");
            throw applyErr;
        }

        revalidatePath("/admin/proposals");
        if (proposal.game_id) revalidatePath(`/games/${proposal.game_id}`);
        revalidatePath("/scorigami");
        revalidatePath("/scorigami/unique");
        revalidatePath("/");

        return { success: true };
    } catch (err: any) {
        console.error("Proposal approval error:", err);
        if (err instanceof UnauthorizedError) {
            return { success: false, error: err.message };
        }
        return { success: false, error: err?.message?.includes("Score must") ? err.message : "Failed to approve proposal." };
    }
}

async function recomputePhaseStandings(supabase: any, phaseId: string) {
    const { data: participations } = await supabase
        .from("participations")
        .select("id, team_id")
        .eq("phase_id", phaseId);

    if (!participations || participations.length === 0) return;

    const { data: phaseGames } = await supabase
        .from("games")
        .select("home_team_id, away_team_id, home_score, away_score, status, is_double_header, game_type, is_playoff")
        .eq("phase_id", phaseId)
        .in("status", ["completed", "awarded"])
        .eq("is_playoff", false);

    const stats = new Map<string, { w: number; l: number; t: number; pf: number; pa: number }>();
    for (const p of participations) {
        stats.set(p.team_id, { w: 0, l: 0, t: 0, pf: 0, pa: 0 });
    }

    for (const g of (phaseGames || [])) {
        if (g.game_type && g.game_type !== "league") continue;
        if (g.home_score === null || g.away_score === null) continue;

        const mult = g.is_double_header ? 2 : 1;

        if (stats.has(g.home_team_id)) {
            const h = stats.get(g.home_team_id)!;
            h.pf += g.home_score;
            h.pa += g.away_score;
            if (g.home_score > g.away_score) h.w += mult;
            else if (g.home_score < g.away_score) h.l += mult;
            else h.t += mult;
        }

        if (stats.has(g.away_team_id)) {
            const a = stats.get(g.away_team_id)!;
            a.pf += g.away_score;
            a.pa += g.home_score;
            if (g.away_score > g.home_score) a.w += mult;
            else if (g.away_score < g.home_score) a.l += mult;
            else a.t += mult;
        }
    }

    for (const p of participations) {
        const s = stats.get(p.team_id);
        if (s) {
            await supabase
                .from("participations")
                .update({
                    wins: s.w,
                    losses: s.l,
                    ties: s.t,
                    points_for: s.pf,
                    points_against: s.pa
                })
                .eq("id", p.id);
        }
    }
}

export async function rejectGameProposal(proposalId: string, adminNotes?: string) {
    try {
        await assertPermission("proposals");

        if (!isValidUuid(proposalId)) {
            return { success: false, error: "Invalid proposal ID." };
        }
        if (adminNotes && adminNotes.length > 2000) {
            return { success: false, error: "Admin notes must be under 2,000 characters." };
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Missing Supabase configuration.");
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: rejected, error } = await supabase
            .from("game_proposals")
            .update({
                status: 'rejected',
                admin_notes: adminNotes?.trim() || null,
                updated_at: new Date().toISOString()
            })
            .eq("id", proposalId)
            .eq("status", "pending")
            .select("id")
            .maybeSingle();

        if (error) {
            console.error("Rejection error:", error);
            throw error;
        }
        if (!rejected) {
            return { success: false, error: "Proposal not found or already processed." };
        }

        revalidatePath("/admin/proposals");
        return { success: true };
    } catch (err: any) {
        console.error("Caught rejection error:", err);
        if (err instanceof UnauthorizedError) {
            return { success: false, error: err.message };
        }
        return { success: false, error: "Failed to reject proposal." };
    }
}
