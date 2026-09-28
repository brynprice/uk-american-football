"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setDivisionalChampion(
    phaseId: string,
    teamId: string,
    isChampion: boolean
) {
    const supabase = await createClient();

    if (isChampion) {
        // 1. Storage in notes table (guaranteed compatibility)
        // Enforce 1 champion per phase: delete any existing champion note for this phase first
        await (supabase.from("notes") as any)
            .delete()
            .eq("entity_type", "divisional_champion")
            .eq("entity_id", phaseId);

        // Insert new champion note
        const { error: noteError } = await (supabase.from("notes") as any)
            .insert({
                entity_type: "divisional_champion",
                entity_id: phaseId,
                content: teamId
            });

        if (noteError) {
            throw new Error(`Failed to save champion record: ${noteError.message}`);
        }

        // 2. Try updating participations table if is_champion column exists (graceful fallback)
        try {
            const participationsTable = supabase.from("participations") as any;
            await participationsTable
                .update({ is_champion: false })
                .eq("phase_id", phaseId);

            const { data: existing } = await participationsTable
                .select("id")
                .eq("phase_id", phaseId)
                .eq("team_id", teamId)
                .maybeSingle();

            if (existing) {
                await participationsTable
                    .update({ is_champion: true })
                    .eq("id", existing.id);
            } else {
                await participationsTable
                    .insert({
                        phase_id: phaseId,
                        team_id: teamId,
                        is_champion: true
                    });
            }
        } catch {
            // Ignore if is_champion column does not exist on participations table yet
        }
    } else {
        // Remove champion note
        await (supabase.from("notes") as any)
            .delete()
            .eq("entity_type", "divisional_champion")
            .eq("entity_id", phaseId)
            .eq("content", teamId);

        // Try unsetting participations is_champion flag if present
        try {
            const participationsTable = supabase.from("participations") as any;
            await participationsTable
                .update({ is_champion: false })
                .eq("phase_id", phaseId)
                .eq("team_id", teamId);
        } catch {
            // Ignore if column missing
        }
    }

    revalidatePath(`/teams/${teamId}`);
    revalidatePath("/admin/champions");
    return { success: true };
}
