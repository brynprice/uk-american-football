import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import { resolveHeadCoach } from '@/lib/utils/coach-resolver';
import { resolveTeamIdentity } from '@/lib/utils/team-resolver';

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const game = await ArchiveService.getGameDetails(id);

    const homeCoach = resolveHeadCoach(
        game.id,
        game.home_team_id,
        game.phase_id,
        game.game_staff.filter((s: any) => s.team_id === game.home_team_id),
        game.participations
    );

    const awayCoach = resolveHeadCoach(
        game.id,
        game.away_team_id,
        game.phase_id,
        game.game_staff.filter((s: any) => s.team_id === game.away_team_id),
        game.participations
    );

    const homeIdentity = resolveTeamIdentity(game.home_team, game.date);
    const awayIdentity = resolveTeamIdentity(game.away_team, game.date);

    return (
        <ArchiveLayout>
            <div className="mb-12">
                <Link href={`/seasons/${game.phase.season.id}`} className="text-blue-600 hover:underline text-sm mb-4 inline-block">
                    &larr; Back to {game.phase.season.year} {game.phase.season.competition.name}
                </Link>

                <div className="bg-white border-2 border-slate-900 shadow-xl overflow-hidden rounded">
                    {/* Game Header */}
                    <div className="bg-slate-900 text-white p-4 flex justify-between items-center font-sans tracking-widest text-xs uppercase">
                        <span>{game.date_display || (game.date ? new Date(game.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "Unknown Date")}</span>
                        <div className="flex items-center gap-2">
                            <span className="font-black">{game.phase.name}</span>
                            {game.is_double_header && (
                                <span className="bg-amber-400 text-slate-900 px-2 py-0.5 rounded text-[10px] font-black normal-case tracking-normal">Double Header</span>
                            )}
                        </div>
                        <span>{game.venue?.city || "Unknown Location"}</span>
                    </div>

                    {/* Scoreboard */}
                    <div className="p-8 grid grid-cols-3 items-center">
                        {/* Away Team */}
                        <div className="flex flex-col items-center">
                            {awayIdentity.logo_url && (
                                <div className="w-20 h-20 bg-white p-1 border border-slate-200 shadow-sm rounded mb-4 flex items-center justify-center overflow-hidden">
                                    <img src={awayIdentity.logo_url} alt={awayIdentity.name} className="max-w-full max-h-full object-contain" />
                                </div>
                            )}
                            <Link href={`/teams/${game.away_team_id}`} className="text-2xl font-black hover:text-blue-700">
                                {awayIdentity.name}
                            </Link>
                            <div className="text-xs text-slate-500 mt-2 font-sans uppercase">Visitor</div>
                        </div>

                        {/* Score */}
                        <div className="flex justify-center items-center gap-8">
                            <span className="text-6xl font-black">{game.away_score ?? "-"}</span>
                            <span className="text-2xl font-serif italic text-slate-300">at</span>
                            <span className="text-6xl font-black">{game.home_score ?? "-"}</span>
                        </div>

                        {/* Home Team */}
                        <div className="flex flex-col items-center">
                            {homeIdentity.logo_url && (
                                <div className="w-20 h-20 bg-white p-1 border border-slate-200 shadow-sm rounded mb-4 flex items-center justify-center overflow-hidden">
                                    <img src={homeIdentity.logo_url} alt={homeIdentity.name} className="max-w-full max-h-full object-contain" />
                                </div>
                            )}
                            <Link href={`/teams/${game.home_team_id}`} className="text-2xl font-black hover:text-blue-700">
                                {homeIdentity.name}
                            </Link>
                            <div className="text-xs text-slate-500 mt-2 font-sans uppercase">Home</div>
                        </div>
                    </div>

                    {/* Game Info Footer */}
                    <div className="border-t border-slate-100 p-6 bg-slate-50 grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                        <div>
                            <h4 className="font-black uppercase text-slate-400 mb-3 text-[10px] tracking-tighter">Coaching Staff</h4>
                            <div className="space-y-2 font-sans">
                                <div className="flex justify-between border-b border-slate-200 pb-1">
                                    <span className="text-slate-500">{homeIdentity.name} HC:</span>
                                    <span className="font-bold">{homeCoach?.display_name || "Unknown"}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 pb-1">
                                    <span className="text-slate-500">{awayIdentity.name} HC:</span>
                                    <span className="font-bold">{awayCoach?.display_name || "Unknown"}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-black uppercase text-slate-400 mb-3 text-[10px] tracking-tighter">Venue / Conditions</h4>
                            <div className="font-sans">
                                <p className="font-bold text-slate-700">{game.venue?.name || "Venue records missing"}</p>
                                <p className="text-slate-500">{game.venue?.city} {game.venue?.address}</p>
                                {game.notes && <p className="mt-2 italic text-slate-600 border-t pt-2 border-slate-200">{game.notes}</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sources & Accuracy */}
            <section className="mt-12 text-xs text-slate-400 font-sans border-t pt-4">
                <p className="mb-2 uppercase font-black tracking-widest">Archival Authenticity</p>
                <div className="flex gap-6">
                    <span>Confidence: <strong className="text-slate-600 uppercase italic">{game.confidence_level}</strong></span>
                    <span>Date Precision: <strong className="text-slate-600 uppercase italic">{game.date_precision}</strong></span>
                </div>
            </section>
        </ArchiveLayout>
    );
}
