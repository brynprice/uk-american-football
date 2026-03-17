"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export async function approveGameProposal(proposalId: string, adminNotes?: string) {
    try {
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

        const proposedData = proposal.proposed_data;

        // 2. Resolve IDs
        console.log("Resolving IDs for proposal:", proposalId, proposedData);
        
        // Resolve Phase ID
        let phaseId = null;
        if (proposedData.phase && proposedData.year) {
            const { data: seasons } = await supabase.from("seasons").select("id, year, competition:competitions (name)");
            const season = seasons?.find(s => `${(s.competition as any).name} ${s.year}` === proposedData.year);
            console.log("Resolved Season:", season?.id);
            
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
        console.log("Resolved Phase ID:", phaseId);

        // Resolve Team IDs
        const resolveTeam = async (name: string) => {
            const { data } = await supabase.from("teams").select("id").eq("name", name).single();
            return data?.id || null;
        };

        const homeTeamId = proposedData.home_team ? await resolveTeam(proposedData.home_team) : null;
        const awayTeamId = proposedData.away_team ? await resolveTeam(proposedData.away_team) : null;
        console.log("Resolved Teams:", { homeTeamId, awayTeamId });

        // Resolve Venue ID
        let venueId = null;
        if (proposedData.venue) {
            const { data } = await supabase.from("venues").select("id").eq("name", proposedData.venue).single();
            venueId = data?.id || null;
        }
        console.log("Resolved Venue ID:", venueId);

        // Helper to handle scores (including 0)
        const parseScore = (val: any) => {
            if (val === "" || val === undefined || val === null) return null;
            const parsed = parseInt(val);
            return isNaN(parsed) ? null : parsed;
        };

        // 3. Apply the changes based on proposal_type
        if (proposal.proposal_type === 'update' && proposal.game_id) {
            const updatePayload: any = {
                date: proposedData.date || null,
                time: proposedData.time || null,
                home_score: parseScore(proposedData.home_score),
                away_score: parseScore(proposedData.away_score),
                status: proposedData.status,
                is_playoff: proposedData.is_playoff,
                playoff_round: proposedData.playoff_round || null,
                final_type: proposedData.final_type || 'none',
                title_name: proposedData.title_name || null,
                is_double_header: proposedData.is_double_header || false,
                notes: proposedData.notes || null,
            };

            if (phaseId) updatePayload.phase_id = phaseId;
            if (homeTeamId) updatePayload.home_team_id = homeTeamId;
            if (awayTeamId) updatePayload.away_team_id = awayTeamId;
            if (venueId) updatePayload.venue_id = venueId;

            const { error: updateErr } = await supabase
                .from("games")
                .update(updatePayload)
                .eq("id", proposal.game_id);

            if (updateErr) {
                console.error("Game update error:", updateErr);
                throw updateErr;
            }

            // Handle Coaches
            const handleCoach = async (teamId: string | null, personIdOrName: string | null) => {
                if (!teamId || !personIdOrName || !proposal.game_id) return;
                console.log("Handling coach:", { teamId, personIdOrName });

                let personId = null;
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(personIdOrName);
                
                if (isUuid) {
                    personId = personIdOrName;
                } else {
                    const { data: existingPerson } = await supabase.from("people").select("id").eq("display_name", personIdOrName).single();
                    if (existingPerson) {
                        personId = existingPerson.id;
                    } else {
                        const { data: newPerson, error: personErr } = await supabase
                            .from("people")
                            .insert({ display_name: personIdOrName })
                            .select("id")
                            .single();
                        if (personErr) throw personErr;
                        personId = newPerson.id;
                    }
                }

                if (personId) {
                    console.log("Upserting game staff:", { game_id: proposal.game_id, team_id: teamId, person_id: personId });
                    const { error: staffErr } = await supabase
                        .from("game_staff")
                        .upsert({
                            game_id: proposal.game_id,
                            team_id: teamId,
                            person_id: personId,
                            role: 'head_coach'
                        });
                    if (staffErr) {
                        console.warn("Staff upsert error (continuing):", staffErr);
                    }
                }
            };

            // Handle Coaches sequentially to avoid race conditions or complex Promise.all issues
            console.log("Processing coaches...");
            
            // Get current team IDs if they weren't resolved from proposed names
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

            console.log("Team IDs for coach processing:", { currentHomeTeamId, currentAwayTeamId });

            if (proposedData.home_coach) {
                console.log("Handling home coach...");
                await handleCoach(currentHomeTeamId, proposedData.home_coach);
            }

            if (proposedData.away_coach) {
                console.log("Handling away coach...");
                await handleCoach(currentAwayTeamId, proposedData.away_coach);
            }
            console.log("Finished processing coaches.");

        } else if (proposal.proposal_type === 'add') {
            // For now, we still point admins to the manual tool for "add" 
            // unless we want to fully implement auto-creation here.
            // Let's at least resolve the IDs so they are ready.
            console.log("Add proposal logic would use the same ID resolution pattern.");
        }

        // 4. Update proposal status
        const { error: statusErr } = await supabase
            .from("game_proposals")
            .update({
                status: 'approved',
                admin_notes: adminNotes || null,
                updated_at: new Date().toISOString()
            })
            .eq("id", proposalId);

        if (statusErr) throw statusErr;

        revalidatePath("/admin/proposals");
        if (proposal.game_id) revalidatePath(`/games/${proposal.game_id}`);

        return { success: true };
    } catch (err: any) {
        console.error("Proposal approval error:", err);
        return { success: false, error: err.message || "An unknown error occurred" };
    }
}

export async function rejectGameProposal(proposalId: string, adminNotes?: string) {
    const fs = require('fs');
    const log = (msg: string) => fs.appendFileSync('/tmp/approval_debug.log', `${new Date().toISOString()}: [REJECT] ${msg}\n`);

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

        log(`Starting rejection for ${proposalId}`);
        const supabase = createClient(supabaseUrl!, supabaseKey!);

        const { error } = await supabase
            .from("game_proposals")
            .update({
                status: 'rejected',
                admin_notes: adminNotes || null,
                updated_at: new Date().toISOString()
            })
            .eq("id", proposalId);

        if (error) {
            log(`Rejection error: ${JSON.stringify(error)}`);
            throw error;
        }

        log("Successfully rejected.");
        revalidatePath("/admin/proposals");
        return { success: true };
    } catch (err: any) {
        log(`Caught error: ${err.message}`);
        return { success: false, error: err.message || "An unknown error occurred" };
    }
}
