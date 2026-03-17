import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { updateWalkoverScore, deleteGame, updateGameNotes } from "./actions";
import ArchiveLayout from "@/components/archive/ArchiveLayout";

export const dynamic = "force-dynamic";

export default async function WalkoverManagerPage() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch awarded games with 0-0 scores
    const { data: games, error } = await supabase
        .from("games")
        .select(`
            id,
            date,
            notes,
            home_team:teams!home_team_id(name),
            away_team:teams!away_team_id(name),
            phase:phases!games_phase_id_fkey(name, season:seasons(year, competition:competitions(name)))
        `)
        .eq("status", "awarded")
        .is("home_score", null)
        .is("away_score", null)
        .order("date", { ascending: false });

    if (error) {
        return <div>Error loading games: {error.message}</div>;
    }

    return (
        <ArchiveLayout>
            <div className="mb-8">
                <h1 className="text-4xl font-black mb-2">Walkover Manager</h1>
                <p className="text-slate-500 font-sans">
                    Showing awarded games with 0-0 scores that need resolution.
                </p>
            </div>

            <div className="space-y-6">
                {games && games.length > 0 ? (
                    games.map((game: any) => (
                        <div key={game.id} className="bg-white border-2 border-slate-900 p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="text-xs font-black uppercase text-slate-400 tracking-widest mb-1">
                                        {game.phase?.season?.competition?.name} {game.phase?.season?.year} &bull; {game.phase?.name}
                                    </div>
                                    <div className="text-lg font-bold">
                                        {game.away_team?.name} @ {game.home_team?.name}
                                    </div>
                                    <div className="text-sm text-slate-500">
                                        {new Date(game.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <form action={deleteGame.bind(null, game.id)}>
                                        <button
                                            className="bg-red-50 text-red-600 border border-red-200 px-3 py-1 text-xs font-black uppercase hover:bg-red-600 hover:text-white transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </form>
                                </div>
                            </div>

                            <form className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">Internal Notes</label>
                                    <textarea
                                        name="notes"
                                        defaultValue={game.notes || ""}
                                        placeholder="Reason for walkover, historical context, sources..."
                                        rows={2}
                                        className="w-full border-2 border-slate-200 p-3 text-sm font-sans focus:border-slate-900 outline-none transition-colors"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        formAction={updateWalkoverScore.bind(null, game.id, 1, 0)}
                                        className="w-full bg-slate-900 text-white py-3 font-black uppercase hover:bg-blue-700 transition-colors"
                                    >
                                        Award Home Win (1-0)
                                    </button>
                                    <button
                                        formAction={updateWalkoverScore.bind(null, game.id, 0, 1)}
                                        className="w-full bg-slate-900 text-white py-3 font-black uppercase hover:bg-blue-700 transition-colors"
                                    >
                                        Award Away Win (0-1)
                                    </button>
                                </div>
                                <button
                                    formAction={updateGameNotes.bind(null, game.id)}
                                    className="w-full border-2 border-slate-900 py-3 font-black uppercase hover:bg-slate-100 transition-colors"
                                >
                                    Save Notes Only
                                </button>
                            </form>
                        </div>
                    ))
                ) : (
                    <div className="p-12 text-center bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 font-sans italic">
                        No 0-0 walkovers found! All caught up.
                    </div>
                )}
            </div>
        </ArchiveLayout>
    );
}
