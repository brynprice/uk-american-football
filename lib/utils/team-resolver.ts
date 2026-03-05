import { Database } from "../supabase/types";

type Team = Database["public"]["Tables"]["teams"]["Row"];
type TeamAlias = Database["public"]["Tables"]["team_aliases"]["Row"];

export interface TeamIdentity {
    name: string;
    logo_url: string | null;
}

/**
 * Resolves the historical identity (name and logo) of a team for a specific date.
 */
export function resolveTeamIdentity(
    team: Team & { team_aliases?: TeamAlias[] },
    gameDate: string | null
): TeamIdentity {
    if (!gameDate || !team.team_aliases || team.team_aliases.length === 0) {
        return {
            name: team.name,
            logo_url: team.logo_url
        };
    }

    const year = new Date(gameDate).getFullYear();

    // Find the alias that covers the game year
    const activeAlias = team.team_aliases.find(alias => {
        const start = alias.start_year || 0;
        const end = alias.end_year || 9999;
        return year >= start && year <= end;
    });

    if (activeAlias) {
        return {
            name: activeAlias.name,
            // Fall back to team logo if alias logo is missing
            logo_url: activeAlias.logo_url || team.logo_url
        };
    }

    return {
        name: team.name,
        logo_url: team.logo_url
    };
}
