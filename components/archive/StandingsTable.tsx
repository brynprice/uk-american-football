import Link from 'next/link';
import { resolveTeamIdentity } from '@/lib/utils/team-resolver';

interface StandingsTableProps {
    participations: any[];
    games: any[];
    phaseName: string;
}

export default function StandingsTable({ participations, games, phaseName }: StandingsTableProps) {
    if (!participations || participations.length === 0) return null;

    const standings = participations.map((p: any) => {
        // Check for manual stats first
        const hasManualStats = p.wins !== null && p.losses !== null;

        let wins = 0, losses = 0, ties = 0, pf = 0, pa = 0;

        if (hasManualStats) {
            wins = p.wins || 0;
            losses = p.losses || 0;
            ties = p.ties || 0;
            pf = p.points_for || 0;
            pa = p.points_against || 0;
        } else {
            const teamGames = games.filter((g: any) =>
                g.status?.toLowerCase() === 'completed' &&
                (g.home_team_id === p.team_id || g.away_team_id === p.team_id)
            );

            teamGames.forEach((g: any) => {
                const isHome = g.home_team_id === p.team_id;
                const score = isHome ? g.home_score : g.away_score;
                const oppScore = isHome ? g.away_score : g.home_score;
                const multiplier = g.is_double_header ? 2 : 1;

                if (score !== null && oppScore !== null) {
                    pf += score * multiplier;
                    pa += oppScore * multiplier;
                    if (score > oppScore) wins += multiplier;
                    else if (score < oppScore) losses += multiplier;
                    else ties += multiplier;
                }
            });
        }

        const gp = wins + losses + ties;
        const winPct = gp > 0 ? (wins / gp + 1 - losses / gp) / 2 : 0;

        return { ...p, wins, losses, ties, pf, pa, gp, winPct };
    }).sort((a: any, b: any) => b.winPct - a.winPct || b.pf - a.pf);

    return (
        <section className="mb-12">
            <h2 className="text-xl font-bold mb-4 font-sans uppercase tracking-widest border-b-2 border-slate-900 pb-1">
                {phaseName ? `${phaseName} Standings` : "Phase Standings"}
            </h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-sans text-sm">
                    <thead>
                        <tr className="border-b border-slate-300 bg-slate-50">
                            <th className="py-2 px-4 font-black">Team</th>
                            <th className="py-2 px-2 font-black text-center">GP</th>
                            <th className="py-2 px-2 font-black text-center">W</th>
                            <th className="py-2 px-2 font-black text-center">L</th>
                            <th className="py-2 px-2 font-black text-center">T</th>
                            <th className="py-2 px-2 font-black text-center">PF</th>
                            <th className="py-2 px-2 font-black text-center">PA</th>
                            <th className="py-2 px-2 font-black text-center">Win %</th>
                            <th className="py-2 px-4 font-black">Head Coach</th>
                        </tr>
                    </thead>
                    <tbody>
                        {standings.map((p: any) => (
                            <tr key={p.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                                <td className="py-3 px-4">
                                    <Link href={`/teams/${p.team_id}`} className="font-bold hover:text-blue-600">
                                        {resolveTeamIdentity({ ...p.team, team_aliases: p.team?.team_aliases || [] }, games[0]?.date).name}
                                    </Link>
                                </td>
                                <td className="py-3 px-2 text-center font-mono">{p.gp}</td>
                                <td className="py-3 px-2 text-center font-bold">{p.wins}</td>
                                <td className="py-3 px-2 text-center">{p.losses}</td>
                                <td className="py-3 px-2 text-center text-slate-400">{p.ties}</td>
                                <td className="py-3 px-2 text-center text-slate-600">{p.pf}</td>
                                <td className="py-3 px-2 text-center text-slate-600">{p.pa}</td>
                                <td className="py-3 px-2 text-center font-black text-blue-700">
                                    {p.winPct.toFixed(3).replace(/^0/, '')}
                                </td>
                                <td className="py-3 px-4 text-slate-600 italic">
                                    {p.person?.display_name || "Unknown"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
