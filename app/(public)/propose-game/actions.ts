"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export type ProposalType = 'add' | 'update' | 'delete';

export async function submitGameProposal(payload: {
    gameId?: string;
    proposalType: ProposalType;
    proposedData: any;
    reason: string;
    sourceUrl?: string;
    submittedByName?: string;
    submittedByEmail?: string;
}) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Missing Supabase configuration.");
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { error } = await supabase.from("game_proposals").insert({
            game_id: payload.gameId || null,
            proposal_type: payload.proposalType,
            proposed_data: payload.proposedData,
            reason: payload.reason,
            source_url: payload.sourceUrl || null,
            submitted_by_name: payload.submittedByName || null,
            submitted_by_email: payload.submittedByEmail || null,
            status: 'pending'
        });

        if (error) throw error;

        // Revalidate admin proposals page if it exists
        revalidatePath("/admin/proposals");

        return { success: true };
    } catch (err: any) {
        console.error("Proposal submission error:", err);
        return { success: false, error: err.message || "An unknown error occurred" };
    }
}
