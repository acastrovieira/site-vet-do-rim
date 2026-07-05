-- Corrige avisos do Supabase Performance Advisor sem ampliar acesso.
-- - Evita reavaliar auth.uid() por linha em subscriptions.
-- - Consolida policies permissivas duplicadas por role/action.

DROP POLICY IF EXISTS "Usuários podem ver sua própria assinatura." ON public.subscriptions;

CREATE POLICY "Usuários podem ver sua própria assinatura."
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "own_select_profile" ON public.profiles;
DROP POLICY IF EXISTS "own_update_profile" ON public.profiles;
DROP POLICY IF EXISTS "admin_all_profiles" ON public.profiles;

CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (select auth.uid())
    OR private.current_user_is_admin()
  );

CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = (select auth.uid())
    OR private.current_user_is_admin()
  )
  WITH CHECK (
    id = (select auth.uid())
    OR private.current_user_is_admin()
  );

CREATE POLICY "profiles_insert_admin"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (private.current_user_is_admin());

CREATE POLICY "profiles_delete_admin"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (private.current_user_is_admin());

DROP POLICY IF EXISTS "auth_select_colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "admin_all_colaboradores" ON public.colaboradores;

CREATE POLICY "colaboradores_select_active_or_admin"
  ON public.colaboradores
  FOR SELECT
  TO authenticated
  USING (
    ativo = true
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role = 'admin'
    )
  );

CREATE POLICY "admin_insert_colaboradores"
  ON public.colaboradores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role = 'admin'
    )
  );

CREATE POLICY "admin_update_colaboradores"
  ON public.colaboradores
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role = 'admin'
    )
  );

CREATE POLICY "admin_delete_colaboradores"
  ON public.colaboradores
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND role = 'admin'
    )
  );
