-- Revoke open public insert policy on predictions table now that
-- predictions are securely created through authenticated server actions.

DROP POLICY IF EXISTS "Public can insert predictions" ON public.predictions;
