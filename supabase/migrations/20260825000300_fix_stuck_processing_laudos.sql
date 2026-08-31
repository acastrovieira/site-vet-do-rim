-- ============================================================
-- FIX-004 — Libera laudos presos em 'processando' com lease expirada
--
-- PROBLEMA:
--   Laudos que falharam durante o processamento (Edge Function crashou,
--   timeout de rede, etc.) ficam com status='processando' indefinidamente
--   quando a lease expirou mas o claim nunca foi finalizado ou refundado.
--   Esses laudos bloqueiam novos uploads para o mesmo pet pois o UI
--   entende que há um processamento em andamento.
--
-- O QUE ESTE SCRIPT FAZ:
--   1. Identifica claims em estado 'processing' com lease_expires_at < now()
--   2. Aplica refund: quota_state='refunded', state='terminal_error'
--   3. Marca o laudo como status='erro' com erro_ia='lease_expired_recovered'
--   4. Restitui ai_quota_used do vet (se estava reservada)
--   5. Registra evento de auditoria
--
-- SEGURO: só age em leases JÁ EXPIRADAS (nunca em processamento ativo)
-- IDEMPOTENTE: usa state checks explícitos em cada UPDATE
-- ============================================================

BEGIN;

-- Preflight
DO $$
BEGIN
  IF pg_catalog.to_regclass('private.laudo_ia_claims') IS NULL THEN
    RAISE EXCEPTION 'preflight: private.laudo_ia_claims ausente';
  END IF;
END
$$;

-- ── 1. Relatório ANTES da correção ────────────────────────────────────────
-- (para conferência — os dados aparecem no output do SQL Editor)
SELECT
  c.id              AS claim_id,
  c.laudo_id,
  c.actor_user_id,
  c.state,
  c.quota_state,
  c.attempt_count,
  c.lease_expires_at,
  c.lease_expires_at < now() AS lease_expirada,
  l.status          AS laudo_status
FROM private.laudo_ia_claims c
JOIN public.laudos_pdf l ON l.id = c.laudo_id
WHERE c.state = 'processing'
  AND c.lease_expires_at < now();

-- ── 2. Restaura quota dos claims expirados ────────────────────────────────
UPDATE public.profiles AS p
SET ai_quota_used = GREATEST(0, p.ai_quota_used - 1)
WHERE p.id IN (
  SELECT c.actor_user_id
  FROM private.laudo_ia_claims c
  WHERE c.state = 'processing'
    AND c.quota_state = 'reserved'
    AND c.lease_expires_at < now()
);

-- ── 3. Marca claims como terminal_error / refunded ───────────────────────
UPDATE private.laudo_ia_claims AS c
SET
  state       = 'terminal_error',
  quota_state = 'refunded',
  error_code  = 'worker_crashed',
  lease_expires_at = NULL,
  updated_at  = now()
WHERE c.state = 'processing'
  AND c.quota_state = 'reserved'
  AND c.lease_expires_at < now();

-- ── 4. Marca laudos correspondentes como erro ────────────────────────────
UPDATE public.laudos_pdf AS l
SET
  status   = 'erro',
  erro_ia  = 'lease_expired_recovered',
  updated_at = now()
WHERE l.status = 'processando'
  AND EXISTS (
    SELECT 1
    FROM private.laudo_ia_claims c
    WHERE c.laudo_id = l.id
      AND c.state    = 'terminal_error'
      AND c.error_code = 'worker_crashed'
  );

-- ── 5. Insere eventos de auditoria ────────────────────────────────────────
INSERT INTO private.laudo_ia_claim_events (claim_id, event_code, attempt_count, error_code)
SELECT
  c.id,
  'refunded',
  c.attempt_count,
  'worker_crashed'
FROM private.laudo_ia_claims c
WHERE c.state      = 'terminal_error'
  AND c.error_code = 'worker_crashed'
  AND NOT EXISTS (
    SELECT 1
    FROM private.laudo_ia_claim_events e
    WHERE e.claim_id   = c.id
      AND e.event_code IN ('refunded', 'attempts_exhausted')
  );

-- ── 6. Relatório DEPOIS ───────────────────────────────────────────────────
SELECT
  l.id,
  l.status,
  l.erro_ia,
  l.clinic_id,
  l.pet_id,
  l.created_at
FROM public.laudos_pdf l
WHERE l.erro_ia = 'lease_expired_recovered'
ORDER BY l.created_at DESC;

COMMIT;
