"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

export async function updateWalkoverScore(gameId: string, homeScore: number, awayScore: number) {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
        .from("games")
        .update({
            home_score: homeScore,
            away_score: awayScore,
            status: "awarded"
        })
        .eq("id", gameId);

    if (error) {
        console.error("Error updating walkover score:", error);
        return;
    }

    revalidatePath("/admin/walkovers");
}

export async function deleteGame(gameId: string) {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Delete related items first (notes, staff, sources)
    await Promise.all([
        supabase.from("notes").delete().eq("entity_id", gameId).eq("entity_type", "games"),
        supabase.from("game_staff").delete().eq("game_id", gameId),
        supabase.from("sources").delete().eq("entity_id", gameId).eq("entity_type", "games")
    ]);

    const { error } = await supabase
        .from("games")
        .delete()
        .eq("id", gameId);

    if (error) {
        console.error("Error deleting game:", error);
        return;
    }

    revalidatePath("/admin/walkovers");
}
