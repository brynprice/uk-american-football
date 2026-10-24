import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/types";
import { isPlayoffPhase, sortPhasesInTreeOrder } from "@/lib/utils/phase-utils";
import { resolveTeamIdentity } from "@/lib/utils/team-resolver";

export type Competition = Database["public"]["Tables"]["competitions"]["Row"];
export type Season = Database["public"]["Tables"]["seasons"]["Row"];
export type Phase = Database["public"]["Tables"]["phases"]["Row"];
export type Game = Database["public"]["Tables"]["games"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type Person = Database["public"]["Tables"]["people"]["Row"];
export type PersonWithRoles = Person & {
    participations?: Array<{
        teams?: {
            name: string;
            team_type?: string | null;
        } | null;
        phases?: {
            seasons?: {
                year: number;
                name?: string | null;
                competitions?: {
                    slug?: string | null;
                    level?: string | null;
                } | null;
            } | null;
        } | null;
    }> | null;
};

const COMPETITION_ORDER = ['bafl', 'bafanl', 'bcafl', 'buafl'];

export const ArchiveService = {
    async getCompetitions(): Promise<Competition[]> {
        const { data, error } = await supabase.from("competitions").select("*");
        if (error) throw error;
        const comps: Competition[] = (data as Competition[]) || [];
        return comps.sort((a, b) => {
            const indexA = COMPETITION_ORDER.indexOf(a.slug);
            const indexB = COMPETITION_ORDER.indexOf(b.slug);
            const orderA = indexA === -1 ? 999 : indexA;
            const orderB = indexB === -1 ? 999 : indexB;
            return orderA - orderB || a.name.localeCompare(b.name);
        });
    },

    async getCompetitionById(id: string): Promise<any> {
        const { data, error } = await supabase.from("competitions").select("*, seasons (*)").eq("id", id).single();
        if (error) throw error;
        if (!data) throw new Error("Competition not found");
        return data;
    },

    async getSeasonDetails(seasonId: string): Promise<any> {
        const { data: seasonData, error } = await supabase.from("seasons").select("*, competition:competitions (*), phases (*, ordinal)").eq("id", seasonId).single();
        if (error) throw error;
        if (!seasonData) throw new Error("Season not found");

        const phaseIds = ((seasonData as any).phases || []).map((p: any) => p.id);

        // Fetch archival notes, unphased games (friendlies), and participations in parallel
        const [notesResult, unphasedGamesResult, participationsResult] = await Promise.all([
            supabase.from("notes").select("*").eq("entity_id", seasonId).eq("entity_type", "seasons"),
            supabase
                .from("games")
                .select(`
                    *, 
                    home_team:teams!home_team_id (*, team_aliases (*)), 
                    away_team:teams!away_team_id (*, team_aliases (*)),
                    venue:venues (*)
                `)
                .eq("season_id", seasonId)
                .is("phase_id", null)
                .neq("status", "anomaly")
                .order("date", { ascending: false }),
            phaseIds.length > 0
                ? supabase.from("participations").select("team_id").in("phase_id", phaseIds)
                : Promise.resolve({ data: [], error: null })
        ]);

        if (unphasedGamesResult.error) throw unphasedGamesResult.error;

        const participatingTeamIds = new Set<string>(
            (participationsResult.data || []).map((p: any) => p.team_id).filter(Boolean)
        );

        let teamCount = participatingTeamIds.size;
        if (teamCount === 0) {
            // Fallback for seasons with games recorded before participations
            const { data: seasonGames } = await supabase
                .from("games")
                .select("home_team_id, away_team_id")
                .eq("season_id", seasonId)
                .neq("status", "anomaly");

            const gameTeamIds = new Set<string>();
            seasonGames?.forEach((g: any) => {
                if (g.home_team_id) gameTeamIds.add(g.home_team_id);
                if (g.away_team_id) gameTeamIds.add(g.away_team_id);
            });
            teamCount = gameTeamIds.size;
        }

        return {
            ...(seasonData as any),
            team_count: teamCount,
            phases: sortPhasesInTreeOrder((seasonData as any).phases || []),
            archival_notes: notesResult.data || [],
            unphased_games: unphasedGamesResult.data || []
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

        // 4. Decide which phases to pull games from.
        // If the root is NOT a playoff, exclude games from any descendant that IS a playoff.
        const isRootSelectionPlayoff = isPlayoffPhase(phase);
        const filteredGameDescendantIds = descendantIds.filter(id => {
            if (isRootSelectionPlayoff) return true; // Keep all if we are looking at a playoff root
            const p = allPhases.find(phase => phase.id === id);
            return p ? !isPlayoffPhase(p) : true;
        });

        // 5. Fetch all games for these phases (including inter-phase games where this phase is the away team's phase)
        const phaseFilter = filteredGameDescendantIds.join(',');
        const { data: games, error: gamesError } = await supabase
            .from("games")
            .select(`
                *, 
                home_team:teams!home_team_id (*, team_aliases (*)), 
                away_team:teams!away_team_id (*, team_aliases (*)), 
                phase:phases!games_phase_id_fkey(name, season:seasons(year)),
                away_phase:phases!away_phase_id(name)
            `)
            .or(`phase_id.in.(${phaseFilter}),away_phase_id.in.(${phaseFilter})`)
            .neq("status", "anomaly")
            .order("date", { ascending: false });

        if (gamesError) throw gamesError;

        // 5. Fetch participations (standings) for all descendant phases
        const { data: partData, error: partError } = await supabase
            .from("participations")
            .select("*, person:people (*), team:teams (*, team_aliases (*)), phase:phases(id, name, type, ordinal)")
            .in("phase_id", descendantIds);

        if (partError) throw partError;
        const participationsByPhase = (partData || []).reduce((acc: any, p: any) => {
            if (!acc[p.phase_id]) acc[p.phase_id] = { id: p.phase_id, name: p.phase.name, type: p.phase.type, ordinal: p.phase.ordinal, participations: [] };
            acc[p.phase_id].participations.push(p);
            return acc;
        }, {});

        const childPhases = Object.values(participationsByPhase).sort((a: any, b: any) => (a.ordinal || 0) - (b.ordinal || 0));

        return {
            ...phase,
            isLeaf,
            games: games || [],
            childPhases
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
                phase:phases!games_phase_id_fkey (*, season:seasons (id, year, competition:competitions (name))), 
                away_phase:phases!away_phase_id (name),
                season:seasons!games_season_id_fkey (id, year, competition:competitions (name)),
                game_staff (*, person:people (*))
            `)
            .eq("id", gameId)
            .single();
        if (error) throw error;
        if (!data) throw new Error("Game not found");

        const gameData = data as any;

        // Fetch polymorphic relations separately to avoid PostgREST relationship errors
        const teamIds = [gameData.home_team_id, gameData.away_team_id].filter(Boolean);
        const [sources, archivalNotes, participations] = await Promise.all([
            supabase.from("sources").select("*").eq("entity_id", gameId).eq("entity_type", "games"),
            supabase.from("notes").select("*").eq("entity_id", gameId).eq("entity_type", "games"),
            gameData.phase_id && teamIds.length > 0
                ? supabase.from("participations").select("*, person:people (*)").eq("phase_id", gameData.phase_id).in("team_id", teamIds)
                : Promise.resolve({ data: [] } as { data: any[] | null })
        ]);

        return {
            ...gameData,
            sources: sources.data || [],
            archival_notes: archivalNotes.data || [],
            participations: participations.data || []
        };
    },


    async getTeamHistory(teamId: string): Promise<any> {
        const [teamRes, gamesRes, champNotesRes] = await Promise.all([
            supabase
                .from("teams")
                .select(`
                    *, 
                    team_aliases (id, name, start_year, end_year, logo_url), 
                    participations (*, phase:phases (*, season:seasons (*, competition:competitions (*)))),
                    hall_of_fame (*, person:people (*)),
                    retired_jerseys (*, person:people (*))
                `)
                .eq("id", teamId)
                .single(),
            supabase
                .from("games")
                .select(`
                    *,
                    phase:phases!games_phase_id_fkey (*, season:seasons (year, id, competition:competitions (*))),
                    away_phase:phases!away_phase_id (*, season:seasons (year, id, competition:competitions (*))),
                    home_team:teams!home_team_id (*, team_aliases (*)),
                    away_team:teams!away_team_id (*, team_aliases (*))
                `)
                .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
                .neq("status", "anomaly")
                .order("date", { ascending: false }),
            supabase
                .from("notes")
                .select("entity_id")
                .eq("entity_type", "divisional_champion")
                .eq("content", teamId)
        ]);

        if (teamRes.error) throw teamRes.error;
        if (!teamRes.data) throw new Error("Team not found");

        const champPhaseIds = new Set(((champNotesRes as any).data || []).map((n: any) => n.entity_id));
        const data = (teamRes as any).data;

        const updatedParticipations = (data.participations || []).map((p: any) => ({
            ...p,
            is_champion: p.is_champion || champPhaseIds.has(p.phase_id || p.phase?.id)
        }));

        return {
            ...data,
            participations: updatedParticipations,
            games: gamesRes.data || []
        };
    },

    async getPersonDetails(personId: string): Promise<any> {
        const { data, error } = await supabase.from("people").select("*, game_staff (*, game:games (*, phase:phases!games_phase_id_fkey (*, season:seasons (*, competition:competitions (*))))), participations (*, team:teams (*, team_aliases (*)), phase:phases (*, season:seasons (*, competition:competitions (*)))), hall_of_fame (*, team:teams (*, team_aliases (*))), retired_jerseys (*, team:teams (*, team_aliases (*)))").eq("id", personId).single();
        if (error) throw error;
        if (!data) throw new Error("Person not found");
        return data;
    },

    async searchGamesByScore(scoreA: number, scoreB: number): Promise<any[]> {
        // Query games where (home = scoreA AND away = scoreB) OR (home = scoreB AND away = scoreA)
        const { data, error } = await supabase
            .from('games')
            .select('*, phase:phases!games_phase_id_fkey(*, season:seasons(*, competition:competitions(*))), home_team:teams!home_team_id(*, team_aliases(*)), away_team:teams!away_team_id(*, team_aliases(*)), venue:venues(*)')
            .or(`and(home_score.eq.${scoreA},away_score.eq.${scoreB}),and(home_score.eq.${scoreB},away_score.eq.${scoreA})`)
            .neq("status", "anomaly")
            .order('date', { ascending: false, nullsFirst: false });

        if (error) throw error;
        
        const games: any[] = data || [];
        return games.sort((a, b) => {
            if (!a.date && !b.date) {
                const yearA = a.phase?.season?.year ?? 0;
                const yearB = b.phase?.season?.year ?? 0;
                return yearB - yearA;
            }
            if (!a.date) return 1;
            if (!b.date) return -1;
            return b.date.localeCompare(a.date);
        });
    },

    async getUniqueScoreGames(): Promise<any[]> {
        const { data, error } = await supabase
            .from('games')
            .select(`
                *,
                phase:phases!games_phase_id_fkey(*, season:seasons(*, competition:competitions(*))),
                away_phase:phases!away_phase_id(name),
                home_team:teams!home_team_id(*, team_aliases(*)),
                away_team:teams!away_team_id(*, team_aliases(*)),
                venue:venues(*)
            `)
            .eq('is_unique_score', true)
            .neq('status', 'anomaly')
            .neq('status', 'cancelled')
            .order('date', { ascending: false, nullsFirst: false });

        if (!error && data) {
            const games: any[] = data;
            return games.sort((a, b) => {
                if (!a.date && !b.date) {
                    const yearA = a.phase?.season?.year ?? 0;
                    const yearB = b.phase?.season?.year ?? 0;
                    return yearB - yearA;
                }
                if (!a.date) return 1;
                if (!b.date) return -1;
                return b.date.localeCompare(a.date);
            });
        }

        // Fallback: If is_unique_score column is not yet present, compute in memory
        console.warn('Falling back to in-memory unique score calculation (run migration 20261024_unique_scores.sql):', error?.message);
        return await this.computeUniqueScoreGamesFallback();
    },

    async computeUniqueScoreGamesFallback(): Promise<any[]> {
        let allGames: any[] = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
            const { data, error } = await supabase
                .from('games')
                .select(`
                    *,
                    phase:phases!games_phase_id_fkey(*, season:seasons(*, competition:competitions(*))),
                    away_phase:phases!away_phase_id(name),
                    home_team:teams!home_team_id(*, team_aliases(*)),
                    away_team:teams!away_team_id(*, team_aliases(*)),
                    venue:venues(*)
                `)
                .not('home_score', 'is', null)
                .not('away_score', 'is', null)
                .neq('status', 'anomaly')
                .neq('status', 'cancelled')
                .range(page * pageSize, (page + 1) * pageSize - 1);
            if (error || !data) break;
            const rows = data as any[];
            allGames.push(...rows);
            if (rows.length < pageSize) break;
            page++;
        }

        const scoreCounts = new Map<string, number>();
        for (const g of allGames) {
            const high = Math.max(g.home_score, g.away_score);
            const low = Math.min(g.home_score, g.away_score);
            const key = `${high}-${low}`;
            scoreCounts.set(key, (scoreCounts.get(key) || 0) + 1);
        }

        const uniqueGames = allGames.filter(g => {
            const high = Math.max(g.home_score, g.away_score);
            const low = Math.min(g.home_score, g.away_score);
            return scoreCounts.get(`${high}-${low}`) === 1;
        }).map(g => ({ ...g, is_unique_score: true }));

        return uniqueGames.sort((a, b) => {
            if (!a.date && !b.date) {
                const yearA = a.phase?.season?.year ?? 0;
                const yearB = b.phase?.season?.year ?? 0;
                return yearB - yearA;
            }
            if (!a.date) return 1;
            if (!b.date) return -1;
            return b.date.localeCompare(a.date);
        });
    },

    async getUniqueScoreCount(): Promise<number> {
        const { count, error } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('is_unique_score', true)
            .neq('status', 'anomaly')
            .neq('status', 'cancelled');

        if (!error && count !== null) {
            return count;
        }

        return 0;
    },

    async getPersonGamesAsCoach(personId: string): Promise<any[]> {
        // 1. Get all participations where they are the head coach
        const { data: participations } = await supabase
            .from('participations')
            .select('team_id, phase_id')
            .eq('head_coach_id', personId) as { data: any[] | null };

        // 2. Fetch explicit game_staff where they were assigned as head coach
        const { data: staffGames } = await supabase
            .from('game_staff')
            .select('game_id, team_id')
            .eq('person_id', personId)
            .eq('role', 'head_coach') as { data: any[] | null };

        const phaseIds = participations?.map(p => p.phase_id) || [];
        const explicitGameIds = staffGames?.map(s => s.game_id) || [];

        let queryRows: any[] = [];

        // 3. Fetch all games for the phases the coach was active in, PLUS the games they were explicitly staff for
        if (phaseIds.length > 0 || explicitGameIds.length > 0) {
            let q = supabase.from('games').select(`
                *,
                phase:phases!games_phase_id_fkey (*, season:seasons (year, id, competition:competitions (*))),
                away_phase:phases!away_phase_id (*, season:seasons (year, id, competition:competitions (*))),
                home_team:teams!home_team_id (*, team_aliases (*)),
                away_team:teams!away_team_id (*, team_aliases (*))
            `);

            if (phaseIds.length > 0 && explicitGameIds.length > 0) {
                q = q.or(`phase_id.in.(${phaseIds.join(',')}),away_phase_id.in.(${phaseIds.join(',')}),id.in.(${explicitGameIds.join(',')})`);
            } else if (phaseIds.length > 0) {
                q = q.or(`phase_id.in.(${phaseIds.join(',')}),away_phase_id.in.(${phaseIds.join(',')})`);
            } else {
                q = q.in('id', explicitGameIds);
            }

            const { data: games } = await q as { data: any[] | null };
            if (games) queryRows = games;
        }

        // 4. Fetch head coach overrides ONLY for these candidate games
        const candidateGameIds = queryRows.map(g => g.id);
        const overrideMap = new Map(); // gameId_teamId -> personId
        if (candidateGameIds.length > 0) {
            const { data: relevantOverrides } = await supabase
                .from('game_staff')
                .select('game_id, team_id, person_id')
                .in('game_id', candidateGameIds)
                .eq('role', 'head_coach') as { data: any[] | null };

            if (relevantOverrides) {
                relevantOverrides.forEach(o => overrideMap.set(`${o.game_id}_${o.team_id}`, o.person_id));
            }
        }

        // 4. Filter games where this person was ACTUALLY the head coach
        const actualGames = queryRows.filter(game => {
            const isHome = participations?.some(p => (p.phase_id === game.phase_id || p.phase_id === game.away_phase_id) && p.team_id === game.home_team_id) || staffGames?.some(s => s.game_id === game.id && s.team_id === game.home_team_id);
            const isAway = participations?.some(p => (p.phase_id === game.phase_id || p.phase_id === game.away_phase_id) && p.team_id === game.away_team_id) || staffGames?.some(s => s.game_id === game.id && s.team_id === game.away_team_id);

            if (!isHome && !isAway) return false;

            const teamId = isHome ? game.home_team_id : game.away_team_id;
            const overrideId = overrideMap.get(`${game.id}_${teamId}`);

            if (overrideId) {
                // If there's an override, they only coached if the override is them
                return overrideId === personId;
            } else {
                // If there's no override, they coached if they are the season default
                return participations?.some(p => (p.phase_id === game.phase_id || p.phase_id === game.away_phase_id) && p.team_id === teamId);
            }
        });

        return actualGames.map(game => {
            const isHome = participations?.some(p => (p.phase_id === game.phase_id || p.phase_id === game.away_phase_id) && p.team_id === game.home_team_id) || staffGames?.some(s => s.game_id === game.id && s.team_id === game.home_team_id);
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

    async getSeasons(): Promise<any[]> {
        const { data, error } = await supabase.from("seasons").select("*, competition:competitions (name)").order("year", { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getAllPhases(): Promise<Phase[]> {
        const { data, error } = await supabase.from("phases").select("*").order("name");
        if (error) throw error;
        return data || [];
    },

    async getPeople(): Promise<PersonWithRoles[]> {
        const { data, error } = await supabase
            .from("people")
            .select(`
                *,
                participations (
                    teams (name, team_type),
                    phases (
                        seasons (
                            year,
                            name,
                            competitions (slug, level)
                        )
                    )
                )
            `)
            .order("display_name");
        if (error) throw error;
        return (data || []) as PersonWithRoles[];
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
                home_team:teams!home_team_id (*, team_aliases (*)),
                away_team:teams!away_team_id (*, team_aliases (*)),
                phase:phases!games_phase_id_fkey (*, season:seasons (year, id, competition:competitions (name))),
                venue:venues (*)
            `)
            .or(`and(home_team_id.eq.${team1Id},away_team_id.eq.${team2Id}),and(home_team_id.eq.${team2Id},away_team_id.eq.${team1Id})`)
            .neq("status", "anomaly")
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
    },

    async getChampions(options: { competitionId?: string; level?: string } = {}): Promise<any> {
        const { competitionId, level } = options;

        let selectedCompetitions: Competition[] = [];
        if (competitionId) {
            const comp = await this.getCompetitionById(competitionId);
            if (comp) selectedCompetitions = [comp];
        } else if (level) {
            const { data } = await supabase.from("competitions").select("*").eq("level", level);
            selectedCompetitions = data || [];
        } else {
            const { data } = await supabase.from("competitions").select("*");
            selectedCompetitions = data || [];
        }

        // Fetch all seasons for these competitions
        const compIds = selectedCompetitions.map(c => c.id);
        let seasonQuery = supabase.from("seasons").select("id, year, competition_id");
        if (compIds.length > 0) {
            seasonQuery = seasonQuery.in("competition_id", compIds);
        }
        const { data: seasonsData } = await seasonQuery;
        const seasonIds = (seasonsData as any[])?.map((s: any) => s.id) || [];

        if (seasonIds.length === 0) {
            return {
                selectedCompetition: competitionId ? selectedCompetitions[0] : null,
                selectedLevel: level || null,
                allCompetitions: selectedCompetitions,
                champions: [],
                leaderboard: []
            };
        }

        const { data: gamesData, error } = await supabase
            .from("games")
            .select(`
                *,
                home_team:teams!home_team_id (*, team_aliases (*)),
                away_team:teams!away_team_id (*, team_aliases (*)),
                phase:phases!games_phase_id_fkey (
                    id, name, type,
                    season:seasons (
                        id, year, name,
                        competition:competitions (id, name, level, slug)
                    )
                ),
                venue:venues (*)
            `)
            .in("season_id", seasonIds)
            .in("final_type", ["title", "bowl"])
            .neq("status", "anomaly")
            .order("date", { ascending: false });

        if (error) throw error;
        const games = gamesData || [];

        const processedChampions = games.map((game: any) => {
            const seasonYear = game.phase?.season?.year || (game.date ? new Date(game.date).getFullYear() : 0);
            const homeIdentity = resolveTeamIdentity(game.home_team, seasonYear);
            const awayIdentity = resolveTeamIdentity(game.away_team, seasonYear);

            const homeScore = game.home_score ?? 0;
            const awayScore = game.away_score ?? 0;

            const isTie = game.home_score !== null && game.away_score !== null && homeScore === awayScore;

            const homeTeamObj = {
                ...game.home_team,
                displayName: homeIdentity.name,
                displayLogo: homeIdentity.logo_url || game.home_team?.logo_url,
                score: homeScore
            };

            const awayTeamObj = {
                ...game.away_team,
                displayName: awayIdentity.name,
                displayLogo: awayIdentity.logo_url || game.away_team?.logo_url,
                score: awayScore
            };

            const isHomeWinner = homeScore > awayScore;
            const winner = isTie ? homeTeamObj : (isHomeWinner ? homeTeamObj : awayTeamObj);
            const runnerUp = isTie ? awayTeamObj : (isHomeWinner ? awayTeamObj : homeTeamObj);
            const coChampions = isTie ? [homeTeamObj, awayTeamObj] : [];

            const hostCompetition = game.phase?.season?.competition || null;

            return {
                id: game.id,
                titleName: game.title_name || (game.final_type === 'title' ? 'National Championship' : 'Bowl Game'),
                finalType: game.final_type,
                date: game.date,
                seasonYear,
                seasonName: game.phase?.season?.name || `${seasonYear} Season`,
                phaseName: game.phase?.name,
                venue: game.venue,
                competition: hostCompetition,
                isTie,
                coChampions,
                winner,
                runnerUp
            };
        });

        // Sort by seasonYear desc then date desc
        processedChampions.sort((a, b) => {
            if (b.seasonYear !== a.seasonYear) return b.seasonYear - a.seasonYear;
            return (b.date || '').localeCompare(a.date || '');
        });

        // Leaderboard
        const leaderMap = new Map<string, { teamId: string; name: string; logoUrl: string | null; titlesCount: number; bowlsCount: number }>();
        processedChampions.forEach((item) => {
            const teamsToCredit = item.isTie && item.coChampions.length > 0 ? item.coChampions : [item.winner];
            teamsToCredit.forEach((team: any) => {
                if (!team || !team.id) return;
                const teamId = team.id;
                const existing = leaderMap.get(teamId) || {
                    teamId,
                    name: team.displayName || team.name,
                    logoUrl: team.displayLogo || team.logo_url,
                    titlesCount: 0,
                    bowlsCount: 0
                };

                if (item.finalType === 'title') {
                    existing.titlesCount += 1;
                } else {
                    existing.bowlsCount += 1;
                }
                leaderMap.set(teamId, existing);
            });
        });

        const leaderboard = Array.from(leaderMap.values()).sort((a, b) => {
            if (b.titlesCount !== a.titlesCount) return b.titlesCount - a.titlesCount;
            return b.bowlsCount - a.bowlsCount;
        });

        return {
            selectedCompetition: competitionId ? selectedCompetitions[0] : null,
            selectedLevel: level || null,
            allCompetitions: selectedCompetitions,
            champions: processedChampions,
            leaderboard
        };
    },

    async getCompetitionChampions(competitionId: string): Promise<any> {
        return this.getChampions({ competitionId });
    },

    async getArchiveStats(): Promise<{
        totalGames: number;
        totalSeasons: number;
        totalTeams: number;
        titleGames: number;
        avgCompleteness: number;
    }> {
        const [
            gamesResult,
            seasonsResult,
            teamsResult,
            titleGamesResult,
        ] = await Promise.all([
            supabase.from('games').select('*', { count: 'exact', head: true }).neq('status', 'anomaly'),
            supabase.from('seasons').select('*', { count: 'exact', head: true }),
            supabase.from('teams').select('*', { count: 'exact', head: true }),
            supabase.from('games').select('*', { count: 'exact', head: true }).not('title_name', 'is', null),
        ]);

        const { data: seasonScores } = await supabase
            .from('seasons')
            .select('completeness_score')
            .not('completeness_score', 'is', null);

        const scores = (seasonScores || []).map((s: any) => s.completeness_score as number).filter((n: number) => n > 0);
        const avgCompleteness = scores.length > 0
            ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
            : 0;

        return {
            totalGames: gamesResult.count ?? 0,
            totalSeasons: seasonsResult.count ?? 0,
            totalTeams: teamsResult.count ?? 0,
            titleGames: titleGamesResult.count ?? 0,
            avgCompleteness,
        };
    },

    async getUniballTimelineData(): Promise<UniballTimelineData> {
        const { data: compsData, error: compsError } = await supabase
            .from("competitions")
            .select("id, name, slug, level")
            .in("slug", ["bcafl", "buafl"]);
        if (compsError) throw compsError;
        const comps: any[] = (compsData as any[]) || [];
        const compMap = new Map<string, any>(comps.map(c => [c.id, c]));
        const compIds = comps.map(c => c.id);

        if (compIds.length === 0) {
            return {
                seasons: [],
                stats: {
                    totalSeasons: 0,
                    startYear: 1985,
                    endYear: 2025,
                    totalTeamsDocumented: 0,
                    totalTitleGames: 0,
                    championshipRollOfHonor: [],
                    eras: ERAS_METADATA
                },
                allTeams: []
            };
        }

        const { data: seasonsData, error: seasonsError } = await supabase
            .from("seasons")
            .select("id, year, name, competition_id, completeness_score")
            .in("competition_id", compIds)
            .order("year", { ascending: true });
        if (seasonsError) throw seasonsError;
        const seasons: any[] = (seasonsData as any[]) || [];
        const seasonIds = seasons.map(s => s.id);

        // Fetch phases for all Uniball seasons
        const { data: phasesData, error: phasesError } = await supabase
            .from("phases")
            .select("id, season_id, name, type, ordinal, parent_phase_id")
            .in("season_id", seasonIds)
            .limit(5000);
        if (phasesError) throw phasesError;
        const phases: any[] = (phasesData as any[]) || [];
        const phaseMap = new Map<string, any>(phases.map(p => [p.id, p]));

        // Fetch all title and bowl games across Uniball seasons
        const { data: gamesData, error: gamesError } = await supabase
            .from("games")
            .select(`
                id, season_id, date, home_score, away_score, final_type, title_name, notes,
                home_team:teams!home_team_id (id, name, logo_url, team_aliases (*)),
                away_team:teams!away_team_id (id, name, logo_url, team_aliases (*)),
                venue:venues (id, name, city)
            `)
            .in("season_id", seasonIds)
            .or("final_type.in.(title,bowl),title_name.ilike.%College Bowl%")
            .neq("status", "anomaly")
            .order("date", { ascending: true });
        if (gamesError) throw gamesError;
        const games: any[] = (gamesData as any[]) || [];

        // Paginate fetch all participations
        let allParticipations: any[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
            const { data, error } = await supabase
                .from("participations")
                .select(`
                    id, team_id, phase_id, is_champion, wins, losses, ties, points_for, points_against,
                    team:teams (id, name, logo_url, team_aliases (*))
                `)
                .range(from, from + pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allParticipations = allParticipations.concat(data);
            if (data.length < pageSize) break;
            from += pageSize;
        }

        // Fetch season level notes, divisional champion notes, and all team definitions with aliases
        const [seasonNotesRes, champNotesRes, teamsRes] = await Promise.all([
            supabase.from("notes").select("entity_id, content").eq("entity_type", "seasons"),
            supabase.from("notes").select("entity_id, content").eq("entity_type", "divisional_champion"),
            supabase.from("teams").select("id, name, logo_url, team_aliases (*)")
        ]);

        const seasonNotesMap = new Map(((seasonNotesRes.data || []) as any[]).map(n => [n.entity_id, n.content]));
        const champNotesSet = new Set(((champNotesRes.data || []) as any[]).map(n => `${n.entity_id}:${n.content}`));
        const dbTeams: any[] = (teamsRes.data || []) as any[];
        const dbTeamMap = new Map<string, any>(dbTeams.map(t => [t.id, t]));

        // Filter participations belonging to Uniball phases
        const uniballPhaseIds = new Set(phases.map(p => p.id));
        const uniballParts = allParticipations.filter(p => uniballPhaseIds.has(p.phase_id));

        // Global team accumulator using CURRENT canonical program identities
        const allTeamsMap = new Map<string, TimelineTeamEntry>();

        for (const p of uniballParts) {
            if (p.team?.id) {
                const t = dbTeamMap.get(p.team.id) || p.team;
                if (!allTeamsMap.has(t.id)) {
                    allTeamsMap.set(t.id, {
                        id: t.id,
                        name: t.name,
                        displayName: t.name,
                        logoUrl: t.logo_url || null,
                        aliases: (t.team_aliases || []).map((a: any) => ({
                            id: a.id,
                            name: a.name,
                            startYear: a.start_year,
                            endYear: a.end_year,
                            logoUrl: a.logo_url || null
                        }))
                    });
                }
            }
        }

        for (const g of games) {
            for (const gTeam of [g.home_team, g.away_team]) {
                if (gTeam?.id && !allTeamsMap.has(gTeam.id)) {
                    const t = dbTeamMap.get(gTeam.id) || gTeam;
                    allTeamsMap.set(t.id, {
                        id: t.id,
                        name: t.name,
                        displayName: t.name,
                        logoUrl: t.logo_url || null,
                        aliases: (t.team_aliases || []).map((a: any) => ({
                            id: a.id,
                            name: a.name,
                            startYear: a.start_year,
                            endYear: a.end_year,
                            logoUrl: a.logo_url || null
                        }))
                    });
                }
            }
        }

        // Precompute all program re-branding events across Uniball seasons
        const rebrandEventsMap = new Map<number, TimelineRebrandEvent[]>();

        for (const team of allTeamsMap.values()) {
            if (!team.aliases || team.aliases.length === 0) continue;

            const resolveNameForYear = (yr: number): string => {
                const match = team.aliases.find(a => {
                    const start = a.startYear || 0;
                    const end = a.endYear || 9999;
                    return yr >= start && yr <= end;
                });
                return match ? match.name : team.name;
            };

            for (const alias of team.aliases) {
                // Event 1: Team transitions into this alias identity
                if (alias.startYear && alias.startYear > 1985) {
                    const prevName = resolveNameForYear(alias.startYear - 1);
                    if (prevName !== alias.name) {
                        const list = rebrandEventsMap.get(alias.startYear) || [];
                        if (!list.some(e => e.teamId === team.id && e.toName === alias.name)) {
                            list.push({
                                teamId: team.id,
                                currentName: team.name,
                                fromName: prevName,
                                toName: alias.name,
                                year: alias.startYear,
                                logoUrl: alias.logoUrl || team.logoUrl || null
                            });
                            rebrandEventsMap.set(alias.startYear, list);
                        }
                    }
                }

                // Event 2: Team concludes this alias period and transitions to next moniker / canonical name
                if (alias.endYear && alias.endYear < 2026) {
                    const nextYear = alias.endYear + 1;
                    const nextName = resolveNameForYear(nextYear);
                    if (nextName !== alias.name) {
                        const list = rebrandEventsMap.get(nextYear) || [];
                        if (!list.some(e => e.teamId === team.id && e.toName === nextName)) {
                            list.push({
                                teamId: team.id,
                                currentName: team.name,
                                fromName: alias.name,
                                toName: nextName,
                                year: nextYear,
                                logoUrl: team.logoUrl || null
                            });
                            rebrandEventsMap.set(nextYear, list);
                        }
                    }
                }
            }
        }

        function mapGame(game: any, seasonYear: number): TimelineBowlGame {
            const homeDb = dbTeamMap.get(game.home_team?.id) || game.home_team;
            const awayDb = dbTeamMap.get(game.away_team?.id) || game.away_team;

            const homeIdentity = resolveTeamIdentity(homeDb, seasonYear);
            const awayIdentity = resolveTeamIdentity(awayDb, seasonYear);

            const homeScore = game.home_score ?? null;
            const awayScore = game.away_score ?? null;
            const isTie = homeScore !== null && awayScore !== null && homeScore === awayScore;

            const homeCanonical = homeDb?.name || game.home_team?.name || '';
            const awayCanonical = awayDb?.name || game.away_team?.name || '';

            const homeTeamObj: TimelineGameTeam = {
                id: game.home_team?.id || '',
                name: homeCanonical,
                displayName: homeIdentity.name,
                canonicalName: homeCanonical,
                logoUrl: homeIdentity.logo_url || homeDb?.logo_url || null,
                isRebranded: homeIdentity.name !== homeCanonical,
                score: homeScore
            };

            const awayTeamObj: TimelineGameTeam = {
                id: game.away_team?.id || '',
                name: awayCanonical,
                displayName: awayIdentity.name,
                canonicalName: awayCanonical,
                logoUrl: awayIdentity.logo_url || awayDb?.logo_url || null,
                isRebranded: awayIdentity.name !== awayCanonical,
                score: awayScore
            };

            let winner: TimelineGameTeam | null = null;
            let runnerUp: TimelineGameTeam | null = null;
            let coChampions: TimelineGameTeam[] = [];

            if (isTie) {
                coChampions = [homeTeamObj, awayTeamObj];
            } else if (homeScore !== null && awayScore !== null) {
                if (homeScore > awayScore) {
                    winner = homeTeamObj;
                    runnerUp = awayTeamObj;
                } else {
                    winner = awayTeamObj;
                    runnerUp = homeTeamObj;
                }
            }

            return {
                id: game.id,
                titleName: game.title_name || (game.final_type === 'title' ? 'National Championship' : 'Bowl Final'),
                finalType: game.final_type || 'title',
                date: game.date,
                venue: game.venue || null,
                isTie,
                coChampions,
                winner,
                runnerUp,
                notes: game.notes || null
            };
        }

        // Build enriched season records
        const enrichedSeasons: TimelineSeason[] = seasons.map(season => {
            const comp = compMap.get(season.competition_id);
            const eraObj = getSeasonEra(season.year);
            const sGames = games.filter(g => g.season_id === season.id);
            const sPhases = phases.filter(p => p.season_id === season.id);
            const sPhaseIds = new Set(sPhases.map(p => p.id));
            const sParts = uniballParts.filter(p => sPhaseIds.has(p.phase_id));

            // Teams participating in this season
            const seasonTeamMap = new Map<string, TimelineSeasonTeam>();
            for (const p of sParts) {
                if (p.team) {
                    const dbTeam = dbTeamMap.get(p.team.id) || p.team;
                    const idObj = resolveTeamIdentity(dbTeam, season.year);
                    const ph = phaseMap.get(p.phase_id);
                    const parentPhase = ph?.parent_phase_id ? phaseMap.get(ph.parent_phase_id) : null;
                    const isChamp = p.is_champion || champNotesSet.has(`${p.phase_id}:${p.team_id}`);
                    const canonicalName = dbTeam.name;
                    const isRebranded = idObj.name !== canonicalName;

                    const existing = seasonTeamMap.get(dbTeam.id);
                    const hasRecord = p.wins !== null || p.losses !== null;

                    if (!existing || (!existing.wins && !existing.losses && hasRecord)) {
                        seasonTeamMap.set(dbTeam.id, {
                            id: dbTeam.id,
                            name: canonicalName,
                            displayName: idObj.name,
                            canonicalName,
                            canonicalLogoUrl: dbTeam.logo_url || null,
                            isRebranded,
                            historicalAlias: isRebranded ? idObj.name : null,
                            logoUrl: idObj.logo_url || dbTeam.logo_url || null,
                            phaseId: p.phase_id,
                            phaseName: ph?.name || null,
                            parentPhaseName: parentPhase?.name || null,
                            wins: p.wins,
                            losses: p.losses,
                            ties: p.ties,
                            pointsFor: p.points_for,
                            pointsAgainst: p.points_against,
                            isChampion: isChamp
                        });
                    } else if (isChamp && !existing.isChampion) {
                        existing.isChampion = true;
                    }
                }
            }

            // Also check games for participating teams (in case friendly/unphased games exist)
            for (const g of sGames) {
                if (g.home_team && !seasonTeamMap.has(g.home_team.id)) {
                    const dbTeam = dbTeamMap.get(g.home_team.id) || g.home_team;
                    const idObj = resolveTeamIdentity(dbTeam, season.year);
                    const isRebranded = idObj.name !== dbTeam.name;
                    seasonTeamMap.set(dbTeam.id, {
                        id: dbTeam.id,
                        name: dbTeam.name,
                        displayName: idObj.name,
                        canonicalName: dbTeam.name,
                        canonicalLogoUrl: dbTeam.logo_url || null,
                        isRebranded,
                        historicalAlias: isRebranded ? idObj.name : null,
                        logoUrl: idObj.logo_url || dbTeam.logo_url || null
                    });
                }
                if (g.away_team && !seasonTeamMap.has(g.away_team.id)) {
                    const dbTeam = dbTeamMap.get(g.away_team.id) || g.away_team;
                    const idObj = resolveTeamIdentity(dbTeam, season.year);
                    const isRebranded = idObj.name !== dbTeam.name;
                    seasonTeamMap.set(dbTeam.id, {
                        id: dbTeam.id,
                        name: dbTeam.name,
                        displayName: idObj.name,
                        canonicalName: dbTeam.name,
                        canonicalLogoUrl: dbTeam.logo_url || null,
                        isRebranded,
                        historicalAlias: isRebranded ? idObj.name : null,
                        logoUrl: idObj.logo_url || dbTeam.logo_url || null
                    });
                }
            }

            const seasonTeams = Array.from(seasonTeamMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));

            // Divisional / Conference champions
            const divisionalChampions: TimelineDivisionalChampion[] = [];
            for (const p of sParts) {
                const isChamp = p.is_champion || champNotesSet.has(`${p.phase_id}:${p.team_id}`);
                if (isChamp && p.team) {
                    const dbTeam = dbTeamMap.get(p.team.id) || p.team;
                    const ph = phaseMap.get(p.phase_id);
                    const parentPhase = ph?.parent_phase_id ? phaseMap.get(ph.parent_phase_id) : null;
                    const idObj = resolveTeamIdentity(dbTeam, season.year);
                    const isRebranded = idObj.name !== dbTeam.name;
                    divisionalChampions.push({
                        teamId: dbTeam.id,
                        teamName: dbTeam.name,
                        displayName: idObj.name,
                        canonicalName: dbTeam.name,
                        isRebranded,
                        logoUrl: idObj.logo_url || dbTeam.logo_url || null,
                        phaseId: p.phase_id,
                        phaseName: ph?.name || 'Conference',
                        parentPhaseName: parentPhase?.name || null,
                        wins: p.wins,
                        losses: p.losses,
                        ties: p.ties
                    });
                }
            }
            divisionalChampions.sort((a, b) => {
                const parentDiff = (a.parentPhaseName || '').localeCompare(b.parentPhaseName || '');
                if (parentDiff !== 0) return parentDiff;
                return a.phaseName.localeCompare(b.phaseName);
            });

            // Identify National Championship Game
            const titleCandidates = sGames.filter(g =>
                g.final_type === 'title' || (g.title_name && g.title_name.toLowerCase().includes('college bowl'))
            );
            let nationalChampionship: TimelineBowlGame | null = null;
            if (titleCandidates.length > 0) {
                // If multiple candidates, prioritize one explicitly tagged with College Bowl or final_type='title'
                const exactCB = titleCandidates.find(g => g.title_name && g.title_name.toLowerCase().includes('college bowl'));
                const chosen = exactCB || titleCandidates[0];
                nationalChampionship = mapGame(chosen, season.year);
            }

            // Identify Secondary Bowls (Challenge Trophy, National Trophy, Conference Cups)
            const secondaryBowls: TimelineBowlGame[] = sGames
                .filter(g => g.final_type === 'bowl' && g.id !== nationalChampionship?.id)
                .map(g => mapGame(g, season.year));

            // Special Case: 1985 (Inaugural season, no bowl game held; Hull Sharks crowned undefeated regular season champions)
            if (season.year === 1985 && !nationalChampionship) {
                const hullChamp = divisionalChampions.find(d => d.teamName.toLowerCase().includes('hull') || d.displayName.toLowerCase().includes('hull'));
                if (hullChamp) {
                    nationalChampionship = {
                        id: '1985-inaugural-champion',
                        titleName: 'Inaugural League Champion',
                        finalType: 'title',
                        date: '1986-04-01',
                        venue: null,
                        isTie: false,
                        coChampions: [],
                        winner: {
                            id: hullChamp.teamId,
                            name: hullChamp.canonicalName || hullChamp.teamName,
                            displayName: hullChamp.displayName,
                            canonicalName: hullChamp.canonicalName || hullChamp.teamName,
                            logoUrl: hullChamp.logoUrl,
                            isRebranded: hullChamp.isRebranded,
                            score: null
                        },
                        runnerUp: null,
                        notes: 'No playoff or bowl game was held in the inaugural 1985 season. Hull Sharks were awarded the championship title with an undefeated 5-0 record.'
                    };
                }
            }

            // Status notes (COVID cancellations / suspensions)
            let statusNote = seasonNotesMap.get(season.id) || null;
            if (!statusNote) {
                if (season.year === 2019) {
                    statusNote = 'The 2019/20 season was interrupted by the COVID-19 pandemic during the playoff stages. While the regular season was completed, the postseason was suspended and no champion was crowned.';
                } else if (season.year === 2020) {
                    statusNote = 'The 2020/21 season was cancelled nationwide due to the COVID-19 pandemic. No competitive games were played.';
                }
            }

            const seasonRebrandEvents = (rebrandEventsMap.get(season.year) || [])
                .sort((a, b) => a.currentName.localeCompare(b.currentName));

            return {
                id: season.id,
                year: season.year,
                name: season.name,
                competitionId: season.competition_id,
                competitionName: comp?.name || (season.year <= 2006 ? 'British Collegiate American Football League' : 'British Universities American Football League'),
                competitionSlug: comp?.slug || (season.year <= 2006 ? 'bcafl' : 'buafl'),
                completenessScore: season.completeness_score,
                era: eraObj.era,
                eraLabel: eraObj.eraLabel,
                milestone: UNIBALL_HISTORICAL_MILESTONES[season.year] || null,
                statusNote,
                teamCount: seasonTeams.length,
                teams: seasonTeams,
                nationalChampionship,
                secondaryBowls,
                divisionalChampions,
                rebrandEvents: seasonRebrandEvents
            };
        });

        // Calculate Roll of Honour (National Champions leaderboard) credited to current canonical program name
        const rollMap = new Map<string, TimelineRollOfHonorEntry>();

        for (const season of enrichedSeasons) {
            if (season.nationalChampionship) {
                const nc = season.nationalChampionship;
                const teamsToCredit = nc.isTie && nc.coChampions.length > 0 ? nc.coChampions : (nc.winner ? [nc.winner] : []);
                for (const t of teamsToCredit) {
                    if (!t || !t.id) continue;
                    const teamInfo = allTeamsMap.get(t.id);
                    const canonicalName = teamInfo?.name || t.canonicalName || t.name || t.displayName;
                    const canonicalLogo = teamInfo?.logoUrl || t.logoUrl;

                    const existing = rollMap.get(t.id) || {
                        teamId: t.id,
                        teamName: canonicalName,
                        displayName: canonicalName,
                        logoUrl: canonicalLogo,
                        titlesCount: 0,
                        years: [],
                        historicalAliasesWonAs: []
                    };
                    existing.titlesCount += 1;
                    existing.years.push(season.year);
                    if (t.displayName && t.displayName !== canonicalName && !existing.historicalAliasesWonAs?.includes(t.displayName)) {
                        existing.historicalAliasesWonAs = existing.historicalAliasesWonAs || [];
                        existing.historicalAliasesWonAs.push(t.displayName);
                    }
                    if (canonicalLogo) existing.logoUrl = canonicalLogo;
                    rollMap.set(t.id, existing);
                }
            }
        }

        const championshipRollOfHonor: TimelineRollOfHonorEntry[] = Array.from(rollMap.values())
            .sort((a, b) => {
                if (b.titlesCount !== a.titlesCount) return b.titlesCount - a.titlesCount;
                return a.displayName.localeCompare(b.displayName);
            });

        const allTeams = Array.from(allTeamsMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
        const totalTitleGames = enrichedSeasons.filter(s => s.nationalChampionship !== null).length;

        return {
            seasons: enrichedSeasons,
            stats: {
                totalSeasons: enrichedSeasons.length,
                startYear: enrichedSeasons[0]?.year || 1985,
                endYear: enrichedSeasons[enrichedSeasons.length - 1]?.year || 2025,
                totalTeamsDocumented: allTeams.length,
                totalTitleGames,
                championshipRollOfHonor,
                eras: ERAS_METADATA
            },
            allTeams
        };
    },
};

export interface TimelineGameTeam {
    id: string;
    name: string;
    displayName: string;
    canonicalName?: string;
    logoUrl: string | null;
    isRebranded?: boolean;
    score: number | null;
}

export interface TimelineBowlGame {
    id: string;
    titleName: string;
    finalType: 'title' | 'bowl';
    date: string | null;
    venue: {
        id: string;
        name: string;
        city: string | null;
    } | null;
    isTie: boolean;
    coChampions: TimelineGameTeam[];
    winner: TimelineGameTeam | null;
    runnerUp: TimelineGameTeam | null;
    notes: string | null;
}

export interface TimelineDivisionalChampion {
    teamId: string;
    teamName: string;
    displayName: string;
    canonicalName?: string;
    isRebranded?: boolean;
    logoUrl: string | null;
    phaseId: string;
    phaseName: string;
    parentPhaseName?: string | null;
    wins?: number | null;
    losses?: number | null;
    ties?: number | null;
}

export interface TimelineSeasonTeam {
    id: string;
    name: string;
    displayName: string;
    canonicalName?: string;
    canonicalLogoUrl?: string | null;
    isRebranded?: boolean;
    historicalAlias?: string | null;
    logoUrl: string | null;
    phaseId?: string | null;
    phaseName?: string | null;
    parentPhaseName?: string | null;
    wins?: number | null;
    losses?: number | null;
    ties?: number | null;
    pointsFor?: number | null;
    pointsAgainst?: number | null;
    isChampion?: boolean;
}

export interface TimelineRebrandEvent {
    teamId: string;
    currentName: string;
    fromName: string;
    toName: string;
    year: number;
    logoUrl?: string | null;
}

export interface TimelineSeason {
    id: string;
    year: number;
    name: string;
    competitionId: string;
    competitionName: string;
    competitionSlug: string;
    completenessScore: number | null;
    era: 'pioneer' | 'golden-age' | 'buafl-era' | 'modern-bucs';
    eraLabel: string;
    milestone: string | null;
    statusNote: string | null;
    teamCount: number;
    teams: TimelineSeasonTeam[];
    nationalChampionship: TimelineBowlGame | null;
    secondaryBowls: TimelineBowlGame[];
    divisionalChampions: TimelineDivisionalChampion[];
    rebrandEvents: TimelineRebrandEvent[];
}

export interface TimelineRollOfHonorEntry {
    teamId: string;
    teamName: string;
    displayName: string;
    logoUrl: string | null;
    titlesCount: number;
    years: number[];
    historicalAliasesWonAs?: string[];
}

export interface TimelineTeamAliasEntry {
    id: string;
    name: string;
    startYear: number | null;
    endYear: number | null;
    logoUrl: string | null;
}

export interface TimelineTeamEntry {
    id: string;
    name: string;
    displayName: string;
    logoUrl: string | null;
    aliases: TimelineTeamAliasEntry[];
}

export interface TimelineStats {
    totalSeasons: number;
    startYear: number;
    endYear: number;
    totalTeamsDocumented: number;
    totalTitleGames: number;
    championshipRollOfHonor: TimelineRollOfHonorEntry[];
    eras: {
        id: 'pioneer' | 'golden-age' | 'buafl-era' | 'modern-bucs';
        name: string;
        range: string;
        seasonCount: number;
        description: string;
    }[];
}

export interface UniballTimelineData {
    seasons: TimelineSeason[];
    stats: TimelineStats;
    allTeams: TimelineTeamEntry[];
}

export const UNIBALL_HISTORICAL_MILESTONES: Record<number, string> = {
    1985: "Inaugural Uniball season with 4 pioneer teams: Hull Sharks, Newcastle Scholars, Teesside Demons, and Manchester MPs. Hull Sharks crowned inaugural champions with an undefeated 5-0 record.",
    1986: "The birth of the College Bowl. Hull Sharks defeat Newcastle Scholars 23-6 in College Bowl I to capture back-to-back crowns.",
    1987: "The famous 0-0 double-overtime defensive battle in College Bowl II between Hull Sharks and Cardiff Cobras, crowning them historic co-champions.",
    1988: "Cardiff Cobras win their second national title outright, edging past Stirling Clansmen 7-6 in College Bowl III.",
    1989: "Teesside Demons claim their first national championship, edging the Birmingham Lions 21-20 in College Bowl IV.",
    1990: "Teesside Demons repeat as national champions, shutting out the UEA Pirates 19-0 in College Bowl V.",
    1991: "Southampton Stags capture their first national title in College Bowl VI, defeating Glasgow Tigers 53-0.",
    1992: "Historic four-conference national expansion (Scotland, North, Midlands, South). Southampton defend their crown 19-0 over Leeds in College Bowl VII.",
    1993: "Glasgow Tigers become the first Scottish university to win the national championship, defeating Leicester Longhorns 26-0 in College Bowl VIII.",
    1994: "Loughborough Aces claim College Bowl IX in a 23-20 thriller over Cambridge Pythons.",
    1995: "Leeds Gryphons capture their first title in College Bowl X, defeating Cardiff Cobras 14-8.",
    1996: "Loughborough Aces secure their second national championship, defeating Tarannau Aberystwyth 28-19 in College Bowl XI.",
    1997: "Hertfordshire Hurricanes capture their first national crown, defeating Leeds 16-7 in College Bowl XII.",
    1998: "Hertfordshire Hurricanes defend their title in a defensive 7-3 battle over Loughborough in College Bowl XIII.",
    1999: "Hertfordshire Hurricanes complete a three-peat, defeating Leicester Longhorns 20-6 in College Bowl XIV.",
    2000: "Oxford Cavaliers claim their first national championship, edging Loughborough 26-23 in College Bowl XV.",
    2001: "Loughborough Aces return to the summit for their third national title, winning 39-22 over Oxford in College Bowl XVI.",
    2002: "Stirling Clansmen capture College Bowl XVII with a dramatic 22-17 victory over Hertfordshire.",
    2003: "Hertfordshire Hurricanes return to glory, winning College Bowl XVIII 27-6 over Staffordshire Stallions.",
    2004: "Birmingham Lions claim their first College Bowl title, defeating Glasgow Tigers 34-7 in College Bowl XIX.",
    2005: "Southampton Stags post a record 79 points to win College Bowl XX 79-8 over Teesside Cougars.",
    2006: "UWE Bullets capture College Bowl XXI (31-14 over Loughborough) in the final season of the BCAFL era.",
    2007: "Transition to BUAFL; Southampton Stags capture College Bowl XXII with a 52-20 win over Staffordshire.",
    2008: "BUAFL introduces the Challenge Trophy; Birmingham Lions defeat Newcastle 42-2 in College Bowl XXIII.",
    2009: "Birmingham Lions repeat as champions in College Bowl XXIV, defeating Loughborough 27-16.",
    2010: "Portsmouth Destroyers edge Birmingham Lions 20-19 in a memorable College Bowl XXV.",
    2011: "Hertfordshire Hurricanes capture their fifth national title, winning College Bowl XXVI 37-19 over Birmingham.",
    2012: "Birmingham Lions capture College Bowl XXVII in a 17-13 rematch thriller over Hertfordshire.",
    2013: "Stirling Clansmen edge Birmingham Lions 20-15 in College Bowl XXVIII. BUAFL enters the BUCS federation.",
    2014: "Stirling Clansmen defend their crown, winning College Bowl XXIX 46-6 against Hertfordshire.",
    2015: "Launch of the tiered BUCS Premiership structure; Birmingham Lions edge Stirling 19-13 in College Bowl XXX.",
    2016: "Stirling Clansmen edge Durham Saints 10-7 in College Bowl XXXI for their fourth national title.",
    2017: "Durham Saints capture their first national championship, defeating Derby Braves 17-6 in College Bowl XXXII.",
    2018: "Leeds Beckett Carnegie capture their maiden College Bowl XXXIII title in a 57-13 offensive showcase over Hertfordshire.",
    2019: "Postseason suspended at the Semi-Finals stage due to the COVID-19 pandemic. No national champion crowned.",
    2020: "The entire 2020/21 season was cancelled nationwide due to the COVID-19 pandemic.",
    2021: "Uniball returns post-pandemic; UWE Bullets begin their modern four-peat dynasty, winning College Bowl XXXIV 28-21 over Nottingham.",
    2022: "UWE Bullets defend the crown in College Bowl XXXV, defeating Nottingham 34-27.",
    2023: "UWE Bullets dominate College Bowl XXXVI with a 52-0 shutout over Durham Saints.",
    2024: "UWE Bullets secure their fourth consecutive national championship in College Bowl XXXVII, defeating Nottingham 42-12.",
    2025: "Durham Saints capture the national championship in College Bowl XXXVIII, defeating UWE Bullets 14-6.",
};

const ERAS_METADATA = [
    {
        id: 'pioneer' as const,
        name: 'The Pioneer Years',
        range: '1985–1991',
        seasonCount: 7,
        description: 'From four pioneer programs to 20 universities. The birth of BCAFL and College Bowls I through VI.'
    },
    {
        id: 'golden-age' as const,
        name: 'The Golden Age',
        range: '1992–2006',
        seasonCount: 15,
        description: 'Four-conference national expansion (Scotland, North, Midlands, South) and the rise of collegiate powerhouses.'
    },
    {
        id: 'buafl-era' as const,
        name: 'BUAFL Rebrand & Expansion',
        range: '2007–2014',
        seasonCount: 8,
        description: 'Rebrand from BCAFL to BUAFL, introduction of the Challenge Trophy, and eventual integration into BUCS.'
    },
    {
        id: 'modern-bucs' as const,
        name: 'Modern BUCS Era',
        range: '2015–Present',
        seasonCount: 11,
        description: 'Modern tiered league hierarchy (Premier, Division 1, Division 2) with 80+ universities across the United Kingdom.'
    }
];

function getSeasonEra(year: number): { era: 'pioneer' | 'golden-age' | 'buafl-era' | 'modern-bucs'; eraLabel: string } {
    if (year <= 1991) return { era: 'pioneer', eraLabel: 'The Pioneer Years' };
    if (year <= 2006) return { era: 'golden-age', eraLabel: 'The Golden Age' };
    if (year <= 2014) return { era: 'buafl-era', eraLabel: 'BUAFL Rebrand & Expansion' };
    return { era: 'modern-bucs', eraLabel: 'Modern BUCS Era' };
}
