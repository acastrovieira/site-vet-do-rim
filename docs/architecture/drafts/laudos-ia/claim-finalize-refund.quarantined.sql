-- ============================================================================
-- QUARANTINED ARCHITECTURE DRAFT — AUDIT-001
-- DO NOT COPY TO supabase/migrations. DO NOT RUN IN ANY CONNECTED PROJECT.
--
-- Safety is intentional and redundant:
--   1. this file is outside supabase/migrations;
--   2. the first executable block always raises;
--   3. every statement is inside a transaction ending in ROLLBACK.
--
-- Target prerequisites do NOT exist in the current schema:
--   public.clinics
--   public.clinic_memberships
--   public.laudos_pdf.clinic_id
--   public.pets.clinic_id
-- See README.md and ADR-001 before reviewing this SQL.
-- ============================================================================

BEGIN;

DO $quarantine$
BEGIN
  RAISE EXCEPTION
    USING
      ERRCODE = 'P0001',
      MESSAGE = 'QUARANTINED_DRAFT: approval, tenancy migrations and ephemeral validation required';
END
$quarantine$;

-- Everything below is unreachable until a DBA deliberately creates a new,
-- reviewed migration from this design. Even after removing the sentinel, this
-- draft ends in ROLLBACK and cannot persist changes as-is.

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

-- --------------------------------------------------------------------------
-- Contract preflight. Column/literal decisions remain provisional.
-- --------------------------------------------------------------------------

DO $preflight$
BEGIN
  IF pg_catalog.to_regclass('public.clinics') IS NULL THEN
    RAISE EXCEPTION 'missing prerequisite: public.clinics';
  END IF;

  IF pg_catalog.to_regclass('public.clinic_memberships') IS NULL THEN
    RAISE EXCEPTION 'missing prerequisite: public.clinic_memberships';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'laudos_pdf'
      AND c.column_name = 'clinic_id'
      AND c.data_type = 'uuid'
  ) THEN
    RAISE EXCEPTION 'missing prerequisite: public.laudos_pdf.clinic_id uuid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'pets'
      AND c.column_name = 'clinic_id'
      AND c.data_type = 'uuid'
  ) THEN
    RAISE EXCEPTION 'missing prerequisite: public.pets.clinic_id uuid';
  END IF;
END
$preflight$;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- --------------------------------------------------------------------------
-- Private state. No clinical payload, filename, path, prompt or provider body
-- is stored in the event table.
-- --------------------------------------------------------------------------

CREATE TABLE private.laudo_ia_claims (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  laudo_id uuid NOT NULL REFERENCES public.laudos_pdf(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  claim_token uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  state text NOT NULL
    CHECK (state IN ('processing', 'retryable_error', 'completed', 'terminal_error')),
  quota_state text NOT NULL
    CHECK (quota_state IN ('reserved', 'consumed', 'refunded')),
  attempt_count smallint NOT NULL
    CHECK (attempt_count BETWEEN 1 AND 3),
  lease_expires_at timestamptz,
  provider_code text
    CHECK (provider_code IS NULL OR provider_code IN ('gemini', 'openai')),
  error_code text
    CHECK (error_code IS NULL OR error_code IN (
      'provider_timeout',
      'provider_rate_limited',
      'provider_unavailable',
      'provider_rejected',
      'storage_missing',
      'invalid_pdf',
      'invalid_provider_response',
      'invalid_result_schema',
      'result_too_large',
      'worker_crashed',
      'internal_processing_error',
      'attempts_exhausted'
    )),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  completed_at timestamptz,
  CONSTRAINT laudo_ia_claims_idempotency_uniq
    UNIQUE (clinic_id, actor_user_id, idempotency_key),
  CONSTRAINT laudo_ia_claims_state_quota_consistency
    CHECK (
      (state = 'completed' AND quota_state = 'consumed' AND completed_at IS NOT NULL)
      OR (state = 'terminal_error' AND quota_state = 'refunded')
      OR (state IN ('processing', 'retryable_error') AND quota_state = 'reserved')
    ),
  CONSTRAINT laudo_ia_claims_lease_consistency
    CHECK (
      (state = 'processing' AND lease_expires_at IS NOT NULL)
      OR state <> 'processing'
    )
);

CREATE UNIQUE INDEX laudo_ia_claims_one_open_reservation_per_laudo_idx
  ON private.laudo_ia_claims (laudo_id)
  WHERE state IN ('processing', 'retryable_error')
    AND quota_state = 'reserved';

CREATE INDEX laudo_ia_claims_actor_idx
  ON private.laudo_ia_claims (actor_user_id);

CREATE INDEX laudo_ia_claims_clinic_laudo_idx
  ON private.laudo_ia_claims (clinic_id, laudo_id);

CREATE INDEX laudo_ia_claims_expired_lease_idx
  ON private.laudo_ia_claims (lease_expires_at, id)
  WHERE state = 'processing';

CREATE TABLE private.laudo_ia_claim_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  claim_id uuid NOT NULL REFERENCES private.laudo_ia_claims(id) ON DELETE RESTRICT,
  event_code text NOT NULL
    CHECK (event_code IN (
      'claimed',
      'reclaimed',
      'finalized',
      'retryable_error',
      'refunded',
      'attempts_exhausted'
    )),
  attempt_count smallint NOT NULL CHECK (attempt_count BETWEEN 1 AND 3),
  error_code text
    CHECK (error_code IS NULL OR error_code IN (
      'provider_timeout',
      'provider_rate_limited',
      'provider_unavailable',
      'provider_rejected',
      'storage_missing',
      'invalid_pdf',
      'invalid_provider_response',
      'invalid_result_schema',
      'result_too_large',
      'worker_crashed',
      'internal_processing_error',
      'attempts_exhausted'
    )),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

CREATE INDEX laudo_ia_claim_events_claim_created_idx
  ON private.laudo_ia_claim_events (claim_id, created_at);

CREATE UNIQUE INDEX laudo_ia_claim_events_one_finalized_idx
  ON private.laudo_ia_claim_events (claim_id)
  WHERE event_code = 'finalized';

CREATE UNIQUE INDEX laudo_ia_claim_events_one_refunded_idx
  ON private.laudo_ia_claim_events (claim_id)
  WHERE event_code IN ('refunded', 'attempts_exhausted');

REVOKE ALL ON TABLE private.laudo_ia_claims FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE private.laudo_ia_claim_events FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE private.laudo_ia_claim_events_id_seq FROM PUBLIC, anon, authenticated, service_role;

-- --------------------------------------------------------------------------
-- Claim. actor_user_id comes from auth.getUser(jwt) in the Edge Function, never
-- from the browser. Only service_role can call this function, and membership is
-- revalidated here. This avoids weakening the existing profile quota trigger.
-- The supplied clinic remains context, not authority.
-- Locks are short and no external work occurs here.
-- Lock order for an existing job: claim -> laudo -> profile.
-- Lock order for a new job: laudo -> profile (there is no claim yet).
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.claim_laudo_ia(
  p_clinic_id uuid,
  p_actor_user_id uuid,
  p_laudo_id uuid,
  p_idempotency_key uuid
)
RETURNS TABLE (
  claim_id uuid,
  claim_token uuid,
  disposition text,
  attempt_count smallint,
  lease_expires_at timestamptz,
  storage_bucket text,
  storage_path text,
  quota_used integer,
  quota_limit integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_claim record;
  v_laudo record;
  v_expected_path text;
  v_quota_used integer;
  v_quota_limit integer;
  v_quota_reset_date timestamptz;
  v_new_token uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_lease_interval interval := interval '90 seconds';
  v_request_role text := COALESCE(
    NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    (SELECT auth.jwt() ->> 'role'),
    ''
  );
BEGIN
  IF v_request_role <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'service_role_required';
  END IF;

  IF p_clinic_id IS NULL
    OR p_actor_user_id IS NULL
    OR p_laudo_id IS NULL
    OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_request';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clinics AS c
    JOIN public.clinic_memberships AS m
      ON m.clinic_id = c.id
    WHERE c.id = p_clinic_id
      AND c.status = 'active'
      AND m.user_id = p_actor_user_id
      AND m.status = 'active'
      AND m.role IN ('vet', 'clinic_admin')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'laudo_not_found';
  END IF;

  SELECT c.*
  INTO v_claim
  FROM private.laudo_ia_claims AS c
  WHERE c.clinic_id = p_clinic_id
    AND c.actor_user_id = p_actor_user_id
    AND c.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_claim.laudo_id <> p_laudo_id THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'idempotency_conflict';
    END IF;

    SELECT
      l.id,
      l.status,
      l.storage_path
    INTO v_laudo
    FROM public.laudos_pdf AS l
    JOIN public.pets AS p
      ON p.id = l.pet_id
     AND p.clinic_id = l.clinic_id
    WHERE l.id = v_claim.laudo_id
      AND l.clinic_id = v_claim.clinic_id
    FOR UPDATE OF l;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'laudo_not_found';
    END IF;

    v_expected_path := pg_catalog.format(
      'clinics/%s/laudos/%s/original.pdf',
      v_claim.clinic_id,
      v_claim.laudo_id
    );

    IF v_laudo.storage_path IS DISTINCT FROM v_expected_path THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'path_mismatch';
    END IF;

    SELECT
      p.ai_quota_used,
      p.ai_quota_limit,
      p.ai_quota_reset_date
    INTO
      v_quota_used,
      v_quota_limit,
      v_quota_reset_date
    FROM public.profiles AS p
    WHERE p.id = p_actor_user_id
    FOR UPDATE;

    IF NOT FOUND OR v_quota_used IS NULL OR v_quota_limit IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'quota_not_configured';
    END IF;

    IF v_claim.state = 'completed' AND v_claim.quota_state = 'consumed' THEN
      RETURN QUERY
      SELECT
        v_claim.id,
        NULL::uuid,
        'already_completed'::text,
        v_claim.attempt_count,
        v_claim.lease_expires_at,
        'laudos'::text,
        v_laudo.storage_path,
        v_quota_used,
        v_quota_limit;
      RETURN;
    END IF;

    IF v_claim.state = 'terminal_error' AND v_claim.quota_state = 'refunded' THEN
      RETURN QUERY
      SELECT
        v_claim.id,
        NULL::uuid,
        'terminal'::text,
        v_claim.attempt_count,
        v_claim.lease_expires_at,
        NULL::text,
        NULL::text,
        v_quota_used,
        v_quota_limit;
      RETURN;
    END IF;

    IF v_claim.state = 'processing' AND v_claim.lease_expires_at > v_now THEN
      RETURN QUERY
      SELECT
        v_claim.id,
        NULL::uuid,
        'processing'::text,
        v_claim.attempt_count,
        v_claim.lease_expires_at,
        NULL::text,
        NULL::text,
        v_quota_used,
        v_quota_limit;
      RETURN;
    END IF;

    IF v_claim.state NOT IN ('processing', 'retryable_error')
      OR v_claim.quota_state <> 'reserved' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid_claim_state';
    END IF;

    IF v_claim.attempt_count >= 3 THEN
      UPDATE public.profiles AS p
      SET ai_quota_used = p.ai_quota_used - 1
      WHERE p.id = p_actor_user_id
        AND p.ai_quota_used > 0
      RETURNING p.ai_quota_used, p.ai_quota_limit
      INTO v_quota_used, v_quota_limit;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'quota_state_inconsistent';
      END IF;

      UPDATE private.laudo_ia_claims AS c
      SET
        state = 'terminal_error',
        quota_state = 'refunded',
        lease_expires_at = NULL,
        error_code = 'attempts_exhausted',
        updated_at = v_now
      WHERE c.id = v_claim.id;

      UPDATE public.laudos_pdf AS l
      SET
        status = 'erro',
        erro_ia = 'attempts_exhausted'
      WHERE l.id = v_claim.laudo_id
        AND l.clinic_id = v_claim.clinic_id;

      INSERT INTO private.laudo_ia_claim_events (
        claim_id,
        event_code,
        attempt_count,
        error_code
      )
      VALUES (
        v_claim.id,
        'attempts_exhausted',
        v_claim.attempt_count,
        'attempts_exhausted'
      );

      RETURN QUERY
      SELECT
        v_claim.id,
        NULL::uuid,
        'attempts_exhausted'::text,
        v_claim.attempt_count,
        NULL::timestamptz,
        NULL::text,
        NULL::text,
        v_quota_used,
        v_quota_limit;
      RETURN;
    END IF;

    v_new_token := pg_catalog.gen_random_uuid();

    UPDATE private.laudo_ia_claims AS c
    SET
      claim_token = v_new_token,
      state = 'processing',
      attempt_count = c.attempt_count + 1,
      lease_expires_at = v_now + v_lease_interval,
      error_code = NULL,
      updated_at = v_now
    WHERE c.id = v_claim.id
    RETURNING c.* INTO v_claim;

    UPDATE public.laudos_pdf AS l
    SET
      status = 'processando',
      erro_ia = NULL
    WHERE l.id = v_claim.laudo_id
      AND l.clinic_id = v_claim.clinic_id;

    INSERT INTO private.laudo_ia_claim_events (
      claim_id,
      event_code,
      attempt_count
    )
    VALUES (
      v_claim.id,
      'reclaimed',
      v_claim.attempt_count
    );

    RETURN QUERY
    SELECT
      v_claim.id,
      v_claim.claim_token,
      'reclaimed'::text,
      v_claim.attempt_count,
      v_claim.lease_expires_at,
      'laudos'::text,
      v_laudo.storage_path,
      v_quota_used,
      v_quota_limit;
    RETURN;
  END IF;

  SELECT
    l.id,
    l.status,
    l.storage_path
  INTO v_laudo
  FROM public.laudos_pdf AS l
  JOIN public.pets AS p
    ON p.id = l.pet_id
   AND p.clinic_id = l.clinic_id
  WHERE l.id = p_laudo_id
    AND l.clinic_id = p_clinic_id
  FOR UPDATE OF l;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'laudo_not_found';
  END IF;

  v_expected_path := pg_catalog.format(
    'clinics/%s/laudos/%s/original.pdf',
    p_clinic_id,
    p_laudo_id
  );

  IF v_laudo.storage_path IS DISTINCT FROM v_expected_path THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'path_mismatch';
  END IF;

  -- A concurrent request may have missed the uncommitted claim before waiting
  -- on the laudo row. Re-read with a fresh READ COMMITTED statement snapshot.
  IF v_laudo.status = 'processando' THEN
    SELECT c.*
    INTO v_claim
    FROM private.laudo_ia_claims AS c
    WHERE c.clinic_id = p_clinic_id
      AND c.actor_user_id = p_actor_user_id
      AND c.laudo_id = p_laudo_id
      AND c.idempotency_key = p_idempotency_key;

    IF FOUND AND v_claim.state = 'processing' THEN
      SELECT p.ai_quota_used, p.ai_quota_limit
      INTO v_quota_used, v_quota_limit
      FROM public.profiles AS p
      WHERE p.id = p_actor_user_id;

      RETURN QUERY
      SELECT
        v_claim.id,
        NULL::uuid,
        'processing'::text,
        v_claim.attempt_count,
        v_claim.lease_expires_at,
        NULL::text,
        NULL::text,
        v_quota_used,
        v_quota_limit;
      RETURN;
    END IF;

    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'already_processing';
  END IF;

  IF v_laudo.status = 'concluido' THEN
    SELECT p.ai_quota_used, p.ai_quota_limit
    INTO v_quota_used, v_quota_limit
    FROM public.profiles AS p
    WHERE p.id = p_actor_user_id;

    RETURN QUERY
    SELECT
      NULL::uuid,
      NULL::uuid,
      'already_completed'::text,
      0::smallint,
      NULL::timestamptz,
      'laudos'::text,
      v_laudo.storage_path,
      v_quota_used,
      v_quota_limit;
    RETURN;
  END IF;

  IF v_laudo.status NOT IN ('pendente', 'erro') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'already_processing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM private.laudo_ia_claims AS c
    WHERE c.laudo_id = p_laudo_id
      AND c.state IN ('processing', 'retryable_error')
      AND c.quota_state = 'reserved'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'already_processing';
  END IF;

  SELECT
    p.ai_quota_used,
    p.ai_quota_limit,
    p.ai_quota_reset_date
  INTO
    v_quota_used,
    v_quota_limit,
    v_quota_reset_date
  FROM public.profiles AS p
  WHERE p.id = p_actor_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_quota_used IS NULL OR v_quota_limit IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'quota_not_configured';
  END IF;

  IF v_quota_reset_date IS NOT NULL AND v_quota_reset_date <= v_now THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'quota_cycle_expired';
  END IF;

  IF v_quota_used >= v_quota_limit THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'quota_exhausted';
  END IF;

  UPDATE public.profiles AS p
  SET ai_quota_used = p.ai_quota_used + 1
  WHERE p.id = p_actor_user_id
    AND p.ai_quota_used < p.ai_quota_limit
  RETURNING p.ai_quota_used, p.ai_quota_limit
  INTO v_quota_used, v_quota_limit;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'quota_exhausted';
  END IF;

  INSERT INTO private.laudo_ia_claims (
    clinic_id,
    laudo_id,
    actor_user_id,
    idempotency_key,
    state,
    quota_state,
    attempt_count,
    lease_expires_at
  )
  VALUES (
    p_clinic_id,
    p_laudo_id,
    p_actor_user_id,
    p_idempotency_key,
    'processing',
    'reserved',
    1,
    v_now + v_lease_interval
  )
  RETURNING * INTO v_claim;

  UPDATE public.laudos_pdf AS l
  SET
    status = 'processando',
    erro_ia = NULL
  WHERE l.id = p_laudo_id
    AND l.clinic_id = p_clinic_id;

  INSERT INTO private.laudo_ia_claim_events (
    claim_id,
    event_code,
    attempt_count
  )
  VALUES (
    v_claim.id,
    'claimed',
    v_claim.attempt_count
  );

  RETURN QUERY
  SELECT
    v_claim.id,
    v_claim.claim_token,
    'claimed'::text,
    v_claim.attempt_count,
    v_claim.lease_expires_at,
    'laudos'::text,
    v_laudo.storage_path,
    v_quota_used,
    v_quota_limit;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'claim_conflict';
END;
$function$;

-- --------------------------------------------------------------------------
-- Finalize. Only service_role receives EXECUTE. Context and token must match
-- the claim exactly; a stale lease cannot write a late result.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.finalize_laudo_ia(
  p_clinic_id uuid,
  p_actor_user_id uuid,
  p_laudo_id uuid,
  p_claim_id uuid,
  p_claim_token uuid,
  p_idempotency_key uuid,
  p_result jsonb,
  p_provider_code text
)
RETURNS TABLE (
  disposition text,
  quota_used integer,
  quota_limit integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_claim record;
  v_laudo_status text;
  v_quota_used integer;
  v_quota_limit integer;
  v_row_count integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_request_role text := COALESCE(
    NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    (SELECT auth.jwt() ->> 'role'),
    ''
  );
BEGIN
  IF v_request_role <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'service_role_required';
  END IF;

  IF p_clinic_id IS NULL
    OR p_actor_user_id IS NULL
    OR p_laudo_id IS NULL
    OR p_claim_id IS NULL
    OR p_claim_token IS NULL
    OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_request';
  END IF;

  IF p_provider_code IS NULL OR p_provider_code NOT IN ('gemini', 'openai') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_provider_code';
  END IF;

  IF p_result IS NULL OR pg_catalog.jsonb_typeof(p_result) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_result';
  END IF;

  IF pg_catalog.octet_length(p_result::text) > 262144 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'result_too_large';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clinics AS c
    JOIN public.clinic_memberships AS m
      ON m.clinic_id = c.id
    WHERE c.id = p_clinic_id
      AND c.status = 'active'
      AND m.user_id = p_actor_user_id
      AND m.status = 'active'
      AND m.role IN ('vet', 'clinic_admin')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'claim_not_found';
  END IF;

  SELECT c.*
  INTO v_claim
  FROM private.laudo_ia_claims AS c
  WHERE c.id = p_claim_id
    AND c.clinic_id = p_clinic_id
    AND c.actor_user_id = p_actor_user_id
    AND c.laudo_id = p_laudo_id
    AND c.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF NOT FOUND OR v_claim.claim_token <> p_claim_token THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'claim_not_found';
  END IF;

  SELECT l.status
  INTO v_laudo_status
  FROM public.laudos_pdf AS l
  WHERE l.id = p_laudo_id
    AND l.clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'laudo_not_found';
  END IF;

  IF v_claim.state = 'completed'
    AND v_claim.quota_state = 'consumed'
    AND v_laudo_status = 'concluido' THEN
    SELECT p.ai_quota_used, p.ai_quota_limit
    INTO v_quota_used, v_quota_limit
    FROM public.profiles AS p
    WHERE p.id = p_actor_user_id;

    RETURN QUERY
    SELECT 'already_completed'::text, v_quota_used, v_quota_limit;
    RETURN;
  END IF;

  IF v_claim.state <> 'processing'
    OR v_claim.quota_state <> 'reserved'
    OR v_claim.lease_expires_at IS NULL
    OR v_claim.lease_expires_at <= v_now THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'stale_or_invalid_claim';
  END IF;

  UPDATE public.laudos_pdf AS l
  SET
    status = 'concluido',
    resultado_ia = p_result,
    erro_ia = NULL
  WHERE l.id = p_laudo_id
    AND l.clinic_id = p_clinic_id
    AND l.status = 'processando';

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid_laudo_state';
  END IF;

  UPDATE private.laudo_ia_claims AS c
  SET
    state = 'completed',
    quota_state = 'consumed',
    lease_expires_at = NULL,
    provider_code = p_provider_code,
    error_code = NULL,
    completed_at = v_now,
    updated_at = v_now
  WHERE c.id = p_claim_id;

  INSERT INTO private.laudo_ia_claim_events (
    claim_id,
    event_code,
    attempt_count
  )
  VALUES (
    p_claim_id,
    'finalized',
    v_claim.attempt_count
  );

  SELECT p.ai_quota_used, p.ai_quota_limit
  INTO v_quota_used, v_quota_limit
  FROM public.profiles AS p
  WHERE p.id = p_actor_user_id;

  RETURN QUERY
  SELECT 'completed'::text, v_quota_used, v_quota_limit;
END;
$function$;

-- --------------------------------------------------------------------------
-- Refund / failure registration. A null token is accepted only after lease
-- expiry so an internal reaper can recover a worker crash. Retryable failures
-- preserve the one reservation; terminal failures compensate exactly once.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.refund_laudo_ia(
  p_clinic_id uuid,
  p_actor_user_id uuid,
  p_laudo_id uuid,
  p_claim_id uuid,
  p_claim_token uuid,
  p_idempotency_key uuid,
  p_retryable boolean,
  p_error_code text
)
RETURNS TABLE (
  disposition text,
  quota_used integer,
  quota_limit integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_claim record;
  v_quota_used integer;
  v_quota_limit integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_request_role text := COALESCE(
    NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    (SELECT auth.jwt() ->> 'role'),
    ''
  );
BEGIN
  IF v_request_role <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'service_role_required';
  END IF;

  IF p_clinic_id IS NULL
    OR p_actor_user_id IS NULL
    OR p_laudo_id IS NULL
    OR p_claim_id IS NULL
    OR p_idempotency_key IS NULL
    OR p_retryable IS NULL
    OR p_error_code IS NULL
    OR p_error_code NOT IN (
      'provider_timeout',
      'provider_rate_limited',
      'provider_unavailable',
      'provider_rejected',
      'storage_missing',
      'invalid_pdf',
      'invalid_provider_response',
      'invalid_result_schema',
      'result_too_large',
      'worker_crashed',
      'internal_processing_error',
      'attempts_exhausted'
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_request';
  END IF;

  SELECT c.*
  INTO v_claim
  FROM private.laudo_ia_claims AS c
  WHERE c.id = p_claim_id
    AND c.clinic_id = p_clinic_id
    AND c.actor_user_id = p_actor_user_id
    AND c.laudo_id = p_laudo_id
    AND c.idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'claim_not_found';
  END IF;

  -- Idempotent terminal responses do not need the expired token. Exact service
  -- context and claim identity were already verified above.
  IF v_claim.state = 'terminal_error' AND v_claim.quota_state = 'refunded' THEN
    SELECT p.ai_quota_used, p.ai_quota_limit
    INTO v_quota_used, v_quota_limit
    FROM public.profiles AS p
    WHERE p.id = p_actor_user_id;

    RETURN QUERY
    SELECT 'already_refunded'::text, v_quota_used, v_quota_limit;
    RETURN;
  END IF;

  IF v_claim.state = 'completed' OR v_claim.quota_state = 'consumed' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'completed_claim_cannot_be_refunded';
  END IF;

  IF p_claim_token IS NULL THEN
    IF v_claim.lease_expires_at IS NULL OR v_claim.lease_expires_at > v_now THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'claim_token_required';
    END IF;
  ELSIF v_claim.claim_token <> p_claim_token THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'claim_not_found';
  END IF;

  PERFORM 1
  FROM public.laudos_pdf AS l
  WHERE l.id = p_laudo_id
    AND l.clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'laudo_not_found';
  END IF;

  IF v_claim.state NOT IN ('processing', 'retryable_error')
    OR v_claim.quota_state <> 'reserved' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid_claim_state';
  END IF;

  IF v_claim.state = 'retryable_error'
    AND p_retryable
    AND v_claim.attempt_count < 3
    AND v_claim.error_code = p_error_code THEN
    SELECT p.ai_quota_used, p.ai_quota_limit
    INTO v_quota_used, v_quota_limit
    FROM public.profiles AS p
    WHERE p.id = p_actor_user_id;

    RETURN QUERY
    SELECT 'already_retryable'::text, v_quota_used, v_quota_limit;
    RETURN;
  END IF;

  IF p_retryable AND v_claim.attempt_count < 3 THEN
    UPDATE private.laudo_ia_claims AS c
    SET
      state = 'retryable_error',
      lease_expires_at = v_now,
      error_code = p_error_code,
      updated_at = v_now
    WHERE c.id = p_claim_id;

    UPDATE public.laudos_pdf AS l
    SET
      status = 'erro',
      erro_ia = p_error_code
    WHERE l.id = p_laudo_id
      AND l.clinic_id = p_clinic_id;

    INSERT INTO private.laudo_ia_claim_events (
      claim_id,
      event_code,
      attempt_count,
      error_code
    )
    VALUES (
      p_claim_id,
      'retryable_error',
      v_claim.attempt_count,
      p_error_code
    );

    SELECT p.ai_quota_used, p.ai_quota_limit
    INTO v_quota_used, v_quota_limit
    FROM public.profiles AS p
    WHERE p.id = p_actor_user_id;

    RETURN QUERY
    SELECT 'retryable_reserved'::text, v_quota_used, v_quota_limit;
    RETURN;
  END IF;

  UPDATE public.profiles AS p
  SET ai_quota_used = p.ai_quota_used - 1
  WHERE p.id = p_actor_user_id
    AND p.ai_quota_used IS NOT NULL
    AND p.ai_quota_limit IS NOT NULL
    AND p.ai_quota_used > 0
  RETURNING p.ai_quota_used, p.ai_quota_limit
  INTO v_quota_used, v_quota_limit;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'quota_state_inconsistent';
  END IF;

  UPDATE private.laudo_ia_claims AS c
  SET
    state = 'terminal_error',
    quota_state = 'refunded',
    lease_expires_at = NULL,
    error_code = p_error_code,
    updated_at = v_now
  WHERE c.id = p_claim_id;

  UPDATE public.laudos_pdf AS l
  SET
    status = 'erro',
    erro_ia = p_error_code
  WHERE l.id = p_laudo_id
    AND l.clinic_id = p_clinic_id;

  INSERT INTO private.laudo_ia_claim_events (
    claim_id,
    event_code,
    attempt_count,
    error_code
  )
  VALUES (
    p_claim_id,
    'refunded',
    v_claim.attempt_count,
    p_error_code
  );

  RETURN QUERY
  SELECT 'refunded'::text, v_quota_used, v_quota_limit;
END;
$function$;

-- --------------------------------------------------------------------------
-- Narrow Data API wrappers. They are SECURITY INVOKER. Privileged
-- implementations remain in private. The private schema is not added to the
-- exposed schema list.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_laudo_ia(
  p_clinic_id uuid,
  p_actor_user_id uuid,
  p_laudo_id uuid,
  p_idempotency_key uuid
)
RETURNS TABLE (
  claim_id uuid,
  claim_token uuid,
  disposition text,
  attempt_count smallint,
  lease_expires_at timestamptz,
  storage_bucket text,
  storage_path text,
  quota_used integer,
  quota_limit integer
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT *
  FROM private.claim_laudo_ia(
    p_clinic_id,
    p_actor_user_id,
    p_laudo_id,
    p_idempotency_key
  );
$function$;

CREATE OR REPLACE FUNCTION public.finalize_laudo_ia(
  p_clinic_id uuid,
  p_actor_user_id uuid,
  p_laudo_id uuid,
  p_claim_id uuid,
  p_claim_token uuid,
  p_idempotency_key uuid,
  p_result jsonb,
  p_provider_code text
)
RETURNS TABLE (
  disposition text,
  quota_used integer,
  quota_limit integer
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT *
  FROM private.finalize_laudo_ia(
    p_clinic_id,
    p_actor_user_id,
    p_laudo_id,
    p_claim_id,
    p_claim_token,
    p_idempotency_key,
    p_result,
    p_provider_code
  );
$function$;

CREATE OR REPLACE FUNCTION public.refund_laudo_ia(
  p_clinic_id uuid,
  p_actor_user_id uuid,
  p_laudo_id uuid,
  p_claim_id uuid,
  p_claim_token uuid,
  p_idempotency_key uuid,
  p_retryable boolean,
  p_error_code text
)
RETURNS TABLE (
  disposition text,
  quota_used integer,
  quota_limit integer
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT *
  FROM private.refund_laudo_ia(
    p_clinic_id,
    p_actor_user_id,
    p_laudo_id,
    p_claim_id,
    p_claim_token,
    p_idempotency_key,
    p_retryable,
    p_error_code
  );
$function$;

REVOKE ALL ON FUNCTION private.claim_laudo_ia(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.finalize_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.refund_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, boolean, text)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_laudo_ia(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finalize_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.refund_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, boolean, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- The invoker wrapper needs permission to call its exact private target.
GRANT EXECUTE ON FUNCTION private.claim_laudo_ia(uuid, uuid, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_laudo_ia(uuid, uuid, uuid, uuid)
  TO service_role;

GRANT EXECUTE ON FUNCTION private.finalize_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, jsonb, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, jsonb, text)
  TO service_role;

GRANT EXECUTE ON FUNCTION private.refund_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, boolean, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, boolean, text)
  TO service_role;

-- Intentional: this draft cannot persist even if its sentinel is removed.
ROLLBACK;
