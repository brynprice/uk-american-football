'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Database } from '@/lib/supabase/types';

type TeamAlias = Database['public']['Tables']['team_aliases']['Row'];
type Team = Database['public']['Tables']['teams']['Row'] & {
    team_aliases?: TeamAlias[];
};

interface TeamFilterListProps {
    teams: Team[];
}

export default function TeamFilterList({ teams }: TeamFilterListProps) {
    const [selectedType, setSelectedType] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Dynamically calculate unique team_types present in the database and their counts
    const typeCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        teams.forEach((t) => {
            if (t.team_type) {
                counts[t.team_type] = (counts[t.team_type] || 0) + 1;
            }
        });
        return counts;
    }, [teams]);

    // Available filter options dynamically derived from DB values
    const availableTypes = useMemo(() => {
        const preferredOrder = ['Adult', 'Womens', 'University', 'Flag', 'U19s'];
        const typesFromDb = Object.keys(typeCounts);

        // Sort by preferred order first, then any unexpected custom types alphabetically
        return typesFromDb.sort((a, b) => {
            const idxA = preferredOrder.indexOf(a);
            const idxB = preferredOrder.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [typeCounts]);

    // Filtered teams list based on selected team_type and search query
    const filteredTeams = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return teams.filter((team) => {
            const matchesType = selectedType === 'All' || team.team_type === selectedType;
            if (!matchesType) return false;
            if (!query) return true;

            const matchesName = team.name.toLowerCase().includes(query);
            const matchesLocation = team.location ? team.location.toLowerCase().includes(query) : false;
            const matchesAlias = Boolean(team.team_aliases?.some((a) => a.name.toLowerCase().includes(query)));

            return matchesName || matchesLocation || matchesAlias;
        });
    }, [teams, selectedType, searchQuery]);

    return (
        <div className="space-y-6">
            {/* Search & Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-slate-50 p-4 border border-slate-200 rounded-lg">
                {/* Dynamic Filter Pills */}
                <div className="flex flex-wrap gap-2 items-center">
                    <button
                        onClick={() => setSelectedType('All')}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold font-sans transition-all ${
                            selectedType === 'All'
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                    >
                        All ({teams.length})
                    </button>
                    {availableTypes.map((type) => (
                        <button
                            key={type}
                            onClick={() => setSelectedType(type)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold font-sans transition-all ${
                                selectedType === type
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                            }`}
                        >
                            {type} ({typeCounts[type]})
                        </button>
                    ))}
                </div>

                {/* Search Input */}
                <div className="w-full md:w-72">
                    <input
                        type="text"
                        placeholder="Search teams, former aliases, locations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-sans border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                </div>
            </div>

            {/* Teams Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTeams.map((team) => {
                    const query = searchQuery.trim().toLowerCase();
                    const aliases = (team.team_aliases || []).slice().sort((a, b) => (b.start_year || 0) - (a.start_year || 0));
                    const matchedAliases = query ? aliases.filter((a) => a.name.toLowerCase().includes(query)) : [];

                    return (
                        <Link
                            key={team.id}
                            href={`/teams/${team.id}`}
                            className="group block p-6 bg-white border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md transition-all flex items-start gap-5"
                        >
                            <div className="flex-shrink-0 w-16 h-16 bg-white rounded border border-slate-100 flex items-center justify-center overflow-hidden p-1">
                                {team.logo_url ? (
                                    <img
                                        src={team.logo_url}
                                        alt={`${team.name} Logo`}
                                        loading="lazy"
                                        decoding="async"
                                        className="max-w-full max-h-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-300"
                                    />
                                ) : (
                                    <div className="text-[10px] text-slate-300 font-black uppercase tracking-tighter">No Logo</div>
                                )}
                            </div>
                            <div className="flex-grow min-w-0">
                                <h2 className="text-xl font-bold group-hover:text-blue-700 transition-colors leading-tight break-words">{team.name}</h2>
                                {team.team_type && (
                                    <div className="mt-2">
                                        <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-slate-200 font-sans">
                                            {team.team_type}
                                        </span>
                                    </div>
                                )}
                                
                                {matchedAliases.length > 0 ? (
                                    <div className="mt-2 text-xs font-sans bg-amber-50 text-amber-900 border border-amber-200 rounded px-2 py-1">
                                        <span className="font-bold text-amber-800">Matched alias:</span>{' '}
                                        {matchedAliases.map(a => `${a.name}${a.start_year || a.end_year ? ` (${a.start_year || '?'}-${a.end_year || 'Present'})` : ''}`).join(', ')}
                                    </div>
                                ) : aliases.length > 0 ? (
                                    <div className="text-xs text-slate-500 font-sans mt-1.5 truncate" title={aliases.map(a => `${a.name}${a.start_year || a.end_year ? ` (${a.start_year || '?'}-${a.end_year || 'Present'})` : ''}`).join(', ')}>
                                        <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">Formerly:</span>{' '}
                                        <span>
                                            {aliases.map(a => a.name).join(', ')}
                                        </span>
                                    </div>
                                ) : null}

                                <div className="text-sm text-slate-500 font-sans mt-1.5">
                                    {team.location || "Unknown Location"}
                                </div>
                                {team.founded_year && (
                                    <div className="text-xs text-slate-400 font-sans mt-0.5">
                                        Founded: {team.founded_year}
                                    </div>
                                )}
                                {team.folded_year && (
                                    <div className="text-xs text-red-600 font-sans mt-0.5">
                                        Folded: {team.folded_year}
                                    </div>
                                )}
                            </div>
                        </Link>
                    );
                })}

                {filteredTeams.length === 0 && (
                    <div className="col-span-full p-12 text-center bg-white border border-dashed border-slate-300 rounded">
                        <p className="text-slate-500 font-sans italic">No teams found matching your filter criteria.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
