import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/types";
import { isPlayoffPhase, sortPhasesInTreeOrder } from "@/lib/utils/phase-utils";
import { resolveTeamIdentity } from "@/lib/utils/team-resolver";
import { isValidUuid } from "@/lib/utils/validation";

export type Competition = Database["public"]["Tables"]["competitions"]["Row"];
export type Season = Database["public"]["Tables"]["seasons"]["Row"];
export type Phase = Database["public"]["Tables"]["phases"]["Row"];
export type Game = Database["public"]["Tables"]["games"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type TeamAlias = Database["public"]["Tables"]["team_aliases"]["Row"];
export type TeamWithAliases = Team & {
    team_aliases?: TeamAlias[];
};
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

const COMPETITION_ORDER = ['bafl', 'bafanl', 'bcafl', 'buafl', 'sapphire-series', 'nwfl'];

export function resolveGameLevel(g: any): string {
    if (g.game_level) return g.game_level;
    const compLevel = g.phase?.season?.competition?.level || g.season?.competition?.level;
    if (compLevel === 'Adult Contact' || compLevel === 'Adult') return 'Adult';
    if (compLevel === 'Uniball' || compLevel === 'University') return 'University';
    if (compLevel === 'Womens' || compLevel === 'Women') return 'Womens';
    if (g.home_team?.team_type === 'University' || g.away_team?.team_type === 'University') return 'University';
    if (g.home_team?.team_type) return g.home_team.team_type;
    if (g.away_team?.team_type) return g.away_team.team_type;
    return 'Adult';
}

let totallyUniqueKeysCache: Set<string> | null = null;
let lastCacheTime = 0;

export async function getTotallyUniqueScoreKeys(): Promise<Set<string>> {
    if (totallyUniqueKeysCache && (Date.now() - lastCacheTime < 60000)) {
        return totallyUniqueKeysCache;
    }
    const scoreCounts = new Map<string, number>();
    const pageSize = 1000;

    const { data: firstPage, count, error } = await supabase
        .from('games')
        .select('home_score, away_score', { count: 'exact' })
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .neq('status', 'anomaly')
        .neq('status', 'cancelled')
        .range(0, pageSize - 1);

    const allRows: any[] = [...((firstPage as any[] | null) || [])];
    if (!error && count && count > pageSize) {
        const totalPages = Math.ceil(count / pageSize);
        const pagePromises = [];
        for (let p = 1; p < totalPages; p++) {
            pagePromises.push(
                supabase
                    .from('games')
                    .select('home_score, away_score')
                    .not('home_score', 'is', null)
                    .not('away_score', 'is', null)
                    .neq('status', 'anomaly')
                    .neq('status', 'cancelled')
                    .range(p * pageSize, (p + 1) * pageSize - 1)
            );
        }
        const pageResults = await Promise.all(pagePromises);
        for (const res of pageResults) {
            if (res.data) allRows.push(...(res.data as any[]));
        }
    }

    for (const row of allRows) {
        const high = Math.max(row.home_score, row.away_score);
        const low = Math.min(row.home_score, row.away_score);
        const key = `${high}-${low}`;
        scoreCounts.set(key, (scoreCounts.get(key) || 0) + 1);
    }

    const uniqueKeys = new Set<string>();
    for (const [key, cnt] of scoreCounts.entries()) {
        if (cnt === 1) uniqueKeys.add(key);
    }
    totallyUniqueKeysCache = uniqueKeys;
    lastCacheTime = Date.now();
    return uniqueKeys;
}

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
        if (!isValidUuid(phaseId)) throw new Error("Invalid phase ID");
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
        const [gameRes, sources, archivalNotes] = await Promise.all([
            supabase
                .from("games")
                .select(`
                    *, 
                    home_team:teams!home_team_id (*, team_aliases (*)), 
                    away_team:teams!away_team_id (*, team_aliases (*)), 
                    venue:venues (*), 
                    phase:phases!games_phase_id_fkey (*, participations (*, person:people (*)), season:seasons (id, year, competition:competitions (name, level))), 
                    away_phase:phases!away_phase_id (name, participations (*, person:people (*))),
                    season:seasons!games_season_id_fkey (id, year, competition:competitions (name, level)),
                    game_staff (*, person:people (*))
                `)
                .eq("id", gameId)
                .single(),
            supabase.from("sources").select("*").eq("entity_id", gameId).eq("entity_type", "games"),
            supabase.from("notes").select("*").eq("entity_id", gameId).eq("entity_type", "games")
        ]);

        const { data, error } = gameRes;
        if (error) throw error;
        if (!data) throw new Error("Game not found");

        const gameData = data as any;
        gameData.game_level = gameData.game_level || resolveGameLevel(gameData);

        if (gameData.is_unique_score && (gameData.is_totally_unique === undefined || gameData.is_totally_unique === null)) {
            const totallyUniqueKeys = await getTotallyUniqueScoreKeys();
            const high = Math.max(gameData.home_score ?? 0, gameData.away_score ?? 0);
            const low = Math.min(gameData.home_score ?? 0, gameData.away_score ?? 0);
            gameData.is_totally_unique = totallyUniqueKeys.has(`${high}-${low}`);
        }

        const teamIds = new Set([gameData.home_team_id, gameData.away_team_id].filter(Boolean));
        const rawParts = [
            ...(gameData.phase?.participations || []),
            ...(gameData.away_phase?.participations || [])
        ];
        const seenPartIds = new Set<string>();
        const participations = rawParts.filter((p: any) => {
            if (!p || !teamIds.has(p.team_id) || seenPartIds.has(p.id)) return false;
            seenPartIds.add(p.id);
            return true;
        });

        return {
            ...gameData,
            sources: sources.data || [],
            archival_notes: archivalNotes.data || [],
            participations
        };
    },


    async getTeamBasic(teamId: string): Promise<any> {
        if (!isValidUuid(teamId)) throw new Error("Invalid team ID");
        const { data, error } = await supabase
            .from("teams")
            .select("id, name, logo_url, team_type, location, founded_year, folded_year, notes, team_aliases (id, name, start_year, end_year, logo_url)")
            .eq("id", teamId)
            .single();
        if (error) throw error;
        if (!data) throw new Error("Team not found");
        return data;
    },

    async getTeamsBasic(teamIds: string[]): Promise<any[]> {
        const validIds = teamIds.filter(isValidUuid);
        if (validIds.length === 0) return [];
        const { data, error } = await supabase
            .from("teams")
            .select("id, name, logo_url, team_type, location, founded_year, folded_year, notes, team_aliases (id, name, start_year, end_year, logo_url)")
            .in("id", validIds);
        if (error) throw error;
        return data || [];
    },

    async getTeamHistory(teamId: string): Promise<any> {
        if (!isValidUuid(teamId)) throw new Error("Invalid team ID");
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
                    id, date, date_display, date_precision, time, home_team_id, away_team_id, home_score, away_score,
                    status, is_playoff, playoff_round, final_type, title_name, is_double_header,
                    is_unique_score, is_totally_unique, game_level, nickname, notes, phase_id, away_phase_id, season_id, venue_id,
                    phase:phases!games_phase_id_fkey (id, name, type, ordinal, parent_phase_id, season:seasons (year, id, name, competition:competitions (id, name, slug, level))),
                    away_phase:phases!away_phase_id (id, name, type, ordinal, parent_phase_id, season:seasons (year, id, name, competition:competitions (id, name, slug, level))),
                    home_team:teams!home_team_id (id, name, logo_url, team_type, team_aliases (id, name, start_year, end_year, logo_url)),
                    away_team:teams!away_team_id (id, name, logo_url, team_type, team_aliases (id, name, start_year, end_year, logo_url))
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
        if (gamesRes.error) throw gamesRes.error;
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
        const cleanScoreA = Math.trunc(Number(scoreA));
        const cleanScoreB = Math.trunc(Number(scoreB));
        if (!Number.isFinite(cleanScoreA) || !Number.isFinite(cleanScoreB)) {
            return [];
        }
        // Query games where (home = scoreA AND away = scoreB) OR (home = scoreB AND away = scoreA)
        const { data, error } = await supabase
            .from('games')
            .select(`
                id, date, date_display, time, home_score, away_score, status, is_unique_score, is_totally_unique,
                game_level, final_type, title_name, nickname, is_playoff, playoff_round, is_double_header,
                phase_id, away_phase_id, home_team_id, away_team_id,
                phase:phases!games_phase_id_fkey(id, name, season:seasons(id, year, competition:competitions(id, name, level, slug))),
                away_phase:phases!away_phase_id(name),
                home_team:teams!home_team_id(id, name, logo_url, team_type, team_aliases(id, name, start_year, end_year, logo_url)),
                away_team:teams!away_team_id(id, name, logo_url, team_type, team_aliases(id, name, start_year, end_year, logo_url))
            `)
            .or(`and(home_score.eq.${cleanScoreA},away_score.eq.${cleanScoreB}),and(home_score.eq.${cleanScoreB},away_score.eq.${cleanScoreA})`)
            .neq("status", "anomaly")
            .order('date', { ascending: false, nullsFirst: false });

        if (error) throw error;
        
        const rows: any[] = data || [];
        const needsFallback = rows.some((g: any) => g.is_totally_unique === undefined || g.is_totally_unique === null);
        const totallyUniqueKeys = needsFallback ? await getTotallyUniqueScoreKeys() : null;
        const games: any[] = rows.map((g: any) => {
            const high = Math.max(g.home_score ?? 0, g.away_score ?? 0);
            const low = Math.min(g.home_score ?? 0, g.away_score ?? 0);
            const isTotallyUnique = g.is_totally_unique !== undefined && g.is_totally_unique !== null
                ? g.is_totally_unique
                : (totallyUniqueKeys ? totallyUniqueKeys.has(`${high}-${low}`) : false);
            return {
                ...g,
                game_level: g.game_level || resolveGameLevel(g),
                is_totally_unique: isTotallyUnique
            };
        });

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
        const [gamesRes, teamsRes, phasesRes] = await Promise.all([
            supabase
                .from('games')
                .select(`
                    id, date, date_display, time, home_score, away_score, status, is_unique_score, is_totally_unique,
                    game_level, final_type, title_name, nickname, is_playoff, playoff_round, is_double_header,
                    phase_id, away_phase_id, home_team_id, away_team_id
                `)
                .eq('is_unique_score', true)
                .neq('status', 'anomaly')
                .neq('status', 'cancelled')
                .order('date', { ascending: false, nullsFirst: false }),
            supabase
                .from('teams')
                .select('id, name, logo_url, team_type, team_aliases(id, name, start_year, end_year, logo_url)'),
            supabase
                .from('phases')
                .select('id, name, season:seasons(id, year, competition:competitions(name, level))')
                .limit(5000)
        ]);

        const { data, error } = gamesRes;
        if (!error && data) {
            const teamMap = new Map<string, any>(((teamsRes.data as any[]) || []).map(t => [t.id, t]));
            const phaseMap = new Map<string, any>(((phasesRes.data as any[]) || []).map(p => [p.id, p]));
            const needsFallback = data.some((g: any) => g.is_totally_unique === undefined || g.is_totally_unique === null);
            const totallyUniqueKeys = needsFallback ? await getTotallyUniqueScoreKeys() : null;
            const games: any[] = data.map((g: any) => {
                const home_team = teamMap.get(g.home_team_id) || null;
                const away_team = teamMap.get(g.away_team_id) || null;
                const phase = g.phase_id ? (phaseMap.get(g.phase_id) || null) : null;
                const awayPh = g.away_phase_id ? phaseMap.get(g.away_phase_id) : null;
                const away_phase = awayPh ? { name: awayPh.name } : null;
                const high = Math.max(g.home_score ?? 0, g.away_score ?? 0);
                const low = Math.min(g.home_score ?? 0, g.away_score ?? 0);
                const isTotallyUnique = g.is_totally_unique !== undefined && g.is_totally_unique !== null
                    ? g.is_totally_unique
                    : (totallyUniqueKeys ? totallyUniqueKeys.has(`${high}-${low}`) : false);
                const enriched = {
                    ...g,
                    phase,
                    away_phase,
                    home_team,
                    away_team
                };
                return {
                    ...enriched,
                    game_level: g.game_level || resolveGameLevel(enriched),
                    is_totally_unique: isTotallyUnique
                };
            });
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
        console.warn('Falling back to in-memory unique score calculation (run migration 20261026_level_unique_scores.sql):', error?.message);
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

        const overallCounts = new Map<string, number>();
        const levelCounts = new Map<string, Map<string, number>>();

        for (const g of allGames) {
            g.game_level = resolveGameLevel(g);
            const high = Math.max(g.home_score, g.away_score);
            const low = Math.min(g.home_score, g.away_score);
            const key = `${high}-${low}`;
            overallCounts.set(key, (overallCounts.get(key) || 0) + 1);

            if (!levelCounts.has(g.game_level)) levelCounts.set(g.game_level, new Map());
            const lvlMap = levelCounts.get(g.game_level)!;
            lvlMap.set(key, (lvlMap.get(key) || 0) + 1);
        }

        const uniqueGames = allGames.filter(g => {
            const high = Math.max(g.home_score, g.away_score);
            const low = Math.min(g.home_score, g.away_score);
            const key = `${high}-${low}`;
            const isLevelUnique = levelCounts.get(g.game_level)?.get(key) === 1;
            return isLevelUnique;
        }).map(g => {
            const high = Math.max(g.home_score, g.away_score);
            const low = Math.min(g.home_score, g.away_score);
            const key = `${high}-${low}`;
            return {
                ...g,
                is_unique_score: true,
                is_totally_unique: overallCounts.get(key) === 1
            };
        });

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

    async getUniqueScoreCount(level?: string): Promise<number> {
        let query = supabase
            .from('games')
            .select('*', { count: 'exact', head: true })
            .eq('is_unique_score', true)
            .neq('status', 'anomaly')
            .neq('status', 'cancelled');

        if (level && level.toLowerCase() !== 'all') {
            query = query.eq('game_level', level);
        }

        const { count, error } = await query;
        if (!error && count !== null) {
            return count;
        }

        return 0;
    },

    async getPersonGamesAsCoach(personId: string): Promise<any[]> {
        if (!isValidUuid(personId)) return [];
        const gameSelectFields = `
            id, date, date_display, date_precision, time, home_team_id, away_team_id, home_score, away_score,
            status, is_playoff, playoff_round, final_type, title_name, is_title_game, is_double_header,
            is_unique_score, is_totally_unique, game_level, nickname, notes, phase_id, away_phase_id, season_id,
            phase:phases!games_phase_id_fkey (id, name, type, ordinal, parent_phase_id, season:seasons (year, id, competition:competitions (id, name, slug, level))),
            away_phase:phases!away_phase_id (id, name, type, ordinal, parent_phase_id, season:seasons (year, id, competition:competitions (id, name, slug, level))),
            home_team:teams!home_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
            away_team:teams!away_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url))
        `;

        // Single round-trip: fetch coached participations (with nested phase games) and all head_coach game_staff overrides concurrently
        const [{ data: participations }, { data: allHeadCoachStaff }] = await Promise.all([
            supabase
                .from('participations')
                .select(`
                    team_id,
                    phase_id,
                    phase:phases!inner (
                        id,
                        home_games:games!games_phase_id_fkey (${gameSelectFields}),
                        away_games:games!away_phase_id (${gameSelectFields})
                    )
                `)
                .eq('head_coach_id', personId) as unknown as Promise<{ data: any[] | null }>,
            supabase
                .from('game_staff')
                .select(`game_id, team_id, person_id, game:games (${gameSelectFields})`)
                .eq('role', 'head_coach') as unknown as Promise<{ data: any[] | null }>
        ]);

        const staffGames = (allHeadCoachStaff || []).filter(s => s.person_id === personId);
        const explicitGameIds = staffGames.map(s => s.game_id);

        const overrideMap = new Map<string, string>();
        for (const s of allHeadCoachStaff || []) {
            overrideMap.set(`${s.game_id}_${s.team_id}`, s.person_id);
        }

        const gameMap = new Map<string, any>();
        for (const p of participations || []) {
            const ph = Array.isArray(p.phase) ? p.phase[0] : p.phase;
            for (const g of ph?.home_games || []) {
                if (g && g.status !== 'anomaly') gameMap.set(g.id, g);
            }
            for (const g of ph?.away_games || []) {
                if (g && g.status !== 'anomaly') gameMap.set(g.id, g);
            }
        }
        for (const s of staffGames) {
            const g = Array.isArray(s.game) ? s.game[0] : s.game;
            if (g && g.status !== 'anomaly') gameMap.set(g.id, g);
        }

        const queryRows = Array.from(gameMap.values());

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

    async getTeams(): Promise<TeamWithAliases[]> {
        const { data, error } = await supabase
            .from("teams")
            .select("*, team_aliases(*)")
            .order("name");
        if (error) throw error;
        return (data || []) as TeamWithAliases[];
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
        const [{ data: homeGames }, { data: awayGames }] = await Promise.all([
            supabase.from("games").select("away_team_id").eq("home_team_id", teamId) as unknown as Promise<{ data: any[] | null }>,
            supabase.from("games").select("home_team_id").eq("away_team_id", teamId) as unknown as Promise<{ data: any[] | null }>
        ]);

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
        if (!isValidUuid(team1Id) || !isValidUuid(team2Id)) return [];
        const { data, error } = await supabase
            .from("games")
            .select(`
                id, date, date_display, time, home_score, away_score, status, is_playoff, playoff_round,
                final_type, title_name, is_double_header, is_unique_score, is_totally_unique, game_level,
                nickname, notes, home_team_id, away_team_id, phase_id, away_phase_id,
                home_team:teams!home_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
                away_team:teams!away_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
                phase:phases!games_phase_id_fkey (id, name, type, season:seasons (year, id, competition:competitions (name))),
                venue:venues (id, name, city)
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

        const compPromise = competitionId
            ? this.getCompetitionById(competitionId).then(c => (c ? [c] : []))
            : level
                ? supabase.from("competitions").select("*").eq("level", level).then(r => (r.data || []) as Competition[])
                : supabase.from("competitions").select("*").then(r => (r.data || []) as Competition[]);

        const gamesPromise = supabase
            .from("games")
            .select(`
                id, title_name, final_type, date, home_score, away_score, season_id, phase_id, home_team_id, away_team_id,
                home_team:teams!home_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
                away_team:teams!away_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
                phase:phases!games_phase_id_fkey (
                    id, name, type,
                    season:seasons (
                        id, year, name, competition_id,
                        competition:competitions (id, name, level, slug)
                    )
                ),
                venue:venues (id, name, city)
            `)
            .in("final_type", ["title", "bowl"])
            .neq("status", "anomaly")
            .order("date", { ascending: false });

        const [selectedCompetitions, { data: gamesData, error }] = await Promise.all([compPromise, gamesPromise]);

        if (error) throw error;
        const compIds = new Set(selectedCompetitions.map(c => c.id));
        if (compIds.size === 0) {
            return {
                selectedCompetition: competitionId ? selectedCompetitions[0] : null,
                selectedLevel: level || null,
                allCompetitions: selectedCompetitions,
                champions: [],
                leaderboard: []
            };
        }

        const games = ((gamesData as any[]) || []).filter(g => {
            const gCompId = g.phase?.season?.competition?.id || g.phase?.season?.competition_id;
            return !gCompId || compIds.has(gCompId);
        });

        const processedChampions = games.map((game: any) => {
            const seasonYear = game.phase?.season?.year || (game.date ? new Date(game.date).getFullYear() : 0);
            const homeIdentity = resolveTeamIdentity(game.home_team, seasonYear);
            const awayIdentity = resolveTeamIdentity(game.away_team, seasonYear);

            const hasScores = game.home_score !== null && game.away_score !== null;
            const homeScore = game.home_score;
            const awayScore = game.away_score;

            const isTie = hasScores && homeScore === awayScore;

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

            let isHomeWinner = true;
            if (hasScores) {
                isHomeWinner = homeScore > awayScore;
            } else {
                const notesLower = (game.notes || '').toLowerCase();
                const awayDefeated =
                    (game.away_team?.name && notesLower.includes(`${game.away_team.name.toLowerCase()} defeated`)) ||
                    (awayIdentity.name && notesLower.includes(`${awayIdentity.name.toLowerCase()} defeated`));
                isHomeWinner = !awayDefeated;
            }
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
            totalGamesResult,
            anomalyGamesResult,
            teamsResult,
            titleGamesResult,
            seasonScoresResult,
        ] = await Promise.all([
            supabase.from('games').select('*', { count: 'exact', head: true }),
            supabase.from('games').select('*', { count: 'exact', head: true }).eq('status', 'anomaly'),
            supabase.from('teams').select('*', { count: 'exact', head: true }),
            supabase.from('games').select('*', { count: 'exact', head: true }).not('final_type', 'is', null).not('title_name', 'is', null),
            supabase.from('seasons').select('completeness_score'),
        ]);

        const seasonRows = (seasonScoresResult.data || []) as any[];
        const scores = seasonRows.map((s: any) => s.completeness_score as number).filter((n: number) => n !== null && n > 0);
        const avgCompleteness = scores.length > 0
            ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
            : 0;

        return {
            totalGames: Math.max(0, (totalGamesResult.count ?? 0) - (anomalyGamesResult.count ?? 0)),
            totalSeasons: seasonRows.length,
            totalTeams: teamsResult.count ?? 0,
            titleGames: titleGamesResult.count ?? 0,
            avgCompleteness,
        };
    },

    async getUniballTimelineData(): Promise<UniballTimelineData> {
        return buildLeagueTimelineData({
            slugs: ["bcafl", "buafl"],
            defaultStartYear: 1985,
            defaultEndYear: 2025,
            eras: ERAS_METADATA,
            getEra: getSeasonEra,
            milestones: UNIBALL_HISTORICAL_MILESTONES,
            isWomens: false
        });
    },

    async getWomensTimelineData(): Promise<UniballTimelineData> {
        return buildLeagueTimelineData({
            slugs: ["sapphire-series", "nwfl"],
            defaultStartYear: 2014,
            defaultEndYear: 2026,
            eras: WOMENS_ERAS_METADATA,
            getEra: getWomensSeasonEra,
            milestones: WOMENS_HISTORICAL_MILESTONES,
            isWomens: true
        });
    },
};

async function buildLeagueTimelineData(options: {
    slugs: string[];
    defaultStartYear: number;
    defaultEndYear: number;
    eras: TimelineStats['eras'];
    getEra: (year: number) => { era: TimelineEraId; eraLabel: string };
    milestones: Record<number, string>;
    isWomens: boolean;
}): Promise<UniballTimelineData> {
    const { slugs, defaultStartYear, defaultEndYear, eras, getEra, milestones, isWomens } = options;

    const pageSize = 1000;
    const fetchParticipationsScalar = async () => {
        const pageIndices = isWomens ? [0] : [0, 1, 2, 3];
        const pages = await Promise.all(
            pageIndices.map(p =>
                supabase
                    .from("participations")
                    .select("id, team_id, phase_id, is_champion, wins, losses, ties, points_for, points_against, phases!inner(season:seasons!inner(competition:competitions!inner(slug)))")
                    .in("phases.season.competition.slug", slugs)
                    .range(p * pageSize, (p + 1) * pageSize - 1)
            )
        );
        const allRows: any[] = [];
        for (const res of pages) {
            if (res.error) throw res.error;
            if (res.data) allRows.push(...(res.data as any[]));
        }
        return allRows;
    };

    // Single parallel round-trip: fetch seasons, phases, games, participations, notes, and canonical teams concurrently
    const [
        seasonsRes,
        phasesRes,
        gamesRes,
        allParticipations,
        seasonNotesRes,
        champNotesRes,
        teamsRes
    ] = await Promise.all([
        supabase
            .from("seasons")
            .select("id, year, name, competition_id, completeness_score, competition:competitions!inner(id, name, slug, level)")
            .in("competition.slug", slugs)
            .order("year", { ascending: true }),
        supabase
            .from("phases")
            .select("id, season_id, name, type, ordinal, parent_phase_id, season:seasons!inner(competition:competitions!inner(slug))")
            .in("season.competition.slug", slugs)
            .limit(5000),
        supabase
            .from("games")
            .select(`
                id, season_id, date, home_score, away_score, final_type, title_name, notes,
                home_team:teams!home_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
                away_team:teams!away_team_id (id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)),
                venue:venues (id, name, city),
                season:seasons!games_season_id_fkey!inner(competition:competitions!inner(slug))
            `)
            .in("season.competition.slug", slugs)
            .or("final_type.in.(title,bowl),title_name.ilike.%College Bowl%")
            .neq("status", "anomaly")
            .order("date", { ascending: true }),
        fetchParticipationsScalar(),
        supabase.from("notes").select("entity_id, content").eq("entity_type", "seasons"),
        supabase.from("notes").select("entity_id, content").eq("entity_type", "divisional_champion"),
        supabase.from("teams").select("id, name, logo_url, team_aliases (id, name, start_year, end_year, logo_url)")
    ]);

    if (seasonsRes.error) throw seasonsRes.error;
    if (phasesRes.error) throw phasesRes.error;
    if (gamesRes.error) throw gamesRes.error;

    const seasons: any[] = (seasonsRes.data as any[]) || [];
    if (seasons.length === 0) {
        return {
            seasons: [],
            stats: {
                totalSeasons: 0,
                startYear: defaultStartYear,
                endYear: defaultEndYear,
                totalTeamsDocumented: 0,
                totalTitleGames: 0,
                championshipRollOfHonor: [],
                eras
            },
            allTeams: []
        };
    }

    const compMap = new Map<string, any>();
    for (const s of seasons) {
        const c = Array.isArray(s.competition) ? s.competition[0] : s.competition;
        if (c && !compMap.has(c.id)) compMap.set(c.id, c);
    }

    const phases: any[] = (phasesRes.data as any[]) || [];
    const phaseMap = new Map<string, any>(phases.map(p => [p.id, p]));
    const games: any[] = (gamesRes.data as any[]) || [];

    const seasonNotesMap = new Map(((seasonNotesRes.data || []) as any[]).map(n => [n.entity_id, n.content]));
    const champNotesSet = new Set(((champNotesRes.data || []) as any[]).map(n => `${n.entity_id}:${n.content}`));
    const dbTeams: any[] = (teamsRes.data || []) as any[];
    const dbTeamMap = new Map<string, any>(dbTeams.map(t => [t.id, t]));

    // Filter participations belonging to target phases and attach canonical team lookup
    const targetPhaseIds = new Set(phases.map(p => p.id));
    const targetParts = allParticipations
        .filter(p => targetPhaseIds.has(p.phase_id))
        .map(p => ({ ...p, team: dbTeamMap.get(p.team_id) || null }));

    // Track active years per team to accurately place post-hiatus/post-COVID rebrand events
    const teamActiveYearsMap = new Map<string, Set<number>>();
    for (const p of targetParts) {
        const ph = phaseMap.get(p.phase_id);
        const sYear = seasons.find(s => s.id === ph?.season_id)?.year;
        if (p.team_id && sYear) {
            if (!teamActiveYearsMap.has(p.team_id)) teamActiveYearsMap.set(p.team_id, new Set());
            teamActiveYearsMap.get(p.team_id)!.add(sYear);
        }
    }

    // Helper to deduplicate overlapping alias entries for the same start/end year span
    const normalizeAliases = (rawAliases: any[]): TimelineTeamAliasEntry[] => {
        const seenSpans = new Set<string>();
        const result: TimelineTeamAliasEntry[] = [];
        for (const a of rawAliases || []) {
            const spanKey = `${a.start_year || ''}-${a.end_year || ''}`;
            if (seenSpans.has(spanKey)) continue;
            seenSpans.add(spanKey);
            result.push({
                id: a.id,
                name: a.name,
                startYear: a.start_year,
                endYear: a.end_year,
                logoUrl: a.logo_url || null
            });
        }
        return result;
    };

    // Global team accumulator using CURRENT canonical program identities
    const allTeamsMap = new Map<string, TimelineTeamEntry>();

    for (const p of targetParts) {
        if (p.team?.id) {
            const t = dbTeamMap.get(p.team.id) || p.team;
            if (!allTeamsMap.has(t.id)) {
                allTeamsMap.set(t.id, {
                    id: t.id,
                    name: t.name,
                    displayName: t.name,
                    logoUrl: t.logo_url || null,
                    aliases: normalizeAliases(t.team_aliases)
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
                    aliases: normalizeAliases(t.team_aliases)
                });
            }
        }
    }

    // Precompute all program re-branding events across seasons
    const rebrandEventsMap = new Map<number, TimelineRebrandEvent[]>();

    for (const team of allTeamsMap.values()) {
        if (!team.aliases || team.aliases.length === 0) continue;
        const activeYears = Array.from(teamActiveYearsMap.get(team.id) || []).sort((a, b) => a - b);

        const resolveNameForYear = (yr: number): string => {
            const match = team.aliases.find(a => {
                const start = a.startYear || 0;
                const end = a.endYear || 9999;
                return yr >= start && yr <= end;
            });
            return match ? match.name : team.name;
        };

        for (const alias of team.aliases) {
            // Event 1: Team transitions into this alias identity after inaugural season
            if (alias.startYear && alias.startYear > defaultStartYear) {
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
                const nextActiveYear = activeYears.find(y => y > alias.endYear!) || (alias.endYear + 1);
                const nextName = resolveNameForYear(nextActiveYear);
                if (nextName !== alias.name) {
                    const list = rebrandEventsMap.get(nextActiveYear) || [];
                    if (!list.some(e => e.teamId === team.id && e.toName === nextName)) {
                        list.push({
                            teamId: team.id,
                            currentName: team.name,
                            fromName: alias.name,
                            toName: nextName,
                            year: nextActiveYear,
                            logoUrl: team.logoUrl || null
                        });
                        rebrandEventsMap.set(nextActiveYear, list);
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
        } else {
            // Completed final with unrecorded numerical score in primary archives
            const notesLower = (game.notes || '').toLowerCase();
            const awayDefeated =
                (awayCanonical && notesLower.includes(`${awayCanonical.toLowerCase()} defeated`)) ||
                (awayIdentity.name && notesLower.includes(`${awayIdentity.name.toLowerCase()} defeated`));
            if (awayDefeated) {
                winner = awayTeamObj;
                runnerUp = homeTeamObj;
            } else {
                winner = homeTeamObj;
                runnerUp = awayTeamObj;
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
        const eraObj = getEra(season.year);
        const sGames = games.filter(g => g.season_id === season.id);
        const sPhases = phases.filter(p => p.season_id === season.id);
        const sPhaseIds = new Set(sPhases.map(p => p.id));
        const sParts = targetParts.filter(p => sPhaseIds.has(p.phase_id));

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
                const isCurrentPlayoff = ph ? isPlayoffPhase(ph) : false;
                const isExistingPlayoff = existing?.phaseName ? isPlayoffPhase({ name: existing.phaseName } as any) : false;

                if (!existing || (!existing.wins && !existing.losses && hasRecord) || (isExistingPlayoff && !isCurrentPlayoff)) {
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
                        isChampion: isChamp || existing?.isChampion || false
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
            const exactCB = titleCandidates.find(g => g.title_name && g.title_name.toLowerCase().includes('college bowl'));
            const chosen = exactCB || titleCandidates[0];
            nationalChampionship = mapGame(chosen, season.year);
        }

        // Identify Secondary Bowls (Challenge Trophy, National Trophy, NWFL 7s, D1 BritBowl, Division 2 Finals)
        const secondaryBowls: TimelineBowlGame[] = sGames
            .filter(g => g.final_type === 'bowl' && g.id !== nationalChampionship?.id)
            .map(g => mapGame(g, season.year));

        // Special Case: 1985 Uniball (Inaugural season, no bowl game held; Hull Sharks crowned undefeated regular season champions)
        if (!isWomens && season.year === 1985 && !nationalChampionship) {
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
            if (isWomens) {
                if (season.year === 2020) {
                    statusNote = 'The 2020 season was cancelled nationwide due to the COVID-19 pandemic. Competitive play resumed in 2021 under the newly formed National Women\'s Football League (NWFL).';
                } else if (season.year === 2021) {
                    statusNote = 'Competitive women\'s football returned post-lockdown across five regional conferences (Northern, Central West, Central East, South East, and South West) without a central national championship playoff.';
                }
            } else {
                if (season.year === 2019) {
                    statusNote = 'The 2019/20 season was interrupted by the COVID-19 pandemic during the playoff stages. While the regular season was completed, the postseason was suspended and no champion was crowned.';
                } else if (season.year === 2020) {
                    statusNote = 'The 2020/21 season was cancelled nationwide due to the COVID-19 pandemic. No competitive games were played.';
                }
            }
        }

        const seasonRebrandEvents = (rebrandEventsMap.get(season.year) || [])
            .sort((a, b) => a.currentName.localeCompare(b.currentName));

        const defaultCompName = isWomens
            ? (season.year <= 2019 ? 'Sapphire Series' : 'NWFL')
            : (season.year <= 2006 ? 'British Collegiate American Football League' : 'British Universities American Football League');
        const defaultCompSlug = isWomens
            ? (season.year <= 2019 ? 'sapphire-series' : 'nwfl')
            : (season.year <= 2006 ? 'bcafl' : 'buafl');

        return {
            id: season.id,
            year: season.year,
            name: season.name,
            competitionId: season.competition_id,
            competitionName: comp?.name || defaultCompName,
            competitionSlug: comp?.slug || defaultCompSlug,
            completenessScore: season.completeness_score,
            era: eraObj.era,
            eraLabel: eraObj.eraLabel,
            milestone: milestones[season.year] || null,
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
            startYear: enrichedSeasons[0]?.year || defaultStartYear,
            endYear: enrichedSeasons[enrichedSeasons.length - 1]?.year || defaultEndYear,
            totalTeamsDocumented: allTeams.length,
            totalTitleGames,
            championshipRollOfHonor,
            eras
        },
        allTeams
    };
}

export type TimelineEraId = 'pioneer' | 'golden-age' | 'buafl-era' | 'modern-bucs' | 'sapphire-era' | 'nwfl-era';

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
    era: TimelineEraId;
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
        id: TimelineEraId;
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

export const WOMENS_HISTORICAL_MILESTONES: Record<number, string> = {
    2014: "Inaugural BAFA Sapphire Series tournament (5v5) with six pioneering programs across North and South conferences. Birmingham Lions defeat Hertfordshire Tornadoes in the I Championship Final to become the first national champions.",
    2015: "The Sapphire Series expands to 13 teams across North and South conferences. Birmingham Lions defend their crown, defeating Hertfordshire Tornadoes in the II Championship Final.",
    2016: "Introduction of a two-tier national structure (Division One and Division Two). Birmingham Lions defeat Leeds Carnegie Chargers 49-18 in the III Championship Final for a three-peat, while Edinburgh Wolves win the Division Two North Final.",
    2017: "Transition to 7v7 contact football with 18 competing clubs. Birmingham Lions dominate the IV Championship Final, defeating Leeds Carnegie Chargers 56-6 for their fourth consecutive national title.",
    2018: "Birmingham Lions secure their fifth consecutive national championship in Sapphire Series V, defeating Leeds Carnegie Chargers 40-22. Portsmouth Dreadnoughts capture the Division 2A Final 18-14 over Sandwell Steelers.",
    2019: "Final edition of the Sapphire Series (Sapphire Series VI). Birmingham Lions complete an unprecedented six-peat dynasty, defeating London Warriors 26-12 in the National Championship Final.",
    2020: "The 2020 season was cancelled nationwide due to the COVID-19 pandemic ahead of the league's planned rebrand to the National Women's Football League (NWFL).",
    2021: "Return to competitive action under the newly launched BAFA National Women's Football League (NWFL) across five regional conferences. Birmingham Lions (8-0) and London Warriors (8-0) post unblemished conference campaigns.",
    2022: "First full NWFL postseason championship era. London Warriors end Birmingham's unbeaten dynasty, winning 33-14 in the NWFL National Championship. Edinburgh Wolves cap a 10-0 campaign by winning the Division One BritBowl 27-21 over Peterborough Royals.",
    2023: "London Warriors repeat as national champions in a 43-38 classic over Birmingham Lions at Britbowl XXXV weekend. Teesside Steelers defeat Manchester Titans to claim the inaugural NWFL 7s National Championship.",
    2024: "Birmingham Lions reclaim the national crown in an 8-6 defensive battle against London Warriors at Britbowl XXXVI. Caledonia Chaos defeat Hertfordshire Cheetahs in overtime to win the NWFL 7s Championship.",
    2025: "Solent Thrashers make history in the NWFL Premiership Final, edging Birmingham Lions 21-20 to capture their maiden national championship. Kent Exiles defeat Cardiff Valkyries 19-13 to win the NWFL 7s Final.",
    2026: "Birmingham Lions capture their eighth national title in a dramatic 8-7 victory over London Warriors in the NWFL Premiership Final. Hertfordshire Cheetahs defeat Cheshire Bears 21-13 to win the NWFL 7s Final.",
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

const WOMENS_ERAS_METADATA = [
    {
        id: 'sapphire-era' as const,
        name: 'The Sapphire Series Era',
        range: '2014–2019',
        seasonCount: 6,
        description: 'The pioneering tournament era of British women\'s contact football (Sapphire Series I–VI), growing from 6 clubs in 5v5 play to multi-tier 7v7 divisions and defined by the Birmingham Lions\' six-peat dynasty.'
    },
    {
        id: 'nwfl-era' as const,
        name: 'The NWFL Era',
        range: '2020–Present',
        seasonCount: 7,
        description: 'Rebranded as the BAFA National Women\'s Football League (NWFL), introducing 9v9 Premiership football alongside national 7s divisions and an intense championship rivalry between Birmingham Lions, London Warriors, and Solent Thrashers.'
    }
];

function getSeasonEra(year: number): { era: TimelineEraId; eraLabel: string } {
    if (year <= 1991) return { era: 'pioneer', eraLabel: 'The Pioneer Years' };
    if (year <= 2006) return { era: 'golden-age', eraLabel: 'The Golden Age' };
    if (year <= 2014) return { era: 'buafl-era', eraLabel: 'BUAFL Rebrand & Expansion' };
    return { era: 'modern-bucs', eraLabel: 'Modern BUCS Era' };
}

function getWomensSeasonEra(year: number): { era: TimelineEraId; eraLabel: string } {
    if (year <= 2019) return { era: 'sapphire-era', eraLabel: 'The Sapphire Series Era' };
    return { era: 'nwfl-era', eraLabel: 'The NWFL Era' };
}
