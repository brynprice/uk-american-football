import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveTeamIdentity } from "@/lib/utils/team-resolver";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function escapeCSV(val: any): string {
    if (val === null || val === undefined) return "";
    let str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        // 1. Fetch phase and season info
        const { data: phase, error: phaseError } = await supabase
            .from("phases")
            .select("*, season:seasons(id, year, competition:competitions(name))")
            .eq("id", id)
            .single();

        if (phaseError || !phase) {
            return NextResponse.json({ error: "Phase not found" }, { status: 404 });
        }

        // 2. Fetch all descendant phases to roll up games (matching front-end logic)
        const { data: allPhases } = await supabase
            .from("phases")
            .select("id, name, parent_phase_id, type")
            .eq("season_id", (phase as any).season_id);

        const getDescendants = (parentId: string): string[] => {
            const children = (allPhases || []).filter(p => p.parent_phase_id === parentId);
            return [parentId, ...children.flatMap(c => getDescendants(c.id))];
        };
        const descendantIds = getDescendants(id);

        // 3. Fetch games
        const { data: games, error: gamesError } = await supabase
            .from("games")
            .select(`
                *,
                home_team:teams!home_team_id (*, team_aliases (*)),
                away_team:teams!away_team_id (*, team_aliases (*)),
                venue:venues (name),
                phase:phases (name, parent_phase:phases!parent_phase_id (name))
            `)
            .in("phase_id", descendantIds)
            .neq("status", "anomaly")
            .order("date", { ascending: true });

        if (gamesError) throw gamesError;

        // 4. Fetch staff/coaches for these games
        const gameIds = (games || []).map(g => g.id);
        const { data: staff } = await supabase
            .from("game_staff")
            .select("game_id, team_id, role, person:people(display_name)")
            .in("game_id", gameIds)
            .eq("role", "head_coach");

        // 5. Fetch default head coaches from participations for these phases
        const { data: participations } = await supabase
            .from("participations")
            .select("phase_id, team_id, person:people(display_name)")
            .in("phase_id", descendantIds);

        // Map for quick lookup
        const staffMap = new Map(); // gameId_teamId -> name
        staff?.forEach(s => {
            if (s.person) staffMap.set(`${s.game_id}_${s.team_id}`, (s.person as any).display_name);
        });

        const partMap = new Map(); // phaseId_teamId -> name
        participations?.forEach(p => {
            if (p.person) partMap.set(`${p.phase_id}_${p.team_id}`, (p.person as any).display_name);
        });

        // 6. Build CSV
        const headers = [
            "competition", "year", "phase", "date", "away_team", "home_team",
            "away_score", "home_score", "venue", "notes", "away_coach", "home_coach",
            "is_double_header", "date_precision", "date_display", "time", "status",
            "confidence_level", "is_playoff", "is_title_game", "final_type",
            "title_name", "playoff_round", "parent_phase"
        ];

        const rows = (games || []).map(game => {
            const seasonYear = (phase as any).season.year;
            const homeIdentity = resolveTeamIdentity(game.home_team as any, seasonYear);
            const awayIdentity = resolveTeamIdentity(game.away_team as any, seasonYear);

            const homeCoach = staffMap.get(`${game.id}_${game.home_team_id}`) || partMap.get(`${game.phase_id}_${game.home_team_id}`) || "";
            const awayCoach = staffMap.get(`${game.id}_${game.away_team_id}`) || partMap.get(`${game.phase_id}_${game.away_team_id}`) || "";

            return [
                (phase as any).season.competition.name,
                seasonYear,
                game.phase.name,
                game.date || "",
                awayIdentity.name,
                homeIdentity.name,
                game.away_score ?? "",
                game.home_score ?? "",
                game.venue?.name || "",
                game.notes || "",
                awayCoach,
                homeCoach,
                game.is_double_header ? "true" : "false",
                game.date_precision || "day",
                game.date_display || "",
                game.time || "",
                game.status || "completed",
                game.confidence_level || "high",
                game.is_playoff ? "true" : "false",
                game.final_type === "title" ? "true" : "false",
                game.final_type || "",
                game.title_name || "",
                game.playoff_round || "",
                game.phase.parent_phase?.name || ""
            ].map(escapeCSV).join(",");
        });

        const csvContent = [headers.join(","), ...rows].join("\n");

        return new Response(csvContent, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="phase_${id}_export.csv"`
            }
        });

    } catch (error: any) {
        console.error("Export error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
