'use server'

import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function deleteGame(gameId: string, redirectUrl?: string) {
    // 1. Verify User Authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { success: false, error: 'Unauthorized: You must be logged in as an admin to perform this action.' };
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
        // 3. Delete the game
        const { error } = await supabaseAdmin
            .from('games')
            .delete()
            .eq('id', gameId);

        if (error) {
            console.error("Error deleting game:", error);
            return { success: false, error: `Failed to delete game: ${error.message}` };
        }

        // 4. Revalidate and redirect
        // We revalidate broadly to ensure lists update
        revalidatePath('/', 'layout');
        
        if (redirectUrl) {
            redirect(redirectUrl);
        }

        return { success: true };

    } catch (err: any) {
        console.error("Unexpected error during game deletion:", err);
        return { success: false, error: err.message || 'An unexpected error occurred.' };
    }
}
