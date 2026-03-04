import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';

export default async function PhasePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const phase = await ArchiveService.getPhaseData(id);

    return (
        <ArchiveLayout>
            <div className="mb-8">
                <Link
                    href={`/seasons/${phase.season_id}`}
                    className="text-blue-600 hover:underline text-sm mb-4 inline-block"
                >
                    &larr; Back to {phase.name}
                </Link>
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-black">{phase.name}</h1>
                    <div className="text-sm text-slate-500 font-sans uppercase tracking-widest">
                        {phase.type} &bull; {phase.games?.length || 0} Games Recorded
                    </div>
                </div>
            </div>

            <div className="space-y-12">
                {/* Standings Placeholder if teams exist */}
                {phase.participations && phase.participations.length > 0 && (
                    <section>
                        <h2 className="text-xl font-bold mb-4 font-sans uppercase tracking-widest border-b-2 border-slate-900 pb-1">
                            Current Standings
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse font-sans text-sm">
                                <thead>
                                    <tr className="border-b border-slate-300">
                                        <th className="py-2 px-4 font-black">Team</th>
                                        <th className="py-2 px-4 font-black">Head Coach</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {phase.participations.map((p: any) => (
                                        <tr key={p.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                                            <td className="py-3 px-4">
                                                <Link href={`/teams/${p.team_id}`} className="font-bold hover:text-blue-600">
                                                    {p.team?.name}
                                                </Link>
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 italic">
                                                {p.person?.display_name || "Unknown"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* Games Section */}
                <section>
                    <h2 className="text-xl font-bold mb-6 font-sans uppercase tracking-widest border-b-2 border-slate-900 pb-1">
                        Game Results
                    </h2>
                    <div className="space-y-4">
                        {phase.games?.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((game: any) => (
                            <Link
                                key={game.id}
                                href={`/games/${game.id}`}
                                className="block bg-white border border-slate-200 p-4 hover:border-blue-500 transition-all shadow-sm"
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-sans text-slate-500 uppercase tracking-tighter">
                                        {game.date_display || (game.date ? new Date(game.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "Unknown Date")}
                                    </span>
                                    {game.is_playoff && (
                                        <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase">Postseason</span>
                                    )}
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex-1 text-center pr-4">
                                        <span className="font-black text-lg">{game.away_team?.name}</span>
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
                                    <div className="flex-1 text-center pl-4">
                                        <span className="font-black text-lg">{game.home_team?.name}</span>
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
