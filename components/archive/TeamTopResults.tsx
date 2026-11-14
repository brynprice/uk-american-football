import Link from 'next/link';
import { TeamExtremeGame } from '@/lib/utils/team-records';

interface TeamTopResultsProps {
    topWins: TeamExtremeGame[];
    topLosses: TeamExtremeGame[];
}

type ResultVariant = 'win' | 'loss';

const VARIANT_CONFIG: Record<
    ResultVariant,
    {
        title: string;
        subtitle: string;
        emptyMessage: string;
        headerBg: string;
        headerTitle: string;
        headerSubtitle: string;
        rankBadge: string;
        marginBadge: string;
        marginPrefix: string;
    }
> = {
    win: {
        title: 'Top 3 Wins',
        subtitle: 'Biggest Margins',
        emptyMessage: 'No recorded competitive wins yet.',
        headerBg: 'bg-emerald-950 border-emerald-900',
        headerTitle: 'text-emerald-300',
        headerSubtitle: 'text-emerald-200/80',
        rankBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        marginBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        marginPrefix: '+',
    },
    loss: {
        title: 'Top 3 Losses',
        subtitle: 'Heaviest Defeats',
        emptyMessage: 'No recorded competitive losses.',
        headerBg: 'bg-rose-950 border-rose-900',
        headerTitle: 'text-rose-300',
        headerSubtitle: 'text-rose-200/80',
        rankBadge: 'bg-rose-100 text-rose-800 border-rose-200',
        marginBadge: 'bg-rose-50 text-rose-700 border-rose-200',
        marginPrefix: '-',
    },
};

function formatGameDate(entry: TeamExtremeGame): string {
    if (entry.game.date_display) return entry.game.date_display;
    if (entry.game.date) {
        const parsed = Date.parse(entry.game.date);
        if (Number.isFinite(parsed)) {
            return new Date(parsed).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                timeZone: 'UTC',
            });
        }
    }
    return entry.seasonYear ? `${entry.seasonYear} Season` : 'Date Unknown';
}

function ResultsPanel({
    variant,
    entries,
}: {
    variant: ResultVariant;
    entries: TeamExtremeGame[];
}) {
    const style = VARIANT_CONFIG[variant];

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
            <div className={`${style.headerBg} text-white px-4 py-3 flex items-center justify-between border-b`}>
                <h3 className={`text-xs font-black uppercase tracking-wider font-sans ${style.headerTitle}`}>
                    {style.title}
                </h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider font-sans ${style.headerSubtitle}`}>
                    {style.subtitle}
                </span>
            </div>

            {entries.length === 0 ? (
                <div className="p-6 text-xs text-slate-400 italic font-sans">
                    {style.emptyMessage}
                </div>
            ) : (
                <div className="divide-y divide-slate-100">
                    {entries.map((entry, idx) => {
                        const { game, isHome, teamScore, oppScore, margin, opponentIdentity } = entry;
                        const contextLabel = [entry.competitionName, entry.phaseName]
                            .filter(Boolean)
                            .join(' • ');

                        return (
                            <Link
                                key={game.id}
                                href={`/games/${game.id}`}
                                className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors group"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <span
                                        className={`w-7 h-7 rounded-full border flex items-center justify-center font-mono font-black text-xs shrink-0 ${style.rankBadge}`}
                                    >
                                        #{idx + 1}
                                    </span>

                                    {opponentIdentity.logo_url ? (
                                        <div className="w-8 h-8 bg-white p-0.5 rounded border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={opponentIdentity.logo_url}
                                                alt={`${opponentIdentity.name} Logo`}
                                                className="max-w-full max-h-full object-contain"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-[8px] font-black text-slate-300 shrink-0 font-sans">
                                            LOGO
                                        </div>
                                    )}

                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug break-words">
                                            <span className="text-[10px] font-black uppercase text-slate-400 font-sans mr-1.5">
                                                {isHome ? 'vs' : '@'}
                                            </span>
                                            <span>{opponentIdentity.name}</span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] font-sans text-slate-500">
                                            <span>{formatGameDate(entry)}</span>
                                            {contextLabel && (
                                                <>
                                                    <span aria-hidden="true">&bull;</span>
                                                    <span className="font-medium text-slate-600">{contextLabel}</span>
                                                </>
                                            )}
                                            {game.final_type === 'title' && game.title_name && (
                                                <span className="bg-amber-100 text-amber-900 border border-amber-200 font-black uppercase px-1.5 py-0.5 rounded text-[9px]">
                                                    🏆 {game.title_name}
                                                </span>
                                            )}
                                            {game.final_type === 'bowl' && game.title_name && (
                                                <span className="bg-blue-100 text-blue-900 border border-blue-200 font-black uppercase px-1.5 py-0.5 rounded text-[9px]">
                                                    🏈 {game.title_name}
                                                </span>
                                            )}
                                            {entry.isPlayoff && game.final_type !== 'title' && game.final_type !== 'bowl' && (
                                                <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 font-black uppercase px-1.5 py-0.5 rounded text-[9px]">
                                                    {game.playoff_round || 'Playoffs'}
                                                </span>
                                            )}
                                            {game.is_double_header && (
                                                <span className="bg-amber-100 text-amber-800 border border-amber-200 font-black uppercase px-1.5 py-0.5 rounded text-[9px]">
                                                    DH
                                                </span>
                                            )}
                                            {game.nickname && (
                                                <span className="bg-slate-800 text-amber-300 border border-slate-700 font-black italic px-1.5 py-0.5 rounded text-[9px]">
                                                    {game.nickname}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end shrink-0 pl-2">
                                    <span className="text-base font-black font-mono tabular-nums text-slate-900 whitespace-nowrap">
                                        {teamScore} &ndash; {oppScore}
                                    </span>
                                    <span
                                        className={`text-[10px] font-black font-mono tabular-nums px-1.5 py-0.5 rounded border mt-0.5 whitespace-nowrap ${style.marginBadge}`}
                                    >
                                        {style.marginPrefix}{margin}
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/**
 * Displays a team's top 3 competitive wins and top 3 competitive losses by margin.
 */
export default function TeamTopResults({ topWins, topLosses }: TeamTopResultsProps) {
    if (topWins.length === 0 && topLosses.length === 0) {
        return null;
    }

    return (
        <section className="mb-12" aria-label="All-Time Top Results">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-slate-900 pb-2 mb-6">
                <h2 className="text-xl font-black uppercase font-sans">
                    All-Time Top Results
                </h2>
                <span className="text-[10px] font-bold text-slate-400 font-sans uppercase tracking-wider">
                    Largest Margins &bull; Competitive League &amp; Playoffs
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ResultsPanel variant="win" entries={topWins} />
                <ResultsPanel variant="loss" entries={topLosses} />
            </div>
        </section>
    );
}
