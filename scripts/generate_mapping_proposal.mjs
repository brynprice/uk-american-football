import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateMappingProposal() {
    const { data: teams } = await supabase.from('teams').select('id, name');
    const { data: aliases } = await supabase.from('team_aliases').select('alias, team_id, team:teams(name)');

    const primaryTeamsSet = new Set((teams || []).map(t => t.name));
    const aliasToTeam = new Map();
    if (aliases) {
        for (const a of aliases) {
            aliasToTeam.set(a.alias.toLowerCase().trim(), { alias: a.alias, canonical: a.team?.name });
        }
    }

    const csvContent = fs.readFileSync('data/BUAFL/games2013.csv', 'utf-8');
    const lines = csvContent.split(/\r?\n/).slice(1).filter(Boolean);

    const rawTeamsSet = new Set();
    for (const line of lines) {
        const parts = line.split(',');
        if (parts[4]) rawTeamsSet.add(parts[4].trim());
        if (parts[5]) rawTeamsSet.add(parts[5].trim());
    }

    const sortedRawTeams = Array.from(rawTeamsSet).sort();

    const exactPrimary = [];
    const exactAlias = [];
    const proposedMapping = [];

    for (const raw of sortedRawTeams) {
        const lower = raw.toLowerCase().trim();

        if (primaryTeamsSet.has(raw)) {
            exactPrimary.push(raw);
        } else if (aliasToTeam.has(lower)) {
            const aliasInfo = aliasToTeam.get(lower);
            exactAlias.push({ raw, alias: aliasInfo.alias, canonical: aliasInfo.canonical });
        } else {
            let proposed = "";
            let notes = "";

            if (lower === 'brighton tsunami') { proposed = 'Brighton Tsunami'; notes = 'Alias of Brighton Panthers in DB'; }
            else if (lower === 'uh sharks') { proposed = 'Hull Sharks'; notes = 'Shorthand for Hull Sharks'; }
            else if (lower === 'hallam warriors') { proposed = 'Sheffield Hallam Warriors'; notes = 'Shorthand for Sheffield Hallam Warriors'; }
            else if (lower === 'ljm fury') { proposed = 'LJMU Fury'; notes = 'Typo for LJMU Fury'; }
            else if (lower === 'ucl rams' || lower === 'uclan rams') { proposed = 'UCLan Rams'; notes = 'Shorthand for UCLan Rams'; }
            else if (lower === 'loughborough') { proposed = 'Loughborough Aces'; notes = 'Shorthand for Loughborough Aces'; }
            else if (lower === 'aces') { proposed = 'Loughborough Aces'; notes = 'Shorthand for Loughborough Aces'; }
            else if (lower === 'stallions') { proposed = 'Staffordshire Stallions'; notes = 'Shorthand for Staffordshire Stallions'; }
            else if (lower === 'wildcats') { proposed = 'Wolverhampton Wildcats'; notes = 'Shorthand for Wolverhampton Wildcats'; }
            else if (lower === 'destroyers') { proposed = 'Portsmouth Destroyers'; notes = 'Shorthand for Portsmouth Destroyers'; }
            else if (lower === 'gladiators') { proposed = 'Gloucestershire Gladiators'; notes = 'Shorthand for Gloucestershire Gladiators'; }
            else if (lower === 'leeds carnegie' || lower === 'leeds met carnegie') { proposed = 'Leeds Beckett Carnegie'; notes = 'Historical name for Leeds Beckett Carnegie'; }
            else if (lower === 'leeds celtics') { proposed = 'Leeds Celtics'; notes = 'Former team name / alias'; }
            else if (lower === 'city sentinels' || lower === 'london city sentinels') { proposed = 'City Wolfpack'; notes = 'Historical name for City Wolfpack'; }
            else if (lower === 'canterbury chargers') { proposed = 'Canterbury CC Chargers'; notes = 'Shorthand for Canterbury CC Chargers'; }
            else if (lower === 'coventry jets') { proposed = 'Coventry University Jets'; notes = 'Shorthand for Coventry University Jets'; }
            else if (lower === 'ntu renegades' || lower === 'ntu') { proposed = 'Nottingham Trent Renegades'; notes = 'Shorthand for Nottingham Trent Renegades'; }
            else if (lower === 'rhul bears' || lower === 'royal holloway') { proposed = 'Royal Holloway Bears'; notes = 'Shorthand for Royal Holloway Bears'; }
            else if (lower === 'obu panthers') { proposed = 'Oxford Brookes University'; notes = 'Shorthand for Oxford Brookes University'; }
            else if (lower === 'napier knights') { proposed = 'Edinburgh Napier Knights'; notes = 'Shorthand for Edinburgh Napier Knights'; }
            else if (lower === 'east anglia') { proposed = 'UEA Pirates'; notes = 'Shorthand for UEA Pirates'; }
            else if (lower === 'stirling' || lower.includes('stirling')) { proposed = 'Stirling Clansmen'; notes = 'Shorthand for Stirling Clansmen'; }
            else if (lower === 'swansea' || lower.includes('swansea')) { proposed = 'Swansea Titans'; notes = 'Shorthand for Swansea Titans'; }
            else if (lower === 'brighton') { proposed = 'Brighton Panthers'; notes = 'Shorthand for Brighton Panthers'; }
            else if (lower === 'hertfordshire') { proposed = 'Hertfordshire Hurricanes'; notes = 'Shorthand for Hertfordshire Hurricanes'; }
            else if (lower === 'birmingham') { proposed = 'Birmingham Lions'; notes = 'Shorthand for Birmingham Lions'; }
            else if (lower === 'durham') { proposed = 'Durham Saints'; notes = 'Shorthand for Durham Saints'; }
            else if (lower === 'imperial') { proposed = 'Imperial Immortals'; notes = 'Shorthand for Imperial Immortals'; }
            else if (lower === 'derby') { proposed = 'Derby Braves'; notes = 'Shorthand for Derby Braves'; }
            else if (lower === 'bath') { proposed = 'Bath Killer Bees'; notes = 'Shorthand for Bath Killer Bees'; }
            else if (lower === 'sheffield') { proposed = 'Sheffield Sabres'; notes = 'Shorthand for Sheffield Sabres'; }
            else if (lower === 'portsmouth') { proposed = 'Portsmouth Destroyers'; notes = 'Shorthand for Portsmouth Destroyers'; }
            else if (lower === 'nottingham') { proposed = 'Nottingham Outlaws'; notes = 'Shorthand for Nottingham Outlaws'; }
            else if (lower === 'exeter') { proposed = 'Exeter Demons'; notes = 'Shorthand for Exeter Demons'; }
            else if (lower === 'kent') { proposed = 'Kent Falcons'; notes = 'Shorthand for Kent Falcons'; }
            else if (lower === 'surrey') { proposed = 'Surrey Stingers'; notes = 'Shorthand for Surrey Stingers'; }
            else if (lower === 'glasgow') { proposed = 'Glasgow Tigers'; notes = 'Shorthand for Glasgow Tigers'; }
            else {
                for (const pt of primaryTeamsSet) {
                    if (pt.toLowerCase().includes(lower) || lower.includes(pt.toLowerCase())) {
                        proposed = pt;
                        notes = `Substring match`;
                        break;
                    }
                }
            }

            proposedMapping.push({ raw, proposed, notes });
        }
    }

    console.log("=== EXACT PRIMARY TEAM MATCHES IN DB ===");
    console.log(exactPrimary);

    console.log("\n=== EXACT TEAM ALIAS MATCHES IN DB ===");
    console.log(exactAlias);

    console.log("\n=== PROPOSED TEAM NAME MAPPINGS ===");
    console.log(proposedMapping);
}

generateMappingProposal();
