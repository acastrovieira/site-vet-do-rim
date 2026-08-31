-- ============================================================
-- FIX-001 — Corrige policy "service_insert_profile" em profiles
--
-- PROBLEMA IDENTIFICADO (auditoria 2026-08-25):
--   A migration 20260531000000_full_schema_setup.sql criou:
--     CREATE POLICY "service_insert_profile" ON public.profiles
--       FOR INSERT WITH CHECK (true);
--   sem restrição de role — qualquer usuário autenticado pode inserir
--   linhas em profiles diretamente via Data API, contornando o trigger
--   handle_new_user e inserindo roles arbitrárias.
--
-- CORREÇÃO:
--   Restringe o INSERT de profiles a service_role apenas.
--   O trigger on_auth_user_created (handle_new_user) roda como
--   SECURITY DEFINER (postgres), que equivale a service_role para
--   o acesso interno — não é afetado por esta mudança.
--
--   authenticated continua com SELECT (own_select_profile) e
--   UPDATE (own_update_profile, com proteção contra escalada via
--   prevent_profile_privilege_escalation).
-- ============================================================

BEGIN;

-- Preflight
DO $$
BEGIN
  IF pg_catalog.to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'preflight: public.profiles ausente';
  END IF;
END
$$;

-- Remove a policy aberta
DROP POLICY IF EXISTS "service_insert_profile" ON public.profiles;

-- Recria restrita a service_role (trigger interno usa postgres/service_role)
CREATE POLICY "service_role_insert_profile"
  ON public.profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMENT ON POLICY "service_role_insert_profile" ON public.profiles IS
  'FIX-001: INSERT em profiles restrito a service_role. O trigger handle_new_user (SECURITY DEFINER postgres) continua funcionando. Autenticados não podem inserir profiles diretamente.';

COMMIT;
