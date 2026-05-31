-- ============================================================
-- FIX: RLS para laudos_pdf + Storage bucket laudos
-- Execute em: https://supabase.com/dashboard/project/ycclyzoslirpnnwgzrqx/sql/new
-- ============================================================

-- ── 1. laudos_pdf RLS ────────────────────────────────────────
ALTER TABLE public.laudos_pdf ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_laudos"  ON public.laudos_pdf;
DROP POLICY IF EXISTS "auth_insert_laudos"  ON public.laudos_pdf;
DROP POLICY IF EXISTS "auth_update_laudos"  ON public.laudos_pdf;

CREATE POLICY "auth_select_laudos" ON public.laudos_pdf
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_laudos" ON public.laudos_pdf
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_laudos" ON public.laudos_pdf
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── 2. Storage: criar bucket laudos (se não existir) ─────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'laudos',
  'laudos',
  false,
  10485760,  -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit   = 10485760,
  allowed_mime_types = ARRAY['application/pdf'];

-- ── 3. Storage: políticas do bucket laudos ───────────────────
DROP POLICY IF EXISTS "laudos_upload"  ON storage.objects;
DROP POLICY IF EXISTS "laudos_read"    ON storage.objects;
DROP POLICY IF EXISTS "laudos_delete"  ON storage.objects;

CREATE POLICY "laudos_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'laudos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "laudos_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'laudos');

CREATE POLICY "laudos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'laudos' AND (storage.foldername(name))[1] = auth.uid()::text);
