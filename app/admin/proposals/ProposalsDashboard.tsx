"use client";

import { useState } from "react";
import { approveGameProposal, rejectGameProposal } from "./actions";

interface Proposal {
    id: string;
    game_id: string | null;
    proposal_type: 'add' | 'update' | 'delete';
    proposed_data: any;
    reason: string;
    source_url: string | null;
    status: string;
    submitted_by_name: string | null;
    submitted_by_email: string | null;
    created_at: string;
    game?: any;
}

export default function ProposalsDashboard({ proposals: initialProposals }: { proposals: Proposal[] }) {
    const [proposals, setProposals] = useState(initialProposals);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [adminNotes, setAdminNotes] = useState<{ [key: string]: string }>({});

    const handleApprove = async (id: string) => {
        if (!confirm("Are you sure you want to approve this proposal? Changes will be applied to the database.")) return;
        setProcessingId(id);
        const result = await approveGameProposal(id, adminNotes[id]);
        if (result.success) {
            setProposals(prev => prev.filter(p => p.id !== id));
        } else {
            alert("Error: " + result.error);
        }
        setProcessingId(null);
    };

    const handleReject = async (id: string) => {
        const notes = prompt("Reason for rejection?", adminNotes[id] || "");
        if (notes === null) return; // Cancelled
        
        setProcessingId(id);
        const result = await rejectGameProposal(id, notes);
        if (result.success) {
            setProposals(prev => prev.filter(p => p.id !== id));
        } else {
            alert("Error: " + result.error);
        }
        setProcessingId(null);
    };

    if (proposals.length === 0) {
        return (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                <p className="text-slate-400 font-sans italic text-lg">No pending proposals found.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8" suppressHydrationWarning>
            {proposals.map(proposal => (
                <div key={proposal.id} className="bg-white border-2 border-slate-900 rounded shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    {/* Header */}
                    <div className={`p-4 flex justify-between items-center text-white ${
                        proposal.proposal_type === 'update' ? 'bg-amber-500' : 
                        proposal.proposal_type === 'add' ? 'bg-green-600' : 'bg-red-600'
                    }`}>
                        <div className="flex items-center gap-3">
                            <span className="font-black uppercase tracking-widest text-xs px-2 py-1 bg-black/20 rounded">
                                {proposal.proposal_type}
                            </span>
                            <span className="font-bold">
                                {proposal.proposal_type === 'update' ? 'Correction Suggested' : 'New Game Reported'}
                            </span>
                        </div>
                        <span className="text-xs font-sans opacity-80" suppressHydrationWarning>
                            Submitted {new Date(proposal.created_at).toLocaleDateString()} by {proposal.submitted_by_name || 'Anonymous'}
                        </span>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Comparison or Data */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Proposed Data</h4>
                            <div className="bg-slate-50 p-4 rounded border border-slate-100 font-sans text-sm space-y-2">
                                <div className="flex justify-between border-b border-slate-200 pb-1">
                                    <span className="text-slate-500 italic">Context:</span>
                                    <span className="font-bold">{proposal.proposed_data.competition} {proposal.proposed_data.year} - {proposal.proposed_data.phase}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 pb-1">
                                    <span className="text-slate-500 italic">Matchup:</span>
                                    <span className="font-bold">
                                        {proposal.proposed_data.home_team} {proposal.proposed_data.home_score} vs {proposal.proposed_data.away_score} {proposal.proposed_data.away_team}
                                    </span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 pb-1">
                                    <span className="text-slate-500 italic">Date / Time:</span>
                                    <span className="font-bold">{proposal.proposed_data.date || 'Unknown'} {proposal.proposed_data.time ? `@ ${proposal.proposed_data.time}` : ''}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 pb-1">
                                    <span className="text-slate-500 italic">Venue:</span>
                                    <span className="font-bold">{proposal.proposed_data.venue || 'Unknown'}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div>
                                        <span className="text-slate-500 italic text-[10px] block">Home Coach:</span>
                                        <span className="font-bold text-xs">{proposal.proposed_data.home_coach || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 italic text-[10px] block">Away Coach:</span>
                                        <span className="font-bold text-xs">{proposal.proposed_data.away_coach || 'N/A'}</span>
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <span className="text-slate-500 italic block mb-1">Reason:</span>
                                    <p className="text-slate-700 bg-white p-2 border rounded italic">{proposal.reason}</p>
                                </div>
                                {proposal.source_url && (
                                    <div className="pt-2">
                                        <a href={proposal.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 font-bold">
                                            View Source Proof &rarr;
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Existing Data (for updates) */}
                        {proposal.proposal_type === 'update' && proposal.game && (
                            <div className="space-y-4">
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Current Archive Data</h4>
                                <div className="bg-slate-100/50 p-4 rounded border border-slate-200 font-sans text-sm space-y-2 opacity-60">
                                    <div className="flex justify-between border-b border-slate-200 pb-1">
                                        <span className="text-slate-500 italic">Context:</span>
                                        <span>{proposal.game.phase?.name}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-200 pb-1">
                                        <span className="text-slate-500 italic">Matchup:</span>
                                        <span>
                                            {proposal.game.home_team?.name} {proposal.game.home_score} vs {proposal.game.away_score} {proposal.game.away_team?.name}
                                        </span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-200 pb-1">
                                        <span className="text-slate-500 italic">Date / Time:</span>
                                        <span>{proposal.game.date || 'Unknown'} {proposal.game.time ? `@ ${proposal.game.time}` : ''}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div>
                                            <span className="text-slate-500 italic text-[10px] block">Home Coach:</span>
                                            <span className="text-xs">
                                                {proposal.game.game_staff?.find((s: any) => s.role === 'head_coach' && s.team_id === proposal.game.home_team_id)?.person?.display_name || 'Unknown'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 italic text-[10px] block">Away Coach:</span>
                                            <span className="text-xs">
                                                {proposal.game.game_staff?.find((s: any) => s.role === 'head_coach' && s.team_id === proposal.game.away_team_id)?.person?.display_name || 'Unknown'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 p-4 bg-amber-50 rounded border border-amber-100">
                                    <p className="text-[10px] font-black uppercase text-amber-600 mb-1">Admin Action</p>
                                    <p className="text-slate-600 text-xs">Approving will overwrite the record with the proposed data.</p>
                                </div>
                            </div>
                        )}
                        
                        {proposal.proposal_type === 'add' && (
                            <div className="bg-blue-50 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 border border-blue-100">
                                <span className="text-4xl">🆕</span>
                                <div>
                                    <h4 className="font-black uppercase tracking-tighter text-blue-900">New Record Proposal</h4>
                                    <p className="text-xs text-blue-700 font-medium">This game doesn't exist in the archive yet.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="w-full md:w-1/2">
                            <input 
                                type="text"
                                placeholder="Add notes for the submitter or archive log..."
                                value={adminNotes[proposal.id] || ""}
                                onChange={(e) => setAdminNotes(prev => ({...prev, [proposal.id]: e.target.value}))}
                                className="w-full p-2 text-sm border-2 border-slate-200 rounded focus:border-slate-900 outline-none transition-all"
                            />
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => handleReject(proposal.id)}
                                disabled={processingId !== null}
                                className="bg-white hover:bg-red-50 text-red-600 border-2 border-red-600 font-black uppercase tracking-widest py-2 px-6 rounded transition-all disabled:opacity-50"
                            >
                                {processingId === proposal.id ? "Processing..." : "Reject"}
                            </button>
                            <button
                                onClick={() => handleApprove(proposal.id)}
                                disabled={processingId !== null}
                                className="bg-slate-900 hover:bg-blue-600 text-white font-black uppercase tracking-widest py-2 px-6 rounded shadow-md transition-all disabled:opacity-50"
                            >
                                {processingId === proposal.id ? "Processing..." : "Approve & Apply"}
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
