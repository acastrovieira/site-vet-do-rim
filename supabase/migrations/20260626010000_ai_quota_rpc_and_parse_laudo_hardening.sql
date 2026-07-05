-- Atomic AI quota increment used by the parse-laudo Edge Function.
-- Direct client calls can only increment the caller's own quota; the Edge
-- Function may call it with service_role for trusted server-side processing.

CREATE OR REPLACE FUNCTION public.increment_ai_quota(user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
  new_usage integer;
BEGIN
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF caller_role <> 'service_role' AND (SELECT auth.uid()) IS DISTINCT FROM user_id THEN
    RAISE EXCEPTION 'not allowed to increment this quota';
  END IF;

  UPDATE public.profiles
     SET ai_quota_used = COALESCE(ai_quota_used, 0) + 1
   WHERE id = user_id
     AND COALESCE(ai_quota_used, 0) < COALESCE(ai_quota_limit, 5)
   RETURNING ai_quota_used INTO new_usage;

  IF new_usage IS NULL THEN
    RAISE EXCEPTION 'profile not found or quota limit reached';
  END IF;

  RETURN new_usage;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_ai_quota(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_ai_quota(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_quota(uuid) TO service_role;
