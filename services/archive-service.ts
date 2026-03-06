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
        // 1. Fetch the initial phase to get season_id and descriptive info
        const { data: phaseData, error: phaseError } = await supabase.from("phases")
            .select("*, season:seasons(id, year, competition:competitions(name))")
            .eq("id", phaseId).single();
        if (phaseError) throw phaseError;
        if (!phaseData) throw new Error("Phase not found");
        const phase = phaseData as any;

        // 2. Fetch all phases for this season to build the tree
        const { data: allPhasesData, error: allPhasesError } = await supabase.from("phases").select("*").eq("season_id", phase.season_id);
        if (allPhasesError) throw allPhasesError;
        const allPhases = (allPhasesData || []) as any[];

        // 3. Find all descendant phase IDs
        const getDescendants = (parentId: string): string[] => {
            const children = allPhases.filter(p => p.parent_phase_id === parentId);
            return [parentId, ...children.flatMap(c => getDescendants(c.id))];
        };
        const descendantIds = getDescendants(phaseId);
        const isLeaf = allPhases.filter(p => p.parent_phase_id === phaseId).length === 0;

        // 4. Fetch all games for these phases
        const { data: games, error: gamesError } = await supabase
            .from("games")
            .select(`
                *, 
                home_team:teams!home_team_id (*, team_aliases (*)), 
                away_team:teams!away_team_id (*, team_aliases (*)), 
                phase:phases(name)
            `)
            .in("phase_id", descendantIds)
            .order("date", { ascending: true });

        if (gamesError) throw gamesError;

        // 5. Fetch participations (standings) only if it's a leaf phase
        let participations: any[] = [];
        if (isLeaf) {
            const { data: partData, error: partError } = await supabase
                .from("participations")
                .select("*, person:people (*), team:teams (*)")
                .eq("phase_id", phaseId);
            if (partError) throw partError;
            participations = partData || [];
        }

        return {
            ...phase,
            isLeaf,
            games: games || [],
            participations
        };
    },

    async getGameDetails(gameId: string): Promise<any> {
        const { data, error } = await supabase
            .from("games")
            .select(`
                *, 
                home_team:teams!home_team_id (*, team_aliases (*)), 
                away_team:teams!away_team_id (*, team_aliases (*)), 
                venue:venues (*), 
                phase:phases (*, season:seasons (id, year, competition:competitions (name))), 
                game_staff (*, person:people (*))
            `)
            .eq("id", gameId)
            .single();
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
        const { data, error } = await supabase
            .from("teams")
            .select(`
                *, 
                team_aliases (id, name, start_year, end_year, logo_url), 
                participations (*, phase:phases (*, season:seasons (*, competition:competitions (*)))),
                hall_of_fame (*, person:people (*)),
                retired_jerseys (*, person:people (*))
            `)
            .eq("id", teamId)
            .single();
        if (error) throw error;
        if (!data) throw new Error("Team not found");
        return data;
    },

    async getPersonDetails(personId: string): Promise<any> {
        const { data, error } = await supabase.from("people").select("*, game_staff (*, game:games (*, phase:phases (*, season:seasons (*, competition:competitions (*))))), participations (*, phase:phases (*, season:seasons (*, competition:competitions (*)))), hall_of_fame (*, team:teams (*)), retired_jerseys (*, team:teams (*))").eq("id", personId).single();
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
