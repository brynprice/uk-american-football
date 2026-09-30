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
        const { data: seasonData, error } = await supabase.from("seasons").select("*, competition:competitions (*), phases (*, ordinal)").eq("id", seasonId).single();
        if (error) throw error;
        if (!seasonData) throw new Error("Season not found");

        // Fetch archival notes for this season
        const { data: notes } = await supabase.from("notes").select("*").eq("entity_id", seasonId).eq("entity_type", "seasons");

        // Fetch unphased games (friendlies) for this season
        const { data: unphasedGames, error: gamesError } = await supabase
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
            .order("date", { ascending: false });

        if (gamesError) throw gamesError;

        return {
            ...(seasonData as any),
            phases: sortPhasesInTreeOrder((seasonData as any).phases || []),
            archival_notes: notes || [],
            unphased_games: unphasedGames || []
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
            let q = supabase.from('games').select('*, phase:phases!games_phase_id_fkey(*)');

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
};
