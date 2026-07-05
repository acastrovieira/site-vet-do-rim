-- ============================================================
-- Security advisor fixes - Vet do Rim
-- Corrige search_path mutavel e remove SECURITY DEFINER do schema exposto.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM OLD.id THEN
    RETURN NEW;
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
$$;

CREATE OR REPLACE FUNCTION private.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION private.current_user_is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_is_admin() TO authenticated;

DROP POLICY IF EXISTS "admin_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Perfis são visíveis para o próprio usuário." ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios perfis." ON public.profiles;

CREATE POLICY "admin_all_profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (private.current_user_is_admin())
  WITH CHECK (private.current_user_is_admin());

DROP FUNCTION IF EXISTS public.current_user_is_admin();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
