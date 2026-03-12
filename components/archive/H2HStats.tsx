'use client';

import Link from 'next/link';
import { resolveTeamIdentity } from '@/lib/utils/team-resolver';

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
        const type = game.is_playoff ? 'playoff' : 'regular';

        if (score1 !== null && score2 !== null) {
            acc.overall.points1 += score1;
            acc.overall.points2 += score2;
            if (score1 > score2) acc.overall.wins1++;
            else if (score1 < score2) acc.overall.wins2++;
            else acc.overall.ties++;
            acc.overall.played++;

            acc[type].points1 += score1;
            acc[type].points2 += score2;
            if (score1 > score2) acc[type].wins1++;
            else if (score1 < score2) acc[type].wins2++;
            else acc[type].ties++;
            acc[type].played++;
        }
        return acc;
    }, {
        overall: { wins1: 0, wins2: 0, ties: 0, points1: 0, points2: 0, played: 0 },
        regular: { wins1: 0, wins2: 0, ties: 0, points1: 0, points2: 0, played: 0 },
        playoff: { wins1: 0, wins2: 0, ties: 0, points1: 0, points2: 0, played: 0 }
    });

    const winPct = stats.overall.played > 0 ? (((stats.overall.wins1 + stats.overall.ties * 0.5) / stats.overall.played) * 100).toFixed(1) : '0.0';

    const renderStatBox = (title: string, data: any, isDark = false) => {
        if (data.played === 0) return null;
        return (
            <div className={`${isDark ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'} p-4 shadow-sm rounded`}>
                <div className={`text-[10px] font-black uppercase mb-3 tracking-widest ${isDark ? 'text-blue-400' : 'text-slate-400'}`}>
                    {title}
                </div>
                <div className="flex justify-between items-end">
                    <div>
                        <div className="text-2xl font-black tabular-nums">{data.wins1} &ndash; {data.wins2} {data.ties > 0 && `&ndash; ${data.ties}`}</div>
                        <div className="text-[10px] uppercase font-bold opacity-60">Record</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-black tabular-nums">{data.points1} &ndash; {data.points2}</div>
                        <div className="text-[10px] uppercase font-bold opacity-60">Points</div>
                    </div>
                </div>
            </div>
        );
    };

    const regularGames = games.filter(g => !g.is_playoff);
    const playoffGames = games.filter(g => g.is_playoff);

    const renderGameList = (title: string, gameList: any[]) => {
        if (gameList.length === 0) return null;
        return (
            <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-1">{title}</h4>
                <div className="space-y-3">
                    {gameList.map((game) => {
                        const score1 = game.home_team_id === team1.id ? game.home_score : game.away_score;
                        const score2 = game.home_team_id === team1.id ? game.away_score : game.home_score;

                        const isWin = score1 > score2;
                        const isLoss = score1 < score2;
                        const isTie = score1 === score2 && score1 !== null;

                        return (
                            <div key={game.id} className="bg-white border border-slate-200 p-3 flex items-center justify-between group hover:border-blue-500 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[9px] text-white shrink-0 ${isWin ? 'bg-green-600' : isLoss ? 'bg-red-600' : 'bg-slate-400'
                                        }`}>
                                        {isWin ? 'W' : isLoss ? 'L' : 'T'}
                                    </div>
                                    <div>
                                        <div className="text-[9px] text-slate-400 uppercase font-black">
                                            {game.phase.season.year} {game.phase.season.competition.name} &bull; {game.phase.name}
                                        </div>
                                        <div className="text-xs font-bold">
                                            {resolveTeamIdentity(game.home_team, game.phase.season.year).name} {game.home_score} &ndash; {game.away_score} {resolveTeamIdentity(game.away_team, game.phase.season.year).name}
                                        </div>
                                    </div>
                                </div>
                                <Link
                                    href={`/games/${game.id}`}
                                    className="text-[9px] font-black uppercase text-slate-400 hover:text-blue-600 tracking-tighter"
                                >
                                    Details &rarr;
                                </Link>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

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
                        <div className="text-5xl font-black text-slate-800 mt-2">{stats.overall.wins1}</div>
                        <div className="text-xs uppercase font-black text-slate-400 mt-1">Wins</div>
                    </div>
                </div>

                <div className="flex flex-col items-center">
                    <div className="text-sm font-black uppercase text-slate-400 mb-4 tracking-widest">Head-to-Head Record</div>
                    <div className="text-4xl font-black text-slate-300 tabular-nums">
                        {stats.overall.wins1} &ndash; {stats.overall.wins2} {stats.overall.ties > 0 && `&ndash; ${stats.overall.ties}`}
                    </div>
                    <div className="mt-6 flex flex-col items-center">
                        <div className="text-xs font-black uppercase text-blue-600 mb-1">{winPct}% Success</div>
                        <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${winPct}%` }}></div>
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
                        <div className="text-5xl font-black text-slate-800 mt-2">{stats.overall.wins2}</div>
                        <div className="text-xs uppercase font-black text-slate-400 mt-1">Wins</div>
                    </div>
                </div>
            </div>

            {/* Breakdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-slate-900 tracking-widest border-b-2 border-slate-900 pb-2">Record Breakdown</h3>
                    <div className="grid grid-cols-1 gap-4">
                        {renderStatBox("Regular Season", stats.regular)}
                        {renderStatBox("Postseason / Playoffs", stats.playoff, true)}
                    </div>
                </div>

                <div className="bg-white border border-slate-200 p-6 shadow-sm flex flex-col justify-center">
                    <div className="text-center">
                        <div className="text-xs font-black uppercase text-slate-400 mb-2 tracking-widest">Total Matchups</div>
                        <div className="text-6xl font-black text-slate-900 tabular-nums">{stats.overall.played}</div>
                        <p className="text-sm text-slate-500 font-serif italic mt-4 max-w-xs mx-auto">
                            The historical series between these clubs spanning {games.length > 0 ? `${games[games.length - 1].phase.season.year} to ${games[0].phase.season.year}` : 'all recorded time'}.
                        </p>
                    </div>
                </div>
            </div>

            {/* Game Log */}
            <section>
                <h3 className="text-xl font-black uppercase border-b-2 border-slate-900 pb-2 mb-8 font-sans">Series History</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {renderGameList("Regular Season", regularGames)}
                    {renderGameList("Playoffs & Postseason", playoffGames)}
                </div>
            </section>
        </div>
    );
}
