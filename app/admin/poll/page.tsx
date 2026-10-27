"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import Link from "next/link";
import ArchiveLayout from "@/components/archive/ArchiveLayout";
import {
    fetchPollBuilderData,
    savePollBallotAction,
    deletePollBallotAction,
    PollDivisionGroup,
    PollTeamItem,
    SavedPollBallot,
} from "./actions";

const TOTAL_SLOTS = 25;

export default function UniballPollBuilderPage() {
    const [seasons, setSeasons] = useState<any[]>([]);
    const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
    const [seasonYear, setSeasonYear] = useState<number>(new Date().getFullYear());
    const [divisions, setDivisions] = useState<PollDivisionGroup[]>([]);
    const [savedBallots, setSavedBallots] = useState<SavedPollBallot[]>([]);
    const [allBallots, setAllBallots] = useState<SavedPollBallot[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string>("");

    // Right panel tab: "my_ballot" | "consensus"
    const [rightPanelTab, setRightPanelTab] = useState<"my_ballot" | "consensus">("my_ballot");
    const [consensusWeekFilter, setConsensusWeekFilter] = useState<string>("latest_per_voter");

    // Top 25 slots: array of 25 teamIds (or null if empty)
    const [slots, setSlots] = useState<(string | null)[]>(() => Array(TOTAL_SLOTS).fill(null));

    // UI Filters & State
    const [tierFilter, setTierFilter] = useState<number | "all">("all");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [hideRankedTeams, setHideRankedTeams] = useState<boolean>(false);
    const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
    const [ballotLabel, setBallotLabel] = useState<string>("Week 1");
    const [shiftOnRemove, setShiftOnRemove] = useState<boolean>(false);

    // Drag and Drop state
    const [draggedSlotIndex, setDraggedSlotIndex] = useState<number | null>(null);
    const [draggedTeamId, setDraggedTeamId] = useState<string | null>(null);
    const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isPending, startTransition] = useTransition();
    const [toast, setToast] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

    const showToast = (text: string, type: "success" | "error" | "info" = "info") => {
        setToast({ text, type });
        setTimeout(() => {
            setToast((prev) => (prev?.text === text ? null : prev));
        }, 3500);
    };

    // Load season data
    useEffect(() => {
        loadSeason(selectedSeasonId || undefined);
    }, [selectedSeasonId]);

    async function loadSeason(seasonIdParam?: string) {
        setIsLoading(true);
        try {
            const data = await fetchPollBuilderData(seasonIdParam);
            setSeasons(data.seasons);
            setDivisions(data.divisions);
            setSavedBallots(data.savedBallots);
            setAllBallots(data.allBallots || []);
            setCurrentUserId(data.currentUserId || "");
            setSeasonYear(data.activeSeasonYear);

            if (!seasonIdParam && data.activeSeasonId) {
                setSelectedSeasonId(data.activeSeasonId);
            }

            const activeId = seasonIdParam || data.activeSeasonId;
            if (activeId) {
                // Restore from localStorage draft first, or latest saved ballot
                const localKey = `britball_poll_draft_${activeId}_${data.currentUserId || "anon"}`;
                const savedLocal = typeof window !== "undefined" ? localStorage.getItem(localKey) : null;
                if (savedLocal) {
                    try {
                        const parsed = JSON.parse(savedLocal);
                        if (Array.isArray(parsed) && parsed.length === TOTAL_SLOTS) {
                            setSlots(parsed);
                            setIsLoading(false);
                            return;
                        }
                    } catch {
                        // ignore
                    }
                }

                if (data.savedBallots.length > 0) {
                    const latest = data.savedBallots[0];
                    setSlots(
                        Array.from({ length: TOTAL_SLOTS }, (_, i) => latest.slots[i] || null)
                    );
                    setBallotLabel(latest.label);
                } else {
                    setSlots(Array(TOTAL_SLOTS).fill(null));
                }
            }
        } catch (err: any) {
            showToast(err.message || "Failed to load poll builder data", "error");
        } finally {
            setIsLoading(false);
        }
    }

    // Persist draft to localStorage whenever slots change
    useEffect(() => {
        if (!selectedSeasonId || isLoading) return;
        try {
            localStorage.setItem(
                `britball_poll_draft_${selectedSeasonId}_${currentUserId || "anon"}`,
                JSON.stringify(slots)
            );
        } catch {
            // ignore storage errors
        }
    }, [slots, selectedSeasonId, currentUserId, isLoading]);

    // Map teamId -> PollTeamItem for fast lookup
    const teamsMap = useMemo(() => {
        const map = new Map<string, PollTeamItem>();
        for (const div of divisions) {
            for (const t of div.teams) {
                map.set(t.teamId, t);
            }
        }
        return map;
    }, [divisions]);

    // Map teamId -> 1-based rank (1..25)
    const teamRankMap = useMemo(() => {
        const map = new Map<string, number>();
        slots.forEach((teamId, idx) => {
            if (teamId) {
                map.set(teamId, idx + 1);
            }
        });
        return map;
    }, [slots]);

    // Highest available slot index (0-based), or -1 if full
    const highestAvailableIndex = useMemo(() => {
        return slots.findIndex((s) => s === null);
    }, [slots]);

    const filledCount = useMemo(() => {
        return slots.filter((s) => s !== null).length;
    }, [slots]);

    const hasGaps = useMemo(() => {
        let seenNull = false;
        for (const s of slots) {
            if (s === null) seenNull = true;
            else if (seenNull && s !== null) return true;
        }
        return false;
    }, [slots]);

    // Click on a team in the division list
    const handleTeamClick = (teamId: string) => {
        const existingRank = teamRankMap.get(teamId);
        if (existingRank !== undefined) {
            // Team is already in the Top 25 -> remove it from its slot
            handleRemoveSlot(existingRank - 1);
            const team = teamsMap.get(teamId);
            showToast(`Removed ${team?.name || "team"} from #${existingRank}`, "info");
            return;
        }

        // Insert into the highest available spot
        const targetIdx = slots.findIndex((s) => s === null);
        if (targetIdx === -1) {
            showToast("All 25 spots are filled! Remove a team first or drag onto a rank to replace.", "error");
            return;
        }

        setSlots((prev) => {
            const next = [...prev];
            next[targetIdx] = teamId;
            return next;
        });

        const team = teamsMap.get(teamId);
        showToast(`Assigned ${team?.name || "team"} to #${targetIdx + 1}`, "success");
    };

    // Remove a team from slot `index`
    const handleRemoveSlot = (index: number) => {
        setSlots((prev) => {
            const next = [...prev];
            if (shiftOnRemove) {
                next.splice(index, 1);
                next.push(null);
            } else {
                next[index] = null;
            }
            return next;
        });
    };

    // Compact / close any empty gaps by shifting ranked teams up
    const handleCompactSlots = () => {
        setSlots((prev) => {
            const nonNull = prev.filter((s): s is string => s !== null);
            return Array.from({ length: TOTAL_SLOTS }, (_, i) => nonNull[i] || null);
        });
        showToast("Shifted teams up to close empty slots", "info");
    };

    // Move a slot 1 step up or down
    const handleMoveSlot = (index: number, direction: "up" | "down") => {
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= TOTAL_SLOTS) return;

        setSlots((prev) => {
            const next = [...prev];
            const temp = next[index];
            next[index] = next[targetIndex];
            next[targetIndex] = temp;
            return next;
        });
    };

    // Drag & Drop handlers
    const handleSlotDragStart = (e: React.DragEvent, index: number) => {
        const teamId = slots[index];
        if (!teamId) {
            e.preventDefault();
            return;
        }
        setDraggedSlotIndex(index);
        setDraggedTeamId(teamId);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", JSON.stringify({ source: "slot", index, teamId }));
    };

    const handleDivisionTeamDragStart = (e: React.DragEvent, teamId: string) => {
        setDraggedTeamId(teamId);
        const existingIdx = slots.indexOf(teamId);
        setDraggedSlotIndex(existingIdx !== -1 ? existingIdx : null);
        e.dataTransfer.effectAllowed = "copyMove";
        e.dataTransfer.setData("text/plain", JSON.stringify({ source: "division", teamId }));
    };

    const handleSlotDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (dragOverSlotIndex !== index) {
            setDragOverSlotIndex(index);
        }
    };

    const handleSlotDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        setDragOverSlotIndex(null);

        let fromSlotIdx = draggedSlotIndex;
        let teamId = draggedTeamId;

        try {
            const raw = e.dataTransfer.getData("text/plain");
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.teamId) teamId = parsed.teamId;
                if (typeof parsed.index === "number") fromSlotIdx = parsed.index;
            }
        } catch {
            // fallback to state
        }

        setDraggedSlotIndex(null);
        setDraggedTeamId(null);

        if (!teamId) return;

        setSlots((prev) => {
            const currentIdx = fromSlotIdx !== null ? fromSlotIdx : prev.indexOf(teamId!);

            // Case 1: Reordering a team that is already in the Top 25
            if (currentIdx !== -1) {
                if (currentIdx === targetIndex) return prev;
                const next = [...prev];

                // If dropping onto an empty slot, move directly into that slot
                if (next[targetIndex] === null) {
                    next[targetIndex] = teamId!;
                    next[currentIdx] = null;
                    return next;
                }

                // Otherwise, standard insert & shift reorder!
                const [moved] = next.splice(currentIdx, 1);
                next.splice(targetIndex, 0, moved);
                return next.slice(0, TOTAL_SLOTS);
            }

            // Case 2: Dragging a new team from the division list onto a specific rank slot
            const next = [...prev];
            if (next[targetIndex] === null) {
                next[targetIndex] = teamId!;
                return next;
            } else {
                // Insert at targetIndex and shift subsequent items down (removing the first null after targetIndex if any)
                const nullAfterIdx = next.findIndex((s, i) => i > targetIndex && s === null);
                if (nullAfterIdx !== -1) {
                    next.splice(nullAfterIdx, 1);
                    next.splice(targetIndex, 0, teamId!);
                    return next;
                }
                const nullBeforeIdx = next.findIndex((s) => s === null);
                if (nullBeforeIdx !== -1) {
                    next[nullBeforeIdx] = teamId!;
                    return next;
                }
                // All 25 slots full -> insert at targetIndex and drop #25
                next.splice(targetIndex, 0, teamId!);
                return next.slice(0, TOTAL_SLOTS);
            }
        });
    };

    const handleDragEnd = () => {
        setDraggedSlotIndex(null);
        setDraggedTeamId(null);
        setDragOverSlotIndex(null);
    };

    // Group divisions by Tier for clean display
    const tierGroups = useMemo(() => {
        const groups = new Map<number, { tierNumber: number; tierTitle: string; divisions: PollDivisionGroup[] }>();

        for (const div of divisions) {
            if (tierFilter !== "all" && div.tierNumber !== tierFilter) continue;

            const filteredTeams = div.teams.filter((t) => {
                if (hideRankedTeams && teamRankMap.has(t.teamId)) return false;
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    return (
                        t.name.toLowerCase().includes(q) ||
                        t.phaseName.toLowerCase().includes(q)
                    );
                }
                return true;
            });

            if (searchQuery.trim() && filteredTeams.length === 0) continue;

            if (!groups.has(div.tierNumber)) {
                groups.set(div.tierNumber, {
                    tierNumber: div.tierNumber,
                    tierTitle: div.tierTitle,
                    divisions: [],
                });
            }
            groups.get(div.tierNumber)!.divisions.push({
                ...div,
                teams: filteredTeams,
            });
        }

        return Array.from(groups.values()).sort((a, b) => a.tierNumber - b.tierNumber);
    }, [divisions, tierFilter, searchQuery, hideRankedTeams, teamRankMap]);

    // Copy to Clipboard
    const handleCopyBallot = async (includeDetails: boolean) => {
        const lines: string[] = [];
        slots.forEach((teamId, idx) => {
            const rank = idx + 1;
            if (!teamId) {
                lines.push(`${rank}. —`);
                return;
            }
            const t = teamsMap.get(teamId);
            if (!t) {
                lines.push(`${rank}. Unknown`);
                return;
            }
            if (includeDetails) {
                const recordStr = t.ties > 0 ? `${t.wins}-${t.losses}-${t.ties}` : `${t.wins}-${t.losses}`;
                const diffStr = t.diff > 0 ? `+${t.diff}` : `${t.diff}`;
                lines.push(`${rank}. ${t.name} (${recordStr}, ${diffStr}) — ${t.phaseName}`);
            } else {
                lines.push(`${rank}. ${t.name}`);
            }
        });

        try {
            await navigator.clipboard.writeText(lines.join("\n"));
            showToast(
                includeDetails
                    ? "Copied Top 25 with records & divisions to clipboard!"
                    : "Copied Top 25 list to clipboard!",
                "success"
            );
        } catch {
            showToast("Failed to copy to clipboard", "error");
        }
    };

    // Save Ballot to Database
    const handleSaveBallot = () => {
        if (!selectedSeasonId) return;
        startTransition(async () => {
            const res = await savePollBallotAction(selectedSeasonId, ballotLabel, slots);
            if (res.success) {
                showToast(`Saved "${ballotLabel}" ballot to database!`, "success");
                const refreshed = await fetchPollBuilderData(selectedSeasonId);
                setSavedBallots(refreshed.savedBallots);
                setAllBallots(refreshed.allBallots || []);
            } else {
                showToast(res.error || "Failed to save ballot", "error");
            }
        });
    };

    const handleLoadSavedBallot = (ballot: SavedPollBallot) => {
        setSlots(Array.from({ length: TOTAL_SLOTS }, (_, i) => ballot.slots[i] || null));
        setBallotLabel(ballot.label);
        showToast(`Loaded "${ballot.label}" ballot`, "info");
    };

    const handleDeleteSavedBallot = (ballot: SavedPollBallot) => {
        if (!confirm(`Delete saved ballot "${ballot.label}"?`)) return;
        startTransition(async () => {
            const res = await deletePollBallotAction(ballot.id);
            if (res.success) {
                setSavedBallots((prev) => prev.filter((b) => b.id !== ballot.id));
                setAllBallots((prev) => prev.filter((b) => b.id !== ballot.id));
                showToast(`Deleted "${ballot.label}"`, "info");
            } else {
                showToast(res.error || "Failed to delete ballot", "error");
            }
        });
    };

    // Unique ballot labels across all writers for consensus filtering
    const availableBallotLabels = useMemo(() => {
        const set = new Set<string>();
        for (const b of allBallots) {
            if (b.label) set.add(b.label);
        }
        return Array.from(set);
    }, [allBallots]);

    // Compute Consensus Poll (25 pts for #1, 24 pts for #2, ..., 1 pt for #25)
    const consensusData = useMemo(() => {
        // Select which ballots are included
        let activeBallots: SavedPollBallot[] = [];
        if (consensusWeekFilter === "latest_per_voter") {
            const seenVoters = new Set<string>();
            for (const b of allBallots) {
                const voterKey = b.userId || b.id;
                if (!seenVoters.has(voterKey)) {
                    seenVoters.add(voterKey);
                    activeBallots.push(b);
                }
            }
        } else {
            const seenVoters = new Set<string>();
            for (const b of allBallots) {
                if (b.label.toLowerCase() === consensusWeekFilter.toLowerCase()) {
                    const voterKey = b.userId || b.id;
                    if (!seenVoters.has(voterKey)) {
                        seenVoters.add(voterKey);
                        activeBallots.push(b);
                    }
                }
            }
        }

        const tally = new Map<
            string,
            {
                teamId: string;
                points: number;
                firstPlaceVotes: number;
                appearances: number;
                highestRank: number;
                lowestRank: number;
            }
        >();

        for (const ballot of activeBallots) {
            ballot.slots.forEach((teamId, idx) => {
                if (!teamId) return;
                const rank = idx + 1;
                const pts = TOTAL_SLOTS - idx; // 25 down to 1
                if (pts <= 0) return;

                const curr = tally.get(teamId) || {
                    teamId,
                    points: 0,
                    firstPlaceVotes: 0,
                    appearances: 0,
                    highestRank: 25,
                    lowestRank: 1,
                };
                curr.points += pts;
                if (rank === 1) curr.firstPlaceVotes += 1;
                curr.appearances += 1;
                if (rank < curr.highestRank) curr.highestRank = rank;
                if (rank > curr.lowestRank) curr.lowestRank = rank;
                tally.set(teamId, curr);
            });
        }

        const ranked = Array.from(tally.values()).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.firstPlaceVotes !== a.firstPlaceVotes)
                return b.firstPlaceVotes - a.firstPlaceVotes;
            if (b.appearances !== a.appearances) return b.appearances - a.appearances;
            return a.highestRank - b.highestRank;
        });

        return {
            voterCount: activeBallots.length,
            voters: activeBallots.map((b) => ({
                id: b.id,
                voterName: b.voterName || "Writer",
                label: b.label,
            })),
            rankings: ranked,
        };
    }, [allBallots, consensusWeekFilter]);

    const handleCopyConsensus = async () => {
        const lines: string[] = [];
        consensusData.rankings.slice(0, 25).forEach((item, idx) => {
            const rank = idx + 1;
            const team = teamsMap.get(item.teamId);
            const name = team?.name || "Unknown Team";
            const fpStr = item.firstPlaceVotes > 0 ? ` (${item.firstPlaceVotes})` : "";
            lines.push(`${rank}. ${name}${fpStr} — ${item.points} pts`);
        });

        try {
            await navigator.clipboard.writeText(lines.join("\n"));
            showToast("Copied Consensus Top 25 to clipboard!", "success");
        } catch {
            showToast("Failed to copy consensus poll", "error");
        }
    };

    const handleClearBallot = () => {
        if (filledCount === 0) return;
        if (!confirm("Clear all 25 slots in your current ballot?")) return;
        setSlots(Array(TOTAL_SLOTS).fill(null));
        showToast("Cleared Top 25 ballot", "info");
    };

    const getTierHeaderStyle = (tierNumber: number) => {
        switch (tierNumber) {
            case 1:
                return "bg-amber-400 text-slate-950 border-slate-900";
            case 2:
                return "bg-blue-600 text-white border-slate-900";
            case 3:
                return "bg-teal-700 text-white border-slate-900";
            default:
                return "bg-slate-800 text-white border-slate-900";
        }
    };

    return (
        <ArchiveLayout>
            <div className="max-w-7xl mx-auto">
                {/* Top Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
                    <div>
                        <Link
                            href="/admin"
                            className="text-blue-600 hover:underline text-xs font-sans font-bold uppercase tracking-widest mb-2 inline-block"
                        >
                            &larr; Back to Admin Dashboard
                        </Link>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter">
                                Uniball Writer&apos;s Poll Builder
                            </h1>
                            <span className="bg-amber-400 text-slate-950 text-xs font-black uppercase px-2.5 py-1 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                Top 25
                            </span>
                        </div>
                        <p className="text-slate-600 font-sans text-sm mt-1">
                            Click any team to assign it to the highest available rank, then drag and drop to fine-tune your Top 25.
                        </p>
                    </div>

                    {/* Season Selector */}
                    <div className="w-full md:w-72">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 font-sans">
                            Season
                        </label>
                        <select
                            value={selectedSeasonId}
                            onChange={(e) => setSelectedSeasonId(e.target.value)}
                            className="w-full bg-white border-2 border-slate-900 px-3 py-2 text-sm font-sans font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none"
                        >
                            {seasons.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.year} — {s.competitionName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Toast Notification */}
                {toast && (
                    <div
                        className={`fixed bottom-6 right-6 z-50 px-5 py-3 border-2 border-slate-900 font-sans font-bold text-sm shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all ${
                            toast.type === "success"
                                ? "bg-emerald-400 text-slate-950"
                                : toast.type === "error"
                                ? "bg-rose-500 text-white"
                                : "bg-slate-900 text-white"
                        }`}
                    >
                        {toast.text}
                    </div>
                )}

                {isLoading ? (
                    <div className="p-16 bg-white border-2 border-slate-900 text-center font-sans font-bold text-slate-400 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        Loading divisions, standings, and team records...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* LEFT COLUMN: Tiered Divisions & Teams (7 cols) */}
                        <div className="lg:col-span-7 space-y-6">
                            {/* Filter & Search Bar */}
                            <div className="bg-white border-2 border-slate-900 p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-sans space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap gap-1.5">
                                        {[
                                            { id: "all", label: "All Tiers" },
                                            { id: 1, label: "Tier 1: Premier" },
                                            { id: 2, label: "Tier 2: Div 1" },
                                            { id: 3, label: "Tier 3: Div 2" },
                                        ].map((tab) => (
                                            <button
                                                key={String(tab.id)}
                                                type="button"
                                                onClick={() => setTierFilter(tab.id as any)}
                                                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 border-slate-900 transition-all ${
                                                    tierFilter === tab.id
                                                        ? "bg-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(59,130,246,1)]"
                                                        : "bg-slate-50 text-slate-700 hover:bg-slate-200"
                                                }`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={hideRankedTeams}
                                            onChange={(e) => setHideRankedTeams(e.target.checked)}
                                            className="w-4 h-4 accent-slate-900"
                                        />
                                        Hide already-ranked
                                    </label>
                                </div>

                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search team or division (e.g. UWE Bullets, Durham, Scottish)..."
                                        className="w-full border-2 border-slate-300 focus:border-slate-900 px-3 py-2 text-sm font-medium focus:outline-none"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery("")}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 hover:text-slate-900 uppercase"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Tiered Divisions */}
                            {tierGroups.length === 0 ? (
                                <div className="bg-white border-2 border-dashed border-slate-300 p-12 text-center text-slate-400 font-sans italic">
                                    No divisions or teams match your current filter.
                                </div>
                            ) : (
                                tierGroups.map((tierGroup) => (
                                    <div key={tierGroup.tierNumber} className="space-y-4">
                                        {/* Tier Banner Header */}
                                        <div
                                            className={`px-4 py-2.5 border-2 font-sans flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${getTierHeaderStyle(
                                                tierGroup.tierNumber
                                            )}`}
                                        >
                                            <h2 className="text-base md:text-lg font-black uppercase tracking-wider italic">
                                                {tierGroup.tierTitle}
                                            </h2>
                                            <span className="text-xs font-bold uppercase tracking-widest opacity-90">
                                                {tierGroup.divisions.length}{" "}
                                                {tierGroup.divisions.length === 1 ? "Division" : "Divisions"}
                                            </span>
                                        </div>

                                        {/* Divisions Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {tierGroup.divisions.map((div) => {
                                                const rankedInDiv = div.teams.filter((t) =>
                                                    teamRankMap.has(t.teamId)
                                                ).length;

                                                return (
                                                    <div
                                                        key={div.phaseId}
                                                        className="bg-white border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col"
                                                    >
                                                        {/* Division Header */}
                                                        <div className="bg-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between gap-2">
                                                            <div>
                                                                <h3 className="font-sans font-black text-sm uppercase tracking-tight leading-tight">
                                                                    {div.phaseName}
                                                                </h3>
                                                                {div.parentPhaseName &&
                                                                    div.parentPhaseName !== div.phaseName && (
                                                                        <span className="text-[10px] font-sans text-slate-400 uppercase tracking-widest block">
                                                                            {div.parentPhaseName}
                                                                        </span>
                                                                    )}
                                                            </div>
                                                            {rankedInDiv > 0 && (
                                                                <span className="bg-amber-400 text-slate-950 text-[10px] font-sans font-black uppercase px-2 py-0.5 rounded shrink-0">
                                                                    {rankedInDiv} Ranked
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Teams List inside Division */}
                                                        <div className="divide-y divide-slate-100 flex-1">
                                                            {div.teams.map((team) => {
                                                                const currentRank = teamRankMap.get(team.teamId);
                                                                const isRanked = currentRank !== undefined;
                                                                const isExpanded = expandedTeamId === team.teamId;
                                                                const recordStr =
                                                                    team.ties > 0
                                                                        ? `${team.wins}-${team.losses}-${team.ties}`
                                                                        : `${team.wins}-${team.losses}`;
                                                                const diffStr =
                                                                    team.diff > 0
                                                                        ? `+${team.diff}`
                                                                        : `${team.diff}`;

                                                                return (
                                                                    <div
                                                                        key={team.teamId}
                                                                        className={`transition-colors ${
                                                                            isRanked
                                                                                ? "bg-amber-50/80"
                                                                                : "hover:bg-blue-50/60"
                                                                        }`}
                                                                    >
                                                                        <div
                                                                            draggable
                                                                            onDragStart={(e) =>
                                                                                handleDivisionTeamDragStart(
                                                                                    e,
                                                                                    team.teamId
                                                                                )
                                                                            }
                                                                            onDragEnd={handleDragEnd}
                                                                            onClick={() =>
                                                                                handleTeamClick(team.teamId)
                                                                            }
                                                                            className="px-3 py-2.5 flex items-center justify-between gap-2 cursor-pointer group select-none"
                                                                        >
                                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                                {/* Rank or Next Spot Badge */}
                                                                                {isRanked ? (
                                                                                    <span
                                                                                        title="Click to remove from Top 25"
                                                                                        className="w-7 h-7 rounded bg-amber-400 border-2 border-slate-900 text-slate-950 font-sans font-black text-xs flex items-center justify-center shrink-0 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] group-hover:bg-rose-500 group-hover:text-white transition-colors"
                                                                                    >
                                                                                        #{currentRank}
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="w-7 h-7 rounded bg-slate-100 border border-slate-300 text-slate-400 font-sans font-black text-[11px] flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white group-hover:border-slate-900 transition-colors">
                                                                                        {highestAvailableIndex !== -1
                                                                                            ? `+${highestAvailableIndex + 1}`
                                                                                            : "—"}
                                                                                    </span>
                                                                                )}

                                                                                {/* Team Logo */}
                                                                                {team.logoUrl ? (
                                                                                    <div className="w-6 h-6 bg-white border border-slate-200 rounded p-0.5 flex items-center justify-center shrink-0">
                                                                                        <img
                                                                                            src={team.logoUrl}
                                                                                            alt=""
                                                                                            className="max-w-full max-h-full object-contain"
                                                                                        />
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="w-6 h-6 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-[10px] font-sans font-bold text-slate-400 shrink-0">
                                                                                        🏈
                                                                                    </div>
                                                                                )}

                                                                                {/* Team Name */}
                                                                                <span
                                                                                    className={`font-sans text-sm truncate ${
                                                                                        isRanked
                                                                                            ? "font-black text-slate-950"
                                                                                            : "font-bold text-slate-800 group-hover:text-blue-700"
                                                                                    }`}
                                                                                >
                                                                                    {team.name}
                                                                                </span>
                                                                            </div>

                                                                            {/* Right side: Record, Point Diff & Games Toggle */}
                                                                            <div className="flex items-center gap-1.5 shrink-0 font-sans">
                                                                                <span className="text-xs font-mono font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-800">
                                                                                    {recordStr}
                                                                                </span>
                                                                                <span
                                                                                    className={`text-[11px] font-mono font-bold w-9 text-right ${
                                                                                        team.diff > 0
                                                                                            ? "text-emerald-700"
                                                                                            : team.diff < 0
                                                                                            ? "text-rose-600"
                                                                                            : "text-slate-400"
                                                                                    }`}
                                                                                >
                                                                                    {diffStr}
                                                                                </span>

                                                                                {team.gamesPlayed.length > 0 && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            setExpandedTeamId(
                                                                                                isExpanded
                                                                                                    ? null
                                                                                                    : team.teamId
                                                                                            );
                                                                                        }}
                                                                                        title="View season game results"
                                                                                        className={`ml-1 w-6 h-6 rounded text-[11px] font-black flex items-center justify-center border transition-colors ${
                                                                                            isExpanded
                                                                                                ? "bg-slate-900 text-white border-slate-900"
                                                                                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-900 hover:text-slate-900"
                                                                                        }`}
                                                                                    >
                                                                                        {isExpanded ? "▲" : "ⓘ"}
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Expandable Season Game Log */}
                                                                        {isExpanded && team.gamesPlayed.length > 0 && (
                                                                            <div className="px-3 pb-2.5 pt-1 bg-slate-50 border-t border-slate-200/80 text-[11px] font-sans space-y-1">
                                                                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex justify-between">
                                                                                    <span>{seasonYear} Results</span>
                                                                                    <span>
                                                                                        PF: {team.pf} / PA: {team.pa}
                                                                                    </span>
                                                                                </div>
                                                                                {team.gamesPlayed.map((g) => (
                                                                                    <div
                                                                                        key={g.id}
                                                                                        className="flex items-center justify-between text-slate-700"
                                                                                    >
                                                                                        <div className="flex items-center gap-1.5 truncate">
                                                                                            <span
                                                                                                className={`w-4 h-4 rounded text-[10px] font-black flex items-center justify-center text-white shrink-0 ${
                                                                                                    g.outcome === "W"
                                                                                                        ? "bg-emerald-600"
                                                                                                        : g.outcome === "L"
                                                                                                        ? "bg-rose-600"
                                                                                                        : "bg-slate-500"
                                                                                                }`}
                                                                                            >
                                                                                                {g.outcome}
                                                                                            </span>
                                                                                            <span className="text-slate-400 font-mono">
                                                                                                {g.isHome ? "vs" : "@"}
                                                                                            </span>
                                                                                            <span className="font-semibold truncate">
                                                                                                {g.opponentName}
                                                                                            </span>
                                                                                        </div>
                                                                                        <span className="font-mono font-bold shrink-0 ml-2">
                                                                                            {g.teamScore}–{g.opponentScore}
                                                                                        </span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* RIGHT COLUMN: Top 25 Ballot & Consensus Poll (5 cols, sticky) */}
                        <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
                            {/* Tab Switcher: My Ballot vs Consensus Poll */}
                            <div className="grid grid-cols-2 border-2 border-slate-900 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-sans">
                                <button
                                    type="button"
                                    onClick={() => setRightPanelTab("my_ballot")}
                                    className={`py-2.5 px-3 text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
                                        rightPanelTab === "my_ballot"
                                            ? "bg-slate-900 text-amber-400"
                                            : "bg-white text-slate-600 hover:bg-slate-100"
                                    }`}
                                >
                                    <span>My Top 25 Ballot</span>
                                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-400 text-slate-950">
                                        {filledCount}/25
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRightPanelTab("consensus")}
                                    className={`py-2.5 px-3 text-xs font-black uppercase tracking-wider border-l-2 border-slate-900 transition-colors flex items-center justify-center gap-2 ${
                                        rightPanelTab === "consensus"
                                            ? "bg-slate-900 text-amber-400"
                                            : "bg-white text-slate-600 hover:bg-slate-100"
                                    }`}
                                >
                                    <span>Consensus Poll</span>
                                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-600 text-white">
                                        {consensusData.voterCount}{" "}
                                        {consensusData.voterCount === 1 ? "Voter" : "Voters"}
                                    </span>
                                </button>
                            </div>

                            {rightPanelTab === "consensus" ? (
                                <div className="bg-white border-2 border-slate-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] font-sans">
                                    <div className="bg-slate-900 text-white p-4 border-b-2 border-slate-900">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div>
                                                <h2 className="text-xl font-black uppercase italic tracking-tight">
                                                    Writers&apos; Consensus Top 25
                                                </h2>
                                                <p className="text-xs text-slate-300">
                                                    25 pts for #1 down to 1 pt for #25 across{" "}
                                                    <strong className="text-amber-400">
                                                        {consensusData.voterCount}
                                                    </strong>{" "}
                                                    submitted{" "}
                                                    {consensusData.voterCount === 1
                                                        ? "ballot"
                                                        : "ballots"}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleCopyConsensus}
                                                disabled={consensusData.rankings.length === 0}
                                                className="bg-amber-400 text-slate-950 text-[11px] font-black uppercase px-3 py-1.5 hover:bg-white transition-colors disabled:opacity-40 shrink-0"
                                            >
                                                Copy Consensus
                                            </button>
                                        </div>

                                        {/* Week / Label Filter */}
                                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                                Ballot Filter:
                                            </span>
                                            <select
                                                value={consensusWeekFilter}
                                                onChange={(e) =>
                                                    setConsensusWeekFilter(e.target.value)
                                                }
                                                className="bg-slate-800 text-white border border-slate-600 px-2.5 py-1 text-xs font-bold focus:outline-none"
                                            >
                                                <option value="latest_per_voter">
                                                    Latest Ballot per Writer
                                                </option>
                                                {availableBallotLabels.map((lbl) => (
                                                    <option key={lbl} value={lbl}>
                                                        Week / Label: {lbl}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {consensusData.voters.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                                                <span className="font-black uppercase">Voters:</span>
                                                {consensusData.voters.map((v) => (
                                                    <span
                                                        key={v.id}
                                                        className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-bold"
                                                    >
                                                        {v.voterName} ({v.label})
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {consensusData.rankings.length === 0 ? (
                                        <div className="p-10 text-center text-slate-400 text-sm italic">
                                            No saved ballots match this filter yet. Save your ballot in the &ldquo;My Top 25 Ballot&rdquo; tab to populate the Consensus Poll!
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-200 max-h-[72vh] overflow-y-auto">
                                            {consensusData.rankings.slice(0, 25).map((item, idx) => {
                                                const rank = idx + 1;
                                                const team = teamsMap.get(item.teamId);
                                                return (
                                                    <div
                                                        key={item.teamId}
                                                        className="px-3 py-2.5 flex items-center justify-between gap-2 bg-white hover:bg-slate-50"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                            <span
                                                                className={`w-7 h-7 rounded font-black text-xs flex items-center justify-center shrink-0 border ${
                                                                    rank === 1
                                                                        ? "bg-amber-400 text-slate-950 border-slate-900"
                                                                        : rank <= 5
                                                                        ? "bg-slate-900 text-white border-slate-900"
                                                                        : "bg-slate-200 text-slate-900 border-slate-400"
                                                                }`}
                                                            >
                                                                {rank}
                                                            </span>

                                                            {team?.logoUrl && (
                                                                <div className="w-6 h-6 bg-white border border-slate-200 rounded p-0.5 flex items-center justify-center shrink-0">
                                                                    <img
                                                                        src={team.logoUrl}
                                                                        alt=""
                                                                        className="max-w-full max-h-full object-contain"
                                                                    />
                                                                </div>
                                                            )}

                                                            <div className="min-w-0 flex-1">
                                                                <div className="font-bold text-sm text-slate-900 truncate flex items-center gap-1.5">
                                                                    <span className="truncate">
                                                                        {team?.name || "Unknown Team"}
                                                                    </span>
                                                                    {item.firstPlaceVotes > 0 && (
                                                                        <span className="bg-amber-100 text-amber-900 border border-amber-400 text-[10px] font-black px-1.5 py-0.2 rounded shrink-0">
                                                                            {item.firstPlaceVotes} 1st
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 truncate">
                                                                    {team?.phaseName || ""} &bull;{" "}
                                                                    {item.appearances}/
                                                                    {consensusData.voterCount} ballots
                                                                    (Hi: #{item.highestRank}, Lo: #
                                                                    {item.lowestRank})
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="text-right shrink-0">
                                                            <span className="font-mono font-black text-sm text-slate-900">
                                                                {item.points}
                                                            </span>
                                                            <span className="text-[10px] font-bold uppercase text-slate-400 ml-1">
                                                                pts
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ) : (
                            <div className="bg-white border-2 border-slate-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] font-sans">
                                {/* Ballot Header */}
                                <div className="bg-slate-900 text-white p-4 border-b-2 border-slate-900">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <h2 className="text-xl font-black uppercase italic tracking-tight">
                                                My Top 25 Ballot
                                            </h2>
                                            <p className="text-xs text-slate-300">
                                                {highestAvailableIndex !== -1 ? (
                                                    <>
                                                        Next click inserts at{" "}
                                                        <span className="text-amber-400 font-black">
                                                            #{highestAvailableIndex + 1}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-emerald-400 font-bold">
                                                        All 25 spots filled! Drag to reorder.
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-2xl font-black text-amber-400">
                                                {filledCount}
                                            </span>
                                            <span className="text-sm font-bold text-slate-400">
                                                {" "}
                                                / {TOTAL_SLOTS}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full h-2 bg-slate-800 rounded overflow-hidden">
                                        <div
                                            className="h-full bg-amber-400 transition-all duration-200"
                                            style={{ width: `${(filledCount / TOTAL_SLOTS) * 100}%` }}
                                        />
                                    </div>

                                    {/* Action Toolbar */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-800">
                                        <div className="flex flex-wrap gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => handleCopyBallot(false)}
                                                disabled={filledCount === 0}
                                                className="bg-amber-400 text-slate-950 text-[11px] font-black uppercase px-2.5 py-1.5 hover:bg-white transition-colors disabled:opacity-40"
                                            >
                                                Copy List
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyBallot(true)}
                                                disabled={filledCount === 0}
                                                className="bg-slate-800 text-white border border-slate-600 text-[11px] font-black uppercase px-2.5 py-1.5 hover:bg-slate-700 transition-colors disabled:opacity-40"
                                            >
                                                Copy + Records
                                            </button>
                                            {hasGaps && (
                                                <button
                                                    type="button"
                                                    onClick={handleCompactSlots}
                                                    className="bg-blue-600 text-white text-[11px] font-black uppercase px-2.5 py-1.5 hover:bg-blue-500 transition-colors"
                                                >
                                                    Close Gaps &uarr;
                                                </button>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleClearBallot}
                                            disabled={filledCount === 0}
                                            className="text-[11px] font-bold uppercase text-rose-400 hover:text-rose-300 disabled:opacity-30"
                                        >
                                            Clear All
                                        </button>
                                    </div>

                                    {/* Option for remove behavior */}
                                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300">
                                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={shiftOnRemove}
                                                onChange={(e) => setShiftOnRemove(e.target.checked)}
                                                className="w-3.5 h-3.5 accent-amber-400"
                                            />
                                            Shift lower ranks up when removing a team
                                        </label>
                                    </div>
                                </div>

                                {/* Save / Load Ballot Bar */}
                                <div className="p-3 bg-slate-100 border-b border-slate-300 space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={ballotLabel}
                                            onChange={(e) => setBallotLabel(e.target.value)}
                                            placeholder="Ballot label (e.g. Week 1)"
                                            className="flex-1 bg-white border border-slate-300 px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-slate-900"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSaveBallot}
                                            disabled={isPending || filledCount === 0}
                                            className="bg-slate-900 text-white text-xs font-black uppercase px-3 py-1 hover:bg-blue-700 transition-colors disabled:opacity-40"
                                        >
                                            {isPending ? "Saving..." : "Save Ballot"}
                                        </button>
                                    </div>

                                    {savedBallots.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                            <span className="text-[10px] font-black uppercase text-slate-500 mr-1">
                                                Saved:
                                            </span>
                                            {savedBallots.map((b) => (
                                                <div
                                                    key={b.id}
                                                    className="inline-flex items-center bg-white border border-slate-300 rounded overflow-hidden text-[11px]"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLoadSavedBallot(b)}
                                                        className="px-2 py-0.5 font-bold text-slate-800 hover:bg-blue-50 hover:text-blue-700"
                                                    >
                                                        {b.label}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteSavedBallot(b)}
                                                        className="px-1.5 py-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 border-l border-slate-200"
                                                        title="Delete saved ballot"
                                                    >
                                                        &times;
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* 25 Slots List */}
                                <div className="divide-y divide-slate-200 max-h-[72vh] overflow-y-auto">
                                    {slots.map((teamId, index) => {
                                        const rank = index + 1;
                                        const team = teamId ? teamsMap.get(teamId) : null;
                                        const isHighestAvailable = index === highestAvailableIndex;
                                        const isDragOver = dragOverSlotIndex === index;
                                        const isBeingDragged = draggedSlotIndex === index;

                                        return (
                                            <div
                                                key={rank}
                                                draggable={!!team}
                                                onDragStart={(e) => handleSlotDragStart(e, index)}
                                                onDragOver={(e) => handleSlotDragOver(e, index)}
                                                onDragLeave={() => {
                                                    if (dragOverSlotIndex === index) {
                                                        setDragOverSlotIndex(null);
                                                    }
                                                }}
                                                onDrop={(e) => handleSlotDrop(e, index)}
                                                onDragEnd={handleDragEnd}
                                                className={`px-3 py-2 flex items-center justify-between gap-2 transition-all select-none ${
                                                    isDragOver
                                                        ? "bg-blue-100 border-y-2 border-blue-600"
                                                        : isBeingDragged
                                                        ? "opacity-40 bg-slate-100"
                                                        : team
                                                        ? "bg-white hover:bg-slate-50 cursor-grab active:cursor-grabbing"
                                                        : isHighestAvailable
                                                        ? "bg-amber-50/70"
                                                        : "bg-slate-50/50"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    {/* Drag Handle */}
                                                    <span
                                                        className={`text-xs font-mono select-none ${
                                                            team
                                                                ? "text-slate-400 cursor-grab"
                                                                : "text-transparent"
                                                        }`}
                                                        title={team ? "Drag to reorder" : ""}
                                                    >
                                                        ⋮⋮
                                                    </span>

                                                    {/* Rank Number Badge */}
                                                    <span
                                                        className={`w-7 h-7 rounded font-black text-xs flex items-center justify-center shrink-0 border ${
                                                            rank === 1
                                                                ? "bg-amber-400 text-slate-950 border-slate-900 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                                                                : rank <= 5
                                                                ? "bg-slate-900 text-white border-slate-900"
                                                                : team
                                                                ? "bg-slate-200 text-slate-900 border-slate-400"
                                                                : isHighestAvailable
                                                                ? "bg-amber-200 text-amber-950 border-amber-500 border-dashed"
                                                                : "bg-slate-100 text-slate-400 border-slate-200"
                                                        }`}
                                                    >
                                                        {rank}
                                                    </span>

                                                    {/* Slot Content */}
                                                    {team ? (
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            {team.logoUrl && (
                                                                <div className="w-6 h-6 bg-white border border-slate-200 rounded p-0.5 flex items-center justify-center shrink-0">
                                                                    <img
                                                                        src={team.logoUrl}
                                                                        alt=""
                                                                        className="max-w-full max-h-full object-contain"
                                                                    />
                                                                </div>
                                                            )}
                                                            <div className="min-w-0 flex-1">
                                                                <div className="font-bold text-sm text-slate-900 truncate leading-tight">
                                                                    {team.name}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 truncate flex items-center gap-1.5">
                                                                    <span
                                                                        className={`inline-block w-1.5 h-1.5 rounded-full ${
                                                                            team.tierNumber === 1
                                                                                ? "bg-amber-500"
                                                                                : team.tierNumber === 2
                                                                                ? "bg-blue-600"
                                                                                : "bg-teal-600"
                                                                        }`}
                                                                    />
                                                                    <span>{team.phaseName}</span>
                                                                    <span>&bull;</span>
                                                                    <span className="font-mono font-bold text-slate-700">
                                                                        {team.ties > 0
                                                                            ? `${team.wins}-${team.losses}-${team.ties}`
                                                                            : `${team.wins}-${team.losses}`}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs italic text-slate-400 truncate">
                                                            {isHighestAvailable ? (
                                                                <span className="text-amber-800 font-semibold not-italic">
                                                                    &larr; Next clicked team inserts here (#{rank})
                                                                </span>
                                                            ) : (
                                                                "Empty slot"
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Controls for Occupied Slot */}
                                                {team && (
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMoveSlot(index, "up")}
                                                            disabled={index === 0}
                                                            title="Move up 1 spot"
                                                            className="w-6 h-6 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-900 hover:text-white disabled:opacity-25 text-[10px] font-black flex items-center justify-center transition-colors"
                                                        >
                                                            ▲
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMoveSlot(index, "down")}
                                                            disabled={index === TOTAL_SLOTS - 1}
                                                            title="Move down 1 spot"
                                                            className="w-6 h-6 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-900 hover:text-white disabled:opacity-25 text-[10px] font-black flex items-center justify-center transition-colors"
                                                        >
                                                            ▼
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveSlot(index)}
                                                            title="Remove team from slot"
                                                            className="w-6 h-6 rounded border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white text-xs font-black flex items-center justify-center transition-colors ml-0.5"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </ArchiveLayout>
    );
}
