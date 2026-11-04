-- Security RLS Hardening Migration
-- 1. Lock down game_proposals so all public submissions and admin reviews must pass through
--    validated server actions using the Service Role key (which bypasses RLS).
DROP POLICY IF EXISTS "Public can suggest proposals" ON public.game_proposals;
DROP POLICY IF EXISTS "Admins can view all proposals" ON public.game_proposals;
DROP POLICY IF EXISTS "Admins can update proposals" ON public.game_proposals;

-- 2. Restrict public read access on `notes` so internal writer poll ballots (which store
--    voter userId and voterName in JSON) are not publicly readable via the anon key.
DROP POLICY IF EXISTS "Public read access" ON public.notes;
CREATE POLICY "Public read access" ON public.notes
    FOR SELECT USING (entity_type <> 'writers_poll');
