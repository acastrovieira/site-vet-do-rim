-- =============================================================================
-- SECURITY AUDIT TOTAL HARDENING (2026-11-18)
-- Fecha vulnerabilidades criticas e altas identificadas na auditoria do squad:
--   - CRIT-01: Remove INSERT direto em laudos_pdf, enforca path canonico +
--     unicidade de storage_path, fecha storage policies (can_access_reserved_laudo_object)
--     e protege abandon_laudo_upload contra destruicao cross-tenant.
--   - HIGH-01: Remove bypass `OR created_by/vet_id` sem active clinic membership.
--   - HIGH-02: FORCE RLS em profiles, remove profiles_select_own_or_admin (PII leak),
--     fixa search_path de helpers/triggers e restringe grants por coluna.
--   - HIGH-03/04: Enforca clinic_id NOT NULL nas 6 tabelas clinicas, FKs compostas
--     em exam_result_items, indice case-insensitive por clinica em colaboradores,
--     trigger de imutabilidade estendido e trava de transicao direta para obito.
--   - Rate limit distribuido (8 escopos + expurgo probabilistico), safe_parse_numeric
--     limitado, refund_laudo_ia compativel com pg_cron e auto-renovacao de cota.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Profiles, Helper Admin & Triggers de Cadastro (HIGH-02)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION private.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
$function$;

ALTER FUNCTION private.current_user_is_admin() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.current_user_is_admin()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_raw_name text;
  v_sanitized_name text;
BEGIN
  v_raw_name := COALESCE(
    pg_catalog.btrim(NEW.raw_user_meta_data->>'full_name'),
    pg_catalog.btrim(NEW.email),
    'Novo Usuário'
  );
  v_sanitized_name := NULLIF(
    pg_catalog.substr(
      pg_catalog.regexp_replace(v_raw_name, '[\x00-\x1F\x7F]', '', 'g'),
      1,
      120
    ),
    ''
  );

  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    'tutor',
    COALESCE(v_sanitized_name, 'Novo Usuário')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_ai_quota(user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_caller_role text := COALESCE(
    NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    ''
  );
  v_new_usage integer;
BEGIN
  IF user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'user_id is required';
  END IF;

  IF v_caller_role <> 'service_role'
     AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'service_role_required';
  END IF;

  UPDATE public.profiles AS p
     SET ai_quota_used = COALESCE(p.ai_quota_used, 0) + 1
   WHERE p.id = user_id
     AND COALESCE(p.ai_quota_used, 0) < COALESCE(p.ai_quota_limit, 5)
   RETURNING p.ai_quota_used INTO v_new_usage;

  IF v_new_usage IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'profile not found or quota limit reached';
  END IF;

  RETURN v_new_usage;
END;
$function$;

ALTER FUNCTION public.increment_ai_quota(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.increment_ai_quota(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_quota(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 2. Fechamento de CRIT-01 e HIGH-01 (Storage Bucket, laudos_pdf e RPCs)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('laudos', 'laudos', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS laudos_pdf_insert_active_clinical_member ON public.laudos_pdf;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.laudos_pdf FROM authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS uq_laudos_pdf_storage_path
  ON public.laudos_pdf (storage_path)
  WHERE storage_path IS NOT NULL;

DO $canonical_storage_path$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.laudos_pdf'::regclass
      AND conname = 'chk_laudos_pdf_canonical_storage_path'
  ) THEN
    ALTER TABLE public.laudos_pdf
      ADD CONSTRAINT chk_laudos_pdf_canonical_storage_path
      CHECK (
        (
          origem_resultado = 'manual'
          AND (storage_path IS NULL OR storage_path LIKE 'manual://%')
        )
        OR (
          origem_resultado IN ('pdf_ia', 'pdf_local')
          AND storage_path = pg_catalog.format(
            'clinics/%s/laudos/%s/original.pdf',
            clinic_id,
            id
          )
        )
      ) NOT VALID;
  END IF;
END
$canonical_storage_path$;

CREATE OR REPLACE FUNCTION private.can_access_reserved_laudo_object(
  p_object_name text,
  p_allowed_roles text[],
  p_require_pending boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    p_object_name IS NOT NULL
    AND p_object_name ~ '^clinics/[0-9a-fA-F-]{36}/laudos/[0-9a-fA-F-]{36}/original\.pdf$'
    AND EXISTS (
      SELECT 1
      FROM public.laudos_pdf AS l
      WHERE l.storage_path = p_object_name
        AND l.clinic_id IS NOT NULL
        AND l.storage_path = pg_catalog.format(
          'clinics/%s/laudos/%s/original.pdf',
          l.clinic_id,
          l.id
        )
        AND private.has_clinic_role(l.clinic_id, p_allowed_roles)
        AND (
          NOT p_require_pending
          OR (
            l.status = 'pendente'
            AND (
              l.created_by = (SELECT auth.uid())
              OR l.vet_id = (SELECT auth.uid())
              OR private.has_clinic_role(l.clinic_id, ARRAY['clinic_admin']::text[])
            )
          )
        )
    );
$function$;

ALTER FUNCTION private.can_access_reserved_laudo_object(text, text[], boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.can_access_reserved_laudo_object(text, text[], boolean)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_reserved_laudo_object(text, text[], boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION private.reserve_laudo_upload(p_pet_id uuid)
RETURNS TABLE (
  laudo_id uuid,
  storage_bucket text,
  storage_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_pet record;
  v_new_id uuid;
  v_storage_path text;
  v_open_orphans integer;
  v_actor_recent_reserves integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthenticated';
  END IF;

  IF p_pet_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_request';
  END IF;

  SELECT p.id, p.clinic_id
  INTO v_pet
  FROM public.pets AS p
  WHERE p.id = p_pet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'pet_not_found';
  END IF;

  IF v_pet.clinic_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'tenant_not_ready';
  END IF;

  IF NOT private.has_clinic_role(v_pet.clinic_id, ARRAY['vet', 'clinic_admin']::text[]) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'pet_not_found';
  END IF;

  SELECT count(*)
  INTO v_open_orphans
  FROM public.laudos_pdf AS l
  WHERE l.pet_id = p_pet_id
    AND l.status = 'pendente'
    AND l.created_at > v_now - interval '24 hours'
    AND NOT EXISTS (
      SELECT 1
      FROM storage.objects AS o
      WHERE o.bucket_id = 'laudos'
        AND o.name = l.storage_path
    );

  IF v_open_orphans >= 5 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'reservation_limit_exceeded';
  END IF;

  SELECT count(*)
  INTO v_actor_recent_reserves
  FROM public.laudos_pdf AS l
  WHERE l.clinic_id = v_pet.clinic_id
    AND l.created_by = v_actor
    AND l.origem_resultado IN ('pdf_ia', 'pdf_local')
    AND l.created_at > v_now - interval '24 hours';

  IF v_actor_recent_reserves >= 15 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'reservation_limit_exceeded';
  END IF;

  v_new_id := pg_catalog.gen_random_uuid();
  v_storage_path := pg_catalog.format(
    'clinics/%s/laudos/%s/original.pdf',
    v_pet.clinic_id,
    v_new_id
  );

  INSERT INTO public.laudos_pdf (
    id, pet_id, vet_id, clinic_id, created_by,
    storage_path, nome_arquivo, tipo_exame, status, origem_resultado
  )
  VALUES (
    v_new_id, p_pet_id, v_actor, v_pet.clinic_id, v_actor,
    v_storage_path, 'original.pdf', 'hemograma', 'pendente', 'pdf_ia'
  );

  RETURN QUERY
  SELECT v_new_id, 'laudos'::text, v_storage_path;
END;
$function$;

ALTER FUNCTION private.reserve_laudo_upload(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.reserve_laudo_upload(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.reserve_laudo_upload(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.abandon_laudo_upload(p_laudo_id uuid)
RETURNS TABLE (
  disposition text,
  storage_bucket text,
  storage_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_laudo record;
  v_expected_path text;
  v_now timestamptz := pg_catalog.clock_timestamp();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthenticated';
  END IF;

  IF p_laudo_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_request';
  END IF;

  SELECT l.id, l.status, l.clinic_id, l.created_by, l.vet_id, l.storage_path
  INTO v_laudo
  FROM public.laudos_pdf AS l
  WHERE l.id = p_laudo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'laudo_not_found';
  END IF;

  IF v_laudo.clinic_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'tenant_not_ready';
  END IF;

  IF NOT private.has_clinic_role(v_laudo.clinic_id, ARRAY['vet', 'clinic_admin']::text[]) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'laudo_not_found';
  END IF;

  IF NOT (
    v_laudo.created_by = v_actor
    OR v_laudo.vet_id = v_actor
    OR private.has_clinic_role(v_laudo.clinic_id, ARRAY['clinic_admin']::text[])
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'laudo_not_found';
  END IF;

  v_expected_path := pg_catalog.format(
    'clinics/%s/laudos/%s/original.pdf',
    v_laudo.clinic_id,
    v_laudo.id
  );

  IF v_laudo.storage_path IS DISTINCT FROM v_expected_path THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid_storage_path';
  END IF;

  IF v_laudo.status = 'abandonado' THEN
    RETURN QUERY
    SELECT 'already_abandoned'::text, 'laudos'::text, v_laudo.storage_path;
    RETURN;
  END IF;

  IF v_laudo.status <> 'pendente' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid_laudo_state';
  END IF;

  UPDATE public.laudos_pdf AS l
  SET
    status = 'abandonado',
    abandoned_at = v_now,
    abandoned_by = v_actor
  WHERE l.id = p_laudo_id;

  RETURN QUERY
  SELECT 'abandoned'::text, 'laudos'::text, v_laudo.storage_path;
END;
$function$;

ALTER FUNCTION private.abandon_laudo_upload(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.abandon_laudo_upload(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.abandon_laudo_upload(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Tenancy Estrutural, FKs Compostas & Imutabilidade (HIGH-03 / HIGH-04)
-- -----------------------------------------------------------------------------
ALTER TABLE public.tutores ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.pets ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.triagens ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.follow_ups ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.colaboradores ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.laudos_pdf ALTER COLUMN clinic_id SET NOT NULL;

ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.clinics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tutores FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.triagens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups FORCE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores FORCE ROW LEVEL SECURITY;
ALTER TABLE public.laudos_pdf FORCE ROW LEVEL SECURITY;
ALTER TABLE public.exam_result_items FORCE ROW LEVEL SECURITY;
ALTER TABLE private.clinical_rate_limit_windows FORCE ROW LEVEL SECURITY;

ALTER TABLE public.colaboradores DROP CONSTRAINT IF EXISTS colaboradores_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_colaboradores_clinic_email_ci
  ON public.colaboradores (clinic_id, lower(email));

DO $exam_items_fks$
DECLARE
  v_constraint record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.exam_result_items'::regclass
      AND conname = 'fk_exam_items_laudo_same_clinic'
  ) THEN
    ALTER TABLE public.exam_result_items
      ADD CONSTRAINT fk_exam_items_laudo_same_clinic
      FOREIGN KEY (clinic_id, laudo_id)
      REFERENCES public.laudos_pdf(clinic_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.exam_result_items'::regclass
      AND conname = 'fk_exam_items_pet_same_clinic'
  ) THEN
    ALTER TABLE public.exam_result_items
      ADD CONSTRAINT fk_exam_items_pet_same_clinic
      FOREIGN KEY (clinic_id, pet_id)
      REFERENCES public.pets(clinic_id, id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  FOR v_constraint IN
    SELECT c.conname
    FROM pg_constraint AS c
    WHERE c.conrelid = 'public.exam_result_items'::regclass
      AND NOT c.convalidated
      AND c.conname IN (
        'fk_exam_items_laudo_same_clinic',
        'fk_exam_items_pet_same_clinic'
      )
  LOOP
    EXECUTE pg_catalog.format(
      'ALTER TABLE public.exam_result_items VALIDATE CONSTRAINT %I',
      v_constraint.conname
    );
  END LOOP;
END
$exam_items_fks$;

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
  v_old_created_by text := pg_catalog.to_jsonb(OLD)->>'created_by';
  v_new_created_by text := pg_catalog.to_jsonb(NEW)->>'created_by';
BEGIN
  IF v_request_role = 'service_role'
     OR SESSION_USER IN ('postgres', 'supabase_admin', 'supabase_auth_admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.id IS NOT NULL AND NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'id_immutable';
  END IF;

  IF OLD.clinic_id IS NOT NULL AND NEW.clinic_id IS DISTINCT FROM OLD.clinic_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'clinic_id_immutable';
  END IF;

  IF v_old_created_by IS NOT NULL AND v_new_created_by IS DISTINCT FROM v_old_created_by THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'created_by_immutable';
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION private.enforce_tenant_row_immutability() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.enforce_tenant_row_immutability() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_enforce_tenant_immutability ON public.exam_result_items;
CREATE TRIGGER trg_enforce_tenant_immutability
  BEFORE UPDATE ON public.exam_result_items
  FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row_immutability();

CREATE OR REPLACE FUNCTION private.prevent_direct_pet_death_transition()
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

  IF TG_OP = 'INSERT' THEN
    IF NEW.status_paciente = 'obito' OR NEW.data_obito IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'death_workflow_required';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status_paciente = 'obito' AND NEW.status_paciente IS DISTINCT FROM 'obito' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'death_status_immutable';
  END IF;

  IF NEW.status_paciente = 'obito' AND OLD.status_paciente IS DISTINCT FROM 'obito' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'death_workflow_required';
  END IF;

  IF NEW.data_obito IS DISTINCT FROM OLD.data_obito THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'death_workflow_required';
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION private.prevent_direct_pet_death_transition() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.prevent_direct_pet_death_transition() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_pets_prevent_direct_death_transition ON public.pets;
CREATE TRIGGER trg_pets_prevent_direct_death_transition
  BEFORE INSERT OR UPDATE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION private.prevent_direct_pet_death_transition();

-- -----------------------------------------------------------------------------
-- 4. Privilegios Minimos por Coluna para Data API (authenticated)
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE
  public.profiles,
  public.clinics,
  public.clinic_memberships,
  public.tutores,
  public.pets,
  public.triagens,
  public.follow_ups,
  public.colaboradores,
  public.laudos_pdf,
  public.exam_result_items
FROM anon, authenticated;

GRANT SELECT ON TABLE
  public.profiles,
  public.clinics,
  public.clinic_memberships,
  public.tutores,
  public.pets,
  public.triagens,
  public.follow_ups,
  public.colaboradores,
  public.laudos_pdf,
  public.exam_result_items
TO authenticated;

GRANT UPDATE (full_name, document, phone, address)
  ON TABLE public.profiles TO authenticated;

GRANT INSERT (
  clinic_id, created_by, nome, cpf, telefone, email,
  cep, endereco, cidade, estado, lgpd_aceito_em
) ON TABLE public.tutores TO authenticated;

GRANT UPDATE (
  nome, cpf, telefone, email, cep, endereco,
  cidade, estado, lgpd_aceito_em, atualizado_em
) ON TABLE public.tutores TO authenticated;

GRANT INSERT (
  clinic_id, created_by, tutor_id, nome, especie, raca,
  idade_anos, idade_meses, peso_atual, status_paciente
) ON TABLE public.pets TO authenticated;

GRANT UPDATE (
  tutor_id, nome, especie, raca, idade_anos, idade_meses,
  peso_atual, status_paciente, atualizado_em
) ON TABLE public.pets TO authenticated;

GRANT INSERT (
  clinic_id, created_by, pet_id, tutor_id, status, observacoes
) ON TABLE public.triagens TO authenticated;

GRANT UPDATE (
  pet_id, tutor_id, status, observacoes, atualizado_em
) ON TABLE public.triagens TO authenticated;

GRANT INSERT (
  clinic_id, created_by, triagem_id, opt_out, canal, scheduled_at, sent_at
) ON TABLE public.follow_ups TO authenticated;

GRANT UPDATE (
  opt_out, canal, scheduled_at, sent_at, atualizado_em
) ON TABLE public.follow_ups TO authenticated;

GRANT INSERT (
  clinic_id, created_by, supabase_uid, nome, email, cargo,
  nivel_acesso, crmv, telefone, ativo, termos_aceitos_em
) ON TABLE public.colaboradores TO authenticated;

GRANT UPDATE (
  supabase_uid, nome, email, cargo, nivel_acesso,
  crmv, telefone, ativo, termos_aceitos_em, atualizado_em
) ON TABLE public.colaboradores TO authenticated;

REVOKE ALL ON TABLE private.clinical_rate_limit_windows
  FROM PUBLIC, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Rate Limit Distribuido (8 Escopos), safe_parse_numeric e Claims
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_clinical_rate_limit(p_scope text)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private, auth
AS $function$
DECLARE
  v_actor_user_id uuid := auth.uid();
  v_limit integer;
  v_window_seconds integer;
  v_window_started_at timestamptz;
  v_request_count integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'unauthenticated';
  END IF;

  IF random() < 0.05 THEN
    DELETE FROM private.clinical_rate_limit_windows
    WHERE window_started_at < v_now - interval '5 minutes';
  END IF;

  CASE p_scope
    WHEN 'laudo_reserve' THEN v_limit := 10; v_window_seconds := 60;
    WHEN 'laudo_abandon' THEN v_limit := 10; v_window_seconds := 60;
    WHEN 'laudo_local_extraction' THEN v_limit := 20; v_window_seconds := 60;
    WHEN 'laudo_ai_parse' THEN v_limit := 5; v_window_seconds := 60;
    WHEN 'lab_export' THEN v_limit := 30; v_window_seconds := 60;
    WHEN 'pets_mutation' THEN v_limit := 30; v_window_seconds := 60;
    WHEN 'tutores_mutation' THEN v_limit := 30; v_window_seconds := 60;
    WHEN 'profile_mutation' THEN v_limit := 10; v_window_seconds := 60;
    ELSE RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_rate_limit_scope';
  END CASE;

  INSERT INTO private.clinical_rate_limit_windows AS rate_limit (
    scope, actor_user_id, window_started_at, request_count
  ) VALUES (p_scope, v_actor_user_id, v_now, 1)
  ON CONFLICT (scope, actor_user_id) DO UPDATE
  SET
    window_started_at = CASE
      WHEN rate_limit.window_started_at + make_interval(secs => v_window_seconds) <= v_now THEN v_now
      ELSE rate_limit.window_started_at
    END,
    request_count = CASE
      WHEN rate_limit.window_started_at + make_interval(secs => v_window_seconds) <= v_now THEN 1
      ELSE rate_limit.request_count + 1
    END
  RETURNING rate_limit.window_started_at, rate_limit.request_count
  INTO v_window_started_at, v_request_count;

  IF v_request_count <= v_limit THEN
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    false,
    GREATEST(1, CEIL(EXTRACT(EPOCH FROM (
      (v_window_started_at + make_interval(secs => v_window_seconds)) - v_now
    )))::integer);
END;
$function$;

ALTER FUNCTION public.consume_clinical_rate_limit(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.consume_clinical_rate_limit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_clinical_rate_limit(text) TO authenticated;

CREATE OR REPLACE FUNCTION private.safe_parse_numeric(p_value text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $function$
DECLARE
  v_trimmed text := pg_catalog.btrim(COALESCE(p_value, ''));
  v_num numeric;
BEGIN
  IF v_trimmed = '' THEN
    RETURN NULL;
  END IF;
  v_num := v_trimmed::numeric;
  IF v_num < 0 OR v_num >= 100000000 THEN
    RETURN NULL;
  END IF;
  RETURN v_num;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$function$;

ALTER FUNCTION private.safe_parse_numeric(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.safe_parse_numeric(text) FROM PUBLIC;

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
  IF v_request_role <> 'service_role'
     AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
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
REVOKE ALL ON FUNCTION private.refund_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, boolean, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.refund_laudo_ia(uuid, uuid, uuid, uuid, uuid, uuid, boolean, text)
  TO service_role;

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
    UPDATE public.profiles AS p
    SET
      ai_quota_used = 0,
      ai_quota_reset_date = v_now + interval '30 days'
    WHERE p.id = p_actor_user_id
    RETURNING p.ai_quota_used, p.ai_quota_limit, p.ai_quota_reset_date
    INTO v_quota_used, v_quota_limit, v_quota_reset_date;
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
REVOKE ALL ON FUNCTION private.claim_laudo_ia(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.claim_laudo_ia(uuid, uuid, uuid, uuid)
  TO service_role;

COMMIT;
