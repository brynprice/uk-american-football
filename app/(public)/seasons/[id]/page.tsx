import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import PhaseView from '@/components/archive/PhaseView';
import { resolveTeamIdentity } from '@/lib/utils/team-resolver';
export const revalidate = 0;

export default async function SeasonPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const season = await ArchiveService.getSeasonDetails(id);

    const renderMissingDetail = (text: string) => (
        <div className="flex items-center gap-2 text-red-600 text-xs mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            {text}
        </div>
    );

    return (
        <ArchiveLayout>
            <div className="mb-8">
                <Link href={`/competitions/${season.competition_id}`} className="text-blue-600 hover:underline text-sm mb-4 inline-block">
                    &larr; Back to {season.competition?.name}
                </Link>
                <div className="flex items-center gap-4 mb-2">
                    <h1 className="text-5xl font-black">{season.year}</h1>
                    <h2 className="text-2xl font-bold text-slate-500 mt-2">{season.name || "Season Archive"}</h2>
                </div>

                <div className="flex gap-4 mt-4">
                    <span className={`px-3 py-1 rounded text-xs font-black uppercase shadow-sm ${season.confidence_level === 'high' ? 'bg-green-100 text-green-700' :
                        season.confidence_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                        }`}>
                        Confidence: {season.confidence_level}
                    </span>
                    {season.completeness_score !== null && season.completeness_score !== undefined && (
                        <span className={`px-3 py-1 rounded text-xs font-black uppercase shadow-sm border ${season.completeness_score >= 90 ? 'bg-teal-50 text-teal-700 border-teal-200' :
                            season.completeness_score >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                            Data Quality: {season.completeness_score}%
                        </span>
                    )}
                    {season.start_date && (
                        <span className="text-xs font-sans text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded shadow-sm">
                            {new Date(season.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} &mdash; {season.end_date ? new Date(season.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Unknown'}
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-12">
                {season.completeness_details?.status === 'cancelled' && (
                    <div className="bg-rose-900 border-4 border-rose-950 p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex items-center gap-6">
                        <div className="bg-white text-rose-900 rounded-full w-12 h-12 flex items-center justify-center text-3xl font-black shrink-0">!</div>
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-1">Season Cancelled</h2>
                            <p className="text-rose-100 font-sans leading-relaxed">
                                This season was officially cancelled by the league. No competitive fixtures were played.
                                Common reasons include global events, reorganization, or lack of participants.
                            </p>
                        </div>
                    </div>
                )}

                {season.completeness_details?.status === 'interrupted' && (
                    <div className="bg-amber-900 border-4 border-amber-950 p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex items-center gap-6">
                        <div className="bg-white text-amber-900 rounded-full w-12 h-12 flex items-center justify-center text-3xl font-black shrink-0">!</div>
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-1">Season Interrupted</h2>
                            <p className="text-amber-100 font-sans leading-relaxed">
                                This season was interrupted due to the COVID-19 pandemic. Regular season play was completed, but the postseason was suspended and no champion was crowned.
                            </p>
                        </div>
                    </div>
                )}

                <section>
                    <div className="flex justify-between items-end mb-6 border-b-2 border-slate-900 pb-2">
                        <h3 className="text-xl font-black uppercase tracking-widest font-sans">League Structure</h3>
                    </div>
                    <PhaseView phases={season.phases} seasonId={season.id} />

                {season.phases.length === 0 && (
                        <div className="p-8 text-center bg-white border border-dashed border-slate-300 rounded text-slate-400 font-sans">
                            {season.completeness_details?.status === 'cancelled' ? 'No competitive divisions were formed.' : 'No divisions or phases recorded for this season.'}
                        </div>
                    )}
                </section>

                {season.unphased_games && season.unphased_games.length > 0 && (
                    <section>
                        <div className="flex justify-between items-end mb-6 border-b-2 border-slate-900 pb-2">
                            <h3 className="text-xl font-black uppercase tracking-widest font-sans">Friendlies & Exhibitions</h3>
                        </div>
                        <div className="space-y-4">
                            {season.unphased_games.map((game: any) => (
                                <Link
                                    key={game.id}
                                    href={`/games/${game.id}`}
                                    className="block bg-white border border-slate-200 p-4 hover:border-blue-500 transition-all shadow-sm group"
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-sans text-slate-500 uppercase tracking-tighter">
                                                {game.date_display || (game.date ? new Date(game.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "Unknown Date")}
                                            </span>
                                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${game.game_type === 'varsity' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                                    game.game_type === 'associate' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                                        game.game_type === 'old_boys' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                                                            'bg-blue-100 text-blue-700 border border-blue-200'
                                                }`}>
                                                {game.game_type || 'Friendly'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex-1 flex items-center justify-end gap-3 pr-4 text-right">
                                            <span className="font-black text-lg group-hover:text-blue-700 transition-colors">{resolveTeamIdentity(game.away_team, season.year).name}</span>
                                            {resolveTeamIdentity(game.away_team, season.year).logo_url && (
                                                <div className="w-8 h-8 bg-slate-50 p-1 flex items-center justify-center shrink-0 border border-slate-100 rounded">
                                                    <img src={resolveTeamIdentity(game.away_team, season.year).logo_url!} alt="" className="max-w-full max-h-full object-contain" />
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
                                            {resolveTeamIdentity(game.home_team, season.year).logo_url && (
                                                <div className="w-8 h-8 bg-slate-50 p-1 flex items-center justify-center shrink-0 border border-slate-100 rounded">
                                                    <img src={resolveTeamIdentity(game.home_team, season.year).logo_url!} alt="" className="max-w-full max-h-full object-contain" />
                                                </div>
                                            )}
                                            <span className="font-black text-lg group-hover:text-blue-700 transition-colors">{resolveTeamIdentity(game.home_team, season.year).name}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Footnotes/Sources Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <section className="bg-slate-50 p-6 border-l-4 border-slate-300">
                        <h4 className="text-sm font-black uppercase mb-4 font-sans text-slate-500">Archival Notes</h4>
                        {season.notes ? (
                            <div className="text-sm text-slate-600 font-serif leading-relaxed italic">
                                <p>{season.notes}</p>
                            </div>
                        ) : season.archival_notes && season.archival_notes.length > 0 ? (
                            <div className="space-y-4 text-sm text-slate-600 font-serif leading-relaxed italic">
                                {season.archival_notes.map((note: any) => (
                                    <p key={note.id}>{note.content}</p>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-600 font-serif leading-relaxed italic">
                                Records for the {season.year} season are compiled from various historical newspaper archives and league bulletins.
                            </p>
                        )}

                        {season.completeness_details && season.completeness_details.status !== 'cancelled' && (
                            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                                <h5 className="text-sm font-bold text-red-800 mb-2">Completeness Details:</h5>
                                {season.completeness_details?.missing_phases && renderMissingDetail(
                                    `Missing divisions or phases`
                                ) || null}
                                {season.completeness_details?.missing_participations && renderMissingDetail(
                                    `Missing enrolled teams`
                                ) || null}
                                {season.completeness_details?.missing_games && renderMissingDetail(
                                    `Missing game logs or final standings`
                                ) || null}
                                {season.completeness_details?.games_missing_scores > 0 && renderMissingDetail(
                                    `Missing scores for ${season.completeness_details.games_missing_scores} games`
                                ) || null}
                                {season.completeness_details?.games_missing_dates > 0 && renderMissingDetail(
                                    `Missing exact dates for ${season.completeness_details.games_missing_dates} games`
                                ) || null}
                                {season.completeness_details?.games_missing_venues > 0 && renderMissingDetail(
                                    `Missing venues for ${season.completeness_details.games_missing_venues} games`
                                ) || null}
                                {season.completeness_details?.participations_missing_coach > 0 && renderMissingDetail(
                                    `Missing head coach for ${season.completeness_details.participations_missing_coach} teams`
                                ) || null}
                                {season.completeness_details?.missing_title_game && renderMissingDetail(
                                    `Missing championship title game`
                                ) || null}
                                {season.completeness_details?.missing_expected_ratio && season.completeness_details.missing_expected_ratio.split('/')[0] !== season.completeness_details.missing_expected_ratio.split('/')[1] && renderMissingDetail(
                                    `Missing ${parseInt(season.completeness_details.missing_expected_ratio.split('/')[1]) - parseInt(season.completeness_details.missing_expected_ratio.split('/')[0])} expected teams (${season.completeness_details.missing_expected_ratio} enrolled)`
                                ) || null}
                                {season.completeness_details?.unresolved_walkover_count > 0 && renderMissingDetail(
                                    `${season.completeness_details.unresolved_walkover_count} unresolved walkovers (-${Math.min(season.completeness_details.unresolved_walkover_count * 5, 20)} pts)`
                                ) || null}
                                {season.completeness_details?.anomaly_count > 0 && renderMissingDetail(
                                    `${season.completeness_details.anomaly_count} game anomalies reported (-${Math.min(season.completeness_details.anomaly_count * 2, 10)} pts)`
                                ) || null}
                                {season.completeness_details?.phases_with_discrepancies > 0 && renderMissingDetail(
                                    `${season.completeness_details.phases_with_discrepancies} divisions with game count errors (-${Math.min(season.completeness_details.phases_with_discrepancies * 5, 20)} pts)`
                                ) || null}

                                {Object.keys(season.completeness_details).length > 0 &&
                                    !season.completeness_details.missing_phases &&
                                    !season.completeness_details.missing_participations &&
                                    !season.completeness_details.missing_games &&
                                    !(season.completeness_details.games_missing_scores > 0) &&
                                    !(season.completeness_details.games_missing_dates > 0) &&
                                    !(season.completeness_details.games_missing_venues > 0) &&
                                    !(season.completeness_details.participations_missing_coach > 0) &&
                                    !season.completeness_details.missing_title_game &&
                                    !(season.completeness_details.unresolved_walkover_count > 0) &&
                                    !(season.completeness_details.anomaly_count > 0) &&
                                    !(season.completeness_details.phases_with_discrepancies > 0) &&
                                    !(season.completeness_details.missing_expected_ratio && season.completeness_details.missing_expected_ratio.split('/')[0] !== season.completeness_details.missing_expected_ratio.split('/')[1]) && (
                                        <div className="text-sm text-green-700 font-medium">All standard data points appear complete!</div>
                                    )}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </ArchiveLayout>
    );
}
