import { ArchiveService } from "@/services/archive-service";
import ArchiveLayout from "@/components/archive/ArchiveLayout";
import GameProposalForm from "@/components/archive/GameProposalForm";
import { resolveTeamIdentity } from "@/lib/utils/team-resolver";
export const revalidate = 86400; // 24 hours

export default async function ProposeGamePage({
    searchParams
}: {
    searchParams: Promise<{
        id?: string;
        team?: string;
        competition?: string;
        year?: string;
        phase?: string;
    }>
}) {
    const { id, team, competition, year, phase } = await searchParams;
    let initialData = undefined;

    if (id) {
        try {
            const game = await ArchiveService.getGameDetails(id);
            const homeIdentity = resolveTeamIdentity(game.home_team, game.phase.season.year);
            const awayIdentity = resolveTeamIdentity(game.away_team, game.phase.season.year);

            initialData = {
                competition: game.phase.season.competition.name,
                year: `${game.phase.season.competition.name} ${game.phase.season.year}`,
                phase: game.phase.name,
                date: game.date || "",
                home_team: homeIdentity.name,
                away_team: awayIdentity.name,
                home_score: game.home_score?.toString() || "",
                away_score: game.away_score?.toString() || "",
                venue: game.venue?.name || "",
                notes: game.notes || "",
                status: game.status,
                is_playoff: game.is_playoff,
                playoff_round: game.playoff_round || "",
                final_type: game.final_type || "none",
                title_name: game.title_name || "",
                is_double_header: game.is_double_header,
            };
        } catch (error) {
            console.error("Error fetching game details for proposal:", error);
        }
    } else if (team || competition || year || phase) {
        const seasonValue = competition && year ? `${competition} ${year}` : (year || "");
        initialData = {
            competition: competition || "BUAFL",
            year: seasonValue,
            phase: phase || "",
            date: "",
            home_team: team || "",
            away_team: "",
            home_score: "",
            away_score: "",
            venue: "",
            notes: "",
            status: "completed",
            is_playoff: false,
            playoff_round: "",
            final_type: "none",
            title_name: "",
            is_double_header: false,
        };
    }

    return (
        <ArchiveLayout>
            <div className="max-w-4xl mx-auto py-12 px-4">
                <div className="mb-8">
                    <h1 className="text-4xl font-black uppercase tracking-tighter italic text-slate-900 border-b-8 border-slate-900 pb-4 inline-block">
                        Archive Contribution
                    </h1>
                </div>
                
                <GameProposalForm 
                    gameId={id} 
                    initialData={initialData}
                />
            </div>
        </ArchiveLayout>
    );
}
