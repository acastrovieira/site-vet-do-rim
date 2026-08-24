BEGIN;
SELECT plan(13);

SELECT ok(
  to_regclass('private.clinical_rate_limit_windows') IS NOT NULL,
  'distributed rate-limit table exists in the private schema'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'private.clinical_rate_limit_windows'::regclass),
  'rate-limit state has RLS enabled'
);

SELECT ok(
  NOT has_table_privilege('anon', 'private.clinical_rate_limit_windows', 'SELECT'),
  'anon cannot read rate-limit state'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'private.clinical_rate_limit_windows', 'SELECT'),
  'authenticated cannot read rate-limit state'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.consume_clinical_rate_limit(text)', 'EXECUTE'),
  'authenticated can consume the rate-limit RPC'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.consume_clinical_rate_limit(text)', 'EXECUTE'),
  'anon cannot consume the rate-limit RPC'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.consume_clinical_rate_limit(text)'::regprocedure),
  'rate-limit RPC is security definer'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc AS p
    CROSS JOIN LATERAL unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS setting
    WHERE p.oid = 'public.consume_clinical_rate_limit(text)'::regprocedure
      AND setting = 'search_path=pg_catalog, private, auth'
  ),
  'rate-limit RPC fixes its search path'
);

CREATE TEMP TABLE rate_limit_attempts (
  attempt integer PRIMARY KEY,
  allowed boolean NOT NULL,
  retry_after_seconds integer NOT NULL
) ON COMMIT DROP;

SELECT set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

DO $$
DECLARE
  current_attempt integer;
  outcome record;
BEGIN
  FOR current_attempt IN 1..11 LOOP
    SELECT * INTO STRICT outcome
    FROM public.consume_clinical_rate_limit('laudo_reserve');

    INSERT INTO rate_limit_attempts (attempt, allowed, retry_after_seconds)
    VALUES (current_attempt, outcome.allowed, outcome.retry_after_seconds);
  END LOOP;
END;
$$;

SELECT is(
  (SELECT count(*) FROM rate_limit_attempts WHERE allowed),
  10::bigint,
  'reserve allows exactly ten requests in one fixed window'
);

SELECT is(
  (SELECT allowed FROM rate_limit_attempts WHERE attempt = 11),
  false,
  'reserve blocks the eleventh request for the same actor'
);

SELECT cmp_ok(
  (SELECT retry_after_seconds FROM rate_limit_attempts WHERE attempt = 11),
  '>=',
  1,
  'a blocked request returns a positive retry interval'
);

SELECT set_config(
  'request.jwt.claim.sub',
  '20000000-0000-4000-8000-000000000002',
  true
);

SELECT is(
  (SELECT allowed FROM public.consume_clinical_rate_limit('laudo_reserve')),
  true,
  'a different authenticated actor has an independent counter'
);

SELECT throws_ok(
  $$ SELECT * FROM public.consume_clinical_rate_limit('scope_controlled_by_client') $$,
  '22023',
  'invalid_rate_limit_scope',
  'the RPC rejects scopes outside the server allowlist'
);

SELECT * FROM finish();
ROLLBACK;
