"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

async function findOrCreatePerson(supabase: any, name: string): Promise<string | null> {
    if (!name.trim()) return null;

    const { data: exists } = await supabase
        .from("people")
        .select("id")
        .ilike("display_name", name.trim())
        .maybeSingle();

    if (exists) return exists.id;

    const { data, error } = await supabase
        .from("people")
        .insert({ display_name: name.trim() })
        .select()
        .single();

    if (error) {
        console.error("Error creating person:", error);
        return null;
    }
    return data.id;
}

export async function updateGameCoach(gameId: string, teamId: string, coachName: string, phaseId: string) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const coachId = await findOrCreatePerson(supabase, coachName);

    if (!coachId && coachName.trim()) {
        throw new Error("Could not find or create coach.");
    }

    // Update game_staff ONLY
    const { data: existingStaff } = await supabase
        .from("game_staff")
        .select("id")
        .eq("game_id", gameId)
        .eq("team_id", teamId)
        .eq("role", "head_coach")
        .maybeSingle();

    if (coachId) {
        if (existingStaff) {
            await supabase
                .from("game_staff")
                .update({ person_id: coachId })
                .eq("id", existingStaff.id);
        } else {
            await supabase
                .from("game_staff")
                .insert({
                    game_id: gameId,
                    team_id: teamId,
                    person_id: coachId,
                    role: "head_coach"
                });
        }
    } else if (existingStaff) {
        // Remove coach override if name is empty
        await supabase
            .from("game_staff")
            .delete()
            .eq("id", existingStaff.id);
    }

    // We NO LONGER update participations here. 
    // Individual game changes are overrides, not season-wide defaults.

    revalidatePath("/admin/set-coach");
}

export async function updateSeasonCoach(seasonId: string, teamId: string, coachName: string) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const coachId = await findOrCreatePerson(supabase, coachName);

    if (!coachId && coachName.trim()) {
        throw new Error("Could not find or create coach.");
    }

    // 1. Get all phases for the season
    const { data: phases } = await supabase
        .from("phases")
        .select("id")
        .eq("season_id", seasonId);

    if (!phases || phases.length === 0) return;
    const phaseIds = phases.map(p => p.id);

    // 2. Update participations (Season-wide default)
    if (coachId) {
        await supabase
            .from("participations")
            .update({ head_coach_id: coachId })
            .in("phase_id", phaseIds)
            .eq("team_id", teamId);
    } else {
        await supabase
            .from("participations")
            .update({ head_coach_id: null })
            .in("phase_id", phaseIds)
            .eq("team_id", teamId);
    }

    // 3. Clean up now-redundant game_staff records
    // If a game-level record matches the new season coach, it's redundant.
    if (coachId) {
        const { data: games } = await supabase
            .from("games")
            .select("id")
            .in("phase_id", phaseIds)
            .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

        if (games && games.length > 0) {
            const gameIds = games.map(g => g.id);
            await supabase
                .from("game_staff")
                .delete()
                .in("game_id", gameIds)
                .eq("team_id", teamId)
                .eq("person_id", coachId)
                .eq("role", "head_coach");
        }
    }

    revalidatePath("/admin/set-coach");
}
