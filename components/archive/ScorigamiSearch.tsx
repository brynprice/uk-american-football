'use client';

import { useState, useEffect, FormEvent } from 'react';
import { ArchiveService } from '@/services/archive-service';
import GameCard from '@/components/archive/GameCard';

interface ScorigamiGame {
    id: string;
    [key: string]: unknown;
}

function parseScoreParam(raw: string | null): number | null {
    if (!raw || !/^\d+$/.test(raw.trim())) return null;
    const parsed = Number(raw.trim());
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 300 ? parsed : null;
}

export default function ScorigamiSearch() {
    const [scoreAInput, setScoreAInput] = useState('');
    const [scoreBInput, setScoreBInput] = useState('');
    const [searchedPair, setSearchedPair] = useState<{ a: number; b: number } | null>(null);
    const [games, setGames] = useState<ScorigamiGame[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const runSearch = async (a: number, b: number) => {
        setIsLoading(true);
        setError(null);
        setSearchedPair({ a, b });
        try {
            const results = await ArchiveService.searchGamesByScore(a, b);
            setGames(results as ScorigamiGame[]);
        } catch (err: unknown) {
            console.error('Error searching scorigami scores:', err);
            setError('Failed to search archive scores. Please try again.');
            setGames([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const a = parseScoreParam(params.get('scoreA'));
        const b = parseScoreParam(params.get('scoreB'));
        if (a === null || b === null) return;

        let active = true;
        ArchiveService.searchGamesByScore(a, b)
            .then((results) => {
                if (!active) return;
                setScoreAInput(String(a));
                setScoreBInput(String(b));
                setSearchedPair({ a, b });
                setGames(results as ScorigamiGame[]);
                setError(null);
            })
            .catch((err: unknown) => {
                if (!active) return;
                console.error('Error searching scorigami scores:', err);
                setScoreAInput(String(a));
                setScoreBInput(String(b));
                setSearchedPair({ a, b });
                setError('Failed to search archive scores. Please try again.');
                setGames([]);
            });

        return () => {
            active = false;
        };
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const a = parseScoreParam(scoreAInput);
        const b = parseScoreParam(scoreBInput);
        if (a === null || b === null) return;

        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('scoreA', String(a));
            url.searchParams.set('scoreB', String(b));
            window.history.replaceState({}, '', url.toString());
        }

        await runSearch(a, b);
    };

    return (
        <>
            <div className="bg-white border-2 border-slate-900 p-8 mb-12 shadow-sm">
                <form onSubmit={handleSubmit} className="flex flex-col md:flex-row items-center justify-center gap-6">
                    <div className="flex flex-col items-center">
                        <label htmlFor="scoreA" className="text-sm font-bold uppercase tracking-widest mb-2 text-slate-500 font-sans">Winning/Home Score</label>
                        <input
                            type="number"
                            id="scoreA"
                            name="scoreA"
                            value={scoreAInput}
                            onChange={(e) => setScoreAInput(e.target.value)}
                            className="text-5xl font-black text-center w-32 pb-2 bg-transparent border-b-4 border-slate-200 hover:border-blue-300 focus:border-blue-600 focus:outline-none transition-colors"
                            min="0"
                            max="300"
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
                            value={scoreBInput}
                            onChange={(e) => setScoreBInput(e.target.value)}
                            className="text-5xl font-black text-center w-32 pb-2 bg-transparent border-b-4 border-slate-200 hover:border-blue-300 focus:border-blue-600 focus:outline-none transition-colors"
                            min="0"
                            max="300"
                            required
                        />
                    </div>

                    <div className="md:ml-8 mt-6 md:mt-0 flex items-end pb-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold uppercase tracking-widest py-4 px-8 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                        >
                            {isLoading ? 'Searching...' : 'Search Vault'}
                        </button>
                    </div>
                </form>
            </div>

            {isLoading ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 text-center text-slate-500">
                    <p className="font-serif">Searching historical score records...</p>
                </div>
            ) : error ? (
                <div className="bg-red-50 border-2 border-red-200 p-8 text-center text-red-700 font-sans text-sm font-semibold">
                    {error}
                </div>
            ) : searchedPair ? (
                <section>
                    <div className="flex justify-between items-baseline border-b-2 border-slate-900 pb-2 mb-6">
                        <h2 className="text-xl font-bold font-sans uppercase tracking-widest">
                            Matches for {Math.max(searchedPair.a, searchedPair.b)} - {Math.min(searchedPair.a, searchedPair.b)}
                        </h2>
                        <span className="text-slate-500 font-sans font-medium text-sm">
                            {games.length} {games.length === 1 ? 'game' : 'games'} found
                        </span>
                    </div>

                    {games.length > 0 ? (
                        <div className="space-y-4">
                            {games.map((game) => (
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
        </>
    );
}
