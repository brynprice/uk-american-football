import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import GameCard from '@/components/archive/GameCard';

export const revalidate = 86400; // 24 hours

export default async function ScorigamiPage({ searchParams }: { searchParams: Promise<{ scoreA?: string, scoreB?: string }> }) {
    const params = await searchParams;
    const scoreA = params.scoreA ? parseInt(params.scoreA, 10) : undefined;
    const scoreB = params.scoreB ? parseInt(params.scoreB, 10) : undefined;

    let games: any[] = [];
    let hasSearched = false;

    const [uniqueCount, searchedGames] = await Promise.all([
        ArchiveService.getUniqueScoreCount(),
        scoreA !== undefined && scoreB !== undefined && !isNaN(scoreA) && !isNaN(scoreB)
            ? ArchiveService.searchGamesByScore(scoreA, scoreB)
            : Promise.resolve([])
    ]);

    if (scoreA !== undefined && scoreB !== undefined && !isNaN(scoreA) && !isNaN(scoreB)) {
        hasSearched = true;
        games = searchedGames;
    }

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
                    className="px-4 py-2 font-black uppercase text-xs tracking-wider border-b-2 border-blue-600 text-blue-600 -mb-[2px] transition-colors"
                >
                    Score Search
                </Link>
                <Link
                    href="/scorigami/unique"
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

            <div className="bg-white border-2 border-slate-900 p-8 mb-12 shadow-sm">
                <form className="flex flex-col md:flex-row items-center justify-center gap-6">
                    <div className="flex flex-col items-center">
                        <label htmlFor="scoreA" className="text-sm font-bold uppercase tracking-widest mb-2 text-slate-500 font-sans">Winning/Home Score</label>
                        <input
                            type="number"
                            id="scoreA"
                            name="scoreA"
                            defaultValue={scoreA}
                            className="text-5xl font-black text-center w-32 pb-2 bg-transparent border-b-4 border-slate-200 hover:border-blue-300 focus:border-blue-600 focus:outline-none transition-colors"
                            min="0"
                            required
                        />
                    </div>

                    <div className="text-slate-300 font-serif italic text-2xl px-4 flex items-end pb-4">and</div>

                    <div className="flex flex-col items-center">
                        <label htmlFor="scoreB" className="text-sm font-bold uppercase tracking-widest mb-2 text-slate-500 font-sans">Losing/Away Score</label>
                        <input
                            type="number"
                            id="scoreB"
                            name="scoreB"
                            defaultValue={scoreB}
                            className="text-5xl font-black text-center w-32 pb-2 bg-transparent border-b-4 border-slate-200 hover:border-blue-300 focus:border-blue-600 focus:outline-none transition-colors"
                            min="0"
                            required
                        />
                    </div>

                    <div className="md:ml-8 mt-6 md:mt-0 flex items-end pb-2">
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-widest py-4 px-8 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                            Search Vault
                        </button>
                    </div>
                </form>
            </div>

            {hasSearched ? (
                <section>
                    <div className="flex justify-between items-baseline border-b-2 border-slate-900 pb-2 mb-6">
                        <h2 className="text-xl font-bold font-sans uppercase tracking-widest">
                            Matches for {Math.max(scoreA!, scoreB!)} - {Math.min(scoreA!, scoreB!)}
                        </h2>
                        <span className="text-slate-500 font-sans font-medium text-sm">
                            {games.length} {games.length === 1 ? 'game' : 'games'} found
                        </span>
                    </div>

                    {games.length > 0 ? (
                        <div className="space-y-4">
                            {games.map((game: any) => (
                                <GameCard key={game.id} game={game} />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 text-center text-slate-500">
                            <h3 className="text-2xl font-black text-slate-900 mb-2">SCORIGAMI!</h3>
                            <p className="font-serif">No games in the archive have ever ended with this score combination.</p>
                        </div>
                    )}
                </section>
            ) : (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 text-center text-slate-500">
                    <p className="font-serif">Enter a score combination above to search the archive.</p>
                </div>
            )}
        </ArchiveLayout>
    );
}
