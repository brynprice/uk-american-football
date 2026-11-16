import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import TeamFilterList from '@/components/archive/TeamFilterList';

export const revalidate = 604800; // 7 days

export default async function TeamsListPage() {
    const teams = await ArchiveService.getTeams();

    return (
        <ArchiveLayout>
            <section className="mb-12">
                <h1 className="text-4xl font-black mb-4 border-b-4 border-slate-900 pb-2">UK Football Teams</h1>
                <p className="text-lg text-slate-600 mb-8 max-w-2xl font-sans">
                    Browse active clubs competing today as well as historical programmes across university, adult contact, and women&apos;s American football in the United Kingdom.
                </p>

                <TeamFilterList teams={teams} />
            </section>
        </ArchiveLayout>
    );
}
