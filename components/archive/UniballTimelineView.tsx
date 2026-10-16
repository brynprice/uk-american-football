'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
    UniballTimelineData,
    TimelineSeason,
    TimelineBowlGame,
    TimelineDivisionalChampion,
    TimelineGameTeam,
    TimelineSeasonTeam,
    TimelineRebrandEvent,
    TimelineTeamEntry
} from '@/services/archive-service';

interface UniballTimelineViewProps {
    data: UniballTimelineData;
}

export default function UniballTimelineView({ data }: { data: UniballTimelineData }) {
    const { seasons, stats, allTeams } = data;

    // Filter and display states
    const [selectedEra, setSelectedEra] = useState<'all' | 'pioneer' | 'golden-age' | 'buafl-era' | 'modern-bucs'>('all');
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [titleGamesOnly, setTitleGamesOnly] = useState<boolean>(false);

    // Expandable card sections (per season ID)
    const [expandedDivisions, setExpandedDivisions] = useState<Record<string, boolean>>({});
    const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});

    const toggleDivisions = (seasonId: string) => {
        setExpandedDivisions(prev => ({ ...prev, [seasonId]: !prev[seasonId] }));
    };

    const toggleTeams = (seasonId: string) => {
        setExpandedTeams(prev => ({ ...prev, [seasonId]: !prev[seasonId] }));
    };

    // Sync with URL query parameter ?team=...
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const teamParam = params.get('team');
            if (teamParam) {
                const paramLower = teamParam.toLowerCase();
                const matched = allTeams.find(t =>
                    t.id === teamParam ||
                    t.displayName.toLowerCase() === paramLower ||
                    t.name.toLowerCase() === paramLower ||
                    t.aliases.some(a => a.name.toLowerCase() === paramLower)
                );
                if (matched) {
                    setSelectedTeamId(matched.id);
                }
            }
        }
    }, [allTeams]);

    const handleSelectTeam = (teamId: string) => {
        setSelectedTeamId(teamId);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            if (teamId) {
                url.searchParams.set('team', teamId);
            } else {
                url.searchParams.delete('team');
            }
            window.history.replaceState({}, '', url.toString());
        }
    };

    const selectedTeam = useMemo(() => {
        if (!selectedTeamId) return null;
        return allTeams.find(t => t.id === selectedTeamId) || null;
    }, [selectedTeamId, allTeams]);

    // Calculate team summary if a team is selected
    const teamSummary = useMemo(() => {
        if (!selectedTeamId) return null;

        let totalSeasons = 0;
        let titlesWon = 0;
        let runnerUpCount = 0;
        let divTitlesCount = 0;
        const yearsParticipated: number[] = [];

        for (const s of seasons) {
            const inRoster = s.teams.some(t => t.id === selectedTeamId);
            const isWinner = s.nationalChampionship?.winner?.id === selectedTeamId ||
                s.nationalChampionship?.coChampions.some(c => c.id === selectedTeamId);
            const isRunnerUp = s.nationalChampionship?.runnerUp?.id === selectedTeamId;
            const isDivChamp = s.divisionalChampions.some(d => d.teamId === selectedTeamId);

            if (inRoster || isWinner || isRunnerUp || isDivChamp) {
                totalSeasons += 1;
                yearsParticipated.push(s.year);
            }
            if (isWinner) titlesWon += 1;
            if (isRunnerUp) runnerUpCount += 1;
            if (isDivChamp) divTitlesCount += 1;
        }

        return {
            totalSeasons,
            titlesWon,
            runnerUpCount,
            divTitlesCount,
            firstYear: yearsParticipated.length > 0 ? Math.min(...yearsParticipated) : null,
            lastYear: yearsParticipated.length > 0 ? Math.max(...yearsParticipated) : null
        };
    }, [selectedTeamId, seasons]);

    // Filter seasons
    const filteredSeasons = useMemo(() => {
        let result = [...seasons];

        // 1. Era filter
        if (selectedEra !== 'all') {
            result = result.filter(s => s.era === selectedEra);
        }

        // 2. Team filter
        if (selectedTeamId) {
            result = result.filter(s => {
                const inRoster = s.teams.some(t => t.id === selectedTeamId);
                const inTitle = s.nationalChampionship && (
                    s.nationalChampionship.winner?.id === selectedTeamId ||
                    s.nationalChampionship.runnerUp?.id === selectedTeamId ||
                    s.nationalChampionship.coChampions.some(c => c.id === selectedTeamId)
                );
                const inDiv = s.divisionalChampions.some(d => d.teamId === selectedTeamId);
                return inRoster || inTitle || inDiv;
            });
        }

        // 3. Title games only filter
        if (titleGamesOnly) {
            result = result.filter(s => s.nationalChampionship !== null);
        }

        // 4. Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(s => {
                if (s.year.toString().includes(q)) return true;
                if (s.name.toLowerCase().includes(q)) return true;
                if (s.competitionName.toLowerCase().includes(q)) return true;
                if (s.milestone && s.milestone.toLowerCase().includes(q)) return true;
                if (s.statusNote && s.statusNote.toLowerCase().includes(q)) return true;
                if (s.nationalChampionship) {
                    const nc = s.nationalChampionship;
                    if (nc.titleName.toLowerCase().includes(q)) return true;
                    if (nc.winner?.displayName.toLowerCase().includes(q)) return true;
                    if (nc.runnerUp?.displayName.toLowerCase().includes(q)) return true;
                    if (nc.venue?.name?.toLowerCase().includes(q)) return true;
                    if (nc.venue?.city?.toLowerCase().includes(q)) return true;
                }
                if (s.secondaryBowls.some(b =>
                    b.titleName.toLowerCase().includes(q) ||
                    b.winner?.displayName.toLowerCase().includes(q) ||
                    b.runnerUp?.displayName.toLowerCase().includes(q)
                )) return true;
                if (s.divisionalChampions.some(d =>
                    d.displayName.toLowerCase().includes(q) ||
                    d.phaseName.toLowerCase().includes(q)
                )) return true;
                if (s.teams.some(t =>
                    t.displayName.toLowerCase().includes(q) ||
                    t.name.toLowerCase().includes(q) ||
                    (t.canonicalName && t.canonicalName.toLowerCase().includes(q)) ||
                    (t.historicalAlias && t.historicalAlias.toLowerCase().includes(q))
                )) return true;
                if (s.rebrandEvents && s.rebrandEvents.some(r =>
                    r.currentName.toLowerCase().includes(q) ||
                    r.fromName.toLowerCase().includes(q) ||
                    r.toName.toLowerCase().includes(q)
                )) return true;
                return false;
            });
        }

        // 5. Sort order
        result.sort((a, b) => {
            return sortOrder === 'desc' ? b.year - a.year : a.year - b.year;
        });

        return result;
    }, [seasons, selectedEra, selectedTeamId, titleGamesOnly, searchQuery, sortOrder]);

    const activeEraObj = useMemo(() => {
        if (selectedEra === 'all') return null;
        return stats.eras.find(e => e.id === selectedEra) || null;
    }, [selectedEra, stats.eras]);

    const isAnyFilterActive = selectedEra !== 'all' || selectedTeamId !== '' || searchQuery.trim() !== '' || titleGamesOnly;

    const resetFilters = () => {
        setSelectedEra('all');
        handleSelectTeam('');
        setSearchQuery('');
        setTitleGamesOnly(false);
        setSortOrder('desc');
    };

    return (
        <div className="space-y-10 pb-16">
            {/* Header Hero */}
            <div className="border-b-8 border-slate-900 pb-8">
                <div className="max-w-4xl">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="bg-slate-900 text-white font-mono text-xs font-bold px-2.5 py-1 uppercase tracking-widest">
                            Official Archival Chronicle
                        </span>
                        <span className="text-slate-500 font-sans text-xs uppercase tracking-widest font-black">
                            1985 – 2025 • 41 Seasons
                        </span>
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-black uppercase italic tracking-tighter leading-none mb-4">
                        The Uniball Timeline
                    </h1>
                    <p className="text-base sm:text-lg text-slate-600 font-sans leading-relaxed">
                        The comprehensive historical record of British University American Football. Follow the journey from the four pioneer teams of the 1985 inaugural season through the legendary College Bowl era, national multi-conference expansions, and modern tiered BUCS Premiership championships.
                    </p>
                </div>

                {/* Top Metrics Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                    <div className="p-4 sm:p-5 bg-white border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                        <span className="text-3xl sm:text-4xl font-black tabular-nums leading-none block mb-1">
                            {stats.totalSeasons}
                        </span>
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 font-sans">
                            Seasons Documented
                        </span>
                    </div>
                    <div className="p-4 sm:p-5 bg-white border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                        <span className="text-3xl sm:text-4xl font-black tabular-nums leading-none block mb-1">
                            {stats.totalTitleGames}
                        </span>
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 font-sans">
                            National Championships
                        </span>
                    </div>
                    <div className="p-4 sm:p-5 bg-white border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                        <span className="text-3xl sm:text-4xl font-black tabular-nums leading-none block mb-1">
                            {stats.totalTeamsDocumented}+
                        </span>
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 font-sans">
                            University Programs
                        </span>
                    </div>
                    <div className="p-4 sm:p-5 bg-slate-900 text-white border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(59,130,246,1)]">
                        <span className="text-3xl sm:text-4xl font-black tabular-nums leading-none block mb-1">
                            1985 &rarr; 2025
                        </span>
                        <span className="text-[11px] font-black uppercase tracking-wider text-blue-400 font-sans">
                            BCAFL to Modern BUCS
                        </span>
                    </div>
                </div>

                {/* Roll of Honour Quick Filter Strip */}
                <div className="mt-8 pt-6 border-t border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500 font-sans flex items-center gap-1.5">
                            <span>🏆</span> National Championship Roll of Honour (Click team to isolate history):
                        </span>
                        {selectedTeamId && (
                            <button
                                onClick={() => handleSelectTeam('')}
                                className="text-xs text-blue-700 font-bold hover:underline self-start sm:self-auto font-sans"
                            >
                                &times; Clear team filter
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {stats.championshipRollOfHonor.slice(0, 10).map((champ) => {
                            const isSelected = selectedTeamId === champ.teamId;
                            return (
                                <button
                                    key={`roll-${champ.teamId}`}
                                    onClick={() => handleSelectTeam(isSelected ? '' : champ.teamId)}
                                    title={champ.historicalAliasesWonAs && champ.historicalAliasesWonAs.length > 0
                                        ? `Won national titles as ${champ.historicalAliasesWonAs.join(', ')}`
                                        : undefined}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 border font-sans ${
                                        isSelected
                                            ? 'bg-blue-700 text-white border-blue-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] scale-105'
                                            : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-sm'
                                    }`}
                                >
                                    <span className="font-extrabold">{champ.displayName}</span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                        isSelected ? 'bg-white text-blue-800' : 'bg-amber-100 text-amber-900'
                                    }`}>
                                        {champ.titlesCount}x
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Interactive Filter & Search Controls */}
            <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-md p-4 sm:p-5 border-2 border-slate-900 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] rounded-lg space-y-4">
                {/* Era Selector Tabs */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setSelectedEra('all')}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded transition-all font-sans ${
                            selectedEra === 'all'
                                ? 'bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(59,130,246,1)]'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                    >
                        All Eras ({stats.totalSeasons})
                    </button>
                    {stats.eras.map(era => {
                        const isSelected = selectedEra === era.id;
                        return (
                            <button
                                key={`era-${era.id}`}
                                onClick={() => setSelectedEra(isSelected ? 'all' : era.id)}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded transition-all font-sans ${
                                    isSelected
                                        ? 'bg-blue-700 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                            >
                                {era.name} <span className="opacity-75 font-normal">({era.range})</span>
                            </button>
                        );
                    })}
                </div>

                {/* Active Era Narrative Banner (if specific era selected) */}
                {activeEraObj && (
                    <div className="p-3 bg-slate-50 border-l-4 border-blue-600 text-xs text-slate-700 font-sans leading-relaxed">
                        <strong className="text-slate-900 uppercase font-black mr-1">{activeEraObj.name} ({activeEraObj.range}):</strong>
                        {activeEraObj.description}
                    </div>
                )}

                {/* Search, Team Filter, and Controls Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex flex-1 flex-col sm:flex-row gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Search year, champion, bowl (e.g. 'College Bowl XXIV'), venue..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-3 pr-8 py-2 text-xs font-sans border-2 border-slate-300 rounded focus:border-slate-900 focus:outline-none"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 text-xs font-black"
                                >
                                    &times;
                                </button>
                            )}
                        </div>

                        {/* Team Dropdown Selector */}
                        <div className="relative sm:w-80 flex items-center">
                            <select
                                value={selectedTeamId}
                                onChange={(e) => handleSelectTeam(e.target.value)}
                                className={`w-full py-2 pl-3 ${selectedTeamId ? 'pr-8 bg-blue-50 border-blue-600 font-bold text-blue-900 shadow-sm' : 'pr-3 bg-white border-slate-300'} text-xs font-sans border-2 rounded focus:border-slate-900 focus:outline-none transition-colors`}
                            >
                                <option value="">Filter by University Program...</option>
                                {allTeams.map(t => {
                                    const formerAliases = t.aliases && t.aliases.length > 0
                                        ? Array.from(new Set(t.aliases.map(a => a.name))).join(', ')
                                        : null;
                                    return (
                                        <option key={`team-opt-${t.id}`} value={t.id}>
                                            {t.displayName}{formerAliases ? ` (formerly ${formerAliases})` : ''}
                                        </option>
                                    );
                                })}
                            </select>
                            {selectedTeamId && (
                                <button
                                    type="button"
                                    onClick={() => handleSelectTeam('')}
                                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 text-xs font-black"
                                    title="Clear team filter"
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Secondary Toggles: Title Games & Sort Order */}
                    <div className="flex items-center gap-3 shrink-0">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer font-sans select-none">
                            <input
                                type="checkbox"
                                checked={titleGamesOnly}
                                onChange={(e) => setTitleGamesOnly(e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                            />
                            <span>Championships Only</span>
                        </label>

                        <button
                            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                            className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-sans flex items-center gap-1"
                            title="Toggle Chronological / Reverse-Chronological"
                        >
                            <span>Sort:</span>
                            <span className="font-mono font-black">{sortOrder === 'desc' ? 'Newest First ↓' : 'Oldest First ↑'}</span>
                        </button>

                        {isAnyFilterActive && (
                            <button
                                onClick={resetFilters}
                                className="text-xs text-red-600 font-bold hover:underline font-sans"
                            >
                                Reset All
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Selected Team Profile Spotlight (Directly below sticky controls) */}
            {selectedTeam && teamSummary && (
                <div className="p-5 sm:p-6 bg-blue-50 border-2 border-blue-900 rounded-lg shadow-[4px_4px_0px_0px_rgba(30,58,138,1)] flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        {selectedTeam.logoUrl ? (
                            <div className="w-16 h-16 bg-white border-2 border-blue-900 rounded-full flex items-center justify-center p-1 shadow-sm shrink-0 overflow-hidden">
                                <img
                                    src={selectedTeam.logoUrl}
                                    alt={selectedTeam.displayName}
                                    className="max-w-full max-h-full object-contain"
                                />
                            </div>
                        ) : (
                            <div className="w-16 h-16 bg-white border-2 border-blue-900 rounded-full flex items-center justify-center font-black text-xl text-blue-900 shadow-sm shrink-0">
                                {selectedTeam.displayName.slice(0, 2).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-widest text-blue-700 font-sans">
                                    Team Archive Spotlight
                                </span>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-slate-900">
                                {selectedTeam.displayName}
                            </h2>
                            <p className="text-xs text-slate-600 font-sans mt-0.5">
                                Active in Uniball {teamSummary.firstYear} &ndash; {teamSummary.lastYear} &bull; {teamSummary.totalSeasons} Seasons Documented
                            </p>
                            {selectedTeam.aliases && selectedTeam.aliases.length > 0 && (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-sans">
                                    <span className="font-black text-slate-500 uppercase tracking-wider text-[10px]">
                                        Historical Monikers:
                                    </span>
                                    {selectedTeam.aliases.map((al, idx) => (
                                        <span
                                            key={`al-${idx}`}
                                            className="bg-white/90 border border-blue-200 text-blue-900 px-2 py-0.5 rounded text-[11px] font-bold shadow-xs"
                                        >
                                            {al.name} ({al.startYear || 'Early'}&ndash;{al.endYear || 'Present'})
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="grid grid-cols-3 gap-3 text-center shrink-0 w-full sm:w-auto">
                            <div className="bg-white p-3 border border-blue-200 rounded min-w-[70px]">
                                <span className="text-2xl font-black text-blue-900 block leading-tight">{teamSummary.titlesWon}</span>
                                <span className="text-[10px] uppercase font-bold text-slate-500 font-sans">Bowls Won</span>
                            </div>
                            <div className="bg-white p-3 border border-blue-200 rounded min-w-[70px]">
                                <span className="text-2xl font-black text-slate-900 block leading-tight">{teamSummary.runnerUpCount}</span>
                                <span className="text-[10px] uppercase font-bold text-slate-500 font-sans">Runners-Up</span>
                            </div>
                            <div className="bg-white p-3 border border-blue-200 rounded min-w-[70px]">
                                <span className="text-2xl font-black text-amber-600 block leading-tight">{teamSummary.divTitlesCount}</span>
                                <span className="text-[10px] uppercase font-bold text-slate-500 font-sans">Div. Titles</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => handleSelectTeam('')}
                            className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border-2 border-blue-900 rounded font-black text-xs uppercase tracking-wider font-sans transition-colors"
                        >
                            &times; Clear Filter
                        </button>
                    </div>
                </div>
            )}

            {/* Timeline Filter Summary Counter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-sans text-slate-500 px-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span>
                        Showing <strong>{filteredSeasons.length}</strong> of {stats.totalSeasons} seasons
                        {selectedEra !== 'all' && ` in ${activeEraObj?.name}`}
                        {selectedTeam && ` for ${selectedTeam.displayName}`}
                        {titleGamesOnly && ' (Championship seasons only)'}
                    </span>
                    {selectedTeamId && (
                        <button
                            type="button"
                            onClick={() => handleSelectTeam('')}
                            className="text-xs text-blue-600 font-bold hover:underline font-sans"
                        >
                            &times; Clear team filter
                        </button>
                    )}
                </div>
                <span className="font-mono">
                    {filteredSeasons.length > 0 && `${filteredSeasons[0].year} &bull; ${filteredSeasons[filteredSeasons.length - 1].year}`}
                </span>
            </div>

            {/* Empty State */}
            {filteredSeasons.length === 0 && (
                <div className="p-12 text-center bg-white border-2 border-dashed border-slate-300 rounded-lg space-y-4">
                    <span className="text-4xl block">🔍</span>
                    <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900">
                        No Seasons Found
                    </h3>
                    <p className="text-sm text-slate-600 font-sans max-w-md mx-auto">
                        No historical seasons matched your current search and filter criteria. Try clearing your search query or switching eras.
                    </p>
                    <button
                        onClick={resetFilters}
                        className="px-5 py-2.5 bg-slate-900 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-colors rounded"
                    >
                        Reset All Filters
                    </button>
                </div>
            )}

            {/* Timeline Spine & Season Cards */}
            <div className="relative pl-6 sm:pl-10 space-y-12 before:absolute before:left-2 sm:before:left-4 before:top-4 before:bottom-4 before:w-1 before:bg-slate-900">
                {filteredSeasons.map((season) => {
                    // Check if selected team has specific milestones in this season
                    const isSelectedTeamWinner = Boolean(
                        selectedTeamId && (
                            season.nationalChampionship?.winner?.id === selectedTeamId ||
                            season.nationalChampionship?.coChampions?.some(c => c.id === selectedTeamId)
                        )
                    );
                    const isSelectedTeamRunnerUp = Boolean(
                        selectedTeamId && season.nationalChampionship?.runnerUp?.id === selectedTeamId
                    );
                    const selectedTeamDivChamp = season.divisionalChampions.find(d => d.teamId === selectedTeamId);
                    const selectedTeamSeasonInfo = selectedTeamId ? season.teams.find(t => t.id === selectedTeamId) : undefined;

                    const isDivOpen = expandedDivisions[season.id] !== undefined
                        ? expandedDivisions[season.id]
                        : (selectedTeamId ? !!selectedTeamDivChamp : false);
                    const isTeamsOpen = !!expandedTeams[season.id];

                    return (
                        <div key={`season-${season.id}`} className="relative group">
                            {/* Spine Year Node */}
                            <div className="absolute -left-6 sm:-left-10 top-2 -translate-x-1/2 w-6 h-6 sm:w-8 sm:h-8 rounded-full border-4 border-slate-900 bg-white group-hover:bg-blue-600 transition-colors flex items-center justify-center shadow-sm z-10">
                                <div className="w-2 h-2 rounded-full bg-slate-900 group-hover:bg-white" />
                            </div>

                            {/* Main Season Card Container */}
                            <div className={`bg-white border-2 border-slate-900 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] rounded-lg overflow-hidden transition-all duration-150 ${
                                isSelectedTeamWinner ? 'ring-4 ring-amber-400' : ''
                            }`}>
                                {/* Season Card Header Strip */}
                                <div className="p-4 sm:p-5 border-b-2 border-slate-900 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                        <span className="text-2xl sm:text-3xl font-black italic tracking-tight font-sans text-slate-900">
                                             {season.year}&ndash;{String((season.year + 1) % 100).padStart(2, '0')}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-slate-900 text-white font-sans">
                                            {season.competitionSlug.toUpperCase()}
                                        </span>
                                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider font-sans ${
                                            season.era === 'pioneer' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                            season.era === 'golden-age' ? 'bg-indigo-100 text-indigo-900 border border-indigo-300' :
                                            season.era === 'buafl-era' ? 'bg-sky-100 text-sky-900 border border-sky-300' :
                                            'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                        }`}>
                                            {season.eraLabel}
                                        </span>
                                        <span className="text-xs font-bold text-slate-500 font-sans">
                                            {season.teamCount} Teams
                                        </span>
                                        {season.completenessScore !== null && season.completenessScore > 0 && (
                                            <span className="text-[11px] font-bold text-slate-400 font-sans hidden md:inline">
                                                &bull; {season.completenessScore}% Completeness
                                            </span>
                                        )}
                                    </div>

                                    {/* Link to Full Season Archive */}
                                    <Link
                                        href={`/seasons/${season.id}`}
                                        className="text-xs font-black uppercase tracking-widest text-blue-700 hover:text-blue-900 font-sans flex items-center gap-1 group/link"
                                    >
                                        <span>Season Vault</span>
                                        <span className="group-hover/link:translate-x-1 transition-transform">&rarr;</span>
                                    </Link>
                                </div>

                                <div className="p-4 sm:p-6 space-y-6">
                                    {/* Selected Team Campaign Showcase Banner */}
                                    {selectedTeam && (
                                        <TeamCampaignBanner
                                            team={selectedTeam}
                                            season={season}
                                            seasonTeam={selectedTeamSeasonInfo}
                                            isWinner={isSelectedTeamWinner}
                                            isRunnerUp={isSelectedTeamRunnerUp}
                                            divChamp={selectedTeamDivChamp}
                                        />
                                    )}

                                    {/* Program Re-brandings in this Season */}
                                    {season.rebrandEvents && season.rebrandEvents.length > 0 && (
                                        <div className="space-y-2">
                                            {season.rebrandEvents.map((rebrand, rIdx) => {
                                                const isSelectedTeamRebrand = selectedTeamId === rebrand.teamId;
                                                return (
                                                    <div
                                                        key={`rebrand-${season.id}-${rIdx}`}
                                                        className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans transition-all ${
                                                            isSelectedTeamRebrand
                                                                ? 'bg-amber-50 border-2 border-amber-500 shadow-sm'
                                                                : 'bg-purple-50/70 border-purple-200 text-purple-950'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0 ${
                                                                isSelectedTeamRebrand
                                                                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                                                                    : 'bg-purple-200 text-purple-900'
                                                            }`}>
                                                                🔄 Program Re-brand
                                                            </span>
                                                            <div className="font-medium truncate">
                                                                <span className="font-bold text-slate-900">{rebrand.fromName}</span>
                                                                <span className="mx-1.5 text-slate-400">&rarr;</span>
                                                                <span className="font-black text-purple-900">{rebrand.toName}</span>
                                                                {rebrand.toName !== rebrand.currentName && (
                                                                    <span className="ml-1 text-[11px] text-slate-500 font-normal">
                                                                        (now {rebrand.currentName})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {rebrand.teamId && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectTeam(rebrand.teamId)}
                                                                className="text-xs font-bold text-blue-700 hover:underline self-start sm:self-auto shrink-0"
                                                            >
                                                                View Team Timeline &rarr;
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Historical Context Milestone Box */}
                                    {season.milestone && (
                                        <div className="p-3.5 bg-amber-50/60 border-l-4 border-amber-500 text-slate-800 text-xs sm:text-sm italic font-serif leading-relaxed">
                                            &ldquo;{season.milestone}&rdquo;
                                        </div>
                                    )}

                                    {/* COVID / Season Interruption Notice (2019/20 or 2020/21) */}
                                    {season.statusNote && !season.nationalChampionship && (
                                        <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded text-rose-900 text-xs sm:text-sm font-sans flex items-start gap-3">
                                            <span className="text-xl">⚠️</span>
                                            <div>
                                                <strong className="block font-black uppercase tracking-wider mb-1">
                                                     Season Interrupted / Postseason Suspended
                                                </strong>
                                                <p className="leading-relaxed">{season.statusNote}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* National Championship Showcase Block */}
                                    {season.nationalChampionship && (
                                        <div className="space-y-2">
                                            {selectedTeamId && !isSelectedTeamWinner && !isSelectedTeamRunnerUp && (
                                                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500 font-sans">
                                                    <span>🏆</span>
                                                    <span>League Title Game ({season.nationalChampionship.titleName}):</span>
                                                </div>
                                            )}
                                            <ChampionshipCard game={season.nationalChampionship} highlightedTeamId={selectedTeamId} />
                                        </div>
                                    )}

                                    {/* Secondary Bowl Games (e.g. Challenge Trophy, National Trophy) */}
                                    {season.secondaryBowls.length > 0 && (
                                        <div className="space-y-2 pt-2">
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-400 font-sans block">
                                                Bowl Games & Secondary Finals ({season.secondaryBowls.length})
                                            </span>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {season.secondaryBowls.map((bowl) => (
                                                    <SecondaryBowlCard key={`bowl-${bowl.id}`} bowl={bowl} highlightedTeamId={selectedTeamId} />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Divisional / Conference Champions Section */}
                                    {season.divisionalChampions.length > 0 && (
                                        <div className="pt-2 border-t border-slate-100">
                                            <div className="flex items-center justify-between mb-3">
                                                <button
                                                    onClick={() => toggleDivisions(season.id)}
                                                    className="text-xs font-black uppercase tracking-wider text-slate-700 hover:text-blue-700 font-sans flex items-center gap-1.5"
                                                >
                                                    <span>🏆</span>
                                                    <span>Divisional & Conference Champions ({season.divisionalChampions.length})</span>
                                                    <span className="text-[10px] text-slate-400">{isDivOpen ? '▲ Hide' : '▼ Show'}</span>
                                                </button>
                                            </div>

                                            {isDivOpen && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                                                    {season.divisionalChampions.map((champ, idx) => {
                                                        const isChampSelected = selectedTeamId === champ.teamId;
                                                        return (
                                                            <div
                                                                key={`div-${season.id}-${idx}`}
                                                                className={`p-2.5 rounded border text-xs font-sans flex items-center justify-between gap-2 ${
                                                                    isChampSelected
                                                                        ? 'bg-blue-50 border-blue-500 font-bold'
                                                                        : 'bg-slate-50 border-slate-200'
                                                                }`}
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="font-bold text-slate-900 truncate">
                                                                        {champ.displayName}
                                                                        {champ.isRebranded && champ.canonicalName && (
                                                                            <span className="ml-1 text-[10px] font-normal text-slate-500 truncate">
                                                                                (now {champ.canonicalName})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500 truncate">
                                                                        {champ.parentPhaseName ? `${champ.parentPhaseName} • ` : ''}{champ.phaseName}
                                                                    </div>
                                                                </div>
                                                                {(champ.wins !== null && champ.wins !== undefined) && (
                                                                    <span className="text-[10px] font-mono text-slate-500 shrink-0 font-bold bg-white px-1.5 py-0.5 border rounded">
                                                                        {champ.wins}-{champ.losses ?? 0}-{champ.ties ?? 0}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Participating Teams Collapsible Drawer */}
                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-sans">
                                        <button
                                            onClick={() => toggleTeams(season.id)}
                                            className="text-slate-500 hover:text-slate-900 font-bold flex items-center gap-1"
                                        >
                                            <span>🏈</span>
                                            <span>{isTeamsOpen ? 'Hide participating teams' : `View all ${season.teamCount} teams`}</span>
                                        </button>
                                        <Link
                                            href={`/seasons/${season.id}`}
                                            className="text-blue-700 hover:underline font-bold"
                                        >
                                            View Standings &rarr;
                                        </Link>
                                    </div>

                                    {isTeamsOpen && (
                                        <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs font-sans">
                                            <div className="flex flex-wrap gap-1.5">
                                                {season.teams.map((t) => {
                                                    const isHighlighted = selectedTeamId === t.id;
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={`team-pill-${season.id}-${t.id}`}
                                                            onClick={() => handleSelectTeam(isHighlighted ? '' : t.id)}
                                                            title={t.isRebranded && t.canonicalName ? `Historical moniker (now ${t.canonicalName})` : undefined}
                                                            className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer text-left ${
                                                                isHighlighted
                                                                    ? 'bg-blue-700 text-white font-bold'
                                                                    : 'bg-white hover:bg-slate-100 border text-slate-700'
                                                            }`}
                                                        >
                                                            <span>{t.displayName}</span>
                                                            {t.isRebranded && t.canonicalName && (
                                                                <span className={`ml-1 text-[9px] ${isHighlighted ? 'text-blue-200' : 'text-slate-400'}`}>
                                                                    *
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Subcomponent: Selected Team Campaign Banner
function TeamCampaignBanner({
    team,
    season,
    seasonTeam,
    isWinner,
    isRunnerUp,
    divChamp
}: {
    team: TimelineTeamEntry;
    season: TimelineSeason;
    seasonTeam?: TimelineSeasonTeam;
    isWinner: boolean;
    isRunnerUp: boolean;
    divChamp?: TimelineDivisionalChampion;
}) {
    const hasRecord = seasonTeam && (seasonTeam.wins !== null || seasonTeam.losses !== null);
    const divisionName = seasonTeam?.phaseName
        ? `${seasonTeam.parentPhaseName ? `${seasonTeam.parentPhaseName} • ` : ''}${seasonTeam.phaseName}`
        : divChamp
            ? `${divChamp.parentPhaseName ? `${divChamp.parentPhaseName} • ` : ''}${divChamp.phaseName}`
            : null;

    let bannerBg = 'bg-blue-50/80 border-blue-300';
    let badgeText = '🏈 Season Campaign';
    let badgeStyle = 'bg-blue-100 text-blue-900 border border-blue-300';

    if (isWinner) {
        bannerBg = 'bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/5 border-amber-500';
        badgeText = '👑 National Champions';
        badgeStyle = 'bg-amber-400 text-slate-950 font-black shadow-sm';
    } else if (isRunnerUp) {
        bannerBg = 'bg-gradient-to-r from-slate-200 via-slate-100 to-slate-50 border-slate-400';
        badgeText = '🥈 National Finalists';
        badgeStyle = 'bg-slate-700 text-white font-black shadow-sm';
    } else if (divChamp) {
        bannerBg = 'bg-gradient-to-r from-blue-500/15 via-blue-400/10 to-transparent border-blue-500';
        badgeText = '🏆 Division Champions';
        badgeStyle = 'bg-blue-700 text-white font-black shadow-sm';
    }

    const seasonalName = seasonTeam?.displayName;
    const isDifferentMoniker = Boolean(
        seasonalName && seasonalName.toLowerCase() !== team.displayName.toLowerCase()
    );
    const displayLogo = seasonTeam?.logoUrl || team.logoUrl;

    return (
        <div className={`p-4 sm:p-5 rounded-lg border-2 shadow-sm ${bannerBg} flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all`}>
            <div className="flex items-center gap-3.5 min-w-0">
                {displayLogo ? (
                    <div className="w-12 h-12 bg-white rounded-full border-2 border-slate-900 p-1 shrink-0 overflow-hidden flex items-center justify-center shadow-sm">
                        <img src={displayLogo} alt={seasonalName || team.displayName} className="max-w-full max-h-full object-contain" />
                    </div>
                ) : (
                    <div className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                        {(seasonalName || team.displayName).slice(0, 2).toUpperCase()}
                    </div>
                )}
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded font-sans ${badgeStyle}`}>
                            {badgeText}
                        </span>
                        {divisionName && (
                            <span className="text-[11px] font-bold text-slate-600 font-sans truncate">
                                {divisionName}
                            </span>
                        )}
                        {isDifferentMoniker && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 font-sans">
                                🏷️ Competed as {seasonalName}
                            </span>
                        )}
                    </div>
                    <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-lg sm:text-xl font-black italic tracking-tight text-slate-950 truncate">
                            {seasonalName || team.displayName}
                        </span>
                        {isDifferentMoniker && (
                            <span className="text-xs text-slate-500 font-sans truncate font-medium">
                                (now {team.displayName})
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60">
                {hasRecord ? (
                    <div className="text-left sm:text-right">
                        <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-950">
                            {seasonTeam.wins ?? 0}&ndash;{seasonTeam.losses ?? 0}{seasonTeam.ties ? `&ndash;${seasonTeam.ties}` : ''}
                        </div>
                        {(seasonTeam.pointsFor !== null && seasonTeam.pointsFor !== undefined) && (
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-sans">
                                {seasonTeam.pointsFor} PF &bull; {seasonTeam.pointsAgainst ?? 0} PA
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans">
                        Roster Documented
                    </div>
                )}

                <Link
                    href={`/seasons/${season.id}`}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 rounded text-xs font-black uppercase tracking-wider font-sans transition-colors shadow-sm shrink-0"
                >
                    Standings &rarr;
                </Link>
            </div>
        </div>
    );
}

// Subcomponent: National Championship Card
function ChampionshipCard({
    game,
    highlightedTeamId
}: {
    game: TimelineBowlGame;
    highlightedTeamId?: string;
}) {
    const isTie = game.isTie;
    const isSpecial1985 = game.id === '1985-inaugural-champion';

    const isWinnerHighlighted = highlightedTeamId ? game.winner?.id === highlightedTeamId : false;
    const isRunnerUpHighlighted = highlightedTeamId ? game.runnerUp?.id === highlightedTeamId : false;

    return (
        <div className="p-5 sm:p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 text-white rounded-lg border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(234,179,8,1)] relative overflow-hidden">
            {/* Background watermarked crown */}
            <div className="absolute right-4 top-2 text-7xl font-black text-white/5 select-none pointer-events-none">
                🏆
            </div>

            {/* Top Bar: Bowl Name and Roman Numeral Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-mono text-xs font-black uppercase tracking-widest flex items-center gap-1">
                        <span>👑</span> National Championship
                    </span>
                    <span className="text-slate-500">&bull;</span>
                    <h3 className="text-base sm:text-lg font-black uppercase italic tracking-wider text-white">
                        {game.titleName}
                    </h3>
                </div>

                {/* Venue and Date Badge */}
                <div className="text-xs text-slate-400 font-sans flex items-center gap-3">
                    {game.venue && (
                        <span>📍 {game.venue.name}{game.venue.city ? `, ${game.venue.city}` : ''}</span>
                    )}
                    {game.date && (
                        <span>📅 {new Date(game.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    )}
                </div>
            </div>

            {/* Matchup Block */}
            {isTie ? (
                // 1987 Double-Overtime Co-Champions Tie
                <div className="space-y-3">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-center text-xs text-amber-300 font-sans">
                        🤝 <strong>Co-Champions:</strong> Game concluded in a 0&ndash;0 double-overtime tie. Both universities were crowned joint National Champions.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {game.coChampions.map((team, idx) => {
                            const isCoChampHighlighted = highlightedTeamId === team.id;
                            return (
                                <div
                                    key={`co-champ-${idx}`}
                                    className={`p-4 bg-slate-800/80 rounded border flex items-center justify-between transition-all ${
                                        isCoChampHighlighted
                                            ? 'border-amber-400 ring-2 ring-amber-400 bg-slate-800 scale-[1.01]'
                                            : 'border-amber-500/40'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-amber-400 text-slate-950 rounded-full flex items-center justify-center font-black text-xs shrink-0">
                                            🏆
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-amber-400 uppercase tracking-widest font-sans">Co-Champion</div>
                                            <div className="text-lg font-black italic">
                                                {team.displayName}
                                                {team.isRebranded && team.canonicalName && (
                                                    <span className="ml-1.5 text-xs font-normal text-amber-300/80 not-italic">
                                                        (now {team.canonicalName})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-2xl font-black font-mono text-amber-400">0</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : isSpecial1985 ? (
                // 1985 Inaugural Champion (No Bowl Game)
                <div className={`p-4 bg-slate-800/80 rounded border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                    isWinnerHighlighted ? 'border-amber-400 ring-2 ring-amber-400' : 'border-amber-400/50'
                }`}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-400 text-slate-950 rounded-full flex items-center justify-center font-black text-lg shrink-0">
                            👑
                        </div>
                        <div>
                            <div className="text-xs font-bold text-amber-400 uppercase tracking-widest font-sans">Inaugural League Champion</div>
                            <div className="text-xl sm:text-2xl font-black italic">
                                {game.winner?.displayName}
                                {game.winner?.isRebranded && game.winner?.canonicalName && (
                                    <span className="ml-2 text-xs font-normal text-amber-300/80 not-italic">
                                        (now {game.winner.canonicalName})
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-slate-400 font-sans mt-0.5">Undefeated 5&ndash;0 Inaugural Record</div>
                        </div>
                    </div>
                    <span className="text-xs text-slate-300 font-sans max-w-xs text-right italic">
                        Crowned champions by regular season standings; no postseason bowl was held.
                    </span>
                </div>
            ) : (
                // Standard Title Game Matchup
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                    {/* Champion Winner Block */}
                    <div className={`p-4 rounded-lg flex items-center justify-between shadow-inner transition-all ${
                        isWinnerHighlighted
                            ? 'bg-slate-800 border-2 border-amber-300 ring-4 ring-amber-400/80 scale-[1.01]'
                            : 'bg-slate-800/90 border-2 border-amber-400/80'
                    }`}>
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-12 h-12 bg-amber-400 text-slate-950 rounded-full flex items-center justify-center font-black text-lg shrink-0 shadow-sm">
                                👑
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-widest text-amber-400 font-sans">
                                    National Champions
                                </div>
                                <div className="text-xl sm:text-2xl font-black italic truncate leading-tight">
                                    {game.winner?.displayName}
                                </div>
                                {game.winner?.isRebranded && game.winner?.canonicalName && (
                                    <div className="text-[11px] font-sans text-amber-300/80 truncate">
                                        now {game.winner.canonicalName}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="text-3xl sm:text-4xl font-black font-mono text-amber-400 shrink-0 pl-3">
                            {game.winner?.score}
                        </div>
                    </div>

                    {/* Runner-Up Block */}
                    <div className={`p-4 rounded-lg border flex items-center justify-between transition-all ${
                        isRunnerUpHighlighted
                            ? 'bg-slate-800/90 border-blue-400 ring-4 ring-blue-400/80 scale-[1.01]'
                            : 'bg-slate-800/40 border-slate-700'
                    }`}>
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-10 h-10 bg-slate-700 text-slate-300 rounded-full flex items-center justify-center font-black text-sm shrink-0">
                                🥈
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-sans">
                                    National Finalist
                                </div>
                                <div className="text-lg sm:text-xl font-bold text-slate-300 italic truncate leading-tight">
                                    {game.runnerUp?.displayName}
                                </div>
                                {game.runnerUp?.isRebranded && game.runnerUp?.canonicalName && (
                                    <div className="text-[11px] font-sans text-slate-400 truncate">
                                        now {game.runnerUp.canonicalName}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black font-mono text-slate-400 shrink-0 pl-3">
                            {game.runnerUp?.score}
                        </div>
                    </div>
                </div>
            )}

            {/* Archival Notes Footer */}
            {game.notes && (
                <div className="mt-3 text-[11px] text-slate-400 font-sans italic border-t border-slate-800/60 pt-2">
                    {game.notes}
                </div>
            )}
        </div>
    );
}

// Subcomponent: Secondary Bowl Game Card (e.g. Challenge Trophy)
function SecondaryBowlCard({
    bowl,
    highlightedTeamId
}: {
    bowl: TimelineBowlGame;
    highlightedTeamId?: string;
}) {
    const isWinnerHighlighted = highlightedTeamId ? bowl.winner?.id === highlightedTeamId : false;
    const isRunnerUpHighlighted = highlightedTeamId ? bowl.runnerUp?.id === highlightedTeamId : false;
    const isCardHighlighted = isWinnerHighlighted || isRunnerUpHighlighted;

    return (
        <div className={`p-3 rounded text-xs font-sans space-y-1.5 transition-all ${
            isCardHighlighted
                ? 'bg-blue-50 border-2 border-blue-600 ring-1 ring-blue-500 shadow-sm'
                : 'bg-slate-50 border border-slate-200'
        }`}>
            <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-black tracking-wider">
                <span>🛡️ {bowl.titleName}</span>
                {bowl.date && <span>{new Date(bowl.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
            </div>
            <div className={`flex items-center justify-between font-bold ${isWinnerHighlighted ? 'text-blue-900 font-black' : 'text-slate-900'}`}>
                <span className="flex items-center gap-1.5 truncate mr-2">
                    <span className="text-amber-600">🏆</span>
                    <span className="truncate">
                        {bowl.winner?.displayName}
                        {bowl.winner?.isRebranded && bowl.winner?.canonicalName && (
                            <span className="ml-1 text-[10px] font-normal text-slate-500">
                                ({bowl.winner.canonicalName})
                            </span>
                        )}
                    </span>
                </span>
                <span className="font-mono font-black shrink-0">{bowl.winner?.score} &ndash; {bowl.runnerUp?.score}</span>
            </div>
            <div className={`text-[10px] pl-4 truncate ${isRunnerUpHighlighted ? 'text-blue-800 font-bold' : 'text-slate-500'}`}>
                def. {bowl.runnerUp?.displayName}
                {bowl.runnerUp?.isRebranded && bowl.runnerUp?.canonicalName && (
                    <span className="ml-1 font-normal text-slate-400">
                        ({bowl.runnerUp.canonicalName})
                    </span>
                )}
            </div>
        </div>
    );
}


