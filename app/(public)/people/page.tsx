import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import PeopleFilterList from '@/components/archive/PeopleFilterList';

export const revalidate = 3600; // 1 hour

export default async function PeopleListPage() {
    const people = await ArchiveService.getPeople();

    return (
        <ArchiveLayout>
            <section className="mb-12">
                <h1 className="text-4xl font-black mb-4 border-b-4 border-slate-900 pb-2">Historical People</h1>
                <p className="text-lg text-slate-600 mb-8 max-w-2xl font-sans">
                    Profiles of influential coaches, players, and figures in UK American Football history.
                </p>

                <PeopleFilterList people={people} />
            </section>
        </ArchiveLayout>
    );
}
