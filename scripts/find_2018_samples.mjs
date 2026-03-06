import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function find2018Samples() {
    console.log("--- Searching for 2018 Sample Matches ---");

    const teams = ["London Blitz", "Tamworth Phoenix", "London Warriors"];

    for (const tName of teams) {
        const { data: team } = await supabase.from('teams').select('id, name').eq('name', tName).maybeSingle();
        if (team) {
            console.log(`\nChecking participations for ${team.name} (ID: ${team.id})`);
            const { data: participations } = await supabase
                .from('participations')
                .select(`
                    id, 
                    wins, 
                    losses, 
                    ties,
                    phases (
                        id,
                        name,
                        seasons (
                            year,
                            competitions ( name )
                        )
                    )
                `)
                .eq('team_id', team.id);

            participations?.forEach(p => {
                const year = p.phases?.seasons?.year;
                const comp = p.phases?.seasons?.competitions?.name;
                console.log(`  - ${year} ${comp} | ${p.phases?.name} | W:${p.wins} L:${p.losses} T:${p.ties}`);
            });
        }
    }
}

find2018Samples().catch(console.error);
