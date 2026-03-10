"use server";

import { createClient } from "@supabase/supabase-js";

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
    isDoubleHeader: boolean;
    notes: string;
}) {
    try {
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

        const gameData = {
            phase_id: payload.selectedPhase,
            date: payload.date,
            date_precision: "EXACT",
            home_team_id: homeTeamId,
            away_team_id: awayTeamId,
            home_score: payload.homeScore ? parseInt(payload.homeScore) : null,
            away_score: payload.awayScore ? parseInt(payload.awayScore) : null,
            status: payload.status,
            venue_id: venueId,
            is_playoff: payload.isPlayoff,
            playoff_round: payload.isPlayoff && payload.playoffRound ? payload.playoffRound : null,
            final_type: payload.finalType !== "none" ? payload.finalType : null,
            title_name: payload.finalType !== "none" && payload.titleName ? payload.titleName : null,
            is_double_header: payload.isDoubleHeader
        };

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
