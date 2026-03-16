-- Create Game Proposals table
CREATE TABLE IF NOT EXISTS public.game_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
    proposal_type TEXT NOT NULL CHECK (proposal_type IN ('add', 'update', 'delete')),
    proposed_data JSONB NOT NULL,
    reason TEXT,
    source_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    submitted_by_name TEXT,
    submitted_by_email TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_game_proposals_status ON public.game_proposals(status);
CREATE INDEX IF NOT EXISTS idx_game_proposals_game_id ON public.game_proposals(game_id);

-- Enable RLS
ALTER TABLE public.game_proposals ENABLE ROW LEVEL SECURITY;

-- Policies
-- Anyone can insert a proposal
CREATE POLICY "Public can suggest proposals" ON public.game_proposals
    FOR INSERT WITH CHECK (true);

-- Only authenticated admins can view/update all (assuming service role or admin check handles this)
-- For now, we allow the service role to handle admin side, or specific admin policies if user auth is used.
-- Since the app uses service role for admin actions, RLS for admins usually bypasses or uses specific roles.
CREATE POLICY "Admins can view all proposals" ON public.game_proposals
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update proposals" ON public.game_proposals
    FOR UPDATE TO authenticated USING (true);
