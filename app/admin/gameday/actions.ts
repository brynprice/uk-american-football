"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/admin-guard";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

export interface GamedayUpdatePayload {
    id: string;
    home_score: number | null;
    away_score: number | null;
    status: string;
    notes?: string | null;
    date?: string | null;
    time?: string | null;
}

export async function fetchGamedayData(seasonId?: string, phaseId?: string, dateFilter?: string) {
    await assertAdmin();
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch seasons
    const { data: seasons } = await supabase
        .from("seasons")
        .select("id, year, name, competition:competitions(name)")
        .order("year", { ascending: false });

    const activeSeasonId = seasonId || seasons?.[0]?.id;

    // Fetch phases for active season
    let phases: any[] = [];
    if (activeSeasonId) {
        const { data: phaseData } = await supabase
            .from("phases")
            .select("id, name, type, ordinal_number, parent_phase_id")
            .eq("season_id", activeSeasonId)
            .order("ordinal_number", { ascending: true });
        phases = phaseData || [];
    }

    // Build games query
    let gamesQuery = supabase
        .from("games")
        .select(`
            id,
            phase_id,
            date,
            time,
            status,
            home_score,
            away_score,
            is_playoff,
            is_double_header,
            notes,
            home_team:teams!home_team_id(id, name, logo_url),
            away_team:teams!away_team_id(id, name, logo_url),
            phase:phases!phase_id(id, name),
            venue:venues!venue_id(id, name)
        `)
        .order("date", { ascending: true })
        .order("time", { ascending: true });

    if (phaseId) {
        gamesQuery = gamesQuery.eq("phase_id", phaseId);
    } else if (activeSeasonId) {
        gamesQuery = gamesQuery.eq("season_id", activeSeasonId);
    }

    if (dateFilter) {
        gamesQuery = gamesQuery.eq("date", dateFilter);
    }

    const { data: games, error: gamesErr } = await gamesQuery;

    if (gamesErr) {
        throw new Error(`Failed to load fixtures: ${gamesErr.message}`);
    }

    return {
        seasons: seasons || [],
        phases,
        games: games || []
    };
}

export async function saveGamedayScores(updates: GamedayUpdatePayload[]) {
    await assertAdmin();
    if (!updates || updates.length === 0) {
        return { success: true, count: 0 };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const affectedPhaseIds = new Set<string>();
    const affectedGameIds = updates.map(u => u.id);

    // 1. Fetch game details to know their phase_id
    const { data: gameDetails } = await supabase
        .from("games")
        .select("id, phase_id, season_id")
        .in("id", affectedGameIds);

    for (const g of (gameDetails || [])) {
        if (g.phase_id) affectedPhaseIds.add(g.phase_id);
    }

    // 2. Perform game updates
    for (const item of updates) {
        const payload: Record<string, any> = {
            home_score: item.home_score,
            away_score: item.away_score,
            status: item.status,
            notes: item.notes !== undefined ? (item.notes?.trim() || null) : undefined,
        };
        if (item.date !== undefined) payload.date = item.date;
        if (item.time !== undefined) payload.time = item.time;

        const { error } = await supabase
            .from("games")
            .update(payload)
            .eq("id", item.id);

        if (error) {
            console.error(`Error updating game ${item.id}:`, error.message);
            throw new Error(`Failed to update game ${item.id}: ${error.message}`);
        }
    }

    // 3. Recompute standings for affected phases
    for (const phaseId of affectedPhaseIds) {
        // Fetch participations in this phase
        const { data: participations } = await supabase
            .from("participations")
            .select("id, team_id")
            .eq("phase_id", phaseId);

        if (!participations || participations.length === 0) continue;

        // Fetch completed and awarded games
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

        // Update participations
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

        revalidatePath(`/phases/${phaseId}`);
    }

    revalidatePath("/admin/gameday");
    revalidatePath("/admin/walkovers");
    revalidatePath("/");

    return { success: true, count: updates.length };
}
