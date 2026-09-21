import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import ChampionsView from '@/components/archive/ChampionsView';

export const revalidate = 0;

export default async function CompetitionChampionsPage({
    params
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const [currentComp, allCompetitions] = await Promise.all([
        ArchiveService.getCompetitionById(id),
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
