import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import PhaseView from '@/components/archive/PhaseView';

export default async function SeasonPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const season = await ArchiveService.getSeasonDetails(id);

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
                <section className="bg-slate-50 p-6 border-l-4 border-slate-300">
                    <h4 className="text-sm font-black uppercase mb-4 font-sans text-slate-500">Archival Notes</h4>
                    <p className="text-sm text-slate-600 font-serif leading-relaxed italic">
                        Records for the {season.year} season are compiled from various historical newspaper archives and league bulletins.
                        Dates and venues may be subject to revision as more primary sources are recovered.
                    </p>
                </section>
            </div>
        </ArchiveLayout>
    );
}
