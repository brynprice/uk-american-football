/**
 * Directly imports/syncs the 5 verified early xpLosION fixtures into Supabase:
 * - 2005-11-05: Oxford Cavaliers 0 @ Birmingham Lions 59 (BCAFL 2005)
 * - 2006-11-04: Tarannau Aberystwyth 12 @ Birmingham Lions 28 (BCAFL 2006)
 * - 2007-11-10: Warwick Wolves 0 @ Birmingham Lions 49 (BUAFL 2007)
 * - 2008-11-08: Bath Killer Bees 0 @ Birmingham Lions 29 (BUAFL 2008)
 * - 2012-11-03: Nottingham Gold 6 @ Birmingham Lions 71 (BUAFL 2012)
 */

import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const FIXTURES = [
    {
        competitionName: 'bcafl',
        year: 2005,
        phaseName: 'Central Division',
        date: '2005-11-05',
        dateDisplay: '05/11/2005',
        time: '18:30',
        homeTeam: 'Birmingham Lions',
        awayTeam: 'Oxford Cavaliers',
        homeScore: 59,
        awayScore: 0,
        notes: 'xpLosION 2005 (Inaugural edition). Source: BCAFL contemporary official archives',
        nickname: 'xpLosION'
    },
    {
        competitionName: 'bcafl',
        year: 2006,
        phaseName: 'Central Division',
        awayPhaseName: 'Welsh Division',
        date: '2006-11-04',
        dateDisplay: '04/11/2006',
        time: '18:30',
        homeTeam: 'Birmingham Lions',
        awayTeam: 'Tarannau Aberystwyth',
        homeScore: 28,
        awayScore: 12,
        notes: 'xpLosION 2006. Source: BCAFL contemporary official archives & BAFRA Newsflash Issue 43/06',
        nickname: 'xpLosION'
    },
    {
        competitionName: 'BUAFL',
        year: 2007,
        phaseName: 'Central Division',
        date: '2007-11-10',
        dateDisplay: '10/11/2007',
        time: null,
        homeTeam: 'Birmingham Lions',
        awayTeam: 'Warwick Wolves',
        homeScore: 49,
        awayScore: 0,
        notes: 'xpLosION 2007. Source: BAFRA Newsflash Issue 42/07',
        nickname: 'xpLosION'
    },
    {
        competitionName: 'BUAFL',
        year: 2008,
        phaseName: 'Conference 2 - South',
        awayPhaseName: 'Conference 3 - South West',
        date: '2008-11-08',
        dateDisplay: '08/11/2008',
        time: null,
        homeTeam: 'Birmingham Lions',
        awayTeam: 'Bath Killer Bees',
        homeScore: 29,
        awayScore: 0,
        notes: 'xpLosION 2008. Source: BAFRA Newsflash Issue 42/08 & 43/08',
        nickname: 'xpLosION'
    },
    {
        competitionName: 'BUAFL',
        year: 2012,
        phaseName: 'Midlands Athletics Conference',
        date: '2012-11-03',
        dateDisplay: '03/11/2012',
        time: null,
        homeTeam: 'Birmingham Lions',
        awayTeam: 'Nottingham Gold',
        homeScore: 71,
        awayScore: 6,
        venue: 'Bournbrook 3G',
        notes: 'xpLosION 2012. Source: Double Coverage contemporary archives & BAFRA Newsflash Issue 40/12',
        nickname: 'xpLosION'
    }
];

const slugify = (text) => text.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

async function resolveTeamId(teamName, year) {
    const cleanName = teamName.trim();
    // 1. Check alias
    const { data: aliases } = await supabase
        .from('team_aliases')
        .select('team_id, start_year, end_year, teams!inner(team_type)')
        .eq('name', cleanName)
        .eq('teams.team_type', 'University');

    if (aliases && aliases.length > 0) {
        const matching = aliases.find(a => {
            const start = a.start_year || 0;
            const end = a.end_year || 9999;
            return year >= start && year <= end;
        }) || aliases[0];
        if (matching) return matching.team_id;
    }

    // 2. Check primary
    const { data: primary } = await supabase
        .from('teams')
        .select('id')
        .eq('name', cleanName)
        .eq('team_type', 'University')
        .maybeSingle();

    if (primary) return primary.id;

    throw new Error(`University team not found: "${cleanName}"`);
}

async function run() {
    console.log('--- Syncing 5 Verified Early xpLosION Fixtures to Supabase ---');

    for (const f of FIXTURES) {
        console.log(`\nProcessing ${f.year} xpLosION: ${f.awayTeam} @ ${f.homeTeam} (${f.date})`);

        // 1. Competition
        const cleanComp = f.competitionName.trim();
        const slug = slugify(cleanComp);
        const { data: comp, error: compErr } = await supabase
            .from('competitions')
            .select('id, name')
            .or(`slug.eq.${slug},name.eq."${cleanComp}"`)
            .maybeSingle();

        if (compErr || !comp) throw new Error(`Competition "${cleanComp}" not found: ${compErr?.message}`);

        // 2. Season
        const { data: season, error: seasonErr } = await supabase
            .from('seasons')
            .select('id')
            .eq('competition_id', comp.id)
            .eq('year', f.year)
            .single();
        if (seasonErr || !season) throw new Error(`Season ${f.year} for "${f.competitionName}" not found: ${seasonErr?.message}`);

        // 3. Phase & Away Phase
        let phaseId = null;
        if (f.phaseName) {
            const { data: phase } = await supabase
                .from('phases')
                .select('id')
                .eq('season_id', season.id)
                .ilike('name', f.phaseName)
                .maybeSingle();
            if (phase) phaseId = phase.id;
        }
        let awayPhaseId = null;
        if (f.awayPhaseName) {
            const { data: awayPhase } = await supabase
                .from('phases')
                .select('id')
                .eq('season_id', season.id)
                .ilike('name', f.awayPhaseName)
                .maybeSingle();
            if (awayPhase) awayPhaseId = awayPhase.id;
        }

        // 4. Teams
        const homeTeamId = await resolveTeamId(f.homeTeam, f.year);
        const awayTeamId = await resolveTeamId(f.awayTeam, f.year);

        // 5. Check if game already exists
        const { data: existing } = await supabase
            .from('games')
            .select('id, nickname, home_score, away_score, notes')
            .eq('season_id', season.id)
            .eq('home_team_id', homeTeamId)
            .eq('away_team_id', awayTeamId)
            .eq('date', f.date)
            .maybeSingle();

        if (existing) {
            console.log(`  Updating existing game ${existing.id}...`);
            const { error: updErr } = await supabase
                .from('games')
                .update({
                    nickname: f.nickname,
                    home_score: f.homeScore,
                    away_score: f.awayScore,
                    notes: f.notes,
                    phase_id: phaseId || undefined,
                    away_phase_id: awayPhaseId || null
                })
                .eq('id', existing.id);
            if (updErr) console.error(`  Error updating game:`, updErr);
            else console.log(`  [✓] Updated game ${existing.id} with nickname = '${f.nickname}'`);
        } else {
            console.log(`  Inserting new game...`);
            const { data: inserted, error: insErr } = await supabase
                .from('games')
                .insert({
                    season_id: season.id,
                    phase_id: phaseId,
                    away_phase_id: awayPhaseId || null,
                    home_team_id: homeTeamId,
                    away_team_id: awayTeamId,
                    home_score: f.homeScore,
                    away_score: f.awayScore,
                    date: f.date,
                    date_precision: 'day',
                    date_display: f.dateDisplay,
                    time: f.time || null,
                    status: 'completed',
                    confidence_level: 'high',
                    is_playoff: false,
                    final_type: null,
                    title_name: null,
                    notes: f.notes,
                    nickname: f.nickname
                })
                .select()
                .single();

            if (insErr) console.error(`  Error inserting game:`, insErr);
            else console.log(`  [✓] Inserted new game ${inserted.id} (${f.awayTeam} ${f.awayScore} @ ${f.homeTeam} ${f.homeScore})`);
        }
    }

    console.log('\n--- Finished Syncing Verified xpLosION Games ---');
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
