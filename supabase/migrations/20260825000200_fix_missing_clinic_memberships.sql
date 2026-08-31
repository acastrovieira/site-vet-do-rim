-- ============================================================
-- FIX-003 — Garante clinic_membership para usuários sem vínculo
--
-- PROBLEMA (causa provável dos erros no Lab Evolution):
--   Usuários criados antes da migration ADR-001 (20260718100000)
--   ou cujo backfill (20260718100100) não foi executado em produção
--   não têm entrada em clinic_memberships. Isso faz com que:
--     - private.claim_laudo_ia() retorne 'laudo_not_found'
--     - private.reserve_laudo_upload() retorne erro de autorização
--     - O upload de laudos falha 100% das vezes
--
-- O QUE ESTE SCRIPT FAZ:
--   1. Verifica se a clínica padrão "Vet do Rim Matriz" existe
--      UUID REAL EM PRODUÇÃO: 00000000-0000-0000-0000-000000000001
--      (confirmado via diagnóstico 2026-08-28)
--   2. Para cada usuário com role 'vet' ou 'admin' em profiles
--      que NÃO tem clinic_membership: cria com role 'clinic_admin'
--      se for admin, 'vet' se for vet
--   3. Registra o que foi criado para auditoria
--
-- SEGURO: usa ON CONFLICT DO NOTHING (idempotente)
-- REVERSÍVEL: delete as linhas inseridas se necessário
-- ============================================================

-- UUID DA CLÍNICA EM PRODUÇÃO (diferente do hardcoded nas migrations originais)
-- Migrations originais:  00000000-0000-4000-8000-00000000c11c
-- UUID REAL no banco:    00000000-0000-0000-0000-000000000001

BEGIN;

-- Preflight
DO $$
BEGIN
  IF pg_catalog.to_regclass('public.clinics') IS NULL THEN
    RAISE EXCEPTION 'preflight: public.clinics ausente (ADR-001 requerido)';
  END IF;
  IF pg_catalog.to_regclass('public.clinic_memberships') IS NULL THEN
    RAISE EXCEPTION 'preflight: public.clinic_memberships ausente';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clinics
    WHERE id = '00000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION
      'Clínica padrão "Vet do Rim Matriz" (UUID 00000000-0000-0000-0000-000000000001) não encontrada.';
  END IF;
END
$$;

-- ── Insere memberships faltantes para vets/admins ──────────────────────
WITH usuarios_sem_membership AS (
  SELECT
    p.id AS user_id,
    p.role,
    CASE p.role
      WHEN 'admin' THEN 'clinic_admin'
      ELSE 'vet'
    END AS membership_role
  FROM public.profiles p
  WHERE p.role IN ('vet', 'admin')
    AND NOT EXISTS (
      SELECT 1
      FROM public.clinic_memberships cm
      WHERE cm.user_id = p.id
        AND cm.clinic_id = '00000000-0000-0000-0000-000000000001'
    )
)
INSERT INTO public.clinic_memberships (
  clinic_id,
  user_id,
  role,
  status,
  created_by
)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid AS clinic_id,
  u.user_id,
  u.membership_role,
  'active',
  NULL  -- sem ator humano identificado; correção de backfill
FROM usuarios_sem_membership u
ON CONFLICT (clinic_id, user_id) DO NOTHING;

-- ── Relatório do que foi inserido ─────────────────────────────────────────
SELECT
  u.email,
  p.role        AS profile_role,
  cm.role       AS membership_role,
  cm.status     AS membership_status,
  cm.criado_em
FROM public.clinic_memberships cm
JOIN auth.users  u ON u.id = cm.user_id
JOIN public.profiles p ON p.id = cm.user_id
WHERE cm.clinic_id = '00000000-0000-0000-0000-000000000001'
ORDER BY u.email;

COMMIT;
