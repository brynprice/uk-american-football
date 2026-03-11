import Link from "next/link";
import ArchiveLayout from "@/components/archive/ArchiveLayout";

export default function AdminDashboard() {
    return (
        <ArchiveLayout>
            <div className="mb-12">
                <h1 className="text-4xl font-black mb-2 uppercase italic tracking-tighter">Admin Dashboard</h1>
                <p className="text-slate-500 font-sans">Manage the historical archive and resolve data issues.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Link href="/admin/add-game" className="group bg-white border-2 border-slate-900 p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all">
                    <h2 className="text-2xl font-black mb-4 uppercase tracking-tight group-hover:text-blue-700">Add Game Record &rarr;</h2>
                    <p className="text-slate-600 font-sans leading-relaxed">
                        Manually enter historical game data, including scores, venues, and coaching staff.
                    </p>
                </Link>

                <Link href="/admin/walkovers" className="group bg-white border-2 border-slate-900 p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all">
                    <h2 className="text-2xl font-black mb-4 uppercase tracking-tight group-hover:text-blue-700">Walkover Manager &rarr;</h2>
                    <p className="text-slate-600 font-sans leading-relaxed">
                        Resolve awarded games with missing scores. Award forfeit wins (1-0 or 0-1) or clean up duplicates.
                    </p>
                </Link>

                <Link href="/admin/set-coach" className="group bg-white border-2 border-slate-900 p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all">
                    <h2 className="text-2xl font-black mb-4 uppercase tracking-tight group-hover:text-blue-700">Coaching Manager &rarr;</h2>
                    <p className="text-slate-600 font-sans leading-relaxed">
                        Easily set head coaches for teams by season or individual games.
                    </p>
                </Link>

                <Link href="/admin/predictions" className="group bg-slate-900 text-white p-8 shadow-[8px_8px_0px_0px_rgba(59,130,246,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_rgba(59,130,246,1)] transition-all">
                    <h2 className="text-2xl font-black mb-4 uppercase tracking-tight group-hover:text-blue-400 text-blue-500">Score Predictor &rarr;</h2>
                    <p className="text-slate-400 font-sans leading-relaxed">
                        Predict future game results based on historical H2H data and common opponent analysis.
                    </p>
                </Link>
            </div>
        </ArchiveLayout>
    );
}
