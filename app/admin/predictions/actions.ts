"use server";

import { createClient } from "@supabase/supabase-js";
import { assertAdmin } from "@/lib/auth/admin-guard";
import { revalidatePath } from "next/cache";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

export async function recordPredictionAction(payload: {
  homeTeamId: string;
  awayTeamId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  winProbability: number;
  confidence: string;
  weights: Record<string, any>;
}) {
  try {
    await assertAdmin();

    if (!payload.homeTeamId || !payload.awayTeamId) {
      return { success: false, error: "Missing required team IDs." };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.from("predictions").insert({
      home_team_id: payload.homeTeamId,
      away_team_id: payload.awayTeamId,
      predicted_home_score: payload.predictedHomeScore,
      predicted_away_score: payload.predictedAwayScore,
      win_probability: payload.winProbability,
      confidence: payload.confidence,
      weights: payload.weights,
    });

    if (error) {
      console.error("Error inserting prediction:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/predictions");
    revalidatePath("/admin/predictions/accuracy");

    return { success: true };
  } catch (err: any) {
    console.error("recordPredictionAction error:", err);
    return { success: false, error: err.message || "Failed to record prediction." };
  }
}
