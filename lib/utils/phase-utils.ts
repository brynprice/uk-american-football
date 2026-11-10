/**
 * Utility to identify if a phase is a playoff/postseason phase
 * based on its name, type, or the games it contains.
 */
export function isPlayoffPhase(phase: { name?: string; type?: string | null; games?: any[] }) {
    const name = (phase.name || '').toLowerCase();
    const type = (phase.type || '').toLowerCase();

    // Check naming conventions
    const isNamedPlayoff =
        type === 'playoffs' ||
        type.includes('playoff') ||
        type === 'wild_card' ||
        name.includes('playoff') ||
        name.includes('knockout') ||
        name.includes('championship') ||
        name.includes('final') ||
        name.includes('bowl');

    // If we have games, check if they are all marked as playoffs
    const hasOnlyPlayoffGames = phase.games && phase.games.length > 0 && phase.games.every(g => g.is_playoff === true || g.is_playoff === 'true');

    return !!(isNamedPlayoff || hasOnlyPlayoffGames);
}

export interface PhaseTierInfo {
    tierNumber: number; // 1 = Premier, 2 = Division 1, 3 = Division 2, 4 = Other, 9 = Playoffs
    tierTitle: string;
    subOrder: number;
}

/**
 * Determines the competitive tier and sub-ordering of a division/phase.
 * Ensures Premier (National -> North -> South) comes before Division 1, which comes before Division 2.
 */
export function getPhaseTierInfo(phaseName?: string | null, parentPhaseName?: string | null, ordinal?: number | null): PhaseTierInfo {
    const name = (phaseName || '').toLowerCase().trim();
    const parent = (parentPhaseName || '').toLowerCase().trim();
    const combined = `${parent} ${name}`;

    if (isPlayoffPhase({ name: phaseName || '' })) {
        return {
            tierNumber: 9,
            tierTitle: 'Postseason & Playoffs',
            subOrder: ordinal || 99,
        };
    }

    // Tier 1: Premier / Premiership / Super League
    if (combined.includes('premier') || combined.includes('super league')) {
        let subOrder = 50;
        if (name.includes('national')) subOrder = 1;
        else if (name.includes('north')) subOrder = 2;
        else if (name.includes('south')) subOrder = 3;
        else if (ordinal) subOrder = 10 + ordinal;
        return {
            tierNumber: 1,
            tierTitle: 'Tier 1 — Premier',
            subOrder,
        };
    }

    // Tier 2: Division 1
    if (combined.includes('division 1') || combined.includes('div 1') || combined.includes('tier 1')) {
        let subOrder = 50;
        const isNorth = parent.includes('north') || name.includes('north') || name.includes('scottish') || name.includes('mid') || name.includes('york');
        const isSouth = parent.includes('south') || name.includes('south');
        if (isNorth && !isSouth) {
            if (name === 'division 1 north') subOrder = 1;
            else if (name.includes('scottish')) subOrder = 10;
            else if (name.includes('northern')) subOrder = 11;
            else if (name.includes('mid') || name.includes('york')) subOrder = 12;
            else subOrder = 15;
        } else if (isSouth) {
            if (name === 'division 1 south') subOrder = 2;
            else if (name === 'division 1 southern') subOrder = 20;
            else if (name.includes('south east')) subOrder = 21;
            else if (name.includes('south west')) subOrder = 22;
            else subOrder = 25;
        }
        return {
            tierNumber: 2,
            tierTitle: 'Tier 2 — Division 1',
            subOrder,
        };
    }

    // Tier 3: Division 2
    if (combined.includes('division 2') || combined.includes('div 2') || combined.includes('tier 2')) {
        let subOrder = 50;
        const isNorth = parent.includes('north') || name.includes('north') || name.includes('scottish') || name.includes('mid');
        const isSouth = parent.includes('south') || name.includes('south');
        if (isNorth && !isSouth) {
            if (name === 'division 2 north') subOrder = 1;
            else if (name.includes('scottish')) subOrder = 10;
            else if (name.includes('north west')) subOrder = 11;
            else if (name.includes('north east')) subOrder = 12;
            else if (name.includes('mid')) subOrder = 13;
            else subOrder = 15;
        } else if (isSouth) {
            if (name === 'division 2 south') subOrder = 2;
            else if (name === 'division 2 southern') subOrder = 20;
            else if (name.includes('south east')) subOrder = 21;
            else if (name.includes('south west')) subOrder = 22;
            else subOrder = 25;
        }
        return {
            tierNumber: 3,
            tierTitle: 'Tier 3 — Division 2',
            subOrder,
        };
    }

    return {
        tierNumber: 4,
        tierTitle: 'Other Divisions',
        subOrder: ordinal || 50,
    };
}

/**
 * Orders a flat list of phases into a sequence that respects its tree structure.
 * Phases are ordered by a depth-first traversal of the hierarchy, 
 * with siblings at each level sorted by their ordinal value and competitive tier.
 */
export function sortPhasesInTreeOrder(phases: any[], parentId: string | null = null): any[] {
    const parentPhase = parentId ? phases.find(p => p.id === parentId) : null;
    const children = phases
        .filter(p => p.parent_phase_id === parentId)
        .sort((a, b) => {
            const ordDiff = (a.ordinal || 0) - (b.ordinal || 0);
            if (ordDiff !== 0) return ordDiff;
            const tierA = getPhaseTierInfo(a.name, parentPhase?.name, a.ordinal);
            const tierB = getPhaseTierInfo(b.name, parentPhase?.name, b.ordinal);
            if (tierA.tierNumber !== tierB.tierNumber) return tierA.tierNumber - tierB.tierNumber;
            if (tierA.subOrder !== tierB.subOrder) return tierA.subOrder - tierB.subOrder;
            return (a.name || '').localeCompare(b.name || '');
        });

    const result: any[] = [];
    for (const child of children) {
        result.push(child);
        result.push(...sortPhasesInTreeOrder(phases, child.id));
    }
    return result;
}

export interface PhaseCompleteness {
    expectedGames: number | null;
    recordedGames: number;
    missingGames: number;
    unscoredGames: number;
}

/**
 * Calculates expected, recorded, and missing games for a single team participation in a phase.
 * Accounts for double-headers (counting as 2 games in standings) and ignores cancelled/postponed/anomaly games.
 */
export function calculatePhaseCompleteness(participation: any, phaseGames: any[]): PhaseCompleteness {
    const phase = participation?.phase || {};
    const isPlayoff = isPlayoffPhase(phase);

    let recordedGames = 0;
    let unscoredGames = 0;

    (phaseGames || []).forEach((g: any) => {
        const status = (g.status || '').toLowerCase();
        if (status === 'cancelled' || status === 'postponed' || status === 'anomaly') return;
        const mult = g.is_double_header ? 2 : 1;
        recordedGames += mult;

        if (status !== 'scheduled' && (g.home_score === null || g.away_score === null || g.home_score === undefined || g.away_score === undefined)) {
            unscoredGames += mult;
        }
    });

    const hasManualStandings =
        participation?.wins !== null &&
        participation?.wins !== undefined &&
        participation?.losses !== null &&
        participation?.losses !== undefined;

    let expectedGames: number | null = null;

    if (hasManualStandings) {
        expectedGames = (participation.wins || 0) + (participation.losses || 0) + (participation.ties || 0);
    } else if (!isPlayoff && typeof phase.max_games_per_team === 'number' && phase.max_games_per_team > 0) {
        const notes = (participation?.notes || '').toLowerCase();
        const seasonYear = phase.season?.year;
        const withdrewWithNoGames = (notes.includes('withdrew') || notes.includes('folded')) && recordedGames === 0;
        const cancelledCovidSeason = seasonYear === 2020 && recordedGames === 0;

        if (withdrewWithNoGames || cancelledCovidSeason) {
            expectedGames = 0;
        } else {
            expectedGames = phase.max_games_per_team;
        }
    }

    const missingGames = expectedGames !== null ? Math.max(0, expectedGames - recordedGames) : 0;

    return {
        expectedGames,
        recordedGames,
        missingGames,
        unscoredGames
    };
}

export interface SeasonCompletenessSummary {
    seasonKey: string;
    seasonId?: string;
    year: number;
    seasonName: string;
    competitionName: string;
    expectedGames: number;
    recordedGames: number;
    missingGames: number;
    unscoredGames: number;
}

export interface TeamCompletenessSummary {
    totalExpectedGames: number;
    totalRecordedGames: number;
    totalMissingGames: number;
    totalUnscoredGames: number;
    completenessPct: number;
    incompleteSeasons: SeasonCompletenessSummary[];
}

/**
 * Calculates aggregate missing-game metrics across a team's entire participation and game history.
 */
export function calculateTeamCompleteness(
    teamId: string,
    participations: any[],
    games: any[]
): TeamCompletenessSummary {
    const seasonMap = new Map<string, { season: any; participations: any[] }>();

    (participations || []).forEach((p: any) => {
        if (!p.phase || !p.phase.season) return;
        const seasonKey = p.phase.season.id || `year-${p.phase.season.year}`;
        if (!seasonMap.has(seasonKey)) {
            seasonMap.set(seasonKey, {
                season: p.phase.season,
                participations: []
            });
        }
        seasonMap.get(seasonKey)!.participations.push(p);
    });

    let totalExpectedGames = 0;
    let totalRecordedGames = 0;
    let totalMissingGames = 0;
    let totalUnscoredGames = 0;
    const incompleteSeasons: SeasonCompletenessSummary[] = [];

    const sortedSeasons = Array.from(seasonMap.entries()).sort((a, b) => {
        const yearA = a[1].season?.year || 0;
        const yearB = b[1].season?.year || 0;
        return yearB - yearA;
    });

    for (const [seasonKey, { season, participations: seasonParts }] of sortedSeasons) {
        let seasonExpected = 0;
        let seasonRecorded = 0;
        let seasonMissing = 0;
        let seasonUnscored = 0;

        for (const p of seasonParts) {
            const phaseId = p.phase_id || p.phase?.id;
            const phaseGames = (games || []).filter((g: any) => {
                if (g.home_team_id !== teamId && g.away_team_id !== teamId) return false;
                const isHome = g.home_team_id === teamId;
                const teamPhaseId = isHome ? g.phase_id : (g.away_phase_id || g.phase_id);
                return teamPhaseId === phaseId;
            });

            const comp = calculatePhaseCompleteness(p, phaseGames);
            if (comp.expectedGames !== null) {
                seasonExpected += Math.max(comp.expectedGames, comp.recordedGames);
                seasonRecorded += comp.recordedGames;
                seasonMissing += comp.missingGames;
            } else if (comp.recordedGames > 0) {
                seasonExpected += comp.recordedGames;
                seasonRecorded += comp.recordedGames;
            }
            seasonUnscored += comp.unscoredGames;
        }

        totalExpectedGames += seasonExpected;
        totalRecordedGames += seasonRecorded;
        totalMissingGames += seasonMissing;
        totalUnscoredGames += seasonUnscored;

        if (seasonMissing > 0 || seasonUnscored > 0) {
            incompleteSeasons.push({
                seasonKey,
                seasonId: season?.id,
                year: season?.year || 0,
                seasonName: season?.name || (season?.year ? `${season.year} Season` : 'Season'),
                competitionName: season?.competition?.name || '',
                expectedGames: seasonExpected,
                recordedGames: seasonRecorded,
                missingGames: seasonMissing,
                unscoredGames: seasonUnscored
            });
        }
    }

    const completenessPct =
        totalExpectedGames > 0
            ? Math.round(((totalExpectedGames - totalMissingGames) / totalExpectedGames) * 100)
            : 100;

    return {
        totalExpectedGames,
        totalRecordedGames,
        totalMissingGames,
        totalUnscoredGames,
        completenessPct,
        incompleteSeasons
    };
}

