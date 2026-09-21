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
    const [championsData, allCompetitions] = await Promise.all([
        ArchiveService.getCompetitionChampions(id),
        ArchiveService.getCompetitions()
    ]);

    return (
        <ArchiveLayout>
            <ChampionsView
                competition={championsData.competition}
                allCompetitions={allCompetitions}
                champions={championsData.champions}
                leaderboard={championsData.leaderboard}
            />
        </ArchiveLayout>
    );
}
