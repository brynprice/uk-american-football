import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import { resolveTeamIdentity } from '@/lib/utils/team-resolver';

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const person = await ArchiveService.getPersonDetails(id);

    const gamesCoached = await ArchiveService.getPersonGamesAsCoach(id);

    // Combine and sort career events (participations and game overrides)
    const seasonEvents = person.participations.map((p: any) => ({
        type: 'season',
        year: p.phase.season.year,
        competition: p.phase.season.competition.name,
        team: p.team ? resolveTeamIdentity({ ...p.team, team_aliases: p.team.team_aliases || [] }, `${p.phase.season.year}-01-01`).name : 'Unknown Team',
        role: 'Head Coach',
        phase: p.phase.name,
        id: p.id
    }));

    // Only include game overrides if the coach is not already the season-defined coach for that team/phase
    const gameEvents = person.game_staff
        .filter((s: any) => !person.participations.some((p: any) => p.phase_id === s.game.phase_id && p.team_id === s.team_id))
        .map((s: any) => ({
            type: 'game',
            year: s.game.date ? new Date(s.game.date).getFullYear() : s.game.phase.season.year,
            competition: s.game.phase.season.competition.name,
            team: 'Game Override',
            role: s.role.replace('_', ' '),
            game: s.game,
            id: s.id
        }));

    const careerEvents = [...seasonEvents, ...gameEvents].sort((a, b) => b.year - a.year);

    // Calculate Coaching Record (Regular Season)
    const regularSeasonGames = gamesCoached.filter(g => g.is_playoff === false);
    let wins = 0;
    let losses = 0;
    let ties = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;

    regularSeasonGames.forEach(g => {
        const multiplier = g.is_double_header ? 2 : 1;
        const isHome = g.coach_team_id === g.home_team_id;
        const pf = isHome ? g.home_score : g.away_score;
        const pa = isHome ? g.away_score : g.home_score;

        if (pf !== null && pa !== null) {
            pointsFor += pf * multiplier;
            pointsAgainst += pa * multiplier;

            if (pf > pa) wins += multiplier;
            else if (pf < pa) losses += multiplier;
            else ties += multiplier;
        }
    });

    const totalGames = wins + losses + ties;
    const winPercent = totalGames > 0 ? ((wins + (ties / 2)) / totalGames * 100).toFixed(1) : "0.0";

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
                        <div className="relative border-l-2 border-slate-200 ml-3 pl-8 space-y-12">
                            {careerEvents.map((event: any, idx) => (
                                <div key={idx} className="relative">
                                    {/* Timeline node */}
                                    <div className="absolute -left-[41px] top-1 w-4 h-4 rounded-full bg-white border-4 border-slate-900"></div>

                                    <div className="font-black text-2xl text-slate-300 -mt-1 mb-2">{event.year}</div>
                                    <div className="bg-white p-6 border border-slate-200 shadow-sm hover:border-blue-500 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-black uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-sans">
                                                {event.role}
                                            </span>
                                            {event.type === 'game' && (
                                                <span className="text-[10px] font-black uppercase bg-red-50 text-red-600 px-2 py-0.5 rounded italic">
                                                    Game-Specific Override
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="text-xl font-bold mb-1">{event.competition}</h4>
                                        <div className="text-sm font-bold text-slate-700 mb-1">{event.team}</div>
                                        <p className="text-slate-600 font-serif">
                                            {event.type === 'season' ? `Led team in ${event.phase}` : `Staff role for specific game record`}
                                        </p>
                                    </div>
                                </div>
                            ))}

                            {careerEvents.length === 0 && (
                                <div className="ml-[-2rem] text-slate-400 italic">No career records found for this person.</div>
                            )}
                        </div>
                    </section>
                </div>

                <div className="space-y-6">
                    {totalGames > 0 && (
                        <div className="bg-slate-900 text-white p-6 shadow-sm">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Coaching Record (Regular Season)</h4>
                            <div className="flex flex-col gap-4">
                                <div>
                                    <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">W - L - T</div>
                                    <div className="text-3xl font-black">{wins} - {losses} - {ties}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4">
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Win %</div>
                                        <div className="text-xl font-bold text-slate-200">{winPercent}%</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">PF / PA</div>
                                        <div className="text-xl font-bold text-slate-200">{pointsFor} / {pointsAgainst}</div>
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
                                                        {hof.team ? resolveTeamIdentity({ ...hof.team, team_aliases: hof.team.team_aliases || [] }, hof.year_inducted ? `${hof.year_inducted}-01-01` : null).name : 'Unknown Team'}
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
                                                        {jersey.team ? resolveTeamIdentity({ ...jersey.team, team_aliases: jersey.team.team_aliases || [] }, jersey.year_retired ? `${jersey.year_retired}-01-01` : null).name : 'Unknown Team'} <span className="inline-block ml-2 px-1.5 py-0.5 bg-slate-800 text-white rounded text-xs shadow-sm border border-slate-700">#{jersey.jersey_number}</span>
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
