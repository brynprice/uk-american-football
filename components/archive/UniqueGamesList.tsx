'use client';

import { useState, useMemo } from 'react';
import GameCard from '@/components/archive/GameCard';

interface UniqueGamesListProps {
    games: any[];
}

export default function UniqueGamesList({ games }: UniqueGamesListProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedComp, setSelectedComp] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>('recent');

    // Extract unique competition names for the filter dropdown
    const competitions = useMemo(() => {
        const comps = new Set<string>();
        games.forEach(g => {
            const compName = g.phase?.season?.competition?.name || g.season?.competition?.name;
            if (compName) comps.add(compName);
        });
        return Array.from(comps).sort();
    }, [games]);

    const filteredGames = useMemo(() => {
        return games.filter(g => {
            // Text search in team names or score
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

            // Competition filter
            if (selectedComp !== 'all') {
                const compName = g.phase?.season?.competition?.name || g.season?.competition?.name;
                if (compName !== selectedComp) return false;
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
    }, [games, searchQuery, selectedComp, sortBy]);

    return (
        <div>
            {/* Search and Filters Bar */}
            <div className="bg-white border-2 border-slate-900 p-4 md:p-6 mb-8 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
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
                            <option value="all">All Competitions ({games.length})</option>
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
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-sans">
                    <span>
                        Showing <strong className="text-slate-900 font-bold">{filteredGames.length}</strong> of {games.length} unique score games
                    </span>
                    {(searchQuery || selectedComp !== 'all' || sortBy !== 'recent') && (
                        <button
                            onClick={() => { setSearchQuery(''); setSelectedComp('all'); setSortBy('recent'); }}
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
