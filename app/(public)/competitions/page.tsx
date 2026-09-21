import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';

export const revalidate = 0;

export default async function CompetitionsPage() {
    const competitions = await ArchiveService.getCompetitions();

    return (
        <ArchiveLayout>
            <section className="mb-12">
                <header className="mb-12 border-b-8 border-slate-900 pb-6">
                    <h1 className="text-5xl font-black uppercase italic tracking-tighter">Historic Competitions</h1>
                    <p className="text-xl text-slate-500 font-sans mt-2 uppercase tracking-widest">The Vault of British American Football Leagues</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {competitions.map((comp) => (
                        <Link
                            key={comp.id}
                            href={`/competitions/${comp.id}`}
                            className="group block p-8 bg-white border-2 border-slate-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] hover:border-slate-900 hover:shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] hover:-translate-x-1 hover:-translate-y-1 transition-all"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <h2 className="text-2xl font-black uppercase group-hover:text-blue-700 transition-colors tracking-tight">{comp.name}</h2>
                                <span className="text-[10px] font-black uppercase bg-slate-100 px-2 py-1 rounded text-slate-500 border border-slate-200">
                                    {comp.level}
                                </span>
                            </div>
                            <p className="text-slate-500 text-sm line-clamp-3 font-sans leading-relaxed mb-6">
                                {comp.description || "Historical records, standings, and game logs for this competition."}
                            </p>
                            <div className="flex items-center text-xs font-black uppercase tracking-widest text-blue-600">
                                <span>Browse Records</span>
                                <span className="ml-2 group-hover:translate-x-2 transition-transform">&rarr;</span>
                            </div>
                        </Link>
                    ))}

                    {(!competitions || competitions.length === 0) && (
                        <div className="col-span-full p-16 text-center bg-slate-50 border-4 border-dashed border-slate-200 rounded">
                            <p className="text-slate-400 font-black uppercase tracking-widest italic">The archive is currently empty.</p>
                        </div>
                    )}
                </div>
            </section>
        </ArchiveLayout>
    );
}
