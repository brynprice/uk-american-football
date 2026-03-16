"use client";

import { useState, FormEvent, useEffect } from "react";
import { ProposalType, submitGameProposal } from "../../app/(public)/propose-game/actions";

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
    const isUpdate = !!gameId;

    // Form State
    const [formData, setFormData] = useState({
        competition: initialData?.competition || "BUAFL",
        year: initialData?.year || new Date().getFullYear().toString(),
        phase: initialData?.phase || "",
        date: initialData?.date || "",
        home_team: initialData?.home_team || "",
        away_team: initialData?.away_team || "",
        home_score: initialData?.home_score || "",
        away_score: initialData?.away_score || "",
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        
        if (name in metaData) {
            setMetaData(prev => ({ ...prev, [name]: val }));
        } else {
            setFormData(prev => ({ ...prev, [name]: val }));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage({ text: "", type: "" });

        try {
            const payload = {
                gameId,
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
            if (onSuccess) {
                setTimeout(onSuccess, 2000);
            }
        } catch (err: any) {
            setMessage({ text: err.message, type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-w-4xl mx-auto">
            <div className="bg-slate-900 p-8 text-white">
                <h2 className="text-3xl font-black uppercase tracking-tighter italic">
                    {isUpdate ? "Suggest Correction" : "Report Missing Game"}
                </h2>
                <p className="text-slate-400 text-sm mt-2 font-sans">
                    Help us expand the archive. All suggestions are reviewed by an admin.
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

                {/* Game Details */}
                <section className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Game Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Competition / Year</label>
                            <div className="flex gap-2">
                                <input
                                    name="competition"
                                    type="text"
                                    value={formData.competition}
                                    onChange={handleChange}
                                    className="w-1/2 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                                <input
                                    name="year"
                                    type="text"
                                    value={formData.year}
                                    onChange={handleChange}
                                    className="w-1/2 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4 px-6 border-2 border-dashed border-slate-100 rounded-2xl">
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-center text-slate-300 tracking-[0.2em]">Home Team</h4>
                            <input
                                name="home_team"
                                type="text"
                                value={formData.home_team}
                                onChange={handleChange}
                                placeholder="Home Team Name"
                                className="w-full border-b-2 border-slate-200 p-2 text-xl font-black text-center focus:border-blue-500 outline-none transition-all"
                            />
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
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-center text-slate-300 tracking-[0.2em]">Away Team</h4>
                            <input
                                name="away_team"
                                type="text"
                                value={formData.away_team}
                                onChange={handleChange}
                                placeholder="Away Team Name"
                                className="w-full border-b-2 border-slate-200 p-2 text-xl font-black text-center focus:border-blue-500 outline-none transition-all"
                            />
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
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Venue</label>
                            <input
                                name="venue"
                                type="text"
                                value={formData.venue}
                                onChange={handleChange}
                                placeholder="e.g. South Leeds Stadium"
                                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Source URL / Link <span className="font-normal normal-case italic text-slate-400">(Proof of result)</span></label>
                            <input
                                name="sourceUrl"
                                type="url"
                                value={metaData.sourceUrl}
                                onChange={handleChange}
                                placeholder="https://..."
                                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                </section>

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
                        disabled={isSubmitting}
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
        </div>
    );
}
