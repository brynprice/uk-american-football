
import { ArchiveService } from './services/archive-service.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function verify() {
    try {
        // Brighton Panthers ID from earlier curl
        const teamId = '6baa7f5c-4169-404b-abe4-30f9cf7935c1';
        const team = await ArchiveService.getTeamHistory(teamId);

        console.log('Team Logo:', team.logo_url);
        console.log('Aliases found:', team.team_aliases?.length || 0);

        team.team_aliases?.forEach(alias => {
            console.log(`Alias: ${alias.name}, Logo: ${alias.logo_url}`);
        });
    } catch (e) {
        console.error(e);
    }
}

verify();
