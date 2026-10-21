"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

export async function resolveAnomaly(gameId: string, homeScore: number, awayScore: number) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase
    .from("games")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      status: "completed",
    })
    .eq("id", gameId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/anomalies");
  return { success: true };
}

export async function deleteAnomalyGame(gameId: string) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  await Promise.all([
    supabase.from("notes").delete().eq("entity_id", gameId).eq("entity_type", "games"),
    supabase.from("game_staff").delete().eq("game_id", gameId),
    supabase.from("sources").delete().eq("entity_id", gameId).eq("entity_type", "games"),
  ]);

  const { error } = await supabase.from("games").delete().eq("id", gameId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/anomalies");
  return { success: true };
}
