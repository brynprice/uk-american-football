"use server";

import { createClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/auth/admin-guard";
import {
    isValidFinalType,
    isValidGameStatus,
    isValidIsoDate,
    isValidUuid,
    parseOptionalScore,
} from "@/lib/utils/validation";

export async function submitGameAction(payload: {
    homeTeam: string;
    awayTeam: string;
    venue: string;
    homeCoach: string;
    awayCoach: string;
    date: string;
    selectedPhase: string;
    homeScore: string;
    awayScore: string;
    status: string;
    isPlayoff: boolean;
    playoffRound: string;
    finalType: string;
    titleName: string;
    nickname?: string;
    isDoubleHeader: boolean;
    notes: string;
}) {
    try {
        await assertPermission("add_game");

        if (!isValidUuid(payload.selectedPhase)) {
            throw new Error("Invalid phase ID.");
        }
        if (payload.date && payload.date.trim() && !isValidIsoDate(payload.date)) {
            throw new Error("Date must be in YYYY-MM-DD format.");
        }
        if (!isValidGameStatus(payload.status)) {
            throw new Error("Invalid game status.");
        }
        const finalType = payload.finalType || "none";
        if (!isValidFinalType(finalType)) {
            throw new Error("Invalid final type.");
        }
        const cleanHomeScore = parseOptionalScore(payload.homeScore);
        const cleanAwayScore = parseOptionalScore(payload.awayScore);
        if (payload.notes && payload.notes.length > 2000) {
            throw new Error("Notes must be under 2,000 characters.");
        }
        if (payload.titleName && payload.titleName.length > 150) {
            throw new Error("Title name must be under 150 characters.");
        }
        if (payload.playoffRound && payload.playoffRound.length > 100) {
            throw new Error("Playoff round must be under 100 characters.");
        }

        // Determine the environment variables. Use process.env on the server.
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Missing Supabase Service Role configuration on the server.");
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const findOrCreateTeam = async (name: string): Promise<string> => {
            if (!name.trim()) return "";
            const { data: exists } = await supabase.from("teams").select("id").ilike("name", name).maybeSingle();
            if (exists) return exists.id;

            throw new Error(`Team "${name}" does not exist. Please create teams via the bulk importer first.`);
        };

        const findOrCreateVenue = async (name: string): Promise<string | null> => {
            if (!name.trim()) return null;
            const { data: exists } = await supabase.from("venues").select("id").ilike("name", name).maybeSingle();
            if (exists) return exists.id;

            const { data, error } = await supabase.from("venues").insert({ name: name.trim() }).select().single();
            if (error) throw error;
            return data.id;
        };

        const findOrCreatePerson = async (name: string): Promise<string | null> => {
            if (!name.trim()) return null;
            const { data: exists } = await supabase.from("people").select("id").ilike("display_name", name).maybeSingle();
            if (exists) return exists.id;

            const { data, error } = await supabase.from("people").insert({ display_name: name.trim() }).select().single();
            if (error) throw error;
            return data.id;
        };

        const ensureParticipation = async (phaseId: string, teamId: string, coachId: string | null) => {
            const { data: existing } = await supabase
                .from("participations")
                .select("id, head_coach_id")
                .eq("phase_id", phaseId)
                .eq("team_id", teamId)
                .maybeSingle();

            if (existing) {
                if (!existing.head_coach_id && coachId) {
                    await supabase.from("participations").update({ head_coach_id: coachId }).eq("id", existing.id);
                }
                return;
            }

            await supabase.from("participations").insert({
                phase_id: phaseId,
                team_id: teamId,
                head_coach_id: coachId
            });
        };

        const [homeTeamId, awayTeamId, venueId] = await Promise.all([
            findOrCreateTeam(payload.homeTeam),
            findOrCreateTeam(payload.awayTeam),
            findOrCreateVenue(payload.venue)
        ]);

        const gameData: Record<string, any> = {
            phase_id: payload.selectedPhase,
            date: payload.date,
            date_precision: "EXACT",
            home_team_id: homeTeamId,
            away_team_id: awayTeamId,
            home_score: cleanHomeScore,
            away_score: cleanAwayScore,
            status: payload.status,
            venue_id: venueId,
            is_playoff: Boolean(payload.isPlayoff),
            playoff_round: payload.isPlayoff && payload.playoffRound ? payload.playoffRound.trim() : null,
            final_type: finalType !== "none" ? finalType : null,
            title_name: finalType !== "none" && payload.titleName ? payload.titleName.trim() : null,
            is_double_header: Boolean(payload.isDoubleHeader)
        };

        if (payload.nickname?.trim()) {
            const { error: colErr } = await supabase.from("games").select("nickname").limit(1);
            if (!colErr) {
                gameData.nickname = payload.nickname.trim();
            }
        }

        const { data: newGame, error: gameError } = await supabase.from("games").insert(gameData).select().single();
        if (gameError) throw gameError;

        const staffPromises = [];
        let homeCoachId: string | null = null;
        if (payload.homeCoach.trim()) {
            homeCoachId = await findOrCreatePerson(payload.homeCoach);
            if (homeCoachId) {
                staffPromises.push(supabase.from("game_staff").insert({
                    game_id: newGame.id,
                    team_id: homeTeamId,
                    person_id: homeCoachId,
                    role: "head_coach"
                }));
            }
        }

        let awayCoachId: string | null = null;
        if (payload.awayCoach.trim()) {
            awayCoachId = await findOrCreatePerson(payload.awayCoach);
            if (awayCoachId) {
                staffPromises.push(supabase.from("game_staff").insert({
                    game_id: newGame.id,
                    team_id: awayTeamId,
                    person_id: awayCoachId,
                    role: "head_coach"
                }));
            }
        }
        if (staffPromises.length > 0) {
            await Promise.all(staffPromises);
        }

        // Ensure both teams are recorded as participating in this phase
        await ensureParticipation(payload.selectedPhase, homeTeamId, homeCoachId);
        await ensureParticipation(payload.selectedPhase, awayTeamId, awayCoachId);

        if (payload.notes.trim()) {
            await supabase.from("notes").insert({
                entity_type: "games",
                entity_id: newGame.id,
                content: payload.notes.trim()
            });
        }

        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message || "An unknown error occurred" };
    }
}
