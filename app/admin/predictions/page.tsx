"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import ArchiveLayout from "@/components/archive/ArchiveLayout";
import Link from "next/link";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface Team {
    id: string;
    name: string;
}

interface Game {
    id: string;
    date: string;
    home_team_id: string;
    away_team_id: string;
    home_score: number;
    away_score: number;
    status: string;
    phase?: {
        season?: {
            year: number;
        }
    }
}

export default function PredictionsPage() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [homeTeamId, setHomeTeamId] = useState("");
    const [awayTeamId, setAwayTeamId] = useState("");
    const [prediction, setPrediction] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    useEffect(() => {
        const fetchTeams = async () => {
            const { data } = await supabase.from("teams").select("id, name").order("name");
            if (data) setTeams(data);
            setIsInitialLoading(false);
        };
        fetchTeams();
    }, []);

    const calculatePrediction = async () => {
        if (!homeTeamId || !awayTeamId) return;
        setIsLoading(true);
        setPrediction(null);

        try {
            // 1. Fetch H2H Games (Exclude awarded)
            const { data: h2hGames } = await supabase
                .from("games")
                .select(`
                    *,
                    phase:phases!games_phase_id_fkey(season:seasons(year))
                `)
                .or(`and(home_team_id.eq.${homeTeamId},away_team_id.eq.${awayTeamId}),and(home_team_id.eq.${awayTeamId},away_team_id.eq.${homeTeamId})`)
                .eq('status', 'completed');

            // 2. Fetch Common Opponents (Last 2 seasons)
            const currentYear = new Date().getFullYear();
            const startYear = currentYear - 2;

            const [homeHistory, awayHistory] = await Promise.all([
                supabase.from("games").select("*, phase:phases!games_phase_id_fkey(season:seasons(year))").or(`home_team_id.eq.${homeTeamId},away_team_id.eq.${homeTeamId}`).eq('status', 'completed').filter('phase.season.year', 'gte', startYear),
                supabase.from("games").select("*, phase:phases!games_phase_id_fkey(season:seasons(year))").or(`home_team_id.eq.${awayTeamId},away_team_id.eq.${awayTeamId}`).eq('status', 'completed').filter('phase.season.year', 'gte', startYear)
            ]);

            const hGames = (homeHistory.data || []) as any[];
            const aGames = (awayHistory.data || []) as any[];

            // Find common opponents
            const homeOpponents = new Set(hGames.map(g => g.home_team_id === homeTeamId ? g.away_team_id : g.home_team_id));
            const awayOpponents = new Set(aGames.map(g => g.home_team_id === awayTeamId ? g.away_team_id : g.home_team_id));
            const commonOpponentIds = Array.from(homeOpponents).filter(id => awayOpponents.has(id) && id !== homeTeamId && id !== awayTeamId);

            // --- Logic ---

            // A. Direct H2H Prediction
            let h2hHomeScore = 0;
            let h2hAwayScore = 0;
            let h2hWeightTotal = 0;
            let h2hWins = 0;

            h2hGames?.forEach(g => {
                const isHome = g.home_team_id === homeTeamId;
                const weight = (g.phase?.season?.year >= currentYear - 2) ? 1.5 : 1;

                if (isHome) {
                    h2hHomeScore += g.home_score * weight;
                    h2hAwayScore += g.away_score * weight;
                    if (g.home_score > g.away_score) h2hWins += 1;
                } else {
                    h2hHomeScore += g.away_score * weight;
                    h2hAwayScore += g.home_score * weight;
                    if (g.away_score > g.home_score) h2hWins += 1;
                }
                h2hWeightTotal += weight;
            });

            const h2hAvgHome = h2hWeightTotal > 0 ? h2hHomeScore / h2hWeightTotal : 0;
            const h2hAvgAway = h2hWeightTotal > 0 ? h2hAwayScore / h2hWeightTotal : 0;
            const h2hWinPct = h2hGames && h2hGames.length > 0 ? h2hWins / h2hGames.length : 0.5;

            // B. Common Opponent Prediction
            let commonHomeDelta = 0;
            let commonAwayDelta = 0;
            let commonWeight = 0;

            commonOpponentIds.forEach(oppId => {
                const homeVsOpp = hGames.filter(g => g.home_team_id === oppId || g.away_team_id === oppId);
                const awayVsOpp = aGames.filter(g => g.home_team_id === oppId || g.away_team_id === oppId);

                const avgHomeFor = homeVsOpp.reduce((acc, g) => acc + (g.home_team_id === homeTeamId ? g.home_score : g.away_score), 0) / homeVsOpp.length;
                const avgHomeAgainst = homeVsOpp.reduce((acc, g) => acc + (g.home_team_id === homeTeamId ? g.away_score : g.home_score), 0) / homeVsOpp.length;

                const avgAwayFor = awayVsOpp.reduce((acc, g) => acc + (g.home_team_id === awayTeamId ? g.home_score : g.away_score), 0) / awayVsOpp.length;
                const avgAwayAgainst = awayVsOpp.reduce((acc, g) => acc + (g.home_team_id === awayTeamId ? g.away_score : g.home_score), 0) / awayVsOpp.length;

                // How much better did A do against X than expected?
                commonHomeDelta += (avgHomeFor - avgAwayAgainst);
                commonAwayDelta += (avgAwayFor - avgHomeAgainst);
                commonWeight++;
            });

            const commonAvgHome = commonWeight > 0 ? commonHomeDelta / commonWeight : 0;
            const commonAvgAway = commonWeight > 0 ? commonAwayDelta / commonWeight : 0;

            // COMBINED
            const finalHome = h2hGames && h2hGames.length > 0
                ? (h2hAvgHome * 0.6) + (Math.max(0, h2hAvgHome + commonAvgHome) * 0.4)
                : Math.max(0, 20 + commonAvgHome); // Baseline 20 if no H2H

            const finalAway = h2hGames && h2hGames.length > 0
                ? (h2hAvgAway * 0.6) + (Math.max(0, h2hAvgAway + commonAvgAway) * 0.4)
                : Math.max(0, 20 + commonAvgAway);

            const confidence = (h2hGames?.length || 0) > 10 || commonWeight > 5 ? "High" : (h2hGames?.length || 0) > 3 ? "Medium" : "Low";

            // Get team names
            const homeName = teams.find(t => t.id === homeTeamId)?.name;
            const awayName = teams.find(t => t.id === awayTeamId)?.name;

            setPrediction({
                homeName,
                awayName,
                homeScore: Math.round(finalHome),
                awayScore: Math.round(finalAway),
                h2hCount: h2hGames?.length || 0,
                commonCount: commonWeight,
                confidence,
                winProbability: Math.min(95, Math.max(5, Math.round(h2hWinPct * 100 + (commonAvgHome - commonAvgAway)))),
                h2hGames: h2hGames?.sort((a, b) => b.phase.season.year - a.phase.season.year).slice(0, 5)
            });

        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const savePrediction = async () => {
        if (!prediction || !homeTeamId || !awayTeamId) return;

        try {
            const { error } = await supabase.from("predictions").insert({
                home_team_id: homeTeamId,
                away_team_id: awayTeamId,
                predicted_home_score: prediction.homeScore,
                predicted_away_score: prediction.awayScore,
                win_probability: prediction.winProbability,
                confidence: prediction.confidence,
                weights: {
                    h2hWeight: 0.6,
                    commonWeight: 0.4,
                    recencyModifier: 1.5,
                    baseline: 20
                }
            });

            if (error) throw error;
            alert("Prediction recorded successfully!");
        } catch (err) {
            console.error(err);
            alert("Failed to record prediction.");
        }
    };

    if (isInitialLoading) return <div className="p-8">Loading predictor...</div>;

    return (
        <ArchiveLayout>
            <div className="max-w-4xl mx-auto mb-12">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-black uppercase italic tracking-tighter">Score Predictor</h1>
                    <Link href="/admin" className="text-slate-500 hover:text-slate-900 font-bold uppercase text-xs tracking-widest">&larr; Dashboard</Link>
                </div>

                <div className="bg-slate-900 text-white p-8 rounded-lg shadow-2xl mb-8 border border-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Home Team</label>
                            <select
                                value={homeTeamId}
                                onChange={(e) => setHomeTeamId(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-sm p-3 font-bold text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">Select Team</option>
                                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Away Team</label>
                            <select
                                value={awayTeamId}
                                onChange={(e) => setAwayTeamId(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-sm p-3 font-bold text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">Select Team</option>
                                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={calculatePrediction}
                        disabled={!homeTeamId || !awayTeamId || isLoading}
                        className="mt-8 w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 uppercase tracking-[0.2em] rounded shadow-lg disabled:opacity-50 transition-all active:scale-95"
                    >
                        {isLoading ? "Analyzing Data..." : "Run Prediction"}
                    </button>
                </div>

                {prediction && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Prediction Card */}
                            <div className="md:col-span-2 bg-white border-2 border-slate-900 p-8 shadow-[12px_12px_0px_0px_rgba(30,41,59,1)] flex flex-col items-center justify-center text-center">
                                <div className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mb-4">Predicted Final Score</div>
                                <div className="flex items-center gap-12 mb-8">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black uppercase text-blue-600 mb-1">{prediction.homeName}</span>
                                        <span className="text-7xl font-black">{prediction.homeScore}</span>
                                    </div>
                                    <div className="text-4xl font-black text-slate-200">-</div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black uppercase text-red-600 mb-1">{prediction.awayName}</span>
                                        <span className="text-7xl font-black">{prediction.awayScore}</span>
                                    </div>
                                </div>

                                <div className="w-full bg-slate-100 rounded-full h-8 flex overflow-hidden border border-slate-200">
                                    <div
                                        className="bg-blue-600 flex items-center justify-center text-[10px] font-black text-white"
                                        style={{ width: `${prediction.winProbability}%` }}
                                    >
                                        {prediction.winProbability}% WIN
                                    </div>
                                    <div
                                        className="bg-red-500 flex items-center justify-center text-[10px] font-black text-white"
                                        style={{ width: `${100 - prediction.winProbability}%` }}
                                    >
                                        {100 - prediction.winProbability}%
                                    </div>
                                </div>
                                <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Calculated Win Probability</div>
                                
                                <button
                                    onClick={savePrediction}
                                    className="mt-8 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest py-2 px-6 rounded hover:bg-slate-800 transition-colors"
                                >
                                    Record This Prediction
                                </button>
                            </div>

                            {/* Signal Card */}
                            <div className="bg-slate-50 border border-slate-200 p-6 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-xs font-black uppercase text-slate-500 mb-4 tracking-widest border-b border-slate-200 pb-2">Analysis Signals</h3>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-500">H2H Matchups</span>
                                            <span className="font-bold text-slate-900">{prediction.h2hCount}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-500">Common Opponents</span>
                                            <span className="font-bold text-slate-900">{prediction.commonCount}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-500">Data Confidence</span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${prediction.confidence === 'High' ? 'bg-green-100 text-green-700' :
                                                    prediction.confidence === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {prediction.confidence}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 p-3 bg-white border border-slate-200 text-[10px] text-slate-500 leading-relaxed italic border-l-4 border-l-blue-500">
                                    Weights: 60% Direct H2H, 40% Common Opponents. Recency modifier applied to last 2 years. Walkovers excluded.
                                </div>
                            </div>
                        </div>

                        {/* Partial H2H History */}
                        {prediction.h2hGames.length > 0 && (
                            <div className="mt-12">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-4">Recent Matchups</h3>
                                <div className="grid grid-cols-1 gap-2">
                                    {prediction.h2hGames.map((g: any) => (
                                        <div key={g.id} className="bg-white border border-slate-200 p-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                            <div className="text-[10px] font-black text-slate-400 w-12">{g.phase?.season?.year}</div>
                                            <div className="flex-1 text-center font-bold text-sm">
                                                {g.home_team_id === homeTeamId ? g.home_score : g.away_score} - {g.home_team_id === homeTeamId ? g.away_score : g.home_score}
                                            </div>
                                            <div className="text-[10px] uppercase font-black px-2 py-0.5 bg-slate-100 rounded text-slate-500">
                                                {(g.home_team_id === homeTeamId && g.home_score > g.away_score) || (g.away_team_id === homeTeamId && g.away_score > g.home_score) ? 'Home Win' : 'Away Win'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </ArchiveLayout>
    );
}
