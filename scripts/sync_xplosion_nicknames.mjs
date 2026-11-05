/**
 * Syncs the "xpLosION" game nickname across all 14 Birmingham Lions xpLosION fixtures (2011–2026)
 * and updates the 2024 fixture's notes to record that the xpLosION event was cancelled while the game was still played.
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

const XPLOSION_GAME_IDS = [
    'e88e9092-8d61-4d98-b19e-7dbf93e4d8ce', // 2011-11-05: Nottingham Trent Renegades 6 @ Birmingham Lions 25
    '07e998fc-00a9-4993-b39d-4bbd2154fb81', // 2013-11-03: Nottingham Trent Renegades 9 @ Birmingham Lions 16
    '20fe7db7-12ba-4e60-bebc-db3a0c7c194c', // 2014-11-01: Hertfordshire Hurricanes 0 @ Birmingham Lions 23
    '3d46e610-0b58-44f7-aed5-6eea70592f17', // 2015-11-07: Kingston Cougars 0 @ Birmingham Lions 36
    'a9a91ca2-ea2a-4514-90d8-923d0ada7b32', // 2016-11-12: Bath Killer Bees 10 @ Birmingham Lions 7
    '48bcb5de-f4b6-4c23-a546-171ea9336df3', // 2017-11-11: Portsmouth Destroyers 14 @ Birmingham Lions 39
    '3c26505c-4c4c-423c-9c93-2eab9c603847', // 2018-11-24: Swansea Titans 20 @ Birmingham Lions 16
    'f9505d3b-4920-42f6-b0a9-ebd9f8bede56', // 2019-11-09: Hertfordshire Hurricanes 0 @ Birmingham Lions 24
    '5ccff036-089f-429b-9c5e-d94f367e01f8', // 2021-11-06: Swansea Titans 0 @ Birmingham Lions 41
    'd936e582-8cce-4d3b-81f0-a78b63244e2f', // 2022-11-12: Cardiff Cobras 0 @ Birmingham Lions 20
    '8ecdf09f-6d7f-4391-bcbd-a783fdaa8716', // 2023-11-04: Cardiff Cobras 17 @ Birmingham Lions 27
    '794b1480-94f4-425c-9ff6-19c70a673074', // 2024-11-09: Cardiff Cobras 6 @ Birmingham Lions 27
    'a2331445-9185-4d13-a42d-ab344e4b10b6', // 2025-11-08: Oxford Brookes University 6 @ Birmingham Lions 0
    '8dd212d7-dac2-4a3c-b302-38c276b09ec1', // 2026-11-07: Reading Knights @ Birmingham Lions
];

const GAME_2024_ID = '794b1480-94f4-425c-9ff6-19c70a673074';
const GAME_2024_NOTES = 'The xpLosION event was cancelled, though the game was still played. Source: https://bucs.playwaze.com/american-football-24-25/community-details?Tab=Fixtures';

async function main() {
    console.log('1. Updating 2024 game notes in Supabase...');
    const { data: updated2024, error: notesErr } = await supabase
        .from('games')
        .update({ notes: GAME_2024_NOTES })
        .eq('id', GAME_2024_ID)
        .select('id, date, notes')
        .single();

    if (notesErr) {
        console.error('Failed to update 2024 game notes:', notesErr.message);
    } else {
        console.log('✓ Updated 2024 game notes:', updated2024);
    }

    // Also sync to the archival `notes` table if an entry exists for this game
    const { data: existingArchivalNote } = await supabase
        .from('notes')
        .select('id')
        .eq('entity_type', 'games')
        .eq('entity_id', GAME_2024_ID)
        .maybeSingle();

    if (existingArchivalNote) {
        await supabase
            .from('notes')
            .update({ content: GAME_2024_NOTES })
            .eq('id', existingArchivalNote.id);
        console.log('✓ Updated archival notes table entry for 2024 game.');
    }

    console.log('\n2. Checking if `games.nickname` column exists in Supabase...');
    const { error: colErr } = await supabase.from('games').select('nickname').limit(1);

    if (colErr) {
        console.warn('⚠️  Column `games.nickname` does not exist yet in the remote Supabase database.');
        console.warn('   Run `supabase/migrations/20261105_xplosion_nicknames.sql` in the Supabase SQL Editor to add the column and populate all 14 xpLosION games.');
        return;
    }

    console.log('3. Setting `nickname = "xpLosION"` on all 14 xpLosION games...');
    const { data: updatedGames, error: nickErr } = await supabase
        .from('games')
        .update({ nickname: 'xpLosION' })
        .in('id', XPLOSION_GAME_IDS)
        .select('id, date, nickname');

    if (nickErr) {
        console.error('Failed to update nicknames:', nickErr.message);
    } else {
        console.log(`✓ Updated ${updatedGames.length} games with nickname = "xpLosION".`);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
