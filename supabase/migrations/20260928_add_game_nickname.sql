-- Add nickname column to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS nickname TEXT;

COMMENT ON COLUMN games.nickname IS 'Informal or historical nickname for the match (e.g., The Mud Bowl)';
