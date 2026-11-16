'use server'

import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { isValidUuid, sanitizeInternalRedirect } from '@/lib/utils/validation';

export async function deleteGame(gameId: string, redirectUrl?: string) {
    if (!isValidUuid(gameId)) {
        return { success: false, error: 'Invalid game ID.' };
    }

    // 1. Verify User Authentication & Super Admin privilege
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !isSuperAdmin(user)) {
        return { success: false, error: 'Unauthorized: You must be logged in as a Super Admin to delete games.' };
    }

    // 2. Initialize Service Role Client for bypassing RLS
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
    if (!supabaseKey) {
        return { success: false, error: 'Server configuration error: Missing service role key.' };
    }

    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseKey
    );

    try {
        // 3. Look up affected entities before deletion so we can revalidate targeted paths
        const { data: existingGame } = await supabaseAdmin
            .from('games')
            .select('phase_id, away_phase_id, season_id, home_team_id, away_team_id')
            .eq('id', gameId)
            .maybeSingle();

        // 4. Delete the game
        const { error } = await supabaseAdmin
            .from('games')
            .delete()
            .eq('id', gameId);

        if (error) {
            console.error("Error deleting game:", error);
            return { success: false, error: `Failed to delete game: ${error.message}` };
        }

        // 5. Revalidate only affected routes and redirect
        revalidatePath(`/games/${gameId}`);
        if (existingGame?.phase_id) {
            revalidatePath(`/phases/${existingGame.phase_id}`);
        }
        if (existingGame?.away_phase_id && existingGame.away_phase_id !== existingGame.phase_id) {
            revalidatePath(`/phases/${existingGame.away_phase_id}`);
        }
        if (existingGame?.season_id) {
            revalidatePath(`/seasons/${existingGame.season_id}`);
        }
        if (existingGame?.home_team_id) {
            revalidatePath(`/teams/${existingGame.home_team_id}`);
        }
        if (existingGame?.away_team_id && existingGame.away_team_id !== existingGame.home_team_id) {
            revalidatePath(`/teams/${existingGame.away_team_id}`);
        }
        revalidatePath('/scorigami');
        revalidatePath('/scorigami/unique');
        revalidatePath('/');
    } catch (err: any) {
        console.error("Unexpected error during game deletion:", err);
        return { success: false, error: err.message || 'An unexpected error occurred.' };
    }

    if (redirectUrl) {
        redirect(sanitizeInternalRedirect(redirectUrl, '/'));
    }

    return { success: true };
}
