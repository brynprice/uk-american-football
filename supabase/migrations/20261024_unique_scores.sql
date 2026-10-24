-- Migration: 20261024_unique_scores.sql
-- Description: Adds is_unique_score column to games with automatic trigger-based maintenance and initial backfill

-- 1. Add is_unique_score column
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS is_unique_score BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN games.is_unique_score IS 'True if no other non-anomaly, non-cancelled game in the archive ended with this exact symmetric final score combination (GREATEST/LEAST).';

-- 2. Indexes for fast score combination lookups and filtered queries
CREATE INDEX IF NOT EXISTS idx_games_score_combo ON games (
    GREATEST(home_score, away_score), 
    LEAST(home_score, away_score)
) WHERE home_score IS NOT NULL AND away_score IS NOT NULL AND status NOT IN ('anomaly', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_games_is_unique_score ON games (is_unique_score) 
WHERE is_unique_score = TRUE;

-- 3. Procedure to recalculate is_unique_score for a specific (high_score, low_score) pair
CREATE OR REPLACE FUNCTION update_unique_score_status(p_high INT, p_low INT) 
RETURNS VOID AS $$
DECLARE
    v_count INT;
    v_game_id UUID;
BEGIN
    IF p_high IS NULL OR p_low IS NULL THEN
        RETURN;
    END IF;

    -- Count eligible games with this symmetric score combination
    SELECT COUNT(*), MIN(id)
    INTO v_count, v_game_id
    FROM games
    WHERE home_score IS NOT NULL 
      AND away_score IS NOT NULL 
      AND status NOT IN ('anomaly', 'cancelled')
      AND GREATEST(home_score, away_score) = p_high
      AND LEAST(home_score, away_score) = p_low;

    IF v_count = 1 THEN
        -- Exactly 1 game has this score combination: mark it unique
        UPDATE games 
        SET is_unique_score = TRUE 
        WHERE id = v_game_id AND is_unique_score IS DISTINCT FROM TRUE;
    ELSIF v_count > 1 THEN
        -- Multiple games have this score combination: mark all non-unique
        UPDATE games 
        SET is_unique_score = FALSE 
        WHERE GREATEST(home_score, away_score) = p_high
          AND LEAST(home_score, away_score) = p_low
          AND is_unique_score IS DISTINCT FROM FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger function for INSERT, UPDATE, DELETE on games
CREATE OR REPLACE FUNCTION trg_recalculate_unique_scores()
RETURNS TRIGGER AS $$
BEGIN
    -- Check old score if UPDATE or DELETE
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        IF OLD.home_score IS NOT NULL AND OLD.away_score IS NOT NULL THEN
            PERFORM update_unique_score_status(
                GREATEST(OLD.home_score, OLD.away_score), 
                LEAST(OLD.home_score, OLD.away_score)
            );
        END IF;
    END IF;

    -- Check new score if INSERT or UPDATE
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        IF NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
            PERFORM update_unique_score_status(
                GREATEST(NEW.home_score, NEW.away_score), 
                LEAST(NEW.home_score, NEW.away_score)
            );
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_games_unique_score ON games;
CREATE TRIGGER trg_games_unique_score
AFTER INSERT OR UPDATE OF home_score, away_score, status OR DELETE
ON games
FOR EACH ROW
EXECUTE FUNCTION trg_recalculate_unique_scores();

-- 5. Initial backfill for existing games
WITH score_counts AS (
    SELECT 
        GREATEST(home_score, away_score) AS high_score,
        LEAST(home_score, away_score) AS low_score,
        COUNT(*) as cnt
    FROM games
    WHERE home_score IS NOT NULL 
      AND away_score IS NOT NULL 
      AND status NOT IN ('anomaly', 'cancelled')
    GROUP BY 1, 2
)
UPDATE games g
SET is_unique_score = (sc.cnt = 1)
FROM score_counts sc
WHERE GREATEST(g.home_score, g.away_score) = sc.high_score
  AND LEAST(g.home_score, g.away_score) = sc.low_score
  AND g.home_score IS NOT NULL
  AND g.away_score IS NOT NULL
  AND g.status NOT IN ('anomaly', 'cancelled');
