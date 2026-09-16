-- Add team_type column to teams table
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS team_type TEXT DEFAULT 'Adult' 
CHECK (team_type IS NULL OR team_type IN ('Adult', 'Womens', 'University', 'Flag', 'U19s'));
