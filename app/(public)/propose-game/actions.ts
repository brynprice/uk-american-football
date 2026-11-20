"use server";

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { isValidUuid, isSafeHttpUrl } from "@/lib/utils/validation";

export type ProposalType = 'add' | 'update' | 'delete';

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PROPOSALS_PER_WINDOW = 10;
const MAX_RATE_LIMIT_ENTRIES = 5000;
const proposalRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getTrustedClientIp(reqHeaders: Headers): string {
    const vercelIp = reqHeaders.get("x-vercel-forwarded-for");
    if (vercelIp) return vercelIp.split(",")[0].trim();
    const cfIp = reqHeaders.get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();
    const realIp = reqHeaders.get("x-real-ip");
    if (realIp) return realIp.trim();
    const forwardedFor = reqHeaders.get("x-forwarded-for");
    if (forwardedFor) {
        const parts = forwardedFor.split(",").map((s) => s.trim()).filter(Boolean);
        if (parts.length > 0) return parts[parts.length - 1];
    }
    return "local";
}

function checkInMemoryRateLimit(clientKey: string): boolean {
    const now = Date.now();
    if (proposalRateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
        for (const [k, v] of proposalRateLimitMap) {
            if (now > v.resetAt) proposalRateLimitMap.delete(k);
        }
        // If still above threshold after pruning expired entries, clear oldest slots
        while (proposalRateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
            const firstKey = proposalRateLimitMap.keys().next().value;
            if (!firstKey) break;
            proposalRateLimitMap.delete(firstKey);
        }
    }

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

async function checkProposalRateLimit(supabase: any, clientHash: string): Promise<boolean> {
    if (!checkInMemoryRateLimit(clientHash)) {
        return false;
    }

    try {
        const { data, error } = await supabase.rpc("check_proposal_rate_limit", {
            p_client_hash: clientHash,
            p_max_requests: MAX_PROPOSALS_PER_WINDOW,
            p_window_seconds: Math.floor(RATE_LIMIT_WINDOW_MS / 1000),
        });
        if (!error && typeof data === "boolean") {
            return data;
        }
    } catch {
        // Fall back to in-memory check if DB rate-limit migration has not been applied yet
    }

    return true;
}

const ALLOWED_PROPOSED_STRING_FIELDS: Record<string, number> = {
    proposal_kind: 30,
    season_id: 60,
    season_year: 20,
    team_id: 60,
    team: 150,
    head_coach: 120,
    current_coach: 120,
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
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Missing Supabase configuration.");
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const reqHeaders = await headers();
        const clientIp = getTrustedClientIp(reqHeaders);
        const clientHash = crypto
            .createHmac("sha256", supabaseKey)
            .update(clientIp)
            .digest("hex");

        if (!(await checkProposalRateLimit(supabase, clientHash))) {
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
        return {
            success: false,
            error: err?.message?.includes("maximum length") || err?.message?.includes("Invalid proposed game data")
                ? err.message
                : "Failed to submit proposal."
        };
    }
}

export async function submitSeasonCoachProposal(payload: {
    seasonId: string;
    teamId: string;
    headCoach: string;
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

        const reqHeaders = await headers();
        const clientIp = getTrustedClientIp(reqHeaders);
        const clientHash = crypto
            .createHmac("sha256", supabaseKey)
            .update(clientIp)
            .digest("hex");

        if (!(await checkProposalRateLimit(supabase, clientHash))) {
            return {
                success: false,
                error: "Too many proposals submitted recently. Please wait a few minutes before trying again."
            };
        }

        if (!payload || !isValidUuid(payload.seasonId)) {
            return { success: false, error: "Please select a valid season." };
        }

        if (!isValidUuid(payload.teamId)) {
            return { success: false, error: "Please select a valid team." };
        }

        const cleanCoach = typeof payload.headCoach === "string" ? payload.headCoach.trim() : "";
        if (!cleanCoach) {
            return { success: false, error: "Please enter a Head Coach name." };
        }
        if (cleanCoach.length > 120) {
            return { success: false, error: "Head Coach name must be under 120 characters." };
        }

        if (!payload.reason || typeof payload.reason !== "string" || payload.reason.trim().length === 0) {
            return { success: false, error: "Please provide a reason or historical context for the proposal." };
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
            if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawSource) && !isSafeHttpUrl(rawSource)) {
                return { success: false, error: "Source URL must use http:// or https:// (or be a plain text reference)." };
            }
            cleanSourceUrl = rawSource;
        }

        // Verify Season and Team in database
        const [{ data: season, error: seasonErr }, { data: team, error: teamErr }, { data: phases }] = await Promise.all([
            supabase.from("seasons").select("id, year, name, competition:competitions(name)").eq("id", payload.seasonId).maybeSingle(),
            supabase.from("teams").select("id, name").eq("id", payload.teamId).maybeSingle(),
            supabase.from("phases").select("id, name").eq("season_id", payload.seasonId),
        ]);

        if (seasonErr || !season) {
            return { success: false, error: "Selected season could not be found." };
        }
        if (teamErr || !team) {
            return { success: false, error: "Selected team could not be found." };
        }

        const compName = (season.competition as any)?.name || "";
        const seasonLabel = compName ? `${compName} ${season.year}` : String(season.year);
        const phaseIds = (phases || []).map((p: any) => p.id);

        let currentCoachName = "";
        let phaseNamesLabel = "";
        if (phaseIds.length > 0) {
            const { data: parts } = await supabase
                .from("participations")
                .select("phase_id, person:people(display_name), phase:phases(name)")
                .in("phase_id", phaseIds)
                .eq("team_id", payload.teamId);

            if (parts && parts.length > 0) {
                const coaches = Array.from(
                    new Set(parts.map((p: any) => p.person?.display_name).filter(Boolean))
                );
                currentCoachName = coaches.join(", ");
                const pNames = Array.from(
                    new Set(parts.map((p: any) => p.phase?.name).filter(Boolean))
                );
                phaseNamesLabel = pNames.join(", ");
            }
        }

        const sanitizedData = sanitizeProposedData({
            proposal_kind: "season_coach",
            season_id: season.id,
            competition: compName,
            year: seasonLabel,
            season_year: String(season.year),
            phase: phaseNamesLabel,
            team_id: team.id,
            team: team.name,
            head_coach: cleanCoach,
            current_coach: currentCoachName,
        });

        const { error } = await supabase.from("game_proposals").insert({
            game_id: null,
            proposal_type: "update",
            proposed_data: sanitizedData,
            reason: payload.reason.trim(),
            source_url: cleanSourceUrl,
            submitted_by_name: payload.submittedByName?.trim() || null,
            submitted_by_email: payload.submittedByEmail?.trim() || null,
            status: "pending",
        });

        if (error) throw error;

        revalidatePath("/admin/proposals");

        return { success: true };
    } catch (err: any) {
        console.error("Season coach proposal submission error:", err);
        return {
            success: false,
            error: err?.message?.includes("maximum length")
                ? err.message
                : "Failed to submit season head coach proposal."
        };
    }
}
