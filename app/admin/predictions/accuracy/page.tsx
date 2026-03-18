"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import ArchiveLayout from "@/components/archive/ArchiveLayout";
import Link from "next/link";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function AccuracyDashboard() {
    const [performance, setPerformance] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            // 1. Fetch Predictions
            const { data: predictions } = await supabase
                .from("predictions")
                .select("*, home_team:teams!predictions_home_team_id_fkey(name), away_team:teams!predictions_away_team_id_fkey(name)");

            if (!predictions || predictions.length === 0) {
                setIsLoading(false);
                return;
            }

            // 2. Fetch Actual Results for these predictions
            // We'll look for games between these teams that were completed after the prediction was made
            const results = await Promise.all(predictions.map(async (p) => {
                const { data: game } = await supabase
                    .from("games")
                    .select("*")
                    .eq("home_team_id", p.home_team_id)
                    .eq("away_team_id", p.away_team_id)
                    .eq("status", "completed")
                    .gte("date", p.created_at.split('T')[0])
                    .order("date", { ascending: true })
                    .limit(1)
                    .maybeSingle();
                
                return game ? { ...p, actual_home: game.home_score, actual_away: game.away_score, game_date: game.date } : null;
            }));

            const matched = results.filter(r => r !== null);

            if (matched.length > 0) {
                const homeError = matched.reduce((acc, r) => acc + Math.abs(r.predicted_home_score - r.actual_home), 0) / matched.length;
                const awayError = matched.reduce((acc, r) => acc + Math.abs(r.predicted_away_score - r.actual_away), 0) / matched.length;
                const winAccuracy = matched.reduce((acc, r) => {
                    const predictedWin = r.predicted_home_score > r.predicted_away_score;
                    const actualWin = r.actual_home > r.actual_away;
                    return acc + (predictedWin === actualWin ? 1 : 0);
                }, 0) / matched.length;

                setPerformance({
                    count: matched.length,
                    maeHome: homeError.toFixed(1),
                    maeAway: awayError.toFixed(1),
                    winPct: (winAccuracy * 100).toFixed(0),
                    details: matched
                });
            }

            setIsLoading(false);
        };
        fetchData();
    }, []);

    return (
        <ArchiveLayout>
            <div className="max-w-4xl mx-auto mb-12">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-black uppercase italic tracking-tighter">Model Accuracy</h1>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Tracking Predictor Performance</p>
                    </div>
                    <Link href="/admin/predictions" className="text-slate-500 hover:text-slate-900 font-bold uppercase text-xs tracking-widest">&larr; Predictor</Link>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Analyzing Performance...</div>
                ) : !performance ? (
                    <div className="bg-slate-50 border border-slate-200 p-12 text-center rounded">
                        <div className="text-slate-400 font-black uppercase tracking-widest mb-2 text-xl">No Matches Found</div>
                        <p className="text-slate-500 text-sm italic">Predictions need time to "age" until actual games are played and recorded.</p>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* High Level Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white border-2 border-slate-900 p-6 shadow-[8px_8px_0px_0px_rgba(30,41,59,1)]">
                                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Win/Loss Accuracy</div>
                                <div className="text-4xl font-black">{performance.winPct}%</div>
                            </div>
                            <div className="bg-white border-2 border-slate-900 p-6 shadow-[8px_8px_0px_0px_rgba(30,41,59,1)]">
                                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Avg Home Score Error</div>
                                <div className="text-4xl font-black text-blue-600">{performance.maeHome}</div>
                            </div>
                            <div className="bg-white border-2 border-slate-900 p-6 shadow-[8px_8px_0px_0px_rgba(30,41,59,1)]">
                                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Avg Away Score Error</div>
                                <div className="text-4xl font-black text-red-500">{performance.maeAway}</div>
                            </div>
                        </div>

                        {/* Recent Comparisons */}
                        <div className="mt-12">
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-4 pb-2 border-b-2 border-slate-900">Recent Validations</h3>
                            <div className="space-y-4">
                                {performance.details.slice(0, 10).map((r: any) => (
                                    <div key={r.id} className="bg-white border border-slate-200 p-4 hover:border-slate-900 transition-colors">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <div className="text-[10px] font-black uppercase text-slate-400">{r.game_date}</div>
                                                <div className="font-black uppercase italic tracking-tighter text-lg">{r.home_team.name} vs {r.away_team.name}</div>
                                            </div>
                                            <div className={`px-2 py-0.5 text-[8px] font-black uppercase rounded ${(r.predicted_home_score > r.predicted_away_score) === (r.actual_home > r.actual_away) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {(r.predicted_home_score > r.predicted_away_score) === (r.actual_home > r.actual_away) ? 'Correct Outcome' : 'Incorrect Outcome'}
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 p-3 rounded">
                                                <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Predicted</div>
                                                <div className="font-black text-xl">{r.predicted_home_score} - {r.predicted_away_score}</div>
                                            </div>
                                            <div className="bg-slate-900 text-white p-3 rounded">
                                                <div className="text-[9px] font-bold text-slate-700 uppercase mb-1">Actual Result</div>
                                                <div className="font-black text-xl">{r.actual_home} - {r.actual_away}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Improvement Tips */}
                        <div className="bg-blue-600 text-white p-8 rounded shadow-xl border-l-8 border-blue-400">
                            <h3 className="text-xl font-black uppercase italic mb-4">Training Insights</h3>
                            <p className="text-sm leading-relaxed mb-6">
                                Based on {performance.count} trackable games, the current weights (60% H2H, 40% Common Opponents) are producing an average error of {((parseFloat(performance.maeHome) + parseFloat(performance.maeAway))/2).toFixed(1)} points per score.
                            </p>
                            <div className="text-xs font-bold uppercase tracking-widest bg-blue-700 p-4 rounded border border-blue-500">
                                Tip: If Win/Loss accuracy is high but Score Error is high, consider increasing the "Common Opponents" weight to better capture current season form.
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ArchiveLayout>
    );
}
