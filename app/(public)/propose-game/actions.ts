"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { isValidUuid, isSafeHttpUrl } from "@/lib/utils/validation";

export type ProposalType = 'add' | 'update' | 'delete';

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PROPOSALS_PER_WINDOW = 10;
const proposalRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkProposalRateLimit(clientKey: string): boolean {
    const now = Date.now();
    const entry = proposalRateLimitMap.get(clientKey);
    if (!entry || now > entry.resetAt) {
        proposalRateLimitMap.set(clientKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }
    if (entry.count >= MAX_PROPOSALS_PER_WINDOW) {
        return false;
    }
    entry.count += 1;
    return true;
}

const ALLOWED_PROPOSED_STRING_FIELDS: Record<string, number> = {
    competition: 100,
    year: 100,
    phase: 150,
    date: 30,
    time: 20,
    home_team: 150,
    away_team: 150,
    home_score: 10,
    away_score: 10,
    home_coach: 120,
    away_coach: 120,
    venue: 200,
    notes: 2000,
    status: 30,
    playoff_round: 100,
    final_type: 30,
    title_name: 150,
};

function sanitizeProposedData(raw: any): Record<string, any> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error("Invalid proposed game data.");
    }

    const sanitized: Record<string, any> = {};
    for (const [key, maxLen] of Object.entries(ALLOWED_PROPOSED_STRING_FIELDS)) {
        if (raw[key] !== undefined && raw[key] !== null) {
            const strVal = String(raw[key]).trim();
            if (strVal.length > maxLen) {
                throw new Error(`Field "${key}" exceeds maximum length of ${maxLen} characters.`);
            }
            sanitized[key] = strVal;
        }
    }

    sanitized.is_playoff = Boolean(raw.is_playoff);
    sanitized.is_double_header = Boolean(raw.is_double_header);

    return sanitized;
}

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
        const reqHeaders = await headers();
        const forwardedFor = reqHeaders.get("x-forwarded-for");
        const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "local";

        if (!checkProposalRateLimit(clientIp)) {
            return {
                success: false,
                error: "Too many proposals submitted recently. Please wait a few minutes before trying again."
            };
        }

        // Basic payload validation to prevent abuse/spam
        if (!payload || !payload.proposalType || !['add', 'update', 'delete'].includes(payload.proposalType)) {
            return { success: false, error: "Invalid proposal type." };
        }

        if (payload.gameId && !isValidUuid(payload.gameId)) {
            return { success: false, error: "Invalid game ID." };
        }

        if (!payload.reason || typeof payload.reason !== 'string' || payload.reason.trim().length === 0) {
            return { success: false, error: "Please provide a reason for the proposal." };
        }

        if (payload.reason.length > 2000) {
            return { success: false, error: "Reason must be under 2,000 characters." };
        }

        if (payload.submittedByName && payload.submittedByName.length > 100) {
            return { success: false, error: "Name must be under 100 characters." };
        }

        if (payload.submittedByEmail && payload.submittedByEmail.length > 150) {
            return { success: false, error: "Email must be under 150 characters." };
        }

        let cleanSourceUrl: string | null = null;
        if (payload.sourceUrl && payload.sourceUrl.trim().length > 0) {
            const rawSource = payload.sourceUrl.trim();
            if (rawSource.length > 500) {
                return { success: false, error: "Source URL must be under 500 characters." };
            }
            // Reject dangerous URI schemes (e.g. javascript:, data:, vbscript:, file:)
            if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawSource) && !isSafeHttpUrl(rawSource)) {
                return { success: false, error: "Source URL must use http:// or https:// (or be a plain text reference)." };
            }
            cleanSourceUrl = rawSource;
        }

        const sanitizedData = sanitizeProposedData(payload.proposedData);

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Missing Supabase configuration.");
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { error } = await supabase.from("game_proposals").insert({
            game_id: payload.gameId || null,
            proposal_type: payload.proposalType,
            proposed_data: sanitizedData,
            reason: payload.reason.trim(),
            source_url: cleanSourceUrl,
            submitted_by_name: payload.submittedByName?.trim() || null,
            submitted_by_email: payload.submittedByEmail?.trim() || null,
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
