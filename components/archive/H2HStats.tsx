'use client';

import Link from 'next/link';

interface H2HStatsProps {
    team1: any;
    team2: any;
    games: any[];
}

export default function H2HStats({ team1, team2, games }: H2HStatsProps) {
    const stats = games.reduce((acc, game) => {
        const isTeam1Home = game.home_team_id === team1.id;
        const score1 = isTeam1Home ? game.home_score : game.away_score;
        const score2 = isTeam1Home ? game.away_score : game.home_score;

        if (score1 !== null && score2 !== null) {
            acc.points1 += score1;
            acc.points2 += score2;
            if (score1 > score2) acc.wins1++;
            else if (score1 < score2) acc.wins2++;
            else acc.ties++;
            acc.played++;
        }
        return acc;
    }, { wins1: 0, wins2: 0, ties: 0, points1: 0, points2: 0, played: 0 });

    const winPct = stats.played > 0 ? (((stats.wins1 + stats.ties * 0.5) / stats.played) * 100).toFixed(1) : '0.0';

    return (
        <div className="space-y-12">
            {/* Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center bg-white border-2 border-slate-900 p-8 shadow-xl rounded">
                <div className="flex flex-col items-center gap-4 text-center">
                    {(team1.logo_url || team1.team_aliases?.find((a: any) => a.logo_url)?.logo_url) && (
                        <div className="w-24 h-24 bg-white p-2 border border-slate-100 rounded shadow-sm flex items-center justify-center">
                            <img src={team1.logo_url || team1.team_aliases?.find((a: any) => a.logo_url)?.logo_url} alt={team1.name} className="max-w-full max-h-full object-contain" />
                        </div>
                    )}
                    <div>
                        <h2 className="text-2xl font-black">{team1.name}</h2>
                        <div className="text-5xl font-black text-slate-800 mt-2">{stats.wins1}</div>
                        <div className="text-xs uppercase font-black text-slate-400 mt-1">Wins</div>
                    </div>
                </div>

                <div className="flex flex-col items-center">
                    <div className="text-sm font-black uppercase text-slate-400 mb-4 tracking-widest">Head-to-Head Record</div>
                    <div className="text-4xl font-black text-slate-300 tabular-nums">
                        {stats.wins1} &ndash; {stats.wins2} {stats.ties > 0 && `&ndash; ${stats.ties}`}
                    </div>
                    <div className="mt-6 flex flex-col items-center">
                        <div className="text-xs font-black uppercase text-blue-600 mb-1">{winPct}% Success</div>
                        <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600Transition transition-all duration-1000" style={{ width: `${winPct}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-4 text-center">
                    {(team2.logo_url || team2.team_aliases?.find((a: any) => a.logo_url)?.logo_url) && (
                        <div className="w-24 h-24 bg-white p-2 border border-slate-100 rounded shadow-sm flex items-center justify-center">
                            <img src={team2.logo_url || team2.team_aliases?.find((a: any) => a.logo_url)?.logo_url} alt={team2.name} className="max-w-full max-h-full object-contain" />
                        </div>
                    )}
                    <div>
                        <h2 className="text-2xl font-black">{team2.name}</h2>
                        <div className="text-5xl font-black text-slate-800 mt-2">{stats.wins2}</div>
                        <div className="text-xs uppercase font-black text-slate-400 mt-1">Wins</div>
                    </div>
                </div>
            </div>

            {/* Scoring Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-900 text-white p-6 rounded shadow-lg">
                    <h3 className="text-xs font-black uppercase text-blue-400 mb-6 tracking-widest border-b border-blue-900 pb-2">Scoring Breakdown</h3>
                    <div className="space-y-6">
                        <div className="flex justify-between items-end">
                            <div>
                                <div className="text-[10px] uppercase font-black text-slate-400 mb-1">Total Points For</div>
                                <div className="text-3xl font-black">{stats.points1}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] uppercase font-black text-slate-400 mb-1">Points Against</div>
                                <div className="text-3xl font-black">{stats.points2}</div>
                            </div>
                        </div>
                        <div className="flex justify-between items-end border-t border-slate-800 pt-6">
                            <div>
                                <div className="text-[10px] uppercase font-black text-slate-400 mb-1">Average For</div>
                                <div className="text-2xl font-black">{(stats.points1 / (stats.played || 1)).toFixed(1)}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] uppercase font-black text-slate-400 mb-1">Average Against</div>
                                <div className="text-2xl font-black">{(stats.points2 / (stats.played || 1)).toFixed(1)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 p-6 shadow-sm flex flex-col justify-center">
                    <div className="text-center">
                        <div className="text-xs font-black uppercase text-slate-400 mb-2 tracking-widest">Total Matchups</div>
                        <div className="text-6xl font-black text-slate-900 tabular-nums">{stats.played}</div>
                        <p className="text-sm text-slate-500 font-serif italic mt-4 max-w-xs mx-auto">
                            Including all regular season and playoff meetings recorded in the archive.
                        </p>
                    </div>
                </div>
            </div>

            {/* Game Log */}
            <section>
                <h3 className="text-xl font-black uppercase border-b-2 border-slate-900 pb-2 mb-6 font-sans">Series History</h3>
                <div className="space-y-4">
                    {games.map((game) => {
                        const score1 = game.home_team_id === team1.id ? game.home_score : game.away_score;
                        const score2 = game.home_team_id === team1.id ? game.away_score : game.home_score;

                        const isWin = score1 > score2;
                        const isLoss = score1 < score2;
                        const isTie = score1 === score2 && score1 !== null;

                        return (
                            <div key={game.id} className="bg-white border border-slate-200 p-4 flex items-center justify-between group hover:border-blue-500 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] text-white shrink-0 ${isWin ? 'bg-green-600' : isLoss ? 'bg-red-600' : 'bg-slate-400'
                                        }`}>
                                        {isWin ? 'W' : isLoss ? 'L' : 'T'}
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase font-black">
                                            {game.phase.season.year} {game.phase.season.competition.name} &bull; {game.phase.name}
                                        </div>
                                        <div className="text-sm font-bold">
                                            {game.home_team.name} {game.home_score} &ndash; {game.away_score} {game.away_team.name}
                                        </div>
                                    </div>
                                </div>
                                <Link
                                    href={`/games/${game.id}`}
                                    className="text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 tracking-tighter decoration-slate-200 decoration-2 underline-offset-4 hover:underline"
                                >
                                    Box Score &rarr;
                                </Link>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
