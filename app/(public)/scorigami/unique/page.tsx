import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import UniqueGamesList from '@/components/archive/UniqueGamesList';

export const revalidate = 0;

export default async function UniqueScoresPage() {
    const games = await ArchiveService.getUniqueScoreGames();
    const count = games.length;
    const totallyUniqueCount = games.filter(g => g.is_totally_unique).length;

    return (
        <ArchiveLayout>
            <div className="mb-8">
                <h1 className="text-5xl font-black mb-2">Unique Score Games</h1>
                <div className="text-slate-500 font-sans uppercase tracking-widest text-xs flex flex-wrap gap-3 items-center">
                    <span>Scorigami Vault</span>
                    <span className="font-black text-blue-600">Level-Specific & All-Time Uniques</span>
                    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-black">
                        {count} Total Level Unique
                    </span>
                    <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded font-black">
                        ★ {totallyUniqueCount} Totally Unique
                    </span>
                </div>
            </div>

            {/* Sub-nav Tabs */}
            <div className="flex items-center gap-2 border-b-2 border-slate-900 mb-8 pb-px">
                <Link
                    href="/scorigami"
                    className="px-4 py-2 font-bold uppercase text-xs tracking-wider text-slate-500 hover:text-slate-900 border-b-2 border-transparent transition-colors"
                >
                    Score Search
                </Link>
                <Link
                    href="/scorigami/unique"
                    className="px-4 py-2 font-black uppercase text-xs tracking-wider border-b-2 border-purple-600 text-purple-700 -mb-[2px] transition-colors flex items-center gap-1.5"
                >
                    <span>Unique Scores</span>
                    <span className="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0.5 rounded font-black">
                        {count}
                    </span>
                </Link>
            </div>

            <div className="bg-purple-50/60 border border-purple-200 p-4 mb-8 rounded text-sm text-purple-900 font-sans space-y-2">
                <p>
                    Every game listed below ended with a final score combination that has <strong>never occurred in any other recorded game at its level</strong> (Adult, University, etc.). If a future game at that level finishes with one of these scores, both games will automatically lose their level-unique status.
                </p>
                <p className="text-xs text-purple-800">
                    <span className="font-bold text-amber-950 bg-amber-300 px-1.5 py-0.5 rounded mr-1">★ Totally Unique</span>
                    scores are one-of-a-kind results that have never occurred in <em>any</em> recorded game across the entire history of British American football at any level.
                </p>
            </div>

            <UniqueGamesList games={games} />
        </ArchiveLayout>
    );
}
