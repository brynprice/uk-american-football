import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import H2HSelector from '@/components/archive/H2HSelector';

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [team, opponents] = await Promise.all([
        ArchiveService.getTeamHistory(id),
        ArchiveService.getTeamOpponents(id)
    ]);

    // Calculate Regular Season Statistics
    const calculateRegularSeasonStats = () => {
        const statsByPhase = new Map();

        // 1. Initialize stats from participations (Regular Season only)
        team.participations?.forEach((p: any) => {
            const isPlayoff = p.phase?.type?.toLowerCase() === 'playoffs' || p.phase?.name?.toLowerCase().includes('playoff');
            if (isPlayoff) return;

            statsByPhase.set(p.phase_id, {
                wins: p.wins || 0,
                losses: p.losses || 0,
                ties: p.ties || 0,
                pf: p.points_for || 0,
                pa: p.points_against || 0,
                hasManual: p.wins !== null && p.losses !== null
            });
        });

        // 2. Aggregate from games for phases that DON'T have manual stats
        team.games?.forEach((g: any) => {
            const isPlayoff = g.is_playoff || g.phase?.type === 'playoffs' || g.phase?.name.toLowerCase().includes('playoff');
            if (isPlayoff) return;
            if (g.status?.toLowerCase() !== 'completed' && g.status?.toLowerCase() !== 'awarded') return;

            const current = statsByPhase.get(g.phase_id);
            if (current?.hasManual) return; // Prioritize manual stats

            const isHome = g.home_team_id === id;
            const teamScore = isHome ? g.home_score : g.away_score;
            const oppScore = isHome ? g.away_score : g.home_score;
            const multiplier = g.is_double_header ? 2 : 1;

            if (teamScore === null || oppScore === null) return;

            const phaseStats = current || { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0 };

            phaseStats.pf += (teamScore * multiplier);
            phaseStats.pa += (oppScore * multiplier);

            if (teamScore > oppScore) phaseStats.wins += multiplier;
            else if (teamScore < oppScore) phaseStats.losses += multiplier;
            else phaseStats.ties += multiplier;

            statsByPhase.set(g.phase_id, phaseStats);
        });

        // 3. Sum everything
        return Array.from(statsByPhase.values()).reduce((acc, curr) => ({
            wins: acc.wins + curr.wins,
            losses: acc.losses + curr.losses,
            ties: acc.ties + curr.ties,
            pf: acc.pf + curr.pf,
            pa: acc.pa + curr.pa,
            gp: acc.gp + (curr.wins + curr.losses + curr.ties)
        }), { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, gp: 0 });
    };

    const calculatePlayoffStats = () => {
        const statsByPhase = new Map();

        // 1. Initialize stats from participations (Playoffs only)
        team.participations?.forEach((p: any) => {
            const isPlayoff = p.phase?.type?.toLowerCase() === 'playoffs' || p.phase?.name?.toLowerCase().includes('playoff');
            if (!isPlayoff) return;

            statsByPhase.set(p.phase_id, {
                wins: p.wins || 0,
                losses: p.losses || 0,
                ties: p.ties || 0,
                pf: p.points_for || 0,
                pa: p.points_against || 0,
                hasManual: p.wins !== null && p.losses !== null
            });
        });

        // 2. Aggregate from games for phases that DON'T have manual stats
        team.games?.forEach((g: any) => {
            const isPlayoff = g.is_playoff || g.phase?.type === 'playoffs' || g.phase?.name.toLowerCase().includes('playoff');
            if (!isPlayoff) return;
            if (g.status?.toLowerCase() !== 'completed' && g.status?.toLowerCase() !== 'awarded') return;

            const current = statsByPhase.get(g.phase_id);
            if (current?.hasManual) return; // Prioritize manual stats

            const isHome = g.home_team_id === id;
            const teamScore = isHome ? g.home_score : g.away_score;
            const oppScore = isHome ? g.away_score : g.home_score;
            const multiplier = g.is_double_header ? 2 : 1;

            if (teamScore === null || oppScore === null) return;

            const phaseStats = current || { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0 };

            phaseStats.pf += (teamScore * multiplier);
            phaseStats.pa += (oppScore * multiplier);

            if (teamScore > oppScore) phaseStats.wins += multiplier;
            else if (teamScore < oppScore) phaseStats.losses += multiplier;
            else phaseStats.ties += multiplier;

            statsByPhase.set(g.phase_id, phaseStats);
        });

        // 3. Sum everything
        return Array.from(statsByPhase.values()).reduce((acc, curr) => ({
            wins: acc.wins + curr.wins,
            losses: acc.losses + curr.losses,
            ties: acc.ties + curr.ties,
            pf: acc.pf + curr.pf,
            pa: acc.pa + curr.pa,
            gp: acc.gp + (curr.wins + curr.losses + curr.ties)
        }), { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, gp: 0 });
    };

    const stats = calculateRegularSeasonStats();
    const winPct = stats.gp > 0 ? (stats.wins / stats.gp + (1 - stats.losses / stats.gp)) / 2 : 0;

    const playoffStats = calculatePlayoffStats();
    const playoffWinPct = playoffStats.gp > 0 ? (playoffStats.wins / playoffStats.gp + (1 - playoffStats.losses / playoffStats.gp)) / 2 : 0;

    return (
        <ArchiveLayout>
            <div className="mb-12">
                <div className="flex flex-col md:flex-row gap-8 items-start md:items-center mb-8">
                    {team.logo_url && (
                        <div className="w-32 h-32 bg-white p-2 border border-slate-200 shadow-sm rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                            <img src={team.logo_url} alt={`${team.name} Logo`} className="max-w-full max-h-full object-contain" />
                        </div>
                    )}
                    <div className="flex-1">
                        <h1 className="text-5xl font-black mb-2">{team.name}</h1>
                        <div className="flex gap-4 items-center mb-4">
                            <span className="text-slate-500 font-sans uppercase tracking-widest text-xs">
                                {team.location} &bull; Founded {team.founded_year || "Unknown"}
                            </span>
                            {team.folded_year && (
                                <span className="bg-red-50 text-red-600 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-red-100 italic">
                                    Folded {team.folded_year}
                                </span>
                            )}
                        </div>

                        {/* Stats Banner */}
                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="bg-slate-900 text-white px-4 py-2 rounded-sm shadow-lg flex items-center gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">Regular Season</span>
                                    <span className="text-xl font-black tabular-nums">{stats.wins}-{stats.losses}{stats.ties > 0 ? `-${stats.ties}` : ''}</span>
                                </div>
                                <div className="w-px h-8 bg-slate-700" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">Win %</span>
                                    <span className="text-xl font-black tabular-nums text-blue-400">
                                        {winPct.toFixed(3).replace(/^0/, '')}
                                    </span>
                                </div>
                                <div className="hidden sm:flex flex-col">
                                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">Points For</span>
                                    <span className="text-xl font-black tabular-nums">{stats.pf}</span>
                                </div>
                                <div className="hidden sm:flex flex-col">
                                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">Points Against</span>
                                    <span className="text-xl font-black tabular-nums text-red-400">{stats.pa}</span>
                                </div>
                            </div>

                            {/* Playoff Stats Banner */}
                            {playoffStats.gp > 0 && (
                                <div className="bg-indigo-900 text-white px-4 py-2 rounded-sm shadow-lg flex items-center gap-6">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-black text-indigo-300 tracking-tighter">Playoffs</span>
                                        <span className="text-xl font-black tabular-nums">{playoffStats.wins}-{playoffStats.losses}{playoffStats.ties > 0 ? `-${playoffStats.ties}` : ''}</span>
                                    </div>
                                    <div className="w-px h-8 bg-indigo-700" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-black text-indigo-300 tracking-tighter">Win %</span>
                                        <span className="text-xl font-black tabular-nums text-indigo-200">
                                            {playoffWinPct.toFixed(3).replace(/^0/, '')}
                                        </span>
                                    </div>
                                    <div className="hidden sm:flex flex-col">
                                        <span className="text-[10px] uppercase font-black text-indigo-300 tracking-tighter">Points For</span>
                                        <span className="text-xl font-black tabular-nums">{playoffStats.pf}</span>
                                    </div>
                                    <div className="hidden sm:flex flex-col">
                                        <span className="text-[10px] uppercase font-black text-indigo-300 tracking-tighter">Points Against</span>
                                        <span className="text-xl font-black tabular-nums text-red-300">{playoffStats.pa}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                {/* Left Column: History Timeline */}
                <div className="md:col-span-2 space-y-8">
                    <section>
                        <h3 className="text-xl font-black uppercase border-b-2 border-slate-900 pb-2 mb-6 font-sans">Season History</h3>
                        <div className="space-y-4">
                            {team.participations?.sort((a: any, b: any) => b.phase.season.year - a.phase.season.year).map((p: any) => {
                                const isPlayoff = p.phase?.type?.toLowerCase() === 'playoffs' || p.phase.name.toLowerCase().includes('playoff');

                                return (
                                    <div key={p.id} className="flex gap-4 items-start group">
                                        <div className={`w-28 pt-1 text-sm font-black transition-colors ${isPlayoff ? 'text-indigo-400 group-hover:text-indigo-600' : 'text-slate-400 group-hover:text-blue-600'}`}>
                                            {p.phase.season.name || p.phase.season.year}
                                        </div>
                                        <div className={`flex-1 p-4 border shadow-sm border-l-4 transition-all ${isPlayoff
                                            ? 'bg-indigo-50 border-indigo-200 border-l-indigo-600 hover:border-l-indigo-800'
                                            : 'bg-white border-slate-200 border-l-slate-800 hover:border-l-blue-600'
                                            }`}>
                                            <div className="flex flex-col">
                                                <Link href={`/seasons/${p.phase.season.id}`} className={`font-bold hover:underline ${isPlayoff ? 'text-indigo-900' : 'text-slate-800 hover:text-blue-700'}`}>
                                                    {p.phase.season.competition.name}
                                                </Link>
                                                <Link href={`/phases/${p.phase.id}`} className={`text-[10px] uppercase font-black font-sans hover:underline mt-0.5 w-fit ${isPlayoff ? 'text-indigo-500 hover:text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
                                                    {p.phase.name}
                                                </Link>
                                            </div>
                                            {p.notes && <p className="text-xs text-slate-500 mt-2 italic font-serif">{p.notes}</p>}
                                        </div>
                                    </div>
                                );
                            })}

                            {(!team.participations || team.participations.length === 0) && (
                                <p className="text-slate-400 italic font-sans py-4">No seasonal records found for this team.</p>
                            )}
                        </div>
                    </section>

                    {/* Hall of Fame Section */}
                    {team.hall_of_fame && team.hall_of_fame.length > 0 && (
                        <section>
                            <h3 className="text-xl font-black uppercase border-b-2 border-slate-900 pb-2 mb-6 font-sans">Hall of Fame</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {team.hall_of_fame.sort((a: any, b: any) => (b.year_inducted || 0) - (a.year_inducted || 0)).map((hof: any) => (
                                    <div key={hof.id} className="bg-slate-50 p-4 border border-slate-200 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-slate-900 text-white flex items-center justify-center rotate-45 translate-x-8 -translate-y-8">
                                            <span className="text-[8px] font-black -rotate-45 uppercase translate-y-2">HOF</span>
                                        </div>
                                        <div className="font-bold text-lg mb-1 group-hover:text-blue-700 transition-colors">
                                            {hof.person_id ? (
                                                <Link href={`/people/${hof.person_id}`}>{hof.person_name}</Link>
                                            ) : (
                                                hof.person_name
                                            )}
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div className="text-xs text-slate-500 font-sans uppercase tracking-widest">
                                                Inducted {hof.year_inducted || "Unknown Year"}
                                            </div>
                                            {hof.seasons_with_team && (
                                                <div className="text-[10px] font-black bg-white px-2 py-0.5 rounded border border-slate-200 uppercase text-slate-400">
                                                    {hof.seasons_with_team}
                                                </div>
                                            )}
                                        </div>
                                        {hof.notes && <p className="text-[10px] text-slate-500 mt-2 italic border-t border-slate-100 pt-2">{hof.notes}</p>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Retired Jerseys Section */}
                    {team.retired_jerseys && team.retired_jerseys.length > 0 && (
                        <section>
                            <h3 className="text-xl font-black uppercase border-b-2 border-slate-900 pb-2 mb-6 font-sans">Retired Jerseys</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {team.retired_jerseys
                                    .sort((a: any, b: any) => {
                                        const numA = parseInt(a.jersey_number.replace(/\D/g, '')) || 0;
                                        const numB = parseInt(b.jersey_number.replace(/\D/g, '')) || 0;
                                        return numA - numB;
                                    })
                                    .map((rj: any) => (
                                        <div key={rj.id} className="flex gap-4 items-center bg-white p-4 border border-slate-200 shadow-sm">
                                            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center shrink-0 border-4 border-slate-100 shadow-inner">
                                                <span className="text-white text-2xl font-black font-mono">#{rj.jersey_number}</span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-[10px] font-black uppercase text-slate-400 font-sans tracking-widest mb-1">
                                                    Retired {rj.year_retired || "?"}
                                                </div>
                                                <div className="font-bold text-slate-800">
                                                    {rj.honoured_person_id ? (
                                                        <Link href={`/people/${rj.honoured_person_id}`} className="hover:text-blue-700">
                                                            {rj.person?.display_name || rj.honoured_person_name}
                                                        </Link>
                                                    ) : (
                                                        rj.honoured_person_name
                                                    )}
                                                </div>
                                                {rj.notes && <p className="text-[10px] text-slate-500 italic mt-1">{rj.notes}</p>}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Right Column: Metadata & Honours */}
                <div className="space-y-8">
                    {/* Honours Section */}
                    {(() => {
                        const finalGames = team.games?.filter((g: any) =>
                            (g.final_type === 'title' || g.final_type === 'bowl') && g.status?.toLowerCase() === 'completed'
                        ) || [];

                        const wonTitles = finalGames
                            .filter((g: any) => {
                                const isHome = g.home_team_id === id;
                                return isHome ? g.home_score >= g.away_score : g.away_score >= g.home_score;
                            })
                            .map((g: any) => ({ ...g, type: 'winner' }));

                        const runnerUpFinishes = finalGames
                            .filter((g: any) => {
                                const isHome = g.home_team_id === id;
                                return isHome ? g.home_score < g.away_score : g.away_score < g.home_score;
                            })
                            .map((g: any) => ({ ...g, type: 'runner-up' }));

                        if (wonTitles.length === 0 && runnerUpFinishes.length === 0) return null;

                        return (
                            <section className="bg-white p-6 border-2 border-slate-100 shadow-md rounded-lg relative overflow-hidden">
                                <h4 className="text-xs font-black uppercase text-slate-400 mb-6 tracking-tighter flex items-center gap-2">
                                    🏆 Major Honours
                                </h4>
                                <div className="space-y-6">
                                    {/* Winners */}
                                    {wonTitles.map((title: any, idx: number) => (
                                        <div key={`win-${idx}`} className="flex gap-3 items-center">
                                            <div className={`w-10 h-10 ${title.final_type === 'bowl' ? 'bg-blue-600' : 'bg-amber-500'} text-white rounded-full flex items-center justify-center shrink-0 shadow-sm border-2 border-white ring-1 ring-amber-200`}>
                                                <span className="text-[10px] font-black uppercase">{title.phase?.season?.year}</span>
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 leading-tight">{title.title_name}</div>
                                                <div className="text-[10px] text-amber-700 uppercase font-black font-sans tracking-wide">
                                                    Champion &bull; {title.phase?.season?.competition?.name}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Runner Ups */}
                                    {runnerUpFinishes.map((title: any, idx: number) => (
                                        <div key={`ru-${idx}`} className="flex gap-3 items-center opacity-85">
                                            <div className="w-10 h-10 bg-slate-300 text-slate-700 rounded-full flex items-center justify-center shrink-0 shadow-sm border-2 border-white ring-1 ring-slate-200">
                                                <span className="text-[10px] font-black uppercase">{title.phase?.season?.year}</span>
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-600 leading-tight">{title.title_name}</div>
                                                <div className="text-[10px] text-slate-400 uppercase font-black font-sans tracking-wide">
                                                    Runner Up &bull; {title.phase?.season?.competition?.name}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        );
                    })()}

                    <H2HSelector teamId={id} opponents={opponents} />

                    <section className="bg-white p-6 border border-slate-200 shadow-sm">
                        <h4 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-tighter">Known Aliases</h4>
                        <div className="space-y-3">
                            {team.team_aliases?.map((alias: any) => (
                                <div key={alias.id} className="text-sm border-l-2 border-slate-100 pl-3 flex items-center gap-4 py-2">
                                    {alias.logo_url && (
                                        <div className="w-8 h-8 bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden rounded shadow-sm">
                                            <img src={alias.logo_url} alt={`${alias.name} Logo`} className="max-w-full max-h-full object-contain" />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <div className="font-bold">{alias.name}</div>
                                        <div className="text-[10px] text-slate-400 uppercase font-sans">
                                            {alias.start_year || "?"} &mdash; {alias.end_year || "Present"}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {team.team_aliases?.length === 0 && <p className="text-xs text-slate-400 italic">No historical name changes recorded.</p>}
                        </div>
                    </section>

                    <section className="bg-slate-900 text-white p-6 rounded">
                        <h4 className="text-xs font-black uppercase text-blue-400 mb-4 tracking-tighter">Archive Profile</h4>
                        <div className="text-xs space-y-4 font-serif leading-relaxed opacity-80">
                            <p>{team.notes || "This team is a documented participant in British American Football history."}</p>
                        </div>
                    </section>
                </div>
            </div>
        </ArchiveLayout>
    );
}
