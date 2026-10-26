'use client';

import { useState, useMemo } from 'react';
import GameCard from '@/components/archive/GameCard';

interface UniqueGamesListProps {
    games: any[];
}

export default function UniqueGamesList({ games }: UniqueGamesListProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState<string>('all');
    const [totallyUniqueOnly, setTotallyUniqueOnly] = useState<boolean>(false);
    const [selectedComp, setSelectedComp] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>('recent');

    // Helper to get normalized game level
    const getGameLevel = (g: any): string => {
        if (g.game_level) return g.game_level;
        const compLevel = g.phase?.season?.competition?.level || g.season?.competition?.level;
        if (compLevel === 'Adult Contact' || compLevel === 'Adult') return 'Adult';
        if (compLevel === 'Uniball' || compLevel === 'University') return 'University';
        if (compLevel === 'Womens' || compLevel === 'Women') return 'Womens';
        if (g.home_team?.team_type === 'University' || g.away_team?.team_type === 'University') return 'University';
        if (g.home_team?.team_type) return g.home_team.team_type;
        return 'Adult';
    };

    // Calculate dynamic counts by type / level and totally unique
    const { typeCounts, totallyUniqueCount, availableTypes } = useMemo(() => {
        const counts: Record<string, number> = {};
        let totalUnique = 0;

        games.forEach(g => {
            const level = getGameLevel(g);
            counts[level] = (counts[level] || 0) + 1;
            if (g.is_totally_unique) {
                totalUnique++;
            }
        });

        const preferredOrder = ['Adult', 'University', 'Womens', 'Flag', 'U19s'];
        const types = Object.keys(counts).sort((a, b) => {
            const idxA = preferredOrder.indexOf(a);
            const idxB = preferredOrder.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });

        return { typeCounts: counts, totallyUniqueCount: totalUnique, availableTypes: types };
    }, [games]);

    // Extract unique competition names for the filter dropdown (optionally scoped to selected type)
    const competitions = useMemo(() => {
        const comps = new Set<string>();
        games.forEach(g => {
            const level = getGameLevel(g);
            if (selectedType === 'all' || level === selectedType) {
                const compName = g.phase?.season?.competition?.name || g.season?.competition?.name;
                if (compName) comps.add(compName);
            }
        });
        return Array.from(comps).sort();
    }, [games, selectedType]);

    const filteredGames = useMemo(() => {
        return games.filter(g => {
            const level = getGameLevel(g);

            // Level / Type filter
            if (selectedType !== 'all' && level !== selectedType) {
                return false;
            }

            // Totally Unique Only filter
            if (totallyUniqueOnly && !g.is_totally_unique) {
                return false;
            }

            // Competition filter
            if (selectedComp !== 'all') {
                const compName = g.phase?.season?.competition?.name || g.season?.competition?.name;
                if (compName !== selectedComp) return false;
            }

            // Text search in team names, score, or competition
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const awayName = (g.away_team?.name || '').toLowerCase();
                const homeName = (g.home_team?.name || '').toLowerCase();
                const scoreString = `${g.away_score}-${g.home_score} ${g.home_score}-${g.away_score}`;
                const dateStr = (g.date || '').toLowerCase();
                const compName = (g.phase?.season?.competition?.name || g.season?.competition?.name || '').toLowerCase();

                const matchesQuery = awayName.includes(q) ||
                    homeName.includes(q) ||
                    scoreString.includes(q) ||
                    dateStr.includes(q) ||
                    compName.includes(q);

                if (!matchesQuery) return false;
            }

            return true;
        }).sort((a, b) => {
            if (sortBy === 'recent') {
                return (b.date || '').localeCompare(a.date || '');
            }
            if (sortBy === 'oldest') {
                return (a.date || '').localeCompare(b.date || '');
            }
            if (sortBy === 'highest_total') {
                const totalA = (a.home_score || 0) + (a.away_score || 0);
                const totalB = (b.home_score || 0) + (b.away_score || 0);
                return totalB - totalA;
            }
            if (sortBy === 'highest_win') {
                const maxA = Math.max(a.home_score || 0, a.away_score || 0);
                const maxB = Math.max(b.home_score || 0, b.away_score || 0);
                return maxB - maxA;
            }
            if (sortBy === 'margin') {
                const diffA = Math.abs((a.home_score || 0) - (a.away_score || 0));
                const diffB = Math.abs((b.home_score || 0) - (b.away_score || 0));
                return diffB - diffA;
            }
            return 0;
        });
    }, [games, searchQuery, selectedType, totallyUniqueOnly, selectedComp, sortBy]);

    const hasActiveFilters = searchQuery !== '' || selectedType !== 'all' || totallyUniqueOnly || selectedComp !== 'all' || sortBy !== 'recent';

    return (
        <div>
            {/* Search and Filters Bar */}
            <div className="bg-white border-2 border-slate-900 p-4 md:p-6 mb-8 shadow-sm space-y-4">
                {/* Level / Type Filter Pills */}
                <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                        Filter by Football Level
                    </label>
                    <div className="flex flex-wrap gap-2 items-center">
                        <button
                            type="button"
                            onClick={() => { setSelectedType('all'); setSelectedComp('all'); }}
                            className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
                                selectedType === 'all'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            All Types ({games.length})
                        </button>

                        {availableTypes.map(type => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => { setSelectedType(type); setSelectedComp('all'); }}
                                className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
                                    selectedType === type
                                        ? 'bg-purple-700 text-white shadow-sm'
                                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                                }`}
                            >
                                {type} ({typeCounts[type] || 0})
                            </button>
                        ))}

                        <span className="hidden sm:inline-block w-px h-6 bg-slate-200 mx-1"></span>

                        {/* Totally Unique Only Toggle */}
                        <button
                            type="button"
                            onClick={() => setTotallyUniqueOnly(!totallyUniqueOnly)}
                            className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                totallyUniqueOnly
                                    ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-500 shadow-sm'
                                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
                            }`}
                        >
                            <span>★ Totally Unique Only</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                totallyUniqueOnly ? 'bg-slate-900 text-amber-300' : 'bg-amber-200/80 text-amber-950'
                            }`}>
                                {totallyUniqueCount}
                            </span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-2 border-t border-slate-100">
                    {/* Search Input */}
                    <div className="md:col-span-6">
                        <label htmlFor="search-input" className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                            Search by Team, Score, or Year
                        </label>
                        <input
                            id="search-input"
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="e.g. Oxford, 45-21, 2024..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-sm font-sans focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                        />
                    </div>

                    {/* Competition Filter */}
                    <div className="md:col-span-3">
                        <label htmlFor="comp-select" className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                            Competition
                        </label>
                        <select
                            id="comp-select"
                            value={selectedComp}
                            onChange={(e) => setSelectedComp(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-sm font-sans focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                        >
                            <option value="all">
                                {selectedType === 'all' ? `All Competitions (${games.length})` : `All ${selectedType} Competitions`}
                            </option>
                            {competitions.map(comp => (
                                <option key={comp} value={comp}>{comp}</option>
                            ))}
                        </select>
                    </div>

                    {/* Sort Order */}
                    <div className="md:col-span-3">
                        <label htmlFor="sort-select" className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                            Sort By
                        </label>
                        <select
                            id="sort-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-sm font-sans focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                        >
                            <option value="recent">Most Recent First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="highest_total">Highest Combined Score</option>
                            <option value="highest_win">Highest Winning Score</option>
                            <option value="margin">Biggest Blowout (Margin)</option>
                        </select>
                    </div>
                </div>

                {/* Quick Info Line */}
                <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs text-slate-500 font-sans">
                    <span>
                        Showing <strong className="text-slate-900 font-bold">{filteredGames.length}</strong> of {games.length} unique score games
                        {selectedType !== 'all' && <span> in <strong className="text-purple-700 font-bold">{selectedType}</strong></span>}
                        {totallyUniqueOnly && <span> (<strong className="text-amber-700 font-bold">Totally Unique Only</strong>)</span>}
                    </span>
                    {hasActiveFilters && (
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setSelectedType('all');
                                setTotallyUniqueOnly(false);
                                setSelectedComp('all');
                                setSortBy('recent');
                            }}
                            className="text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider text-[11px]"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Games List */}
            {filteredGames.length > 0 ? (
                <div className="space-y-4">
                    {filteredGames.map((game) => (
                        <GameCard key={game.id} game={game} />
                    ))}
                </div>
            ) : (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 text-center text-slate-500">
                    <h3 className="text-xl font-black text-slate-900 mb-1">No Unique Games Found</h3>
                    <p className="font-serif text-sm">No unique score games matched your search criteria.</p>
                </div>
            )}
        </div>
    );
}
