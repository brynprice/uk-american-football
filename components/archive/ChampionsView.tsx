'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ChampionsViewProps {
    competition: any;
    allCompetitions: any[];
    champions: any[];
    leaderboard: any[];
}

export default function ChampionsView({
    competition,
    allCompetitions,
    champions,
    leaderboard
}: ChampionsViewProps) {
    const router = useRouter();
    const [filterType, setFilterType] = useState<'all' | 'title' | 'bowl'>('all');

    const filteredChampions = champions.filter((c) => {
        if (filterType === 'title') return c.finalType === 'title';
        if (filterType === 'bowl') return c.finalType === 'bowl';
        return true;
    });

    const titleCount = champions.filter((c) => c.finalType === 'title').length;
    const bowlCount = champions.filter((c) => c.finalType === 'bowl').length;

    return (
        <div className="space-y-10">
            {/* Top Navigation & Competition Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-4 border-slate-900 pb-6">
                <div>
                    <Link
                        href={`/competitions/${competition.id}`}
                        className="text-xs font-black uppercase text-blue-600 hover:underline tracking-widest mb-2 inline-block font-sans"
                    >
                        &larr; Back to {competition.name}
                    </Link>
                    <h1 className="text-4xl sm:text-5xl font-black uppercase italic tracking-tight">
                        {competition.name}
                    </h1>
                    <p className="text-slate-500 font-sans text-sm mt-1 uppercase tracking-wider font-bold">
                        🏆 Roll of Honour & Bowl Game Winners
                    </p>
                </div>

                {/* Competition Switcher Dropdown */}
                <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-lg border border-slate-200">
                    <label htmlFor="league-select" className="text-xs font-black uppercase text-slate-500 font-sans whitespace-nowrap pl-2">
                        Switch League:
                    </label>
                    <select
                        id="league-select"
                        value={competition.id}
                        onChange={(e) => router.push(`/competitions/${e.target.value}/champions`)}
                        className="bg-white border border-slate-300 font-bold text-xs uppercase px-3 py-1.5 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                        {allCompetitions.map((comp) => (
                            <option key={comp.id} value={comp.id}>
                                {comp.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Leaderboard & Stats Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Stats Cards */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-slate-900 text-white p-6 rounded-lg shadow-md border-l-8 border-amber-400">
                        <div className="text-xs font-black uppercase tracking-widest text-amber-400 mb-1 font-sans">
                            Total Champions Recorded
                        </div>
                        <div className="text-4xl font-black">{champions.length}</div>
                        <div className="text-xs text-slate-400 mt-2 font-sans flex gap-4">
                            <span>🏆 {titleCount} National Titles</span>
                            <span>🏈 {bowlCount} Bowl Games</span>
                        </div>
                    </div>

                    {/* Top Winners Leaderboard */}
                    {leaderboard.length > 0 && (
                        <div className="bg-white p-6 border-2 border-slate-200 rounded-lg shadow-sm">
                            <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-4 font-sans border-b pb-2 flex items-center justify-between">
                                <span>Most Titles in League</span>
                                <span>Wins</span>
                            </h3>
                            <div className="space-y-3">
                                {leaderboard.slice(0, 5).map((item, idx) => (
                                    <div key={item.teamId} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="font-mono text-xs font-black text-slate-400 w-4">
                                                #{idx + 1}
                                            </span>
                                            {item.logoUrl ? (
                                                <img
                                                    src={item.logoUrl}
                                                    alt=""
                                                    className="w-6 h-6 object-contain shrink-0 rounded bg-slate-50 p-0.5 border"
                                                />
                                            ) : (
                                                <div className="w-6 h-6 bg-slate-100 rounded shrink-0 flex items-center justify-center text-[8px] font-black text-slate-400">
                                                    LOGO
                                                </div>
                                            )}
                                            <Link
                                                href={`/teams/${item.teamId}`}
                                                className="font-bold text-slate-800 hover:text-blue-700 truncate"
                                            >
                                                {item.name}
                                            </Link>
                                        </div>
                                        <div className="flex items-center gap-1 font-black text-xs shrink-0">
                                            {item.titlesCount > 0 && (
                                                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                                                    {item.titlesCount} {item.titlesCount === 1 ? 'Title' : 'Titles'}
                                                </span>
                                            )}
                                            {item.bowlsCount > 0 && (
                                                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                                                    {item.bowlsCount} {item.bowlsCount === 1 ? 'Bowl' : 'Bowls'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Roll of Honour List */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Filter Tabs */}
                    <div className="flex items-center justify-between bg-slate-100 p-1.5 rounded-lg border border-slate-200 font-sans">
                        <div className="flex gap-1">
                            <button
                                onClick={() => setFilterType('all')}
                                className={`px-4 py-1.5 rounded text-xs font-black uppercase transition-all ${
                                    filterType === 'all'
                                        ? 'bg-slate-900 text-white shadow'
                                        : 'text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                All Finals ({champions.length})
                            </button>
                            <button
                                onClick={() => setFilterType('title')}
                                className={`px-4 py-1.5 rounded text-xs font-black uppercase transition-all ${
                                    filterType === 'title'
                                        ? 'bg-amber-500 text-slate-950 shadow'
                                        : 'text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Title Games ({titleCount})
                            </button>
                            <button
                                onClick={() => setFilterType('bowl')}
                                className={`px-4 py-1.5 rounded text-xs font-black uppercase transition-all ${
                                    filterType === 'bowl'
                                        ? 'bg-blue-600 text-white shadow'
                                        : 'text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Bowl Games ({bowlCount})
                            </button>
                        </div>
                    </div>

                    {/* Timeline of Title Games */}
                    <div className="space-y-4">
                        {filteredChampions.map((item) => (
                            <div
                                key={item.id}
                                className={`bg-white border-2 rounded-lg p-6 shadow-sm transition-all hover:shadow-md ${
                                    item.finalType === 'bowl'
                                        ? 'border-blue-200 border-l-8 border-l-blue-600'
                                        : 'border-amber-200 border-l-8 border-l-amber-500'
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-black font-sans uppercase bg-slate-900 text-white px-2.5 py-1 rounded">
                                            {item.seasonName}
                                        </span>
                                        <h3 className="text-lg font-black text-slate-900">{item.titleName}</h3>
                                    </div>
                                    <div className="text-xs text-slate-400 font-sans font-semibold">
                                        {item.date || item.seasonYear} {item.venue?.city ? `• ${item.venue.city}` : ''}
                                    </div>
                                </div>

                                {/* Matchup Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Winner */}
                                    <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-lg flex items-center gap-4 relative overflow-hidden">
                                        <div className="w-12 h-12 bg-white border border-amber-200 rounded p-1 flex items-center justify-center shrink-0 shadow-sm">
                                            {item.winner.displayLogo ? (
                                                <img
                                                    src={item.winner.displayLogo}
                                                    alt={`${item.winner.displayName} Logo`}
                                                    className="max-w-full max-h-full object-contain"
                                                />
                                            ) : (
                                                <span className="text-[9px] font-black text-slate-300">NO LOGO</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] font-black uppercase text-amber-700 tracking-wider font-sans flex items-center gap-1">
                                                <span>🏆 CHAMPION</span>
                                            </div>
                                            <Link
                                                href={`/teams/${item.winner.id}`}
                                                className="font-black text-slate-900 hover:text-blue-700 truncate block text-base leading-tight"
                                            >
                                                {item.winner.displayName}
                                            </Link>
                                        </div>
                                        <div className="text-2xl font-black font-mono text-slate-900 shrink-0">
                                            {item.winner.score}
                                        </div>
                                    </div>

                                    {/* Runner Up */}
                                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex items-center gap-4 relative overflow-hidden">
                                        <div className="w-12 h-12 bg-white border border-slate-200 rounded p-1 flex items-center justify-center shrink-0 shadow-sm">
                                            {item.runnerUp.displayLogo ? (
                                                <img
                                                    src={item.runnerUp.displayLogo}
                                                    alt={`${item.runnerUp.displayName} Logo`}
                                                    className="max-w-full max-h-full object-contain"
                                                />
                                            ) : (
                                                <span className="text-[9px] font-black text-slate-300">NO LOGO</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-sans">
                                                RUNNER UP
                                            </div>
                                            <Link
                                                href={`/teams/${item.runnerUp.id}`}
                                                className="font-bold text-slate-700 hover:text-blue-700 truncate block text-base leading-tight"
                                            >
                                                {item.runnerUp.displayName}
                                            </Link>
                                        </div>
                                        <div className="text-2xl font-black font-mono text-slate-500 shrink-0">
                                            {item.runnerUp.score}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 pt-2 text-right">
                                    <Link
                                        href={`/games/${item.id}`}
                                        className="text-xs font-black uppercase text-blue-600 hover:underline font-sans"
                                    >
                                        View Game Details &rarr;
                                    </Link>
                                </div>
                            </div>
                        ))}

                        {filteredChampions.length === 0 && (
                            <div className="p-12 text-center bg-white border border-dashed border-slate-300 rounded-lg">
                                <p className="text-slate-400 font-sans italic">
                                    No champions or bowl games recorded matching this filter.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
