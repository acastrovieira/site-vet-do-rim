-- ============================================================================
-- SPRINT 0 & SPRINT 2 FORWARD MIGRATION
-- File: 20260830000000_sprint0_tenancy_fks_rls_and_remediation.sql
--
-- Resolves:
--   * Drift: Aligns public.clinic_memberships with ADR-001 (created_by,
--            criado_em, atualizado_em, unique (clinic_id, user_id)) because
--            in production the table predates 20260718100000_tenancy_expand.
--   * M-01: Restores composite unique indexes and 19 tenant Foreign Keys
--           (including fk_pets_tutor_same_clinic) omitted in 20260829000000.
--   * M-02: Dynamic default clinic resolution (supports both production UUID
--           00000000-0000-0000-0000-000000000001 and baseline UUID
--           00000000-0000-4000-8000-00000000c11c) and membership backfill.
--   * M-04: Allows private.purge_old_claim_events to run under both
--           service_role (Next.js cron) and postgres/supabase_admin (pg_cron).
--   * HIGH-01: Drops legacy owner_upload_laudos / owner_read_laudos policies
--              on storage.objects so all laudos access is clinic-scoped.
--   * HIGH-02: Hardens public.prevent_profile_privilege_escalation() and
--              profiles RLS against cross-row role/quota escalation.
--   * HIGH-03: Revokes EXECUTE on every existing public.increment_ai_quota
--              overload from authenticated (skipped if none exists).
--   * Sprint 2 (2.1): Nullable storage_path and origem_resultado column on
--                     public.laudos_pdf for zero-cost manual exam entries.
--   * MED-01 / MED-02: Safe numeric/date casts + species normalization in
--                      private.populate_exam_result_items(uuid) and cleanup
--                      index on private.clinical_rate_limit_windows
--                      (window_started_at).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Alinhamento de public.clinic_memberships ao contrato ADR-001 (drift)
-- ----------------------------------------------------------------------------
-- Em produção a tabela já existia antes de 20260718100000_tenancy_expand, então
-- o CREATE TABLE IF NOT EXISTS foi ignorado e as colunas de auditoria nunca
-- vieram. Sem este passo o backfill da seção 1 falha com
-- 42703 (column "created_by" of relation "clinic_memberships" does not exist),
-- e as FKs compostas da seção 2 precisam de chave única em (clinic_id, user_id).
ALTER TABLE public.clinic_memberships
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS criado_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();

DO $clinic_memberships_alignment$
BEGIN
  -- Chave única (clinic_id, user_id): exigida pelo ON CONFLICT do backfill e
  -- pelas FKs fk_colaboradores_membership_same_clinic / fk_laudos_pdf_vet_membership.
  -- Num replay limpo a PK de tenancy_expand já cobre isso e nada é criado.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS i
    WHERE i.indrelid = 'public.clinic_memberships'::regclass
      AND i.indisunique
      AND i.indpred IS NULL
      AND i.indexprs IS NULL
      AND i.indnatts = 2
      AND (
        SELECT pg_catalog.array_agg(a.attname::text ORDER BY a.attname::text)
        FROM pg_catalog.pg_attribute AS a
        WHERE a.attrelid = i.indrelid
          AND a.attnum = ANY (i.indkey::int2[])
      ) = ARRAY['clinic_id', 'user_id']
  ) THEN
    CREATE UNIQUE INDEX uq_clinic_memberships_clinic_user
      ON public.clinic_memberships (clinic_id, user_id);
  END IF;

  -- FK de created_by -> auth.users, só se nenhuma FK já cobrir a coluna
  -- (num replay limpo existe clinic_memberships_created_by_fkey).
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS c
    JOIN pg_catalog.pg_attribute AS a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.clinic_memberships'::regclass
      AND c.contype = 'f'
      AND a.attname = 'created_by'
  ) THEN
    ALTER TABLE public.clinic_memberships
      ADD CONSTRAINT fk_clinic_memberships_created_by
      FOREIGN KEY (created_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END
$clinic_memberships_alignment$;

-- ----------------------------------------------------------------------------
-- 1. Dynamic Default Clinic Resolution & Backfill (M-02)
-- ----------------------------------------------------------------------------
DO $tenancy_remediation$
DECLARE
  v_default_clinic_id uuid;
BEGIN
  IF pg_catalog.to_regclass('public.clinics') IS NULL THEN
    RAISE EXCEPTION 'preflight: public.clinics ausente';
  END IF;

  SELECT c.id INTO v_default_clinic_id
  FROM public.clinics AS c
  WHERE c.id IN (
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-4000-8000-00000000c11c'::uuid
  )
  ORDER BY (c.id = '00000000-0000-0000-0000-000000000001'::uuid) DESC
  LIMIT 1;

  IF v_default_clinic_id IS NULL THEN
    SELECT c.id INTO v_default_clinic_id
    FROM public.clinics AS c
    ORDER BY c.criado_em ASC
    LIMIT 1;
  END IF;

  IF v_default_clinic_id IS NULL THEN
    v_default_clinic_id := '00000000-0000-0000-0000-000000000001'::uuid;
    INSERT INTO public.clinics (id, nome, status)
    VALUES (v_default_clinic_id, 'Vet do Rim Matriz', 'active')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Backfill missing clinic_memberships for vet/admin profiles
  INSERT INTO public.clinic_memberships (
    clinic_id,
    user_id,
    role,
    status,
    created_by
  )
  SELECT
    v_default_clinic_id,
    p.id,
    CASE WHEN p.role = 'admin' THEN 'clinic_admin' ELSE 'vet' END,
    'active',
    NULL
  FROM public.profiles AS p
  WHERE p.role IN ('vet', 'admin')
    AND NOT EXISTS (
      SELECT 1
      FROM public.clinic_memberships AS cm
      WHERE cm.user_id = p.id
        AND cm.status = 'active'
    )
  ON CONFLICT (clinic_id, user_id) DO NOTHING;

  -- Backfill NULL clinic_id on root/child tenant tables
  UPDATE public.tutores
  SET clinic_id = v_default_clinic_id
  WHERE clinic_id IS NULL;

  UPDATE public.pets AS p
  SET clinic_id = COALESCE(
    (SELECT t.clinic_id FROM public.tutores AS t WHERE t.id = p.tutor_id),
    v_default_clinic_id
  )
  WHERE p.clinic_id IS NULL;

  -- Reconcile any cross-clinic pet/tutor mismatch prior to composite FK validation
  UPDATE public.pets AS p
  SET clinic_id = t.clinic_id
  FROM public.tutores AS t
  WHERE p.tutor_id = t.id
    AND t.clinic_id IS NOT NULL
    AND p.clinic_id IS DISTINCT FROM t.clinic_id;

  UPDATE public.triagens AS tr
  SET clinic_id = COALESCE(
    (SELECT p.clinic_id FROM public.pets AS p WHERE p.id = tr.pet_id),
    v_default_clinic_id
  )
  WHERE tr.clinic_id IS NULL;

  UPDATE public.triagens AS tr
  SET clinic_id = p.clinic_id
  FROM public.pets AS p
  WHERE tr.pet_id = p.id
    AND p.clinic_id IS NOT NULL
    AND tr.clinic_id IS DISTINCT FROM p.clinic_id;

  UPDATE public.follow_ups AS fu
  SET clinic_id = COALESCE(
    (SELECT tr.clinic_id FROM public.triagens AS tr WHERE tr.id = fu.triagem_id),
    v_default_clinic_id
  )
  WHERE fu.clinic_id IS NULL;

  UPDATE public.follow_ups AS fu
  SET clinic_id = tr.clinic_id
  FROM public.triagens AS tr
  WHERE fu.triagem_id = tr.id
    AND tr.clinic_id IS NOT NULL
    AND fu.clinic_id IS DISTINCT FROM tr.clinic_id;

  UPDATE public.colaboradores
  SET clinic_id = v_default_clinic_id
  WHERE clinic_id IS NULL;

  UPDATE public.laudos_pdf AS l
  SET clinic_id = COALESCE(
    (SELECT p.clinic_id FROM public.pets AS p WHERE p.id = l.pet_id),
    v_default_clinic_id
  )
  WHERE l.clinic_id IS NULL;

  UPDATE public.laudos_pdf AS l
  SET clinic_id = p.clinic_id
  FROM public.pets AS p
  WHERE l.pet_id = p.id
    AND p.clinic_id IS NOT NULL
    AND l.clinic_id IS DISTINCT FROM p.clinic_id;
END
$tenancy_remediation$;

-- ----------------------------------------------------------------------------
-- 2. Composite Unique Indexes & 19 Tenant Foreign Keys (M-01)
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_tutores_clinic_id
  ON public.tutores(clinic_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pets_clinic_id
  ON public.pets(clinic_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pets_clinic_id_tutor
  ON public.pets(clinic_id, id, tutor_id);

CREATE INDEX IF NOT EXISTS idx_triagens_clinic_pet
  ON public.triagens(clinic_id, pet_id);

CREATE INDEX IF NOT EXISTS idx_triagens_clinic_pet_tutor
  ON public.triagens(clinic_id, pet_id, tutor_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_triagens_clinic_id
  ON public.triagens(clinic_id, id);

CREATE INDEX IF NOT EXISTS idx_follow_ups_clinic_triagem
  ON public.follow_ups(clinic_id, triagem_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_follow_ups_clinic_id
  ON public.follow_ups(clinic_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_colaboradores_clinic_id
  ON public.colaboradores(clinic_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_colaboradores_clinic_uid
  ON public.colaboradores(clinic_id, supabase_uid)
  WHERE supabase_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_laudos_pdf_clinic_pet
  ON public.laudos_pdf(clinic_id, pet_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_laudos_pdf_clinic_id
  ON public.laudos_pdf(clinic_id, id);

DO $tenant_fks$
DECLARE
  v_constraint record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tutores'::regclass AND conname = 'fk_tutores_clinic'
  ) THEN
    ALTER TABLE public.tutores
      ADD CONSTRAINT fk_tutores_clinic
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tutores'::regclass AND conname = 'fk_tutores_created_by'
  ) THEN
    ALTER TABLE public.tutores
      ADD CONSTRAINT fk_tutores_created_by
      FOREIGN KEY (created_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pets'::regclass AND conname = 'fk_pets_clinic'
  ) THEN
    ALTER TABLE public.pets
      ADD CONSTRAINT fk_pets_clinic
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pets'::regclass AND conname = 'fk_pets_created_by'
  ) THEN
    ALTER TABLE public.pets
      ADD CONSTRAINT fk_pets_created_by
      FOREIGN KEY (created_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pets'::regclass AND conname = 'fk_pets_tutor_same_clinic'
  ) THEN
    ALTER TABLE public.pets
      ADD CONSTRAINT fk_pets_tutor_same_clinic
      FOREIGN KEY (clinic_id, tutor_id)
      REFERENCES public.tutores(clinic_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.triagens'::regclass AND conname = 'fk_triagens_clinic'
  ) THEN
    ALTER TABLE public.triagens
      ADD CONSTRAINT fk_triagens_clinic
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.triagens'::regclass AND conname = 'fk_triagens_created_by'
  ) THEN
    ALTER TABLE public.triagens
      ADD CONSTRAINT fk_triagens_created_by
      FOREIGN KEY (created_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.triagens'::regclass AND conname = 'fk_triagens_pet_same_clinic'
  ) THEN
    ALTER TABLE public.triagens
      ADD CONSTRAINT fk_triagens_pet_same_clinic
      FOREIGN KEY (clinic_id, pet_id)
      REFERENCES public.pets(clinic_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.triagens'::regclass AND conname = 'fk_triagens_pet_tutor_same_clinic'
  ) THEN
    ALTER TABLE public.triagens
      ADD CONSTRAINT fk_triagens_pet_tutor_same_clinic
      FOREIGN KEY (clinic_id, pet_id, tutor_id)
      REFERENCES public.pets(clinic_id, id, tutor_id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.follow_ups'::regclass AND conname = 'fk_follow_ups_clinic'
  ) THEN
    ALTER TABLE public.follow_ups
      ADD CONSTRAINT fk_follow_ups_clinic
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.follow_ups'::regclass AND conname = 'fk_follow_ups_created_by'
  ) THEN
    ALTER TABLE public.follow_ups
      ADD CONSTRAINT fk_follow_ups_created_by
      FOREIGN KEY (created_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.follow_ups'::regclass AND conname = 'fk_follow_ups_triagem_same_clinic'
  ) THEN
    ALTER TABLE public.follow_ups
      ADD CONSTRAINT fk_follow_ups_triagem_same_clinic
      FOREIGN KEY (clinic_id, triagem_id)
      REFERENCES public.triagens(clinic_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.colaboradores'::regclass AND conname = 'fk_colaboradores_clinic'
  ) THEN
    ALTER TABLE public.colaboradores
      ADD CONSTRAINT fk_colaboradores_clinic
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.colaboradores'::regclass AND conname = 'fk_colaboradores_created_by'
  ) THEN
    ALTER TABLE public.colaboradores
      ADD CONSTRAINT fk_colaboradores_created_by
      FOREIGN KEY (created_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.colaboradores'::regclass AND conname = 'fk_colaboradores_membership_same_clinic'
  ) THEN
    ALTER TABLE public.colaboradores
      ADD CONSTRAINT fk_colaboradores_membership_same_clinic
      FOREIGN KEY (clinic_id, supabase_uid)
      REFERENCES public.clinic_memberships(clinic_id, user_id)
      ON DELETE SET NULL (supabase_uid) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.laudos_pdf'::regclass AND conname = 'fk_laudos_pdf_clinic'
  ) THEN
    ALTER TABLE public.laudos_pdf
      ADD CONSTRAINT fk_laudos_pdf_clinic
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.laudos_pdf'::regclass AND conname = 'fk_laudos_pdf_created_by'
  ) THEN
    ALTER TABLE public.laudos_pdf
      ADD CONSTRAINT fk_laudos_pdf_created_by
      FOREIGN KEY (created_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.laudos_pdf'::regclass AND conname = 'fk_laudos_pdf_pet_same_clinic'
  ) THEN
    ALTER TABLE public.laudos_pdf
      ADD CONSTRAINT fk_laudos_pdf_pet_same_clinic
      FOREIGN KEY (clinic_id, pet_id)
      REFERENCES public.pets(clinic_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.laudos_pdf'::regclass AND conname = 'fk_laudos_pdf_vet_membership'
  ) THEN
    ALTER TABLE public.laudos_pdf
      ADD CONSTRAINT fk_laudos_pdf_vet_membership
      FOREIGN KEY (clinic_id, vet_id)
      REFERENCES public.clinic_memberships(clinic_id, user_id)
      ON DELETE SET NULL (vet_id) NOT VALID;
  END IF;

  -- Validate key same-clinic constraints after reconciliation
  FOR v_constraint IN
    SELECT c.conname, cl.relname AS table_name
    FROM pg_constraint AS c
    JOIN pg_class AS cl ON cl.oid = c.conrelid
    JOIN pg_namespace AS n ON n.oid = cl.relnamespace
    WHERE n.nspname = 'public'
      AND NOT c.convalidated
      AND c.conname IN (
        'fk_tutores_clinic',
        'fk_pets_clinic',
        'fk_pets_tutor_same_clinic',
        'fk_triagens_clinic',
        'fk_triagens_pet_same_clinic',
        'fk_follow_ups_clinic',
        'fk_follow_ups_triagem_same_clinic',
        'fk_colaboradores_clinic',
        'fk_laudos_pdf_clinic',
        'fk_laudos_pdf_pet_same_clinic'
      )
  LOOP
    EXECUTE pg_catalog.format(
      'ALTER TABLE public.%I VALIDATE CONSTRAINT %I',
      v_constraint.table_name,
      v_constraint.conname
    );
  END LOOP;
END
$tenant_fks$;

-- ----------------------------------------------------------------------------
-- 3. Tenant Ownership Immutability Trigger (Prevents Cross-Clinic Transfer)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.enforce_tenant_row_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_request_role text := COALESCE(
    NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    (SELECT auth.jwt() ->> 'role'),
    ''
  );
BEGIN
  IF v_request_role = 'service_role'
     OR SESSION_USER IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.clinic_id IS NOT NULL AND NEW.clinic_id IS DISTINCT FROM OLD.clinic_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'clinic_id_immutable';
  END IF;

  IF OLD.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'created_by_immutable';
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION private.enforce_tenant_row_immutability() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.enforce_tenant_row_immutability() FROM PUBLIC;

DO $attach_immutability_triggers$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'tutores',
    'pets',
    'triagens',
    'follow_ups',
    'colaboradores',
    'laudos_pdf'
  ]
  LOOP
    EXECUTE pg_catalog.format(
      'DROP TRIGGER IF EXISTS trg_enforce_tenant_immutability ON public.%I',
      v_table
    );
    EXECUTE pg_catalog.format(
      'CREATE TRIGGER trg_enforce_tenant_immutability BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row_immutability()',
      v_table
    );
  END LOOP;
END
$attach_immutability_triggers$;

-- ----------------------------------------------------------------------------
-- 4. Storage, Profile Escalation & Quota RPC Hardening (HIGH-01, HIGH-02, HIGH-03)
-- ----------------------------------------------------------------------------
-- HIGH-01: Remove legacy path-prefix storage policies so only reserved laudo objects are accessible
DROP POLICY IF EXISTS "owner_upload_laudos" ON storage.objects;
DROP POLICY IF EXISTS "owner_read_laudos" ON storage.objects;

-- HIGH-02: Prevent privilege/quota escalation even across rows unless caller is service_role/postgres
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_request_role text := COALESCE(
    NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    (SELECT auth.jwt() ->> 'role'),
    ''
  );
BEGIN
  IF v_request_role = 'service_role'
     OR SESSION_USER IN ('postgres', 'supabase_admin', 'supabase_auth_admin') THEN
    RETURN NEW;
  END IF;

  IF (SELECT auth.uid()) IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'cross_profile_mutation_forbidden';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role cannot be changed by this operation';
  END IF;

  IF NEW.ai_quota_limit IS DISTINCT FROM OLD.ai_quota_limit
    OR NEW.ai_quota_used IS DISTINCT FROM OLD.ai_quota_used
    OR NEW.ai_quota_reset_date IS DISTINCT FROM OLD.ai_quota_reset_date THEN
    RAISE EXCEPTION 'ai quota fields cannot be changed by this operation';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC;

DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;

CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- HIGH-03: Revoke direct client execution of legacy increment_ai_quota
-- Em produção a função não existe (20260626010000 não foi aplicada lá), então
-- revoga de toda versão existente em vez de citar uma assinatura fixa.
-- Se nenhuma existir, não há o que revogar e o bloco não faz nada.
DO $revoke_increment_ai_quota$
DECLARE
  v_fn record;
BEGIN
  FOR v_fn IN
    SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_catalog.pg_proc AS p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'increment_ai_quota'
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      v_fn.proname,
      v_fn.args
    );
    EXECUTE pg_catalog.format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
      v_fn.proname,
      v_fn.args
    );
  END LOOP;
END
$revoke_increment_ai_quota$;

-- ----------------------------------------------------------------------------
-- 5. Claim Events Purge Cron Compatibility (M-04)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.purge_old_claim_events(
  p_retention_days integer DEFAULT 90
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_deleted integer;
  v_cutoff  timestamptz := pg_catalog.clock_timestamp() - (p_retention_days || ' days')::interval;
  v_request_role text := COALESCE(
    NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    (SELECT auth.jwt() ->> 'role'),
    ''
  );
BEGIN
  IF v_request_role <> 'service_role'
     AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'service_role_required';
  END IF;

  IF p_retention_days < 30 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'p_retention_days deve ser >= 30 para preservar auditoria mínima';
  END IF;

  DELETE FROM private.laudo_ia_claim_events AS e
  WHERE e.created_at < v_cutoff
    AND EXISTS (
      SELECT 1
      FROM private.laudo_ia_claims AS c
      WHERE c.id = e.claim_id
        AND c.state IN ('completed', 'terminal_error')
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

ALTER FUNCTION private.purge_old_claim_events(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.purge_old_claim_events(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.purge_old_claim_events(integer) TO service_role;

-- M-03 / LAB-EVO-001 Task 0.4: Reaper routine for expired processing claims via refund_laudo_ia
CREATE OR REPLACE FUNCTION private.recover_expired_laudo_claims()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_claim record;
  v_recovered integer := 0;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_request_role text := COALESCE(
    NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    (SELECT auth.jwt() ->> 'role'),
    ''
  );
BEGIN
  IF v_request_role <> 'service_role'
     AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'service_role_required';
  END IF;

  FOR v_claim IN
    SELECT c.id, c.clinic_id, c.actor_user_id, c.laudo_id, c.idempotency_key
    FROM private.laudo_ia_claims AS c
    WHERE c.state = 'processing'
      AND c.quota_state = 'reserved'
      AND c.lease_expires_at IS NOT NULL
      AND c.lease_expires_at <= v_now
    ORDER BY c.lease_expires_at ASC
    LIMIT 100
  LOOP
    PERFORM private.refund_laudo_ia(
      v_claim.clinic_id,
      v_claim.actor_user_id,
      v_claim.laudo_id,
      v_claim.id,
      NULL,
      v_claim.idempotency_key,
      false,
      'worker_crashed'
    );
    v_recovered := v_recovered + 1;
  END LOOP;

  RETURN v_recovered;
END;
$function$;

ALTER FUNCTION private.recover_expired_laudo_claims() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.recover_expired_laudo_claims()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.recover_expired_laudo_claims() TO service_role;

CREATE OR REPLACE FUNCTION public.recover_expired_laudo_claims()
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.recover_expired_laudo_claims();
$function$;

ALTER FUNCTION public.recover_expired_laudo_claims() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.recover_expired_laudo_claims()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recover_expired_laudo_claims() TO service_role;

-- ----------------------------------------------------------------------------
-- 6. Manual Lab Entry Schema Support (Sprint 2 Task 2.1)
-- ----------------------------------------------------------------------------
ALTER TABLE public.laudos_pdf
  ALTER COLUMN storage_path DROP NOT NULL;

ALTER TABLE public.laudos_pdf
  ADD COLUMN IF NOT EXISTS origem_resultado text NOT NULL DEFAULT 'pdf_ia';

UPDATE public.laudos_pdf
SET origem_resultado = 'pdf_local'
WHERE tipo_exame = 'laboratorial_local' AND origem_resultado = 'pdf_ia';

UPDATE public.laudos_pdf
SET origem_resultado = 'manual'
WHERE (tipo_exame = 'laboratorial_manual' OR storage_path IS NULL OR storage_path LIKE 'manual://%')
  AND origem_resultado = 'pdf_ia';

DO $laudos_origem_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.laudos_pdf'::regclass
      AND conname = 'chk_laudos_pdf_origem_resultado'
  ) THEN
    ALTER TABLE public.laudos_pdf
      ADD CONSTRAINT chk_laudos_pdf_origem_resultado
      CHECK (origem_resultado IN ('pdf_ia', 'pdf_local', 'manual'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.laudos_pdf'::regclass
      AND conname = 'chk_laudos_pdf_origem_storage'
  ) THEN
    ALTER TABLE public.laudos_pdf
      ADD CONSTRAINT chk_laudos_pdf_origem_storage
      CHECK (
        (origem_resultado = 'manual' AND (storage_path IS NULL OR storage_path LIKE 'manual://%'))
        OR (origem_resultado IN ('pdf_ia', 'pdf_local') AND storage_path IS NOT NULL)
      );
  END IF;
END
$laudos_origem_constraints$;

-- ----------------------------------------------------------------------------
-- 7. Safe private.populate_exam_result_items & Rate Limit Index (MED-01, MED-02)
-- ----------------------------------------------------------------------------
-- A tabela não tem updated_at: a limpeza em public.consume_clinical_rate_limit
-- filtra por window_started_at. Garante o índice criado em
-- 20260824004343_distributed_rate_limit (no-op se já existir ou se a tabela
-- ainda não existir no ambiente).
DO $rate_limit_expiry_index$
BEGIN
  IF pg_catalog.to_regclass('private.clinical_rate_limit_windows') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS clinical_rate_limit_windows_expiry_idx
      ON private.clinical_rate_limit_windows (window_started_at);
  END IF;
END
$rate_limit_expiry_index$;

CREATE OR REPLACE FUNCTION private.safe_parse_numeric(p_value text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $function$
DECLARE
  v_trimmed text := pg_catalog.btrim(COALESCE(p_value, ''));
BEGIN
  IF v_trimmed = '' THEN
    RETURN NULL;
  END IF;
  RETURN v_trimmed::numeric;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$function$;

ALTER FUNCTION private.safe_parse_numeric(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.safe_parse_numeric(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.safe_parse_date(p_value text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $function$
DECLARE
  v_trimmed text := pg_catalog.btrim(COALESCE(p_value, ''));
BEGIN
  IF v_trimmed = '' OR v_trimmed !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN NULL;
  END IF;
  RETURN v_trimmed::date;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$function$;

ALTER FUNCTION private.safe_parse_date(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.safe_parse_date(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.populate_exam_result_items(
  p_laudo_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_laudo         record;
  v_resultado     jsonb;
  v_rows_affected integer := 0;
  v_request_role  text := COALESCE(
    NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    (SELECT auth.jwt() ->> 'role'),
    ''
  );
  v_raw_especie   text;
  v_especie       text;
  v_data_coleta   date;
BEGIN
  IF v_request_role <> 'service_role'
     AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'service_role_required';
  END IF;

  IF p_laudo_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_request';
  END IF;

  SELECT l.id, l.pet_id, l.clinic_id, l.resultado_ia, l.status, l.created_at
  INTO v_laudo
  FROM public.laudos_pdf AS l
  WHERE l.id = p_laudo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'laudo_not_found';
  END IF;

  IF v_laudo.status <> 'concluido' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'laudo_not_concluded';
  END IF;

  v_resultado := v_laudo.resultado_ia;

  IF v_resultado IS NULL OR pg_catalog.jsonb_typeof(v_resultado) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'resultado_ia_missing';
  END IF;

  SELECT
    LOWER(pg_catalog.btrim(COALESCE(p.especie, ''))),
    private.safe_parse_date(v_resultado->>'data_coleta')
  INTO v_raw_especie, v_data_coleta
  FROM public.pets AS p
  WHERE p.id = v_laudo.pet_id;

  IF NOT FOUND THEN
    v_especie := 'outro';
    v_data_coleta := private.safe_parse_date(v_resultado->>'data_coleta');
  ELSIF v_raw_especie IN ('canino', 'cao', 'cão') THEN
    v_especie := 'canino';
  ELSIF v_raw_especie IN ('felino', 'gato') THEN
    v_especie := 'felino';
  ELSE
    v_especie := 'outro';
  END IF;

  WITH parametros(parametro, categoria, valor, unidade, ref_min_canino, ref_max_canino, ref_min_felino, ref_max_felino) AS (
    VALUES
      -- Série Vermelha
      ('hemacias',                  'serie_vermelha',     private.safe_parse_numeric(v_resultado->'serie_vermelha'->>'hemacias'),                  '×10⁶/µL', 5.5,   8.5,   5.0,   10.0),
      ('hemoglobina',               'serie_vermelha',     private.safe_parse_numeric(v_resultado->'serie_vermelha'->>'hemoglobina'),               'g/dL',    12.0,  18.0,  8.0,   15.0),
      ('hematocrito',               'serie_vermelha',     private.safe_parse_numeric(v_resultado->'serie_vermelha'->>'hematocrito'),               '%',       37.0,  55.0,  24.0,  45.0),
      ('vcm',                       'serie_vermelha',     private.safe_parse_numeric(v_resultado->'serie_vermelha'->>'vcm'),                       'fL',      60.0,  74.0,  39.0,  55.0),
      ('hcm',                       'serie_vermelha',     private.safe_parse_numeric(v_resultado->'serie_vermelha'->>'hcm'),                       'pg',      19.5,  24.5,  13.0,  17.0),
      ('chcm',                      'serie_vermelha',     private.safe_parse_numeric(v_resultado->'serie_vermelha'->>'chcm'),                      'g/dL',    32.0,  36.0,  30.0,  36.0),
      ('rdw',                       'serie_vermelha',     private.safe_parse_numeric(v_resultado->'serie_vermelha'->>'rdw'),                       '%',       14.0,  17.0,  14.0,  18.0),
      -- Série Branca
      ('leucocitos_totais',         'serie_branca',       private.safe_parse_numeric(v_resultado->'serie_branca'->>'leucocitos_totais'),           '/µL',     6000,  17000, 5500,  19500),
      ('neutrofilos_segmentados',   'serie_branca',       private.safe_parse_numeric(v_resultado->'serie_branca'->>'neutrofilos_segmentados'),     '/µL',     3000,  11500, 2500,  12500),
      ('neutrofilos_bastoes',       'serie_branca',       private.safe_parse_numeric(v_resultado->'serie_branca'->>'neutrofilos_bastoes'),         '/µL',     0,     300,   0,     300),
      ('linfocitos',                'serie_branca',       private.safe_parse_numeric(v_resultado->'serie_branca'->>'linfocitos'),                  '/µL',     1000,  4800,  1500,  7000),
      ('monocitos',                 'serie_branca',       private.safe_parse_numeric(v_resultado->'serie_branca'->>'monocitos'),                   '/µL',     150,   1350,  0,     850),
      ('eosinofilos',               'serie_branca',       private.safe_parse_numeric(v_resultado->'serie_branca'->>'eosinofilos'),                 '/µL',     100,   1250,  0,     1500),
      ('basofilos',                 'serie_branca',       private.safe_parse_numeric(v_resultado->'serie_branca'->>'basofilos'),                   '/µL',     0,     100,   0,     100),
      -- Plaquetas
      ('plaquetas_contagem',        'plaquetas',          private.safe_parse_numeric(v_resultado->'plaquetas'->>'contagem'),                       '×10³/µL', 200,   500,   180,   550),
      ('plaquetas_vpm',             'plaquetas',          private.safe_parse_numeric(v_resultado->'plaquetas'->>'vpm'),                            'fL',      7.0,   12.0,  12.0,  18.0),
      -- Bioquímica Renal
      ('ureia',                     'bioquimica_renal',   private.safe_parse_numeric(v_resultado->'bioquimica'->>'ureia'),                         'mg/dL',   15.0,  40.0,  20.0,  50.0),
      ('creatinina',                'bioquimica_renal',   private.safe_parse_numeric(v_resultado->'bioquimica'->>'creatinina'),                    'mg/dL',   0.5,   1.5,   0.8,   2.4),
      ('fosforo',                   'bioquimica_renal',   private.safe_parse_numeric(v_resultado->'bioquimica'->>'fosforo'),                       'mg/dL',   2.5,   6.0,   3.1,   7.5),
      ('potassio',                  'bioquimica_renal',   private.safe_parse_numeric(v_resultado->'bioquimica'->>'potassio'),                      'mEq/L',   3.6,   5.5,   3.5,   5.8),
      ('sodio',                     'bioquimica_renal',   private.safe_parse_numeric(v_resultado->'bioquimica'->>'sodio'),                         'mEq/L',   140,   154,   149,   162),
      ('albumina',                  'bioquimica_renal',   private.safe_parse_numeric(v_resultado->'bioquimica'->>'albumina'),                      'g/dL',    2.6,   3.3,   2.1,   3.3),
      ('proteina_total',            'bioquimica_renal',   private.safe_parse_numeric(v_resultado->'bioquimica'->>'proteina_total'),                'g/dL',    5.4,   7.1,   5.2,   8.8),
      -- Bioquímica Hepática
      ('alt_tgp',                   'bioquimica_hepatica',private.safe_parse_numeric(v_resultado->'bioquimica'->>'alt_tgp'),                       'U/L',     0,     65.0,  0,     75.0),
      ('ast_tgo',                   'bioquimica_hepatica',private.safe_parse_numeric(v_resultado->'bioquimica'->>'ast_tgo'),                       'U/L',     0,     40.0,  0,     40.0)
  ),
  com_refs AS (
    SELECT
      p.parametro,
      p.categoria,
      p.valor,
      p.unidade,
      CASE
        WHEN v_especie = 'felino' THEN p.ref_min_felino
        WHEN v_especie = 'canino' THEN p.ref_min_canino
        ELSE NULL
      END AS ref_min,
      CASE
        WHEN v_especie = 'felino' THEN p.ref_max_felino
        WHEN v_especie = 'canino' THEN p.ref_max_canino
        ELSE NULL
      END AS ref_max,
      v_especie AS especie,
      v_data_coleta AS data_coleta,
      CASE
        WHEN p.valor IS NULL THEN 'indisponivel'
        WHEN v_especie = 'outro' THEN 'indisponivel'
        WHEN p.valor < (CASE WHEN v_especie = 'felino' THEN p.ref_min_felino ELSE p.ref_min_canino END) THEN 'baixo'
        WHEN p.valor > (CASE WHEN v_especie = 'felino' THEN p.ref_max_felino ELSE p.ref_max_canino END) THEN 'alto'
        ELSE 'normal'
      END AS status_ref
    FROM parametros AS p
  )
  INSERT INTO public.exam_result_items (
    laudo_id, clinic_id, pet_id,
    parametro, categoria,
    valor, unidade,
    ref_min, ref_max, especie,
    status_ref, data_coleta
  )
  SELECT
    v_laudo.id,
    v_laudo.clinic_id,
    v_laudo.pet_id,
    cr.parametro, cr.categoria,
    cr.valor, cr.unidade,
    cr.ref_min, cr.ref_max, cr.especie,
    cr.status_ref, cr.data_coleta
  FROM com_refs AS cr
  ON CONFLICT (laudo_id, parametro) DO UPDATE SET
    valor        = EXCLUDED.valor,
    ref_min      = EXCLUDED.ref_min,
    ref_max      = EXCLUDED.ref_max,
    especie      = EXCLUDED.especie,
    status_ref   = EXCLUDED.status_ref,
    data_coleta  = EXCLUDED.data_coleta,
    extracted_at = now();

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  RETURN v_rows_affected;
END;
$function$;

ALTER FUNCTION private.populate_exam_result_items(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.populate_exam_result_items(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.populate_exam_result_items(uuid)
  TO service_role;

COMMIT;
