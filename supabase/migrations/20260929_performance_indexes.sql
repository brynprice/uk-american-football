-- Migration: Performance Indexes for Games, Staff, Participations, and Aliases
-- Resolves sequential table scans on the archive dataset.

-- 1. Games table indexes
CREATE INDEX IF NOT EXISTS idx_games_home_team_id ON public.games(home_team_id);
CREATE INDEX IF NOT EXISTS idx_games_away_team_id ON public.games(away_team_id);
CREATE INDEX IF NOT EXISTS idx_games_away_phase_id ON public.games(away_phase_id);
CREATE INDEX IF NOT EXISTS idx_games_final_type ON public.games(final_type) WHERE final_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_scores ON public.games(home_score, away_score);
CREATE INDEX IF NOT EXISTS idx_games_phase_date ON public.games(phase_id, date DESC);

-- 2. Game Staff table indexes
CREATE INDEX IF NOT EXISTS idx_game_staff_game_id ON public.game_staff(game_id);
CREATE INDEX IF NOT EXISTS idx_game_staff_person_id ON public.game_staff(person_id);
CREATE INDEX IF NOT EXISTS idx_game_staff_role ON public.game_staff(role);
CREATE INDEX IF NOT EXISTS idx_game_staff_lookup ON public.game_staff(game_id, team_id, role);

-- 3. Participations table indexes
CREATE INDEX IF NOT EXISTS idx_participations_team_id ON public.participations(team_id);
CREATE INDEX IF NOT EXISTS idx_participations_head_coach ON public.participations(head_coach_id);

-- 4. Team Aliases table index
CREATE INDEX IF NOT EXISTS idx_team_aliases_team_id ON public.team_aliases(team_id);

-- 5. Polymorphic Notes and Sources indexes
CREATE INDEX IF NOT EXISTS idx_notes_entity ON public.notes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sources_entity ON public.sources(entity_type, entity_id);
