-- Add format column to phases table for field/squad size formats (e.g., 11v11, 9v9, 7v7, 5v5)
ALTER TABLE phases
ADD COLUMN IF NOT EXISTS format TEXT
CHECK (format IS NULL OR format IN ('11v11', '9v9', '7v7', '5v5'));

COMMENT ON COLUMN phases.format IS 'On-field format / squad size for the phase (e.g., 11v11, 9v9, 7v7, 5v5). Primarily used in Women''s and Flag competitions.';

-- Populate format for NWFL phases
UPDATE phases
SET format = '9v9'
WHERE (
  name = 'Premiership'
  OR parent_phase_id IN (SELECT id FROM phases WHERE name = 'Premiership')
)
AND season_id IN (
  SELECT s.id FROM seasons s
  JOIN competitions c ON s.competition_id = c.id
  WHERE c.slug = 'nwfl'
);

UPDATE phases
SET format = '7v7'
WHERE (
  name = '7s'
  OR parent_phase_id IN (SELECT id FROM phases WHERE name = '7s')
)
AND season_id IN (
  SELECT s.id FROM seasons s
  JOIN competitions c ON s.competition_id = c.id
  WHERE c.slug = 'nwfl'
);
