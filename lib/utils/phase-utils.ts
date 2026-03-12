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
/**
 * Orders a flat list of phases into a sequence that respects its tree structure.
 * Phases are ordered by a depth-first traversal of the hierarchy, 
 * with siblings at each level sorted by their ordinal value.
 */
export function sortPhasesInTreeOrder(phases: any[], parentId: string | null = null): any[] {
    const children = phases
        .filter(p => p.parent_phase_id === parentId)
        .sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));

    const result: any[] = [];
    for (const child of children) {
        result.push(child);
        result.push(...sortPhasesInTreeOrder(phases, child.id));
    }
    return result;
}
