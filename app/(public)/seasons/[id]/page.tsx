import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import PhaseView from '@/components/archive/PhaseView';

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
                <section>
                    <div className="flex justify-between items-end mb-6 border-b-2 border-slate-900 pb-2">
                        <h3 className="text-xl font-black uppercase tracking-widest font-sans">League Structure</h3>
                    </div>
                    <PhaseView phases={season.phases} seasonId={season.id} />

                    {season.phases.length === 0 && (
                        <div className="p-8 text-center bg-white border border-dashed border-slate-300 rounded text-slate-400 font-sans">
                            No divisions or phases recorded for this season.
                        </div>
                    )}
                </section>

                {/* Footnotes/Sources Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <section className="bg-slate-50 p-6 border-l-4 border-slate-300">
                        <h4 className="text-sm font-black uppercase mb-4 font-sans text-slate-500">Archival Notes</h4>
                        {season.notes && season.notes.length > 0 ? (
                            <div className="space-y-4 text-sm text-slate-600 font-serif leading-relaxed italic">
                                {season.notes.map((note: any) => (
                                    <p key={note.id}>{note.content}</p>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-600 font-serif leading-relaxed italic">
                                Records for the {season.year} season are compiled from various historical newspaper archives and league bulletins.
                            </p>
                        )}

                        {season.completeness_details && (
                            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                                <h5 className="text-sm font-bold text-red-800 mb-2">Completeness Details:</h5>
                                {season.completeness_details?.missing_phases && renderMissingDetail(
                                    `Missing divisions or phases`
                                )}
                                {season.completeness_details?.missing_participations && renderMissingDetail(
                                    `Missing enrolled teams`
                                )}
                                {season.completeness_details?.missing_games && renderMissingDetail(
                                    `Missing game logs or final standings`
                                )}
                                {season.completeness_details?.games_missing_scores > 0 && renderMissingDetail(
                                    `Missing scores for ${season.completeness_details.games_missing_scores} games`
                                )}
                                {season.completeness_details?.games_missing_dates > 0 && renderMissingDetail(
                                    `Missing exact dates for ${season.completeness_details.games_missing_dates} games`
                                )}
                                {season.completeness_details?.games_missing_venues > 0 && renderMissingDetail(
                                    `Missing venues for ${season.completeness_details.games_missing_venues} games`
                                )}
                                {season.completeness_details?.participations_missing_coach > 0 && renderMissingDetail(
                                    `Missing head coach for ${season.completeness_details.participations_missing_coach} teams`
                                )}
                                {season.completeness_details?.missing_title_game && renderMissingDetail(
                                    `Missing championship title game`
                                )}
                                {season.completeness_details?.missing_expected_ratio && season.completeness_details.missing_expected_ratio.split('/')[0] !== season.completeness_details.missing_expected_ratio.split('/')[1] && renderMissingDetail(
                                    `Missing ${parseInt(season.completeness_details.missing_expected_ratio.split('/')[1]) - parseInt(season.completeness_details.missing_expected_ratio.split('/')[0])} expected teams (${season.completeness_details.missing_expected_ratio} enrolled)`
                                )}
                                {season.completeness_details?.unresolved_walkover_count > 0 && renderMissingDetail(
                                    `${season.completeness_details.unresolved_walkover_count} unresolved walkovers (-${Math.min(season.completeness_details.unresolved_walkover_count * 5, 20)} pts)`
                                )}

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
