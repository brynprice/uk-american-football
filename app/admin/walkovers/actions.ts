"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/admin-guard";
import { isValidScore, isValidUuid } from "@/lib/utils/validation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

export async function updateWalkoverScore(gameId: string, homeScore: number, awayScore: number, formData: FormData) {
    await assertPermission("walkovers");
    if (!isValidUuid(gameId)) {
        throw new Error("Invalid game ID.");
    }
    if (!isValidScore(homeScore) || !isValidScore(awayScore)) {
        throw new Error("Scores must be integers between 0 and 300.");
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    const notes = formData.get("notes")?.toString();
    if (notes && notes.length > 2000) {
        throw new Error("Notes must be under 2,000 characters.");
    }

    // 1. Update the game score and notes
    const { error: gameError } = await supabase
        .from("games")
        .update({
            home_score: homeScore,
            away_score: awayScore,
            status: "awarded",
            notes: notes?.trim() || null
        })
        .eq("id", gameId);

    if (gameError) {
        console.error("Error updating walkover score:", gameError);
        return;
    }

    revalidatePath("/admin/walkovers");
}

export async function deleteGame(gameId: string) {
    await assertPermission("walkovers");
    if (!isValidUuid(gameId)) {
        throw new Error("Invalid game ID.");
    }
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

export async function updateGameNotes(gameId: string, formData: FormData) {
    await assertPermission("walkovers");
    if (!isValidUuid(gameId)) {
        throw new Error("Invalid game ID.");
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    const notes = formData.get("notes")?.toString();
    if (notes && notes.length > 2000) {
        throw new Error("Notes must be under 2,000 characters.");
    }

    const { error } = await supabase
        .from("games")
        .update({
            notes: notes?.trim() || null
        })
        .eq("id", gameId);

    if (error) {
        console.error("Error updating game notes:", error);
        return;
    }

    revalidatePath("/admin/walkovers");
}
