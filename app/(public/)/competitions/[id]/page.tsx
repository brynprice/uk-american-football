import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';

export default async function CompetitionPage({ params }: { params: { id: string } }) {
    const competition = await ArchiveService.getCompetitionById(params.id);

    return (
        <ArchiveLayout>
            <div className="mb-8">
                <Link href="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">&larr; Back to Competitions</Link>
                <h1 className="text-4xl font-black mb-2">{competition.name}</h1>
                <div className="text-sm text-slate-500 mb-4 max-w-2xl leading-relaxed whitespace-pre-wrap">
                    {competition.description}
                </div>
            </div>

            <div className="border-t-2 border-slate-100 pt-8">
                <h2 className="text-2xl font-bold mb-6 font-sans uppercase tracking-wider underline decoration-4 decoration-blue-500 underline-offset-8">
                    Historical Seasons
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-sans text-sm">
                        <thead>
                            <tr className="border-b-2 border-slate-900">
                                <th className="py-3 px-4 font-black uppercase">Year</th>
                                <th className="py-3 px-4 font-black uppercase">Season Name</th>
                                <th className="py-3 px-4 font-black uppercase">Confidence</th>
                                <th className="py-3 px-4 font-black uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {competition.seasons?.sort((a, b) => b.year - a.year).map((season) => (
                                <tr key={season.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-4 font-bold text-lg leading-none">{season.year}</td>
                                    <td className="py-4 px-4">{season.name || `${season.year} Season`}</td>
                                    <td className="py-4 px-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${season.confidence_level === 'high' ? 'bg-green-100 text-green-700' :
                                                season.confidence_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-red-100 text-red-700'
                                            }`}>
                                            {season.confidence_level}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                        <Link
                                            href={`/seasons/${season.id}`}
                                            className="inline-block px-4 py-1.5 bg-slate-900 text-white font-bold hover:bg-blue-700 transition-colors rounded shadow-sm"
                                        >
                                            View Season
                                        </Link>
                                    </td>
                                </tr>
                            ))}

                            {(!competition.seasons || competition.seasons.length === 0) && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                                        No seasons recorded yet for this competition.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </ArchiveLayout>
    );
}
