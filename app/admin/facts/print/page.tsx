"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  fetchWeeklyFactsAction,
  fetchWeeklyPreviewAction,
} from "../actions";
import { BUCS_2026_WEEKS } from "@/lib/facts/constants.mjs";

function PrintPageContent() {
  const searchParams = useSearchParams();
  const initialWeek = Number(searchParams.get("week")) || 3;
  const initialSeason = Number(searchParams.get("season")) || 2026;
  const initialMode = (searchParams.get("mode") as "recap" | "preview") || "recap";
  const autoPrint = searchParams.get("auto") === "true";

  const [mode, setMode] = useState<"recap" | "preview">(initialMode);
  const [week, setWeek] = useState<number>(initialWeek);
  const [season, setSeason] = useState<number>(initialSeason);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [factsData, setFactsData] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);

  useEffect(() => {
    loadData(mode, week, season);
  }, [mode, week, season]);

  async function loadData(targetMode: "recap" | "preview", targetWeek: number, targetSeason: number) {
    setIsLoading(true);
    setError(null);

    try {
      if (targetMode === "recap") {
        const res = await fetchWeeklyFactsAction({ week: targetWeek, season: targetSeason });
        if (res.success && res.facts) {
          setFactsData(res.facts);
        } else {
          setError(res.error || "Failed to load weekly facts.");
        }
      } else {
        const res = await fetchWeeklyPreviewAction({ week: targetWeek, season: targetSeason });
        if (res.success && res.preview) {
          setPreviewData(res.preview);
        } else {
          setError(res.error || "Failed to load weekly preview.");
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  const hasAutoPrinted = useRef(false);

  // Trigger auto-print after data loads (once only)
  useEffect(() => {
    if (!isLoading && !error && autoPrint && !hasAutoPrinted.current && (factsData || previewData)) {
      hasAutoPrinted.current = true;
      const timer = setTimeout(() => {
        window.print();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isLoading, error, autoPrint, factsData, previewData]);

  const currentWeekObj = BUCS_2026_WEEKS.find((w: any) => w.weekNumber === week) || {
    weekNumber: week,
    label: `Week ${week}`,
  };

  // Recap data
  const {
    overview: recapOverview = {},
    scorigamis = { allTime: [], level: [] },
    rivalries: recapRivalries = { inauguralMatchups: [], longHiatusMatchups: [], seriesStreaks: [], revengeGames: [] },
    extremes = { shutouts: [], nailbiters: [] },
    recordsAndMilestones = { programRecords: [], milestoneWins: [] },
    standingsMomentum = { perfectStarts: [], bounceBacks: [], winlessStarts: [] },
    brightonSpotlight = null,
  } = factsData || {};

  // Preview data
  const totalFixtures = previewData?.totalFixtures ?? 0;
  const marqueeMatchups = previewData?.marqueeMatchups ?? [];
  const brightonPreview = previewData?.brightonPreview ?? null;
  const inauguralMatchups = previewData?.inauguralMatchups ?? [];
  const longHiatusMatchups = previewData?.longHiatusMatchups ?? [];
  const formWatch = previewData?.formWatch ?? {};
  const defendingPerfection = formWatch?.defendingPerfection ?? [];
  const winlessTeams = formWatch?.winlessTeams ?? [];
  const shutoutStreaks = formWatch?.shutoutStreaks ?? [];
  const milestoneAlerts = previewData?.milestoneAlerts ?? [];
  const predictedGames = previewData?.predictedGames ?? [];

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white text-slate-900 font-sans">
      {/* Print styles */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
          .avoid-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      {/* Floating Toolbar (Hidden during print) */}
      <header className="no-print sticky top-0 z-50 bg-slate-900 text-white shadow-lg border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/facts"
              className="text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md transition"
            >
              ← Back to Facts Hub
            </Link>
            <div className="hidden sm:block text-slate-500">|</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode("recap")}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition ${
                  mode === "recap" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                📊 Completed Recap
              </button>
              <button
                onClick={() => setMode("preview")}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition ${
                  mode === "preview" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                🔮 Upcoming Preview
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              className="bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-md border border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {BUCS_2026_WEEKS.map((w: any) => (
                <option key={w.weekNumber} value={w.weekNumber}>
                  {w.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => window.print()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider px-4 py-2 rounded-md shadow-md transition disabled:opacity-50"
            >
              🖨️ Print / Save as PDF
            </button>
          </div>
        </div>

        <div className="bg-slate-800/80 px-4 py-1.5 text-center text-[11px] text-slate-300">
          💡 <strong className="text-white">Tip:</strong> In your browser print dialog, set Destination to{" "}
          <span className="text-sky-300 font-bold">&quot;Save as PDF&quot;</span> and ensure{" "}
          <span className="text-sky-300 font-bold">&quot;Background graphics&quot;</span> is checked.
        </div>
      </header>

      {/* Main A4 Document Canvas */}
      <main className="max-w-[210mm] mx-auto my-6 print:my-0 bg-white shadow-2xl print:shadow-none border border-slate-200 print:border-none p-8 print:p-0 min-h-[297mm]">
        {isLoading ? (
          <div className="py-32 text-center text-slate-500">
            <div className="inline-block animate-spin text-4xl mb-3">🏈</div>
            <div className="text-sm font-bold">Compiling intelligence report from archive...</div>
            <div className="text-xs text-slate-400 mt-1">Evaluating scorigamis, milestones, and matchup histories</div>
          </div>
        ) : error ? (
          <div className="p-8 bg-red-50 border border-red-200 rounded-lg text-center text-red-700">
            <div className="text-lg font-bold mb-1">Failed to generate report</div>
            <div className="text-xs">{error}</div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Document Header */}
            <header className="border-b-2 border-slate-900 pb-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-sky-600">
                  UK American Football Archive · britball.io
                </div>
                <h1 className="text-xl font-black text-slate-950 uppercase tracking-tight mt-0.5">
                  {mode === "recap"
                    ? `BUCS Weekly Intelligence Report — ${currentWeekObj.label}`
                    : `Upcoming Scouting & Intelligence Preview — ${currentWeekObj.label}`}
                </h1>
                <div className="text-xs font-semibold text-slate-500 mt-0.5">
                  BUCS {season}/{season + 1} American Football Season
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="inline-block bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                  Official Intelligence Brief
                </span>
                <div className="text-[10px] text-slate-400 mt-1 font-medium">
                  {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            </header>

            {/* KPI Bar */}
            <div className="grid grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
              {mode === "recap" ? (
                <>
                  <div>
                    <div className="text-lg font-black text-slate-900">{recapOverview.completedGames || 0}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Completed Fixtures</div>
                  </div>
                  <div>
                    <div className="text-lg font-black text-slate-900">{recapOverview.totalPoints || 0}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      Points ({recapOverview.avgPoints || 0} PPG)
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-black text-emerald-600">{extremes.shutouts?.length || 0}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Shutouts Pitched</div>
                  </div>
                  <div>
                    <div className="text-lg font-black text-amber-500">
                      {(scorigamis.allTime?.length || 0) + (scorigamis.level?.length || 0)}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Scorigamis Unlocked</div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="text-lg font-black text-slate-900">{totalFixtures}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Scheduled Games</div>
                  </div>
                  <div>
                    <div className="text-lg font-black text-sky-600">{marqueeMatchups.length}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Marquee Showdowns</div>
                  </div>
                  <div>
                    <div className="text-lg font-black text-purple-600">{inauguralMatchups.length}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">First-Ever Meetings</div>
                  </div>
                  <div>
                    <div className="text-lg font-black text-emerald-600">{predictedGames.length}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Model Lines</div>
                  </div>
                </>
              )}
            </div>

            {/* ========================================================
               RECAP MODE CONTENT
               ======================================================== */}
            {mode === "recap" && (
              <>
                {/* 1. Scorigamis */}
                {((scorigamis.allTime?.length ?? 0) > 0 || (scorigamis.level?.length ?? 0) > 0) && (
                  <section className="avoid-break">
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-l-4 border-amber-500 pl-2 mb-2 flex items-center gap-1.5">
                      🎯 Scorigami Watch
                    </h2>
                    <div className="space-y-2">
                      {scorigamis.allTime?.map((sc: any, idx: number) => (
                        <div key={idx} className="bg-amber-50 border border-amber-400 rounded-md p-2.5">
                          <div className="flex items-center justify-between text-xs font-black text-amber-950 mb-0.5">
                            <span>{sc.game}</span>
                            <span className="bg-amber-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded">
                              ALL-TIME BRITBALL SCORIGAMI
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-900 font-medium">
                            {sc.description} ({sc.division})
                          </p>
                        </div>
                      ))}
                      <div className="grid grid-cols-2 gap-2">
                        {scorigamis.level?.map((sc: any, idx: number) => (
                          <div key={idx} className="bg-sky-50 border border-sky-200 rounded-md p-2">
                            <div className="flex items-center justify-between text-[11px] font-bold text-sky-950 mb-0.5">
                              <span>{sc.game}</span>
                              <span className="bg-sky-600 text-white text-[8px] uppercase px-1 rounded">
                                {sc.level}
                              </span>
                            </div>
                            <p className="text-[10px] text-sky-800">{sc.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {/* 2. Program Records & Historic Milestones */}
                {((recordsAndMilestones.programRecords?.length ?? 0) > 0 ||
                  (recordsAndMilestones.milestoneWins?.length ?? 0) > 0) && (
                  <section className="avoid-break">
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-l-4 border-emerald-500 pl-2 mb-2 flex items-center gap-1.5">
                      📜 Program Records & Milestones
                    </h2>
                    <div className="grid grid-cols-2 gap-2">
                      {recordsAndMilestones.programRecords?.map((rec: any, idx: number) => (
                        <div key={idx} className="border border-slate-200 rounded-md p-2 bg-slate-50">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-900 mb-0.5">
                            <span>{rec.team}</span>
                            <span className="bg-emerald-100 text-emerald-800 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">
                              {rec.type}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-700">{rec.description}</p>
                        </div>
                      ))}
                      {recordsAndMilestones.milestoneWins?.map((ms: any, idx: number) => (
                        <div key={idx} className="border border-emerald-200 bg-emerald-50 rounded-md p-2">
                          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-950 mb-0.5">
                            <span>{ms.team}</span>
                            <span className="bg-emerald-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">
                              {ms.wins}th PROGRAM WIN
                            </span>
                          </div>
                          <p className="text-[10px] text-emerald-800">{ms.description}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 3. Rivalries & Series Context */}
                <section className="avoid-break">
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-l-4 border-purple-500 pl-2 mb-2 flex items-center gap-1.5">
                    ⚔️ Rivalry & Series Context
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-slate-200 rounded-md p-2.5">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Inaugural Matches & Hiatuses Ended
                      </div>
                      <ul className="space-y-1.5 text-[11px] text-slate-700">
                        {recapRivalries.inauguralMatchups?.map((inau: any, idx: number) => (
                          <li key={idx}>
                            <strong>{inau.game}</strong>: {inau.description}
                          </li>
                        ))}
                        {recapRivalries.longHiatusMatchups?.map((h: any, idx: number) => (
                          <li key={idx}>
                            <strong>{h.game}</strong>: {h.description}
                          </li>
                        ))}
                        {(!recapRivalries.inauguralMatchups?.length && !recapRivalries.longHiatusMatchups?.length) && (
                          <li className="text-slate-400 italic">None in this slate.</li>
                        )}
                      </ul>
                    </div>

                    <div className="border border-slate-200 rounded-md p-2.5">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Head-to-Head Win Streaks & Revenge
                      </div>
                      <ul className="space-y-1.5 text-[11px] text-slate-700">
                        {recapRivalries.seriesStreaks?.slice(0, 4).map((str: any, idx: number) => (
                          <li key={idx}>{str.description}</li>
                        ))}
                        {recapRivalries.revengeGames?.slice(0, 3).map((rev: any, idx: number) => (
                          <li key={idx} className="text-amber-900">
                            🔄 <strong>{rev.winner} {rev.currentScore} {rev.loser}</strong>: {rev.description}
                          </li>
                        ))}
                        {(!recapRivalries.seriesStreaks?.length && !recapRivalries.revengeGames?.length) && (
                          <li className="text-slate-400 italic">No active series streaks recorded.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </section>

                {/* 4. Extremes & The Shutout Club */}
                <section className="avoid-break">
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-l-4 border-red-500 pl-2 mb-2 flex items-center gap-1.5">
                    ⚡ Slate Extremes & The Shutout Wall
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-slate-200 rounded-md p-2.5">
                      <ul className="space-y-1.5 text-[11px] text-slate-700">
                        {extremes.shootout && (
                          <li>
                            🔥 <strong>Shootout of the Week</strong>: {extremes.shootout.game} (
                            <span className="font-bold">{extremes.shootout.combined} pts</span> in {extremes.shootout.division})
                          </li>
                        )}
                        {extremes.defensiveBattle && (
                          <li>
                            🔒 <strong>Defensive Slugfest</strong>: {extremes.defensiveBattle.game} (
                            <span className="font-bold">{extremes.defensiveBattle.combined} pts</span>)
                          </li>
                        )}
                        {extremes.biggestBlowout && (
                          <li>
                            🚜 <strong>Margin of the Week</strong>: {extremes.biggestBlowout.game} (
                            <span className="font-bold">+{extremes.biggestBlowout.diff} margin</span>)
                          </li>
                        )}
                        {extremes.nailbiters?.map((nb: any, idx: number) => (
                          <li key={idx}>
                            ⏱️ <strong>Nailbiter</strong>: {nb.game} (decided by {nb.diff} pt{nb.diff === 1 ? "" : "s"})
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="border border-slate-200 rounded-md p-2.5">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Clean Sheets Pitched ({extremes.shutouts?.length || 0})
                      </div>
                      {(extremes.shutouts?.length ?? 0) > 0 ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          {extremes.shutouts.map((s: any, idx: number) => (
                            <div key={idx} className="bg-slate-50 border-l-2 border-emerald-500 rounded px-2 py-1 text-[10px]">
                              <div className="font-bold text-slate-900">{s.team} {s.score}</div>
                              <div className="text-slate-500">{s.opponent}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">No shutouts pitched.</div>
                      )}
                    </div>
                  </div>
                </section>

                {/* 5. Form & Brighton Spotlight */}
                <section className="avoid-break grid grid-cols-2 gap-3">
                  <div className="border border-slate-200 rounded-md p-2.5">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      📈 Season Form & Momentum
                    </h3>
                    <ul className="space-y-1.5 text-[11px] text-slate-700">
                      {(() => {
                        const pGroups: Record<string, any[]> = {};
                        for (const t of standingsMomentum?.perfectStarts || []) {
                          const rec = t.record || "2-0";
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
                          <span className="font-bold text-sky-700">🔄 Bounce-Backs:</span>{" "}
                          {standingsMomentum.bounceBacks
                            .map((b: any) => `${b.team} (${b.record ? `${b.record}, ` : ""}${b.score} vs ${b.opponent})`)
                            .join(", ")}
                        </li>
                      )}
                      {(() => {
                        const wGroups: Record<string, any[]> = {};
                        for (const t of standingsMomentum?.winlessStarts || []) {
                          const rec = t.record || "0-2";
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

                  {brightonSpotlight && (
                    <div className="bg-[#633063]/5 border-2 border-[#633063] rounded-md p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase text-[#252E30] flex items-center gap-1">
                          🐾 Brighton Panthers Historical Spotlight
                        </span>
                        <span className="bg-[#633063] text-[#B3A066] border border-[#B3A066]/40 text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider">
                          {brightonSpotlight.result.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs font-black text-[#633063] mb-0.5">
                        {brightonSpotlight.team} {brightonSpotlight.score} {brightonSpotlight.opponent}
                      </div>
                      <p className="text-[10px] text-[#252E30] leading-normal border-l-2 border-[#B3A066] pl-2 font-medium">
                        {brightonSpotlight.note}
                      </p>
                    </div>
                  )}
                </section>
              </>
            )}

            {/* ========================================================
               PREVIEW MODE CONTENT
               ======================================================== */}
            {mode === "preview" && (
              <>
                {/* 1. Brighton Preview Spotlight */}
                {brightonPreview && (
                  <section className="avoid-break bg-[#633063]/5 border-2 border-[#633063] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-xs font-black text-[#252E30] uppercase tracking-wide flex items-center gap-1.5">
                        🐾 Brighton Panthers Spotlight Preview
                      </h2>
                      <span className="bg-[#633063] text-[#B3A066] border border-[#B3A066]/40 text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wider">
                        {brightonPreview.opponent || "Upcoming"}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-2 text-[11px]">
                      <div className="bg-white p-2 rounded border border-[#633063]/20 shadow-xs">
                        <div className="text-[8px] font-extrabold text-[#633063] uppercase">Matchup</div>
                        <div className="font-bold text-[#252E30] mt-0.5">{brightonPreview.matchup}</div>
                        <div className="text-[9px] text-[#252E30]/70">{brightonPreview.venue || "TBD"}</div>
                      </div>
                      <div className="bg-white p-2 rounded border border-[#633063]/20 shadow-xs">
                        <div className="text-[8px] font-extrabold text-[#633063] uppercase">All-Time Series</div>
                        <div className="font-bold text-[#A52C87] mt-0.5">
                          {brightonPreview.allTimeSeries || `${brightonPreview.priorMeetingsCount} prior meetings`}
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded border border-[#633063]/20 shadow-xs">
                        <div className="text-[8px] font-extrabold text-[#633063] uppercase">Model Projected Score</div>
                        {brightonPreview.prediction ? (
                          <div>
                            <div className="font-black text-[#252E30] mt-0.5">
                              {brightonPreview.prediction.homeScore} - {brightonPreview.prediction.awayScore}
                            </div>
                            <div className="text-[9px] text-[#A52C87] font-bold">
                              {brightonPreview.prediction.projectedWinner} ({brightonPreview.prediction.winProb}%)
                            </div>
                          </div>
                        ) : brightonPreview.predictedScore ? (
                          <div className="font-black text-[#252E30] mt-0.5">{brightonPreview.predictedScore}</div>
                        ) : (
                          <div className="text-slate-400 italic">Pending</div>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-[#252E30] font-medium leading-normal bg-white p-2 rounded border-l-2 border-[#B3A066] border border-[#633063]/10">
                      📖 {brightonPreview.notes}
                    </p>
                  </section>
                )}

                {/* 2. Marquee Matchups */}
                {(marqueeMatchups.length ?? 0) > 0 && (
                  <section className="avoid-break">
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-l-4 border-sky-600 pl-2 mb-2">
                      ⭐ Marquee Showdowns of the Slate
                    </h2>
                    <div className="grid grid-cols-2 gap-2">
                      {marqueeMatchups.slice(0, 4).map((m: any, idx: number) => (
                        <div key={idx} className="border border-sky-200 bg-sky-50/50 rounded-md p-2.5">
                          <div className="flex items-center justify-between text-[11px] font-black text-slate-900 mb-1">
                            <span>{m.matchup}</span>
                            <span className="bg-sky-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">
                              {m.division || m.type}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-700 leading-normal">{m.description}</p>
                          {m.prediction && (
                            <div className="mt-1 pt-1 border-t border-sky-200 flex justify-between text-[9px] font-bold text-sky-900">
                              <span>Model Line:</span>
                              <span>
                                {m.prediction.projectedWinner} ({m.prediction.winProb}%) · Projected {m.prediction.homeScore}-{m.prediction.awayScore}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 3. Inaugural Encounters & Hiatuses */}
                <section className="avoid-break grid grid-cols-2 gap-3">
                  <div className="border border-slate-200 rounded-md p-2.5">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-purple-700 mb-1">
                      🆕 First-Ever Clashes in 40+ Years
                    </div>
                    {(inauguralMatchups.length ?? 0) > 0 ? (
                      <ul className="space-y-1.5 text-[10px] text-slate-700">
                        {inauguralMatchups.slice(0, 4).map((inau: any, idx: number) => (
                          <li key={idx}>
                            <strong>{inau.matchup}</strong> ({inau.division}): {inau.description}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-xs text-slate-400 italic">None scheduled.</div>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-md p-2.5">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                      ⏳ Multi-Year Hiatus Breakers (≥4 Yrs)
                    </div>
                    {(longHiatusMatchups.length ?? 0) > 0 ? (
                      <ul className="space-y-1.5 text-[10px] text-slate-700">
                        {longHiatusMatchups.slice(0, 4).map((h: any, idx: number) => (
                          <li key={idx}>
                            <strong>{h.matchup}</strong>: {h.description}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-xs text-slate-400 italic">None scheduled.</div>
                    )}
                  </div>
                </section>

                {/* 4. Form Watch & Milestones */}
                <section className="avoid-break grid grid-cols-3 gap-2">
                  <div className="border border-slate-200 rounded-md p-2">
                    <div className="text-[8px] font-bold uppercase text-emerald-700 mb-1">🛡️ Shutout Wall Watch</div>
                    {(shutoutStreaks.length ?? 0) > 0 ? (
                      <ul className="space-y-1 text-[9px] text-slate-700">
                        {shutoutStreaks.map((s: any, idx: number) => (
                          <li key={idx}>{s.description}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-[9px] text-slate-400 italic">None active.</div>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-md p-2">
                    <div className="text-[8px] font-bold uppercase text-slate-700 mb-1">🟢 Perfection on the Line</div>
                    {(defendingPerfection.length ?? 0) > 0 ? (
                      <ul className="space-y-1 text-[9px] text-slate-700">
                        {defendingPerfection.map((u: any, idx: number) => (
                          <li key={idx}>
                            <strong>{u.team}</strong> ({u.record}) aiming for {u.nextWin}-0
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-[9px] text-slate-400 italic">None active.</div>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-md p-2">
                    <div className="text-[8px] font-bold uppercase text-rose-700 mb-1">🔴 Seeking 1st Win</div>
                    {(winlessTeams.length ?? 0) > 0 ? (
                      <ul className="space-y-1 text-[9px] text-slate-700">
                        {winlessTeams.map((wb: any, idx: number) => (
                          <li key={idx}>
                            <strong>{wb.team}</strong> ({wb.record})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-[9px] text-slate-400 italic">None active.</div>
                    )}
                  </div>
                </section>

                {/* 5. Program Milestone Watch */}
                {(milestoneAlerts?.length ?? 0) > 0 && (
                  <section className="avoid-break">
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-l-4 border-emerald-500 pl-2 mb-2 flex items-center gap-1.5">
                      🏆 Program Milestone Watch
                    </h2>
                    <div className="grid grid-cols-2 gap-2">
                      {milestoneAlerts.map((ms: any, idx: number) => (
                        <div key={idx} className="border border-emerald-200 bg-emerald-50 rounded-md p-2">
                          <div className="text-[11px] font-bold text-emerald-950 mb-0.5">{ms.team}</div>
                          <p className="text-[10px] text-emerald-800">{ms.description}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 6. Model Score Predictions Table */}
                {(predictedGames.length ?? 0) > 0 && (
                  <section className="avoid-break">
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-l-4 border-emerald-600 pl-2 mb-2 flex items-center justify-between">
                      <span>🔮 Model Score Predictions & Win Probabilities</span>
                      <span className="text-[9px] font-semibold text-slate-500">{predictedGames.length} Matchups</span>
                    </h2>
                    <table className="w-full text-left text-[9px] border border-slate-200 rounded">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                          <th className="py-1 px-2">Fixture</th>
                          <th className="py-1 px-2">Division</th>
                          <th className="py-1 px-2 text-center">Projected</th>
                          <th className="py-1 px-2">Projected Winner</th>
                          <th className="py-1 px-2 text-right">Win Prob</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {predictedGames.slice(0, 15).map((p: any, idx: number) => (
                          <tr key={idx}>
                            <td className="py-1 px-2 font-bold text-slate-900">{p.game}</td>
                            <td className="py-1 px-2 text-slate-500">{p.division}</td>
                            <td className="py-1 px-2 text-center font-black text-slate-900">
                              {p.predHome} - {p.predAway}
                            </td>
                            <td className="py-1 px-2 font-bold text-sky-700">{p.predWinner}</td>
                            <td className="py-1 px-2 text-right font-black text-slate-900">{p.winProb}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                )}
              </>
            )}

            {/* Document Footer */}
            <footer className="border-t border-slate-300 pt-3 text-[9px] text-slate-400 flex items-center justify-between">
              <div>UK American Football Archive · britball.io</div>
              <div>Generated dynamically from verified historical archives · {season}/{season + 1} BUCS Season</div>
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AdminFactsPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-bold text-slate-500">
          Loading print view...
        </div>
      }
    >
      <PrintPageContent />
    </Suspense>
  );
}
