'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import { sortPhasesInTreeOrder } from '@/lib/utils/phase-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface PhaseRow {
    id: string;
    name: string;
    type: string | null;
    max_games_per_team: number | null;
    games_validated: boolean;
    parent_phase_id: string | null;
    ordinal: number;
}

interface SeasonOption {
    id: string;
    year: number;
    competition_name: string;
}

export default function SetGameCountsPage() {
    const [seasons, setSeasons] = useState<SeasonOption[]>([]);
    const [selectedSeason, setSelectedSeason] = useState('');
    const [phases, setPhases] = useState<PhaseRow[]>([]);
    const [bulkValue, setBulkValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [editValues, setEditValues] = useState<Record<string, string>>({});

    useEffect(() => {
        loadSeasons();
    }, []);

    useEffect(() => {
        if (selectedSeason) loadPhases(selectedSeason);
    }, [selectedSeason]);

    async function loadSeasons() {
        const { data } = await supabase
            .from('seasons')
            .select('id, year, competition:competitions(name)')
            .order('year', { ascending: false });

        if (data) {
            setSeasons(
                (data as any[]).map(s => ({
                    id: s.id,
                    year: s.year,
                    competition_name: s.competition?.name || 'Unknown'
                }))
            );
        }
    }

    async function loadPhases(seasonId: string) {
        setLoading(true);
        setMessage('');

        const { data } = await supabase
            .from('phases')
            .select('id, name, type, max_games_per_team, games_validated, parent_phase_id, ordinal')
            .eq('season_id', seasonId);

        if (data) {
            setPhases(data as PhaseRow[]);
            const vals: Record<string, string> = {};
            data.forEach((p: any) => {
                vals[p.id] = p.max_games_per_team !== null ? String(p.max_games_per_team) : '';
            });
            setEditValues(vals);
        }
        setLoading(false);
    }

    async function handleBulkSet() {
        if (!bulkValue) return;
        const val = parseInt(bulkValue);
        if (isNaN(val) || val <= 0) {
            setMessage('Please enter a valid positive number.');
            return;
        }

        // Apply to all non-playoff leaf phases (phases with no children)
        const parentIds = new Set(phases.map(p => p.parent_phase_id).filter(Boolean));
        const leafPhases = phases.filter(p => !parentIds.has(p.id));
        const regularLeafs = leafPhases.filter(p => {
            const name = p.name.toLowerCase();
            const type = (p.type || '').toLowerCase();
            return !name.includes('playoff') && type !== 'playoffs';
        });

        if (regularLeafs.length === 0) {
            setMessage('No regular season leaf phases found.');
            return;
        }

        setSaving(true);
        const ids = regularLeafs.map(p => p.id);

        const res = await fetch('/api/admin/phases/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phaseIds: ids, max_games_per_team: val }),
        });
        const result = await res.json();

        if (!res.ok) {
            setMessage(`Error: ${result.error}`);
        } else {
            setMessage(`Set max_games_per_team = ${val} for ${ids.length} regular season phases.`);
            const newVals = { ...editValues };
            ids.forEach(id => { newVals[id] = String(val); });
            setEditValues(newVals);
            loadPhases(selectedSeason);
        }
        setSaving(false);
    }

    async function handleSingleSave(phaseId: string) {
        const val = editValues[phaseId];
        const numVal = val ? parseInt(val) : null;

        setSaving(true);
        const res = await fetch('/api/admin/phases/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phaseId, max_games_per_team: numVal }),
        });
        const result = await res.json();

        if (!res.ok) {
            setMessage(`Error updating phase: ${result.error}`);
        } else {
            setMessage(`Updated successfully.`);
            loadPhases(selectedSeason);
        }
        setSaving(false);
    }

    const isPlayoff = (p: PhaseRow) => {
        const name = p.name.toLowerCase();
        const type = (p.type || '').toLowerCase();
        return name.includes('playoff') || type === 'playoffs';
    };

    function renderPhaseTree(parentId: string | null, depth: number): React.ReactNode {
        const children = phases
            .filter(p => p.parent_phase_id === parentId)
            .sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0));

        if (children.length === 0) return null;

        return (
            <div className={`space-y-3 ${depth > 0 ? 'pl-6 border-l-2 border-slate-200 mt-3' : ''}`}>
                {children.map(phase => {
                    const hasKids = phases.some(p => p.parent_phase_id === phase.id);

                    return (
                        <div key={phase.id}>
                            {/* Phase header / row */}
                            <div
                                className={`flex items-center justify-between gap-4 p-4 rounded border ${isPlayoff(phase)
                                    ? 'bg-indigo-50 border-indigo-200'
                                    : 'bg-white border-slate-200'
                                    }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className={`font-bold truncate ${hasKids ? 'text-base uppercase tracking-tight' : 'text-sm'}`}>
                                        {phase.name}
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                        {phase.type && (
                                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-sans">
                                                {phase.type}
                                            </span>
                                        )}
                                        {phase.games_validated && (
                                            <span className="text-[10px] font-black bg-green-100 text-green-700 px-1.5 py-0.5 rounded uppercase font-sans">
                                                Validated
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <input
                                        type="number"
                                        min="0"
                                        value={editValues[phase.id] || ''}
                                        onChange={(e) => setEditValues(prev => ({ ...prev, [phase.id]: e.target.value }))}
                                        placeholder="—"
                                        className="w-20 border border-slate-200 px-2 py-1.5 rounded text-sm font-bold text-center"
                                    />
                                    <button
                                        onClick={() => handleSingleSave(phase.id)}
                                        disabled={saving}
                                        className="text-[10px] font-black uppercase bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                            {/* Recursively render children */}
                            {hasKids && renderPhaseTree(phase.id, depth + 1)}
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <ArchiveLayout>
            <div className="mb-8">
                <Link href="/admin/game-counts" className="text-blue-600 hover:underline text-sm mb-4 inline-block">&larr; Game Count Validator</Link>
                <h1 className="text-4xl font-black mb-2 uppercase italic tracking-tighter">Set Max Games Per Team</h1>
                <p className="text-slate-500 font-sans">
                    Configure expected game counts for phases. Use the bulk setter for regular season phases, or set values individually.
                </p>
            </div>

            {message && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded text-sm font-sans">
                    {message}
                </div>
            )}

            {/* Season Selector */}
            <div className="bg-white border-2 border-slate-900 p-6 mb-8 shadow-sm">
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 font-sans">Select Season</label>
                <select
                    value={selectedSeason}
                    onChange={(e) => setSelectedSeason(e.target.value)}
                    className="w-full border border-slate-200 px-3 py-2 rounded text-sm font-bold bg-white"
                >
                    <option value="">-- Choose a Season --</option>
                    {seasons.map(s => (
                        <option key={s.id} value={s.id}>
                            {s.year} — {s.competition_name}
                        </option>
                    ))}
                </select>
            </div>

            {selectedSeason && !loading && phases.length > 0 && (
                <>
                    {/* Bulk Setter */}
                    <div className="bg-slate-50 border border-slate-200 p-6 mb-8 rounded">
                        <h3 className="text-sm font-black uppercase text-slate-600 mb-3 font-sans">Bulk Set Regular Season Phases</h3>
                        <div className="flex items-end gap-4">
                            <div className="flex-1">
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 font-sans">Max Games Per Team</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={bulkValue}
                                    onChange={(e) => setBulkValue(e.target.value)}
                                    placeholder="e.g. 8"
                                    className="w-full border border-slate-200 px-3 py-2 rounded text-sm font-bold"
                                />
                            </div>
                            <button
                                onClick={handleBulkSet}
                                disabled={saving || !bulkValue}
                                className="bg-slate-900 text-white text-xs font-black uppercase px-6 py-2.5 rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Apply to All Regular Season'}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 font-sans italic">
                            This will set the value for all non-playoff leaf phases in the selected season.
                        </p>
                    </div>

                    {/* Individual Phase List — nested tree like Season page */}
                    <div className="space-y-6">
                        <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest font-sans border-b border-slate-200 pb-2">
                            All Phases ({phases.length})
                        </h3>
                        {renderPhaseTree(null, 0)}
                    </div>
                </>
            )}

            {selectedSeason && loading && (
                <div className="text-center py-12 text-slate-400 font-sans">Loading phases...</div>
            )}

            {selectedSeason && !loading && phases.length === 0 && (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 text-center text-slate-400 font-serif italic">
                    No phases found for this season.
                </div>
            )}
        </ArchiveLayout>
    );
}
