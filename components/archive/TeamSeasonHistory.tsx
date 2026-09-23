'use client';

import { useState } from 'react';
import Link from 'next/link';
import { resolveTeamIdentity } from '@/lib/utils/team-resolver';

interface TeamSeasonHistoryProps {
    teamId: string;
    participations: any[];
    games: any[];
}

export default function TeamSeasonHistory({
    teamId,
    participations,
    games
}: TeamSeasonHistoryProps) {
    const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});

    const togglePhase = (phaseId: string) => {
        setExpandedPhases((prev) => ({
            ...prev,
            [phaseId]: !prev[phaseId]
        }));
    };

    // Filter and sort participations (Year desc -> Playoffs first -> Ordinal asc)
    const sortedParticipations = (participations || [])
        .filter((p: any) => p.phase && p.phase.season)
        .sort((a: any, b: any) => {
            const yearA = a.phase?.season?.year || 0;
            const yearB = b.phase?.season?.year || 0;

            if (yearA !== yearB) {
                return yearB - yearA;
            }

            const isPlayoffA = a.phase?.type?.toLowerCase() === 'playoffs' || a.phase?.name?.toLowerCase().includes('playoff');
            const isPlayoffB = b.phase?.type?.toLowerCase() === 'playoffs' || b.phase?.name?.toLowerCase().includes('playoff');

            if (isPlayoffA && !isPlayoffB) return -1;
            if (!isPlayoffA && isPlayoffB) return 1;

            return (a.phase?.ordinal || 0) - (b.phase?.ordinal || 0);
        });

    if (sortedParticipations.length === 0) {
        return <p className="text-slate-400 italic font-sans py-4">No seasonal records found for this team.</p>;
    }

    return (
        <div className="space-y-4">
            {sortedParticipations.map((p: any) => {
                const phaseId = p.phase_id || p.phase?.id;
                const isPlayoff = p.phase?.type?.toLowerCase() === 'playoffs' || p.phase?.name?.toLowerCase().includes('playoff');
                const isExpanded = !!expandedPhases[phaseId];

                // Find all games belonging to this phase for this team
                const phaseGames = (games || [])
                    .filter((g: any) =>
                        (g.phase_id === phaseId || g.away_phase_id === phaseId) &&
                        (g.home_team_id === teamId || g.away_team_id === teamId) &&
                        g.status?.toLowerCase() !== 'anomaly'
                    )
                    .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));

                return (
                    <div key={p.id} className="flex flex-col sm:flex-row gap-4 items-start group">
                        {/* Season Badge */}
                        <div className={`w-28 pt-1 text-sm font-black shrink-0 transition-colors ${
                            isPlayoff ? 'text-indigo-400 group-hover:text-indigo-600' : 'text-slate-400 group-hover:text-blue-600'
                        }`}>
                            {p.phase?.season?.name || p.phase?.season?.year}
                        </div>

                        {/* Phase Card */}
                        <div className={`flex-1 w-full p-4 border shadow-sm border-l-4 transition-all rounded-r ${
                            isPlayoff
                                ? 'bg-indigo-50/50 border-indigo-200 border-l-indigo-600'
                                : 'bg-white border-slate-200 border-l-slate-800'
                        }`}>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div className="flex flex-col">
                                    {p.phase?.season?.id && p.phase?.season?.competition?.name && (
                                        <Link
                                            href={`/seasons/${p.phase.season.id}`}
                                            className={`font-bold hover:underline ${isPlayoff ? 'text-indigo-900' : 'text-slate-800 hover:text-blue-700'}`}
                                        >
                                            {p.phase.season.competition.name}
                                        </Link>
                                    )}
                                    {p.phase?.id && p.phase?.name && (
                                        <Link
                                            href={`/phases/${p.phase.id}`}
                                            className={`text-[10px] uppercase font-black font-sans hover:underline mt-0.5 w-fit ${
                                                isPlayoff ? 'text-indigo-500 hover:text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            {p.phase.name}
                                        </Link>
                                    )}
                                </div>

                                {/* Manual Stats or Expand Toggle */}
                                <div className="flex items-center gap-3 shrink-0 mt-2 sm:mt-0">
                                    {(p.wins !== null && p.losses !== null) && (
                                        <span className="text-xs font-mono font-bold bg-white/80 px-2 py-0.5 border border-slate-200 rounded text-slate-700">
                                            {p.wins}-{p.losses}{p.ties ? `-${p.ties}` : ''}
                                        </span>
                                    )}

                                    {phaseGames.length > 0 && (
                                        <button
                                            onClick={() => togglePhase(phaseId)}
                                            className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded transition-colors font-sans flex items-center gap-1.5 ${
                                                isExpanded
                                                    ? 'bg-slate-900 text-white'
                                                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                                            }`}
                                        >
                                            <span>{isExpanded ? 'Hide Games' : `Show Games (${phaseGames.length})`}</span>
                                            <span className="text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {p.notes && <p className="text-xs text-slate-500 mt-2 italic font-serif">{p.notes}</p>}

                            {/* Expandable Games List */}
                            {isExpanded && phaseGames.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-2">
                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-sans mb-2">
                                        Phase Game Log ({phaseGames.length} {phaseGames.length === 1 ? 'Game' : 'Games'})
                                    </div>
                                    {phaseGames.map((game: any) => {
                                        const isHome = game.home_team_id === teamId;
                                        const opponent = isHome ? game.away_team : game.home_team;
                                        const seasonYear = p.phase?.season?.year || (game.date ? new Date(game.date).getFullYear() : 0);
                                        const oppIdentity = opponent ? resolveTeamIdentity(opponent, seasonYear) : { name: 'Unknown', logo_url: null };

                                        const teamScore = isHome ? game.home_score : game.away_score;
                                        const oppScore = isHome ? game.away_score : game.home_score;
                                        const isCompleted = game.status?.toLowerCase() === 'completed' || game.status?.toLowerCase() === 'awarded';

                                        let resultBadge = null;
                                        if (isCompleted && teamScore !== null && oppScore !== null) {
                                            if (teamScore > oppScore) {
                                                resultBadge = (
                                                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-emerald-200 font-sans">
                                                        W {teamScore}-{oppScore}
                                                    </span>
                                                );
                                            } else if (teamScore < oppScore) {
                                                resultBadge = (
                                                    <span className="bg-red-100 text-red-800 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-red-200 font-sans">
                                                        L {teamScore}-{oppScore}
                                                    </span>
                                                );
                                            } else {
                                                resultBadge = (
                                                    <span className="bg-slate-200 text-slate-700 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-slate-300 font-sans">
                                                        T {teamScore}-{oppScore}
                                                    </span>
                                                );
                                            }
                                        }

                                        return (
                                            <div
                                                key={game.id}
                                                className="bg-white p-3 border border-slate-200 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                            >
                                                {/* Left: Opponent & Home/Away */}
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="text-[10px] font-bold uppercase text-slate-400 w-8">
                                                        {isHome ? 'VS' : '@'}
                                                    </span>
                                                    {oppIdentity.logo_url ? (
                                                        <img
                                                            src={oppIdentity.logo_url}
                                                            alt=""
                                                            className="w-6 h-6 object-contain shrink-0 rounded bg-slate-50 p-0.5 border"
                                                        />
                                                    ) : (
                                                        <div className="w-6 h-6 bg-slate-100 rounded shrink-0 flex items-center justify-center text-[8px] font-black text-slate-300">
                                                            LOGO
                                                        </div>
                                                    )}
                                                    {opponent?.id ? (
                                                        <Link
                                                            href={`/teams/${opponent.id}`}
                                                            className="font-bold text-slate-800 hover:text-blue-700 truncate"
                                                        >
                                                            {oppIdentity.name}
                                                        </Link>
                                                    ) : (
                                                        <span className="font-bold text-slate-800 truncate">{oppIdentity.name}</span>
                                                    )}
                                                </div>

                                                {/* Right: Badges & Game Link */}
                                                <div className="flex items-center gap-3 shrink-0">
                                                    {game.is_double_header && (
                                                        <span className="bg-amber-100 text-amber-800 text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-amber-200">
                                                            DH x2
                                                        </span>
                                                    )}
                                                    {game.title_name && (
                                                        <span className="bg-indigo-100 text-indigo-800 text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-indigo-200">
                                                            {game.title_name}
                                                        </span>
                                                    )}
                                                    {resultBadge}
                                                    <span className="text-[10px] text-slate-400 font-sans">
                                                        {game.date || 'Date TBD'}
                                                    </span>
                                                    <Link
                                                        href={`/games/${game.id}`}
                                                        className="text-blue-600 font-black uppercase text-[10px] hover:underline"
                                                    >
                                                        Details &rarr;
                                                    </Link>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
