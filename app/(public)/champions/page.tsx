import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import ChampionsView from '@/components/archive/ChampionsView';

export const revalidate = 0;

export default async function GlobalChampionsPage() {
    const [allChampionsData, allCompetitions] = await Promise.all([
        ArchiveService.getChampions(),
        ArchiveService.getCompetitions()
    ]);

    return (
        <ArchiveLayout>
            <ChampionsView
                allCompetitions={allCompetitions}
                allChampionsData={allChampionsData}
            />
        </ArchiveLayout>
    );
}
