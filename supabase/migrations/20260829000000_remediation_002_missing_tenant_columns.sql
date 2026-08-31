-- ============================================================
-- REMEDIATION-002 — Adiciona colunas de tenant ausentes
--
-- CONTEXTO (diagnóstico 2026-08-29):
--   A migration 20260718100000_tenancy_expand.sql deveria ter adicionado
--   clinic_id + created_by a TODAS as tabelas de negócio. Em produção:
--     - laudos_pdf.clinic_id    → EXISTS (adicionada manualmente)
--     - laudos_pdf.created_by   → AUSENTE  ← bloqueia 20260718120000
--     - tutores.clinic_id       → AUSENTE  ← bloqueia sprint0 (policy na linha 124)
--     - tutores.created_by      → AUSENTE
--     - pets.clinic_id          → AUSENTE
--     - pets.created_by         → AUSENTE
--     - triagens.clinic_id      → AUSENTE
--     - triagens.created_by     → AUSENTE
--     - follow_ups.clinic_id    → AUSENTE
--     - follow_ups.created_by   → AUSENTE
--     - colaboradores.clinic_id → AUSENTE
--     - colaboradores.created_by → AUSENTE
--
-- O QUE ESTE SCRIPT FAZ:
--   1. Adiciona todas as colunas ausentes com IF NOT EXISTS (seguro)
--   2. Backfill: preenche clinic_id = '00000000-0000-0000-0000-000000000001'
--      para todas as linhas existentes (clínica "Vet do Rim Matriz" em produção)
--   3. Cria índices de performance com IF NOT EXISTS
--
-- EFEITO: libera as etapas 3 e 5 do plano de migração.
-- ============================================================

BEGIN;

-- Preflight
DO $$
BEGIN
  IF pg_catalog.to_regclass('public.tutores') IS NULL THEN
    RAISE EXCEPTION 'preflight: public.tutores ausente';
  END IF;
  IF pg_catalog.to_regclass('public.laudos_pdf') IS NULL THEN
    RAISE EXCEPTION 'preflight: public.laudos_pdf ausente';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clinics
    WHERE id = '00000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION
      'preflight: clínica padrão não encontrada. UUID esperado: 00000000-0000-0000-0000-000000000001';
  END IF;
END
$$;

-- ── laudos_pdf: apenas created_by falta (clinic_id já existe) ─────────────
ALTER TABLE public.laudos_pdf
  ADD COLUMN IF NOT EXISTS created_by uuid;

COMMENT ON COLUMN public.laudos_pdf.created_by IS
  'REMEDIATION-002: ator que criou/reservou o laudo. Equivale a vet_id na maioria dos casos.';

-- ── tutores ─────────────────────────────────────────────────────────────────
ALTER TABLE public.tutores
  ADD COLUMN IF NOT EXISTS clinic_id  uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

COMMENT ON COLUMN public.tutores.clinic_id IS
  'ADR-001 tenant; nullable durante expand/backfill.';
COMMENT ON COLUMN public.tutores.created_by IS
  'ADR-001: ator que criou o registro.';

-- ── pets ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS clinic_id  uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

COMMENT ON COLUMN public.pets.clinic_id IS
  'ADR-001 tenant; deve corresponder ao tenant do tutor.';

-- ── triagens ──────────────────────────────────────────────────────────────────
ALTER TABLE public.triagens
  ADD COLUMN IF NOT EXISTS clinic_id  uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

COMMENT ON COLUMN public.triagens.clinic_id IS
  'ADR-001 tenant; deve corresponder ao tenant do pet/tutor.';

-- ── follow_ups ────────────────────────────────────────────────────────────────
ALTER TABLE public.follow_ups
  ADD COLUMN IF NOT EXISTS clinic_id  uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

COMMENT ON COLUMN public.follow_ups.clinic_id IS
  'ADR-001 tenant; deve corresponder ao tenant da triagem.';

-- ── colaboradores ─────────────────────────────────────────────────────────────
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS clinic_id  uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

COMMENT ON COLUMN public.colaboradores.clinic_id IS
  'ADR-001 tenant.';

-- ── Backfill: preenche clinic_id com a clínica padrão para todos os dados existentes ──
-- Clínica padrão em produção: 00000000-0000-0000-0000-000000000001 (Vet do Rim Matriz)

UPDATE public.tutores
  SET clinic_id = '00000000-0000-0000-0000-000000000001'
  WHERE clinic_id IS NULL;

UPDATE public.pets
  SET clinic_id = '00000000-0000-0000-0000-000000000001'
  WHERE clinic_id IS NULL;

UPDATE public.triagens
  SET clinic_id = '00000000-0000-0000-0000-000000000001'
  WHERE clinic_id IS NULL;

UPDATE public.follow_ups
  SET clinic_id = '00000000-0000-0000-0000-000000000001'
  WHERE clinic_id IS NULL;

UPDATE public.colaboradores
  SET clinic_id = '00000000-0000-0000-0000-000000000001'
  WHERE clinic_id IS NULL;

-- laudos_pdf.clinic_id já tinha valor (era o UUID diferente ou NULL)?
-- Backfill só onde NULL:
UPDATE public.laudos_pdf
  SET clinic_id = '00000000-0000-0000-0000-000000000001'
  WHERE clinic_id IS NULL;

-- Backfill created_by com vet_id onde possível (mesmo ator para dados legados)
UPDATE public.laudos_pdf
  SET created_by = vet_id
  WHERE created_by IS NULL AND vet_id IS NOT NULL;

-- ── Índices de performance (IF NOT EXISTS → seguro re-executar) ─────────────
CREATE INDEX IF NOT EXISTS idx_tutores_clinic
  ON public.tutores(clinic_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_pets_clinic
  ON public.pets(clinic_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_triagens_clinic
  ON public.triagens(clinic_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_follow_ups_clinic
  ON public.follow_ups(clinic_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_colaboradores_clinic
  ON public.colaboradores(clinic_id, ativo, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_laudos_pdf_clinic
  ON public.laudos_pdf(clinic_id, created_at DESC);

-- ── Relatório final ────────────────────────────────────────────────────────
SELECT
  'tutores'         AS tabela, COUNT(*) AS total, COUNT(clinic_id) AS com_clinic_id FROM public.tutores
UNION ALL
SELECT
  'pets'            , COUNT(*), COUNT(clinic_id) FROM public.pets
UNION ALL
SELECT
  'triagens'        , COUNT(*), COUNT(clinic_id) FROM public.triagens
UNION ALL
SELECT
  'follow_ups'      , COUNT(*), COUNT(clinic_id) FROM public.follow_ups
UNION ALL
SELECT
  'colaboradores'   , COUNT(*), COUNT(clinic_id) FROM public.colaboradores
UNION ALL
SELECT
  'laudos_pdf'      , COUNT(*), COUNT(clinic_id) FROM public.laudos_pdf
ORDER BY tabela;

COMMIT;
