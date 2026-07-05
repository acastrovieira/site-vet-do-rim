-- ============================================================
-- Completa schema usado pelo app web
-- Campos/tabelas detectados em web/src e ausentes nas migrations principais.
-- Revisar em staging antes de aplicar em producao.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text;

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS data_obito date;

CREATE TABLE IF NOT EXISTS public.triagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  tutor_id uuid REFERENCES public.tutores(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ativa',
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_triagens_pet_id ON public.triagens(pet_id);
CREATE INDEX IF NOT EXISTS idx_triagens_tutor_id ON public.triagens(tutor_id);
CREATE INDEX IF NOT EXISTS idx_triagens_status ON public.triagens(status);

DROP TRIGGER IF EXISTS trg_triagens_updated_at ON public.triagens;
CREATE TRIGGER trg_triagens_updated_at
  BEFORE UPDATE ON public.triagens
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triagem_id uuid NOT NULL REFERENCES public.triagens(id) ON DELETE CASCADE,
  opt_out boolean NOT NULL DEFAULT false,
  canal text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_triagem_id ON public.follow_ups(triagem_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_opt_out ON public.follow_ups(opt_out);

DROP TRIGGER IF EXISTS trg_follow_ups_updated_at ON public.follow_ups;
CREATE TRIGGER trg_follow_ups_updated_at
  BEFORE UPDATE ON public.follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.triagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.triagens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_ups TO authenticated;

DROP POLICY IF EXISTS "vet_admin_select_triagens" ON public.triagens;
DROP POLICY IF EXISTS "vet_admin_insert_triagens" ON public.triagens;
DROP POLICY IF EXISTS "vet_admin_update_triagens" ON public.triagens;
DROP POLICY IF EXISTS "admin_delete_triagens" ON public.triagens;

CREATE POLICY "vet_admin_select_triagens"
  ON public.triagens
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin')));

CREATE POLICY "vet_admin_insert_triagens"
  ON public.triagens
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin')));

CREATE POLICY "vet_admin_update_triagens"
  ON public.triagens
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin')));

CREATE POLICY "admin_delete_triagens"
  ON public.triagens
  FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "vet_admin_select_follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "vet_admin_insert_follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "vet_admin_update_follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "admin_delete_follow_ups" ON public.follow_ups;

CREATE POLICY "vet_admin_select_follow_ups"
  ON public.follow_ups
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin')));

CREATE POLICY "vet_admin_insert_follow_ups"
  ON public.follow_ups
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin')));

CREATE POLICY "vet_admin_update_follow_ups"
  ON public.follow_ups
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('vet', 'admin')));

CREATE POLICY "admin_delete_follow_ups"
  ON public.follow_ups
  FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
