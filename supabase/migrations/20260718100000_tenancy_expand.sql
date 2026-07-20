-- ADR-001 Tenancy — Fase 1 (Expand).
-- Derivada de docs/architecture/drafts/tenancy/01-expand.sql conforme
-- docs/architecture/fase1-tenancy-implementation-spec.md (secao 2.1).
-- A sentinela de quarentena do draft (DO $quarantine$ ... RAISE EXCEPTION) foi
-- deliberadamente REMOVIDA nesta copia promovida; o draft permanece bloqueado.
-- Aditiva e reversivel: NAO corta acesso (policies globais legadas continuam).
-- Replica limpo em banco vazio (supabase db reset --local) — zero linhas legadas.

BEGIN;

-- Falha cedo quando apontada para um schema diferente do revisado.
DO $$
DECLARE
  required_table text;
BEGIN
  IF current_setting('server_version_num')::integer < 150000 THEN
    RAISE EXCEPTION 'ADR-001 requires PostgreSQL 15+; remote version must match supabase/config.toml';
  END IF;

  FOREACH required_table IN ARRAY ARRAY[
    'public.profiles',
    'public.tutores',
    'public.pets',
    'public.triagens',
    'public.follow_ups',
    'public.colaboradores',
    'public.laudos_pdf',
    'storage.buckets',
    'storage.objects'
  ]
  LOOP
    IF to_regclass(required_table) IS NULL THEN
      RAISE EXCEPTION 'Required relation is missing: %', required_table;
    END IF;
  END LOOP;
END
$$;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Tenant root. Creation and mutation remain server-side only.
CREATE TABLE IF NOT EXISTS public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (btrim(nome) <> ''),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Authorization source. A user may have one row per clinic.
CREATE TABLE IF NOT EXISTS public.clinic_memberships (
  clinic_id uuid NOT NULL
    REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE RESTRICT,
  role text NOT NULL
    CHECK (role IN ('clinic_admin', 'vet', 'recepcao')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, user_id)
);

-- Private, auditable map used by the separate human-reviewed backfill.
CREATE TABLE IF NOT EXISTS private.tenant_backfill_manifest (
  entity_table text NOT NULL
    CHECK (entity_table IN (
      'tutores',
      'pets',
      'triagens',
      'follow_ups',
      'colaboradores',
      'laudos_pdf'
    )),
  entity_id uuid NOT NULL,
  target_clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT,
  decision text NOT NULL
    CHECK (decision IN ('approved', 'quarantined')),
  source_evidence text NOT NULL CHECK (btrim(source_evidence) <> ''),
  row_fingerprint text NOT NULL CHECK (btrim(row_fingerprint) <> ''),
  batch_id uuid NOT NULL,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_table, entity_id),
  CHECK (
    (decision = 'approved' AND target_clinic_id IS NOT NULL)
    OR (decision = 'quarantined' AND target_clinic_id IS NULL)
  )
);

COMMENT ON TABLE public.clinics IS
  'ADR-001 tenant root. Browser access is read-only and membership-scoped.';
COMMENT ON TABLE public.clinic_memberships IS
  'ADR-001 source of professional authorization by clinic; profiles.role is not authoritative.';
COMMENT ON TABLE private.tenant_backfill_manifest IS
  'Human-reviewed and fingerprinted mapping for the ADR-001 legacy backfill.';

-- Reuse the existing updated-at helper (20260531000000) that sets atualizado_em,
-- a column both new tables expose.
DROP TRIGGER IF EXISTS trg_clinics_updated_at ON public.clinics;
CREATE TRIGGER trg_clinics_updated_at
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_clinic_memberships_updated_at ON public.clinic_memberships;
CREATE TRIGGER trg_clinic_memberships_updated_at
  BEFORE UPDATE ON public.clinic_memberships
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_clinics_status
  ON public.clinics(status, id);
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_user_active
  ON public.clinic_memberships(user_id, status, clinic_id, role);
CREATE INDEX IF NOT EXISTS idx_clinic_memberships_clinic_active
  ON public.clinic_memberships(clinic_id, status, role, user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_backfill_manifest_batch
  ON private.tenant_backfill_manifest(batch_id, decision, entity_table);

-- SECURITY DEFINER is necessary only to avoid recursive RLS on memberships.
-- It is private, parameterizes only clinic/role, derives the actor from auth.uid(),
-- uses a fixed empty search_path, and is not executable by anon/PUBLIC.
CREATE OR REPLACE FUNCTION private.has_clinic_role(
  target_clinic_id uuid,
  allowed_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.clinics AS c
      JOIN public.clinic_memberships AS m
        ON m.clinic_id = c.id
      WHERE c.id = target_clinic_id
        AND c.status = 'active'
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
        AND m.role = ANY (COALESCE(allowed_roles, ARRAY[]::text[]))
    );
$$;

ALTER FUNCTION private.has_clinic_role(uuid, text[]) OWNER TO postgres;

REVOKE ALL ON FUNCTION private.has_clinic_role(uuid, text[])
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_clinic_role(uuid, text[])
  TO authenticated;

-- New exposed-schema tables are closed before any grant is added.
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_memberships FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinics_select_active_member ON public.clinics;
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

DROP POLICY IF EXISTS clinic_memberships_select_self_or_admin
  ON public.clinic_memberships;
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

REVOKE ALL PRIVILEGES ON TABLE public.clinics
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.clinic_memberships
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE private.tenant_backfill_manifest
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.clinics TO authenticated;
GRANT SELECT ON TABLE public.clinic_memberships TO authenticated;

-- Explicit server access is needed only for provisioning/backfill fixtures.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinic_memberships TO service_role;

-- Nullable during expand; no default exists because legacy ownership is unknown.
ALTER TABLE public.tutores
  ADD COLUMN IF NOT EXISTS clinic_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS clinic_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.triagens
  ADD COLUMN IF NOT EXISTS clinic_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.follow_ups
  ADD COLUMN IF NOT EXISTS clinic_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS clinic_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.laudos_pdf
  ADD COLUMN IF NOT EXISTS clinic_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

COMMENT ON COLUMN public.tutores.clinic_id IS 'ADR-001 tenant; nullable only during expand/backfill.';
COMMENT ON COLUMN public.pets.clinic_id IS 'ADR-001 tenant; must match tutor tenant.';
COMMENT ON COLUMN public.triagens.clinic_id IS 'ADR-001 tenant; must match pet/tutor tenant.';
COMMENT ON COLUMN public.follow_ups.clinic_id IS 'ADR-001 tenant; must match triagem tenant.';
COMMENT ON COLUMN public.colaboradores.clinic_id IS 'ADR-001 tenant; nivel_acesso is not an authorization source.';
COMMENT ON COLUMN public.laudos_pdf.clinic_id IS 'ADR-001 tenant; must match pet and Storage reservation.';

-- Policy/filter indexes and non-partial unique indexes required by composite FKs.
-- criado_em/atualizado_em for the five legacy tables; created_at for laudos_pdf.
CREATE INDEX IF NOT EXISTS idx_tutores_clinic
  ON public.tutores(clinic_id, criado_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tutores_clinic_id
  ON public.tutores(clinic_id, id);

CREATE INDEX IF NOT EXISTS idx_pets_clinic
  ON public.pets(clinic_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_pets_clinic_tutor
  ON public.pets(clinic_id, tutor_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pets_clinic_id
  ON public.pets(clinic_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pets_clinic_id_tutor
  ON public.pets(clinic_id, id, tutor_id);

CREATE INDEX IF NOT EXISTS idx_triagens_clinic
  ON public.triagens(clinic_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_triagens_clinic_pet
  ON public.triagens(clinic_id, pet_id);
CREATE INDEX IF NOT EXISTS idx_triagens_clinic_pet_tutor
  ON public.triagens(clinic_id, pet_id, tutor_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_triagens_clinic_id
  ON public.triagens(clinic_id, id);

CREATE INDEX IF NOT EXISTS idx_follow_ups_clinic
  ON public.follow_ups(clinic_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_follow_ups_clinic_triagem
  ON public.follow_ups(clinic_id, triagem_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_follow_ups_clinic_id
  ON public.follow_ups(clinic_id, id);

CREATE INDEX IF NOT EXISTS idx_colaboradores_clinic
  ON public.colaboradores(clinic_id, ativo, criado_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_colaboradores_clinic_id
  ON public.colaboradores(clinic_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_colaboradores_clinic_uid
  ON public.colaboradores(clinic_id, supabase_uid)
  WHERE supabase_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_laudos_pdf_clinic
  ON public.laudos_pdf(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_laudos_pdf_clinic_pet
  ON public.laudos_pdf(clinic_id, pet_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_laudos_pdf_clinic_id
  ON public.laudos_pdf(clinic_id, id);

-- PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS. Each name is guarded in
-- pg_constraint so a reviewed rerun is idempotent without hiding shape drift.
-- All FKs enter NOT VALID: legacy rows are not blocked during expand; VALIDATE
-- happens only in enforce. The ON DELETE SET NULL (column) referential action
-- on the composite membership FKs requires PostgreSQL 15+ (environment is 17).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tutores'::regclass
      AND conname = 'fk_tutores_clinic'
  ) THEN
    ALTER TABLE public.tutores
      ADD CONSTRAINT fk_tutores_clinic
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tutores'::regclass
      AND conname = 'fk_tutores_created_by'
  ) THEN
    ALTER TABLE public.tutores
      ADD CONSTRAINT fk_tutores_created_by
      FOREIGN KEY (created_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pets'::regclass
      AND conname = 'fk_pets_clinic'
  ) THEN
    ALTER TABLE public.pets
      ADD CONSTRAINT fk_pets_clinic
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pets'::regclass
      AND conname = 'fk_pets_created_by'
  ) THEN
    ALTER TABLE public.pets
      ADD CONSTRAINT fk_pets_created_by
      FOREIGN KEY (created_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pets'::regclass
      AND conname = 'fk_pets_tutor_same_clinic'
  ) THEN
    ALTER TABLE public.pets
      ADD CONSTRAINT fk_pets_tutor_same_clinic
      FOREIGN KEY (clinic_id, tutor_id)
      REFERENCES public.tutores(clinic_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.triagens'::regclass
      AND conname = 'fk_triagens_clinic'
  ) THEN
    ALTER TABLE public.triagens
      ADD CONSTRAINT fk_triagens_clinic
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.triagens'::regclass
      AND conname = 'fk_triagens_created_by'
  ) THEN
    ALTER TABLE public.triagens
      ADD CONSTRAINT fk_triagens_created_by
      FOREIGN KEY (created_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.triagens'::regclass
      AND conname = 'fk_triagens_pet_same_clinic'
  ) THEN
    ALTER TABLE public.triagens
      ADD CONSTRAINT fk_triagens_pet_same_clinic
      FOREIGN KEY (clinic_id, pet_id)
      REFERENCES public.pets(clinic_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.triagens'::regclass
      AND conname = 'fk_triagens_pet_tutor_same_clinic'
  ) THEN
    ALTER TABLE public.triagens
      ADD CONSTRAINT fk_triagens_pet_tutor_same_clinic
      FOREIGN KEY (clinic_id, pet_id, tutor_id)
      REFERENCES public.pets(clinic_id, id, tutor_id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.follow_ups'::regclass
      AND conname = 'fk_follow_ups_clinic'
  ) THEN
    ALTER TABLE public.follow_ups
      ADD CONSTRAINT fk_follow_ups_clinic
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.follow_ups'::regclass
      AND conname = 'fk_follow_ups_created_by'
  ) THEN
    ALTER TABLE public.follow_ups
      ADD CONSTRAINT fk_follow_ups_created_by
      FOREIGN KEY (created_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.follow_ups'::regclass
      AND conname = 'fk_follow_ups_triagem_same_clinic'
  ) THEN
    ALTER TABLE public.follow_ups
      ADD CONSTRAINT fk_follow_ups_triagem_same_clinic
      FOREIGN KEY (clinic_id, triagem_id)
      REFERENCES public.triagens(clinic_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.colaboradores'::regclass
      AND conname = 'fk_colaboradores_clinic'
  ) THEN
    ALTER TABLE public.colaboradores
      ADD CONSTRAINT fk_colaboradores_clinic
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.colaboradores'::regclass
      AND conname = 'fk_colaboradores_created_by'
  ) THEN
    ALTER TABLE public.colaboradores
      ADD CONSTRAINT fk_colaboradores_created_by
      FOREIGN KEY (created_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.colaboradores'::regclass
      AND conname = 'fk_colaboradores_membership_same_clinic'
  ) THEN
    ALTER TABLE public.colaboradores
      ADD CONSTRAINT fk_colaboradores_membership_same_clinic
      FOREIGN KEY (clinic_id, supabase_uid)
      REFERENCES public.clinic_memberships(clinic_id, user_id)
      ON DELETE SET NULL (supabase_uid) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.laudos_pdf'::regclass
      AND conname = 'fk_laudos_pdf_clinic'
  ) THEN
    ALTER TABLE public.laudos_pdf
      ADD CONSTRAINT fk_laudos_pdf_clinic
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.laudos_pdf'::regclass
      AND conname = 'fk_laudos_pdf_created_by'
  ) THEN
    ALTER TABLE public.laudos_pdf
      ADD CONSTRAINT fk_laudos_pdf_created_by
      FOREIGN KEY (created_by) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.laudos_pdf'::regclass
      AND conname = 'fk_laudos_pdf_pet_same_clinic'
  ) THEN
    ALTER TABLE public.laudos_pdf
      ADD CONSTRAINT fk_laudos_pdf_pet_same_clinic
      FOREIGN KEY (clinic_id, pet_id)
      REFERENCES public.pets(clinic_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.laudos_pdf'::regclass
      AND conname = 'fk_laudos_pdf_vet_membership'
  ) THEN
    ALTER TABLE public.laudos_pdf
      ADD CONSTRAINT fk_laudos_pdf_vet_membership
      FOREIGN KEY (clinic_id, vet_id)
      REFERENCES public.clinic_memberships(clinic_id, user_id)
      ON DELETE SET NULL (vet_id) NOT VALID;
  END IF;
END
$$;

COMMIT;
