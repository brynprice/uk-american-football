import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phaseId, phaseIds, max_games_per_team, games_validated } = body;

        // Build the update payload from provided fields
        const updatePayload: Record<string, any> = {};
        if (max_games_per_team !== undefined) updatePayload.max_games_per_team = max_games_per_team;
        if (games_validated !== undefined) updatePayload.games_validated = games_validated;

        if (Object.keys(updatePayload).length === 0) {
            return NextResponse.json({ error: 'No update fields provided' }, { status: 400 });
        }

        // Bulk update (multiple phase IDs)
        if (phaseIds && Array.isArray(phaseIds)) {
            const { error } = await supabase
                .from('phases')
                .update(updatePayload)
                .in('id', phaseIds);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, updated: phaseIds.length });
        }

        // Single update
        if (phaseId) {
            const { error } = await supabase
                .from('phases')
                .update(updatePayload)
                .eq('id', phaseId);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Missing phaseId or phaseIds' }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
