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

    const homeIdentity = resolveTeamIdentity(game.home_team, game.phase.season.year);
    const awayIdentity = resolveTeamIdentity(game.away_team, game.phase.season.year);

    return (
        <ArchiveLayout>
            <div className="mb-12">
                <Link href={`/seasons/${game.phase.season.id}`} className="text-blue-600 hover:underline text-sm mb-4 inline-block">
                    &larr; Back to {game.phase.season.year} {game.phase.season.competition.name}
                </Link>

                <div className="bg-white border-2 border-slate-900 shadow-xl overflow-hidden rounded">
                    {/* Game Header */}
                    <div className="bg-slate-900 text-white p-4 flex justify-between items-center font-sans tracking-widest text-xs uppercase">
                        <span>
                            {game.date_display || (game.date ? new Date(game.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "Unknown Date")}
                            {game.time && ` @ ${game.time.substring(0, 5)}`}
                        </span>
                        <div className="flex items-center gap-3">
                            <span className="font-black">{game.phase.name}</span>
                            {game.is_double_header && (
                                <span className="bg-amber-400 text-slate-900 px-2 py-0.5 rounded text-[10px] font-black normal-case tracking-normal">Double Header</span>
                            )}
                            {game.status && game.status !== 'completed' && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black normal-case tracking-normal ${game.status === 'cancelled' ? 'bg-red-500 text-white' :
                                    game.status === 'postponed' ? 'bg-orange-500 text-white' :
                                        'bg-blue-500 text-white'
                                    }`}>
                                    {game.status}
                                </span>
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
                            {game.venue?.coordinates ? (
                                <a
                                    href={`https://www.google.com/maps?q=${game.venue.coordinates.replace(/[()]/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group"
                                >
                                    <p className="font-bold text-slate-700 group-hover:text-blue-700 transition-colors">
                                        {game.venue.name} <span className="text-[10px] text-blue-500 uppercase font-sans">↗ Map</span>
                                    </p>
                                    <p className="text-slate-500">{game.venue.city} {game.venue.address}</p>
                                </a>
                            ) : (
                                <>
                                    <p className="font-bold text-slate-700">{game.venue?.name || "Venue records missing"}</p>
                                    <p className="text-slate-500">{game.venue?.city} {game.venue?.address}</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Notes Section - more prominent */}
                {(game.notes || (game.archival_notes && game.archival_notes.length > 0)) && (
                    <div className="mt-6 bg-white border-2 border-slate-900 shadow-lg overflow-hidden rounded p-6 space-y-4">
                        {game.notes && (
                            <div>
                                <h4 className="font-black uppercase text-slate-400 mb-2 text-[10px] tracking-tighter">Game Notes</h4>
                                <p className="text-slate-700 font-sans text-sm italic">{game.notes}</p>
                            </div>
                        )}
                        {game.archival_notes && game.archival_notes.length > 0 && (
                            <div>
                                <h4 className="font-black uppercase text-slate-400 mb-2 text-[10px] tracking-tighter">Archival Records</h4>
                                <ul className="space-y-2">
                                    {game.archival_notes.map((note: any) => (
                                        <li key={note.id} className="text-slate-600 font-sans text-xs border-l-2 border-slate-100 pl-3">
                                            {note.content}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Sources & Accuracy */}
            <section className="mt-12 text-xs text-slate-400 font-sans border-t pt-4 flex justify-between items-start">
                <div>
                    <p className="mb-2 uppercase font-black tracking-widest text-slate-500">Archival Authenticity</p>
                    <div className="flex gap-6">
                        <span>Confidence: <strong className="text-slate-600 uppercase italic">{game.confidence_level}</strong></span>
                        <span>Date Precision: <strong className="text-slate-600 uppercase italic">{game.date_precision}</strong></span>
                    </div>
                </div>
                <Link 
                    href={`/propose-game?id=${game.id}`}
                    className="bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 px-4 py-2 rounded-lg font-black uppercase tracking-tighter transition-all flex items-center gap-2 border border-slate-200 hover:border-amber-200 shadow-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    Suggest Correction
                </Link>
            </section>
        </ArchiveLayout>
    );
}
