import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import { resolveTeamIdentity } from '@/lib/utils/team-resolver';
import TeamSeasonHistory from '@/components/archive/TeamSeasonHistory';
import { isPlayoffPhase } from '@/lib/utils/phase-utils';
export const revalidate = 3600; // 1 hour

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const person = await ArchiveService.getPersonDetails(id);

    const gamesCoached = await ArchiveService.getPersonGamesAsCoach(id);

    // Calculate Regular Season Coaching Record
    const calculateCoachingStats = () => {
        const statsByPhase = new Map<string, { wins: number; losses: number; ties: number; pf: number; pa: number; hasGames: boolean }>();

        // 1. Process regular season games coached by this person
        (gamesCoached || []).forEach((g: any) => {
            const coachTeamId = g.coach_team_id || (g.home_team_id === g.coach_team_id ? g.home_team_id : g.away_team_id);
            const isHome = coachTeamId === g.home_team_id;
            const phase = isHome ? (g.phase || g.away_phase) : (g.away_phase || g.phase);
            const isPlayoff = g.is_playoff || isPlayoffPhase(phase || {});
            if (isPlayoff) return;
            if (g.status?.toLowerCase() !== 'completed' && g.status?.toLowerCase() !== 'awarded') return;

            const phaseId = isHome ? g.phase_id : (g.away_phase_id || g.phase_id);
            if (!phaseId) return;

            const teamScore = isHome ? g.home_score : g.away_score;
            const oppScore = isHome ? g.away_score : g.home_score;
            const multiplier = g.is_double_header ? 2 : 1;

            if (teamScore === null || oppScore === null) return;

            const current = statsByPhase.get(phaseId) || { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, hasGames: true };
            current.hasGames = true;
            current.pf += teamScore;
            current.pa += oppScore;
            if (teamScore > oppScore) current.wins += multiplier;
            else if (teamScore < oppScore) current.losses += multiplier;
            else current.ties += multiplier;

            statsByPhase.set(phaseId, current);
        });

        // 2. For phases without game logs, fall back to official participation standings if this person was the head coach
        (person.participations || []).forEach((p: any) => {
            const isPlayoff = isPlayoffPhase(p.phase || {});
            if (isPlayoff) return;

            const phaseId = p.phase_id || p.phase?.id;
            if (!phaseId) return;

            // If we already counted individual game logs for this phase, do not overwrite/double-count
            if (statsByPhase.has(phaseId) && statsByPhase.get(phaseId)!.hasGames) return;

            if (p.wins !== null && p.losses !== null && p.wins !== undefined && p.losses !== undefined) {
                statsByPhase.set(phaseId, {
                    wins: p.wins || 0,
                    losses: p.losses || 0,
                    ties: p.ties || 0,
                    pf: p.points_for || 0,
                    pa: p.points_against || 0,
                    hasGames: false
                });
            }
        });

        return Array.from(statsByPhase.values()).reduce((acc, curr) => ({
            wins: acc.wins + curr.wins,
            losses: acc.losses + curr.losses,
            ties: acc.ties + curr.ties,
            pf: acc.pf + curr.pf,
            pa: acc.pa + curr.pa,
            totalGames: acc.totalGames + (curr.wins + curr.losses + curr.ties)
        }), { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, totalGames: 0 });
    };

    const coachingStats = calculateCoachingStats();
    const winPercent = coachingStats.totalGames > 0
        ? ((coachingStats.wins + (coachingStats.ties / 2)) / coachingStats.totalGames * 100).toFixed(1)
        : "0.0";

    return (
        <ArchiveLayout>
            <div className="mb-12">
                <h1 className="text-5xl font-black mb-2">{person.display_name}</h1>
                <div className="text-slate-500 font-sans uppercase tracking-widest text-xs flex gap-4">
                    <span>{person.first_name} {person.last_name}</span>
                    <span className="font-black text-blue-600">Archival Record</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="md:col-span-2">
                    <section>
                        <h3 className="text-xl font-black uppercase border-b-2 border-slate-900 pb-2 mb-6 font-sans">Career Timeline</h3>
                        <TeamSeasonHistory
                            personId={id}
                            participations={person.participations}
                            games={gamesCoached}
                            emptyMessage="No career records found for this person."
                        />
                    </section>
                </div>

                <div className="space-y-6">
                    {coachingStats.totalGames > 0 && (
                        <div className="bg-slate-900 text-white p-6 shadow-sm">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Coaching Record (Regular Season)</h4>
                            <div className="flex flex-col gap-4">
                                <div>
                                    <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">W - L - T</div>
                                    <div className="text-3xl font-black">{coachingStats.wins} - {coachingStats.losses} - {coachingStats.ties}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4">
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Win %</div>
                                        <div className="text-xl font-bold text-slate-200">{winPercent}%</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">PF / PA</div>
                                        <div className="text-xl font-bold text-slate-200">{coachingStats.pf} / {coachingStats.pa}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-slate-50 p-6 border-t-4 border-slate-900">
                        <h4 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-tighter">Biographical Notes</h4>
                        <div className="text-sm font-serif leading-relaxed text-slate-700 italic">
                            {person.bio || "No biographical information has been recorded for this individual yet."}
                        </div>
                    </div>

                    {(person.hall_of_fame?.length > 0 || person.retired_jerseys?.length > 0) && (
                        <div className="bg-amber-50 p-6 border-t-4 border-amber-500 shadow-sm">
                            <h4 className="text-xs font-black uppercase text-amber-800 mb-4 tracking-tighter flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L5.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 014 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L8 4.323V3a1 1 0 011-1zm-5.16 10.617l-1.472 4.593A1.988 1.988 0 004 17a1.988 1.988 0 001.632-.29l-1.472-4.593zM15 17a1.988 1.988 0 001.632-.29l-1.472-4.593-1.472 4.593A1.988 1.988 0 0015 17z" clipRule="evenodd" />
                                </svg>
                                Awards & Honours
                            </h4>

                            <div className="space-y-6">
                                {person.hall_of_fame?.length > 0 && (
                                    <div>
                                        <h5 className="text-sm font-bold text-slate-800 mb-2 border-b border-amber-200 pb-1">Hall of Fame Inductions</h5>
                                        <ul className="space-y-3 mt-3">
                                            {person.hall_of_fame.map((hof: any) => (
                                                <li key={hof.id} className="text-sm">
                                                    <div className="font-bold text-amber-900">
                                                        {hof.team ? resolveTeamIdentity({ ...hof.team, team_aliases: hof.team.team_aliases || [] }, hof.year_inducted).name : 'Unknown Team'}
                                                    </div>
                                                    <div className="text-slate-600">
                                                        Inducted: <span className="font-semibold">{hof.year_inducted || 'Unknown'}</span>
                                                        {hof.seasons_with_team && <span className="ml-2 text-xs italic text-slate-500">({hof.seasons_with_team})</span>}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {person.retired_jerseys?.length > 0 && (
                                    <div>
                                        <h5 className="text-sm font-bold text-slate-800 mb-2 border-b border-amber-200 pb-1">Retired Jerseys</h5>
                                        <ul className="space-y-3 mt-3">
                                            {person.retired_jerseys.map((jersey: any) => (
                                                <li key={jersey.id} className="text-sm">
                                                    <div className="font-bold text-amber-900">
                                                        {jersey.team ? resolveTeamIdentity({ ...jersey.team, team_aliases: jersey.team.team_aliases || [] }, jersey.year_retired).name : 'Unknown Team'} <span className="inline-block ml-2 px-1.5 py-0.5 bg-slate-800 text-white rounded text-xs shadow-sm border border-slate-700">#{jersey.jersey_number}</span>
                                                    </div>
                                                    <div className="text-slate-600">
                                                        Retired: <span className="font-semibold">{jersey.year_retired || 'Unknown'}</span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ArchiveLayout>
    );
}
