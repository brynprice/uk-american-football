import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

try {
    const envConfig = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            const val = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            process.env[key.trim()] = val;
            if (key.trim() === 'NEXT_PUBLIC_SUPABASE_URL') process.env.SUPABASE_URL = val;
            if (key.trim() === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') process.env.SUPABASE_ANON_KEY = val;
        }
    });
} catch (e) {
    console.error(e);
}

const { ArchiveService } = await import('../services/archive-service.ts');

async function checkParticipations() {
    const teams = await ArchiveService.getTeams();
    const brightonTeam = (teams || []).find(t => t.name.toLowerCase().includes('brighton'));
    
    if (!brightonTeam) return;
    
    const team = await ArchiveService.getTeamHistory(brightonTeam.id);
    
    console.log('\n=== BRIGHTON PARTICIPATIONS IN DB ===');
    for (const p of team.participations || []) {
        console.log(`Year: ${p.phase?.season?.year} | Phase: "${p.phase?.name}" (Type: ${p.phase?.type}) | W:${p.wins}, L:${p.losses}, T:${p.ties}`);
    }
}

checkParticipations();
