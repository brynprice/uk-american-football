import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import { resolveTeamIdentity } from '@/lib/utils/team-resolver';
import StandingsTable from '@/components/archive/StandingsTable';

export default async function PhasePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const phase = await ArchiveService.getPhaseData(id);

    // Determine if this is a playoff phase
    const isPlayoffPhase =
        phase.type === 'playoffs' ||
        phase.type?.toLowerCase().includes('playoff') ||
        phase.type === 'wild_card' ||
        phase.name.toLowerCase().includes('playoff') ||
        phase.name.toLowerCase().includes('knockout') ||
        (phase.games && phase.games.length > 0 && phase.games.every((g: any) => g.is_playoff));

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
                {/* Render standings tables for each child phase (or just this one if leaf) */}
                {!isPlayoffPhase && phase.childPhases && phase.childPhases.length > 0 && (
                    <div className="space-y-8">
                        {phase.childPhases.map((cp: any) => (
                            <StandingsTable
                                key={cp.id}
                                participations={cp.participations}
                                games={phase.games}
                                phaseName={phase.isLeaf ? "" : cp.name}
                            />
                        ))}
                    </div>
                )}

                {!phase.isLeaf && (
                    <div className="bg-slate-50 p-4 border-l-4 border-slate-900 text-sm italic text-slate-600 font-sans">
                        This is a container phase. Standings are displayed for each sub-phase. All results are aggregated below.
                    </div>
                )}

                {isPlayoffPhase && (
                    <div className="bg-amber-50 p-6 border border-amber-200 text-amber-900 font-sans shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="bg-amber-500 text-white text-xs font-black uppercase px-2 py-1 tracking-widest">Postseason</span>
                            <h3 className="font-bold text-lg">Knockout Phase</h3>
                        </div>
                        <p className="text-sm">Regular season standings do not apply to this phase. Game results and progression are listed below.</p>
                    </div>
                )}

                {/* Games Section */}
                <section>
                    <h2 className="text-xl font-bold mb-6 font-sans uppercase tracking-widest border-b-2 border-slate-900 pb-1">
                        {phase.isLeaf ? "Game Results" : "Combined Game Results"}
                    </h2>
                    <div className="space-y-4">
                        {phase.games?.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((game: any) => (
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
                                    {game.final_type === 'title' && game.title_name && (
                                        <span className="text-[10px] font-black bg-amber-500 text-white px-2 py-0.5 rounded uppercase shadow-sm">
                                            🏆 {game.title_name}
                                        </span>
                                    )}
                                    {game.final_type === 'bowl' && game.title_name && (
                                        <span className="text-[10px] font-black bg-blue-500 text-white px-2 py-0.5 rounded uppercase shadow-sm">
                                            🏈 {game.title_name}
                                        </span>
                                    )}
                                    {game.is_playoff && !game.final_type && (
                                        <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase">
                                            {game.playoff_round || "Postseason"}
                                        </span>
                                    )}
                                    {game.is_double_header && (
                                        <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase border border-amber-200">DH</span>
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
