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
    const [expandedSeasons, setExpandedSeasons] = useState<Record<string, boolean>>({});

    const toggleSeason = (seasonId: string) => {
        setExpandedSeasons((prev) => ({
            ...prev,
            [seasonId]: !prev[seasonId]
        }));
    };

    // Helper to calculate stats and games for a given phase
    const getPhaseDetails = (p: any) => {
        const phaseId = p.phase_id || p.phase?.id;
        const phaseGames = (games || [])
            .filter((g: any) =>
                (g.phase_id === phaseId || g.away_phase_id === phaseId) &&
                (g.home_team_id === teamId || g.away_team_id === teamId) &&
                g.status?.toLowerCase() !== 'anomaly'
            )
            .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));

        let wins = p.wins;
        let losses = p.losses;
        let ties = p.ties || 0;
        let isManual = (wins !== null && losses !== null && wins !== undefined && losses !== undefined);

        if (!isManual) {
            wins = 0;
            losses = 0;
            ties = 0;
            let count = 0;
            phaseGames.forEach((g: any) => {
                const status = g.status?.toLowerCase();
                if (status !== 'completed' && status !== 'awarded') return;
                const isHome = g.home_team_id === teamId;
                const teamScore = isHome ? g.home_score : g.away_score;
                const oppScore = isHome ? g.away_score : g.home_score;
                const mult = g.is_double_header ? 2 : 1;

                if (teamScore !== null && oppScore !== null) {
                    count++;
                    if (teamScore > oppScore) wins += mult;
                    else if (teamScore < oppScore) losses += mult;
                    else ties += mult;
                }
            });
            if (count === 0 && (p.wins === null || p.wins === undefined)) {
                isManual = false;
            } else {
                isManual = true;
            }
        }

        return {
            phaseId,
            phaseGames,
            wins: wins || 0,
            losses: losses || 0,
            ties: ties || 0,
            hasStats: isManual
        };
    };

    // Group participations by Season
    const seasonMap = new Map<string, { season: any; participations: any[] }>();

    (participations || []).forEach((p: any) => {
        if (!p.phase || !p.phase.season) return;
        const seasonId = p.phase.season.id || `year-${p.phase.season.year}`;
        if (!seasonMap.has(seasonId)) {
            seasonMap.set(seasonId, {
                season: p.phase.season,
                participations: []
            });
        }
        seasonMap.get(seasonId)!.participations.push(p);
    });

    // Sort seasons descending by year
    const sortedSeasons = Array.from(seasonMap.entries()).sort((a, b) => {
        const yearA = a[1].season?.year || 0;
        const yearB = b[1].season?.year || 0;
        return yearB - yearA;
    });

    if (sortedSeasons.length === 0) {
        return <p className="text-slate-400 italic font-sans py-4">No seasonal records found for this team.</p>;
    }

    return (
        <div className="space-y-4">
            {sortedSeasons.map(([seasonKey, { season, participations: seasonParts }]) => {
                const isExpanded = !!expandedSeasons[seasonKey];

                // Separate Playoff and Regular Season phases
                const playoffParts = seasonParts.filter((p: any) => {
                    const type = p.phase?.type?.toLowerCase() || '';
                    const name = p.phase?.name?.toLowerCase() || '';
                    return type === 'playoffs' || name.includes('playoff');
                }).sort((a: any, b: any) => (a.phase?.ordinal || 0) - (b.phase?.ordinal || 0));

                const regParts = seasonParts.filter((p: any) => {
                    const type = p.phase?.type?.toLowerCase() || '';
                    const name = p.phase?.name?.toLowerCase() || '';
                    return type !== 'playoffs' && !name.includes('playoff');
                }).sort((a: any, b: any) => (a.phase?.ordinal || 0) - (b.phase?.ordinal || 0));

                // Process details for each phase
                const regDetails = regParts.map(p => ({ p, details: getPhaseDetails(p) }));
                const playoffDetails = playoffParts.map(p => ({ p, details: getPhaseDetails(p) }));

                // Calculate Aggregate Regular Season Record for this Season
                let regWins = 0, regLosses = 0, regTies = 0, regHasStats = false;
                regDetails.forEach(({ details }) => {
                    if (details.hasStats) {
                        regWins += details.wins;
                        regLosses += details.losses;
                        regTies += details.ties;
                        regHasStats = true;
                    }
                });

                // Calculate Aggregate Playoff Record for this Season
                let playoffWins = 0, playoffLosses = 0, playoffTies = 0, playoffHasStats = false;
                playoffDetails.forEach(({ details }) => {
                    if (details.hasStats) {
                        playoffWins += details.wins;
                        playoffLosses += details.losses;
                        playoffTies += details.ties;
                        playoffHasStats = true;
                    }
                });

                // Calculate total unique games count for the season
                const allSeasonGames = [
                    ...regDetails.flatMap(d => d.details.phaseGames),
                    ...playoffDetails.flatMap(d => d.details.phaseGames)
                ];
                const uniqueSeasonGames = Array.from(new Map(allSeasonGames.map(g => [g.id, g])).values());

                const seasonName = season?.name || (season?.year ? `${season.year} Season` : 'Season');

                return (
                    <div key={seasonKey} className="border border-slate-200 shadow-sm rounded-lg bg-white overflow-hidden transition-all">
                        {/* Season Details Card Header */}
                        <div className="p-4 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200">
                            <div className="flex flex-wrap items-center gap-3">
                                {/* Season Title */}
                                <div className="text-base font-black text-slate-900 font-sans">
                                    {seasonName}
                                </div>
                                {season?.id && season?.competition?.name && (
                                    <Link
                                        href={`/seasons/${season.id}`}
                                        className="text-xs font-bold text-slate-600 hover:text-blue-700 hover:underline"
                                    >
                                        {season.competition.name}
                                    </Link>
                                )}
                            </div>

                            {/* Stats Summary & Expand Toggle */}
                            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end mt-1 sm:mt-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    {/* Regular Season Record Badge */}
                                    {regHasStats ? (
                                        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300 text-xs shadow-2xs">
                                            <span className="text-[10px] font-black uppercase text-slate-400 font-sans tracking-wider">Reg Season:</span>
                                            <span className="font-mono font-bold text-slate-800">
                                                {regWins}-{regLosses}{regTies > 0 ? `-${regTies}` : ''}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-200 text-xs">
                                            <span className="text-[10px] font-black uppercase text-slate-400 font-sans tracking-wider">Reg Season:</span>
                                            <span className="font-mono text-slate-400 text-xs">N/A</span>
                                        </div>
                                    )}

                                    {/* Playoff Record Badge */}
                                    {playoffParts.length > 0 && (
                                        <div className="flex items-center gap-1.5 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200 text-xs">
                                            <span className="text-[10px] font-black uppercase text-indigo-500 font-sans tracking-wider">Playoffs:</span>
                                            <span className="font-mono font-bold text-indigo-900">
                                                {playoffHasStats ? `${playoffWins}-${playoffLosses}${playoffTies > 0 ? `-${playoffTies}` : ''}` : 'Qualified'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Toggle Button */}
                                <button
                                    onClick={() => toggleSeason(seasonKey)}
                                    className={`text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded transition-colors font-sans flex items-center gap-1.5 shrink-0 ${
                                        isExpanded
                                            ? 'bg-slate-900 text-white'
                                            : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                                    }`}
                                >
                                    <span>{isExpanded ? 'Hide Details' : `Show Details (${uniqueSeasonGames.length})`}</span>
                                    <span className="text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Expanded Season Details */}
                        {isExpanded && (
                            <div className="p-4 space-y-6 bg-slate-50/50">
                                {/* Playoff Phases */}
                                {playoffDetails.map(({ p, details }) => (
                                    <div key={p.id} className="bg-indigo-50/40 p-4 border border-indigo-200 border-l-4 border-l-indigo-600 rounded-r shadow-xs">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                                            <div>
                                                <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-600 text-white px-2 py-0.5 rounded font-sans">
                                                    Playoff Phase
                                                </span>
                                                {p.phase?.id && p.phase?.name && (
                                                    <h4 className="text-sm font-bold text-indigo-950 hover:underline mt-1">
                                                        <Link href={`/phases/${p.phase.id}`}>{p.phase.name}</Link>
                                                    </h4>
                                                )}
                                            </div>
                                            {details.hasStats && (
                                                <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 border border-indigo-200 rounded text-indigo-900">
                                                    {details.wins}-{details.losses}{details.ties > 0 ? `-${details.ties}` : ''}
                                                </span>
                                            )}
                                        </div>

                                        {p.notes && <p className="text-xs text-indigo-800/80 mb-3 italic font-serif">{p.notes}</p>}

                                        {/* Playoff Game Log */}
                                        {details.phaseGames.length > 0 ? (
                                            <div className="space-y-2">
                                                {details.phaseGames.map((game: any) => (
                                                    <GameRow key={game.id} game={game} teamId={teamId} seasonYear={season?.year} />
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-indigo-500 italic font-sans">No detailed game logs recorded for this playoff phase.</p>
                                        )}
                                    </div>
                                ))}

                                {/* Regular Season Phases */}
                                {regDetails.map(({ p, details }) => (
                                    <div key={p.id} className="bg-white p-4 border border-slate-200 border-l-4 border-l-slate-800 rounded-r shadow-xs">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                                            <div>
                                                <span className="text-[9px] font-black uppercase tracking-wider bg-slate-800 text-white px-2 py-0.5 rounded font-sans">
                                                    Regular Season Phase
                                                </span>
                                                {p.phase?.id && p.phase?.name && (
                                                    <h4 className="text-sm font-bold text-slate-900 hover:underline mt-1">
                                                        <Link href={`/phases/${p.phase.id}`}>{p.phase.name}</Link>
                                                    </h4>
                                                )}
                                            </div>
                                            {details.hasStats && (
                                                <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-0.5 border border-slate-200 rounded text-slate-800">
                                                    {details.wins}-{details.losses}{details.ties > 0 ? `-${details.ties}` : ''}
                                                </span>
                                            )}
                                        </div>

                                        {p.notes && <p className="text-xs text-slate-500 mb-3 italic font-serif">{p.notes}</p>}

                                        {/* Regular Season Game Log */}
                                        {details.phaseGames.length > 0 ? (
                                            <div className="space-y-2">
                                                {details.phaseGames.map((game: any) => (
                                                    <GameRow key={game.id} game={game} teamId={teamId} seasonYear={season?.year} />
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic font-sans">No detailed game logs recorded for this phase.</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// Sub-component for individual game row
function GameRow({ game, teamId, seasonYear }: { game: any; teamId: string; seasonYear?: number }) {
    const isHome = game.home_team_id === teamId;
    const opponent = isHome ? game.away_team : game.home_team;
    const year = seasonYear || (game.date ? new Date(game.date).getFullYear() : 0);
    const oppIdentity = opponent ? resolveTeamIdentity(opponent, year) : { name: 'Unknown', logo_url: null };

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
        <div className="bg-white p-3 border border-slate-200 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
            {/* Left: Opponent & Home/Away */}
            <div className="flex items-center gap-3 min-w-0">
                <span className="text-[10px] font-bold uppercase text-slate-400 w-8 shrink-0">
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
}
