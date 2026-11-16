-- Durable per-client rate limiting for anonymous game proposals
CREATE TABLE IF NOT EXISTS public.proposal_rate_limits (
    client_hash TEXT PRIMARY KEY,
    request_count INT NOT NULL DEFAULT 1,
    window_expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.proposal_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_proposal_rate_limit(
    p_client_hash TEXT,
    p_max_requests INT DEFAULT 10,
    p_window_seconds INT DEFAULT 600
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_count INT;
BEGIN
    DELETE FROM public.proposal_rate_limits
    WHERE window_expires_at < v_now
      AND ctid IN (
          SELECT ctid FROM public.proposal_rate_limits
          WHERE window_expires_at < v_now
          LIMIT 100
      );

    INSERT INTO public.proposal_rate_limits (client_hash, request_count, window_expires_at)
    VALUES (p_client_hash, 1, v_now + make_interval(secs => p_window_seconds))
    ON CONFLICT (client_hash) DO UPDATE
    SET
        request_count = CASE
            WHEN proposal_rate_limits.window_expires_at <= v_now THEN 1
            ELSE proposal_rate_limits.request_count + 1
        END,
        window_expires_at = CASE
            WHEN proposal_rate_limits.window_expires_at <= v_now THEN v_now + make_interval(secs => p_window_seconds)
            ELSE proposal_rate_limits.window_expires_at
        END
    RETURNING request_count INTO v_count;

    RETURN v_count <= p_max_requests;
END;
$$;

REVOKE ALL ON FUNCTION public.check_proposal_rate_limit(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_proposal_rate_limit(TEXT, INT, INT) TO service_role;
