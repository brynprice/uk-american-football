'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Database } from '@/lib/supabase/types';

type TeamAlias = Database['public']['Tables']['team_aliases']['Row'];
type Team = Database['public']['Tables']['teams']['Row'] & {
    team_aliases?: TeamAlias[];
};

export type TeamStatusFilter = 'active' | 'folded' | 'all';

interface TeamFilterListProps {
    teams: Team[];
    initialStatus?: TeamStatusFilter;
}

export default function TeamFilterList({ teams, initialStatus = 'active' }: TeamFilterListProps) {
    const [statusFilter, setStatusFilter] = useState<TeamStatusFilter>(initialStatus);
    const [selectedType, setSelectedType] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Precalculate counts for Active vs Folded vs All across the entire dataset
    const countsByStatus = useMemo(() => {
        let active = 0;
        let folded = 0;
        teams.forEach((t) => {
            if (t.folded_year) {
                folded++;
            } else {
                active++;
            }
        });
        return {
            active,
            folded,
            all: teams.length,
        };
    }, [teams]);

    // Active status filter handler that resets category if not available
    const handleStatusChange = (newStatus: TeamStatusFilter) => {
        setStatusFilter(newStatus);
        setSelectedType('All');
    };

    // Subset of teams matching current statusFilter
    const statusTeams = useMemo(() => {
        if (statusFilter === 'active') {
            return teams.filter((t) => !t.folded_year);
        }
        if (statusFilter === 'folded') {
            return teams.filter((t) => Boolean(t.folded_year));
        }
        return teams;
    }, [teams, statusFilter]);

    // Calculate unique team_types present in current status and their counts
    const typeCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        statusTeams.forEach((t) => {
            if (t.team_type) {
                counts[t.team_type] = (counts[t.team_type] || 0) + 1;
            }
        });
        return counts;
    }, [statusTeams]);

    // Available filter options dynamically derived from DB values within current status
    const availableTypes = useMemo(() => {
        const preferredOrder = ['Adult', 'University', 'Womens', 'Flag', 'U19s'];
        const typesFromDb = Object.keys(typeCounts);

        return typesFromDb.sort((a, b) => {
            const idxA = preferredOrder.indexOf(a);
            const idxB = preferredOrder.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [typeCounts]);

    // Filtered teams list based on status, selected team_type, and search query
    const filteredTeams = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return statusTeams.filter((team) => {
            const matchesType = selectedType === 'All' || team.team_type === selectedType;
            if (!matchesType) return false;
            if (!query) return true;

            const matchesName = team.name.toLowerCase().includes(query);
            const matchesLocation = team.location ? team.location.toLowerCase().includes(query) : false;
            const matchesAlias = Boolean(team.team_aliases?.some((a) => a.name.toLowerCase().includes(query)));

            return matchesName || matchesLocation || matchesAlias;
        });
    }, [statusTeams, selectedType, searchQuery]);

    // Cross-status search helper: if no results found in current status, check if matches exist in another status
    const crossStatusMatches = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query || filteredTeams.length > 0) return { count: 0, targetStatus: null as TeamStatusFilter | null };

        if (statusFilter === 'active') {
            const matches = teams.filter((t) => {
                if (!t.folded_year) return false;
                const matchesName = t.name.toLowerCase().includes(query);
                const matchesLocation = t.location ? t.location.toLowerCase().includes(query) : false;
                const matchesAlias = Boolean(t.team_aliases?.some((a) => a.name.toLowerCase().includes(query)));
                return matchesName || matchesLocation || matchesAlias;
            });
            return { count: matches.length, targetStatus: 'folded' as TeamStatusFilter };
        }

        if (statusFilter === 'folded') {
            const matches = teams.filter((t) => {
                if (t.folded_year) return false;
                const matchesName = t.name.toLowerCase().includes(query);
                const matchesLocation = t.location ? t.location.toLowerCase().includes(query) : false;
                const matchesAlias = Boolean(t.team_aliases?.some((a) => a.name.toLowerCase().includes(query)));
                return matchesName || matchesLocation || matchesAlias;
            });
            return { count: matches.length, targetStatus: 'active' as TeamStatusFilter };
        }

        return { count: 0, targetStatus: null as TeamStatusFilter | null };
    }, [teams, searchQuery, filteredTeams.length, statusFilter]);

    return (
        <div className="space-y-6">
            {/* Search & Filter Bar */}
            <div className="bg-white p-4 border border-slate-200 rounded-lg shadow-sm space-y-4">
                {/* Status Switcher Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-400 font-sans mr-1">
                            Status:
                        </span>
                        <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200">
                            <button
                                type="button"
                                onClick={() => handleStatusChange('active')}
                                className={`px-3 py-1 rounded-md text-xs font-bold font-sans transition-all flex items-center gap-1.5 ${
                                    statusFilter === 'active'
                                        ? 'bg-white text-emerald-700 shadow-sm font-black'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${statusFilter === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                Active Teams ({countsByStatus.active})
                            </button>
                            <button
                                type="button"
                                onClick={() => handleStatusChange('folded')}
                                className={`px-3 py-1 rounded-md text-xs font-bold font-sans transition-all flex items-center gap-1.5 ${
                                    statusFilter === 'folded'
                                        ? 'bg-white text-rose-700 shadow-sm font-black'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${statusFilter === 'folded' ? 'bg-rose-500' : 'bg-slate-400'}`} />
                                Folded Teams ({countsByStatus.folded})
                            </button>
                            <button
                                type="button"
                                onClick={() => handleStatusChange('all')}
                                className={`px-3 py-1 rounded-md text-xs font-bold font-sans transition-all ${
                                    statusFilter === 'all'
                                        ? 'bg-white text-slate-900 shadow-sm font-black'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                All ({countsByStatus.all})
                            </button>
                        </div>
                    </div>

                    <span className="text-xs text-slate-500 font-sans">
                        {statusFilter === 'active' && 'Showing actively competing programmes'}
                        {statusFilter === 'folded' && 'Showing historical folded / defunct clubs'}
                        {statusFilter === 'all' && 'Showing all historical & active clubs'}
                    </span>
                </div>

                {/* Type Filter Pills & Search Input */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    {/* Dynamic Type Pills */}
                    <div className="flex flex-wrap gap-2 items-center">
                        <button
                            type="button"
                            onClick={() => setSelectedType('All')}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold font-sans transition-all ${
                                selectedType === 'All'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                        >
                            All ({statusTeams.length})
                        </button>
                        {availableTypes.map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setSelectedType(type)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold font-sans transition-all ${
                                    selectedType === type
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                            >
                                {type} ({typeCounts[type] || 0})
                            </button>
                        ))}
                    </div>

                    {/* Search Input */}
                    <div className="w-full md:w-80">
                        <input
                            type="text"
                            placeholder="Search teams, former aliases, locations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs font-sans border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                    </div>
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
                            className="group block p-6 bg-white border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md transition-all flex items-start gap-5 rounded-sm"
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
                                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                    {team.team_type && (
                                        <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-slate-200 font-sans">
                                            {team.team_type}
                                        </span>
                                    )}
                                    {team.folded_year ? (
                                        <span className="inline-block bg-rose-50 text-rose-700 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-rose-200 font-sans">
                                            Folded {team.folded_year}
                                        </span>
                                    ) : (
                                        <span className="inline-block bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-emerald-200 font-sans">
                                            Active
                                        </span>
                                    )}
                                </div>
                                
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
                                    <div className="text-xs text-rose-600 font-sans mt-0.5">
                                        Folded: {team.folded_year}
                                    </div>
                                )}
                            </div>
                        </Link>
                    );
                })}

                {filteredTeams.length === 0 && (
                    <div className="col-span-full p-12 text-center bg-white border border-dashed border-slate-300 rounded-lg">
                        <p className="text-slate-600 font-sans font-medium mb-1">
                            No {statusFilter === 'all' ? '' : statusFilter} teams found matching your filter criteria.
                        </p>
                        {crossStatusMatches.count > 0 && crossStatusMatches.targetStatus && (
                            <div className="mt-4">
                                <p className="text-xs text-slate-500 font-sans mb-3">
                                    However, we found{' '}
                                    <span className="font-bold text-slate-800">{crossStatusMatches.count}</span> matching team{crossStatusMatches.count > 1 ? 's' : ''} in{' '}
                                    <span className="font-semibold capitalize text-slate-700">{crossStatusMatches.targetStatus} Teams</span>.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStatusFilter(crossStatusMatches.targetStatus!);
                                        setSelectedType('All');
                                    }}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow transition-all font-sans"
                                >
                                    Switch to {crossStatusMatches.targetStatus === 'folded' ? 'Folded Teams' : 'Active Teams'} ({crossStatusMatches.count})
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
