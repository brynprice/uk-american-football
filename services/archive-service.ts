import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/types";

export type Competition = Database["public"]["Tables"]["competitions"]["Row"];
export type Season = Database["public"]["Tables"]["seasons"]["Row"];
export type Phase = Database["public"]["Tables"]["phases"]["Row"];
export type Game = Database["public"]["Tables"]["games"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type Person = Database["public"]["Tables"]["people"]["Row"];

export const ArchiveService = {
    async getCompetitions(): Promise<Competition[]> {
        const { data, error } = await supabase.from("competitions").select("*").order("name");
        if (error) throw error;
        return data || [];
    },

    async getCompetitionById(id: string): Promise<any> {
        const { data, error } = await supabase.from("competitions").select("*, seasons (*)").eq("id", id).single();
        if (error) throw error;
        if (!data) throw new Error("Competition not found");
        return data;
    },

    async getSeasonDetails(seasonId: string): Promise<any> {
        const { data, error } = await supabase.from("seasons").select("*, competition:competitions (*), phases (*)").eq("id", seasonId).single();
        if (error) throw error;
        if (!data) throw new Error("Season not found");
        return data;
    },

    async getPhaseData(phaseId: string): Promise<any> {
        const { data, error } = await supabase.from("phases").select("*, games (*, home_team:teams!home_team_id (*), away_team:teams!away_team_id (*)), participations (*, team:teams (*))").eq("id", phaseId).single();
        if (error) throw error;
        if (!data) throw new Error("Phase not found");
        return data;
    },

    async getGameDetails(gameId: string): Promise<any> {
        const { data, error } = await supabase.from("games").select("*, home_team:teams!home_team_id (*, team_aliases (*)), away_team:teams!away_team_id (*, team_aliases (*)), venue:venues (*), phase:phases (*, season:seasons (id, year, competition:competitions (name))), game_staff (*, person:people (*))").eq("id", gameId).single();
        if (error) throw error;
        if (!data) throw new Error("Game not found");

        const gameData = data as any;

        // Fetch polymorphic relations separately to avoid PostgREST relationship errors
        const [sources, notes, participations] = await Promise.all([
            supabase.from("sources").select("*").eq("entity_id", gameId).eq("entity_type", "games"),
            supabase.from("notes").select("*").eq("entity_id", gameId).eq("entity_type", "games"),
            supabase.from("participations").select("*, person:people (*)").eq("phase_id", gameData.phase_id)
        ]);

        return {
            ...gameData,
            sources: sources.data || [],
            notes: notes.data || [],
            participations: participations.data || []
        };
    },


    async getTeamHistory(teamId: string): Promise<any> {
        const { data, error } = await supabase.from("teams").select("*, team_aliases (*), participations (*, phase:phases (*, season:seasons (*, competition:competitions (*))))").eq("id", teamId).single();
        if (error) throw error;
        if (!data) throw new Error("Team not found");
        return data;
    },

    async getPersonDetails(personId: string): Promise<any> {
        const { data, error } = await supabase.from("people").select("*, game_staff (*, game:games (*, phase:phases (*, season:seasons (*, competition:competitions (*))))), participations (*, phase:phases (*, season:seasons (*, competition:competitions (*))))").eq("id", personId).single();
        if (error) throw error;
        if (!data) throw new Error("Person not found");
        return data;
    },

    async getTeams(): Promise<Team[]> {
        const { data, error } = await supabase.from("teams").select("*").order("name");
        if (error) throw error;
        return data || [];
    },

    async getPeople(): Promise<Person[]> {
        const { data, error } = await supabase.from("people").select("*").order("display_name");
        if (error) throw error;
        return data || [];
    },

    async getVenues(): Promise<any[]> {
        const { data, error } = await supabase.from("venues").select("*").order("name");
        if (error) throw error;
        return data || [];
    }
};
