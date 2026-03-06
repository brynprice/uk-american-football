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
        const { data: seasonData, error } = await supabase.from("seasons").select("*, competition:competitions (*), phases (*)").eq("id", seasonId).single();
        if (error) throw error;
        if (!seasonData) throw new Error("Season not found");

        // Fetch archival notes for this season
        const { data: notes } = await supabase.from("notes").select("*").eq("entity_id", seasonId).eq("entity_type", "seasons");

        return {
            ...(seasonData as any),
            notes: notes || []
        };
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
        const [sources, archivalNotes, participations] = await Promise.all([
            supabase.from("sources").select("*").eq("entity_id", gameId).eq("entity_type", "games"),
            supabase.from("notes").select("*").eq("entity_id", gameId).eq("entity_type", "games"),
            supabase.from("participations").select("*, person:people (*)").eq("phase_id", gameData.phase_id)
        ]);

        return {
            ...gameData,
            sources: sources.data || [],
            archival_notes: archivalNotes.data || [],
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
        const { data, error } = await supabase.from("people").select("*, game_staff (*, game:games (*, phase:phases (*, season:seasons (*, competition:competitions (*))))), participations (*, team:teams (*), phase:phases (*, season:seasons (*, competition:competitions (*)))), hall_of_fame (*, team:teams (*)), retired_jerseys (*, team:teams (*))").eq("id", personId).single();
        if (error) throw error;
        if (!data) throw new Error("Person not found");
        return data;
    },

    async searchGamesByScore(scoreA: number, scoreB: number): Promise<any[]> {
        // Query games where (home = scoreA AND away = scoreB) OR (home = scoreB AND away = scoreA)
        const { data, error } = await supabase
            .from('games')
            .select('*, phase:phases(*, season:seasons(*, competition:competitions(*))), home_team:teams!home_team_id(*), away_team:teams!away_team_id(*), venue:venues(*)')
            .or(`and(home_score.eq.${scoreA},away_score.eq.${scoreB}),and(home_score.eq.${scoreB},away_score.eq.${scoreA})`)
            .order('date', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async getPersonGamesAsCoach(personId: string): Promise<any[]> {
        // 1. Get all participations where they are the head coach
        const { data: participations } = await supabase
            .from('participations')
            .select('team_id, phase_id')
            .eq('head_coach_id', personId) as { data: any[] | null };

        // 2. Get all game_staff overrides where they are the head coach OR someone else is
        // We will fetch all game_staff for head coaches, then process it in memory
        const { data: allOverrides } = await supabase
            .from('game_staff')
            .select('game_id, team_id, person_id')
            .eq('role', 'head_coach') as { data: any[] | null };

        const overrideMap = new Map(); // gameId_teamId -> personId
        if (allOverrides) {
            allOverrides.forEach(o => overrideMap.set(`${o.game_id}_${o.team_id}`, o.person_id));
        }

        // 3. Fetch all games for the phases the coach was active in, PLUS the games they were explicitly staff for
        const phaseTeamPairs = participations?.map(p => `(phase_id.eq.${p.phase_id},and(home_team_id.eq.${p.team_id},away_team_id.eq.${p.team_id}))`) || [];

        let queryRows: any[] = [];

        // Due to PostgREST limitations with complex ORs, we might need to fetch games for simply the phase_ids, then filter
        const phaseIds = participations?.map(p => p.phase_id) || [];

        const { data: staffGames } = await supabase
            .from('game_staff')
            .select('game_id, team_id')
            .eq('person_id', personId)
            .eq('role', 'head_coach') as { data: any[] | null };

        const explicitGameIds = staffGames?.map(s => s.game_id) || [];

        // Fetch all games in those phases
        if (phaseIds.length > 0 || explicitGameIds.length > 0) {
            let q = supabase.from('games').select('*, phase:phases(*)');

            if (phaseIds.length > 0 && explicitGameIds.length > 0) {
                q = q.or(`phase_id.in.(${phaseIds.join(',')}),id.in.(${explicitGameIds.join(',')})`);
            } else if (phaseIds.length > 0) {
                q = q.in('phase_id', phaseIds);
            } else {
                q = q.in('id', explicitGameIds);
            }

            const { data: games } = await q as { data: any[] | null };
            if (games) queryRows = games;
        }

        // 4. Filter games where this person was ACTUALLY the head coach
        const actualGames = queryRows.filter(game => {
            const isHome = participations?.some(p => p.phase_id === game.phase_id && p.team_id === game.home_team_id) || staffGames?.some(s => s.game_id === game.id && s.team_id === game.home_team_id);
            const isAway = participations?.some(p => p.phase_id === game.phase_id && p.team_id === game.away_team_id) || staffGames?.some(s => s.game_id === game.id && s.team_id === game.away_team_id);

            if (!isHome && !isAway) return false;

            const teamId = isHome ? game.home_team_id : game.away_team_id;
            const overrideId = overrideMap.get(`${game.id}_${teamId}`);

            if (overrideId) {
                // If there's an override, they only coached if the override is them
                return overrideId === personId;
            } else {
                // If there's no override, they coached if they are the season default
                return participations?.some(p => p.phase_id === game.phase_id && p.team_id === teamId);
            }
        });

        return actualGames.map(game => {
            const isHome = participations?.some(p => p.phase_id === game.phase_id && p.team_id === game.home_team_id) || staffGames?.some(s => s.game_id === game.id && s.team_id === game.home_team_id);
            const teamId = isHome ? game.home_team_id : game.away_team_id;
            const isOverride = explicitGameIds.includes(game.id) && staffGames?.some(s => s.game_id === game.id && s.team_id === teamId);
            return {
                ...game,
                coach_team_id: teamId,
                is_override: isOverride
            };
        });
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
    },

    async getTeamOpponents(teamId: string): Promise<Team[]> {
        const { data: homeGames } = await supabase.from("games").select("away_team_id").eq("home_team_id", teamId) as { data: any[] | null };
        const { data: awayGames } = await supabase.from("games").select("home_team_id").eq("away_team_id", teamId) as { data: any[] | null };

        const opponentIds = new Set([
            ...(homeGames?.map(g => g.away_team_id) || []),
            ...(awayGames?.map(g => g.home_team_id) || [])
        ]);

        if (opponentIds.size === 0) return [];

        const { data, error } = await supabase
            .from("teams")
            .select("*")
            .in("id", Array.from(opponentIds))
            .order("name");

        if (error) throw error;
        return data || [];
    },

    async getH2HGames(team1Id: string, team2Id: string): Promise<any[]> {
        const { data, error } = await supabase
            .from("games")
            .select(`
                *,
                home_team:teams!home_team_id (*),
                away_team:teams!away_team_id (*),
                phase:phases (*, season:seasons (id, year, competition:competitions (name))),
                venue:venues (*)
            `)
            .or(`and(home_team_id.eq.${team1Id},away_team_id.eq.${team2Id}),and(home_team_id.eq.${team2Id},away_team_id.eq.${team1Id})`)
            .order("date", { ascending: false });

        if (error) throw error;

        // Deduplicate and sort: Season (desc) then Date (desc)
        const uniqueGames = Array.from(new Map(((data as any[]) || []).map(g => [g.id, g])).values());

        uniqueGames.sort((a, b) => {
            const yearA = a.phase?.season?.year || 0;
            const yearB = b.phase?.season?.year || 0;
            if (yearA !== yearB) return yearB - yearA;

            const dateA = a.date || '';
            const dateB = b.date || '';
            return dateB.localeCompare(dateA);
        });

        return uniqueGames;
    }
};
