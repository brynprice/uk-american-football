-- Add is_champion column to participations table
ALTER TABLE participations 
ADD COLUMN IF NOT EXISTS is_champion BOOLEAN DEFAULT false;
