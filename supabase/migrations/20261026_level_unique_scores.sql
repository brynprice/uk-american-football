-- Migration: 20261026_level_unique_scores.sql
-- Description: Adds level-specific uniqueness (Adult, University, etc.) and totally unique score tracking to games

-- 1. Add game_level and is_totally_unique columns if they do not exist
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS game_level TEXT DEFAULT 'Adult',
ADD COLUMN IF NOT EXISTS is_totally_unique BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN games.game_level IS 'Classification of football level: Adult, University, Womens, Flag, U19s.';
COMMENT ON COLUMN games.is_unique_score IS 'True if no other non-anomaly, non-cancelled game at this same game_level ended with this exact symmetric final score combination (GREATEST/LEAST).';
COMMENT ON COLUMN games.is_totally_unique IS 'True if no other non-anomaly, non-cancelled game across ALL levels ended with this exact symmetric final score combination.';

-- 2. Backfill game_level for existing games based on competition level or team type
WITH game_levels AS (
    SELECT 
        g_inner.id AS game_id,
        CASE 
            WHEN c.level IN ('Uniball', 'University') THEN 'University'
            WHEN c.level IN ('Adult Contact', 'Adult') THEN 'Adult'
            WHEN c.level IN ('Womens', 'Women') THEN 'Womens'
            WHEN ht.team_type IS NOT NULL THEN ht.team_type
            WHEN at.team_type IS NOT NULL THEN at.team_type
            ELSE 'Adult'
        END AS resolved_level
    FROM games g_inner
    LEFT JOIN phases p ON p.id = g_inner.phase_id
    LEFT JOIN seasons s ON s.id = COALESCE(p.season_id, g_inner.season_id)
    LEFT JOIN competitions c ON c.id = s.competition_id
    LEFT JOIN teams ht ON ht.id = g_inner.home_team_id
    LEFT JOIN teams at ON at.id = g_inner.away_team_id
)
UPDATE games g
SET game_level = gl.resolved_level
FROM game_levels gl
WHERE g.id = gl.game_id;

-- 3. Indexes for fast score combination lookups and level-filtered queries
CREATE INDEX IF NOT EXISTS idx_games_level_score_combo ON games (
    game_level,
    GREATEST(home_score, away_score), 
    LEAST(home_score, away_score)
) WHERE home_score IS NOT NULL AND away_score IS NOT NULL AND status NOT IN ('anomaly', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_games_is_unique_score ON games (is_unique_score) 
WHERE is_unique_score = TRUE;

CREATE INDEX IF NOT EXISTS idx_games_is_totally_unique ON games (is_totally_unique) 
WHERE is_totally_unique = TRUE;

CREATE INDEX IF NOT EXISTS idx_games_game_level ON games (game_level);

-- 4. Procedure to recalculate uniqueness for a specific (game_level, high_score, low_score) and overall (high_score, low_score)
CREATE OR REPLACE FUNCTION update_level_unique_score_status(p_level TEXT, p_high INT, p_low INT) 
RETURNS VOID AS $$
DECLARE
    v_level_count INT;
    v_total_count INT;
    v_level_game_id UUID;
    v_total_game_id UUID;
BEGIN
    IF p_high IS NULL OR p_low IS NULL THEN
        RETURN;
    END IF;

    -- A. Update Level Uniqueness for (p_level, p_high, p_low)
    IF p_level IS NOT NULL THEN
        SELECT COUNT(*)
        INTO v_level_count
        FROM games
        WHERE home_score IS NOT NULL 
          AND away_score IS NOT NULL 
          AND status NOT IN ('anomaly', 'cancelled')
          AND game_level = p_level
          AND GREATEST(home_score, away_score) = p_high
          AND LEAST(home_score, away_score) = p_low;

        IF v_level_count = 1 THEN
            SELECT id
            INTO v_level_game_id
            FROM games
            WHERE home_score IS NOT NULL 
              AND away_score IS NOT NULL 
              AND status NOT IN ('anomaly', 'cancelled')
              AND game_level = p_level
              AND GREATEST(home_score, away_score) = p_high
              AND LEAST(home_score, away_score) = p_low
            LIMIT 1;

            UPDATE games 
            SET is_unique_score = TRUE 
            WHERE id = v_level_game_id AND is_unique_score IS DISTINCT FROM TRUE;
        ELSIF v_level_count > 1 THEN
            UPDATE games 
            SET is_unique_score = FALSE 
            WHERE game_level = p_level
              AND GREATEST(home_score, away_score) = p_high
              AND LEAST(home_score, away_score) = p_low
              AND is_unique_score IS DISTINCT FROM FALSE;
        END IF;
    END IF;

    -- B. Update Totally Unique (Across ALL levels) for (p_high, p_low)
    SELECT COUNT(*)
    INTO v_total_count
    FROM games
    WHERE home_score IS NOT NULL 
      AND away_score IS NOT NULL 
      AND status NOT IN ('anomaly', 'cancelled')
      AND GREATEST(home_score, away_score) = p_high
      AND LEAST(home_score, away_score) = p_low;

    IF v_total_count = 1 THEN
        SELECT id
        INTO v_total_game_id
        FROM games
        WHERE home_score IS NOT NULL 
          AND away_score IS NOT NULL 
          AND status NOT IN ('anomaly', 'cancelled')
          AND GREATEST(home_score, away_score) = p_high
          AND LEAST(home_score, away_score) = p_low
        LIMIT 1;

        UPDATE games 
        SET is_totally_unique = TRUE 
        WHERE id = v_total_game_id AND is_totally_unique IS DISTINCT FROM TRUE;
    ELSIF v_total_count > 1 THEN
        UPDATE games 
        SET is_totally_unique = FALSE 
        WHERE GREATEST(home_score, away_score) = p_high
          AND LEAST(home_score, away_score) = p_low
          AND is_totally_unique IS DISTINCT FROM FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger function for INSERT, UPDATE, DELETE on games
CREATE OR REPLACE FUNCTION trg_recalculate_unique_scores()
RETURNS TRIGGER AS $$
BEGIN
    -- Automatic level assignment on INSERT or UPDATE if game_level is null
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.game_level IS NULL THEN
            IF NEW.phase_id IS NOT NULL THEN
                SELECT 
                    CASE 
                        WHEN c.level IN ('Uniball', 'University') THEN 'University'
                        WHEN c.level IN ('Adult Contact', 'Adult') THEN 'Adult'
                        WHEN c.level IN ('Womens', 'Women') THEN 'Womens'
                        WHEN ht.team_type IS NOT NULL THEN ht.team_type
                        ELSE 'Adult'
                    END
                INTO NEW.game_level
                FROM phases p
                JOIN seasons s ON s.id = p.season_id
                JOIN competitions c ON c.id = s.competition_id
                LEFT JOIN teams ht ON ht.id = NEW.home_team_id
                WHERE p.id = NEW.phase_id;
            END IF;

            IF NEW.game_level IS NULL AND NEW.home_team_id IS NOT NULL THEN
                SELECT team_type INTO NEW.game_level FROM teams WHERE id = NEW.home_team_id;
            END IF;

            IF NEW.game_level IS NULL THEN
                NEW.game_level := 'Adult';
            END IF;
        END IF;
    END IF;

    -- Check old score if UPDATE or DELETE
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        IF OLD.home_score IS NOT NULL AND OLD.away_score IS NOT NULL THEN
            PERFORM update_level_unique_score_status(
                OLD.game_level,
                GREATEST(OLD.home_score, OLD.away_score), 
                LEAST(OLD.home_score, OLD.away_score)
            );
        END IF;
    END IF;

    -- Check new score if INSERT or UPDATE
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        IF NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
            PERFORM update_level_unique_score_status(
                NEW.game_level,
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
AFTER INSERT OR UPDATE OF home_score, away_score, status, game_level OR DELETE
ON games
FOR EACH ROW
EXECUTE FUNCTION trg_recalculate_unique_scores();

-- 6. Initial backfill for all existing games
-- A. Mark level-unique games
WITH level_counts AS (
    SELECT 
        game_level,
        GREATEST(home_score, away_score) AS high_score,
        LEAST(home_score, away_score) AS low_score,
        COUNT(*) as cnt
    FROM games
    WHERE home_score IS NOT NULL 
      AND away_score IS NOT NULL 
      AND status NOT IN ('anomaly', 'cancelled')
    GROUP BY 1, 2, 3
)
UPDATE games g
SET is_unique_score = (lc.cnt = 1)
FROM level_counts lc
WHERE g.game_level = lc.game_level
  AND GREATEST(g.home_score, g.away_score) = lc.high_score
  AND LEAST(g.home_score, g.away_score) = lc.low_score
  AND g.home_score IS NOT NULL
  AND g.away_score IS NOT NULL
  AND g.status NOT IN ('anomaly', 'cancelled');

-- B. Mark totally unique games (across all levels)
WITH total_counts AS (
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
SET is_totally_unique = (tc.cnt = 1)
FROM total_counts tc
WHERE GREATEST(g.home_score, g.away_score) = tc.high_score
  AND LEAST(g.home_score, g.away_score) = tc.low_score
  AND g.home_score IS NOT NULL
  AND g.away_score IS NOT NULL
  AND g.status NOT IN ('anomaly', 'cancelled');
