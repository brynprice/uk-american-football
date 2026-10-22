import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function GET(request: NextRequest) {
    return handleRevalidation(request);
}

export async function POST(request: NextRequest) {
    return handleRevalidation(request);
}

async function handleRevalidation(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const secret = searchParams.get("secret");

    const expectedSecret =
        process.env.REVALIDATION_SECRET ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SERVICE_ROLE_KEY;

    if (!expectedSecret || secret !== expectedSecret) {
        return NextResponse.json({ message: "Invalid or missing revalidation secret" }, { status: 401 });
    }

    const path = searchParams.get("path");
    const season = searchParams.get("season");
    const phaseId = searchParams.get("phaseId");
    const teamId = searchParams.get("teamId");

    const revalidatedPaths: string[] = [];

    if (path) {
        revalidatePath(path);
        revalidatedPaths.push(path);
    }

    if (season) {
        revalidatePath(`/seasons/${season}`);
        revalidatedPaths.push(`/seasons/${season}`);
        revalidatePath("/");
        revalidatedPaths.push("/");
    }

    if (phaseId) {
        revalidatePath(`/phases/${phaseId}`);
        revalidatedPaths.push(`/phases/${phaseId}`);
    }

    if (teamId) {
        revalidatePath(`/teams/${teamId}`);
        revalidatedPaths.push(`/teams/${teamId}`);
    }

    if (revalidatedPaths.length === 0) {
        revalidatePath("/");
        revalidatedPaths.push("/");
    }

    return NextResponse.json({
        revalidated: true,
        now: Date.now(),
        paths: revalidatedPaths,
    });
}
