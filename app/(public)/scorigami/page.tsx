import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import { resolveTeamIdentity } from '@/lib/utils/team-resolver';

export default async function ScorigamiPage({ searchParams }: { searchParams: Promise<{ scoreA?: string, scoreB?: string }> }) {
    const params = await searchParams;
    const scoreA = params.scoreA ? parseInt(params.scoreA, 10) : undefined;
    const scoreB = params.scoreB ? parseInt(params.scoreB, 10) : undefined;

    let games: any[] = [];
    let hasSearched = false;

    if (scoreA !== undefined && scoreB !== undefined && !isNaN(scoreA) && !isNaN(scoreB)) {
        hasSearched = true;
        games = await ArchiveService.searchGamesByScore(scoreA, scoreB);
    }

    return (
        <ArchiveLayout>
            <div className="mb-12">
                <h1 className="text-5xl font-black mb-2">Scorigami Search</h1>
                <div className="text-slate-500 font-sans uppercase tracking-widest text-xs flex gap-4">
                    <span>Find Games by Exact Final Score</span>
                    <span className="font-black text-blue-600">Archival Tool</span>
                </div>
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
                                <Link
                                    key={game.id}
                                    href={`/games/${game.id}`}
                                    className="block bg-white border border-slate-200 p-4 hover:border-blue-500 transition-all shadow-sm"
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-sans text-slate-500 uppercase tracking-tighter">
                                                {game.date_display || (game.date ? new Date(game.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "Unknown Date")}
                                            </span>
                                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                                                {game.phase?.season?.competition?.name}
                                            </span>
                                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                                                {game.phase?.name}
                                            </span>
                                        </div>
                                        {game.is_playoff && (
                                            <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase">Postseason</span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex-1 flex items-center justify-end gap-3 pr-4 text-right">
                                            <span className="font-black text-lg">{resolveTeamIdentity(game.away_team, game.date).name}</span>
                                            {resolveTeamIdentity(game.away_team, game.date).logo_url && (
                                                <div className="w-8 h-8 bg-slate-50 p-1 flex items-center justify-center shrink-0 border border-slate-100 rounded">
                                                    <img src={resolveTeamIdentity(game.away_team, game.date).logo_url!} alt="" className="max-w-full max-h-full object-contain" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 bg-slate-50 px-4 py-1 rounded border border-slate-100 font-black">
                                            <span className={game.away_score > game.home_score ? "text-blue-700" : ""}>
                                                {game.away_score ?? "-"}
                                            </span>
                                            <span className="text-slate-300 font-serif font-normal italic text-sm">at</span>
                                            <span className={game.home_score > game.away_score ? "text-blue-700" : ""}>
                                                {game.home_score ?? "-"}
                                            </span>
                                        </div>
                                        <div className="flex-1 flex items-center gap-3 pl-4">
                                            {resolveTeamIdentity(game.home_team, game.date).logo_url && (
                                                <div className="w-8 h-8 bg-slate-50 p-1 flex items-center justify-center shrink-0 border border-slate-100 rounded">
                                                    <img src={resolveTeamIdentity(game.home_team, game.date).logo_url!} alt="" className="max-w-full max-h-full object-contain" />
                                                </div>
                                            )}
                                            <span className="font-black text-lg">{resolveTeamIdentity(game.home_team, game.date).name}</span>
                                        </div>
                                    </div>
                                </Link>
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
