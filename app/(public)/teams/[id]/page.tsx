import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const team = await ArchiveService.getTeamHistory(id);

    console.log('DEBUG: Team Data', {
        name: team.name,
        aliases: team.team_aliases?.map((a: any) => ({ name: a.name, logo: a.logo_url }))
    });

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

                    {/* Hall of Fame Section */}
                    {team.hall_of_fame && team.hall_of_fame.length > 0 && (
                        <section>
                            <h3 className="text-xl font-black uppercase border-b-2 border-slate-900 pb-2 mb-6 font-sans">Hall of Fame</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {team.hall_of_fame.sort((a: any, b: any) => (b.year_inducted || 0) - (a.year_inducted || 0)).map((hof: any) => (
                                    <div key={hof.id} className="bg-slate-50 p-4 border border-slate-200 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-slate-900 text-white flex items-center justify-center rotate-45 translate-x-8 -translate-y-8">
                                            <span className="text-[8px] font-black -rotate-45 uppercase translate-y-2">HOF</span>
                                        </div>
                                        <div className="font-bold text-lg mb-1 group-hover:text-blue-700 transition-colors">
                                            {hof.person_id ? (
                                                <Link href={`/people/${hof.person_id}`}>{hof.person_name}</Link>
                                            ) : (
                                                hof.person_name
                                            )}
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div className="text-xs text-slate-500 font-sans uppercase tracking-widest">
                                                Inducted {hof.year_inducted || "Unknown Year"}
                                            </div>
                                            {hof.seasons_with_team && (
                                                <div className="text-[10px] font-black bg-white px-2 py-0.5 rounded border border-slate-200 uppercase text-slate-400">
                                                    {hof.seasons_with_team}
                                                </div>
                                            )}
                                        </div>
                                        {hof.notes && <p className="text-[10px] text-slate-500 mt-2 italic border-t border-slate-100 pt-2">{hof.notes}</p>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Retired Jerseys Section */}
                    {team.retired_jerseys && team.retired_jerseys.length > 0 && (
                        <section>
                            <h3 className="text-xl font-black uppercase border-b-2 border-slate-900 pb-2 mb-6 font-sans">Retired Jerseys</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {team.retired_jerseys
                                    .sort((a: any, b: any) => {
                                        const numA = parseInt(a.jersey_number.replace(/\D/g, '')) || 0;
                                        const numB = parseInt(b.jersey_number.replace(/\D/g, '')) || 0;
                                        return numA - numB;
                                    })
                                    .map((rj: any) => (
                                        <div key={rj.id} className="flex gap-4 items-center bg-white p-4 border border-slate-200 shadow-sm">
                                            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center shrink-0 border-4 border-slate-100 shadow-inner">
                                                <span className="text-white text-2xl font-black font-mono">#{rj.jersey_number}</span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-[10px] font-black uppercase text-slate-400 font-sans tracking-widest mb-1">
                                                    Retired {rj.year_retired || "?"}
                                                </div>
                                                <div className="font-bold text-slate-800">
                                                    In Honour of {rj.honoured_person_id ? (
                                                        <Link href={`/people/${rj.honoured_person_id}`} className="hover:text-blue-700">
                                                            {rj.person?.display_name || rj.honoured_person_name}
                                                        </Link>
                                                    ) : (
                                                        rj.honoured_person_name
                                                    )}
                                                </div>
                                                {rj.notes && <p className="text-[10px] text-slate-500 italic mt-1">{rj.notes}</p>}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </section>
                    )}
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
