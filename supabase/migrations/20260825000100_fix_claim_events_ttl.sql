-- ============================================================
-- FIX-002 — TTL para private.laudo_ia_claim_events
--
-- PROBLEMA IDENTIFICADO (auditoria 2026-08-25):
--   A tabela private.laudo_ia_claim_events cresce indefinidamente.
--   Cada laudo processado gera 1-3 eventos. Em escala (ex: 500 laudos/mês),
--   esta tabela acumulará ~18.000 linhas/ano sem nenhum purge.
--   O Supabase cobra storage por GB — risco de custo progressivo.
--
-- SOLUÇÃO:
--   1. Função private.purge_old_claim_events(p_retention_days integer)
--      que deleta eventos de claims FINALIZADOS (completed/terminal_error)
--      com mais de p_retention_days dias.
--      Preserva eventos de claims ainda ativos (processing/retryable_error).
--
--   2. Wrapper public.purge_old_claim_events() chamável via cron do Supabase
--      com retenção default de 90 dias.
--
-- SEGURANÇA:
--   - Somente service_role pode chamar (via cron interno).
--   - Não deleta eventos de claims em voo (state = 'processing').
--   - Não deleta eventos dos últimos 90 dias (auditoria recente).
-- ============================================================

BEGIN;

-- Preflight
DO $$
BEGIN
  IF pg_catalog.to_regclass('private.laudo_ia_claim_events') IS NULL THEN
    RAISE EXCEPTION 'preflight: private.laudo_ia_claim_events ausente (20260718110000 deve rodar antes)';
  END IF;
  IF pg_catalog.to_regclass('private.laudo_ia_claims') IS NULL THEN
    RAISE EXCEPTION 'preflight: private.laudo_ia_claims ausente';
  END IF;
END
$$;

-- ── Função de purge ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.purge_old_claim_events(
  p_retention_days integer DEFAULT 90
)
RETURNS integer  -- número de linhas deletadas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_deleted integer;
  v_cutoff  timestamptz := pg_catalog.clock_timestamp() - (p_retention_days || ' days')::interval;
  v_request_role text := COALESCE(
    NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    (SELECT auth.jwt() ->> 'role'),
    ''
  );
BEGIN
  IF v_request_role <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'service_role_required';
  END IF;

  IF p_retention_days < 30 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'p_retention_days deve ser >= 30 para preservar auditoria mínima';
  END IF;

  -- Deleta apenas eventos de claims que já encerraram (não estão em voo)
  DELETE FROM private.laudo_ia_claim_events AS e
  WHERE e.created_at < v_cutoff
    AND EXISTS (
      SELECT 1
      FROM private.laudo_ia_claims AS c
      WHERE c.id = e.claim_id
        AND c.state IN ('completed', 'terminal_error')
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted;
END;
$function$;

ALTER FUNCTION private.purge_old_claim_events(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.purge_old_claim_events(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.purge_old_claim_events(integer) TO service_role;

COMMENT ON FUNCTION private.purge_old_claim_events(integer) IS
  'FIX-002: TTL de audit events. Deleta eventos de claims finalizados mais antigos que p_retention_days (default 90). Preserva eventos de claims em voo. Somente service_role.';

-- ── Wrapper público para cron do Supabase ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_old_claim_events()
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.purge_old_claim_events(90);
$function$;

ALTER FUNCTION public.purge_old_claim_events() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.purge_old_claim_events()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_claim_events() TO service_role;

COMMENT ON FUNCTION public.purge_old_claim_events() IS
  'FIX-002: wrapper público para cron. Chama private.purge_old_claim_events(90). Somente service_role.';

COMMIT;
