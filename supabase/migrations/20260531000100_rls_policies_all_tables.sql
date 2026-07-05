-- ============================================================
-- Migration: rls_policies_all_tables
-- Corrige: RLS bloqueando INSERT de tutores e pets por usuários autenticados
-- Aplicar: Supabase Dashboard → SQL Editor → Run
-- ou: supabase db push
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. TUTORES
-- ──────────────────────────────────────────────────────────────

-- Remove policies antigas caso existam (evita conflict)
DROP POLICY IF EXISTS "auth_select_tutores"  ON public.tutores;
DROP POLICY IF EXISTS "auth_insert_tutores"  ON public.tutores;
DROP POLICY IF EXISTS "auth_update_tutores"  ON public.tutores;
DROP POLICY IF EXISTS "auth_delete_tutores"  ON public.tutores;
DROP POLICY IF EXISTS "admin_all_tutores"    ON public.tutores;
DROP POLICY IF EXISTS "admin_delete_tutores" ON public.tutores;

-- Garante RLS ativa
ALTER TABLE public.tutores ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem VER todos os tutores
CREATE POLICY "auth_select_tutores"
  ON public.tutores
  FOR SELECT
  TO authenticated
  USING (true);

-- Usuários autenticados podem CADASTRAR novos tutores
CREATE POLICY "auth_insert_tutores"
  ON public.tutores
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Usuários autenticados podem ATUALIZAR tutores
CREATE POLICY "auth_update_tutores"
  ON public.tutores
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Apenas admin pode DELETAR tutores
CREATE POLICY "admin_delete_tutores"
  ON public.tutores
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

-- ──────────────────────────────────────────────────────────────
-- 2. PETS (pacientes)
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "auth_select_pets"  ON public.pets;
DROP POLICY IF EXISTS "auth_insert_pets"  ON public.pets;
DROP POLICY IF EXISTS "auth_update_pets"  ON public.pets;
DROP POLICY IF EXISTS "auth_delete_pets"  ON public.pets;
DROP POLICY IF EXISTS "admin_all_pets"    ON public.pets;
DROP POLICY IF EXISTS "admin_delete_pets" ON public.pets;

ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_pets"
  ON public.pets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "auth_insert_pets"
  ON public.pets
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_pets"
  ON public.pets
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "admin_delete_pets"
  ON public.pets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

-- ──────────────────────────────────────────────────────────────
-- 3. PROFILES
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "own_select_profile"  ON public.profiles;
DROP POLICY IF EXISTS "own_update_profile"  ON public.profiles;
DROP POLICY IF EXISTS "admin_all_profiles"  ON public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuário vê apenas seu próprio perfil
CREATE POLICY "own_select_profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- Cada usuário atualiza apenas seu próprio perfil
CREATE POLICY "own_update_profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Admin vê e edita todos
CREATE POLICY "admin_all_profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  );

-- ──────────────────────────────────────────────────────────────
-- 4. COLABORADORES
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "auth_select_colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "admin_all_colaboradores"   ON public.colaboradores;

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

-- Todos autenticados veem colaboradores ativos
CREATE POLICY "auth_select_colaboradores"
  ON public.colaboradores
  FOR SELECT
  TO authenticated
  USING (ativo = true);

-- Apenas admin gerencia colaboradores
CREATE POLICY "admin_all_colaboradores"
  ON public.colaboradores
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

-- ──────────────────────────────────────────────────────────────
-- FIM — Verificação rápida (comentar antes de rodar em prod)
-- ──────────────────────────────────────────────────────────────
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
