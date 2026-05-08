'use client';

import { useState } from 'react';
import { deleteGame } from '@/app/(public)/games/[id]/actions';
import { useRouter } from 'next/navigation';

interface Props {
    gameId: string;
    redirectUrl?: string;
    variant?: 'large' | 'small' | 'icon';
}

export default function DeleteGameButton({ gameId, redirectUrl, variant = 'large' }: Props) {
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent link navigation if inside a Link
        e.stopPropagation(); // Prevent event bubbling if inside a clickable row

        if (!window.confirm("Are you sure you want to delete this game? This action cannot be undone.")) {
            return;
        }

        setIsDeleting(true);

        try {
            const result = await deleteGame(gameId, redirectUrl);
            
            if (result && !result.success) {
                alert(result.error);
                setIsDeleting(false);
            }
            // If success and redirectUrl is present, the server action will redirect.
            // If success and NO redirectUrl, the server action revalidates.
            // We shouldn't reset isDeleting to false if it was successful because the component will unmount or the page will refresh.
            if (result && result.success && !redirectUrl) {
                router.refresh();
            }
        } catch (error) {
            alert("An unexpected error occurred.");
            setIsDeleting(false);
        }
    };

    if (variant === 'icon') {
        return (
            <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-2 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                title="Delete Game"
            >
                {isDeleting ? (
                    <span className="w-4 h-4 block border-2 border-slate-300 border-t-red-600 rounded-full animate-spin"></span>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                )}
            </button>
        );
    }

    if (variant === 'small') {
         return (
             <button 
                 onClick={handleDelete}
                 disabled={isDeleting}
                 className="bg-red-100 text-red-700 hover:bg-red-600 hover:text-white px-2 py-1 text-[10px] font-black uppercase rounded border border-red-200 hover:border-red-700 transition-colors disabled:opacity-50"
                 title="Delete Game"
             >
                 {isDeleting ? "Deleting..." : "Delete"}
             </button>
         );
    }

    return (
        <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 text-white font-black py-3 px-6 uppercase tracking-widest text-sm border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:translate-x-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isDeleting ? "Deleting Game..." : "Delete Game"}
        </button>
    );
}
