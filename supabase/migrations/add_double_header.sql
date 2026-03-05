-- Add is_double_header column to games table
ALTER TABLE games ADD COLUMN is_double_header BOOLEAN DEFAULT false;
