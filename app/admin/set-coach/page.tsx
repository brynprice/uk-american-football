"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import ArchiveLayout from "@/components/archive/ArchiveLayout";
import { updateGameCoach, updateSeasonCoach } from "./actions";

// Initialize standard client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function SetCoachPage() {
    const [seasons, setSeasons] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [games, setGames] = useState<any[]>([]);
    const [people, setPeople] = useState<any[]>([]);

    const [selectedSeason, setSelectedSeason] = useState("");
    const [selectedTeam, setSelectedTeam] = useState("");
    const [seasonCoach, setSeasonCoach] = useState("");

    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingGames, setIsLoadingGames] = useState(false);
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

                // People for Autocomplete
                const { data: pData } = await supabase
                    .from("people")
                    .select("id, display_name")
                    .order("display_name");
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
            setTeams([]);
            return;
        }
        const fetchTeams = async () => {
            // Get teams that have games or participations in the season's phases
            const { data: phases } = await supabase
                .from("phases")
                .select("id")
                .eq("season_id", selectedSeason);

            if (!phases || phases.length === 0) return;
            const phaseIds = phases.map(p => p.id);

            const { data: teamData } = await supabase
                .from("participations")
                .select("team_id, team:teams(id, name)")
                .in("phase_id", phaseIds);

            if (teamData) {
                const uniqueTeams = Array.from(new Set(teamData.map(t => JSON.stringify(t.team))))
                    .map(t => JSON.parse(t))
                    .sort((a, b) => a.name.localeCompare(b.name));
                setTeams(uniqueTeams);
            }
        };
        fetchTeams();
    }, [selectedSeason]);

    useEffect(() => {
        if (!selectedSeason || !selectedTeam) {
            setGames([]);
            return;
        }
        fetchGames();
    }, [selectedSeason, selectedTeam]);

    const fetchGames = async () => {
        setIsLoadingGames(true);
        try {
            const { data: phases } = await supabase
                .from("phases")
                .select("id")
                .eq("season_id", selectedSeason);

            if (!phases || phases.length === 0) return;
            const phaseIds = phases.map(p => p.id);

            const { data: gameData } = await supabase
                .from("games")
                .select(`
                    id, 
                    date,
                    home_score,
                    away_score,
                    home_team:teams!home_team_id(id, name),
                    away_team:teams!away_team_id(id, name),
                    phase:phases!games_phase_id_fkey(id, name),
                    staff:game_staff(id, person:people(display_name))
                `)
                .in("phase_id", phaseIds)
                .or(`home_team_id.eq.${selectedTeam},away_team_id.eq.${selectedTeam}`)
                .order("date", { ascending: false });

            if (gameData) setGames(gameData);
        } catch (err: any) {
            setMessage({ text: err.message, type: "error" });
        } finally {
            setIsLoadingGames(false);
        }
    };

    const handleApplySeasonCoach = async () => {
        if (!selectedSeason || !selectedTeam || !seasonCoach.trim()) return;
        setIsSubmitting(true);
        try {
            await updateSeasonCoach(selectedSeason, selectedTeam, seasonCoach);
            setMessage({ text: "Season head coach applied successfully!", type: "success" });
            fetchGames();
        } catch (err: any) {
            setMessage({ text: err.message, type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateGameCoach = async (gameId: string, coachName: string, phaseId: string) => {
        setIsSubmitting(true);
        try {
            await updateGameCoach(gameId, selectedTeam, coachName, phaseId);
            fetchGames();
            setMessage({ text: "Game head coach updated!", type: "success" });
            setTimeout(() => setMessage({ text: "", type: "" }), 2000);
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
                <h1 className="text-4xl font-black mb-2 uppercase italic tracking-tighter">Coaching Manager</h1>
                <p className="text-slate-500 font-sans">Set head coaches across games and seasons.</p>
            </div>

            {message.text && (
                <div className={`p-4 mb-8 rounded font-bold border-l-4 ${message.type === "error" ? "bg-red-50 text-red-800 border-red-600" : "bg-green-50 text-green-800 border-green-600"}`}>
                    {message.text}
                </div>
            )}

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
                            <option key={s.id} value={s.id}>{s.year} - {s.competition?.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Team</label>
                    <select
                        value={selectedTeam}
                        onChange={(e) => setSelectedTeam(e.target.value)}
                        disabled={!selectedSeason}
                        className="w-full border border-slate-300 rounded p-2 text-sm text-black disabled:bg-slate-50"
                    >
                        <option value="">Select Team</option>
                        {teams.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {selectedSeason && selectedTeam && !isLoadingGames && (
                <div className="mb-8 p-6 bg-blue-50 border-2 border-blue-900 shadow-[4px_4px_0px_0px_rgba(30,58,138,1)]">
                    <h2 className="text-lg font-black uppercase mb-4 text-blue-900 italic">Apply to Entire Season</h2>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <input
                                placeholder="Head Coach Name"
                                list="people-list"
                                value={seasonCoach}
                                onChange={(e) => setSeasonCoach(e.target.value)}
                                className="w-full border border-blue-200 rounded p-3 text-sm text-black shadow-inner"
                            />
                        </div>
                        <button
                            onClick={handleApplySeasonCoach}
                            disabled={isSubmitting || !seasonCoach.trim()}
                            className="bg-blue-900 hover:bg-blue-800 text-white font-black uppercase tracking-widest px-6 py-3 rounded disabled:opacity-50 transition-colors"
                        >
                            {isSubmitting ? "Applying..." : "Apply All"}
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-blue-700 italic">This will set the head coach for ALL {games.length} games and update season-level records.</p>
                </div>
            )}

            {isLoadingGames ? (
                <p>Loading games...</p>
            ) : (
                <div className="space-y-4">
                    {games.map(game => {
                        const coach = game.staff?.find((s: any) => s.person)?.person?.display_name || "";
                        return (
                            <div key={game.id} className="bg-white border border-slate-200 p-4 shadow-sm hover:border-slate-400 transition-colors flex flex-col md:flex-row md:items-center gap-4">
                                <div className="flex-1">
                                    <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">{game.phase?.name} — {new Date(game.date).toLocaleDateString()}</div>
                                    <div className="font-bold text-slate-900 flex items-center gap-2">
                                        <span className={game.home_team?.id === selectedTeam ? "underline decoration-blue-500 decoration-2" : ""}>{game.home_team?.name}</span>
                                        <span className="text-slate-300 font-black italic">vs</span>
                                        <span className={game.away_team?.id === selectedTeam ? "underline decoration-blue-500 decoration-2" : ""}>{game.away_team?.name}</span>
                                    </div>
                                    <div className="text-sm font-black text-slate-400">{game.home_score} - {game.away_score}</div>
                                </div>
                                <div className="md:w-72 flex gap-2">
                                    <input
                                        placeholder="Coach Name"
                                        defaultValue={coach}
                                        list="people-list"
                                        onBlur={(e) => {
                                            if (e.target.value !== coach) {
                                                handleUpdateGameCoach(game.id, e.target.value, game.phase.id);
                                            }
                                        }}
                                        className="flex-1 border border-slate-200 rounded p-2 text-sm text-black bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-colors"
                                    />
                                </div>
                            </div>
                        );
                    })}
                    {selectedTeam && games.length === 0 && (
                        <p className="text-center py-12 text-slate-400 font-sans italic">No games found for this team in the selected season.</p>
                    )}
                </div>
            )}

            <datalist id="people-list">
                {people.map(p => (
                    <option key={p.id} value={p.display_name} />
                ))}
            </datalist>
        </ArchiveLayout>
    );
}
