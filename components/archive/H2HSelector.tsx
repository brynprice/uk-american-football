'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Team {
    id: string;
    name: string;
}

interface H2HSelectorProps {
    teamId: string;
    opponents: Team[];
}

export default function H2HSelector({ teamId, opponents }: H2HSelectorProps) {
    const router = useRouter();
    const [selectedOpponent, setSelectedOpponent] = useState('');

    const handleCompare = () => {
        if (selectedOpponent) {
            router.push(`/teams/${teamId}/h2h/${selectedOpponent}`);
        }
    };

    return (
        <div className="bg-slate-50 border border-slate-200 p-6 shadow-sm">
            <h4 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-tighter">Compare Head-to-Head</h4>
            <div className="space-y-4">
                <select
                    value={selectedOpponent}
                    onChange={(e) => setSelectedOpponent(e.target.value)}
                    className="w-full bg-white border border-slate-300 px-3 py-2 rounded text-sm font-sans focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                    <option value="">Select an opponent...</option>
                    {opponents.map((opponent) => (
                        <option key={opponent.id} value={opponent.id}>
                            {opponent.name}
                        </option>
                    ))}
                </select>
                <button
                    onClick={handleCompare}
                    disabled={!selectedOpponent}
                    className="w-full bg-slate-900 text-white font-black uppercase text-xs py-3 rounded hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all tracking-widest"
                >
                    Compare Records
                </button>
            </div>
        </div>
    );
}
