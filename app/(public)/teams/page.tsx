import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import TeamFilterList from '@/components/archive/TeamFilterList';

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

                <TeamFilterList teams={teams} />
            </section>
        </ArchiveLayout>
    );
}
