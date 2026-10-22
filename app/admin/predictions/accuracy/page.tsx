"use client";

import { useState, useEffect } from "react";
import ArchiveLayout from "@/components/archive/ArchiveLayout";
import Link from "next/link";
import { getModelCalibrationStatsAction } from "../actions";

export default function AccuracyDashboard() {
  const [seasonFilter, setSeasonFilter] = useState<number | "all">(2026);
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const res = await getModelCalibrationStatsAction(seasonFilter);
        if (res.success) {
          setData(res);
        } else {
          setErrorMsg(res.error || "Failed to load calibration data.");
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to load calibration data.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, [seasonFilter]);

  return (
    <ArchiveLayout>
      <div className="max-w-6xl mx-auto mb-16 px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b-2 border-slate-900">
          <div>
            <div className="inline-block bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded mb-2">
              Adaptive Feedback Loop
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900">
              Model Calibration & Accuracy
            </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
              Tracking Prediction Accuracy & In-Season Form Adjustments
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/predictions"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-xs tracking-wider rounded transition-colors shadow-sm"
            >
              &larr; Slate Predictor
            </Link>
            <Link
              href="/admin/gameday"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black uppercase text-xs tracking-wider rounded border border-slate-300 transition-colors"
            >
              Gameday Hub
            </Link>
          </div>
        </div>

        {/* Season Filter Switcher */}
        <div className="flex items-center gap-2 mb-8 bg-slate-100 p-1.5 rounded-lg w-fit border border-slate-200">
          <button
            onClick={() => setSeasonFilter(2026)}
            className={`px-4 py-1.5 text-xs font-black uppercase tracking-wider rounded transition-all ${
              seasonFilter === 2026
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            2026/27 Season
          </button>
          <button
            onClick={() => setSeasonFilter("all")}
            className={`px-4 py-1.5 text-xs font-black uppercase tracking-wider rounded transition-all ${
              seasonFilter === "all"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Historical Predictions
          </button>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-500 text-red-800 text-sm font-bold rounded">
            {errorMsg}
          </div>
        )}

        {isLoading ? (
          <div className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">
            Analyzing Prediction Calibration & In-Season Performance...
          </div>
        ) : (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* High-Level Calibration Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border-2 border-slate-900 p-5 rounded shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                  Evaluated Fixtures
                </div>
                <div className="text-3xl font-black text-slate-900">
                  {data?.evaluatedCount ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-medium">
                  Completed games matched to predictions
                </div>
              </div>

              <div className="bg-white border-2 border-slate-900 p-5 rounded shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                  Win / Loss Accuracy
                </div>
                <div className="text-3xl font-black text-emerald-600">
                  {data?.winAccuracy !== null ? `${data.winAccuracy}%` : "—"}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-medium">
                  Straight-up winner prediction rate
                </div>
              </div>

              <div className="bg-white border-2 border-slate-900 p-5 rounded shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                  Avg Home Score MAE
                </div>
                <div className="text-3xl font-black text-blue-600">
                  {data?.maeHome !== null ? `${data.maeHome} pts` : "—"}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-medium">
                  Mean absolute error on home points
                </div>
              </div>

              <div className="bg-white border-2 border-slate-900 p-5 rounded shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                  Avg Away Score MAE
                </div>
                <div className="text-3xl font-black text-amber-600">
                  {data?.maeAway !== null ? `${data.maeAway} pts` : "—"}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-medium">
                  Mean absolute error on away points
                </div>
              </div>
            </div>

            {/* In-Season Team Calibration Residuals Table */}
            <div className="bg-white border-2 border-slate-900 rounded shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] overflow-hidden">
              <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider italic">
                    In-Season Team Performance Residuals (Adaptive Learning)
                  </h3>
                  <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                    Teams performing above or below model baseline. The predictor uses these deltas to refine future weekly slates.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
                  {data?.teamResiduals?.length || 0} Teams Calibrated
                </span>
              </div>

              {(!data?.teamResiduals || data.teamResiduals.length === 0) ? (
                <div className="p-10 text-center bg-slate-50">
                  <div className="text-slate-400 font-black uppercase tracking-wider mb-2 text-base">
                    No Completed Fixtures Yet For Calibration
                  </div>
                  <p className="text-slate-500 text-xs max-w-lg mx-auto leading-relaxed">
                    Week 1 begins this weekend (24–25 Oct 2026). Once game results are recorded via the{" "}
                    <Link href="/admin/gameday" className="text-blue-600 font-bold underline">
                      Gameday Hub
                    </Link>
                    , actual scores are compared against pre-game model predictions. Team offense and defense residuals are automatically fed back into the engine for subsequent weeks.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest">
                        <th className="py-3 px-4">Team</th>
                        <th className="py-3 px-4 text-center">Games Evaluated</th>
                        <th className="py-3 px-4 text-center">Offense vs Model (Δ)</th>
                        <th className="py-3 px-4 text-center">Defense vs Model (Δ)</th>
                        <th className="py-3 px-4 text-right">Performance Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {data.teamResiduals.map((t: any, idx: number) => {
                        const offColor =
                          t.avgOffenseDelta > 2
                            ? "text-emerald-700 font-bold"
                            : t.avgOffenseDelta < -2
                            ? "text-red-600 font-bold"
                            : "text-slate-600";
                        const defColor =
                          t.avgDefenseDelta > 2
                            ? "text-emerald-700 font-bold"
                            : t.avgDefenseDelta < -2
                            ? "text-red-600 font-bold"
                            : "text-slate-600";

                        const badgeColor =
                          t.performanceBadge === "Exceeding Expectations"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : t.performanceBadge === "Underperforming"
                            ? "bg-red-100 text-red-800 border-red-300"
                            : "bg-slate-100 text-slate-700 border-slate-200";

                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-black uppercase text-slate-900">
                              {t.teamName}
                            </td>
                            <td className="py-3 px-4 text-center text-slate-600 font-bold">
                              {t.gamesPlayed}
                            </td>
                            <td className={`py-3 px-4 text-center font-mono ${offColor}`}>
                              {t.avgOffenseDelta > 0 ? `+${t.avgOffenseDelta}` : t.avgOffenseDelta} pts/gm
                            </td>
                            <td className={`py-3 px-4 text-center font-mono ${defColor}`}>
                              {t.avgDefenseDelta > 0 ? `+${t.avgDefenseDelta}` : t.avgDefenseDelta} pts/gm
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span
                                className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase rounded border ${badgeColor}`}
                              >
                                {t.performanceBadge}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Evaluated Fixtures */}
            {data?.matchedGames && data.matchedGames.length > 0 && (
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-4 pb-2 border-b-2 border-slate-900">
                  Recent Evaluated Predictions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.matchedGames.map((m: any) => (
                    <div
                      key={m.id || m.gameId}
                      className="bg-white border-2 border-slate-900 p-4 rounded shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-[10px] font-black uppercase text-slate-400">
                            {m.date || "Match Day"}
                          </div>
                          <div className="font-black uppercase italic tracking-tighter text-base text-slate-900">
                            {m.homeTeam} vs {m.awayTeam}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[9px] font-black uppercase rounded border ${
                            m.wasCorrect
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-red-100 text-red-800 border-red-300"
                          }`}
                        >
                          {m.wasCorrect ? "Correct Outcome" : "Upset / Miss"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded">
                          <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                            Predicted Score
                          </div>
                          <div className="font-black text-lg text-slate-800">
                            {m.predictedHome} - {m.predictedAway}
                          </div>
                        </div>
                        <div className="bg-slate-900 text-white p-2.5 rounded">
                          <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                            Actual Score
                          </div>
                          <div className="font-black text-lg">
                            {m.actualHome} - {m.actualAway}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Model Architecture & Learning Loop Card */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 sm:p-8 rounded-lg shadow-xl border-l-8 border-blue-400">
              <h3 className="text-xl font-black uppercase italic mb-2 tracking-tight">
                Self-Refining Prediction Architecture
              </h3>
              <p className="text-xs text-blue-200 leading-relaxed mb-6 max-w-3xl">
                The UK American Football predictor combines historical head-to-head records with modern common-opponent scoring baselines, constantly updated by an in-season feedback loop.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-950/60 p-4 rounded border border-blue-700/50">
                  <div className="text-[10px] font-black uppercase tracking-widest text-blue-300 mb-1">
                    Component 1
                  </div>
                  <div className="text-sm font-black uppercase mb-1">Head-to-Head (60%)</div>
                  <p className="text-[11px] text-blue-200 leading-normal">
                    Weighted 60% with a 1.5x recency multiplier for clashes in the last 2 seasons.
                  </p>
                </div>

                <div className="bg-blue-950/60 p-4 rounded border border-blue-700/50">
                  <div className="text-[10px] font-black uppercase tracking-widest text-blue-300 mb-1">
                    Component 2
                  </div>
                  <div className="text-sm font-black uppercase mb-1">Common Opponents (40%)</div>
                  <p className="text-[11px] text-blue-200 leading-normal">
                    Compares performance against shared opponents across recent seasons to calibrate relative strengths.
                  </p>
                </div>

                <div className="bg-blue-950/60 p-4 rounded border border-blue-700/50">
                  <div className="text-[10px] font-black uppercase tracking-widest text-blue-300 mb-1">
                    Component 3
                  </div>
                  <div className="text-sm font-black uppercase mb-1">In-Season Residuals</div>
                  <p className="text-[11px] text-blue-200 leading-normal">
                    As scores are posted each week, teams with high offensive or defensive deltas are dynamically boosted or discounted in future slates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ArchiveLayout>
  );
}
