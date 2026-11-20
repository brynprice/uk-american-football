"use client";

import { useState, FormEvent, useEffect } from "react";
import { ProposalType, submitGameProposal, submitSeasonCoachProposal } from "../../app/(public)/propose-game/actions";
import { ArchiveService, TeamWithAliases, Phase } from "@/services/archive-service";
import { supabase } from "@/lib/supabase/client";
import { resolveTeamIdentity } from "@/lib/utils/team-resolver";
import { isValidUuid } from "@/lib/utils/validation";

interface GameProposalFormProps {
    gameId?: string;
    initialData?: {
        competition: string;
        year: string;
        phase: string;
        date: string;
        home_team: string;
        away_team: string;
        home_score: string;
        away_score: string;
        venue: string;
        notes: string;
        status: string;
        is_playoff: boolean;
        playoff_round: string;
        final_type: string;
        title_name: string;
        is_double_header: boolean;
    };
    onSuccess?: () => void;
}

export default function GameProposalForm({ gameId, initialData, onSuccess }: GameProposalFormProps) {
    const [resolvedGameId, setResolvedGameId] = useState<string | undefined>(gameId);
    const isUpdate = !!resolvedGameId;
    const [contributionMode, setContributionMode] = useState<"game" | "coach">("game");

    // Data lists for dropdowns
    const [teams, setTeams] = useState<TeamWithAliases[]>([]);
    const [seasons, setSeasons] = useState<any[]>([]);
    const [phases, setPhases] = useState<Phase[]>([]);
    const [people, setPeople] = useState<any[]>([]);
    const [venues, setVenues] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Season Head Coach Form State
    const [coachFormData, setCoachFormData] = useState({
        seasonId: "",
        teamId: "",
        headCoach: "",
    });
    const [seasonTeamDetails, setSeasonTeamDetails] = useState<
        Record<string, { coaches: string[]; phases: string[] }>
    >({});
    const [isLoadingSeasonTeams, setIsLoadingSeasonTeams] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        competition: initialData?.competition || "BUAFL",
        year: initialData?.year || new Date().getFullYear().toString(),
        phase: initialData?.phase || "",
        date: initialData?.date || "",
        time: (initialData as any)?.time || "",
        home_team: initialData?.home_team || "",
        away_team: initialData?.away_team || "",
        home_score: initialData?.home_score || "",
        away_score: initialData?.away_score || "",
        home_coach: (initialData as any)?.home_coach || "",
        away_coach: (initialData as any)?.away_coach || "",
        venue: initialData?.venue || "",
        notes: initialData?.notes || "",
        status: initialData?.status || "completed",
        is_playoff: initialData?.is_playoff || false,
        playoff_round: initialData?.playoff_round || "",
        final_type: initialData?.final_type || "none",
        title_name: initialData?.title_name || "",
        is_double_header: initialData?.is_double_header || false,
    });

    const [metaData, setMetaData] = useState({
        reason: "",
        sourceUrl: "",
        submittedByName: "",
        submittedByEmail: "",
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });

    useEffect(() => {
        const urlParams = typeof window !== "undefined"
            ? new URLSearchParams(window.location.search)
            : null;
        const urlId = !gameId && urlParams ? urlParams.get("id")?.trim() : undefined;
        const targetGameId = gameId || (urlId && isValidUuid(urlId) ? urlId : undefined);

        const paramTeam = urlParams?.get("team")?.trim() || "";
        const paramComp = urlParams?.get("competition")?.trim() || "";
        const paramYear = urlParams?.get("year")?.trim() || "";
        const paramPhase = urlParams?.get("phase")?.trim() || "";
        const paramMode = (urlParams?.get("mode") || urlParams?.get("type") || "")
            .trim()
            .toLowerCase();

        if (!targetGameId && (paramMode === "coach" || paramMode === "season-coach")) {
            setContributionMode("coach");
        }

        const loadData = async () => {
            try {
                const [teamsData, seasonsData, phasesData, peopleData, venuesData, prefillGame] = await Promise.all([
                    ArchiveService.getTeams(),
                    ArchiveService.getSeasons(),
                    ArchiveService.getAllPhases(),
                    ArchiveService.getPeople(),
                    ArchiveService.getVenues(),
                    targetGameId && !initialData
                        ? ArchiveService.getGameDetails(targetGameId).catch((err) => {
                            console.error("Error fetching game details for proposal:", err);
                            return null;
                        })
                        : Promise.resolve(null),
                ]);
                if (targetGameId) {
                    setResolvedGameId(targetGameId);
                }
                setTeams(teamsData);
                setSeasons(seasonsData);
                setPhases(phasesData);
                setPeople(peopleData);
                setVenues(venuesData);

                if (prefillGame) {
                    const seasonObj = prefillGame.phase?.season || prefillGame.season;
                    const seasonYear = seasonObj?.year;
                    const compName = seasonObj?.competition?.name || "";
                    const homeIdentity = resolveTeamIdentity(prefillGame.home_team, seasonYear);
                    const awayIdentity = resolveTeamIdentity(prefillGame.away_team, seasonYear);
                    const formattedSeason = compName && seasonYear
                        ? `${compName} ${seasonYear}`
                        : (seasonYear ? seasonYear.toString() : "");

                    setFormData((prev) => ({
                        ...prev,
                        competition: compName || prev.competition,
                        year: formattedSeason || prev.year,
                        phase: prefillGame.phase?.name || "",
                        date: prefillGame.date || "",
                        time: prefillGame.time || "",
                        home_team: prefillGame.home_team?.name || homeIdentity.name || "",
                        away_team: prefillGame.away_team?.name || awayIdentity.name || "",
                        home_score: prefillGame.home_score?.toString() || "",
                        away_score: prefillGame.away_score?.toString() || "",
                        venue: prefillGame.venue?.name || "",
                        notes: prefillGame.notes || "",
                        status: prefillGame.status || "completed",
                        is_playoff: Boolean(prefillGame.is_playoff),
                        playoff_round: prefillGame.playoff_round || "",
                        final_type: prefillGame.final_type || "none",
                        title_name: prefillGame.title_name || "",
                        is_double_header: Boolean(prefillGame.is_double_header),
                    }));
                } else if (!targetGameId && !initialData && (paramTeam || paramComp || paramYear || paramPhase)) {
                    const seasonValue = paramComp && paramYear ? `${paramComp} ${paramYear}` : paramYear;
                    setFormData((prev) => ({
                        ...prev,
                        competition: paramComp || prev.competition,
                        year: seasonValue || prev.year,
                        phase: paramPhase || prev.phase,
                        home_team: paramTeam || prev.home_team,
                    }));

                    const matchedSeason = seasonsData.find(
                        (s: any) =>
                            `${s.competition?.name} ${s.year}` === seasonValue ||
                            (paramYear && String(s.year) === paramYear && (!paramComp || s.competition?.name === paramComp))
                    );
                    const matchedTeam = paramTeam
                        ? teamsData.find(
                            (t) =>
                                t.name.toLowerCase() === paramTeam.toLowerCase() ||
                                t.id === paramTeam ||
                                t.team_aliases?.some((a) => a.name.toLowerCase() === paramTeam.toLowerCase())
                        )
                        : null;

                    if (matchedSeason || matchedTeam) {
                        setCoachFormData((prev) => ({
                            ...prev,
                            seasonId: matchedSeason?.id || prev.seasonId,
                            teamId: matchedTeam?.id || prev.teamId,
                        }));
                    }
                }
            } catch (error) {
                console.error("Error loading form data:", error);
            } finally {
                setIsLoadingData(false);
            }
        };
        loadData();
    }, [gameId, initialData]);

    useEffect(() => {
        if (!coachFormData.seasonId || !isValidUuid(coachFormData.seasonId)) {
            setSeasonTeamDetails({});
            return;
        }

        let cancelled = false;
        const loadSeasonParticipations = async () => {
            setIsLoadingSeasonTeams(true);
            try {
                const seasonPhases = phases.filter((p) => p.season_id === coachFormData.seasonId);
                const phaseIds = seasonPhases.map((p) => p.id);
                if (phaseIds.length === 0) {
                    if (!cancelled) setSeasonTeamDetails({});
                    return;
                }

                const phaseNameById = new Map(seasonPhases.map((p) => [p.id, p.name]));
                const [{ data: partData }, { data: gameData }] = await Promise.all([
                    supabase
                        .from("participations")
                        .select("team_id, phase_id, person:people(display_name)")
                        .in("phase_id", phaseIds),
                    supabase
                        .from("games")
                        .select("home_team_id, away_team_id, phase_id, away_phase_id")
                        .in("phase_id", phaseIds)
                        .neq("status", "anomaly"),
                ]);

                if (cancelled) return;

                const details: Record<string, { coaches: string[]; phases: string[] }> = {};
                const ensureEntry = (tId: string) => {
                    if (!details[tId]) details[tId] = { coaches: [], phases: [] };
                    return details[tId];
                };

                for (const row of (partData as any[]) || []) {
                    if (!row.team_id) continue;
                    const entry = ensureEntry(row.team_id);
                    const pName = phaseNameById.get(row.phase_id);
                    if (pName && !entry.phases.includes(pName)) entry.phases.push(pName);
                    const coachName = row.person?.display_name;
                    if (coachName && !entry.coaches.includes(coachName)) entry.coaches.push(coachName);
                }

                for (const g of (gameData as any[]) || []) {
                    if (g.home_team_id) {
                        const entry = ensureEntry(g.home_team_id);
                        const pName = phaseNameById.get(g.phase_id);
                        if (pName && !entry.phases.includes(pName)) entry.phases.push(pName);
                    }
                    if (g.away_team_id) {
                        const entry = ensureEntry(g.away_team_id);
                        const pName = phaseNameById.get(g.away_phase_id || g.phase_id);
                        if (pName && !entry.phases.includes(pName)) entry.phases.push(pName);
                    }
                }

                setSeasonTeamDetails(details);
            } catch (err) {
                console.error("Error loading season teams for coach proposal:", err);
            } finally {
                if (!cancelled) setIsLoadingSeasonTeams(false);
            }
        };

        loadSeasonParticipations();
        return () => {
            cancelled = true;
        };
    }, [coachFormData.seasonId, phases]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        
        if (name in metaData) {
            setMetaData(prev => ({ ...prev, [name]: val }));
        } else if (name in coachFormData) {
            setCoachFormData(prev => ({ ...prev, [name]: String(val) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: val }));
        }
    };

    const resetForm = () => {
        setFormData({
            competition: "BUAFL",
            year: new Date().getFullYear().toString(),
            phase: "",
            date: "",
            time: "",
            home_team: "",
            away_team: "",
            home_score: "",
            away_score: "",
            home_coach: "",
            away_coach: "",
            venue: "",
            notes: "",
            status: "completed",
            is_playoff: false,
            playoff_round: "",
            final_type: "none",
            title_name: "",
            is_double_header: false,
        });
        setCoachFormData(prev => ({
            ...prev,
            teamId: "",
            headCoach: "",
        }));
        setMetaData(prev => ({
            ...prev,
            reason: "",
            sourceUrl: "",
        }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage({ text: "", type: "" });

        try {
            if (!isUpdate && contributionMode === "coach") {
                const result = await submitSeasonCoachProposal({
                    seasonId: coachFormData.seasonId,
                    teamId: coachFormData.teamId,
                    headCoach: coachFormData.headCoach,
                    reason: metaData.reason,
                    sourceUrl: metaData.sourceUrl,
                    submittedByName: metaData.submittedByName,
                    submittedByEmail: metaData.submittedByEmail,
                });

                if (!result.success) {
                    throw new Error(result.error);
                }

                setMessage({
                    text: "Thank you! Your season Head Coach proposal has been submitted for review.",
                    type: "success",
                });
                resetForm();
                if (onSuccess) {
                    setTimeout(onSuccess, 2000);
                }
                return;
            }

            const payload = {
                gameId: resolvedGameId,
                proposalType: (isUpdate ? 'update' : 'add') as ProposalType,
                proposedData: formData,
                reason: metaData.reason,
                sourceUrl: metaData.sourceUrl,
                submittedByName: metaData.submittedByName,
                submittedByEmail: metaData.submittedByEmail,
            };

            const result = await submitGameProposal(payload);

            if (!result.success) {
                throw new Error(result.error);
            }

            setMessage({ text: "Thank you! Your proposal has been submitted for review.", type: "success" });
            
            // Clear form on success
            if (!isUpdate) {
                resetForm();
            }

            if (onSuccess) {
                setTimeout(onSuccess, 2000);
            }
        } catch (err: any) {
            setMessage({ text: err.message, type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Derived lists
    const filteredPhases = formData.year 
        ? phases.filter(p => {
            const season = seasons.find(s => s.year.toString() === formData.year || `${s.competition?.name} ${s.year}` === formData.year);
            return season ? p.season_id === season.id : true;
        })
        : phases;

    const selectedCoachSeason = seasons.find((s) => s.id === coachFormData.seasonId);
    const activeSeasonTeamIds = new Set(Object.keys(seasonTeamDetails));
    const participatingCoachTeams = teams.filter((t) => activeSeasonTeamIds.has(t.id));
    const remainingCoachTeams = teams.filter((t) => !activeSeasonTeamIds.has(t.id));
    const selectedTeamSeasonInfo = coachFormData.teamId ? seasonTeamDetails[coachFormData.teamId] : undefined;

    const formatTeamOptionLabel = (t: TeamWithAliases) => {
        if (selectedCoachSeason?.year) {
            const identity = resolveTeamIdentity(t, selectedCoachSeason.year);
            if (identity.name && identity.name !== t.name) {
                return `${t.name} (as ${identity.name})`;
            }
        }
        return `${t.name}${t.team_aliases && t.team_aliases.length > 0 ? ` (fka ${t.team_aliases.map(a => a.name).join(', ')})` : ''}`;
    };

    return (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-w-4xl mx-auto">
            <div className="bg-slate-900 p-8 text-white">
                {!isUpdate && (
                    <div className="inline-flex flex-wrap gap-2 p-1 bg-slate-800 rounded-xl border border-slate-700 mb-6 font-sans">
                        <button
                            type="button"
                            onClick={() => {
                                setContributionMode("game");
                                setMessage({ text: "", type: "" });
                            }}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                contributionMode === "game"
                                    ? "bg-amber-400 text-slate-950 shadow-sm"
                                    : "text-slate-300 hover:text-white hover:bg-slate-700/60"
                            }`}
                        >
                            Report Missing Game
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setContributionMode("coach");
                                setMessage({ text: "", type: "" });
                            }}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                contributionMode === "coach"
                                    ? "bg-amber-400 text-slate-950 shadow-sm"
                                    : "text-slate-300 hover:text-white hover:bg-slate-700/60"
                            }`}
                        >
                            Set Season Head Coach
                        </button>
                    </div>
                )}
                <h2 className="text-3xl font-black uppercase tracking-tighter italic">
                    {isUpdate
                        ? "Suggest Correction"
                        : contributionMode === "coach"
                        ? "Set Season Head Coach"
                        : "Report Missing Game"}
                </h2>
                <p className="text-slate-400 text-sm mt-2 font-sans">
                    {contributionMode === "coach" && !isUpdate
                        ? "Propose or update the Head Coach for a team across an entire season. All suggestions are reviewed by an admin."
                        : "Help us expand the archive. All suggestions are reviewed by an admin."}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8">
                {message.text && (
                    <div className={`p-4 rounded-xl font-bold border-l-4 transition-all animate-in fade-in slide-in-from-top-4 ${
                        message.type === 'error' ? 'bg-red-50 text-red-800 border-red-600' : 'bg-green-50 text-green-800 border-green-600'
                    }`}>
                        {message.text}
                    </div>
                )}

                {/* Submitter Info */}
                <section className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">About You</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Your Name</label>
                            <input
                                required
                                name="submittedByName"
                                type="text"
                                value={metaData.submittedByName}
                                onChange={handleChange}
                                placeholder="e.g. John Doe"
                                className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Your Email</label>
                            <input
                                required
                                name="submittedByEmail"
                                type="email"
                                value={metaData.submittedByEmail}
                                onChange={handleChange}
                                placeholder="john@example.com"
                                className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                </section>

                {!isUpdate && contributionMode === "coach" ? (
                    <section className="space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                            Season Coaching Assignment
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                                    Season
                                </label>
                                <select
                                    required
                                    name="seasonId"
                                    value={coachFormData.seasonId}
                                    onChange={(e) => {
                                        const nextSeasonId = e.target.value;
                                        setCoachFormData((prev) => ({
                                            ...prev,
                                            seasonId: nextSeasonId,
                                        }));
                                    }}
                                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                >
                                    <option value="">Select Season...</option>
                                    {seasons.map((s) => {
                                        const seasonName = `${s.competition?.name} ${s.year}`;
                                        return (
                                            <option key={s.id} value={s.id}>
                                                {seasonName}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                                    Team {isLoadingSeasonTeams && <span className="text-slate-400 font-normal italic">(Loading season teams...)</span>}
                                </label>
                                <select
                                    required
                                    name="teamId"
                                    value={coachFormData.teamId}
                                    onChange={handleChange}
                                    disabled={!coachFormData.seasonId}
                                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400"
                                >
                                    <option value="">
                                        {coachFormData.seasonId ? "Select Team..." : "Select a Season first..."}
                                    </option>
                                    {participatingCoachTeams.length > 0 ? (
                                        <>
                                            <optgroup
                                                label={`Teams in ${
                                                    selectedCoachSeason
                                                        ? `${selectedCoachSeason.competition?.name} ${selectedCoachSeason.year}`
                                                        : "Selected Season"
                                                } (${participatingCoachTeams.length})`}
                                            >
                                                {participatingCoachTeams.map((t) => (
                                                    <option key={t.id} value={t.id}>
                                                        {formatTeamOptionLabel(t)}
                                                    </option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="All Other Archive Teams">
                                                {remainingCoachTeams.map((t) => (
                                                    <option key={t.id} value={t.id}>
                                                        {formatTeamOptionLabel(t)}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        </>
                                    ) : (
                                        teams.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {formatTeamOptionLabel(t)}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                        </div>

                        {coachFormData.seasonId && coachFormData.teamId && (
                            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 font-sans text-xs space-y-1.5">
                                {selectedTeamSeasonInfo && selectedTeamSeasonInfo.phases.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-black uppercase tracking-wider text-blue-900">
                                            Recorded Phases:
                                        </span>
                                        <span className="text-blue-800 font-semibold">
                                            {selectedTeamSeasonInfo.phases.join(" • ")}
                                        </span>
                                    </div>
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-black uppercase tracking-wider text-blue-900">
                                        Current Head Coach in Archive:
                                    </span>
                                    {selectedTeamSeasonInfo && selectedTeamSeasonInfo.coaches.length > 0 ? (
                                        <span className="bg-blue-100 text-blue-950 font-bold px-2 py-0.5 rounded border border-blue-300">
                                            {selectedTeamSeasonInfo.coaches.join(", ")}
                                        </span>
                                    ) : (
                                        <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded border border-amber-300">
                                            Unknown / Not Recorded
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/40 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                                    Head Coach Name (Entire Season)
                                </label>
                                <input
                                    required
                                    name="headCoach"
                                    type="text"
                                    value={coachFormData.headCoach}
                                    onChange={handleChange}
                                    placeholder="Select existing person or type full name..."
                                    list="people-list"
                                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-base font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                                <p className="text-[11px] text-slate-500 font-sans mt-1.5 italic">
                                    Once approved by an admin, this will set the Head Coach for all phases and games played by this team during the selected season.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                                    Source <span className="font-normal normal-case italic text-slate-400">(Link, game programme, yearbook, newspaper, etc.)</span>
                                </label>
                                <input
                                    name="sourceUrl"
                                    type="text"
                                    value={metaData.sourceUrl}
                                    onChange={handleChange}
                                    placeholder="e.g. Official team yearbook, Britball archive URL, or contemporary match report"
                                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </section>
                ) : (
                    /* Game Details */
                    <section className="space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Game Information</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Date</label>
                                <input
                                    name="date"
                                    type="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Time</label>
                                <input
                                    name="time"
                                    type="text"
                                    placeholder="e.g. 14:00"
                                    value={formData.time}
                                    onChange={handleChange}
                                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Status</label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                >
                                    <option value="completed">Completed</option>
                                    <option value="awarded">Awarded / Walkover</option>
                                    <option value="cancelled">Cancelled</option>
                                    <option value="postponed">Postponed</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Season</label>
                                <select
                                    name="year"
                                    value={formData.year}
                                    onChange={handleChange}
                                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                >
                                    <option value="">Select Season...</option>
                                    {seasons.map(s => {
                                        const seasonName = `${s.competition?.name} ${s.year}`;
                                        return (
                                            <option key={s.id} value={seasonName}>{seasonName}</option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Phase</label>
                                <select
                                    name="phase"
                                    value={formData.phase}
                                    onChange={handleChange}
                                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                >
                                    <option value="">Select Phase...</option>
                                    {filteredPhases.map(p => (
                                        <option key={p.id} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Venue</label>
                                <input
                                    name="venue"
                                    type="text"
                                    value={formData.venue}
                                    onChange={handleChange}
                                    placeholder="e.g. South Leeds Stadium"
                                    list="venues-list"
                                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end -mb-3">
                            <button
                                type="button"
                                onClick={() =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        home_team: prev.away_team,
                                        away_team: prev.home_team,
                                        home_score: prev.away_score,
                                        away_score: prev.home_score,
                                        home_coach: prev.away_coach,
                                        away_coach: prev.home_coach,
                                    }))
                                }
                                className="text-[10px] font-black uppercase tracking-wider text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 px-3 py-1 rounded-full transition-colors cursor-pointer"
                            >
                                ⇄ Swap Home / Away
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4 px-6 border-2 border-dashed border-slate-100 rounded-2xl">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase text-center text-slate-300 tracking-[0.2em]">Home Team</h4>
                                <select
                                    name="home_team"
                                    value={formData.home_team}
                                    onChange={handleChange}
                                    className="w-full border-b-2 border-slate-200 p-2 text-lg font-black text-center focus:border-blue-500 outline-none transition-all bg-transparent"
                                >
                                    <option value="">Select Home Team...</option>
                                    {teams.map(t => (
                                        <option key={t.id} value={t.name}>
                                            {t.name}{t.team_aliases && t.team_aliases.length > 0 ? ` (fka ${t.team_aliases.map(a => a.name).join(', ')})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <div className="flex items-center justify-center gap-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Score:</label>
                                    <input
                                        name="home_score"
                                        type="number"
                                        value={formData.home_score}
                                        onChange={handleChange}
                                        className="w-20 border border-slate-200 rounded p-2 text-2xl font-black text-center"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black uppercase text-slate-500 text-center">Head Coach</label>
                                    <input
                                        name="home_coach"
                                        type="text"
                                        value={formData.home_coach}
                                        onChange={handleChange}
                                        placeholder="Select or type coach name..."
                                        list="people-list"
                                        className="w-full border border-slate-100 rounded p-2 text-sm text-center italic"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase text-center text-slate-300 tracking-[0.2em]">Away Team</h4>
                                <select
                                    name="away_team"
                                    value={formData.away_team}
                                    onChange={handleChange}
                                    className="w-full border-b-2 border-slate-200 p-2 text-lg font-black text-center focus:border-blue-500 outline-none transition-all bg-transparent"
                                >
                                    <option value="">Select Away Team...</option>
                                    {teams.map(t => (
                                        <option key={t.id} value={t.name}>
                                            {t.name}{t.team_aliases && t.team_aliases.length > 0 ? ` (fka ${t.team_aliases.map(a => a.name).join(', ')})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <div className="flex items-center justify-center gap-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Score:</label>
                                    <input
                                        name="away_score"
                                        type="number"
                                        value={formData.away_score}
                                        onChange={handleChange}
                                        className="w-20 border border-slate-200 rounded p-2 text-2xl font-black text-center"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black uppercase text-slate-500 text-center">Head Coach</label>
                                    <input
                                        name="away_coach"
                                        type="text"
                                        value={formData.away_coach}
                                        onChange={handleChange}
                                        placeholder="Select or type coach name..."
                                        list="people-list"
                                        className="w-full border border-slate-100 rounded p-2 text-sm text-center italic"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Source <span className="font-normal normal-case italic text-slate-400">(Link, book, newspaper, etc.)</span></label>
                                <input
                                    name="sourceUrl"
                                    type="text"
                                    value={metaData.sourceUrl}
                                    onChange={handleChange}
                                    placeholder="e.g. 2015 BUAFL Rulebook, or URL"
                                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </section>
                )}

                <section className="bg-amber-50 rounded-xl p-6 border border-amber-100">
                    <label className="block text-[10px] font-black uppercase text-amber-600 mb-2">Reason for Suggestion</label>
                    <textarea
                        required
                        name="reason"
                        value={metaData.reason}
                        onChange={handleChange}
                        rows={3}
                        placeholder="Please explain why you are suggesting this change. Include any historical context or references."
                        className="w-full bg-white border border-amber-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    />
                </section>

                <div className="flex justify-end gap-4 p-4">
                    <button
                        type="submit"
                        disabled={isSubmitting || isLoadingData}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest py-4 px-12 rounded-full shadow-xl disabled:opacity-50 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Submitting...
                            </>
                        ) : (
                            "Submit Proposal"
                        )}
                    </button>
                </div>
            </form>

            <datalist id="people-list">
                {people.map(p => (
                    <option key={p.id} value={p.display_name} />
                ))}
            </datalist>

            <datalist id="venues-list">
                {venues.map(v => (
                    <option key={v.id} value={v.name} />
                ))}
            </datalist>
        </div>
    );
}
