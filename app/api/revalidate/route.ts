import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

function timingSafeSecretMatch(provided: string | null, expected: string | undefined): boolean {
    if (!provided || !expected) return false;
    const bufA = Buffer.from(provided);
    const bufB = Buffer.from(expected);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
    return handleRevalidation(request);
}

async function handleRevalidation(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const authHeader = request.headers.get("authorization");
    const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const headerSecret = request.headers.get("x-revalidate-secret");
    const secret = headerSecret || bearerSecret;

    const expectedSecret = process.env.REVALIDATION_SECRET;

    if (!timingSafeSecretMatch(secret, expectedSecret)) {
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
