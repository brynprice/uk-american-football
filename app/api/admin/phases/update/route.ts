import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assertPermission, UnauthorizedError } from '@/lib/auth/admin-guard';
import { isValidUuid } from '@/lib/utils/validation';

function getAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase configuration');
    }
    return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request: NextRequest) {
    try {
        await assertPermission('game_counts');

        let body: any;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
        }

        const { phaseId, phaseIds, max_games_per_team, games_validated } = body || {};

        // Build the validated update payload from provided fields
        const updatePayload: Record<string, any> = {};
        if (max_games_per_team !== undefined) {
            if (
                max_games_per_team !== null &&
                (typeof max_games_per_team !== 'number' ||
                    !Number.isInteger(max_games_per_team) ||
                    max_games_per_team < 0 ||
                    max_games_per_team > 50)
            ) {
                return NextResponse.json(
                    { error: 'max_games_per_team must be null or an integer between 0 and 50' },
                    { status: 400 }
                );
            }
            updatePayload.max_games_per_team = max_games_per_team;
        }
        if (games_validated !== undefined) {
            if (typeof games_validated !== 'boolean') {
                return NextResponse.json(
                    { error: 'games_validated must be a boolean' },
                    { status: 400 }
                );
            }
            updatePayload.games_validated = games_validated;
        }

        if (Object.keys(updatePayload).length === 0) {
            return NextResponse.json({ error: 'No update fields provided' }, { status: 400 });
        }

        const supabase = getAdminClient();

        // Bulk update (multiple phase IDs)
        if (phaseIds !== undefined) {
            if (
                !Array.isArray(phaseIds) ||
                phaseIds.length === 0 ||
                phaseIds.length > 200 ||
                !phaseIds.every((id) => isValidUuid(id))
            ) {
                return NextResponse.json({ error: 'Invalid phaseIds list' }, { status: 400 });
            }

            const { error } = await supabase
                .from('phases')
                .update(updatePayload)
                .in('id', phaseIds);

            if (error) {
                console.error('/api/admin/phases/update bulk error:', error);
                return NextResponse.json({ error: 'Failed to update phases' }, { status: 500 });
            }

            return NextResponse.json({ success: true, updated: phaseIds.length });
        }

        // Single update
        if (phaseId !== undefined) {
            if (!isValidUuid(phaseId)) {
                return NextResponse.json({ error: 'Invalid phaseId' }, { status: 400 });
            }

            const { error } = await supabase
                .from('phases')
                .update(updatePayload)
                .eq('id', phaseId);

            if (error) {
                console.error('/api/admin/phases/update single error:', error);
                return NextResponse.json({ error: 'Failed to update phase' }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Missing phaseId or phaseIds' }, { status: 400 });
    } catch (err: any) {
        if (err instanceof UnauthorizedError) {
            return NextResponse.json(
                { error: err.message },
                { status: err.message.startsWith('Forbidden') ? 403 : 401 }
            );
        }
        console.error('/api/admin/phases/update unexpected error:', err);
        return NextResponse.json({ error: 'Failed to update phase configuration' }, { status: 500 });
    }
}
