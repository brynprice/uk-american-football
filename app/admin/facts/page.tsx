"use client";

import { useState, useEffect } from "react";
import ArchiveLayout from "@/components/archive/ArchiveLayout";
import Link from "next/link";
import {
  fetchWeeklyFactsAction,
  generateWeeklyPdfAction,
  fetchWeeklyPreviewAction,
  generateWeeklyPreviewPdfAction
} from "./actions";
import { BUCS_2026_WEEKS } from "@/lib/facts/constants.mjs";

export default function AdminFactsPage() {
  const [activeTab, setActiveTab] = useState<"recap" | "preview">("preview");
  const [selectedWeek, setSelectedWeek] = useState<number>(3);
  const [selectedSeason, setSelectedSeason] = useState<number>(2026);

  // Recap State
  const [factsData, setFactsData] = useState<any>(null);
  const [recapMarkdown, setRecapMarkdown] = useState<string>("");
  const [recapBrief, setRecapBrief] = useState<string>("");

  // Preview State
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewMarkdown, setPreviewMarkdown] = useState<string>("");
  const [previewBrief, setPreviewBrief] = useState<string>("");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [copiedType, setCopiedType] = useState<"markdown" | "brief" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync default week when switching tabs
  const handleTabChange = (tab: "recap" | "preview") => {
    setActiveTab(tab);
    setErrorMessage(null);
    setSuccessMessage(null);
    if (tab === "recap" && selectedWeek === 3) {
      setSelectedWeek(2);
    } else if (tab === "preview" && selectedWeek === 2) {
      setSelectedWeek(3);
    }
  };

  useEffect(() => {
    if (activeTab === "recap") {
      loadFacts(selectedWeek, selectedSeason);
    } else {
      loadPreview(selectedWeek, selectedSeason);
    }
  }, [activeTab, selectedWeek, selectedSeason]);

  async function loadFacts(weekNum: number, seasonYear: number) {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetchWeeklyFactsAction({ week: weekNum, season: seasonYear });
      if (res.success && res.facts) {
        setFactsData(res.facts);
        setRecapMarkdown(res.markdown || "");
        setRecapBrief(res.brief || "");
      } else {
        setErrorMessage(res.error || "Failed to load weekly facts.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPreview(weekNum: number, seasonYear: number) {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetchWeeklyPreviewAction({ week: weekNum, season: seasonYear });
      if (res.success && res.preview) {
        setPreviewData(res.preview);
        setPreviewMarkdown(res.markdown || "");
        setPreviewBrief(res.brief || "");
      } else {
        setErrorMessage(res.error || "Failed to load upcoming week preview.");
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

    const filename =
      activeTab === "recap"
        ? `BUCS_${selectedSeason}_Week_${selectedWeek}_Insights.pdf`
        : `BUCS_${selectedSeason}_Week_${selectedWeek}_Preview.pdf`;
    const staticUrl = `/reports/${filename}`;
    const printUrl = `/admin/facts/print?week=${selectedWeek}&season=${selectedSeason}&mode=${activeTab}&auto=true`;

    try {
      // 1. Fast path: check if static pre-generated PDF is available on CDN
      try {
        const headCheck = await fetch(staticUrl, { method: "HEAD" });
        if (headCheck.ok) {
          window.open(staticUrl, "_blank");
          setSuccessMessage(`Opened pre-built ${filename}`);
          setIsPdfLoading(false);
          return;
        }
      } catch {
        // Fall back to on-demand browser print view
      }

      // 2. On-demand browser print view (instant PDF export without console commands)
      window.open(printUrl, "_blank");
      setSuccessMessage(`Opened printable report for Week ${selectedWeek}. Select 'Save as PDF' to save your file.`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to open PDF export.");
    } finally {
      setIsPdfLoading(false);
    }
  }

  async function handleCopy(type: "markdown" | "brief") {
    const textToCopy =
      activeTab === "recap"
        ? type === "markdown"
          ? recapMarkdown
          : recapBrief
        : type === "markdown"
        ? previewMarkdown
        : previewBrief;

    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 3000);
    } catch (e) {
      console.error("Clipboard copy failed:", e);
    }
  }

  // Destructure Recap Data Safely
  const {
    overview: recapOverview = {},
    scorigamis = { allTime: [], level: [] },
    rivalries: recapRivalries = { inauguralMatchups: [], longHiatusMatchups: [], seriesStreaks: [], revengeGames: [] },
    extremes = { shutouts: [], nailbiters: [] },
    recordsAndMilestones = { programRecords: [], milestoneWins: [] },
    standingsMomentum = { perfectStarts: [], bounceBacks: [], winlessStarts: [] },
    brightonSpotlight = null,
    postponements = [],
  } = factsData || {};

  // Destructure Preview Data Safely
  const totalFixtures = previewData?.totalFixtures ?? 0;
  const marqueeMatchups = previewData?.marqueeMatchups ?? [];
  const brightonPreview = previewData?.brightonPreview ?? null;
  const inauguralMatchups = previewData?.inauguralMatchups ?? [];
  const longHiatusMatchups = previewData?.longHiatusMatchups ?? [];
  const seriesDominance = previewData?.seriesDominance ?? [];
  const revengeAngles = previewData?.revengeAngles ?? [];
  const formWatch = previewData?.formWatch ?? {};
  const defendingPerfection = formWatch?.defendingPerfection ?? [];
  const winlessTeams = formWatch?.winlessTeams ?? [];
  const shutoutStreaks = formWatch?.shutoutStreaks ?? [];
  const milestoneAlerts = previewData?.milestoneAlerts ?? [];
  const predictedGames = previewData?.predictedGames ?? [];

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
              <span className="text-xs font-medium text-slate-500">Weekly Intelligence Hub</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              🏈 BUCS Intelligence & Scouting Hub
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Deterministic cross-referencing of 16,000+ fixtures: historical facts, scorigamis, marquee previews, and model projections.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleCopy("markdown")}
              disabled={isLoading || (activeTab === "recap" ? !recapMarkdown : !previewMarkdown)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
              title="Copy formatted markdown report for Discord, Slack, or socials"
            >
              📋 {copiedType === "markdown" ? "Copied Markdown!" : "Copy Markdown"}
            </button>

            <button
              onClick={() => handleCopy("brief")}
              disabled={isLoading || (activeTab === "recap" ? !recapBrief : !previewBrief)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
              title="Copy executive summary"
            >
              💬 {copiedType === "brief" ? "Copied Summary!" : "Copy Summary"}
            </button>

            <Link
              href={`/admin/facts/print?week=${selectedWeek}&season=${selectedSeason}&mode=${activeTab}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition"
              title="Open print-formatted A4 preview in a new tab"
            >
              🖨️ Print View
            </Link>

            <button
              onClick={handleDownloadPdf}
              disabled={isLoading || isPdfLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-sky-600 text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 transition"
              title="Export report as PDF via on-demand print view"
            >
              {isPdfLoading
                ? "⏳ Preparing PDF..."
                : activeTab === "recap"
                ? "📥 Export / Save Recap PDF"
                : "📥 Export / Save Preview PDF"}
            </button>
          </div>
        </div>

        {/* Tab Toggle Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
          <button
            onClick={() => handleTabChange("preview")}
            className={`pb-3 px-4 text-sm font-extrabold border-b-2 transition flex items-center gap-2 ${
              activeTab === "preview"
                ? "border-sky-600 text-sky-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            🔮 Upcoming Slate Preview
            <span className="bg-sky-100 text-sky-700 text-[10px] font-black px-1.5 py-0.5 rounded-full">
              Week {selectedWeek}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("recap")}
            className={`pb-3 px-4 text-sm font-extrabold border-b-2 transition flex items-center gap-2 ${
              activeTab === "recap"
                ? "border-sky-600 text-sky-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            📊 Completed Slate Recap & Facts
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-1.5 py-0.5 rounded-full">
              Archive
            </span>
          </button>
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
              onClick={() => (activeTab === "recap" ? loadFacts(selectedWeek, selectedSeason) : loadPreview(selectedWeek, selectedSeason))}
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
            <div className="text-sm font-semibold text-slate-600">
              {activeTab === "preview"
                ? "Analyzing upcoming matchups against 40+ years of archives and model projections..."
                : "Cross-referencing historical archive for scorigamis, rivalries, and records..."}
            </div>
            <div className="text-xs text-slate-400 mt-1">Evaluating all fixtures, win probabilities, and program streaks</div>
          </div>
        ) : activeTab === "preview" ? (
          /* =========================================================
             PREVIEW TAB CONTENT
             ========================================================= */
          previewData ? (
            <div className="space-y-6">
              {/* Preview KPI Snapshot Tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
                  <div className="text-2xl font-black text-slate-900">{totalFixtures}</div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Scheduled Fixtures</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
                  <div className="text-2xl font-black text-sky-600">{marqueeMatchups?.length ?? 0}</div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Marquee Showdowns</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
                  <div className="text-2xl font-black text-purple-600">{inauguralMatchups?.length ?? 0}</div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">First-Ever Clashes</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
                  <div className="text-2xl font-black text-emerald-600">{predictedGames?.length ?? 0}</div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Model Predictions</div>
                </div>
              </div>

              {/* Brighton Historical Spotlight Preview */}
              {brightonPreview && (
                <div className="relative overflow-hidden rounded-xl border-2 border-[#633063] bg-gradient-to-br from-[#633063]/10 via-white to-[#A52C87]/10 p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🐾</span>
                      <h2 className="text-base font-black text-[#252E30] uppercase tracking-wide">
                        Brighton Panthers Spotlight Preview
                      </h2>
                    </div>
                    <span className="bg-[#633063] text-[#B3A066] border border-[#B3A066]/50 text-xs font-black uppercase px-2.5 py-1 rounded-md self-start sm:self-auto shadow-sm tracking-wider">
                      {brightonPreview.opponent || "Brighton Fixture"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div className="bg-white/90 backdrop-blur rounded-lg p-3 border border-[#633063]/20 shadow-xs">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#633063]">Matchup Details</div>
                      <div className="text-sm font-extrabold text-[#252E30] mt-0.5">{brightonPreview.matchup}</div>
                      <div className="text-xs text-[#252E30]/70 mt-1">
                        📍 {brightonPreview.venue || "TBD"} · 📅 {brightonPreview.date || brightonPreview.kickoffDate || "Upcoming"}
                      </div>
                    </div>

                    <div className="bg-white/90 backdrop-blur rounded-lg p-3 border border-[#633063]/20 shadow-xs">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#633063]">All-Time Series Record</div>
                      <div className="text-sm font-extrabold text-[#A52C87] mt-0.5">
                        {brightonPreview.allTimeSeries || (brightonPreview.priorMeetingsCount ? `${brightonPreview.priorMeetingsCount} Prior Meetings` : "First-ever Meeting")}
                      </div>
                      <div className="text-xs text-[#252E30]/70 mt-1">Definitive Brighton Archive</div>
                    </div>

                    <div className="bg-white/90 backdrop-blur rounded-lg p-3 border border-[#633063]/20 shadow-xs">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#633063]">Model Projected Score</div>
                      {brightonPreview.prediction ? (
                        <div>
                          <div className="text-sm font-black text-[#252E30] mt-0.5">
                            {brightonPreview.prediction.homeScore} - {brightonPreview.prediction.awayScore}
                          </div>
                          <div className="text-xs text-[#A52C87] font-bold mt-1">
                            {brightonPreview.prediction.projectedWinner} ({brightonPreview.prediction.winProb}% Win Prob)
                          </div>
                        </div>
                      ) : brightonPreview.predictedScore ? (
                        <div>
                          <div className="text-sm font-black text-[#252E30] mt-0.5">
                            {brightonPreview.predictedScore}
                          </div>
                          <div className="text-xs text-[#A52C87] font-bold mt-1">
                            {brightonPreview.winProb ? `${brightonPreview.winProb}% Win Prob` : "Projected"}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic mt-1">Prediction pending line release</div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-[#252E30] leading-relaxed bg-white/90 p-3 rounded-lg border-l-4 border-[#B3A066] border border-t-[#633063]/10 border-r-[#633063]/10 border-b-[#633063]/10 font-medium shadow-xs">
                    📖 {brightonPreview.notes}
                  </p>
                </div>
              )}

              {/* Marquee Matchups & Clash of Unbeatens */}
              {(marqueeMatchups?.length ?? 0) > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2 mb-4">
                    ⭐ Marquee Showdowns of the Slate
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {marqueeMatchups.map((m: any, idx: number) => (
                      <div key={idx} className="border border-sky-200 bg-sky-50/50 rounded-xl p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-sm font-black text-slate-900">{m.matchup}</span>
                            <span className="bg-sky-600 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                              {m.division || m.type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed font-medium mb-3">
                            {m.description}
                          </p>
                        </div>
                        {m.prediction && (
                          <div className="pt-2 border-t border-sky-200 flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-semibold">Model Line:</span>
                            <span className="font-extrabold text-sky-900">
                              {m.prediction.projectedWinner} ({m.prediction.winProb}%) · Projected {m.prediction.homeScore}-{m.prediction.awayScore}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inaugural & Hiatus Breakers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2 mb-3">
                    🆕 First-Ever Clashes in 40+ Years
                  </h2>
                  {(inauguralMatchups?.length ?? 0) > 0 ? (
                    <div className="space-y-3">
                      {inauguralMatchups.map((inau: any, idx: number) => (
                        <div key={idx} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <div className="flex items-center justify-between text-xs font-black text-purple-950 mb-1">
                            <span>{inau.matchup}</span>
                            <span className="text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded uppercase">
                              {inau.division || "Inaugural"}
                            </span>
                          </div>
                          <p className="text-xs text-purple-900">{inau.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">No inaugural matchups scheduled for this slate.</div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2 mb-3">
                    ⏳ Multi-Year Hiatus Breakers
                  </h2>
                  {(longHiatusMatchups?.length ?? 0) > 0 ? (
                    <div className="space-y-3">
                      {longHiatusMatchups.map((h: any, idx: number) => (
                        <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-center justify-between text-xs font-black text-amber-950 mb-1">
                            <span>{h.matchup}</span>
                            <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded uppercase">
                              {h.division || `${h.diffYears} Year Hiatus`}
                            </span>
                          </div>
                          <p className="text-xs text-amber-900">{h.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">No long hiatus matchups in this slate.</div>
                  )}
                </div>
              </div>

              {/* Form Watch: Perfection, Shutouts, Desperation */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Shutout Streaks */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    🛡️ Shutout Wall Watch
                  </h3>
                  {(shutoutStreaks?.length ?? 0) > 0 ? (
                    <ul className="space-y-2 text-xs text-slate-700">
                      {shutoutStreaks.map((s: any, idx: number) => (
                        <li key={idx} className="p-2 bg-emerald-50 border border-emerald-200 rounded font-medium text-emerald-950">
                          {s.description}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No active multi-game shutout streaks on the line.</p>
                  )}
                </div>

                {/* Perfection Watch */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    🟢 Perfection on the Line
                  </h3>
                  {(defendingPerfection?.length ?? 0) > 0 ? (
                    <ul className="space-y-2 text-xs text-slate-700">
                      {defendingPerfection.map((u: any, idx: number) => (
                        <li key={idx} className="p-2 bg-slate-50 border border-slate-200 rounded font-medium text-slate-900">
                          <strong>{u.team}</strong> ({u.record}, {u.pointDiff > 0 ? `+${u.pointDiff}` : u.pointDiff} diff) aims to improve to {u.nextWin ? `${u.nextWin}-0` : 'stay unblemished'}.
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No undefeated teams in action.</p>
                  )}
                </div>

                {/* Winless Seeking 1st Win */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    🔴 Seeking 1st Win
                  </h3>
                  {(winlessTeams?.length ?? 0) > 0 ? (
                    <ul className="space-y-2 text-xs text-slate-700">
                      {winlessTeams.map((wb: any, idx: number) => (
                        <li key={idx} className="p-2 bg-rose-50 border border-rose-200 rounded font-medium text-rose-950">
                          <strong>{wb.team}</strong> ({wb.record}, {wb.pointDiff} diff) hunting for their first win of the season.
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No winless programs in action.</p>
                  )}
                </div>
              </div>

              {/* Model Projected Scores Table */}
              {(predictedGames?.length ?? 0) > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                        🔮 Model Score Predictions & Win Probabilities
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Historical power ratings calibrated with 2026 early-season performance
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded">
                      {predictedGames.length} Matchups Projected
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                          <th className="py-2.5 px-3">Fixture</th>
                          <th className="py-2.5 px-3">Division</th>
                          <th className="py-2.5 px-3 text-center">Projected Score</th>
                          <th className="py-2.5 px-3">Projected Winner</th>
                          <th className="py-2.5 px-3 text-right">Win Probability</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {predictedGames.map((p: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{p.game}</td>
                            <td className="py-2.5 px-3 text-slate-500">{p.division}</td>
                            <td className="py-2.5 px-3 text-center font-black text-slate-900">
                              {p.predHome} - {p.predAway}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-sky-700">
                              {p.predWinner}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="inline-block bg-sky-100 text-sky-800 font-extrabold px-2 py-0.5 rounded">
                                {p.winProb}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Milestone Watch */}
              {(milestoneAlerts?.length ?? 0) > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2 mb-3">
                    🏆 Program Milestone Watch
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {milestoneAlerts.map((ms: any, idx: number) => (
                      <div key={idx} className="border border-emerald-200 bg-emerald-50 rounded-lg p-3">
                        <div className="text-xs font-black text-emerald-950">{ms.team}</div>
                        <p className="text-xs text-emerald-800 mt-0.5">{ms.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 text-sm">
              Select a game week above to load upcoming preview insights.
            </div>
          )
        ) : (
          /* =========================================================
             RECAP TAB CONTENT
             ========================================================= */
          factsData ? (
            <div className="space-y-6">
              {/* KPI Snapshot Tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
                  <div className="text-2xl font-black text-slate-900">{recapOverview?.completedGames || 0}</div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Completed Fixtures</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
                  <div className="text-2xl font-black text-slate-900">{recapOverview?.totalPoints || 0}</div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                    Total Points ({recapOverview?.avgPoints || 0} PPG)
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
              {((scorigamis?.allTime?.length ?? 0) > 0 || (scorigamis?.level?.length ?? 0) > 0) && (
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
              {((recordsAndMilestones?.programRecords?.length ?? 0) > 0 || (recordsAndMilestones?.milestoneWins?.length ?? 0) > 0) && (
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
                      {recapRivalries?.inauguralMatchups?.map((inau: any, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-sky-500 font-bold">•</span>
                          <div><strong>{inau.game}</strong>: {inau.description}</div>
                        </li>
                      ))}
                      {recapRivalries?.longHiatusMatchups?.map((h: any, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-500 font-bold">•</span>
                          <div><strong>{h.game}</strong>: {h.description}</div>
                        </li>
                      ))}
                      {(!recapRivalries?.inauguralMatchups?.length && !recapRivalries?.longHiatusMatchups?.length) && (
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
                      {recapRivalries?.seriesStreaks?.slice(0, 6).map((str: any, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-purple-500 font-bold">•</span>
                          <div>{str.description}</div>
                        </li>
                      ))}
                      {!recapRivalries?.seriesStreaks?.length && (
                        <li className="text-slate-400 italic">No active series dominance streaks found.</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Reversals & Revenge */}
                {(recapRivalries?.revengeGames?.length ?? 0) > 0 && (
                  <div className="border border-slate-200 rounded-lg p-3.5 mt-3 bg-slate-50">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Score Reversals & Revenge Victories
                    </h3>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
                      {recapRivalries.revengeGames.map((rev: any, idx: number) => (
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
                  {(extremes?.shutouts?.length ?? 0) > 0 ? (
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
                    {(() => {
                      const pGroups: Record<string, any[]> = {};
                      for (const t of standingsMomentum?.perfectStarts || []) {
                        const rec = t.record || '2-0';
                        if (!pGroups[rec]) pGroups[rec] = [];
                        pGroups[rec].push(t);
                      }
                      return Object.entries(pGroups).map(([rec, teams]) => (
                        <li key={rec}>
                          <span className="font-bold text-emerald-700">🟢 Unblemished ({rec}):</span>{" "}
                          {teams.map((t: any) => `${t.team} (+${t.pointDiff})`).join(", ")}
                        </li>
                      ));
                    })()}
                    {(standingsMomentum?.bounceBacks?.length ?? 0) > 0 && (
                      <li>
                        <span className="font-bold text-sky-700">🔄 Bounce-Back Wins:</span>{" "}
                        {standingsMomentum.bounceBacks.map((b: any) => `${b.team} (${b.record ? `${b.record}, ` : ''}${b.score} vs ${b.opponent})`).join(", ")}
                      </li>
                    )}
                    {(() => {
                      const wGroups: Record<string, any[]> = {};
                      for (const t of standingsMomentum?.winlessStarts || []) {
                        const rec = t.record || '0-2';
                        if (!wGroups[rec]) wGroups[rec] = [];
                        wGroups[rec].push(t);
                      }
                      return Object.entries(wGroups).map(([rec, teams]) => (
                        <li key={rec}>
                          <span className="font-bold text-rose-700">🔴 Seeking 1st Win ({rec}):</span>{" "}
                          {teams.map((t: any) => t.team).join(", ")}
                        </li>
                      ));
                    })()}
                  </ul>
                </div>

                {/* Brighton Spotlight */}
                {brightonSpotlight && (
                  <div className="rounded-xl border-2 border-[#633063] bg-gradient-to-br from-[#633063]/10 via-white to-[#A52C87]/10 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-base font-black text-[#252E30] uppercase tracking-wide flex items-center gap-1.5">
                        🐾 Brighton Panthers Historical Spotlight
                      </h2>
                      <span className="bg-[#633063] text-[#B3A066] border border-[#B3A066]/50 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider shadow-xs">
                        {brightonSpotlight.result.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm font-black text-[#633063] mb-1">
                      {brightonSpotlight.team} {brightonSpotlight.score} {brightonSpotlight.opponent}
                    </div>
                    <p className="text-xs text-[#252E30] leading-relaxed bg-white/80 p-3 rounded-lg border-l-4 border-[#B3A066] border border-t-[#633063]/10 border-r-[#633063]/10 border-b-[#633063]/10 font-medium">
                      {brightonSpotlight.note}
                    </p>
                  </div>
                )}
              </div>

              {/* 6. Postponements */}
              {(postponements?.length ?? 0) > 0 && (
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
          )
        )}

      </div>
    </ArchiveLayout>
  );
}
