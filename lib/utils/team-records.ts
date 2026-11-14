import { isPlayoffPhase } from "./phase-utils";
import { ResolvableTeam, resolveTeamIdentity, TeamIdentity } from "./team-resolver";

export interface TeamRecordSeason {
    id?: string;
    year?: number | null;
    name?: string | null;
    competition?: {
        id?: string;
        name?: string | null;
        slug?: string | null;
        level?: string | null;
    } | null;
}

export interface TeamRecordPhase {
    id?: string;
    name?: string | null;
    type?: string | null;
    ordinal?: number | null;
    parent_phase_id?: string | null;
    season?: TeamRecordSeason | null;
}

export interface TeamRecordTeam extends ResolvableTeam {
    id: string;
    team_type?: string | null;
}

export interface TeamRecordGame {
    id: string;
    date?: string | null;
    date_display?: string | null;
    date_precision?: string | null;
    home_team_id: string;
    away_team_id: string;
    home_score: number | null;
    away_score: number | null;
    game_type?: string | null;
    status?: string | null;
    is_playoff?: boolean | null;
    playoff_round?: string | null;
    final_type?: string | null;
    title_name?: string | null;
    is_double_header?: boolean | null;
    nickname?: string | null;
    phase?: TeamRecordPhase | null;
    away_phase?: TeamRecordPhase | null;
    season?: TeamRecordSeason | null;
    home_team?: TeamRecordTeam | null;
    away_team?: TeamRecordTeam | null;
}

export interface TeamExtremeGame {
    game: TeamRecordGame;
    isHome: boolean;
    teamScore: number;
    oppScore: number;
    margin: number;
    opponent: TeamRecordTeam | null;
    opponentIdentity: TeamIdentity;
    seasonYear: number | null;
    competitionName: string | null;
    phaseName: string | null;
    isPlayoff: boolean;
}

export interface TeamTopWinsAndLosses {
    topWins: TeamExtremeGame[];
    topLosses: TeamExtremeGame[];
}

/**
 * Returns true if a scoreline is a 1-0 or 0-1 walkover forfeit rather than an on-field score.
 */
export function isWalkoverScoreline(
    homeScore: number | null | undefined,
    awayScore: number | null | undefined
): boolean {
    return (homeScore === 1 && awayScore === 0) || (homeScore === 0 && awayScore === 1);
}

function parseDateYear(date?: string | null): number | null {
    if (!date) return null;
    const match = /^(\d{4})/.exec(date.trim());
    if (match) {
        const parsed = Number(match[1]);
        return Number.isFinite(parsed) ? parsed : null;
    }
    const timestamp = Date.parse(date);
    return Number.isFinite(timestamp) ? new Date(timestamp).getUTCFullYear() : null;
}

function compareRecencyDesc(a: TeamExtremeGame, b: TeamExtremeGame): number {
    const dateA = a.game.date || null;
    const dateB = b.game.date || null;

    if (dateA && dateB) {
        const dateDiff = dateB.localeCompare(dateA);
        if (dateDiff !== 0) return dateDiff;
    } else {
        const yearA = a.seasonYear ?? parseDateYear(dateA) ?? 0;
        const yearB = b.seasonYear ?? parseDateYear(dateB) ?? 0;
        if (yearB !== yearA) return yearB - yearA;
        if (dateB && !dateA) return 1;
        if (dateA && !dateB) return -1;
    }

    return a.game.id.localeCompare(b.game.id);
}

/**
 * Computes a team's top competitive wins and losses by score margin.
 *
 * Eligibility:
 * - Played competitive games only (`status === 'completed'`, `game_type === 'league'` or unset)
 * - Excludes walkover forfeits (`status === 'awarded'` and `1-0` / `0-1` scorelines)
 * - Excludes non-league games (friendlies, associate, varsity, old_boys) and ties
 *
 * Ranking:
 * - Wins: largest margin descending, then highest team score descending, then most recent first
 * - Losses: largest margin descending, then highest opponent score descending, then most recent first
 */
export function getTopTeamWinsAndLosses(
    teamId: string,
    games: readonly TeamRecordGame[],
    limit = 3
): TeamTopWinsAndLosses {
    const wins: TeamExtremeGame[] = [];
    const losses: TeamExtremeGame[] = [];
    const seenIds = new Set<string>();

    for (const game of games) {
        if (!game || !game.id || seenIds.has(game.id)) continue;
        seenIds.add(game.id);

        const isHome = game.home_team_id === teamId;
        const isAway = game.away_team_id === teamId;
        if (!isHome && !isAway) continue;

        if (game.status?.toLowerCase() !== "completed") continue;
        if (game.game_type && game.game_type !== "league") continue;

        const teamScore = isHome ? game.home_score : game.away_score;
        const oppScore = isHome ? game.away_score : game.home_score;

        if (
            typeof teamScore !== "number" ||
            typeof oppScore !== "number" ||
            !Number.isFinite(teamScore) ||
            !Number.isFinite(oppScore)
        ) {
            continue;
        }

        if (isWalkoverScoreline(game.home_score, game.away_score)) continue;
        if (teamScore === oppScore) continue;

        const teamPhase = isHome ? game.phase : (game.away_phase || game.phase);
        const resolvedPhase = teamPhase || game.phase || game.away_phase || null;
        const seasonYear =
            resolvedPhase?.season?.year ??
            game.season?.year ??
            parseDateYear(game.date);
        const competitionName =
            resolvedPhase?.season?.competition?.name ??
            game.season?.competition?.name ??
            null;
        const phaseName = resolvedPhase?.name ?? null;
        const isPlayoff = Boolean(
            game.is_playoff ||
            (resolvedPhase
                ? isPlayoffPhase({
                      name: resolvedPhase.name ?? undefined,
                      type: resolvedPhase.type,
                  })
                : false)
        );

        const opponent = (isHome ? game.away_team : game.home_team) ?? null;
        const opponentIdentity = opponent
            ? resolveTeamIdentity(opponent, seasonYear)
            : { name: "Unknown", logo_url: null };

        const entry: TeamExtremeGame = {
            game,
            isHome,
            teamScore,
            oppScore,
            margin: Math.abs(teamScore - oppScore),
            opponent,
            opponentIdentity,
            seasonYear,
            competitionName,
            phaseName,
            isPlayoff,
        };

        if (teamScore > oppScore) {
            wins.push(entry);
        } else {
            losses.push(entry);
        }
    }

    wins.sort((a, b) => {
        if (b.margin !== a.margin) return b.margin - a.margin;
        if (b.teamScore !== a.teamScore) return b.teamScore - a.teamScore;
        return compareRecencyDesc(a, b);
    });

    losses.sort((a, b) => {
        if (b.margin !== a.margin) return b.margin - a.margin;
        if (b.oppScore !== a.oppScore) return b.oppScore - a.oppScore;
        return compareRecencyDesc(a, b);
    });

    const safeLimit = Math.max(0, limit);
    return {
        topWins: wins.slice(0, safeLimit),
        topLosses: losses.slice(0, safeLimit),
    };
}
