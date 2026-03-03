import Link from 'next/link';

interface Phase {
    id: string;
    name: string;
    type: string | null;
    parent_phase_id: string | null;
    ordinal: number;
}

interface PhaseViewProps {
    phases: Phase[];
    parentPhaseId?: string | null;
    seasonId: string;
}

export default function PhaseView({ phases, parentPhaseId = null, seasonId }: PhaseViewProps) {
    const currentPhases = phases
        .filter(p => p.parent_phase_id === parentPhaseId)
        .sort((a, b) => a.ordinal - b.ordinal);

    if (currentPhases.length === 0) return null;

    return (
        <div className={`space-y-8 ${parentPhaseId ? 'pl-6 border-l-2 border-slate-200 mt-6' : ''}`}>
            {currentPhases.map((phase) => (
                <div key={phase.id} className="relative">
                    <div className="flex items-center gap-3 mb-4">
                        <h3 className={`font-black uppercase tracking-tight ${parentPhaseId ? 'text-lg text-slate-700' : 'text-2xl text-slate-900'
                            }`}>
                            {phase.name}
                        </h3>
                        {phase.type && (
                            <span className="text-[10px] font-sans font-black bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded leading-none">
                                {phase.type}
                            </span>
                        )}
                    </div>

                    {/* Simple placeholder for phase content (standings/games would go here) */}
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Link
                            href={`/seasons/${seasonId}/phases/${phase.id}`}
                            className="text-sm font-bold text-blue-600 hover:underline"
                        >
                            View Standings & Games &rarr;
                        </Link>
                    </div>

                    {/* Recursive call for children */}
                    <PhaseView phases={phases} parentPhaseId={phase.id} seasonId={seasonId} />
                </div>
            ))}
        </div>
    );
}
