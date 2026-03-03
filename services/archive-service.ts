import { supabase } from "@/lib/supabase/client";

export const ArchiveService = {
    // ... previous methods ...

    async getPersonDetails(personId: string) {
        const { data, error } = await supabase
            .from("people")
            .select(`
        *,
        game_staff (*, game:games (*, phase:phases (*, season:seasons (*, competition:competitions (*))))),
        participations (*, phase:phases (*, season:seasons (*, competition:competitions (*))))
      `)
            .eq("id", personId)
            .single();

        if (error) throw error;
        return data;
    }
};
