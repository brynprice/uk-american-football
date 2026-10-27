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
