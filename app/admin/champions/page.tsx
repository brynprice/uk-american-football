"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import ArchiveLayout from "@/components/archive/ArchiveLayout";
import { setDivisionalChampion } from "./actions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function DivisionalChampionsAdminPage() {
    const [seasons, setSeasons] = useState<any[]>([]);
    const [phases, setPhases] = useState<any[]>([]);
    const [allTeams, setAllTeams] = useState<any[]>([]);
    const [participations, setParticipations] = useState<any[]>([]);

    const [selectedSeason, setSelectedSeason] = useState("");
    const [selectedPhase, setSelectedPhase] = useState("");
    const [addTeamId, setAddTeamId] = useState("");

    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingPhaseData, setIsLoadingPhaseData] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                // Seasons
                const { data: sData } = await supabase
                    .from("seasons")
                    .select("*, competition:competitions(name)")
                    .order("year", { ascending: false });
                if (sData) setSeasons(sData);

                // All Teams for dropdown
                const { data: tData } = await supabase
                    .from("teams")
                    .select("id, name, logo_url")
                    .order("name");
                if (tData) setAllTeams(tData);

            } catch (err: any) {
                setMessage({ text: err.message, type: "error" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    // Fetch phases when season changes
    useEffect(() => {
        if (!selectedSeason) {
            setPhases([]);
            setSelectedPhase("");
            return;
        }
        const fetchPhases = async () => {
            const { data: pData } = await supabase
                .from("phases")
                .select("*")
                .eq("season_id", selectedSeason)
                .order("ordinal", { ascending: true });

            if (pData) {
                // Filter out playoff phases unless explicitly divisional
                const divPhases = pData.filter(p => {
                    const type = p.type?.toLowerCase() || "";
                    const name = p.name?.toLowerCase() || "";
                    return type !== "playoffs" && !name.includes("playoff");
                });
                setPhases(divPhases.length > 0 ? divPhases : pData);
            }
        };
        fetchPhases();
    }, [selectedSeason]);

    // Fetch phase participations when phase changes
    useEffect(() => {
        if (!selectedPhase) {
            setParticipations([]);
            return;
        }
        fetchPhaseParticipations();
    }, [selectedPhase]);

    const fetchPhaseParticipations = async () => {
        setIsLoadingPhaseData(true);
        try {
            const { data } = await supabase
                .from("participations")
                .select("*, team:teams(*)")
                .eq("phase_id", selectedPhase);

            if (data) {
                // Sort by wins desc, then team name
                const sorted = data.sort((a, b) => {
                    if (a.is_champion && !b.is_champion) return -1;
                    if (!a.is_champion && b.is_champion) return 1;
                    const wA = a.wins || 0;
                    const wB = b.wins || 0;
                    if (wB !== wA) return wB - wA;
                    return (a.team?.name || "").localeCompare(b.team?.name || "");
                });
                setParticipations(sorted);
            }
        } catch (err: any) {
            setMessage({ text: err.message, type: "error" });
        } finally {
            setIsLoadingPhaseData(false);
        }
    };

    const handleToggleChampion = async (teamId: string, currentChampionState: boolean) => {
        if (!selectedPhase) return;
        setIsSubmitting(true);
        setMessage({ text: "", type: "" });
        try {
            const nextState = !currentChampionState;
            await setDivisionalChampion(selectedPhase, teamId, nextState);
            setMessage({
                text: nextState ? "Divisional Champion set successfully!" : "Divisional Champion removed.",
                type: "success"
            });
            await fetchPhaseParticipations();
        } catch (err: any) {
            setMessage({ text: err.message, type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddTeamAsChampion = async () => {
        if (!selectedPhase || !addTeamId) return;
        setIsSubmitting(true);
        setMessage({ text: "", type: "" });
        try {
            await setDivisionalChampion(selectedPhase, addTeamId, true);
            setMessage({ text: "Team added and set as Divisional Champion!", type: "success" });
            setAddTeamId("");
            await fetchPhaseParticipations();
        } catch (err: any) {
            setMessage({ text: err.message, type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <div className="p-8 font-sans">Loading data...</div>;

    return (
        <ArchiveLayout>
            <div className="mb-12">
                <h1 className="text-4xl font-black mb-2 uppercase italic tracking-tighter">Divisional Champions Manager</h1>
                <p className="text-slate-500 font-sans">Designate divisional champions for season phases (max 1 champion per phase).</p>
            </div>

            {message.text && (
                <div className={`p-4 mb-8 rounded font-bold border-l-4 ${message.type === "error" ? "bg-red-50 text-red-800 border-red-600" : "bg-green-50 text-green-800 border-green-600"}`}>
                    {message.text}
                </div>
            )}

            {/* Selectors */}
            <div className="bg-white p-6 shadow-sm border border-slate-200 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Season</label>
                    <select
                        value={selectedSeason}
                        onChange={(e) => setSelectedSeason(e.target.value)}
                        className="w-full border border-slate-300 rounded p-2 text-sm text-black"
                    >
                        <option value="">Select Season</option>
                        {seasons.map(s => (
                            <option key={s.id} value={s.id}>{s.year} - {s.competition?.name || s.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Division / Phase</label>
                    <select
                        value={selectedPhase}
                        onChange={(e) => setSelectedPhase(e.target.value)}
                        disabled={!selectedSeason || phases.length === 0}
                        className="w-full border border-slate-300 rounded p-2 text-sm text-black disabled:bg-slate-50"
                    >
                        <option value="">Select Division / Phase</option>
                        {phases.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Phase Participants List */}
            {selectedPhase && !isLoadingPhaseData && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-300 pb-2">
                        <h2 className="text-lg font-black uppercase italic font-sans text-slate-900">
                            Division Participants ({participations.length})
                        </h2>
                        <span className="text-xs text-slate-500 font-sans">
                            Only 1 team per division can be designated as champion.
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {participations.map((part) => {
                            const isChamp = !!part.is_champion;
                            const team = part.team;
                            return (
                                <div
                                    key={part.id}
                                    className={`p-4 border rounded-lg flex items-center justify-between gap-4 transition-all ${
                                        isChamp
                                            ? "bg-amber-50 border-amber-400 shadow-md ring-2 ring-amber-300"
                                            : "bg-white border-slate-200 shadow-sm"
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        {team?.logo_url ? (
                                            <img src={team.logo_url} alt="" className="w-10 h-10 object-contain rounded bg-white p-1 border border-slate-200" />
                                        ) : (
                                            <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-xs font-bold text-slate-400">
                                                LOGO
                                            </div>
                                        )}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-slate-900">{team?.name || "Unknown Team"}</h3>
                                                {isChamp && (
                                                    <span className="bg-amber-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-xs tracking-wider">
                                                        🥇 Division Champion
                                                    </span>
                                                )}
                                            </div>
                                            {(part.wins !== null && part.losses !== null) && (
                                                <p className="text-xs text-slate-500 font-mono">
                                                    Record: {part.wins}-{part.losses}{part.ties ? `-${part.ties}` : ''}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleToggleChampion(team.id, isChamp)}
                                        disabled={isSubmitting}
                                        className={`px-4 py-2 rounded text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 ${
                                            isChamp
                                                ? "bg-slate-800 text-white hover:bg-slate-900"
                                                : "bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
                                        }`}
                                    >
                                        {isChamp ? "Unmark Champion" : "Set as Champion"}
                                    </button>
                                </div>
                            );
                        })}

                        {participations.length === 0 && (
                            <p className="text-slate-400 italic text-sm py-4">No team participations recorded for this phase yet.</p>
                        )}
                    </div>

                    {/* Quick Add Team section */}
                    <div className="bg-slate-50 p-6 border border-slate-200 rounded-lg mt-8">
                        <h3 className="text-sm font-black uppercase text-slate-800 mb-2 font-sans">
                            Add a Team as Divisional Champion
                        </h3>
                        <p className="text-xs text-slate-500 mb-4 font-sans">
                            If the champion team is not in the list above, select them here to add them to this division as champion.
                        </p>
                        <div className="flex gap-4 max-w-xl">
                            <select
                                value={addTeamId}
                                onChange={(e) => setAddTeamId(e.target.value)}
                                className="flex-1 border border-slate-300 rounded p-2 text-sm text-black"
                            >
                                <option value="">Select Team to Add</option>
                                {allTeams.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleAddTeamAsChampion}
                                disabled={isSubmitting || !addTeamId}
                                className="bg-blue-900 hover:bg-blue-800 text-white font-black uppercase text-xs tracking-wider px-4 py-2 rounded disabled:opacity-50 transition-colors"
                            >
                                Add as Champion
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ArchiveLayout>
    );
}
