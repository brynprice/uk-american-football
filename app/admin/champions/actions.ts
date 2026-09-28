"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

export async function setDivisionalChampion(
    phaseId: string,
    teamId: string,
    isChampion: boolean
) {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase service role credentials not configured.");
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        if (isChampion) {
            // 1. Primary storage in notes table (guaranteed compatibility)
            // Enforce 1 champion per phase: delete any existing champion note for this phase first
            await supabase
                .from("notes")
                .delete()
                .eq("entity_type", "divisional_champion")
                .eq("entity_id", phaseId);

            // Insert new champion note
            const { error: noteError } = await supabase
                .from("notes")
                .insert({
                    entity_type: "divisional_champion",
                    entity_id: phaseId,
                    content: teamId
                });

            if (noteError) {
                console.error("Error inserting champion note:", noteError);
            }

            // 2. Also update participations table if is_champion column exists
            try {
                await supabase
                    .from("participations")
                    .update({ is_champion: false } as any)
                    .eq("phase_id", phaseId);

                const { data: existing } = await supabase
                    .from("participations")
                    .select("id")
                    .eq("phase_id", phaseId)
                    .eq("team_id", teamId)
                    .maybeSingle();

                if (existing) {
                    await supabase
                        .from("participations")
                        .update({ is_champion: true } as any)
                        .eq("id", existing.id);
                } else {
                    await supabase
                        .from("participations")
                        .insert({
                            phase_id: phaseId,
                            team_id: teamId,
                            is_champion: true
                        } as any);
                }
            } catch (partErr) {
                console.warn("Could not update participations table directly:", partErr);
            }
        } else {
            // Remove champion note
            await supabase
                .from("notes")
                .delete()
                .eq("entity_type", "divisional_champion")
                .eq("entity_id", phaseId)
                .eq("content", teamId);

            // Unset participations is_champion flag if present
            try {
                await supabase
                    .from("participations")
                    .update({ is_champion: false } as any)
                    .eq("phase_id", phaseId)
                    .eq("team_id", teamId);
            } catch (partErr) {
                console.warn("Could not update participations table directly:", partErr);
            }
        }

        revalidatePath(`/teams/${teamId}`);
        revalidatePath("/admin/champions");
        return { success: true };
    } catch (err: any) {
        console.error("Failed setDivisionalChampion:", err);
        throw new Error(err.message || "Failed to update divisional champion");
    }
}
