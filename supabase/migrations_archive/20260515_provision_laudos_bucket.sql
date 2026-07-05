-- Migration: provision_laudos_storage_bucket
-- Aplica no Supabase Dashboard > SQL Editor ou via: supabase db push
-- Deve ser executada UMA VEZ em produção para provisionar o bucket de storage.

-- ── Storage Bucket ────────────────────────────────────────────
-- Bucket privado para armazenar laudos em PDF.
-- file_size_limit: 10 MB | mime: apenas application/pdf
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'laudos',
  'laudos',
  false,
  10485760,  -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ── RLS Policies do Storage ───────────────────────────────────
-- Veterinários autenticados podem fazer upload dentro de sua própria pasta (user_id/)
CREATE POLICY IF NOT EXISTS "vet_upload_laudos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'laudos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Veterinários podem ler apenas laudos dentro de sua própria pasta
CREATE POLICY IF NOT EXISTS "vet_read_own_laudos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'laudos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Veterinários podem deletar apenas seus próprios laudos
CREATE POLICY IF NOT EXISTS "vet_delete_own_laudos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'laudos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin tem acesso total ao bucket
CREATE POLICY IF NOT EXISTS "admin_all_storage_laudos"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'laudos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );
