import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const person = await ArchiveService.getPersonDetails(id);

    // Combine and sort career events (participations and game overrides)
    const careerEvents = [
        ...person.participations.map((p: any) => ({
            type: 'season',
            year: p.phase.season.year,
            competition: p.phase.season.competition.name,
            team: p.phase.season.competition.name, // Should be team name
            role: 'Head Coach',
            phase: p.phase.name,
            id: p.id
        })),
        ...person.game_staff.map((s: any) => ({
            type: 'game',
            year: s.game.date ? new Date(s.game.date).getFullYear() : s.game.phase.season.year,
            competition: s.game.phase.season.competition.name,
            team: 'Team Name Placeholder', // Would ideally be fetched
            role: s.role.replace('_', ' '),
            game: s.game,
            id: s.id
        }))
    ].sort((a, b) => b.year - a.year);

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

                <div className="bg-slate-50 p-6 border-t-4 border-slate-900">
                    <h4 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-tighter">Biographical Notes</h4>
                    <div className="text-sm font-serif leading-relaxed text-slate-700 italic">
                        {person.bio || "No biographical information has been recorded for this individual yet."}
                    </div>
                </div>
            </div>
        </ArchiveLayout>
    );
}
