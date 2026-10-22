-- Migration: Add unique index on predictions(game_id) to enable clean upserts
-- Only applies where game_id is NOT NULL (allowing ad-hoc unlinked custom matchups)

CREATE UNIQUE INDEX IF NOT EXISTS idx_predictions_game_id_unique 
ON predictions(game_id) 
WHERE game_id IS NOT NULL;
