'use client';

import Link from 'next/link';
import { useState } from 'react';

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
    initiallyExpanded?: boolean;
}

export default function PhaseView({ phases, parentPhaseId = null, seasonId, initiallyExpanded = false }: PhaseViewProps) {
    const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});

    const currentPhases = phases
        .filter(p => p.parent_phase_id === parentPhaseId)
        .sort((a, b) => a.ordinal - b.ordinal);

    if (currentPhases.length === 0) return null;

    const togglePhase = (id: string) => {
        setExpandedPhases(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const hasChildren = (id: string) => {
        return phases.some(p => p.parent_phase_id === id);
    };

    return (
        <div className={`space-y-6 ${parentPhaseId ? 'pl-6 border-l-2 border-slate-200 mt-4' : ''}`}>
            {currentPhases.map((phase) => {
                const isExpanded = !!expandedPhases[phase.id];
                const canExpand = hasChildren(phase.id);

                return (
                    <div key={phase.id} className="relative">
                        <div
                            className={`flex items-center gap-3 mb-3 ${canExpand ? 'cursor-pointer group' : ''}`}
                            onClick={() => canExpand && togglePhase(phase.id)}
                        >
                            {canExpand && (
                                <span className={`transition-transform duration-200 text-slate-400 group-hover:text-blue-600 ${isExpanded ? 'rotate-90' : ''}`}>
                                    ▶
                                </span>
                            )}
                            <h3 className={`font-black uppercase tracking-tight transition-colors ${parentPhaseId ? 'text-lg text-slate-700' : 'text-2xl text-slate-900'
                                } ${canExpand ? 'group-hover:text-blue-700' : ''}`}>
                                {phase.name}
                            </h3>
                            {phase.type && (
                                <span className="text-[10px] font-sans font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded leading-none">
                                    {phase.type}
                                </span>
                            )}
                        </div>

                        {isExpanded && (
                            <>
                                {/* Link to details */}
                                <div className="mb-4">
                                    <Link
                                        href={`/phases/${phase.id}`}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    >
                                        View Details &rarr;
                                    </Link>
                                </div>

                                {/* Recursive call for children */}
                                <PhaseView phases={phases} parentPhaseId={phase.id} seasonId={seasonId} />
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

