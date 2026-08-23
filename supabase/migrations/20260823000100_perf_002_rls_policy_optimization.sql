-- ============================================================
-- PERF-002 — Reescrita de RLS policies para eliminar subquery
--            EXISTS por linha (problema C1 da auditoria PERF-001)
--
-- PROBLEMA: policies de tutores, pets, triagens e follow_ups usam:
--   EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (...))
-- Essa subquery é avaliada UMA VEZ POR LINHA retornada, causando
-- O(n) lookups em profiles para cada query — inaceitável em escala.
--
-- SOLUÇÃO: substituir pela função STABLE SECURITY DEFINER
--   public.current_user_is_admin() — já existe (20260623000100)
--   private.has_clinic_role()       — já existe (20260718100000)
--
-- Para a fase pré-tenancy completa (clinic_id ainda nullable):
--   Usamos uma nova função auxiliar current_user_is_vet_or_admin()
--   que é cached por transação (STABLE), evitando o re-lookup por linha.
--
-- IMPACTO em produção: DROP POLICY é instantâneo mas invalida planos
-- de query em cache. Em banco com tráfego, aplicar em horário de baixo uso.
-- Não bloqueia writes (sem LOCK).
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- Função auxiliar: verifica se o usuário atual tem role vet OU admin
-- STABLE: o PostgreSQL a avalia UMA VEZ por transação, não por linha
-- SECURITY DEFINER: evita recursão de RLS na leitura de profiles
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_is_vet_or_admin()
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
      AND role IN ('vet', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_vet_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_vet_or_admin() TO authenticated;

COMMENT ON FUNCTION public.current_user_is_vet_or_admin() IS
  'PERF-002: verifica role vet/admin do usuário atual. STABLE = avaliada uma vez por transação, não por linha. Substitui subquery EXISTS nas RLS policies de tabelas clínicas.';

-- ──────────────────────────────────────────────────────────────
-- TUTORES — reescrita das policies
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vet_admin_select_tutores" ON public.tutores;
DROP POLICY IF EXISTS "vet_admin_insert_tutores" ON public.tutores;
DROP POLICY IF EXISTS "vet_admin_update_tutores" ON public.tutores;
DROP POLICY IF EXISTS "admin_delete_tutores"     ON public.tutores;

CREATE POLICY "tutores_select_vet_admin"
  ON public.tutores
  FOR SELECT
  TO authenticated
  USING (public.current_user_is_vet_or_admin());

CREATE POLICY "tutores_insert_vet_admin"
  ON public.tutores
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_is_vet_or_admin());

CREATE POLICY "tutores_update_vet_admin"
  ON public.tutores
  FOR UPDATE
  TO authenticated
  USING  (public.current_user_is_vet_or_admin())
  WITH CHECK (public.current_user_is_vet_or_admin());

CREATE POLICY "tutores_delete_admin"
  ON public.tutores
  FOR DELETE
  TO authenticated
  USING (public.current_user_is_admin());

-- ──────────────────────────────────────────────────────────────
-- PETS — reescrita das policies
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vet_admin_select_pets" ON public.pets;
DROP POLICY IF EXISTS "vet_admin_insert_pets" ON public.pets;
DROP POLICY IF EXISTS "vet_admin_update_pets" ON public.pets;
DROP POLICY IF EXISTS "admin_delete_pets"     ON public.pets;

CREATE POLICY "pets_select_vet_admin"
  ON public.pets
  FOR SELECT
  TO authenticated
  USING (public.current_user_is_vet_or_admin());

CREATE POLICY "pets_insert_vet_admin"
  ON public.pets
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_is_vet_or_admin());

CREATE POLICY "pets_update_vet_admin"
  ON public.pets
  FOR UPDATE
  TO authenticated
  USING  (public.current_user_is_vet_or_admin())
  WITH CHECK (public.current_user_is_vet_or_admin());

CREATE POLICY "pets_delete_admin"
  ON public.pets
  FOR DELETE
  TO authenticated
  USING (public.current_user_is_admin());

-- ──────────────────────────────────────────────────────────────
-- TRIAGENS — reescrita das policies
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vet_admin_select_triagens" ON public.triagens;
DROP POLICY IF EXISTS "vet_admin_insert_triagens" ON public.triagens;
DROP POLICY IF EXISTS "vet_admin_update_triagens" ON public.triagens;
DROP POLICY IF EXISTS "admin_delete_triagens"     ON public.triagens;

CREATE POLICY "triagens_select_vet_admin"
  ON public.triagens
  FOR SELECT
  TO authenticated
  USING (public.current_user_is_vet_or_admin());

CREATE POLICY "triagens_insert_vet_admin"
  ON public.triagens
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_is_vet_or_admin());

CREATE POLICY "triagens_update_vet_admin"
  ON public.triagens
  FOR UPDATE
  TO authenticated
  USING  (public.current_user_is_vet_or_admin())
  WITH CHECK (public.current_user_is_vet_or_admin());

CREATE POLICY "triagens_delete_admin"
  ON public.triagens
  FOR DELETE
  TO authenticated
  USING (public.current_user_is_admin());

-- ──────────────────────────────────────────────────────────────
-- FOLLOW_UPS — reescrita das policies
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vet_admin_select_follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "vet_admin_insert_follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "vet_admin_update_follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "admin_delete_follow_ups"     ON public.follow_ups;

CREATE POLICY "follow_ups_select_vet_admin"
  ON public.follow_ups
  FOR SELECT
  TO authenticated
  USING (public.current_user_is_vet_or_admin());

CREATE POLICY "follow_ups_insert_vet_admin"
  ON public.follow_ups
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_is_vet_or_admin());

CREATE POLICY "follow_ups_update_vet_admin"
  ON public.follow_ups
  FOR UPDATE
  TO authenticated
  USING  (public.current_user_is_vet_or_admin())
  WITH CHECK (public.current_user_is_vet_or_admin());

CREATE POLICY "follow_ups_delete_admin"
  ON public.follow_ups
  FOR DELETE
  TO authenticated
  USING (public.current_user_is_admin());

-- ──────────────────────────────────────────────────────────────
-- LAUDOS_PDF — reescrita para eliminar subqueries duplicadas
-- A policy atual já usa (SELECT auth.uid()) corretamente,
-- mas o EXISTS em role = 'admin' ainda faz subquery por linha.
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vet_select_own_laudos"  ON public.laudos_pdf;
DROP POLICY IF EXISTS "vet_insert_own_laudos"  ON public.laudos_pdf;
DROP POLICY IF EXISTS "vet_update_own_laudos"  ON public.laudos_pdf;
DROP POLICY IF EXISTS "admin_delete_laudos"    ON public.laudos_pdf;
-- Políticas do schema inicial que possam ainda existir:
DROP POLICY IF EXISTS "auth_select_laudos"     ON public.laudos_pdf;
DROP POLICY IF EXISTS "auth_insert_laudos"     ON public.laudos_pdf;
DROP POLICY IF EXISTS "auth_update_laudos"     ON public.laudos_pdf;

CREATE POLICY "laudos_select_vet_own_or_admin"
  ON public.laudos_pdf
  FOR SELECT
  TO authenticated
  USING (
    vet_id = (SELECT auth.uid())
    OR public.current_user_is_admin()
  );

CREATE POLICY "laudos_insert_vet_own"
  ON public.laudos_pdf
  FOR INSERT
  TO authenticated
  WITH CHECK (
    vet_id = (SELECT auth.uid())
    AND public.current_user_is_vet_or_admin()
  );

CREATE POLICY "laudos_update_vet_own_or_admin"
  ON public.laudos_pdf
  FOR UPDATE
  TO authenticated
  USING (
    vet_id = (SELECT auth.uid())
    OR public.current_user_is_admin()
  )
  WITH CHECK (
    vet_id = (SELECT auth.uid())
    OR public.current_user_is_admin()
  );

CREATE POLICY "laudos_delete_admin"
  ON public.laudos_pdf
  FOR DELETE
  TO authenticated
  USING (public.current_user_is_admin());

-- ──────────────────────────────────────────────────────────────
-- VERIFICAÇÃO FINAL — lista policies ativas nas tabelas alteradas
-- ──────────────────────────────────────────────────────────────
SELECT
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('tutores', 'pets', 'triagens', 'follow_ups', 'laudos_pdf')
ORDER BY tablename, cmd, policyname;

COMMIT;
