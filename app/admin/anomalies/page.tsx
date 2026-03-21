'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import ArchiveLayout from '@/components/archive/ArchiveLayout';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function AdminAnomaliesPage() {
    const [anomalies, setAnomalies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchAnomalies();
    }, []);

    const fetchAnomalies = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('games')
            .select(`
                *,
                home_team:teams!home_team_id (name),
                away_team:teams!away_team_id (name),
                phase:phases!games_phase_id_fkey (name, season:seasons (year, competition:competitions (name)))
            `)
            .eq('status', 'anomaly')
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching anomalies:', error);
        } else {
            setAnomalies(data || []);
        }
        setLoading(false);
    };

    const handleUpdate = async (gameId: string, homeScore: number, awayScore: number) => {
        const { error } = await supabase
            .from('games')
            .update({
                home_score: homeScore,
                away_score: awayScore,
                status: 'completed'
            })
            .eq('id', gameId);

        if (error) {
            setMessage(`Error updating game: ${error.message}`);
        } else {
            setMessage('Game updated and marked as completed.');
            fetchAnomalies();
        }
    };

    const handleDelete = async (gameId: string) => {
        if (!confirm('Are you sure you want to delete this game?')) return;

        const { error } = await supabase
            .from('games')
            .delete()
            .eq('id', gameId);

        if (error) {
            setMessage(`Error deleting game: ${error.message}`);
        } else {
            setMessage('Game deleted successfully.');
            fetchAnomalies();
        }
    };

    return (
        <ArchiveLayout>
            <div className="mb-8">
                <Link href="/admin" className="text-blue-600 hover:underline text-sm mb-4 inline-block">&larr; Back to Admin</Link>
                <h1 className="text-4xl font-black mb-2">Game Anomalies</h1>
                <p className="text-slate-600">Review and resolve games flagged with 'anomaly' status.</p>
            </div>

            {message && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded">
                    {message}
                </div>
            )}

            {loading ? (
                <div className="p-12 text-center text-slate-400">Loading anomalies...</div>
            ) : anomalies.length === 0 ? (
                <div className="p-12 text-center bg-white border border-dashed border-slate-300 rounded text-slate-400 italic">
                    No active anomalies found.
                </div>
            ) : (
                <div className="space-y-6">
                    {anomalies.map((game) => (
                        <div key={game.id} className="bg-white border border-rose-200 border-l-4 border-l-rose-500 p-6 shadow-sm rounded-r-lg">
                            <div className="flex flex-col md:flex-row justify-between gap-6">
                                <div className="flex-1">
                                    <div className="text-xs font-black text-rose-500 uppercase mb-1">
                                        {game.phase?.season?.year} {game.phase?.season?.competition?.name} &bull; {game.phase?.name}
                                    </div>
                                    <div className="text-lg font-bold mb-2">
                                        {game.away_team?.name} at {game.home_team?.name}
                                    </div>
                                    <div className="text-sm text-slate-500 mb-4 font-sans italic">
                                        {game.notes || "No anomaly notes provided."}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        Date: {game.date_display || game.date || "Unknown"} | ID: {game.id}
                                    </div>
                                </div>

                                <div className="w-full md:w-64 space-y-4 pt-2">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">Away Score</label>
                                            <input 
                                                type="number" 
                                                defaultValue={game.away_score ?? 0}
                                                id={`away-score-${game.id}`}
                                                className="w-full border border-slate-200 px-2 py-1 rounded text-sm font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-slate-400 mb-1">Home Score</label>
                                            <input 
                                                type="number" 
                                                defaultValue={game.home_score ?? 0}
                                                id={`home-score-${game.id}`}
                                                className="w-full border border-slate-200 px-2 py-1 rounded text-sm font-bold"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button 
                                            onClick={() => {
                                                const home = parseInt((document.getElementById(`home-score-${game.id}`) as HTMLInputElement).value);
                                                const away = parseInt((document.getElementById(`away-score-${game.id}`) as HTMLInputElement).value);
                                                handleUpdate(game.id, home, away);
                                            }}
                                            className="w-full bg-slate-900 text-white text-xs font-black uppercase py-2 rounded hover:bg-blue-600 transition-colors"
                                        >
                                            Resolve & Mark Completed
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(game.id)}
                                            className="w-full border border-rose-200 text-rose-600 text-[10px] font-black uppercase py-2 rounded hover:bg-rose-50 transition-colors"
                                        >
                                            Delete Game
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </ArchiveLayout>
    );
}
