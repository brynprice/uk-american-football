-- Ensure the nickname column exists on the games table
ALTER TABLE games
ADD COLUMN IF NOT EXISTS nickname TEXT;

COMMENT ON COLUMN games.nickname IS 'Informal or historical nickname / special event name for the match (e.g., xpLosION, The Mud Bowl)';

-- Populate nickname = 'xpLosION' for all 14 Birmingham Lions xpLosION fixtures (2011–2026, including 2024)
UPDATE games
SET nickname = 'xpLosION'
WHERE id IN (
    'e88e9092-8d61-4d98-b19e-7dbf93e4d8ce', -- 2011-11-05: Nottingham Trent Renegades 6 @ Birmingham Lions 25
    '07e998fc-00a9-4993-b39d-4bbd2154fb81', -- 2013-11-03: Nottingham Trent Renegades 9 @ Birmingham Lions 16
    '20fe7db7-12ba-4e60-bebc-db3a0c7c194c', -- 2014-11-01: Hertfordshire Hurricanes 0 @ Birmingham Lions 23
    '3d46e610-0b58-44f7-aed5-6eea70592f17', -- 2015-11-07: Kingston Cougars 0 @ Birmingham Lions 36
    'a9a91ca2-ea2a-4514-90d8-923d0ada7b32', -- 2016-11-12: Bath Killer Bees 10 @ Birmingham Lions 7
    '48bcb5de-f4b6-4c23-a546-171ea9336df3', -- 2017-11-11: Portsmouth Destroyers 14 @ Birmingham Lions 39
    '3c26505c-4c4c-423c-9c93-2eab9c603847', -- 2018-11-24: Swansea Titans 20 @ Birmingham Lions 16
    'f9505d3b-4920-42f6-b0a9-ebd9f8bede56', -- 2019-11-09: Hertfordshire Hurricanes 0 @ Birmingham Lions 24
    '5ccff036-089f-429b-9c5e-d94f367e01f8', -- 2021-11-06: Swansea Titans 0 @ Birmingham Lions 41
    'd936e582-8cce-4d3b-81f0-a78b63244e2f', -- 2022-11-12: Cardiff Cobras 0 @ Birmingham Lions 20
    '8ecdf09f-6d7f-4391-bcbd-a783fdaa8716', -- 2023-11-04: Cardiff Cobras 17 @ Birmingham Lions 27
    '794b1480-94f4-425c-9ff6-19c70a673074', -- 2024-11-09: Cardiff Cobras 6 @ Birmingham Lions 27
    'a2331445-9185-4d13-a42d-ab344e4b10b6', -- 2025-11-08: Oxford Brookes University 6 @ Birmingham Lions 0
    '8dd212d7-dac2-4a3c-b302-38c276b09ec1'  -- 2026-11-07: Reading Knights @ Birmingham Lions
);

-- Update 2024 game notes to record that the xpLosION event was cancelled while the game was still played
UPDATE games
SET notes = 'The xpLosION event was cancelled, though the game was still played. Source: https://bucs.playwaze.com/american-football-24-25/community-details?Tab=Fixtures'
WHERE id = '794b1480-94f4-425c-9ff6-19c70a673074';
