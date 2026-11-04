"use client";

import { useState, useEffect, useTransition } from "react";
import ArchiveLayout from "@/components/archive/ArchiveLayout";
import Link from "next/link";
import { fetchWeeklyFactsAction, generateWeeklyPdfAction } from "./actions";
import { BUCS_2026_WEEKS } from "@/lib/facts/constants.mjs";

export default function AdminFactsPage() {
  const [selectedWeek, setSelectedWeek] = useState<number>(2);
  const [selectedSeason, setSelectedSeason] = useState<number>(2026);
  const [factsData, setFactsData] = useState<any>(null);
  const [markdownText, setMarkdownText] = useState<string>("");
  const [briefText, setBriefText] = useState<string>("");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [copiedType, setCopiedType] = useState<"markdown" | "brief" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadFacts(selectedWeek, selectedSeason);
  }, [selectedWeek, selectedSeason]);

  async function loadFacts(weekNum: number, seasonYear: number) {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetchWeeklyFactsAction({ week: weekNum, season: seasonYear });
      if (res.success && res.facts) {
        setFactsData(res.facts);
        setMarkdownText(res.markdown || "");
        setBriefText(res.brief || "");
      } else {
        setErrorMessage(res.error || "Failed to load weekly facts.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDownloadPdf() {
    setIsPdfLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await generateWeeklyPdfAction({ week: selectedWeek, season: selectedSeason });
      if (res.success && res.pdfUrl) {
        setSuccessMessage(`PDF generated successfully: ${res.filename}`);
        // Trigger browser download or open in new tab
        window.open(res.pdfUrl, "_blank");
      } else {
        setErrorMessage(res.error || "Failed to generate PDF.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to generate PDF.");
    } finally {
      setIsPdfLoading(false);
    }
  }

  async function handleCopy(type: "markdown" | "brief") {
    const textToCopy = type === "markdown" ? markdownText : briefText;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 3000);
    } catch (e) {
      console.error("Clipboard copy failed:", e);
    }
  }

  const { overview, scorigamis, rivalries, extremes, recordsAndMilestones, standingsMomentum, brightonSpotlight, postponements, window: winInfo } = factsData || {};

  return (
    <ArchiveLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Navigation & Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                href="/admin"
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 transition"
              >
                ← Back to Admin Console
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-medium text-slate-500">Weekly Intelligence</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              🏈 Weekly Facts & Scouting Digest
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Extract verified scorigamis, historical rivalries, program milestones, and export publication-ready PDFs.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleCopy("markdown")}
              disabled={isLoading || !markdownText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
              title="Copy formatted markdown report for Discord, Slack, or socials"
            >
              📋 {copiedType === "markdown" ? "Copied Markdown!" : "Copy Markdown"}
            </button>

            <button
              onClick={() => handleCopy("brief")}
              disabled={isLoading || !briefText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
              title="Copy executive 4-bullet summary"
            >
              💬 {copiedType === "brief" ? "Copied Brief!" : "Copy Summary"}
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isLoading || isPdfLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-sky-600 text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 transition"
            >
              {isPdfLoading ? "⏳ Generating PDF..." : "📥 Download PDF"}
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                BUCS Game Week
              </label>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="text-sm font-medium border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {BUCS_2026_WEEKS.map((w: any) => (
                  <option key={w.weekNumber} value={w.weekNumber}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Season
              </label>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(Number(e.target.value))}
                className="text-sm font-medium border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value={2026}>2026/27 Season</option>
                <option value={2025}>2025/26 Season</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadFacts(selectedWeek, selectedSeason)}
              disabled={isLoading}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 border border-slate-300 bg-white rounded-md hover:bg-slate-100 transition disabled:opacity-50"
            >
              {isLoading ? "⏳ Loading..." : "🔄 Refresh Data"}
            </button>

            <Link
              href="/admin/gameday"
              className="text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-md hover:bg-sky-100 transition"
            >
              Go to Gameday Scoreboard →
            </Link>
          </div>
        </div>

        {/* Notifications */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
            ❌ {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 font-medium">
            ✅ {successMessage}
          </div>
        )}

        {isLoading ? (
          <div className="py-20 text-center">
            <div className="inline-block animate-spin text-3xl mb-3">🏈</div>
            <div className="text-sm font-semibold text-slate-600">Cross-referencing historical archive...</div>
            <div className="text-xs text-slate-400 mt-1">Scanning 16,000+ fixtures for scorigamis, rivalries, and records</div>
          </div>
        ) : factsData ? (
          <div className="space-y-6">

            {/* KPI Snapshot Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
                <div className="text-2xl font-black text-slate-900">{overview?.completedGames || 0}</div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Completed Fixtures</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
                <div className="text-2xl font-black text-slate-900">{overview?.totalPoints || 0}</div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                  Total Points ({overview?.avgPoints || 0} PPG)
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
                <div className="text-2xl font-black text-emerald-600">{extremes?.shutouts?.length || 0}</div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Shutouts Pitched</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
                <div className="text-2xl font-black text-amber-500">
                  {(scorigamis?.allTime?.length || 0) + (scorigamis?.level?.length || 0)}
                </div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Scorigamis Unlocked</div>
              </div>
            </div>

            {/* 1. Scorigami Watch */}
            {(scorigamis?.allTime?.length > 0 || scorigamis?.level?.length > 0) && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2 mb-3">
                  🎯 Scorigami Watch
                </h2>

                {scorigamis?.allTime?.map((sc: any, idx: number) => (
                  <div key={idx} className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 mb-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-base font-black text-amber-950">{sc.game}</span>
                      <span className="bg-amber-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded">
                        ALL-TIME BRITBALL SCORIGAMI
                      </span>
                    </div>
                    <p className="text-xs text-amber-900 font-medium">
                      {sc.description} <span className="text-amber-700">({sc.division})</span>
                    </p>
                  </div>
                ))}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {scorigamis?.level?.map((sc: any, idx: number) => (
                    <div key={idx} className="bg-sky-50 border border-sky-200 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-bold text-sky-950">{sc.game}</span>
                        <span className="bg-sky-600 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">
                          {sc.level} SCORIGAMI
                        </span>
                      </div>
                      <p className="text-xs text-sky-800">{sc.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Program Records & Historic Milestones */}
            {(recordsAndMilestones?.programRecords?.length > 0 || recordsAndMilestones?.milestoneWins?.length > 0) && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2 mb-3">
                  📜 Program Records & Milestones
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {recordsAndMilestones?.programRecords?.map((rec: any, idx: number) => (
                    <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-900">{rec.team}</span>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                          rec.type.includes("Explosion") ? "bg-emerald-100 text-emerald-800" : "bg-purple-100 text-purple-800"
                        }`}>
                          {rec.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700">{rec.description}</p>
                    </div>
                  ))}

                  {recordsAndMilestones?.milestoneWins?.map((ms: any, idx: number) => (
                    <div key={idx} className="border border-emerald-200 bg-emerald-50 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-bold text-emerald-950">{ms.team}</span>
                        <span className="bg-emerald-600 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">
                          {ms.wins}th PROGRAM WIN
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800">{ms.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Rivalries & Series Context */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2 mb-3">
                ⚔️ Rivalry & Series Context
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Inaugural & Hiatuses */}
                <div className="border border-slate-200 rounded-lg p-3.5">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Inaugural Meetings & Hiatuses Ended
                  </h3>
                  <ul className="space-y-2 text-xs text-slate-700">
                    {rivalries?.inauguralMatchups?.map((inau: any, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-sky-500 font-bold">•</span>
                        <div><strong>{inau.game}</strong>: {inau.description}</div>
                      </li>
                    ))}
                    {rivalries?.longHiatusMatchups?.map((h: any, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold">•</span>
                        <div><strong>{h.game}</strong>: {h.description}</div>
                      </li>
                    ))}
                    {(!rivalries?.inauguralMatchups?.length && !rivalries?.longHiatusMatchups?.length) && (
                      <li className="text-slate-400 italic">No inaugural matchups or hiatuses in this slate.</li>
                    )}
                  </ul>
                </div>

                {/* Series Dominance Streaks */}
                <div className="border border-slate-200 rounded-lg p-3.5">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Active Head-to-Head Win Streaks
                  </h3>
                  <ul className="space-y-2 text-xs text-slate-700">
                    {rivalries?.seriesStreaks?.slice(0, 6).map((str: any, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-purple-500 font-bold">•</span>
                        <div>{str.description}</div>
                      </li>
                    ))}
                    {!rivalries?.seriesStreaks?.length && (
                      <li className="text-slate-400 italic">No active series dominance streaks found.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Reversals & Revenge */}
              {rivalries?.revengeGames?.length > 0 && (
                <div className="border border-slate-200 rounded-lg p-3.5 mt-3 bg-slate-50">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Score Reversals & Revenge Victories
                  </h3>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
                    {rivalries.revengeGames.map((rev: any, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold">🔄</span>
                        <div>
                          <strong>{rev.winner} {rev.currentScore} {rev.loser}</strong>: {rev.description}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 4. Extremes & The Shutout Wall */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2 mb-3">
                  ⚡ Slate Extremes
                </h2>
                <ul className="space-y-2.5 text-xs text-slate-700">
                  {extremes?.shootout && (
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">🔥</span>
                      <div>
                        <strong>Shootout of the Week</strong>: {extremes.shootout.game} (
                        <span className="font-bold text-slate-900">{extremes.shootout.combined} pts</span> in {extremes.shootout.division})
                      </div>
                    </li>
                  )}
                  {extremes?.defensiveBattle && (
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500">🔒</span>
                      <div>
                        <strong>Defensive Slugfest</strong>: {extremes.defensiveBattle.game} (
                        <span className="font-bold text-slate-900">{extremes.defensiveBattle.combined} pts</span>)
                      </div>
                    </li>
                  )}
                  {extremes?.biggestBlowout && (
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">🚜</span>
                      <div>
                        <strong>Margin of the Week</strong>: {extremes.biggestBlowout.game} (
                        <span className="font-bold text-slate-900">+{extremes.biggestBlowout.diff} margin</span>)
                      </div>
                    </li>
                  )}
                  {extremes?.nailbiters?.map((nb: any, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-500">⏱️</span>
                      <div>
                        <strong>Nailbiter</strong>: {nb.game} (decided by {nb.diff} pt{nb.diff === 1 ? "" : "s"})
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Shutout Club */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2 mb-3">
                  🛡️ The Shutout Club ({extremes?.shutouts?.length || 0} Clean Sheets)
                </h2>
                {extremes?.shutouts?.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {extremes.shutouts.map((s: any, idx: number) => (
                      <div key={idx} className="bg-slate-50 border-l-4 border-emerald-500 border-slate-200 rounded px-2.5 py-1.5 text-xs">
                        <div className="font-bold text-slate-900">{s.team} {s.score}</div>
                        <div className="text-[10px] text-slate-500">{s.opponent}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">No clean sheets pitched this week.</div>
                )}
              </div>
            </div>

            {/* 5. Momentum & Brighton Historical Spotlight */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2 mb-3">
                  📈 Season Form & Momentum
                </h2>
                <ul className="space-y-2 text-xs text-slate-700">
                  {standingsMomentum?.perfectStarts?.length > 0 && (
                    <li>
                      <span className="font-bold text-emerald-700">🟢 Unblemished (2-0):</span>{" "}
                      {standingsMomentum.perfectStarts.map((t: any) => `${t.team} (+${t.pointDiff})`).join(", ")}
                    </li>
                  )}
                  {standingsMomentum?.bounceBacks?.length > 0 && (
                    <li>
                      <span className="font-bold text-sky-700">🔄 Bounce-Back Wins (1-1):</span>{" "}
                      {standingsMomentum.bounceBacks.map((b: any) => `${b.team} (${b.score} vs ${b.opponent})`).join(", ")}
                    </li>
                  )}
                  {standingsMomentum?.winlessStarts?.length > 0 && (
                    <li>
                      <span className="font-bold text-rose-700">🔴 Seeking 1st Win (0-2):</span>{" "}
                      {standingsMomentum.winlessStarts.map((t: any) => t.team).join(", ")}
                    </li>
                  )}
                </ul>
              </div>

              {/* Brighton Spotlight */}
              {brightonSpotlight && (
                <div className="bg-gradient-to-br from-sky-50 to-indigo-50 border border-sky-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-extrabold text-sky-950 uppercase tracking-wide">
                      🌊 Brighton Historical Spotlight
                    </h2>
                    <span className="bg-sky-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                      {brightonSpotlight.result.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-sky-900 mb-1">
                    {brightonSpotlight.team} {brightonSpotlight.score} {brightonSpotlight.opponent}
                  </div>
                  <p className="text-xs text-sky-800 leading-relaxed">
                    {brightonSpotlight.note}
                  </p>
                </div>
              )}
            </div>

            {/* 6. Postponements */}
            {postponements?.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600">
                <span className="font-bold text-slate-800 mr-2">⏸️ Postponed Fixtures:</span>
                {postponements.map((p: any) => `${p.matchup} (${p.division})`).join(" · ")}
              </div>
            )}

          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-sm">
            Select a game week above to load insights.
          </div>
        )}

      </div>
    </ArchiveLayout>
  );
}
