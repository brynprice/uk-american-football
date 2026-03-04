import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const team = await ArchiveService.getTeamHistory(id);

    return (
        <ArchiveLayout>
            <div className="mb-12 flex flex-col md:flex-row gap-8 items-start md:items-center">
                {team.logo_url && (
                    <div className="w-32 h-32 bg-white p-2 border border-slate-200 shadow-sm rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                        <img src={team.logo_url} alt={`${team.name} Logo`} className="max-w-full max-h-full object-contain" />
                    </div>
                )}
                <div>
                    <h1 className="text-5xl font-black mb-2">{team.name}</h1>
                    <div className="flex gap-4 items-center">
                        <span className="text-slate-500 font-sans uppercase tracking-widest text-xs">
                            {team.location} &bull; Founded {team.founded_year || "Unknown"}
                        </span>
                        {team.folded_year && (
                            <span className="bg-red-50 text-red-600 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-red-100 italic">
                                Folded {team.folded_year}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                {/* Left Column: History Timeline */}
                <div className="md:col-span-2 space-y-8">
                    <section>
                        <h3 className="text-xl font-black uppercase border-b-2 border-slate-900 pb-2 mb-6 font-sans">Season History</h3>
                        <div className="space-y-4">
                            {team.participations?.sort((a: any, b: any) => b.phase.season.year - a.phase.season.year).map((p: any) => (
                                <div key={p.id} className="flex gap-4 items-start group">
                                    <div className="w-16 pt-1 text-lg font-black text-slate-400 group-hover:text-blue-600 transition-colors">
                                        {p.phase.season.year}
                                    </div>
                                    <div className="flex-1 bg-white p-4 border border-slate-200 shadow-sm border-l-4 border-l-slate-800 hover:border-l-blue-600 transition-all">
                                        <div className="flex justify-between items-center">
                                            <Link href={`/seasons/${p.phase.season.id}`} className="font-bold text-slate-800 hover:text-blue-700">
                                                {p.phase.season.competition.name}
                                            </Link>
                                            <span className="text-[10px] uppercase font-black text-slate-400 font-sans">
                                                {p.phase.name}
                                            </span>
                                        </div>
                                        {p.notes && <p className="text-xs text-slate-500 mt-2 italic font-serif">{p.notes}</p>}
                                    </div>
                                </div>
                            ))}

                            {(!team.participations || team.participations.length === 0) && (
                                <p className="text-slate-400 italic font-sans py-4">No seasonal records found for this team.</p>
                            )}
                        </div>
                    </section>
                </div>

                {/* Right Column: Metadata & Aliases */}
                <div className="space-y-8">
                    <section className="bg-white p-6 border border-slate-200 shadow-sm">
                        <h4 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-tighter">Known Aliases</h4>
                        <div className="space-y-3">
                            {team.team_aliases?.map((alias: any) => (
                                <div key={alias.id} className="text-sm border-l-2 border-slate-100 pl-3 flex items-center gap-4 py-2">
                                    {alias.logo_url && (
                                        <div className="w-8 h-8 bg-slate-50 border border-slate-100 p-1 flex items-center justify-center shrink-0 overflow-hidden rounded shadow-sm">
                                            <img src={alias.logo_url} alt={alias.name} className="max-w-full max-h-full object-contain" />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <div className="font-bold">{alias.name}</div>
                                        <div className="text-[10px] text-slate-400 uppercase font-sans">
                                            {alias.start_year || "?"} &mdash; {alias.end_year || "Present"}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {team.team_aliases?.length === 0 && <p className="text-xs text-slate-400 italic">No historical name changes recorded.</p>}
                        </div>
                    </section>

                    <section className="bg-slate-900 text-white p-6 rounded">
                        <h4 className="text-xs font-black uppercase text-blue-400 mb-4 tracking-tighter">Archive Profile</h4>
                        <div className="text-xs space-y-4 font-serif leading-relaxed opacity-80">
                            <p>{team.notes || "This team is a documented participant in British American Football history."}</p>
                        </div>
                    </section>
                </div>
            </div>
        </ArchiveLayout>
    );
}
