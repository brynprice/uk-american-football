-- Migration: Add away_phase_id to games table for inter-phase game support
-- When a game is played between teams from different phases (e.g. Div 1 Southern vs Div 1 South Western),
-- this column stores the away team's phase. The home team's phase is always stored in phase_id.

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS away_phase_id UUID REFERENCES phases(id) ON DELETE SET NULL;

COMMENT ON COLUMN games.away_phase_id IS 'Only populated for inter-phase games. Stores the away team''s phase when it differs from the home team''s phase (phase_id).';
