import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
export const revalidate = 0;

export default async function TeamsListPage() {
    const teams = await ArchiveService.getTeams();

    return (
        <ArchiveLayout>
            <section className="mb-12">
                <h1 className="text-4xl font-black mb-4 border-b-4 border-slate-900 pb-2">Historical Teams</h1>
                <p className="text-lg text-slate-600 mb-8 max-w-2xl font-sans">
                    Browse the clubs that have shaped the history of American football in the United Kingdom.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {teams.map((team) => (
                        <Link
                            key={team.id}
                            href={`/teams/${team.id}`}
                            className="group block p-6 bg-white border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md transition-all flex items-start gap-5"
                        >
                            <div className="flex-shrink-0 w-16 h-16 bg-white rounded border border-slate-100 flex items-center justify-center overflow-hidden p-1">
                                {team.logo_url ? (
                                    <img
                                        src={team.logo_url}
                                        alt={`${team.name} Logo`}
                                        className="max-w-full max-h-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-300"
                                    />
                                ) : (
                                    <div className="text-[10px] text-slate-300 font-black uppercase tracking-tighter">No Logo</div>
                                )}
                            </div>
                            <div className="flex-grow min-w-0">
                                <h2 className="text-xl font-bold group-hover:text-blue-700 transition-colors leading-tight break-words">{team.name}</h2>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    {team.team_type && (
                                        <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-slate-200 font-sans">
                                            {team.team_type}
                                        </span>
                                    )}
                                    <span className="text-sm text-slate-500 font-sans">
                                        {team.location || "Unknown Location"}
                                    </span>
                                </div>
                                {team.founded_year && (
                                    <div className="text-xs text-slate-400 font-sans mt-1">
                                        Founded: {team.founded_year}
                                    </div>
                                )}
                            </div>
                        </Link>
                    ))}

                    {(!teams || teams.length === 0) && (
                        <div className="col-span-full p-12 text-center bg-white border border-dashed border-slate-300 rounded">
                            <p className="text-slate-400 font-sans italic">No teams found in the database yet.</p>
                        </div>
                    )}
                </div>
            </section>
        </ArchiveLayout>
    );
}
