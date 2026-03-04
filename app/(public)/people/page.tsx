import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';

export default async function PeopleListPage() {
    const people = await ArchiveService.getPeople();

    return (
        <ArchiveLayout>
            <section className="mb-12">
                <h1 className="text-4xl font-black mb-4 border-b-4 border-slate-900 pb-2">Historical People</h1>
                <p className="text-lg text-slate-600 mb-8 max-w-2xl font-sans">
                    Profiles of influential coaches, players, and figures in UK American Football history.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {people.map((person) => (
                        <Link
                            key={person.id}
                            href={`/people/${person.id}`}
                            className="group block p-6 bg-white border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md transition-all"
                        >
                            <h2 className="text-xl font-bold group-hover:text-blue-700 transition-colors">{person.display_name}</h2>
                            <div className="text-sm text-slate-500 font-sans mt-2 italic">
                                {person.first_name} {person.last_name}
                            </div>
                        </Link>
                    ))}

                    {(!people || people.length === 0) && (
                        <div className="col-span-full p-12 text-center bg-white border border-dashed border-slate-300 rounded">
                            <p className="text-slate-400 font-sans italic">No historical figures found in the database yet.</p>
                        </div>
                    )}
                </div>
            </section>
        </ArchiveLayout>
    );
}
