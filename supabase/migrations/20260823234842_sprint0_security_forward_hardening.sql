-- Sprint 0 security forward-fix.
--
-- This migration intentionally does not rewrite the historical PERF-002 or
-- FEAT-001 migrations. It replaces their final database state with:
--   * clinic-membership-scoped RLS on every tenant-owned public table;
--   * no direct authenticated UPDATE path for laudos_pdf;
--   * a narrow public Data API wrapper for populate_exam_result_items;
--   * a transaction-safe definition of the cleanup index.

BEGIN;

DO $preflight$
DECLARE
  required_relation text;
BEGIN
  FOREACH required_relation IN ARRAY ARRAY[
    'public.clinics',
    'public.clinic_memberships',
    'public.tutores',
    'public.pets',
    'public.triagens',
    'public.follow_ups',
    'public.colaboradores',
    'public.laudos_pdf',
    'public.exam_result_items'
  ]
  LOOP
    IF pg_catalog.to_regclass(required_relation) IS NULL THEN
      RAISE EXCEPTION 'missing Sprint 0 security prerequisite: %', required_relation;
    END IF;
  END LOOP;

  IF pg_catalog.to_regprocedure('private.has_clinic_role(uuid,text[])') IS NULL THEN
    RAISE EXCEPTION 'missing Sprint 0 security prerequisite: private.has_clinic_role(uuid,text[])';
  END IF;

  IF pg_catalog.to_regprocedure('private.populate_exam_result_items(uuid)') IS NULL THEN
    RAISE EXCEPTION 'missing Sprint 0 security prerequisite: private.populate_exam_result_items(uuid)';
  END IF;
END
$preflight$;

-- Policies are permissive/OR-combined by default. Drop every policy from the
-- target tenant tables before installing the reviewed allowlist so a legacy
-- role-based policy cannot silently keep cross-clinic access open.
DO $drop_tenant_policies$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'tutores',
        'pets',
        'triagens',
        'follow_ups',
        'colaboradores',
        'laudos_pdf',
        'exam_result_items'
      ]::name[])
  LOOP
    EXECUTE pg_catalog.format(
      'DROP POLICY %I ON %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  END LOOP;
END
$drop_tenant_policies$;

ALTER TABLE public.tutores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutores FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.triagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triagens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups FORCE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores FORCE ROW LEVEL SECURITY;
ALTER TABLE public.laudos_pdf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laudos_pdf FORCE ROW LEVEL SECURITY;
ALTER TABLE public.exam_result_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_result_items FORCE ROW LEVEL SECURITY;

-- Data API grants are independent from RLS. New Supabase projects no longer
-- auto-expose tables, so declare the browser and trusted-server privileges
-- explicitly instead of relying on a project-level legacy default.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
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
TO service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.profiles,
  public.tutores,
  public.pets,
  public.triagens,
  public.follow_ups,
  public.colaboradores
TO authenticated;

GRANT SELECT ON TABLE
  public.clinics,
  public.clinic_memberships,
  public.exam_result_items
TO authenticated;

GRANT SELECT, INSERT ON TABLE public.laudos_pdf TO authenticated;

-- Registration data: reception, vets and clinic admins may work only inside
-- a clinic where their membership and the clinic itself are both active.
CREATE POLICY tutores_select_active_member
  ON public.tutores
  FOR SELECT
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet', 'recepcao']::text[]
    )
  );

CREATE POLICY tutores_insert_active_member
  ON public.tutores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet', 'recepcao']::text[]
    )
  );

CREATE POLICY tutores_update_active_member
  ON public.tutores
  FOR UPDATE
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet', 'recepcao']::text[]
    )
  )
  WITH CHECK (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet', 'recepcao']::text[]
    )
  );

CREATE POLICY pets_select_active_member
  ON public.pets
  FOR SELECT
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet', 'recepcao']::text[]
    )
  );

CREATE POLICY pets_insert_active_member
  ON public.pets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet', 'recepcao']::text[]
    )
  );

CREATE POLICY pets_update_active_member
  ON public.pets
  FOR UPDATE
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet', 'recepcao']::text[]
    )
  )
  WITH CHECK (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet', 'recepcao']::text[]
    )
  );

-- Clinical data is deliberately denied to reception memberships.
CREATE POLICY triagens_select_active_clinical_member
  ON public.triagens
  FOR SELECT
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet']::text[]
    )
  );

CREATE POLICY triagens_insert_active_clinical_member
  ON public.triagens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet']::text[]
    )
  );

CREATE POLICY triagens_update_active_clinical_member
  ON public.triagens
  FOR UPDATE
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet']::text[]
    )
  )
  WITH CHECK (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet']::text[]
    )
  );

CREATE POLICY follow_ups_select_active_clinical_member
  ON public.follow_ups
  FOR SELECT
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet']::text[]
    )
  );

CREATE POLICY follow_ups_insert_active_clinical_member
  ON public.follow_ups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet']::text[]
    )
  );

CREATE POLICY follow_ups_update_active_clinical_member
  ON public.follow_ups
  FOR UPDATE
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet']::text[]
    )
  )
  WITH CHECK (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet']::text[]
    )
  );

CREATE POLICY colaboradores_select_active_clinic_directory
  ON public.colaboradores
  FOR SELECT
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet', 'recepcao']::text[]
    )
    AND (
      ativo = true
      OR private.has_clinic_role(
        clinic_id,
        ARRAY['clinic_admin']::text[]
      )
    )
  );

CREATE POLICY colaboradores_insert_active_clinic_admin
  ON public.colaboradores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin']::text[]
    )
  );

CREATE POLICY colaboradores_update_active_clinic_admin
  ON public.colaboradores
  FOR UPDATE
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin']::text[]
    )
  )
  WITH CHECK (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin']::text[]
    )
  );

CREATE POLICY laudos_pdf_select_active_clinical_member
  ON public.laudos_pdf
  FOR SELECT
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet']::text[]
    )
  );

-- Reservation stays available for compatibility, but every caller must be a
-- clinical member of the row's clinic and can reserve only as themselves.
CREATE POLICY laudos_pdf_insert_active_clinical_member
  ON public.laudos_pdf
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND vet_id = (SELECT auth.uid())
    AND private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet']::text[]
    )
  );

CREATE POLICY exam_result_items_select_active_clinical_member
  ON public.exam_result_items
  FOR SELECT
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet']::text[]
    )
  );

-- Policies cannot grant an operation that the role does not have, but they do
-- not revoke a historical table-level grant. Remove the direct write path so
-- lifecycle fields remain writable only through controlled server/RPC flows.
REVOKE UPDATE ON TABLE public.laudos_pdf FROM authenticated;

-- The role-only helper introduced by PERF-002 is no longer an authorization
-- source and no longer needs to remain a callable SECURITY DEFINER endpoint.
DROP FUNCTION IF EXISTS public.current_user_is_vet_or_admin();

-- PostgREST exposes public, not private. Keep the privileged implementation in
-- private and publish only this invoker wrapper for the service-role Edge call.
CREATE OR REPLACE FUNCTION public.populate_exam_result_items(p_laudo_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.populate_exam_result_items(p_laudo_id);
$function$;

ALTER FUNCTION public.populate_exam_result_items(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION private.populate_exam_result_items(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.populate_exam_result_items(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.populate_exam_result_items(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.populate_exam_result_items(uuid)
  TO service_role;

COMMENT ON FUNCTION public.populate_exam_result_items(uuid) IS
  'Service-role-only Data API wrapper for private.populate_exam_result_items(uuid).';

-- Historical FEAT-001 used CREATE INDEX CONCURRENTLY inside BEGIN/COMMIT,
-- which PostgreSQL rejects. Define the same partial index transaction-safely
-- in the forward state. IF NOT EXISTS preserves an already valid deployment.
CREATE INDEX IF NOT EXISTS idx_laudos_pending_deletion
  ON public.laudos_pdf (created_at ASC)
  WHERE status = 'concluido' AND storage_deleted_at IS NULL;

COMMIT;
