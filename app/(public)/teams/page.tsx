import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';

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
                            className="group block p-6 bg-white border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md transition-all"
                        >
                            <h2 className="text-xl font-bold group-hover:text-blue-700 transition-colors">{team.name}</h2>
                            <div className="text-sm text-slate-500 font-sans mt-2">
                                {team.location || "Unknown Location"}
                            </div>
                            {team.founded_year && (
                                <div className="text-xs text-slate-400 font-sans mt-1">
                                    Founded: {team.founded_year}
                                </div>
                            )}
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
