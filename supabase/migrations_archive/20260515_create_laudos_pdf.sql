-- Migration: create_laudos_pdf_table
-- Aplicar manualmente no Supabase Dashboard > SQL Editor
-- ou via: supabase db push

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

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_laudos_pdf_updated_at
  BEFORE UPDATE ON public.laudos_pdf
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.laudos_pdf ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vet_select_own_laudos" ON public.laudos_pdf FOR SELECT USING (vet_id = (SELECT auth.uid()));
CREATE POLICY "vet_insert_laudos"     ON public.laudos_pdf FOR INSERT WITH CHECK (vet_id = (SELECT auth.uid()));
CREATE POLICY "vet_update_own_laudos" ON public.laudos_pdf FOR UPDATE USING (vet_id = (SELECT auth.uid()));
CREATE POLICY "admin_all_laudos"      ON public.laudos_pdf FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

-- Storage bucket (executar uma vez):
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('laudos', 'laudos', false, 10485760, ARRAY['application/pdf'])
-- ON CONFLICT (id) DO NOTHING;

-- RLS Storage
-- CREATE POLICY "vet_upload_laudos" ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'laudos' AND auth.role() = 'authenticated');
-- CREATE POLICY "vet_read_own_laudos" ON storage.objects FOR SELECT
--   USING (bucket_id = 'laudos' AND auth.uid()::text = (storage.foldername(name))[1]);
