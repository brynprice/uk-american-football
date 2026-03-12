import { Database } from "../supabase/types";

type Team = Database["public"]["Tables"]["teams"]["Row"];
type TeamAlias = Database["public"]["Tables"]["team_aliases"]["Row"];

export interface TeamIdentity {
    name: string;
    logo_url: string | null;
}

/**
 * Resolves the historical identity (name and logo) of a team for a specific season or date.
 * If seasonYear is provided (preferred), it uses that. Otherwise, it falls back to gameDate.
 */
export function resolveTeamIdentity(
    team: Team & { team_aliases?: TeamAlias[] },
    gameDateOrYear: string | number | null
): TeamIdentity {
    if (!gameDateOrYear || !team.team_aliases || team.team_aliases.length === 0) {
        return {
            name: team.name,
            logo_url: team.logo_url
        };
    }

    let year: number;
    if (typeof gameDateOrYear === 'number') {
        year = gameDateOrYear;
    } else {
        year = new Date(gameDateOrYear).getFullYear();
    }

    // Find the alias that covers the year
    const activeAlias = team.team_aliases.find(alias => {
        const start = alias.start_year || 0;
        const end = alias.end_year || 9999;
        return year >= start && year <= end;
    });

    if (activeAlias) {
        return {
            name: activeAlias.name,
            logo_url: activeAlias.logo_url || team.logo_url
        };
    }

    return {
        name: team.name,
        logo_url: team.logo_url
    };
}
