-- Migration: Add game_type and season_id to games table for friendly game support
-- This allows games to occur outside of phases and be categorized.

-- 1. Create a temporary game_type column if we want an enum, or just use text with check
-- For simplicity and flexibility in migrations, we use TEXT with a CHECK constraint.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS game_type TEXT DEFAULT 'league' CHECK (game_type IN ('league', 'friendly', 'associate', 'varsity', 'old_boys')) NOT NULL;

-- 2. Add season_id column
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES public.seasons(id);

-- 3. Make phase_id nullable
ALTER TABLE public.games
  ALTER COLUMN phase_id DROP NOT NULL;

-- 4. Backfill season_id from phases
UPDATE public.games g
SET season_id = p.season_id
FROM public.phases p
WHERE g.phase_id = p.id;

-- 5. Add index for performance on season-level queries
CREATE INDEX IF NOT EXISTS idx_games_season_id ON public.games(season_id);
CREATE INDEX IF NOT EXISTS idx_games_game_type ON public.games(game_type);

COMMENT ON COLUMN public.games.game_type IS 'Category of the game: league (default), friendly, associate, varsity, or old_boys.';
COMMENT ON COLUMN public.games.season_id IS 'Associated season. Required for friendlies that occur outside of phases.';
