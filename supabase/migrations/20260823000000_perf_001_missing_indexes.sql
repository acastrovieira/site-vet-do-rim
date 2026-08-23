-- ============================================================
-- PERF-001 — Índices e otimizações de performance/escalabilidade
-- Auditoria: docs/architecture/db_audit_report.md
--
-- Problemas corrigidos:
--   C2  — profiles(id, role) sem índice → subquery RLS lenta
--   C3  — laudos_pdf.resultado_ia (JSONB) sem GIN index
--   C4  — follow_ups.scheduled_at sem índice (consultas de agendamento)
--   A1  — triagens.criado_em sem índice simples (queries legacy/backfill)
--   A2  — laudos_pdf.tipo_exame sem índice
--   M1  — profiles.ai_quota_reset_date sem índice (reset periódico de cotas)
--
-- NÃO corrigido aqui (requer reescrita de policies — separar em PERF-002):
--   C1  — RLS policies com EXISTS subquery em tabelas de negócio
--         (impacto controlado pela função current_user_is_admin() já existente;
--          reescrever policies exige DROP+CREATE que afeta sessões ativas)
--
-- Seguro para aplicar CONCURRENTLY (não bloqueia writes/reads em produção).
-- Obs: CREATE INDEX CONCURRENTLY não pode rodar dentro de uma transação
-- explícita, então este arquivo NÃO usa BEGIN/COMMIT.
-- ============================================================

-- Preflight: garante que as tabelas necessárias existem
DO $$
BEGIN
  IF pg_catalog.to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'preflight: public.profiles ausente';
  END IF;
  IF pg_catalog.to_regclass('public.laudos_pdf') IS NULL THEN
    RAISE EXCEPTION 'preflight: public.laudos_pdf ausente';
  END IF;
  IF pg_catalog.to_regclass('public.follow_ups') IS NULL THEN
    RAISE EXCEPTION 'preflight: public.follow_ups ausente';
  END IF;
  IF pg_catalog.to_regclass('public.triagens') IS NULL THEN
    RAISE EXCEPTION 'preflight: public.triagens ausente';
  END IF;
END
$$;

-- ──────────────────────────────────────────────────────────────
-- C2 — profiles(id, role): índice composto para RLS lookups
--
-- Toda policy do sistema faz:
--   SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('vet', 'admin')
-- O `id` é PK (B-tree já existe), mas o filtro adicional em `role` sem índice
-- força um re-check no heap. O índice cobrindo (id, role) permite index-only scan.
-- ──────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_id_role
  ON public.profiles (id, role);

-- Índice adicional em role para queries administrativas (listar todos os vets, etc.)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_role
  ON public.profiles (role);

-- ──────────────────────────────────────────────────────────────
-- C3 — laudos_pdf.resultado_ia: GIN index para buscas JSONB
--
-- Permite queries como:
--   WHERE resultado_ia @> '{"diagnostico": "alterado"}'
--   WHERE resultado_ia ? 'campo_especifico'
-- Sem este índice, qualquer busca dentro do JSONB faz Full Scan da tabela.
-- jsonb_path_ops é menor e mais rápido para @> e @? que o padrão.
-- ──────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_laudos_resultado_ia_gin
  ON public.laudos_pdf USING GIN (resultado_ia jsonb_path_ops);

-- GIN também em ia_provenance para queries de auditoria por provider/modelo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_laudos_ia_provenance_gin
  ON public.laudos_pdf USING GIN (ia_provenance jsonb_path_ops)
  WHERE ia_provenance IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- C4 — follow_ups.scheduled_at: índices para agendamento e envio
--
-- Queries críticas de cron/notificação:
--   SELECT * FROM follow_ups WHERE scheduled_at < now() AND sent_at IS NULL
--   SELECT * FROM follow_ups WHERE sent_at IS NOT NULL ORDER BY sent_at DESC
-- ──────────────────────────────────────────────────────────────

-- Índice parcial: apenas follow-ups pendentes (não enviados)
-- É menor que um índice full e cobre 100% das queries de agendamento
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follow_ups_scheduled_pending
  ON public.follow_ups (scheduled_at ASC, clinic_id)
  WHERE sent_at IS NULL AND opt_out = false;

-- Índice para histórico de envios
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follow_ups_sent_at
  ON public.follow_ups (sent_at DESC)
  WHERE sent_at IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- A1 — triagens.criado_em: índice simples de ordenação
--
-- O índice composto idx_triagens_clinic(clinic_id, criado_em DESC) já cobre
-- queries tenant-scoped. Este cobre queries legacy/backfill sem clinic_id
-- e listagens globais de admin.
-- ──────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_triagens_criado
  ON public.triagens (criado_em DESC);

-- Status + criado para filtro de triagens ativas por data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_triagens_status_criado
  ON public.triagens (status, criado_em DESC);

-- ──────────────────────────────────────────────────────────────
-- A2 — laudos_pdf.tipo_exame: índice composto para filtros de UI
--
-- Filtro esperado na listagem de laudos: tipo + clínica + status
-- ──────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_laudos_tipo_exame_clinic
  ON public.laudos_pdf (tipo_exame, clinic_id, created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- M1 — profiles.ai_quota_reset_date: índice para reset periódico
--
-- Job de reset de cotas: SELECT id FROM profiles WHERE ai_quota_reset_date <= now()
-- Sem índice → Full Scan em todos os profiles. Com índice parcial → somente
-- os registros que precisam de reset são tocados.
-- ──────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_quota_reset_due
  ON public.profiles (ai_quota_reset_date ASC)
  WHERE ai_quota_reset_date IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- BÔNUS — laudos_pdf: índice composto para o dashboard principal
--
-- Query mais comum: listar laudos da clínica por status e data
-- Já coberta por idx_laudos_pdf_clinic + idx_laudos_pdf_status,
-- mas o composto evita bitmap heap scan separado
-- ──────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_laudos_clinic_status_date
  ON public.laudos_pdf (clinic_id, status, created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- VERIFICAÇÃO FINAL: lista todos os índices criados nesta migration
-- ──────────────────────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE indexrelname IN (
  'idx_profiles_id_role',
  'idx_profiles_role',
  'idx_laudos_resultado_ia_gin',
  'idx_laudos_ia_provenance_gin',
  'idx_follow_ups_scheduled_pending',
  'idx_follow_ups_sent_at',
  'idx_triagens_criado',
  'idx_triagens_status_criado',
  'idx_laudos_tipo_exame_clinic',
  'idx_profiles_quota_reset_due',
  'idx_laudos_clinic_status_date'
)
ORDER BY tablename, indexname;
