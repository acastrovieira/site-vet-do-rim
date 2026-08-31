-- ============================================================
-- REMEDIATION-001 — Recria private.has_clinic_role se ausente
--
-- CONTEXTO:
--   A migration 20260718100000_tenancy_expand.sql deveria ter criado
--   private.has_clinic_role(uuid, text[]). Em produção essa função
--   está ausente (confirmado via diagnóstico 2026-08-28).
--   As tabelas public.clinics e public.clinic_memberships existem,
--   logo o schema private existe — só a função está faltando.
--
--   A migration 20260823234842_sprint0_security_forward_hardening.sql
--   tem preflight que exige esta função. Sem ela, o sprint0 falha.
--
-- Esta migration é idempotente (CREATE OR REPLACE).
-- ============================================================

BEGIN;

-- Preflight: garante que o schema private e as tabelas de tenancy existem
DO $$
BEGIN
  IF pg_catalog.to_regclass('public.clinics') IS NULL THEN
    RAISE EXCEPTION 'preflight: public.clinics ausente';
  END IF;
  IF pg_catalog.to_regclass('public.clinic_memberships') IS NULL THEN
    RAISE EXCEPTION 'preflight: public.clinic_memberships ausente';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = 'private'
  ) THEN
    RAISE EXCEPTION 'preflight: schema private ausente';
  END IF;
END
$$;

-- Recria a função (idempotente via CREATE OR REPLACE)
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

COMMENT ON FUNCTION private.has_clinic_role(uuid, text[]) IS
  'REMEDIATION-001: recriada em 2026-08-28. Verifica se o usuário autenticado
   tem role ativo em uma clínica ativa. STABLE + SECURITY DEFINER: avaliada
   uma vez por transação, sem recursão de RLS. Usada pelas policies Sprint-0.';

-- Confirmação
SELECT
  n.nspname AS schema,
  p.proname AS funcao,
  'CRIADA OK' AS status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'private'
  AND p.proname = 'has_clinic_role';

COMMIT;
