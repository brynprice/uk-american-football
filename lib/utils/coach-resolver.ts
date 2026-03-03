import { Database } from "../supabase/types";

type Game = Database["public"]["Tables"]["games"]["Row"];
type GameStaff = Database["public"]["Tables"]["game_staff"]["Row"];
type Participation = Database["public"]["Tables"]["participations"]["Row"];
type Person = Database["public"]["Tables"]["people"]["Row"];

/**
 * Resolves the head coach for a specific team in a specific game.
 * Priority: 
 * 1. Game-level override in `game_staff` table.
 * 2. Phase-level default in `participations` table.
 */
export function resolveHeadCoach(
    gameId: string,
    teamId: string,
    phaseId: string,
    gameStaff: (GameStaff & { people: Person })[],
    participations: (Participation & { people: Person | null })[]
): Person | null {
    // 1. Check for game-level override
    const gameLevelOverride = gameStaff.find(
        (s) => s.game_id === gameId && s.team_id === teamId && s.role === "head_coach"
    );

    if (gameLevelOverride) {
        return gameLevelOverride.people;
    }

    // 2. Fall back to phase-level default
    const participation = participations.find(
        (p) => p.phase_id === phaseId && p.team_id === teamId
    );

    return participation?.people ?? null;
}
