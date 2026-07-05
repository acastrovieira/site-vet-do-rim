-- ============================================================
-- Hardening de Auth/RLS - Vet do Rim
-- Revisar em staging antes de aplicar em producao.
-- ============================================================

-- 1. Nunca confiar em raw_user_meta_data para autorizacao.
-- Novos usuarios entram como tutor; promocao para vet/admin deve ser feita por fluxo administrativo.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    'tutor',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- 2. Bloqueia autoalteracao de campos administrativos em profiles.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
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

REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- Helper sem parametros para evitar recursao de RLS em policies de profiles.
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
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

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

-- 3. Policies de profiles: usuario ve/edita apenas campos nao administrativos do proprio perfil.
DROP POLICY IF EXISTS "service_insert_profile" ON public.profiles;
DROP POLICY IF EXISTS "own_update_profile" ON public.profiles;
DROP POLICY IF EXISTS "own_select_profile" ON public.profiles;
DROP POLICY IF EXISTS "admin_all_profiles" ON public.profiles;

CREATE POLICY "own_select_profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY "own_update_profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "admin_all_profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

-- 4. Restringe tabelas clinicas a vet/admin enquanto nao houver ownership por clinica/equipe.
-- Esta regra e conservadora: tutores autenticados deixam de listar dados clinicos globais.
DROP POLICY IF EXISTS "auth_select_tutores" ON public.tutores;
DROP POLICY IF EXISTS "auth_insert_tutores" ON public.tutores;
DROP POLICY IF EXISTS "auth_update_tutores" ON public.tutores;
DROP POLICY IF EXISTS "admin_delete_tutores" ON public.tutores;
DROP POLICY IF EXISTS "vet_admin_select_tutores" ON public.tutores;
DROP POLICY IF EXISTS "vet_admin_insert_tutores" ON public.tutores;
DROP POLICY IF EXISTS "vet_admin_update_tutores" ON public.tutores;

CREATE POLICY "vet_admin_select_tutores"
  ON public.tutores
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin')));

CREATE POLICY "vet_admin_insert_tutores"
  ON public.tutores
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin')));

CREATE POLICY "vet_admin_update_tutores"
  ON public.tutores
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin')));

CREATE POLICY "admin_delete_tutores"
  ON public.tutores
  FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "auth_select_pets" ON public.pets;
DROP POLICY IF EXISTS "auth_insert_pets" ON public.pets;
DROP POLICY IF EXISTS "auth_update_pets" ON public.pets;
DROP POLICY IF EXISTS "admin_delete_pets" ON public.pets;
DROP POLICY IF EXISTS "vet_admin_select_pets" ON public.pets;
DROP POLICY IF EXISTS "vet_admin_insert_pets" ON public.pets;
DROP POLICY IF EXISTS "vet_admin_update_pets" ON public.pets;

CREATE POLICY "vet_admin_select_pets"
  ON public.pets
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin')));

CREATE POLICY "vet_admin_insert_pets"
  ON public.pets
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin')));

CREATE POLICY "vet_admin_update_pets"
  ON public.pets
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin')));

CREATE POLICY "admin_delete_pets"
  ON public.pets
  FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "auth_select_laudos" ON public.laudos_pdf;
DROP POLICY IF EXISTS "auth_insert_laudos" ON public.laudos_pdf;
DROP POLICY IF EXISTS "auth_update_laudos" ON public.laudos_pdf;
DROP POLICY IF EXISTS "admin_delete_laudos" ON public.laudos_pdf;
DROP POLICY IF EXISTS "vet_select_own_laudos" ON public.laudos_pdf;
DROP POLICY IF EXISTS "vet_insert_own_laudos" ON public.laudos_pdf;
DROP POLICY IF EXISTS "vet_update_own_laudos" ON public.laudos_pdf;

CREATE POLICY "vet_select_own_laudos"
  ON public.laudos_pdf
  FOR SELECT
  TO authenticated
  USING (
    vet_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

CREATE POLICY "vet_insert_own_laudos"
  ON public.laudos_pdf
  FOR INSERT
  TO authenticated
  WITH CHECK (
    vet_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin'))
  );

CREATE POLICY "vet_update_own_laudos"
  ON public.laudos_pdf
  FOR UPDATE
  TO authenticated
  USING (
    vet_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  )
  WITH CHECK (
    vet_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

CREATE POLICY "admin_delete_laudos"
  ON public.laudos_pdf
  FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

-- 5. Storage laudos: usuario so acessa objetos dentro da propria pasta auth.uid().
DROP POLICY IF EXISTS "auth_upload_laudos" ON storage.objects;
DROP POLICY IF EXISTS "auth_read_laudos" ON storage.objects;
DROP POLICY IF EXISTS "vet_upload_laudos" ON storage.objects;
DROP POLICY IF EXISTS "vet_read_own_laudos" ON storage.objects;
DROP POLICY IF EXISTS "vet_delete_own_laudos" ON storage.objects;
DROP POLICY IF EXISTS "admin_all_storage_laudos" ON storage.objects;
DROP POLICY IF EXISTS "laudos_upload" ON storage.objects;
DROP POLICY IF EXISTS "laudos_read" ON storage.objects;
DROP POLICY IF EXISTS "laudos_delete" ON storage.objects;
DROP POLICY IF EXISTS "owner_upload_laudos" ON storage.objects;
DROP POLICY IF EXISTS "owner_read_laudos" ON storage.objects;

CREATE POLICY "owner_upload_laudos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'laudos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "owner_read_laudos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'laudos'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
    )
  );
