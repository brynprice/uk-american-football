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

        // 2. Apply the changes based on proposal_type
        if (proposal.proposal_type === 'update' && proposal.game_id) {
            // Update existing game
            // We need to map field names if they differ, but currently they match our form
            const { error: updateErr } = await supabase
                .from("games")
                .update({
                    date: proposedData.date,
                    home_score: proposedData.home_score ? parseInt(proposedData.home_score) : null,
                    away_score: proposedData.away_score ? parseInt(proposedData.away_score) : null,
                    status: proposedData.status,
                    is_playoff: proposedData.is_playoff,
                    playoff_round: proposedData.playoff_round,
                    final_type: proposedData.final_type,
                    title_name: proposedData.title_name,
                    is_double_header: proposedData.is_double_header,
                    // Note: In a real app we'd also handle teams/venues resolution
                    // but for this MVP we are applying the simple fields.
                })
                .eq("id", proposal.game_id);

            if (updateErr) throw updateErr;
        } else if (proposal.proposal_type === 'add') {
            // Adding a new game would require resolving phase_id, team_ids, venue_id etc.
            // For now, we'll mark it as approved but inform the admin they might need to 
            // use the manual "Add Game" tool if the IDs aren't resolved.
            // TODO: Enhance this to auto-create games if IDs are resolved.
            console.log("Auto-creating games from proposals is a future enhancement.");
        }

        // 3. Update proposal status
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
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

        const supabase = createClient(supabaseUrl!, supabaseKey!);

        const { error } = await supabase
            .from("game_proposals")
            .update({
                status: 'rejected',
                admin_notes: adminNotes || null,
                updated_at: new Date().toISOString()
            })
            .eq("id", proposalId);

        if (error) throw error;

        revalidatePath("/admin/proposals");
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message || "An unknown error occurred" };
    }
}
