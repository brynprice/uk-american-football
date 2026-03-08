"use client";

import { useState, useEffect, FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { submitGameAction } from "./actions";

// Initialize standard client since this is an admin entry tool
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function AddGamePage() {
    // Core State
    const [seasons, setSeasons] = useState<any[]>([]);
    const [phases, setPhases] = useState<any[]>([]);

    const [selectedSeason, setSelectedSeason] = useState("");
    const [selectedPhase, setSelectedPhase] = useState("");
    const [date, setDate] = useState("");

    const [homeTeam, setHomeTeam] = useState("");
    const [homeScore, setHomeScore] = useState("");
    const [homeCoach, setHomeCoach] = useState("");

    const [awayTeam, setAwayTeam] = useState("");
    const [awayScore, setAwayScore] = useState("");
    const [awayCoach, setAwayCoach] = useState("");

    const [venue, setVenue] = useState("");

    const [status, setStatus] = useState("completed");

    // Metadata
    const [isPlayoff, setIsPlayoff] = useState(false);
    const [playoffRound, setPlayoffRound] = useState("");
    const [finalType, setFinalType] = useState("none"); // none, title, bowl
    const [titleName, setTitleName] = useState("");
    const [isDoubleHeader, setIsDoubleHeader] = useState(false);
    const [notes, setNotes] = useState("");

    // UI State
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });

    // Autocomplete Data
    const [teams, setTeams] = useState<any[]>([]);
    const [venues, setVenues] = useState<any[]>([]);
    const [people, setPeople] = useState<any[]>([]);

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                // Fetch Seasons
                const { data: sData } = await supabase
                    .from("seasons")
                    .select("*, competition:competitions(name)")
                    .order("year", { ascending: false });
                if (sData) setSeasons(sData);

                // Fetch Teams for Autocomplete
                const { data: tData } = await supabase.from("teams").select("id, name").order("name");
                if (tData) setTeams(tData);

                // Fetch Venues for Autocomplete
                const { data: vData } = await supabase.from("venues").select("id, name").order("name");
                if (vData) setVenues(vData);

                // Fetch People for Autocomplete
                const { data: pData } = await supabase.from("people").select("id, display_name").order("display_name");
                if (pData) setPeople(pData);

            } catch (err: any) {
                setMessage({ text: err.message, type: "error" });
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    useEffect(() => {
        if (!selectedSeason) {
            setPhases([]);
            return;
        }
        const fetchPhases = async () => {
            const { data } = await supabase
                .from("phases")
                .select("id, name, type, parent:parent_id(name)")
                .eq("season_id", selectedSeason)
                .order("name");
            if (data) setPhases(data);
        };
        fetchPhases();
    }, [selectedSeason]);

    const findOrCreateTeam = async (name: string): Promise<string | null> => {
        if (!name.trim()) return null;
        const exists = teams.find(t => t.name.toLowerCase() === name.toLowerCase());
        if (exists) return exists.id;

        throw new Error(`Team "${name}" does not exist. Please create teams via the bulk importer first.`);
    };

    const findOrCreateVenue = async (name: string): Promise<string | null> => {
        if (!name.trim()) return null;
        const exists = venues.find(v => v.name.toLowerCase() === name.toLowerCase());
        if (exists) return exists.id;

        // Create new
        const { data, error } = await supabase.from("venues").insert({ name: name.trim() }).select().single();
        if (error) throw error;
        setVenues(prev => [...prev, data]);
        return data.id;
    };

    const findOrCreatePerson = async (name: string): Promise<string | null> => {
        if (!name.trim()) return null;
        const exists = people.find(p => p.display_name.toLowerCase() === name.toLowerCase());
        if (exists) return exists.id;

        // Create new
        const { data, error } = await supabase.from("people").insert({ display_name: name.trim() }).select().single();
        if (error) throw error;
        setPeople(prev => [...prev, data]);
        return data.id;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage({ text: "", type: "" });

        try {
            if (!selectedPhase || !date || !homeTeam || !awayTeam) {
                throw new Error("Phase, Date, Home Team, and Away Team are required.");
            }

            const payload = {
                selectedPhase,
                date,
                homeTeam,
                awayTeam,
                homeScore,
                awayScore,
                homeCoach,
                awayCoach,
                venue,
                status,
                isPlayoff,
                playoffRound,
                finalType,
                titleName,
                isDoubleHeader,
                notes
            };

            const result = await submitGameAction(payload);

            if (!result.success) {
                throw new Error(result.error);
            }

            // Success Reset
            setAwayTeam("");
            setAwayScore("");
            setAwayCoach("");
            setHomeScore("");

            // Keep Season, Phase, Date, Venue, Home Team, Home Coach, Notes
            setIsPlayoff(false);
            setPlayoffRound("");
            setFinalType("none");
            setTitleName("");
            setIsDoubleHeader(false);

            setMessage({ text: "Game added successfully!", type: "success" });

            // Clear success message after 3s
            setTimeout(() => setMessage({ text: "", type: "" }), 3000);

        } catch (err: any) {
            setMessage({ text: err.message, type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <div className="p-8 font-sans">Loading data...</div>;

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 font-sans">
            <h1 className="text-3xl font-black mb-8 uppercase tracking-widest border-b-2 border-slate-900 pb-2">Admin: Add Game</h1>

            {message.text && (
                <div className={`p-4 mb-8 rounded font-bold border-l-4 ${message.type === 'error' ? 'bg-red-50 text-red-800 border-red-600' : 'bg-green-50 text-green-800 border-green-600'}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 shadow-sm border border-slate-200">

                {/* 1. Context */}
                <section>
                    <h2 className="text-lg font-bold mb-4 text-slate-700 bg-slate-50 px-3 py-1 border-l-4 border-blue-500">1. Context</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Season</label>
                            <select
                                required
                                value={selectedSeason}
                                onChange={(e) => setSelectedSeason(e.target.value)}
                                className="w-full border border-slate-300 rounded p-2 text-sm text-black"
                            >
                                <option value="">Select Season</option>
                                {seasons.map(s => (
                                    <option key={s.id} value={s.id}>{s.year} - {s.competition?.name} ({s.name})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phase</label>
                            <select
                                required
                                value={selectedPhase}
                                onChange={(e) => setSelectedPhase(e.target.value)}
                                disabled={!selectedSeason}
                                className="w-full border border-slate-300 rounded p-2 text-sm disabled:bg-slate-100 text-black"
                            >
                                <option value="">Select Phase</option>
                                {phases.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.parent ? `${p.parent.name} - ` : ''}{p.name} ({p.type})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                            <input
                                required
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full border border-slate-300 rounded p-2 text-sm text-black"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full border border-slate-300 rounded p-2 text-sm text-black"
                            >
                                <option value="completed">Completed</option>
                                <option value="awarded">Awarded</option>
                                <option value="cancelled">Cancelled</option>
                                <option value="postponed">Postponed</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* 2. Teams & Scores */}
                <section>
                    <h2 className="text-lg font-bold mb-4 text-slate-700 bg-slate-50 px-3 py-1 border-l-4 border-slate-900">2. Matchup</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* HOME */}
                        <div className="space-y-4 p-4 border border-slate-100 rounded bg-slate-50/50">
                            <h3 className="font-black text-slate-400 uppercase tracking-widest text-sm text-center">Home Team</h3>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Team Name</label>
                                <input
                                    required
                                    type="text"
                                    list="teams-list"
                                    value={homeTeam}
                                    onChange={(e) => setHomeTeam(e.target.value)}
                                    placeholder="Search teams..."
                                    className="w-full border border-slate-300 rounded p-2 text-sm font-bold text-black"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Score</label>
                                <input
                                    type="number"
                                    value={homeScore}
                                    onChange={(e) => setHomeScore(e.target.value)}
                                    className="w-full border border-slate-300 rounded p-2 text-2xl font-black text-center text-black"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Head Coach <span className="font-normal normal-case italic text-slate-400">(optional)</span></label>
                                <input
                                    type="text"
                                    list="people-list"
                                    value={homeCoach}
                                    onChange={(e) => setHomeCoach(e.target.value)}
                                    placeholder="Auto-creates if new"
                                    className="w-full border border-slate-300 rounded p-2 text-sm text-black"
                                />
                            </div>
                        </div>

                        {/* AWAY */}
                        <div className="space-y-4 p-4 border border-slate-100 rounded bg-slate-50/50">
                            <h3 className="font-black text-slate-400 uppercase tracking-widest text-sm text-center">Away Team</h3>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Team Name</label>
                                <input
                                    required
                                    type="text"
                                    list="teams-list"
                                    value={awayTeam}
                                    onChange={(e) => setAwayTeam(e.target.value)}
                                    placeholder="Search teams..."
                                    className="w-full border border-slate-300 rounded p-2 text-sm font-bold text-black"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Score</label>
                                <input
                                    type="number"
                                    value={awayScore}
                                    onChange={(e) => setAwayScore(e.target.value)}
                                    className="w-full border border-slate-300 rounded p-2 text-2xl font-black text-center bg-white text-black"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Head Coach <span className="font-normal normal-case italic text-slate-400">(optional)</span></label>
                                <input
                                    type="text"
                                    list="people-list"
                                    value={awayCoach}
                                    onChange={(e) => setAwayCoach(e.target.value)}
                                    placeholder="Auto-creates if new"
                                    className="w-full border border-slate-300 rounded p-2 text-sm text-black"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. Metadata */}
                <section>
                    <h2 className="text-lg font-bold mb-4 text-slate-700 bg-slate-50 px-3 py-1 border-l-4 border-amber-500">3. Metadata</h2>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Venue <span className="font-normal normal-case italic text-slate-400">(optional)</span></label>
                                <input
                                    type="text"
                                    list="venues-list"
                                    value={venue}
                                    onChange={(e) => setVenue(e.target.value)}
                                    placeholder="Auto-creates if new"
                                    className="w-full border border-slate-300 rounded p-2 text-sm text-black"
                                />
                            </div>

                            <div className="flex flex-col justify-end pb-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isPlayoff}
                                        onChange={(e) => setIsPlayoff(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-bold text-slate-700">Is Playoff Game?</span>
                                </label>
                            </div>

                            {isPlayoff && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Playoff Round Name <span className="font-normal normal-case italic text-slate-400">(e.g. Semi-Final)</span></label>
                                    <input
                                        type="text"
                                        value={playoffRound}
                                        onChange={(e) => setPlayoffRound(e.target.value)}
                                        className="w-full border border-slate-300 rounded p-2 text-sm text-black"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Final Type</label>
                                <select
                                    value={finalType}
                                    onChange={(e) => setFinalType(e.target.value)}
                                    className="w-full border border-slate-300 rounded p-2 text-sm text-black"
                                >
                                    <option value="none">Regular / Standard Game</option>
                                    <option value="title">Title Game 🏆</option>
                                    <option value="bowl">Bowl Game 🏈</option>
                                </select>
                            </div>

                            {finalType !== "none" && (
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Trophy / Bowl Name <span className="font-normal normal-case italic text-slate-400">(e.g. National Championship)</span></label>
                                    <input
                                        type="text"
                                        value={titleName}
                                        onChange={(e) => setTitleName(e.target.value)}
                                        className="w-full border border-slate-300 rounded p-2 text-sm text-black"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <label className="flex items-center gap-2 cursor-pointer mb-4">
                                <input
                                    type="checkbox"
                                    checked={isDoubleHeader}
                                    onChange={(e) => setIsDoubleHeader(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <span className="text-sm font-bold text-slate-700">Is Double Header? <span className="font-normal italic text-slate-400">(Stats count double)</span></span>
                            </label>

                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Game Notes <span className="font-normal normal-case italic text-slate-400">(optional)</span></label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                className="w-full border border-slate-300 rounded p-2 text-sm font-serif text-black"
                                placeholder="Any historical context or notes about this specific game..."
                            />
                        </div>
                    </div>
                </section>

                <div className="pt-8 border-t-2 border-slate-900 mt-8 flex justify-end">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest py-3 px-8 rounded shadow-md disabled:opacity-50 transition-colors"
                    >
                        {isSubmitting ? "Saving..." : "Save Game Record"}
                    </button>
                </div>
            </form>

            <datalist id="teams-list">
                {teams.map(t => <option key={t.id} value={t.name} />)}
            </datalist>

            <datalist id="venues-list">
                {venues.map(v => <option key={v.id} value={v.name} />)}
            </datalist>

            <datalist id="people-list">
                {people.map(p => <option key={p.id} value={p.display_name} />)}
            </datalist>
        </div>
    );
}
