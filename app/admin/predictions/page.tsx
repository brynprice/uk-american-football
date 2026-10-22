"use client";

import { useState, useEffect } from "react";
import ArchiveLayout from "@/components/archive/ArchiveLayout";
import Link from "next/link";
import {
  recordPredictionAction,
  getWeeklySlateAction,
  generateSlatePredictionsAction,
  saveBatchPredictionsAction,
} from "./actions";
import { BUCS_2026_WEEKS, SlateGame, PredictionResult } from "@/lib/predictions/engine";
import { supabase } from "@/lib/supabase/client";

interface Team {
  id: string;
  name: string;
}

export default function PredictionsPage() {
  const [activeTab, setActiveTab] = useState<"slate" | "single">("slate");

  // Single Matchup State
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [singlePrediction, setSinglePrediction] = useState<any>(null);
  const [isSingleLoading, setIsSingleLoading] = useState(false);

  // Weekly Slate State
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [slateGames, setSlateGames] = useState<SlateGame[]>([]);
  const [slatePredictions, setSlatePredictions] = useState<Map<string, PredictionResult>>(new Map());
  const [isSlateLoading, setIsSlateLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Load teams on mount
  useEffect(() => {
    async function loadTeams() {
      const { data } = await supabase.from("teams").select("id, name").order("name");
      if (data) setTeams(data);
    }
    loadTeams();
  }, []);

  // Load slate whenever selected week changes
  useEffect(() => {
    async function loadSlate() {
      setIsSlateLoading(true);
      setStatusMessage(null);
      try {
        const res = await getWeeklySlateAction({ weekNumber: selectedWeek, seasonYear: 2026 });
        if (res.success && res.games) {
          setSlateGames(res.games);

          // Populate existing predictions
          const existingMap = new Map<string, PredictionResult>();
          res.games.forEach((g) => {
            if (g.existingPrediction) {
              existingMap.set(g.id, {
                gameId: g.id,
                homeTeamId: g.homeTeamId,
                awayTeamId: g.awayTeamId,
                homeTeamName: g.homeTeamName,
                awayTeamName: g.awayTeamName,
                predictedHomeScore: g.existingPrediction.predictedHomeScore,
                predictedAwayScore: g.existingPrediction.predictedAwayScore,
                winProbability: g.existingPrediction.winProbability,
                confidence: g.existingPrediction.confidence as any,
                h2hCount: 0,
                commonOpponentsCount: 0,
                inSeasonAdjustment: {
                  homeOffenseDelta: 0,
                  awayOffenseDelta: 0,
                  homeDefenseDelta: 0,
                  awayDefenseDelta: 0,
                  description: "Stored in DB",
                },
                weights: {} as any,
              });
            }
          });
          setSlatePredictions(existingMap);
        } else {
          setStatusMessage({ type: "error", text: res.error || "Failed to load weekly slate." });
        }
      } catch (err: any) {
        setStatusMessage({ type: "error", text: err.message || "Failed to load weekly slate." });
      } finally {
        setIsSlateLoading(false);
      }
    }

    if (activeTab === "slate") {
      loadSlate();
    }
  }, [selectedWeek, activeTab]);

  // Generate predictions for all games in the slate
  const handleGenerateSlate = async () => {
    if (slateGames.length === 0) return;
    setIsGenerating(true);
    setStatusMessage(null);

    try {
      const res = await generateSlatePredictionsAction({ games: slateGames, seasonYear: 2026 });
      if (res.success && res.predictions) {
        const newMap = new Map(slatePredictions);
        res.predictions.forEach((p) => {
          if (p.gameId) newMap.set(p.gameId, p);
        });
        setSlatePredictions(newMap);
        setStatusMessage({
          type: "success",
          text: `Generated predictions for ${res.predictions.length} fixtures in Week ${selectedWeek}!`,
        });
      } else {
        setStatusMessage({ type: "error", text: res.error || "Failed to generate predictions." });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to generate predictions." });
    } finally {
      setIsGenerating(false);
    }
  };

  // Save all slate predictions to database
  const handleSaveAll = async () => {
    if (slatePredictions.size === 0) return;
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const toSave = Array.from(slatePredictions.values()).map((p) => ({
        gameId: p.gameId!,
        homeTeamId: p.homeTeamId,
        awayTeamId: p.awayTeamId,
        predictedHomeScore: p.predictedHomeScore,
        predictedAwayScore: p.predictedAwayScore,
        winProbability: p.winProbability,
        confidence: p.confidence,
        weights: p.weights,
      }));

      const res = await saveBatchPredictionsAction(toSave);
      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `Successfully saved ${res.savedCount} predictions to the database (${res.insertedCount} new, ${res.updatedCount} updated).`,
        });

        // Refresh slate to reflect updated timestamps
        const reload = await getWeeklySlateAction({ weekNumber: selectedWeek, seasonYear: 2026 });
        if (reload.success && reload.games) {
          setSlateGames(reload.games);
        }
      } else {
        setStatusMessage({ type: "error", text: res.error || "Failed to save predictions." });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to save predictions." });
    } finally {
      setIsSaving(false);
    }
  };

  // Single matchup calculation
  const calculateSinglePrediction = async () => {
    if (!homeTeamId || !awayTeamId) return;
    setIsSingleLoading(true);
    setSinglePrediction(null);

    try {
      // 1. Fetch H2H Games
      const { data: h2hGames } = await supabase
        .from("games")
        .select(`*, phase:phases!games_phase_id_fkey(season:seasons(year))`)
        .or(`and(home_team_id.eq.${homeTeamId},away_team_id.eq.${awayTeamId}),and(home_team_id.eq.${awayTeamId},away_team_id.eq.${homeTeamId})`)
        .eq("status", "completed");

      const currentYear = new Date().getFullYear();
      const startYear = currentYear - 2;

      const [homeHistory, awayHistory] = await Promise.all([
        supabase
          .from("games")
          .select("*, phase:phases!games_phase_id_fkey(season:seasons(year))")
          .or(`home_team_id.eq.${homeTeamId},away_team_id.eq.${homeTeamId}`)
          .eq("status", "completed")
          .filter("phase.season.year", "gte", startYear),
        supabase
          .from("games")
          .select("*, phase:phases!games_phase_id_fkey(season:seasons(year))")
          .or(`home_team_id.eq.${awayTeamId},away_team_id.eq.${awayTeamId}`)
          .eq("status", "completed")
          .filter("phase.season.year", "gte", startYear),
      ]);

      const hGames = (homeHistory.data || []) as any[];
      const aGames = (awayHistory.data || []) as any[];
      const h2h = (h2hGames || []) as any[];

      const homeOpponents = new Set(hGames.map((g) => (g.home_team_id === homeTeamId ? g.away_team_id : g.home_team_id)));
      const awayOpponents = new Set(aGames.map((g) => (g.home_team_id === awayTeamId ? g.away_team_id : g.home_team_id)));
      const commonOpponentIds = Array.from(homeOpponents).filter(
        (id) => awayOpponents.has(id) && id !== homeTeamId && id !== awayTeamId
      );

      let h2hHomeScore = 0;
      let h2hAwayScore = 0;
      let h2hWeightTotal = 0;
      let h2hWins = 0;

      h2h.forEach((g) => {
        const isHome = g.home_team_id === homeTeamId;
        const weight = (g as any).phase?.season?.year >= currentYear - 2 ? 1.5 : 1;

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

      const h2hAvgHome = h2hWeightTotal > 0 ? h2hHomeScore / h2hWeightTotal : 20;
      const h2hAvgAway = h2hWeightTotal > 0 ? h2hAwayScore / h2hWeightTotal : 20;
      const h2hWinPct = h2h.length > 0 ? h2hWins / h2h.length : 0.5;

      let commonHomeDelta = 0;
      let commonAwayDelta = 0;
      let commonWeight = 0;

      commonOpponentIds.forEach((oppId) => {
        const homeVsOpp = hGames.filter((g) => g.home_team_id === oppId || g.away_team_id === oppId);
        const awayVsOpp = aGames.filter((g) => g.home_team_id === oppId || g.away_team_id === oppId);

        const avgHomeFor =
          homeVsOpp.reduce((acc, g) => acc + (g.home_team_id === homeTeamId ? g.home_score : g.away_score), 0) /
          homeVsOpp.length;
        const avgHomeAgainst =
          homeVsOpp.reduce((acc, g) => acc + (g.home_team_id === homeTeamId ? g.away_score : g.home_score), 0) /
          homeVsOpp.length;

        const avgAwayFor =
          awayVsOpp.reduce((acc, g) => acc + (g.home_team_id === awayTeamId ? g.home_score : g.away_score), 0) /
          awayVsOpp.length;
        const avgAwayAgainst =
          awayVsOpp.reduce((acc, g) => acc + (g.home_team_id === awayTeamId ? g.away_score : g.home_score), 0) /
          awayVsOpp.length;

        commonHomeDelta += avgHomeFor - avgAwayAgainst;
        commonAwayDelta += avgAwayFor - avgHomeAgainst;
        commonWeight++;
      });

      const commonAvgHome = commonWeight > 0 ? commonHomeDelta / commonWeight : 0;
      const commonAvgAway = commonWeight > 0 ? commonAwayDelta / commonWeight : 0;

      const finalHome =
        h2h.length > 0
          ? h2hAvgHome * 0.6 + Math.max(0, h2hAvgHome + commonAvgHome) * 0.4
          : Math.max(0, 20 + commonAvgHome);

      const finalAway =
        h2h.length > 0
          ? h2hAvgAway * 0.6 + Math.max(0, h2hAvgAway + commonAvgAway) * 0.4
          : Math.max(0, 20 + commonAvgAway);

      const confidence =
        h2h.length > 10 || commonWeight > 5
          ? "High"
          : h2h.length > 3
          ? "Medium"
          : "Low";

      const homeName = teams.find((t) => t.id === homeTeamId)?.name;
      const awayName = teams.find((t) => t.id === awayTeamId)?.name;

      setSinglePrediction({
        homeName,
        awayName,
        homeScore: Math.round(finalHome + 3), // +3 home advantage
        awayScore: Math.round(finalAway),
        h2hCount: h2h.length,
        commonCount: commonWeight,
        confidence,
        winProbability: Math.min(
          95,
          Math.max(5, Math.round(h2hWinPct * 100 + (commonAvgHome - commonAvgAway)))
        ),
      });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: "error", text: err.message || "Failed to calculate prediction." });
    } finally {
      setIsSingleLoading(false);
    }
  };

  const saveSinglePrediction = async () => {
    if (!singlePrediction || !homeTeamId || !awayTeamId) return;

    try {
      const res = await recordPredictionAction({
        homeTeamId,
        awayTeamId,
        predictedHomeScore: singlePrediction.homeScore,
        predictedAwayScore: singlePrediction.awayScore,
        winProbability: singlePrediction.winProbability,
        confidence: singlePrediction.confidence,
        weights: {
          h2hWeight: 0.6,
          commonWeight: 0.4,
          recencyModifier: 1.5,
          homeAdvantage: 3,
          baseline: 20,
        },
      });

      if (!res.success) throw new Error(res.error || "Failed to record prediction");
      alert("Prediction recorded successfully!");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to record prediction.");
    }
  };

  // Filter games by division
  const filteredGames = slateGames.filter((g) => {
    if (divisionFilter === "all") return true;
    if (divisionFilter === "premier") return g.phaseName.toLowerCase().includes("premier");
    if (divisionFilter === "d1") return g.phaseName.toLowerCase().includes("division 1");
    if (divisionFilter === "d2") return g.phaseName.toLowerCase().includes("division 2");
    return true;
  });

  const predictedCount = slateGames.filter((g) => slatePredictions.has(g.id)).length;

  return (
    <ArchiveLayout>
      <div className="max-w-6xl mx-auto mb-16">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900">
              Score Predictor
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">
              BUAFL 2026/27 Weekly Match Predictor & Adaptive Model Engine
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/predictions/accuracy"
              className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-4 py-2 text-xs font-black uppercase tracking-wider rounded transition-colors"
            >
              Model Accuracy & Learning &rarr;
            </Link>
            <Link
              href="/admin"
              className="text-slate-500 hover:text-slate-900 font-bold uppercase text-xs tracking-widest"
            >
              &larr; Dashboard
            </Link>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 border-b border-slate-200 mb-8">
          <button
            onClick={() => setActiveTab("slate")}
            className={`pb-3 px-4 font-black uppercase text-xs tracking-wider transition-all border-b-2 ${
              activeTab === "slate"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Weekly Slate Predictor (2026/27)
          </button>
          <button
            onClick={() => setActiveTab("single")}
            className={`pb-3 px-4 font-black uppercase text-xs tracking-wider transition-all border-b-2 ${
              activeTab === "single"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Single Matchup Simulator
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded text-sm font-bold flex items-center justify-between ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : statusMessage.type === "error"
                ? "bg-rose-50 text-rose-800 border border-rose-200"
                : "bg-blue-50 text-blue-800 border border-blue-200"
            }`}
          >
            <span>{statusMessage.text}</span>
            <button onClick={() => setStatusMessage(null)} className="text-xs uppercase font-black ml-4">
              ✕
            </button>
          </div>
        )}

        {/* TAB 1: WEEKLY SLATE */}
        {activeTab === "slate" && (
          <div>
            {/* Control Bar */}
            <div className="bg-slate-900 text-white p-6 rounded-lg shadow-xl mb-8 border border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                {/* Week Selector */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Select Game Week
                  </label>
                  <select
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-3 font-bold text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {BUCS_2026_WEEKS.map((w) => (
                      <option key={w.weekNumber} value={w.weekNumber}>
                        {w.label} — {w.gameCount} Fixtures
                      </option>
                    ))}
                  </select>
                </div>

                {/* Division Filter */}
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Tier Filter
                  </label>
                  <select
                    value={divisionFilter}
                    onChange={(e) => setDivisionFilter(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-3 font-bold text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="all">All Tiers ({slateGames.length})</option>
                    <option value="premier">Premier Tiers Only</option>
                    <option value="d1">Division 1 Only</option>
                    <option value="d2">Division 2 Only</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerateSlate}
                    disabled={isGenerating || isSlateLoading || slateGames.length === 0}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-3 px-4 text-xs uppercase tracking-wider rounded shadow transition-all active:scale-95 text-center"
                  >
                    {isGenerating ? "Predicting..." : "⚡ Predict Slate"}
                  </button>
                  <button
                    onClick={handleSaveAll}
                    disabled={isSaving || slatePredictions.size === 0}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-3 px-4 text-xs uppercase tracking-wider rounded shadow transition-all active:scale-95 text-center"
                  >
                    {isSaving ? "Saving..." : `💾 Save (${slatePredictions.size})`}
                  </button>
                </div>
              </div>

              {/* Slate Metrics */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap gap-8 text-xs font-bold text-slate-400">
                <div>
                  Slate Games: <span className="text-white font-black">{slateGames.length}</span>
                </div>
                <div>
                  Predicted:{" "}
                  <span className={predictedCount === slateGames.length ? "text-emerald-400 font-black" : "text-amber-400 font-black"}>
                    {predictedCount} / {slateGames.length}
                  </span>
                </div>
                <div>
                  Adaptive Learning:{" "}
                  <span className="text-blue-400 font-black">Active (Residual Calibration Enabled)</span>
                </div>
              </div>
            </div>

            {/* Fixture Slate Cards / Table */}
            {isSlateLoading ? (
              <div className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                Loading Week {selectedWeek} Fixtures...
              </div>
            ) : filteredGames.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 p-12 text-center rounded">
                <p className="text-slate-500 text-sm font-bold">No fixtures found for this selection.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredGames.map((game) => {
                  const pred = slatePredictions.get(game.id);
                  const isCompleted = game.status === "completed" && game.homeScore !== null && game.awayScore !== null;
                  const isSaved = !!game.existingPrediction;

                  return (
                    <div
                      key={game.id}
                      className="bg-white border-2 border-slate-900 p-5 rounded shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] transition-all"
                    >
                      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        {/* Match Metadata */}
                        <div className="min-w-[200px]">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wide">
                              {game.phaseName}
                            </span>
                            {isCompleted ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded">
                                Final
                              </span>
                            ) : isSaved ? (
                              <span className="bg-blue-100 text-blue-800 text-[10px] font-black uppercase px-2 py-0.5 rounded">
                                Saved in DB
                              </span>
                            ) : pred ? (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2 py-0.5 rounded">
                                Draft (Unsaved)
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-500 text-[10px] font-black uppercase px-2 py-0.5 rounded">
                                Scheduled
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-slate-500">
                            {new Date(game.date).toLocaleDateString("en-GB", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                            {game.time ? ` • ${game.time}` : ""}
                          </div>
                        </div>

                        {/* Teams & Score Display */}
                        <div className="flex-1 grid grid-cols-7 items-center gap-2 w-full max-w-xl">
                          {/* Home Team */}
                          <div className="col-span-3 text-right">
                            <div className="text-sm font-black text-slate-900 truncate">{game.homeTeamName}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Home</div>
                          </div>

                          {/* Center Scoreline / VS */}
                          <div className="col-span-1 text-center">
                            {pred ? (
                              <div className="flex items-center justify-center gap-1 font-black text-xl text-slate-900 bg-slate-100 px-3 py-1 rounded">
                                <span>{pred.predictedHomeScore}</span>
                                <span className="text-slate-400 text-sm">-</span>
                                <span>{pred.predictedAwayScore}</span>
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-slate-400 uppercase">vs</span>
                            )}
                          </div>

                          {/* Away Team */}
                          <div className="col-span-3 text-left">
                            <div className="text-sm font-black text-slate-900 truncate">{game.awayTeamName}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Away</div>
                          </div>
                        </div>

                        {/* Prediction Analysis & Probability */}
                        {pred ? (
                          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 min-w-[280px]">
                            {/* Win Probability Bar */}
                            <div className="w-full md:w-36">
                              <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 mb-1">
                                <span>Win Prob</span>
                                <span className="text-blue-600">{pred.winProbability}%</span>
                              </div>
                              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${pred.winProbability >= 50 ? "bg-blue-600" : "bg-rose-500"}`}
                                  style={{ width: `${pred.winProbability}%` }}
                                />
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 text-center mt-1 truncate">
                                {pred.predictedHomeScore > pred.predictedAwayScore
                                  ? `${pred.homeTeamName} by ${pred.predictedHomeScore - pred.predictedAwayScore}`
                                  : pred.predictedAwayScore > pred.predictedHomeScore
                                  ? `${pred.awayTeamName} by ${pred.predictedAwayScore - pred.predictedHomeScore}`
                                  : "Tie Projected"}
                              </div>
                            </div>

                            {/* Badges */}
                            <div className="flex flex-col gap-1">
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded text-center ${
                                  pred.confidence === "High"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : pred.confidence === "Medium"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {pred.confidence} Conf.
                              </span>
                              {pred.inSeasonAdjustment.description !== "Stored in DB" && (
                                <span className="text-[9px] font-bold text-slate-400 truncate max-w-[120px]">
                                  {pred.inSeasonAdjustment.description}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-slate-400 italic">Not predicted yet</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SINGLE MATCHUP SIMULATOR */}
        {activeTab === "single" && (
          <div>
            <div className="bg-slate-900 text-white p-8 rounded-lg shadow-2xl mb-8 border border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Home Team
                  </label>
                  <select
                    value={homeTeamId}
                    onChange={(e) => setHomeTeamId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-3 font-bold text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select Team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Away Team
                  </label>
                  <select
                    value={awayTeamId}
                    onChange={(e) => setAwayTeamId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-3 font-bold text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select Team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={calculateSinglePrediction}
                disabled={!homeTeamId || !awayTeamId || isSingleLoading}
                className="mt-8 w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 uppercase tracking-[0.2em] rounded shadow-lg disabled:opacity-50 transition-all active:scale-95"
              >
                {isSingleLoading ? "Analyzing Matchup..." : "Run Matchup Simulation"}
              </button>
            </div>

            {singlePrediction && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Score Card */}
                  <div className="md:col-span-2 bg-white border-2 border-slate-900 p-8 shadow-[12px_12px_0px_0px_rgba(30,41,59,1)] flex flex-col items-center justify-center text-center">
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mb-4">
                      Simulated Final Score
                    </div>
                    <div className="flex items-center gap-12 mb-8">
                      <div className="flex flex-col">
                        <span className="text-xs font-black uppercase text-blue-600 mb-1">{singlePrediction.homeName}</span>
                        <span className="text-7xl font-black">{singlePrediction.homeScore}</span>
                      </div>
                      <span className="text-3xl font-black text-slate-300">-</span>
                      <div className="flex flex-col">
                        <span className="text-xs font-black uppercase text-slate-600 mb-1">{singlePrediction.awayName}</span>
                        <span className="text-7xl font-black">{singlePrediction.awayScore}</span>
                      </div>
                    </div>

                    <button
                      onClick={saveSinglePrediction}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-3 rounded uppercase text-xs tracking-widest shadow hover:scale-105 transition-all"
                    >
                      Save Prediction to Database
                    </button>
                  </div>

                  {/* Probability Card */}
                  <div className="bg-slate-50 border-2 border-slate-900 p-6 flex flex-col justify-between shadow-[8px_8px_0px_0px_rgba(30,41,59,1)]">
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                        Home Win Probability
                      </div>
                      <div className="text-5xl font-black mb-4">{singlePrediction.winProbability}%</div>
                      <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden mb-6">
                        <div className="bg-blue-600 h-full" style={{ width: `${singlePrediction.winProbability}%` }} />
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-500">Confidence:</span>
                        <span className="font-black">{singlePrediction.confidence}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-500">H2H Games Found:</span>
                        <span className="font-black">{singlePrediction.h2hCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-500">Common Opponents:</span>
                        <span className="font-black">{singlePrediction.commonCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ArchiveLayout>
  );
}
