import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/types";

export type Competition = Database["public"]["Tables"]["competitions"]["Row"];
export type Season = Database["public"]["Tables"]["seasons"]["Row"];
export type Phase = Database["public"]["Tables"]["phases"]["Row"];
export type Game = Database["public"]["Tables"]["games"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type Person = Database["public"]["Tables"]["people"]["Row"];

export const ArchiveService = {
    async getCompetitions() {
        const { data, error } = await supabase.from("competitions").select("*").order("name");
        if (error) throw error;
        return data;
    },

    async getCompetitionById(id: string) {
        const { data, error } = await supabase.from("competitions").select("*, seasons (*)").eq("id", id).single();
        if (error) throw error;
        return data;
    },

    async getSeasonDetails(seasonId: string) {
        const { data, error } = await supabase.from("seasons").select("*, competition:competitions (*), phases (*)").eq("id", seasonId).single();
        if (error) throw error;
        return data;
    },

    async getPhaseData(phaseId: string) {
        const { data, error } = await supabase.from("phases").select("*, games (*, home_team:teams!home_team_id (*), away_team:teams!away_team_id (*)), participations (*, team:teams (*))").eq("id", phaseId).single();
        if (error) throw error;
        return data;
    },

    async getGameDetails(gameId: string) {
        const { data, error } = await supabase.from("games").select("*, home_team:teams!home_team_id (*, team_aliases (*)), away_team:teams!away_team_id (*, team_aliases (*)), venue:venues (*), phase:phases (*, season:seasons (id, year, competition:competitions (name))), game_staff (*, person:people (*)), sources (*), notes (*)").eq("id", gameId).single();
        if (error) throw error;
        const { data: participations } = await supabase.from("participations").select("*, person:people (*)").eq("phase_id", data.phase_id);
        return { ...data, participations: participations || [] };
    },

    async getTeamHistory(teamId: string) {
        const { data, error } = await supabase.from("teams").select("*, team_aliases (*), participations (*, phase:phases (*, season:seasons (*, competition:competitions (*))))").eq("id", teamId).single();
        if (error) throw error;
        return data;
    },

    async getPersonDetails(personId: string) {
        const { data, error } = await supabase.from("people").select("*, game_staff (*, game:games (*, phase:phases (*, season:seasons (*, competition:competitions (*))))), participations (*, phase:phases (*, season:seasons (*, competition:competitions (*))))").eq("id", personId).single();
        if (error) throw error;
        return data;
    }
};
