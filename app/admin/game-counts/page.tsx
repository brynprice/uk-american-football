'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import ArchiveLayout from '@/components/archive/ArchiveLayout';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface TeamGameCount {
    team_id: string;
    team_name: string;
    game_count: number;
}

interface FlaggedPhase {
    id: string;
    name: string;
    max_games_per_team: number;
    games_validated: boolean;
    season_year: number;
    competition_name: string;
    season_id: string;
    teams: TeamGameCount[];
}

export default function GameCountsPage() {
    const [flaggedPhases, setFlaggedPhases] = useState<FlaggedPhase[]>([]);
    const [loading, setLoading] = useState(true);
    const [validating, setValidating] = useState<string | null>(null);
    const [showValidated, setShowValidated] = useState(false);

    useEffect(() => {
        loadFlaggedPhases();
    }, [showValidated]);

    async function loadFlaggedPhases() {
        setLoading(true);

        // 1. Get all phases with max_games_per_team set
        let query = supabase
            .from('phases')
            .select('id, name, max_games_per_team, games_validated, season:seasons(id, year, competition:competitions(name))')
            .not('max_games_per_team', 'is', null);

        if (!showValidated) {
            query = query.eq('games_validated', false);
        }

        const { data: phases, error: phaseError } = await query;

        if (phaseError || !phases) {
            console.error('Error loading phases:', phaseError);
            setLoading(false);
            return;
        }

        // 2. For each phase, count games per team
        const results: FlaggedPhase[] = [];

        for (const phase of phases as any[]) {
            const { data: games } = await supabase
                .from('games')
                .select('home_team_id, away_team_id, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
                .eq('phase_id', phase.id)
                .neq('status', 'anomaly');

            if (!games || games.length === 0) continue;

            // Count games per team
            const teamCounts = new Map<string, { name: string; count: number }>();

            for (const game of games as any[]) {
                const homeId = game.home_team_id;
                const awayId = game.away_team_id;
                const homeName = game.home_team?.name || 'Unknown';
                const awayName = game.away_team?.name || 'Unknown';

                if (!teamCounts.has(homeId)) teamCounts.set(homeId, { name: homeName, count: 0 });
                if (!teamCounts.has(awayId)) teamCounts.set(awayId, { name: awayName, count: 0 });

                teamCounts.get(homeId)!.count++;
                teamCounts.get(awayId)!.count++;
            }

            // Check for any team exceeding or below max
            const flaggedTeams: TeamGameCount[] = [];
            for (const [teamId, info] of teamCounts) {
                if (info.count !== phase.max_games_per_team) {
                    flaggedTeams.push({
                        team_id: teamId,
                        team_name: info.name,
                        game_count: info.count
                    });
                }
            }

            // Only include phases that have flagged teams OR if we're showing validated ones
            if (flaggedTeams.length > 0 || (showValidated && phase.games_validated)) {
                results.push({
                    id: phase.id,
                    name: phase.name,
                    max_games_per_team: phase.max_games_per_team,
                    games_validated: phase.games_validated,
                    season_year: phase.season?.year,
                    competition_name: phase.season?.competition?.name,
                    season_id: phase.season?.id,
                    teams: flaggedTeams.sort((a, b) => b.game_count - a.game_count)
                });
            }
        }

        results.sort((a, b) => b.season_year - a.season_year || a.competition_name.localeCompare(b.competition_name));
        setFlaggedPhases(results);
        setLoading(false);
    }

    async function handleValidate(phaseId: string) {
        setValidating(phaseId);
        const { error } = await supabase
            .from('phases')
            .update({ games_validated: true })
            .eq('id', phaseId);

        if (error) {
            alert('Error validating phase: ' + error.message);
        } else {
            setFlaggedPhases(prev => prev.filter(p => p.id !== phaseId));
        }
        setValidating(null);
    }

    async function handleUnvalidate(phaseId: string) {
        setValidating(phaseId);
        const { error } = await supabase
            .from('phases')
            .update({ games_validated: false })
            .eq('id', phaseId);

        if (error) {
            alert('Error un-validating phase: ' + error.message);
        } else {
            loadFlaggedPhases();
        }
        setValidating(null);
    }

    return (
        <ArchiveLayout>
            <div className="mb-8">
                <Link href="/admin" className="text-blue-600 hover:underline text-sm mb-4 inline-block">&larr; Admin Dashboard</Link>
                <h1 className="text-4xl font-black mb-2 uppercase italic tracking-tighter">Game Count Validator</h1>
                <p className="text-slate-500 font-sans">
                    Phases where teams have played more or fewer games than the expected maximum.
                </p>
            </div>

            <div className="flex items-center justify-between mb-8">
                <label className="flex items-center gap-2 text-sm font-sans cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showValidated}
                        onChange={(e) => setShowValidated(e.target.checked)}
                        className="w-4 h-4"
                    />
                    Show validated phases
                </label>
                <Link
                    href="/admin/game-counts/set"
                    className="text-xs font-black uppercase bg-slate-900 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                >
                    Set Max Games &rarr;
                </Link>
            </div>

            {loading ? (
                <div className="text-center py-20 text-slate-400 font-sans">Loading phase data...</div>
            ) : flaggedPhases.length === 0 ? (
                <div className="bg-green-50 border-2 border-dashed border-green-200 p-12 text-center">
                    <h3 className="text-2xl font-black text-green-900 mb-2">All Clear</h3>
                    <p className="text-green-700 font-serif">No phases with game count discrepancies found.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {flaggedPhases.map(phase => (
                        <div
                            key={phase.id}
                            className={`border-2 p-6 shadow-sm ${phase.games_validated
                                ? 'bg-green-50 border-green-300'
                                : 'bg-white border-slate-900'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest font-sans">
                                        {phase.competition_name} &bull; {phase.season_year}
                                    </div>
                                    <h3 className="text-xl font-black">{phase.name}</h3>
                                    <div className="text-sm text-slate-500 font-sans mt-1">
                                        Expected: <span className="font-bold text-slate-800">{phase.max_games_per_team}</span> games per team
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Link
                                        href={`/phases/${phase.id}`}
                                        className="text-xs font-black uppercase bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded transition-colors"
                                    >
                                        View Phase
                                    </Link>
                                    {phase.games_validated ? (
                                        <button
                                            onClick={() => handleUnvalidate(phase.id)}
                                            disabled={validating === phase.id}
                                            className="text-xs font-black uppercase bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-2 rounded transition-colors disabled:opacity-50"
                                        >
                                            {validating === phase.id ? 'Updating...' : 'Undo Validation'}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleValidate(phase.id)}
                                            disabled={validating === phase.id}
                                            className="text-xs font-black uppercase bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded transition-colors disabled:opacity-50"
                                        >
                                            {validating === phase.id ? 'Validating...' : 'Mark as Correct'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {phase.teams.length > 0 && (
                                <div className="border-t border-slate-200 pt-4">
                                    <div className="text-[10px] font-black uppercase text-red-500 tracking-widest mb-2 font-sans">
                                        {phase.teams.length} {phase.teams.length === 1 ? 'team' : 'teams'} with unexpected game counts
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {phase.teams.map(team => {
                                            const diff = team.game_count - phase.max_games_per_team;
                                            return (
                                                <div
                                                    key={team.team_id}
                                                    className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded border border-slate-100"
                                                >
                                                    <Link href={`/teams/${team.team_id}`} className="text-sm font-bold hover:text-blue-600 truncate">
                                                        {team.team_name}
                                                    </Link>
                                                    <span className={`text-sm font-black font-mono ml-2 shrink-0 ${diff > 0 ? 'text-red-600' : 'text-amber-600'
                                                        }`}>
                                                        {team.game_count} ({diff > 0 ? '+' : ''}{diff})
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </ArchiveLayout>
    );
}
