import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import ChampionsView from '@/components/archive/ChampionsView';
import { assertValidUuidOrNotFound, fetchOrNotFound } from '@/lib/utils/route-helpers';

export const revalidate = 604800; // 7 days

export default async function CompetitionChampionsPage({
    params
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    assertValidUuidOrNotFound(id);

    const [currentComp, allCompetitions] = await Promise.all([
        fetchOrNotFound(() => ArchiveService.getCompetitionById(id)),
        ArchiveService.getCompetitions()
    ]);

    const [singleCompChampionsData, levelChampionsData] = await Promise.all([
        ArchiveService.getChampions({ competitionId: id }),
        currentComp?.level ? ArchiveService.getChampions({ level: currentComp.level }) : null
    ]);

    return (
        <ArchiveLayout>
            <ChampionsView
                competition={currentComp}
                allCompetitions={allCompetitions}
                singleCompChampionsData={singleCompChampionsData}
                levelChampionsData={levelChampionsData}
            />
        </ArchiveLayout>
    );
}
