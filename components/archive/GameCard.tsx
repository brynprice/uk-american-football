import Link from 'next/link';
import { resolveTeamIdentity } from '@/lib/utils/team-resolver';

interface GameCardProps {
    game: any;
    seasonYear?: number | null;
}

export default function GameCard({ game, seasonYear }: GameCardProps) {
    const year = seasonYear ?? game.phase?.season?.year ?? (game.date ? new Date(game.date).getFullYear() : null);
    const awayIdentity = resolveTeamIdentity(game.away_team, year);
    const homeIdentity = resolveTeamIdentity(game.home_team, year);

    const compName = game.phase?.season?.competition?.name || game.season?.competition?.name;
    const phaseName = game.away_phase_id && game.away_phase_id !== game.phase_id && game.away_phase?.name
        ? `${game.phase?.name} vs ${game.away_phase.name}`
        : game.phase?.name;

    const isAwayWinner = game.away_score !== null && game.home_score !== null && game.away_score > game.home_score;
    const isHomeWinner = game.away_score !== null && game.home_score !== null && game.home_score > game.away_score;

    return (
        <Link
            href={`/games/${game.id}`}
            className="block bg-white border border-slate-200 p-4 hover:border-blue-500 transition-all shadow-sm group"
        >
            <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-sans text-slate-500 uppercase tracking-tighter">
                        {game.date_display || (game.date ? new Date(game.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "Unknown Date")}
                        {game.time && ` • ${game.time.substring(0, 5)}`}
                    </span>
                    {compName && (
                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                            {compName}
                        </span>
                    )}
                    {phaseName && (
                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                            {phaseName}
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    {game.is_unique_score && (
                        <span className="text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded uppercase tracking-wider shadow-xs">
                            Unique
                        </span>
                    )}
                    {game.final_type === 'title' && game.title_name && (
                        <span className="text-[10px] font-black bg-amber-500 text-white px-2 py-0.5 rounded uppercase shadow-sm">
                            🏆 {game.title_name}
                        </span>
                    )}
                    {game.final_type === 'bowl' && game.title_name && (
                        <span className="text-[10px] font-black bg-blue-500 text-white px-2 py-0.5 rounded uppercase shadow-sm">
                            🏈 {game.title_name}
                        </span>
                    )}
                    {game.nickname && (
                        <span className="text-[10px] font-black bg-slate-800 text-amber-300 border border-slate-700 px-2 py-0.5 rounded italic shadow-sm">
                            "{game.nickname}"
                        </span>
                    )}
                    {(game.is_playoff || game.playoff_round) && game.final_type !== 'title' && game.final_type !== 'bowl' && (
                        <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase">
                            {game.playoff_round || "Postseason"}
                        </span>
                    )}
                    {game.is_double_header && (
                        <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase border border-amber-200">
                            DH
                        </span>
                    )}
                    {game.status && game.status.toLowerCase() === 'cancelled' && (
                        <span className="text-[10px] font-black bg-slate-200 text-slate-700 px-2 py-0.5 rounded uppercase border border-slate-300">
                            Cancelled
                        </span>
                    )}
                    {game.status && game.status.toLowerCase() === 'postponed' && (
                        <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded uppercase border border-amber-300">
                            Postponed
                        </span>
                    )}
                    {game.status && game.status.toLowerCase() === 'awarded' && (
                        <span className="text-[10px] font-black bg-purple-100 text-purple-800 px-2 py-0.5 rounded uppercase border border-purple-300">
                            Awarded
                        </span>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-center">
                <div className="flex-1 flex items-center justify-end gap-3 pr-4 text-right">
                    <span className="font-black text-lg group-hover:text-blue-700 transition-colors">
                        {awayIdentity.name}
                    </span>
                    {awayIdentity.logo_url && (
                        <div className="w-8 h-8 bg-slate-50 p-1 flex items-center justify-center shrink-0 border border-slate-100 rounded">
                            <img src={awayIdentity.logo_url} alt="" className="max-w-full max-h-full object-contain" />
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-4 bg-slate-50 px-4 py-1 rounded border border-slate-100 font-black">
                    <span className={isAwayWinner ? "text-blue-700" : ""}>
                        {game.away_score ?? "-"}
                    </span>
                    <span className="text-slate-300 font-serif font-normal italic text-sm">at</span>
                    <span className={isHomeWinner ? "text-blue-700" : ""}>
                        {game.home_score ?? "-"}
                    </span>
                </div>
                <div className="flex-1 flex items-center justify-start gap-3 pl-4 text-left">
                    {homeIdentity.logo_url && (
                        <div className="w-8 h-8 bg-slate-50 p-1 flex items-center justify-center shrink-0 border border-slate-100 rounded">
                            <img src={homeIdentity.logo_url} alt="" className="max-w-full max-h-full object-contain" />
                        </div>
                    )}
                    <span className="font-black text-lg group-hover:text-blue-700 transition-colors">
                        {homeIdentity.name}
                    </span>
                </div>
            </div>
        </Link>
    );
}
