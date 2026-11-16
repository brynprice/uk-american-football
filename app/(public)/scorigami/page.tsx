import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import ScorigamiSearch from '@/components/archive/ScorigamiSearch';

export const revalidate = 86400; // 24 hours

export default async function ScorigamiPage() {
    const uniqueCount = await ArchiveService.getUniqueScoreCount();

    return (
        <ArchiveLayout>
            <div className="mb-8">
                <h1 className="text-5xl font-black mb-2">Scorigami Vault</h1>
                <div className="text-slate-500 font-sans uppercase tracking-widest text-xs flex gap-4">
                    <span>Final Score Distribution & Analysis</span>
                    <span className="font-black text-blue-600">Archival Tool</span>
                </div>
            </div>

            {/* Sub-nav Tabs */}
            <div className="flex items-center gap-2 border-b-2 border-slate-900 mb-8 pb-px">
                <Link
                    href="/scorigami"
                    prefetch={false}
                    className="px-4 py-2 font-black uppercase text-xs tracking-wider border-b-2 border-blue-600 text-blue-600 -mb-[2px] transition-colors"
                >
                    Score Search
                </Link>
                <Link
                    href="/scorigami/unique"
                    prefetch={false}
                    className="px-4 py-2 font-bold uppercase text-xs tracking-wider text-slate-500 hover:text-slate-900 border-b-2 border-transparent transition-colors flex items-center gap-1.5"
                >
                    <span>Unique Scores</span>
                    {uniqueCount > 0 && (
                        <span className="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0.5 rounded font-black">
                            {uniqueCount}
                        </span>
                    )}
                </Link>
            </div>

            <ScorigamiSearch />
        </ArchiveLayout>
    );
}
