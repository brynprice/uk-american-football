"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setDivisionalChampion(
    phaseId: string,
    teamId: string,
    isChampion: boolean
) {
    const supabase = await createClient();
    const participationsTable = supabase.from("participations") as any;

    if (isChampion) {
        // Enforce 1 champion per phase: unset is_champion for all teams in this phase first
        const { error: resetError } = await participationsTable
            .update({ is_champion: false })
            .eq("phase_id", phaseId);

        if (resetError) {
            throw new Error(`Failed to reset phase champions: ${resetError.message}`);
        }

        // Check if participation row already exists for this team in this phase
        const { data: existing } = await participationsTable
            .select("id")
            .eq("phase_id", phaseId)
            .eq("team_id", teamId)
            .maybeSingle();

        if (existing) {
            const { error: updateError } = await participationsTable
                .update({ is_champion: true })
                .eq("id", existing.id);

            if (updateError) throw new Error(updateError.message);
        } else {
            const { error: insertError } = await participationsTable
                .insert({
                    phase_id: phaseId,
                    team_id: teamId,
                    is_champion: true
                });

            if (insertError) throw new Error(insertError.message);
        }
    } else {
        // Unset champion for this team in this phase
        const { error: updateError } = await participationsTable
            .update({ is_champion: false })
            .eq("phase_id", phaseId)
            .eq("team_id", teamId);

        if (updateError) throw new Error(updateError.message);
    }

    revalidatePath(`/teams/${teamId}`);
    revalidatePath("/admin/champions");
    return { success: true };
}
