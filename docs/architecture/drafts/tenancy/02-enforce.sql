-- QUARANTINED DRAFT — DO NOT EXECUTE OR COPY DIRECTLY TO supabase/migrations.
-- Requires 01-expand.sql plus a separately reviewed, complete backfill.
-- This is a fail-closed, atomic enforcement candidate for ADR-001.

BEGIN;

-- Mechanical quarantine: comments are not a safety boundary. Promotion must
-- derive a new reviewed migration and deliberately remove this sentinel there.
DO $quarantine$
BEGIN
  RAISE EXCEPTION
    'QUARANTINED ADR-001 draft: derive a new reviewed migration; do not execute this file';
END
$quarantine$;

-- ---------------------------------------------------------------------------
-- Preflight: abort before changing policies/grants when any invariant is weak.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  required_column record;
BEGIN
  FOR required_column IN
    SELECT *
    FROM (VALUES
      ('tutores', 'clinic_id'), ('tutores', 'created_by'),
      ('pets', 'clinic_id'), ('pets', 'created_by'),
      ('triagens', 'clinic_id'), ('triagens', 'created_by'),
      ('follow_ups', 'clinic_id'), ('follow_ups', 'created_by'),
      ('colaboradores', 'clinic_id'), ('colaboradores', 'created_by'),
      ('laudos_pdf', 'clinic_id'), ('laudos_pdf', 'created_by')
    ) AS required_columns(table_name, column_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns AS c
      WHERE c.table_schema = 'public'
        AND c.table_name = required_column.table_name
        AND c.column_name = required_column.column_name
        AND c.data_type = 'uuid'
    ) THEN
      RAISE EXCEPTION 'Missing or incompatible column public.%.%',
        required_column.table_name,
        required_column.column_name;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.tutores WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.pets WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.triagens WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.follow_ups WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.colaboradores WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.laudos_pdf WHERE clinic_id IS NULL) THEN
    RAISE EXCEPTION 'Enforcement blocked: one or more tenant rows have NULL clinic_id';
  END IF;

  -- Legacy-looking rows (no actor) must have an approved manifest entry that
  -- exactly matches the populated clinic. New dual-written rows have created_by.
  IF EXISTS (
    SELECT 1
    FROM public.tutores AS e
    LEFT JOIN private.tenant_backfill_manifest AS m
      ON m.entity_table = 'tutores' AND m.entity_id = e.id
    WHERE e.created_by IS NULL
      AND (m.decision IS DISTINCT FROM 'approved'
        OR m.target_clinic_id IS DISTINCT FROM e.clinic_id)
    UNION ALL
    SELECT 1
    FROM public.pets AS e
    LEFT JOIN private.tenant_backfill_manifest AS m
      ON m.entity_table = 'pets' AND m.entity_id = e.id
    WHERE e.created_by IS NULL
      AND (m.decision IS DISTINCT FROM 'approved'
        OR m.target_clinic_id IS DISTINCT FROM e.clinic_id)
    UNION ALL
    SELECT 1
    FROM public.triagens AS e
    LEFT JOIN private.tenant_backfill_manifest AS m
      ON m.entity_table = 'triagens' AND m.entity_id = e.id
    WHERE e.created_by IS NULL
      AND (m.decision IS DISTINCT FROM 'approved'
        OR m.target_clinic_id IS DISTINCT FROM e.clinic_id)
    UNION ALL
    SELECT 1
    FROM public.follow_ups AS e
    LEFT JOIN private.tenant_backfill_manifest AS m
      ON m.entity_table = 'follow_ups' AND m.entity_id = e.id
    WHERE e.created_by IS NULL
      AND (m.decision IS DISTINCT FROM 'approved'
        OR m.target_clinic_id IS DISTINCT FROM e.clinic_id)
    UNION ALL
    SELECT 1
    FROM public.colaboradores AS e
    LEFT JOIN private.tenant_backfill_manifest AS m
      ON m.entity_table = 'colaboradores' AND m.entity_id = e.id
    WHERE e.created_by IS NULL
      AND (m.decision IS DISTINCT FROM 'approved'
        OR m.target_clinic_id IS DISTINCT FROM e.clinic_id)
    UNION ALL
    SELECT 1
    FROM public.laudos_pdf AS e
    LEFT JOIN private.tenant_backfill_manifest AS m
      ON m.entity_table = 'laudos_pdf' AND m.entity_id = e.id
    WHERE e.created_by IS NULL
      AND (m.decision IS DISTINCT FROM 'approved'
        OR m.target_clinic_id IS DISTINCT FROM e.clinic_id)
  ) THEN
    RAISE EXCEPTION 'Enforcement blocked: legacy-looking rows lack an approved matching manifest';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clinics AS c
    WHERE c.status = 'active'
      AND NOT EXISTS (
        SELECT 1
        FROM public.clinic_memberships AS m
        WHERE m.clinic_id = c.id
          AND m.role = 'clinic_admin'
          AND m.status = 'active'
      )
  ) THEN
    RAISE EXCEPTION 'Enforcement blocked: every active clinic needs an active clinic_admin';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pets AS p
    JOIN public.tutores AS t ON t.id = p.tutor_id
    WHERE p.clinic_id IS DISTINCT FROM t.clinic_id
  ) THEN
    RAISE EXCEPTION 'Enforcement blocked: pet/tutor cross-tenant relation found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.triagens AS tr
    JOIN public.pets AS p ON p.id = tr.pet_id
    WHERE tr.clinic_id IS DISTINCT FROM p.clinic_id
      OR (tr.tutor_id IS NOT NULL AND tr.tutor_id IS DISTINCT FROM p.tutor_id)
  ) THEN
    RAISE EXCEPTION 'Enforcement blocked: triagem/pet/tutor relation is inconsistent';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.follow_ups AS f
    JOIN public.triagens AS tr ON tr.id = f.triagem_id
    WHERE f.clinic_id IS DISTINCT FROM tr.clinic_id
  ) THEN
    RAISE EXCEPTION 'Enforcement blocked: follow_up/triagem cross-tenant relation found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.laudos_pdf AS l
    JOIN public.pets AS p ON p.id = l.pet_id
    WHERE l.clinic_id IS DISTINCT FROM p.clinic_id
  ) THEN
    RAISE EXCEPTION 'Enforcement blocked: laudo/pet cross-tenant relation found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.laudos_pdf AS l
    WHERE l.vet_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.clinic_memberships AS m
        WHERE m.clinic_id = l.clinic_id
          AND m.user_id = l.vet_id
      )
  ) THEN
    RAISE EXCEPTION 'Enforcement blocked: laudo vet_id has no membership in its clinic';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.colaboradores AS c
    WHERE c.supabase_uid IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.clinic_memberships AS m
        WHERE m.clinic_id = c.clinic_id
          AND m.user_id = c.supabase_uid
      )
  ) THEN
    RAISE EXCEPTION 'Enforcement blocked: colaborador user has no membership in its clinic';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.laudos_pdf
    GROUP BY storage_path
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Enforcement blocked: duplicate laudos_pdf.storage_path found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets AS b
    WHERE b.id = 'laudos'
      AND b.public = false
      AND b.file_size_limit IS NOT NULL
      AND b.file_size_limit <= 10485760
      AND b.allowed_mime_types = ARRAY['application/pdf']::text[]
  ) THEN
    RAISE EXCEPTION 'Enforcement blocked: laudos bucket must be private, PDF-only and limited to 10 MiB';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class AS c
    JOIN pg_namespace AS n
      ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Enforcement blocked: RLS is not enabled on storage.objects';
  END IF;

  -- Policies on storage.objects are permissive/OR-combined. An unreviewed
  -- policy could bypass the exact-record join even if the new policies are
  -- correct, so unknown names block promotion instead of being silently kept
  -- or dropped (which could break a different bucket).
  IF EXISTS (
    SELECT 1
    FROM pg_policies AS p
    WHERE p.schemaname = 'storage'
      AND p.tablename = 'objects'
      AND p.policyname <> ALL (ARRAY[
        'auth_upload_laudos',
        'auth_read_laudos',
        'vet_upload_laudos',
        'vet_read_own_laudos',
        'vet_delete_own_laudos',
        'admin_all_storage_laudos',
        'laudos_upload',
        'laudos_read',
        'laudos_delete',
        'owner_upload_laudos',
        'owner_read_laudos',
        'storage_laudos_insert_reserved',
        'storage_laudos_select_member',
        'storage_laudos_insert_exact_record',
        'storage_laudos_select_exact_record'
      ]::name[])
  ) THEN
    RAISE EXCEPTION 'Enforcement blocked: unreviewed policy exists on storage.objects';
  END IF;

  -- A pending row may be a legitimate reservation awaiting upload. Any row that
  -- advanced beyond pending must already map to exact Storage metadata.
  IF EXISTS (
    SELECT 1
    FROM public.laudos_pdf AS l
    LEFT JOIN storage.objects AS o
      ON o.bucket_id = 'laudos'
      AND o.name = l.storage_path
    WHERE l.status <> 'pendente'
      AND o.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Enforcement blocked: non-pending laudo has no exact Storage object';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.colaboradores
    GROUP BY clinic_id, lower(email)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Enforcement blocked: duplicate collaborator email inside a clinic';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Constraints and tenant immutability.
-- ---------------------------------------------------------------------------
ALTER TABLE public.tutores ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.pets ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.triagens ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.follow_ups ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.colaboradores ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.laudos_pdf ALTER COLUMN clinic_id SET NOT NULL;

ALTER TABLE public.tutores VALIDATE CONSTRAINT fk_tutores_clinic;
ALTER TABLE public.tutores VALIDATE CONSTRAINT fk_tutores_created_by;

ALTER TABLE public.pets VALIDATE CONSTRAINT fk_pets_clinic;
ALTER TABLE public.pets VALIDATE CONSTRAINT fk_pets_created_by;
ALTER TABLE public.pets VALIDATE CONSTRAINT fk_pets_tutor_same_clinic;

ALTER TABLE public.triagens VALIDATE CONSTRAINT fk_triagens_clinic;
ALTER TABLE public.triagens VALIDATE CONSTRAINT fk_triagens_created_by;
ALTER TABLE public.triagens VALIDATE CONSTRAINT fk_triagens_pet_same_clinic;
ALTER TABLE public.triagens VALIDATE CONSTRAINT fk_triagens_pet_tutor_same_clinic;

ALTER TABLE public.follow_ups VALIDATE CONSTRAINT fk_follow_ups_clinic;
ALTER TABLE public.follow_ups VALIDATE CONSTRAINT fk_follow_ups_created_by;
ALTER TABLE public.follow_ups VALIDATE CONSTRAINT fk_follow_ups_triagem_same_clinic;

ALTER TABLE public.colaboradores VALIDATE CONSTRAINT fk_colaboradores_clinic;
ALTER TABLE public.colaboradores VALIDATE CONSTRAINT fk_colaboradores_created_by;
ALTER TABLE public.colaboradores VALIDATE CONSTRAINT fk_colaboradores_membership_same_clinic;

ALTER TABLE public.laudos_pdf VALIDATE CONSTRAINT fk_laudos_pdf_clinic;
ALTER TABLE public.laudos_pdf VALIDATE CONSTRAINT fk_laudos_pdf_created_by;
ALTER TABLE public.laudos_pdf VALIDATE CONSTRAINT fk_laudos_pdf_pet_same_clinic;
ALTER TABLE public.laudos_pdf VALIDATE CONSTRAINT fk_laudos_pdf_vet_membership;

-- Replace the legacy global e-mail uniqueness with tenant-local uniqueness.
ALTER TABLE public.colaboradores
  DROP CONSTRAINT IF EXISTS colaboradores_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_colaboradores_clinic_email_ci
  ON public.colaboradores(clinic_id, lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS uq_laudos_pdf_storage_path
  ON public.laudos_pdf(storage_path);

CREATE OR REPLACE FUNCTION private.enforce_tenant_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.clinic_id IS NULL THEN
      RAISE EXCEPTION 'clinic_id is required';
    END IF;

    IF actor_id IS NOT NULL THEN
      NEW.created_by := actor_id;
    ELSIF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
      IF NEW.created_by IS NULL THEN
        RAISE EXCEPTION 'privileged inserts must provide created_by';
      END IF;
    ELSE
      RAISE EXCEPTION 'authenticated actor is required';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.clinic_id IS DISTINCT FROM OLD.clinic_id THEN
    RAISE EXCEPTION 'clinic_id is immutable';
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    -- The FK deliberately anonymizes a deleted Auth principal. Permit only
    -- that referential action; a normal actor cannot clear or replace it.
    IF NOT (
      OLD.created_by IS NOT NULL
      AND NEW.created_by IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM auth.users AS u
        WHERE u.id = OLD.created_by
      )
    ) THEN
      RAISE EXCEPTION 'created_by is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.prepare_laudo_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
BEGIN
  IF NEW.id IS NULL THEN
    RAISE EXCEPTION 'laudo id must be generated before the insert trigger';
  END IF;

  IF actor_id IS NOT NULL THEN
    NEW.vet_id := actor_id;
    NEW.created_by := actor_id;
  ELSIF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    IF NEW.vet_id IS NULL OR NEW.created_by IS NULL THEN
      RAISE EXCEPTION 'privileged laudo inserts require vet_id and created_by';
    END IF;
  ELSE
    RAISE EXCEPTION 'authenticated actor is required';
  END IF;

  NEW.storage_path := pg_catalog.format(
    'clinics/%s/laudos/%s/original.pdf',
    NEW.clinic_id,
    NEW.id
  );
  NEW.status := 'pendente';
  NEW.resultado_ia := NULL;
  NEW.erro_ia := NULL;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_laudo_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.pet_id IS DISTINCT FROM OLD.pet_id
    OR NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN
    RAISE EXCEPTION 'laudo identity fields are immutable';
  END IF;

  IF NEW.vet_id IS DISTINCT FROM OLD.vet_id
    AND NOT (
      OLD.vet_id IS NOT NULL
      AND NEW.vet_id IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.clinic_memberships AS m
        WHERE m.clinic_id = OLD.clinic_id
          AND m.user_id = OLD.vet_id
      )
    ) THEN
    RAISE EXCEPTION 'laudo vet identity is immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_active_clinic_has_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  old_clinic_id uuid;
  new_clinic_id uuid;
  target_clinic_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'clinics' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      old_clinic_id := OLD.id;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      new_clinic_id := NEW.id;
    END IF;
  ELSE
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      old_clinic_id := OLD.clinic_id;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      new_clinic_id := NEW.clinic_id;
    END IF;
  END IF;

  FOREACH target_clinic_id IN ARRAY ARRAY[old_clinic_id, new_clinic_id]
  LOOP
    IF target_clinic_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.clinics AS c
        WHERE c.id = target_clinic_id
          AND c.status = 'active'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.clinic_memberships AS m
        WHERE m.clinic_id = target_clinic_id
          AND m.role = 'clinic_admin'
          AND m.status = 'active'
      ) THEN
      RAISE EXCEPTION 'active clinic % must keep an active clinic_admin', target_clinic_id;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

ALTER FUNCTION private.enforce_tenant_row() OWNER TO postgres;
ALTER FUNCTION private.prepare_laudo_insert() OWNER TO postgres;
ALTER FUNCTION private.enforce_laudo_immutable_fields() OWNER TO postgres;
ALTER FUNCTION private.assert_active_clinic_has_admin() OWNER TO postgres;

REVOKE ALL ON FUNCTION private.enforce_tenant_row()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.prepare_laudo_insert()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.enforce_laudo_immutable_fields()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.assert_active_clinic_has_admin()
  FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'tutores',
    'pets',
    'triagens',
    'follow_ups',
    'colaboradores',
    'laudos_pdf'
  ]
  LOOP
    EXECUTE pg_catalog.format(
      'DROP TRIGGER IF EXISTS trg_00_enforce_tenant_row ON public.%I',
      target_table
    );
    EXECUTE pg_catalog.format(
      'CREATE TRIGGER trg_00_enforce_tenant_row '
      'BEFORE INSERT OR UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row()',
      target_table
    );
  END LOOP;
END
$$;

DROP TRIGGER IF EXISTS trg_10_prepare_laudo_insert ON public.laudos_pdf;
CREATE TRIGGER trg_10_prepare_laudo_insert
  BEFORE INSERT ON public.laudos_pdf
  FOR EACH ROW EXECUTE FUNCTION private.prepare_laudo_insert();

DROP TRIGGER IF EXISTS trg_20_enforce_laudo_immutable_fields ON public.laudos_pdf;
CREATE TRIGGER trg_20_enforce_laudo_immutable_fields
  BEFORE UPDATE ON public.laudos_pdf
  FOR EACH ROW EXECUTE FUNCTION private.enforce_laudo_immutable_fields();

DROP TRIGGER IF EXISTS trg_clinic_requires_admin ON public.clinics;
CREATE CONSTRAINT TRIGGER trg_clinic_requires_admin
  AFTER INSERT OR UPDATE OR DELETE ON public.clinics
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION private.assert_active_clinic_has_admin();

DROP TRIGGER IF EXISTS trg_membership_preserves_admin
  ON public.clinic_memberships;
CREATE CONSTRAINT TRIGGER trg_membership_preserves_admin
  AFTER INSERT OR UPDATE OR DELETE ON public.clinic_memberships
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION private.assert_active_clinic_has_admin();

-- ---------------------------------------------------------------------------
-- Replace every policy on the target public tables in the same transaction.
-- Unknown remote policies are not allowed to survive by name.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'profiles',
        'clinics',
        'clinic_memberships',
        'tutores',
        'pets',
        'triagens',
        'follow_ups',
        'colaboradores',
        'laudos_pdf'
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
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_memberships FORCE ROW LEVEL SECURITY;
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

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY clinics_select_active_member
  ON public.clinics
  FOR SELECT
  TO authenticated
  USING (
    private.has_clinic_role(
      id,
      ARRAY['clinic_admin', 'vet', 'recepcao']::text[]
    )
  );

CREATE POLICY clinic_memberships_select_self_or_admin
  ON public.clinic_memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin']::text[]
    )
  );

CREATE POLICY tutores_select_member
  ON public.tutores
  FOR SELECT
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet', 'recepcao']::text[]
    )
  );

CREATE POLICY tutores_insert_member
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

CREATE POLICY tutores_update_member
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

CREATE POLICY pets_select_member
  ON public.pets
  FOR SELECT
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet', 'recepcao']::text[]
    )
  );

CREATE POLICY pets_insert_member
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

CREATE POLICY pets_update_member
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

CREATE POLICY triagens_select_clinical_member
  ON public.triagens
  FOR SELECT
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet']::text[]
    )
  );

CREATE POLICY triagens_insert_clinical_member
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

CREATE POLICY triagens_update_clinical_member
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

CREATE POLICY follow_ups_select_clinical_member
  ON public.follow_ups
  FOR SELECT
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet']::text[]
    )
  );

CREATE POLICY follow_ups_insert_clinical_member
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

CREATE POLICY follow_ups_update_clinical_member
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

CREATE POLICY colaboradores_select_clinic_directory
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

CREATE POLICY colaboradores_insert_clinic_admin
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

CREATE POLICY colaboradores_update_clinic_admin
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

CREATE POLICY laudos_pdf_select_clinical_member
  ON public.laudos_pdf
  FOR SELECT
  TO authenticated
  USING (
    private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet']::text[]
    )
  );

CREATE POLICY laudos_pdf_insert_reserved
  ON public.laudos_pdf
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND vet_id = (SELECT auth.uid())
    AND status = 'pendente'
    AND resultado_ia IS NULL
    AND erro_ia IS NULL
    AND storage_path = pg_catalog.format(
      'clinics/%s/laudos/%s/original.pdf',
      clinic_id,
      id
    )
    AND private.has_clinic_role(
      clinic_id,
      ARRAY['clinic_admin', 'vet']::text[]
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: remove every historical laudos policy by known name, preserving
-- unrelated buckets. New policies join the exact reserved database row.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS auth_upload_laudos ON storage.objects;
DROP POLICY IF EXISTS auth_read_laudos ON storage.objects;
DROP POLICY IF EXISTS vet_upload_laudos ON storage.objects;
DROP POLICY IF EXISTS vet_read_own_laudos ON storage.objects;
DROP POLICY IF EXISTS vet_delete_own_laudos ON storage.objects;
DROP POLICY IF EXISTS admin_all_storage_laudos ON storage.objects;
DROP POLICY IF EXISTS laudos_upload ON storage.objects;
DROP POLICY IF EXISTS laudos_read ON storage.objects;
DROP POLICY IF EXISTS laudos_delete ON storage.objects;
DROP POLICY IF EXISTS owner_upload_laudos ON storage.objects;
DROP POLICY IF EXISTS owner_read_laudos ON storage.objects;
DROP POLICY IF EXISTS storage_laudos_insert_reserved ON storage.objects;
DROP POLICY IF EXISTS storage_laudos_select_member ON storage.objects;
DROP POLICY IF EXISTS storage_laudos_insert_exact_record ON storage.objects;
DROP POLICY IF EXISTS storage_laudos_select_exact_record ON storage.objects;

CREATE POLICY storage_laudos_insert_exact_record
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'laudos'
    AND EXISTS (
      SELECT 1
      FROM public.laudos_pdf AS l
      WHERE l.storage_path = name
        AND l.status = 'pendente'
        AND l.created_by = (SELECT auth.uid())
        AND private.has_clinic_role(
          l.clinic_id,
          ARRAY['clinic_admin', 'vet']::text[]
        )
    )
  );

CREATE POLICY storage_laudos_select_exact_record
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'laudos'
    AND EXISTS (
      SELECT 1
      FROM public.laudos_pdf AS l
      WHERE l.storage_path = name
        AND private.has_clinic_role(
          l.clinic_id,
          ARRAY['clinic_admin', 'vet']::text[]
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Explicit grants. RLS and grants are deployed as one atomic unit.
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES
  FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES
  FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE
  public.profiles,
  public.clinics,
  public.clinic_memberships,
  public.tutores,
  public.pets,
  public.triagens,
  public.follow_ups,
  public.colaboradores,
  public.laudos_pdf
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (full_name, document, phone, address)
  ON TABLE public.profiles TO authenticated;

GRANT SELECT ON TABLE public.clinics TO authenticated;
GRANT SELECT ON TABLE public.clinic_memberships TO authenticated;

GRANT SELECT ON TABLE public.tutores TO authenticated;
GRANT INSERT (
  clinic_id, nome, telefone, email, cpf, cep, endereco, cidade, estado,
  lgpd_aceito_em, lgpd_ip
) ON TABLE public.tutores TO authenticated;
GRANT UPDATE (
  nome, telefone, email, cpf, cep, endereco, cidade, estado, lgpd_aceito_em
) ON TABLE public.tutores TO authenticated;

GRANT SELECT ON TABLE public.pets TO authenticated;
GRANT INSERT (
  clinic_id, tutor_id, nome, especie, raca, idade_anos, idade_meses,
  peso_atual, status_paciente, data_obito
) ON TABLE public.pets TO authenticated;
GRANT UPDATE (
  tutor_id, nome, especie, raca, idade_anos, idade_meses,
  peso_atual, status_paciente, data_obito
) ON TABLE public.pets TO authenticated;

GRANT SELECT ON TABLE public.triagens TO authenticated;
GRANT INSERT (clinic_id, pet_id, tutor_id, status, observacoes)
  ON TABLE public.triagens TO authenticated;
GRANT UPDATE (pet_id, tutor_id, status, observacoes)
  ON TABLE public.triagens TO authenticated;

GRANT SELECT ON TABLE public.follow_ups TO authenticated;
GRANT INSERT (
  clinic_id, triagem_id, opt_out, canal, scheduled_at, sent_at
) ON TABLE public.follow_ups TO authenticated;
GRANT UPDATE (triagem_id, opt_out, canal, scheduled_at, sent_at)
  ON TABLE public.follow_ups TO authenticated;

GRANT SELECT ON TABLE public.colaboradores TO authenticated;
GRANT INSERT (
  clinic_id, nome, email, cargo, nivel_acesso, crmv,
  telefone, ativo, termos_aceitos_em
) ON TABLE public.colaboradores TO authenticated;
GRANT UPDATE (
  nome, email, cargo, nivel_acesso, crmv,
  telefone, ativo, termos_aceitos_em
) ON TABLE public.colaboradores TO authenticated;

GRANT SELECT ON TABLE public.laudos_pdf TO authenticated;
GRANT INSERT (clinic_id, pet_id, nome_arquivo, tipo_exame, tamanho_bytes)
  ON TABLE public.laudos_pdf TO authenticated;

-- Explicit privileged access required by current server/cleanup contracts.
-- Promotion must inventory and reduce this allowlist where possible.
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.clinics,
  public.clinic_memberships,
  public.tutores,
  public.pets,
  public.triagens,
  public.follow_ups,
  public.colaboradores,
  public.laudos_pdf
TO service_role;

REVOKE ALL ON FUNCTION private.current_user_is_admin()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.has_clinic_role(uuid, text[])
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_clinic_role(uuid, text[])
  TO authenticated;

COMMIT;
