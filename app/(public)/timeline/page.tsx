import { Metadata } from 'next';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import UniballTimelineView from '@/components/archive/UniballTimelineView';
import { ArchiveService } from '@/services/archive-service';

export const revalidate = 3600;

export const metadata: Metadata = {
    title: 'The Uniball Timeline (1985–Present) | Britball Archive',
    description: 'The definitive historical timeline of British University American Football (Uniball). Explore four decades of collegiate football across BCAFL and BUAFL/BUCS, featuring College Bowls I through XXXVIII, national dynasties, and regional champions.',
};

export default async function TimelinePage() {
    const data = await ArchiveService.getUniballTimelineData();

    return (
        <ArchiveLayout>
            <UniballTimelineView data={data} />
        </ArchiveLayout>
    );
}
