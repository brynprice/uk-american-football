"use client";

import { useState, useEffect, useTransition } from "react";
import ArchiveLayout from "@/components/archive/ArchiveLayout";
import Link from "next/link";
import { fetchGamedayData, saveGamedayScores, GamedayUpdatePayload } from "./actions";

export default function GamedayPage() {
    const [seasons, setSeasons] = useState<any[]>([]);
    const [phases, setPhases] = useState<any[]>([]);
    const [games, setGames] = useState<any[]>([]);

    const [selectedSeason, setSelectedSeason] = useState<string>("");
    const [selectedPhase, setSelectedPhase] = useState<string>("");
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const [editedScores, setEditedScores] = useState<Record<string, {
        home_score: number | null;
        away_score: number | null;
        status: string;
        notes: string;
        isDirty: boolean;
    }>>({});

    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

    // Initial Load
    useEffect(() => {
        loadData();
    }, [selectedSeason, selectedPhase, selectedDate]);

    async function loadData() {
        setIsLoading(true);
        setMessage(null);
        try {
            const data = await fetchGamedayData(selectedSeason || undefined, selectedPhase || undefined, selectedDate || undefined);
            setSeasons(data.seasons);
            setPhases(data.phases);
            setGames(data.games);

            if (!selectedSeason && data.seasons.length > 0) {
                setSelectedSeason(data.seasons[0].id);
            }

            // Reset edits state
            const initialEdits: Record<string, any> = {};
            data.games.forEach(g => {
                initialEdits[g.id] = {
                    home_score: g.home_score,
                    away_score: g.away_score,
                    status: g.status || "scheduled",
                    notes: g.notes || "",
                    isDirty: false
                };
            });
            setEditedScores(initialEdits);
        } catch (err: any) {
            setMessage({ text: err.message || "Failed to load fixtures", type: "error" });
        } finally {
            setIsLoading(false);
        }
    }

    const handleScoreChange = (gameId: string, field: "home_score" | "away_score", val: string) => {
        const numVal = val === "" ? null : parseInt(val, 10);
        setEditedScores(prev => {
            const current = prev[gameId] || {};
            const updated = {
                ...current,
                [field]: isNaN(numVal as any) ? null : numVal,
                isDirty: true
            };
            // If both scores are present and status was scheduled, automatically switch to completed
            if (updated.home_score !== null && updated.away_score !== null && updated.status === "scheduled") {
                updated.status = "completed";
            }
            return { ...prev, [gameId]: updated };
        });
    };

    const handleStatusChange = (gameId: string, newStatus: string) => {
        setEditedScores(prev => ({
            ...prev,
            [gameId]: {
                ...(prev[gameId] || {}),
                status: newStatus,
                isDirty: true
            }
        }));
    };

    const handleAwardWalkover = (gameId: string, winner: "home" | "away") => {
        setEditedScores(prev => {
            const game = games.find(g => g.id === gameId);
            const winnerName = winner === "home" ? game?.home_team?.name : game?.away_team?.name;
            return {
                ...prev,
                [gameId]: {
                    home_score: winner === "home" ? 1 : 0,
                    away_score: winner === "away" ? 1 : 0,
                    status: "awarded",
                    notes: `Walkover awarded to ${winnerName || "winner"} per BUCS regulations. Source: BUCS Play`,
                    isDirty: true
                }
            };
        });
    };

    const handlePostpone = (gameId: string) => {
        setEditedScores(prev => ({
            ...prev,
            [gameId]: {
                ...(prev[gameId] || {}),
                home_score: null,
                away_score: null,
                status: "postponed",
                notes: prev[gameId]?.notes || "Fixture postponed. Replay date TBD.",
                isDirty: true
            }
        }));
    };

    const handleCancel = (gameId: string) => {
        setEditedScores(prev => ({
            ...prev,
            [gameId]: {
                ...(prev[gameId] || {}),
                home_score: null,
                away_score: null,
                status: "cancelled",
                notes: prev[gameId]?.notes || "Fixture cancelled/void per league determination.",
                isDirty: true
            }
        }));
    };

    const handleNotesChange = (gameId: string, text: string) => {
        setEditedScores(prev => ({
            ...prev,
            [gameId]: {
                ...(prev[gameId] || {}),
                notes: text,
                isDirty: true
            }
        }));
    };

    const dirtyGamesCount = Object.values(editedScores).filter(s => s.isDirty).length;

    const handleSaveAll = () => {
        const dirtyPayloads: GamedayUpdatePayload[] = Object.entries(editedScores)
            .filter(([_, data]) => data.isDirty)
            .map(([id, data]) => ({
                id,
                home_score: data.home_score,
                away_score: data.away_score,
                status: data.status,
                notes: data.notes
            }));

        if (dirtyPayloads.length === 0) return;

        startTransition(async () => {
            try {
                const res = await saveGamedayScores(dirtyPayloads);
                setMessage({ text: `Successfully updated ${res.count} fixture(s) and recomputed standings!`, type: "success" });
                // Mark all clean
                setEditedScores(prev => {
                    const next = { ...prev };
                    dirtyPayloads.forEach(p => {
                        if (next[p.id]) next[p.id].isDirty = false;
                    });
                    return next;
                });
            } catch (err: any) {
                setMessage({ text: err.message || "Failed to save changes", type: "error" });
            }
        });
    };

    // Filter games
    const filteredGames = games.filter(g => {
        if (statusFilter === "pending") {
            const currentStatus = editedScores[g.id]?.status || g.status;
            return currentStatus === "scheduled" || currentStatus === "postponed";
        }
        if (statusFilter === "completed") {
            const currentStatus = editedScores[g.id]?.status || g.status;
            return currentStatus === "completed" || currentStatus === "awarded";
        }
        if (statusFilter === "disrupted") {
            const currentStatus = editedScores[g.id]?.status || g.status;
            return currentStatus === "postponed" || currentStatus === "cancelled" || currentStatus === "awarded";
        }
        return true;
    });

    return (
        <ArchiveLayout>
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link href="/admin" className="text-xs font-black uppercase text-blue-600 hover:underline">
                            &larr; Admin Dashboard
                        </Link>
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-xs font-black uppercase text-slate-500">Live Operations</span>
                    </div>
                    <h1 className="text-4xl font-black uppercase italic tracking-tighter">Gameday Scoreboard</h1>
                    <p className="text-slate-500 font-sans">
                        Fast bulk entry for weekend match results, postponements, and walkovers.
                    </p>
                </div>

                {/* Floating / Action Bar */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSaveAll}
                        disabled={dirtyGamesCount === 0 || isPending}
                        className={`text-xs uppercase font-black px-6 py-3 border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${
                            dirtyGamesCount > 0
                                ? "bg-emerald-500 text-white hover:bg-emerald-600 active:translate-x-[2px] active:translate-y-[2px]"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed"
                        }`}
                    >
                        {isPending ? "Saving..." : `Save All Changes (${dirtyGamesCount})`}
                    </button>
                </div>
            </div>

            {/* Notification Banner */}
            {message && (
                <div className={`p-4 border-2 border-slate-900 mb-6 font-bold text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
                    message.type === "success" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"
                }`}>
                    {message.text}
                </div>
            )}

            {/* Filters Bar */}
            <div className="bg-white border-2 border-slate-900 p-6 mb-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
                <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Season</label>
                    <select
                        value={selectedSeason}
                        onChange={e => {
                            setSelectedSeason(e.target.value);
                            setSelectedPhase("");
                        }}
                        className="w-full bg-slate-50 border-2 border-slate-900 p-2 text-sm font-bold"
                    >
                        {seasons.map(s => (
                            <option key={s.id} value={s.id}>
                                {s.competition?.name} {s.year} ({s.name || `${s.year}/${(s.year + 1).toString().slice(-2)}`})
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Phase / Conference</label>
                    <select
                        value={selectedPhase}
                        onChange={e => setSelectedPhase(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-900 p-2 text-sm font-bold"
                    >
                        <option value="">All Phases ({phases.length})</option>
                        {phases.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Date Filter (Optional)</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-900 p-2 text-sm font-bold"
                    />
                </div>

                <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Status Filter</label>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-900 p-2 text-sm font-bold"
                    >
                        <option value="all">All Fixtures</option>
                        <option value="pending">Scheduled / Unplayed Only</option>
                        <option value="completed">Completed / Awarded</option>
                        <option value="disrupted">Disrupted (Walkovers / Postponed / Cancelled)</option>
                    </select>
                </div>
            </div>

            {/* Scoreboard List */}
            {isLoading ? (
                <div className="p-12 text-center text-slate-500 font-bold bg-white border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    Loading fixtures...
                </div>
            ) : filteredGames.length === 0 ? (
                <div className="p-12 text-center text-slate-500 font-bold bg-white border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    No matching fixtures found for the selected criteria.
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredGames.map(game => {
                        const edit = editedScores[game.id] || {
                            home_score: game.home_score,
                            away_score: game.away_score,
                            status: game.status,
                            notes: game.notes || "",
                            isDirty: false
                        };

                        return (
                            <div
                                key={game.id}
                                className={`bg-white border-2 border-slate-900 p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${
                                    edit.isDirty ? "ring-2 ring-amber-400 bg-amber-50/20" : ""
                                }`}
                            >
                                {/* Top metadata row */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200 text-xs font-sans">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-300 uppercase">
                                            {game.phase?.name || "League"}
                                        </span>
                                        <span className="text-slate-500 font-bold">
                                            {game.date ? new Date(game.date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) : "Date TBD"}
                                            {game.time && ` • ${game.time}`}
                                        </span>
                                        {game.venue?.name && (
                                            <span className="text-slate-400 italic">
                                                @ {game.venue.name}
                                            </span>
                                        )}
                                    </div>

                                    {/* Status Badge Selector */}
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={edit.status}
                                            onChange={e => handleStatusChange(game.id, e.target.value)}
                                            className="text-[10px] font-black uppercase px-2 py-1 bg-white border-2 border-slate-900"
                                        >
                                            <option value="scheduled">Scheduled</option>
                                            <option value="completed">Completed</option>
                                            <option value="awarded">Awarded (Walkover)</option>
                                            <option value="postponed">Postponed</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                        {edit.isDirty && (
                                            <span className="bg-amber-400 text-slate-900 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                                                Unsaved
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Main Match Row */}
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                    {/* Away Team */}
                                    <div className="md:col-span-5 flex items-center justify-end gap-3 text-right">
                                        <span className="font-black text-base truncate">{game.away_team?.name}</span>
                                        {game.away_team?.logo_url ? (
                                            <img src={game.away_team.logo_url} alt="" className="w-8 h-8 object-contain shrink-0 rounded bg-slate-50 p-0.5 border" />
                                        ) : (
                                            <div className="w-8 h-8 bg-slate-100 rounded shrink-0 flex items-center justify-center text-[8px] font-black text-slate-400 border">LOGO</div>
                                        )}
                                    </div>

                                    {/* Score Inputs */}
                                    <div className="md:col-span-2 flex items-center justify-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            value={edit.away_score ?? ""}
                                            onChange={e => handleScoreChange(game.id, "away_score", e.target.value)}
                                            placeholder="-"
                                            className="w-14 h-11 text-center font-black text-xl bg-slate-50 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:bg-white"
                                        />
                                        <span className="font-serif italic text-slate-400 font-bold text-sm">at</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={edit.home_score ?? ""}
                                            onChange={e => handleScoreChange(game.id, "home_score", e.target.value)}
                                            placeholder="-"
                                            className="w-14 h-11 text-center font-black text-xl bg-slate-50 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:bg-white"
                                        />
                                    </div>

                                    {/* Home Team */}
                                    <div className="md:col-span-5 flex items-center gap-3 text-left">
                                        {game.home_team?.logo_url ? (
                                            <img src={game.home_team.logo_url} alt="" className="w-8 h-8 object-contain shrink-0 rounded bg-slate-50 p-0.5 border" />
                                        ) : (
                                            <div className="w-8 h-8 bg-slate-100 rounded shrink-0 flex items-center justify-center text-[8px] font-black text-slate-400 border">LOGO</div>
                                        )}
                                        <span className="font-black text-base truncate">{game.home_team?.name}</span>
                                    </div>
                                </div>

                                {/* Quick Action Buttons & Notes */}
                                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleAwardWalkover(game.id, "home")}
                                            className="bg-purple-100 hover:bg-purple-200 text-purple-900 text-[10px] font-black uppercase px-2 py-1 rounded border border-purple-300 transition-colors"
                                        >
                                            Award Home (1-0)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAwardWalkover(game.id, "away")}
                                            className="bg-purple-100 hover:bg-purple-200 text-purple-900 text-[10px] font-black uppercase px-2 py-1 rounded border border-purple-300 transition-colors"
                                        >
                                            Award Away (0-1)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handlePostpone(game.id)}
                                            className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-black uppercase px-2 py-1 rounded border border-amber-300 transition-colors"
                                        >
                                            Postpone
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleCancel(game.id)}
                                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase px-2 py-1 rounded border border-slate-300 transition-colors"
                                        >
                                            Cancel / Void
                                        </button>
                                    </div>

                                    {/* Notes input */}
                                    <div className="flex-1 min-w-[240px]">
                                        <input
                                            type="text"
                                            value={edit.notes}
                                            onChange={e => handleNotesChange(game.id, e.target.value)}
                                            placeholder="Notes (e.g. Walkover details, weather postponement, source...)"
                                            className="w-full text-xs font-sans p-1.5 bg-slate-50 border border-slate-300 rounded"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </ArchiveLayout>
    );
}
