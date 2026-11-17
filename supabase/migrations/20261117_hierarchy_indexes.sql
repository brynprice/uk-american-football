-- Migration: 20261117_hierarchy_indexes.sql
-- Description: Adds indexes on frequently queried foreign keys across participations, phases, and seasons
-- to eliminate sequential table scans in timeline, standings, and hierarchical joins.

-- 1. Index on participations.phase_id for fast standing and phase lookups
CREATE INDEX IF NOT EXISTS idx_participations_phase_id ON public.participations(phase_id);

-- 2. Index on phases.season_id and parent_phase_id for fast tree traversal
CREATE INDEX IF NOT EXISTS idx_phases_season_id ON public.phases(season_id);
CREATE INDEX IF NOT EXISTS idx_phases_parent_phase_id ON public.phases(parent_phase_id) WHERE parent_phase_id IS NOT NULL;

-- 3. Index on seasons.competition_id for fast competition-scoped lookups
CREATE INDEX IF NOT EXISTS idx_seasons_competition_id ON public.seasons(competition_id);
