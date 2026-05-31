-- ============================================================
-- SETUP COMPLETO — Vet do Rim Database
-- Executa no projeto CORRETO: vvcrukpcilfcgfiihxev
-- Dashboard: https://supabase.com/dashboard/project/vvcrukpcilfcgfiihxev/sql/new
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- EXTENSÕES
-- ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────────────────────
-- TRIGGER: atualiza updated_at automaticamente
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 1. PROFILES (vinculado ao auth.users do Supabase)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'tutor'
               CHECK (role IN ('vet', 'tutor', 'admin')),
  full_name    text,
  document     text,
  created_at   timestamptz DEFAULT now()
);

-- Trigger: cria perfil automaticamente ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'vet'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ──────────────────────────────────────────────────────────────
-- 2. TUTORES (responsáveis pelos pets)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tutores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  cpf           text,
  telefone      text NOT NULL,
  email         text,
  cep           text,
  endereco      text,
  cidade        text,
  estado        text,
  lgpd_aceito_em timestamptz,
  lgpd_ip       text,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutores_nome     ON public.tutores(nome);
CREATE INDEX IF NOT EXISTS idx_tutores_cpf      ON public.tutores(cpf);
CREATE INDEX IF NOT EXISTS idx_tutores_telefone ON public.tutores(telefone);
CREATE INDEX IF NOT EXISTS idx_tutores_criado   ON public.tutores(criado_em DESC);

DROP TRIGGER IF EXISTS trg_tutores_updated_at ON public.tutores;
CREATE TRIGGER trg_tutores_updated_at
  BEFORE UPDATE ON public.tutores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ──────────────────────────────────────────────────────────────
-- 3. PETS (pacientes)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id         uuid NOT NULL REFERENCES public.tutores(id) ON DELETE CASCADE,
  nome             text NOT NULL,
  especie          text NOT NULL,
  raca             text,
  idade_anos       integer,
  idade_meses      integer,
  peso_atual       numeric(5,2),
  status_paciente  text NOT NULL DEFAULT 'ativo'
                   CHECK (status_paciente IN ('ativo','em_tratamento','alta','inativo','obito')),
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pets_tutor_id ON public.pets(tutor_id);
CREATE INDEX IF NOT EXISTS idx_pets_nome     ON public.pets(nome);
CREATE INDEX IF NOT EXISTS idx_pets_especie  ON public.pets(especie);
CREATE INDEX IF NOT EXISTS idx_pets_status   ON public.pets(status_paciente);
CREATE INDEX IF NOT EXISTS idx_pets_criado   ON public.pets(criado_em DESC);

DROP TRIGGER IF EXISTS trg_pets_updated_at ON public.pets;
CREATE TRIGGER trg_pets_updated_at
  BEFORE UPDATE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ──────────────────────────────────────────────────────────────
-- 4. COLABORADORES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_uid     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome             text NOT NULL,
  email            text NOT NULL UNIQUE,
  cargo            text NOT NULL,
  nivel_acesso     text NOT NULL DEFAULT 'vet'
                   CHECK (nivel_acesso IN ('admin','vet','recepcao')),
  crmv             text,
  telefone         text,
  ativo            boolean NOT NULL DEFAULT true,
  termos_aceitos_em timestamptz,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_colaboradores_email ON public.colaboradores(email);
CREATE INDEX IF NOT EXISTS idx_colaboradores_ativo ON public.colaboradores(ativo);

DROP TRIGGER IF EXISTS trg_colaboradores_updated_at ON public.colaboradores;
CREATE TRIGGER trg_colaboradores_updated_at
  BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ──────────────────────────────────────────────────────────────
-- 5. LAUDOS PDF
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.laudos_pdf (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id        uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vet_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  storage_path  text NOT NULL,
  nome_arquivo  text NOT NULL,
  tipo_exame    text NOT NULL DEFAULT 'hemograma',
  status        text NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente','processando','concluido','erro')),
  resultado_ia  jsonb,
  erro_ia       text,
  tamanho_bytes bigint,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_laudos_pdf_pet_id  ON public.laudos_pdf(pet_id);
CREATE INDEX IF NOT EXISTS idx_laudos_pdf_vet_id  ON public.laudos_pdf(vet_id);
CREATE INDEX IF NOT EXISTS idx_laudos_pdf_status  ON public.laudos_pdf(status);
CREATE INDEX IF NOT EXISTS idx_laudos_pdf_created ON public.laudos_pdf(created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_laudos_pdf_updated_at ON public.laudos_pdf;
CREATE TRIGGER trg_laudos_pdf_updated_at
  BEFORE UPDATE ON public.laudos_pdf
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- RLS — PROFILES
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_select_profile"  ON public.profiles;
DROP POLICY IF EXISTS "own_update_profile"  ON public.profiles;
DROP POLICY IF EXISTS "admin_all_profiles"  ON public.profiles;
DROP POLICY IF EXISTS "service_insert_profile" ON public.profiles;

CREATE POLICY "own_select_profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));

CREATE POLICY "own_update_profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "admin_all_profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'));

-- Permite que o trigger crie o perfil na criação do usuário
CREATE POLICY "service_insert_profile" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────
-- RLS — TUTORES
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.tutores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_tutores"   ON public.tutores;
DROP POLICY IF EXISTS "auth_insert_tutores"   ON public.tutores;
DROP POLICY IF EXISTS "auth_update_tutores"   ON public.tutores;
DROP POLICY IF EXISTS "admin_delete_tutores"  ON public.tutores;

CREATE POLICY "auth_select_tutores" ON public.tutores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_tutores" ON public.tutores
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_tutores" ON public.tutores
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_delete_tutores" ON public.tutores
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

-- ──────────────────────────────────────────────────────────────
-- RLS — PETS
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_pets"   ON public.pets;
DROP POLICY IF EXISTS "auth_insert_pets"   ON public.pets;
DROP POLICY IF EXISTS "auth_update_pets"   ON public.pets;
DROP POLICY IF EXISTS "admin_delete_pets"  ON public.pets;

CREATE POLICY "auth_select_pets" ON public.pets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_pets" ON public.pets
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_pets" ON public.pets
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_delete_pets" ON public.pets
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

-- ──────────────────────────────────────────────────────────────
-- RLS — COLABORADORES
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "admin_all_colaboradores"   ON public.colaboradores;

CREATE POLICY "auth_select_colaboradores" ON public.colaboradores
  FOR SELECT TO authenticated USING (ativo = true);

CREATE POLICY "admin_all_colaboradores" ON public.colaboradores
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

-- ──────────────────────────────────────────────────────────────
-- RLS — LAUDOS PDF
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.laudos_pdf ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vet_select_own_laudos"  ON public.laudos_pdf;
DROP POLICY IF EXISTS "vet_insert_laudos"      ON public.laudos_pdf;
DROP POLICY IF EXISTS "vet_update_own_laudos"  ON public.laudos_pdf;
DROP POLICY IF EXISTS "admin_all_laudos"       ON public.laudos_pdf;
DROP POLICY IF EXISTS "auth_select_laudos"     ON public.laudos_pdf;
DROP POLICY IF EXISTS "auth_insert_laudos"     ON public.laudos_pdf;

CREATE POLICY "auth_select_laudos" ON public.laudos_pdf
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_laudos" ON public.laudos_pdf
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_laudos" ON public.laudos_pdf
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_delete_laudos" ON public.laudos_pdf
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

-- ──────────────────────────────────────────────────────────────
-- STORAGE BUCKET: laudos
-- ──────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('laudos', 'laudos', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "auth_upload_laudos"   ON storage.objects;
DROP POLICY IF EXISTS "auth_read_laudos"     ON storage.objects;

CREATE POLICY "auth_upload_laudos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'laudos');

CREATE POLICY "auth_read_laudos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'laudos');

-- ──────────────────────────────────────────────────────────────
-- VERIFICAÇÃO FINAL
-- ──────────────────────────────────────────────────────────────
SELECT
  t.tablename,
  COUNT(p.policyname) AS total_policies
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
  AND t.tablename IN ('profiles','tutores','pets','colaboradores','laudos_pdf')
GROUP BY t.tablename
ORDER BY t.tablename;
