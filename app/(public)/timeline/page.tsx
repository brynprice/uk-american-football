import { Metadata } from 'next';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import UniballTimelineView from '@/components/archive/UniballTimelineView';
import { ArchiveService } from '@/services/archive-service';

export const revalidate = 3600;

export const metadata: Metadata = {
    title: "Interactive Historical Timelines (Uniball & Women's Game) | Britball.io",
    description: "Explore the definitive historical timelines of British American Football — spanning four decades of Uniball (BCAFL & BUAFL/BUCS, 1985–Present) and the complete history of the Women's Game (Sapphire Series & NWFL, 2014–Present).",
};

export default async function TimelinePage() {
    const [uniballData, womensData] = await Promise.all([
        ArchiveService.getUniballTimelineData(),
        ArchiveService.getWomensTimelineData(),
    ]);

    return (
        <ArchiveLayout>
            <UniballTimelineView data={uniballData} womensData={womensData} />
        </ArchiveLayout>
    );
}
