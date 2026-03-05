import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import { resolveTeamIdentity } from '@/lib/utils/team-resolver';

export default async function PhasePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const phase = await ArchiveService.getPhaseData(id);

    return (
        <ArchiveLayout>
            <div className="mb-8">
                <Link
                    href={`/seasons/${phase.season.id}`}
                    className="text-blue-600 hover:underline text-sm mb-4 inline-block"
                >
                    &larr; Back to {phase.season.year} {phase.season.competition.name}
                </Link>
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-black">{phase.name}</h1>
                    <div className="text-sm text-slate-500 font-sans uppercase tracking-widest">
                        {phase.type} &bull; {phase.games?.length || 0} Games {phase.isLeaf ? "in Phase" : "Rolled Up"}
                    </div>
                </div>
            </div>

            <div className="space-y-12">
                {/* Standings only for leaf phases */}
                {phase.isLeaf && phase.participations && phase.participations.length > 0 && (
                    <section>
                        <h2 className="text-xl font-bold mb-4 font-sans uppercase tracking-widest border-b-2 border-slate-900 pb-1">
                            Phase Standings
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse font-sans text-sm">
                                <thead>
                                    <tr className="border-b border-slate-300 bg-slate-50">
                                        <th className="py-2 px-4 font-black">Team</th>
                                        <th className="py-2 px-2 font-black text-center">GP</th>
                                        <th className="py-2 px-2 font-black text-center">W</th>
                                        <th className="py-2 px-2 font-black text-center">L</th>
                                        <th className="py-2 px-2 font-black text-center">T</th>
                                        <th className="py-2 px-2 font-black text-center">PF</th>
                                        <th className="py-2 px-2 font-black text-center">PA</th>
                                        <th className="py-2 px-2 font-black text-center">Win %</th>
                                        <th className="py-2 px-4 font-black">Head Coach</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const standings = phase.participations.map((p: any) => {
                                            const teamGames = phase.games.filter((g: any) =>
                                                g.status?.toLowerCase() === 'completed' &&
                                                (g.home_team_id === p.team_id || g.away_team_id === p.team_id)
                                            );

                                            let wins = 0, losses = 0, ties = 0, pf = 0, pa = 0;

                                            teamGames.forEach((g: any) => {
                                                const isHome = g.home_team_id === p.team_id;
                                                const score = isHome ? g.home_score : g.away_score;
                                                const oppScore = isHome ? g.away_score : g.home_score;

                                                if (score !== null && oppScore !== null) {
                                                    pf += score;
                                                    pa += oppScore;
                                                    if (score > oppScore) wins++;
                                                    else if (score < oppScore) losses++;
                                                    else ties++;
                                                }
                                            });

                                            const gp = wins + losses + ties;
                                            const winPct = gp > 0 ? (wins / gp + 1 - losses / gp) / 2 : 0;

                                            return { ...p, wins, losses, ties, pf, pa, gp, winPct };
                                        }).sort((a: any, b: any) => b.winPct - a.winPct || b.pf - a.pf);

                                        return standings.map((p: any) => (
                                            <tr key={p.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                                                <td className="py-3 px-4">
                                                    <Link href={`/teams/${p.team_id}`} className="font-bold hover:text-blue-600">
                                                        {resolveTeamIdentity({ ...p.team, team_aliases: p.team?.team_aliases || [] }, phase.games[0]?.date).name}
                                                    </Link>
                                                </td>
                                                <td className="py-3 px-2 text-center font-mono">{p.gp}</td>
                                                <td className="py-3 px-2 text-center font-bold">{p.wins}</td>
                                                <td className="py-3 px-2 text-center">{p.losses}</td>
                                                <td className="py-3 px-2 text-center text-slate-400">{p.ties}</td>
                                                <td className="py-3 px-2 text-center text-slate-600">{p.pf}</td>
                                                <td className="py-3 px-2 text-center text-slate-600">{p.pa}</td>
                                                <td className="py-3 px-2 text-center font-black text-blue-700">
                                                    {p.winPct.toFixed(3).replace(/^0/, '')}
                                                </td>
                                                <td className="py-3 px-4 text-slate-600 italic">
                                                    {p.person?.display_name || "Unknown"}
                                                </td>
                                            </tr>
                                        ));
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {!phase.isLeaf && (
                    <div className="bg-slate-50 p-4 border-l-4 border-slate-900 text-sm italic text-slate-600 font-sans">
                        This is a container phase. Standings are displayed at the individual group/division level. All results from child phases are aggregated below.
                    </div>
                )}

                {/* Games Section */}
                <section>
                    <h2 className="text-xl font-bold mb-6 font-sans uppercase tracking-widest border-b-2 border-slate-900 pb-1">
                        {phase.isLeaf ? "Game Results" : "Combined Game Results"}
                    </h2>
                    <div className="space-y-4">
                        {phase.games?.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((game: any) => (
                            <Link
                                key={game.id}
                                href={`/games/${game.id}`}
                                className="block bg-white border border-slate-200 p-4 hover:border-blue-500 transition-all shadow-sm"
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-sans text-slate-500 uppercase tracking-tighter">
                                            {game.date_display || (game.date ? new Date(game.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "Unknown Date")}
                                        </span>
                                        {!phase.isLeaf && (
                                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                                                {game.phase?.name}
                                            </span>
                                        )}
                                    </div>
                                    {game.is_playoff && (
                                        <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase">Postseason</span>
                                    )}
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex-1 flex items-center justify-end gap-3 pr-4 text-right">
                                        <span className="font-black text-lg">{resolveTeamIdentity(game.away_team, game.date).name}</span>
                                        {resolveTeamIdentity(game.away_team, game.date).logo_url && (
                                            <div className="w-8 h-8 bg-slate-50 p-1 flex items-center justify-center shrink-0 border border-slate-100 rounded">
                                                <img src={resolveTeamIdentity(game.away_team, game.date).logo_url!} alt="" className="max-w-full max-h-full object-contain" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 bg-slate-50 px-4 py-1 rounded border border-slate-100 font-black">
                                        <span className={game.away_score > game.home_score ? "text-blue-700" : ""}>
                                            {game.away_score ?? "-"}
                                        </span>
                                        <span className="text-slate-300 font-serif font-normal italic text-sm">at</span>
                                        <span className={game.home_score > game.away_score ? "text-blue-700" : ""}>
                                            {game.home_score ?? "-"}
                                        </span>
                                    </div>
                                    <div className="flex-1 flex items-center justify-start gap-3 pl-4 text-left">
                                        {resolveTeamIdentity(game.home_team, game.date).logo_url && (
                                            <div className="w-8 h-8 bg-slate-50 p-1 flex items-center justify-center shrink-0 border border-slate-100 rounded">
                                                <img src={resolveTeamIdentity(game.home_team, game.date).logo_url!} alt="" className="max-w-full max-h-full object-contain" />
                                            </div>
                                        )}
                                        <span className="font-black text-lg">{resolveTeamIdentity(game.home_team, game.date).name}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}

                        {(!phase.games || phase.games.length === 0) && (
                            <div className="p-12 text-center bg-white border border-dashed border-slate-300 rounded text-slate-400 font-sans italic">
                                No games recorded for this phase.
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </ArchiveLayout>
    );
}
