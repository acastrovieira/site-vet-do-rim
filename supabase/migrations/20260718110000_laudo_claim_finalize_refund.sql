-- AUDIT-001 Fase 2 (Tarefa 2.1) — Transacao idempotente de laudos por IA.
-- Promocao revisada de docs/architecture/drafts/laudos-ia/claim-finalize-refund.quarantined.sql
-- conforme docs/architecture/drafts/laudos-ia/claim-finalize-contract.md (fonte de verdade).
--
-- A sentinela de quarentena do draft (BEGIN + DO $quarantine$ RAISE + ROLLBACK) foi
-- deliberadamente REMOVIDA nesta copia promovida; o draft permanece bloqueado e intacto.
--
-- Elimina os bloqueadores P0-3 (processamento de laudo nao idempotente) e P0-4
-- (TOCTOU da cota de IA): claim reserva a cota ANTES da chamada externa em UMA
-- transacao curta; finalize converte reserva em consumo e grava resultado+proveniencia
-- de forma atomica; refund compensa a reserva exatamente uma vez. Nenhuma chamada
-- externa (download/provedor/backoff) ocorre dentro destas transacoes.
--
-- Pre-requisitos (ja presentes na cadeia ativa, ADR-001 Fase 1):
--   public.clinics, public.clinic_memberships,
--   public.laudos_pdf.clinic_id (uuid), public.pets.clinic_id (uuid).
--
-- Replica LIMPO em banco vazio (supabase db reset --local --no-seed): so cria
-- schema/objetos; nenhuma linha de negocio e exigida.

BEGIN;

-- ---------------------------------------------------------------------------
-- Preflight: falha cedo se apontada para um schema sem os pre-requisitos de tenancy.
-- Todos os checks sao de catalogo (nao de dados), logo passam em banco vazio.
-- ---------------------------------------------------------------------------
DO $preflight$
BEGIN
  IF pg_catalog.to_regclass('public.clinics') IS NULL THEN
    RAISE EXCEPTION 'missing prerequisite: public.clinics (ADR-001 tenancy expand)';
  END IF;

  IF pg_catalog.to_regclass('public.clinic_memberships') IS NULL THEN
    RAISE EXCEPTION 'missing prerequisite: public.clinic_memberships (ADR-001 tenancy expand)';
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

-- Schema private ja existe (20260718100000). Somente adiciona USAGE ao service_role,
-- que precisa alcancar as funcoes private via os wrappers SECURITY INVOKER em public.
-- PUBLIC/anon continuam sem USAGE (revogados no expand).
GRANT USAGE ON SCHEMA private TO service_role;

-- ---------------------------------------------------------------------------
-- Proveniencia da IA (suporte a Tarefa 2.3).
-- DECISAO: coluna dedicada public.laudos_pdf.ia_provenance jsonb, SEPARADA de
-- resultado_ia. Justificativa: resultado_ia e o payload CLINICO consumido direto
-- pela UI e validado contra o schema clinico versionado; misturar metadados
-- operacionais (provider, modelo, versao do prompt, timestamp, sha256 do PDF)
-- poluiria esse contrato clinico e forcaria mudanca de UI/schema. A coluna
-- dedicada mantem o resultado clinico intocado/imutavel, permite auditoria e
-- reprodutibilidade ("qual modelo/prompt gerou este laudo") e e gravada
-- atomicamente pelo finalize na mesma transacao do resultado. E jsonb nullable
-- para nao quebrar linhas legadas (expand aditivo).
ALTER TABLE public.laudos_pdf
  ADD COLUMN IF NOT EXISTS ia_provenance jsonb;

COMMENT ON COLUMN public.laudos_pdf.ia_provenance IS
  'AUDIT-001 Fase 2: proveniencia operacional da IA (provider, modelo, versao do prompt, timestamp, sha256 do PDF), separada do resultado_ia clinico. Gravada por finalize_laudo_ia; nunca pelo cliente.';

-- ---------------------------------------------------------------------------
-- Estado privado. Nenhum payload clinico, nome, path, prompt ou corpo de
-- provedor e armazenado na tabela de eventos.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS private.laudo_ia_claims (
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

CREATE UNIQUE INDEX IF NOT EXISTS laudo_ia_claims_one_open_reservation_per_laudo_idx
  ON private.laudo_ia_claims (laudo_id)
  WHERE state IN ('processing', 'retryable_error')
    AND quota_state = 'reserved';

CREATE INDEX IF NOT EXISTS laudo_ia_claims_actor_idx
  ON private.laudo_ia_claims (actor_user_id);

CREATE INDEX IF NOT EXISTS laudo_ia_claims_clinic_laudo_idx
  ON private.laudo_ia_claims (clinic_id, laudo_id);

CREATE INDEX IF NOT EXISTS laudo_ia_claims_expired_lease_idx
  ON private.laudo_ia_claims (lease_expires_at, id)
  WHERE state = 'processing';

CREATE TABLE IF NOT EXISTS private.laudo_ia_claim_events (
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

CREATE INDEX IF NOT EXISTS laudo_ia_claim_events_claim_created_idx
  ON private.laudo_ia_claim_events (claim_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS laudo_ia_claim_events_one_finalized_idx
  ON private.laudo_ia_claim_events (claim_id)
  WHERE event_code = 'finalized';

CREATE UNIQUE INDEX IF NOT EXISTS laudo_ia_claim_events_one_refunded_idx
  ON private.laudo_ia_claim_events (claim_id)
  WHERE event_code IN ('refunded', 'attempts_exhausted');

-- Tabelas 100% privadas: nem authenticated nem service_role recebem grant direto.
-- Todo acesso passa pelas RPCs SECURITY DEFINER (que rodam como postgres, o dono).
REVOKE ALL ON TABLE private.laudo_ia_claims FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE private.laudo_ia_claim_events FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE private.laudo_ia_claim_events_id_seq FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- claim. actor_user_id vem de auth.getUser(jwt) na Edge Function, nunca do
-- browser. Somente service_role chama, e a membership e revalidada aqui. A
-- clinica fornecida e contexto, nao autoridade. Locks curtos; nenhuma chamada
-- externa. Reserva a cota ANTES da chamada externa (elimina o TOCTOU P0-4).
-- ---------------------------------------------------------------------------
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

  -- Uma requisicao concorrente pode ter perdido o claim nao commitado antes de
  -- esperar na linha do laudo. Re-le com um snapshot READ COMMITTED fresco.
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

ALTER FUNCTION private.claim_laudo_ia(uuid, uuid, uuid, uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- finalize. Somente service_role recebe EXECUTE. Contexto e token precisam
-- coincidir com o claim exatamente; uma lease obsoleta nao grava resultado
-- atrasado. Grava resultado clinico + proveniencia + consumo de cota numa unica
-- transacao (elimina o P0-3: nao ha status=erro com resultado_ia gravado nem
-- resultado concluido sem cota consumida).
-- p_provenance (jsonb, aditivo ao contrato do draft) carrega a proveniencia
-- operacional decidida acima; e opcional/nullable e validado como objeto.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.finalize_laudo_ia(
  p_clinic_id uuid,
  p_actor_user_id uuid,
  p_laudo_id uuid,
  p_claim_id uuid,
  p_claim_token uuid,
  p_idempotency_key uuid,
  p_result jsonb,
  p_provider_code text,
  p_provenance jsonb DEFAULT NULL
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

  -- Proveniencia e opcional, mas quando fornecida deve ser objeto e limitada.
  IF p_provenance IS NOT NULL THEN
    IF pg_catalog.jsonb_typeof(p_provenance) <> 'object' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_provenance';
    END IF;
    IF pg_catalog.octet_length(p_provenance::text) > 8192 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'provenance_too_large';
    END IF;
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
    ia_provenance = p_provenance,
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

ALTER FUNCTION private.finalize_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, jsonb, text, jsonb)
  OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- refund / registro de falha. Um token nulo so e aceito depois da expiracao da
-- lease, para um reaper interno recuperar o crash de um worker. Falhas retryable
-- preservam a unica reserva; falhas terminais compensam a cota exatamente uma vez
-- e ai_quota_used nunca fica negativo.
-- ---------------------------------------------------------------------------
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

  -- Respostas terminais idempotentes nao precisam do token expirado. Contexto de
  -- servico exato e identidade do claim ja foram verificados acima.
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

ALTER FUNCTION private.refund_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, boolean, text)
  OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- Wrappers estreitos da Data API. Sao SECURITY INVOKER; a implementacao
-- privilegiada permanece em private. O schema private nao e exposto ao PostgREST,
-- por isso os wrappers em public sao o unico ponto de entrada do service_role.
-- ---------------------------------------------------------------------------
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

ALTER FUNCTION public.claim_laudo_ia(uuid, uuid, uuid, uuid) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.finalize_laudo_ia(
  p_clinic_id uuid,
  p_actor_user_id uuid,
  p_laudo_id uuid,
  p_claim_id uuid,
  p_claim_token uuid,
  p_idempotency_key uuid,
  p_result jsonb,
  p_provider_code text,
  p_provenance jsonb DEFAULT NULL
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
    p_provider_code,
    p_provenance
  );
$function$;

ALTER FUNCTION public.finalize_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, jsonb, text, jsonb)
  OWNER TO postgres;

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

ALTER FUNCTION public.refund_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, boolean, text)
  OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- Privilegios minimos. Contrato: chamador e SOMENTE service_role (a Edge Function
-- resolve o ator com auth.getUser e prova acesso via RLS antes de usar o cliente
-- administrativo). O browser (authenticated) NAO chama estas RPCs diretamente,
-- portanto NAO recebe EXECUTE — o minimo exigido pelo contrato.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION private.claim_laudo_ia(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.finalize_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, jsonb, text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.refund_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, boolean, text)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_laudo_ia(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finalize_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, jsonb, text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.refund_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, boolean, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- O wrapper invoker precisa de permissao para chamar seu alvo private exato.
GRANT EXECUTE ON FUNCTION private.claim_laudo_ia(uuid, uuid, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_laudo_ia(uuid, uuid, uuid, uuid)
  TO service_role;

GRANT EXECUTE ON FUNCTION private.finalize_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, jsonb, text, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, jsonb, text, jsonb)
  TO service_role;

GRANT EXECUTE ON FUNCTION private.refund_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, boolean, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, boolean, text)
  TO service_role;

COMMIT;
