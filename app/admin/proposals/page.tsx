import { createClient } from "@supabase/supabase-js";
import ArchiveLayout from "@/components/archive/ArchiveLayout";
import ProposalsDashboard from "./ProposalsDashboard";

export default async function AdminProposalsPage() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return <div className="p-8">Missing Supabase configuration.</div>;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: proposals, error } = await supabase
        .from("game_proposals")
        .select(`
            *,
            game:games(
                id,
                home_score,
                away_score,
                date,
                time,
                home_team_id,
                away_team_id,
                phase:phases(name),
                home_team:teams!home_team_id(name),
                away_team:teams!away_team_id(name),
                game_staff(role, team_id, person:people(display_name))
            )
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching proposals:", error);
        return <div className="p-8">Error loading proposals: {error.message}</div>;
    }

    return (
        <ArchiveLayout>
            <div className="mb-12">
                <h1 className="text-4xl font-black mb-2 uppercase italic tracking-tighter">Review Proposals</h1>
                <p className="text-slate-500 font-sans">Compare user suggestions with existing data and apply changes.</p>
            </div>

            <ProposalsDashboard proposals={proposals || []} />
        </ArchiveLayout>
    );
}
