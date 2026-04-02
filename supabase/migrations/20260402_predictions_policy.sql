-- Fix prediction recording failure
-- Allow public (anonymous) inserts to the predictions table 
-- consistent with the game_proposals table and the admin client-side use

CREATE POLICY "Public can insert predictions" ON public.predictions
    FOR INSERT WITH CHECK (true);