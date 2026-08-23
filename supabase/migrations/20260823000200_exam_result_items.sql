-- ============================================================
-- FEAT-001 — Tabela normalizada exam_result_items
--
-- Estratégia "Extract & Discard":
--   1. IA extrai dados do PDF → grava em resultado_ia (JSONB)
--   2. Dados são normalizados em exam_result_items (colunas tipadas)
--   3. PDF é deletado imediatamente do Storage
--   4. exam_result_items é a fonte de verdade permanente
--
-- Vantagens sobre manter só o JSONB:
--   - Queries SQL nativas por parâmetro (hemacias, creatinina, etc.)
--   - Índices B-tree por parâmetro+data (muito mais rápido que GIN)
--   - Export CSV/XLSX direto via SELECT sem parser de JSONB
--   - Evolução de parâmetros ao longo do tempo em 1 query
-- ============================================================

BEGIN;

-- Preflight
DO $$
BEGIN
  IF pg_catalog.to_regclass('public.laudos_pdf') IS NULL THEN
    RAISE EXCEPTION 'preflight: public.laudos_pdf ausente';
  END IF;
  IF pg_catalog.to_regclass('public.pets') IS NULL THEN
    RAISE EXCEPTION 'preflight: public.pets ausente';
  END IF;
  IF pg_catalog.to_regclass('public.clinics') IS NULL THEN
    RAISE EXCEPTION 'preflight: public.clinics ausente (ADR-001 requerido)';
  END IF;
END
$$;

-- ──────────────────────────────────────────────────────────────
-- Tabela principal de resultados normalizados
-- Cada linha = 1 parâmetro de 1 laudo
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_result_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vínculos de tenant e rastreabilidade
  laudo_id      uuid        NOT NULL REFERENCES public.laudos_pdf(id) ON DELETE CASCADE,
  clinic_id     uuid        NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  pet_id        uuid        NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,

  -- Identificação do parâmetro
  -- Valores válidos espelham HemogramaKey do TypeScript:
  -- serie_vermelha: hemacias, hemoglobina, hematocrito, vcm, hcm, chcm, rdw
  -- serie_branca: leucocitos_totais, neutrofilos_segmentados, neutrofilos_bastoes,
  --               linfocitos, monocitos, eosinofilos, basofilos
  -- plaquetas: plaquetas_contagem, plaquetas_vpm
  -- bioquimica: ureia, creatinina, alt_tgp, ast_tgo, fosforo, potassio,
  --             sodio, albumina, proteina_total
  parametro     text        NOT NULL CHECK (parametro IN (
    'hemacias','hemoglobina','hematocrito','vcm','hcm','chcm','rdw',
    'leucocitos_totais','neutrofilos_segmentados','neutrofilos_bastoes',
    'linfocitos','monocitos','eosinofilos','basofilos',
    'plaquetas_contagem','plaquetas_vpm',
    'ureia','creatinina','alt_tgp','ast_tgo','fosforo','potassio',
    'sodio','albumina','proteina_total'
  )),
  categoria     text        NOT NULL CHECK (categoria IN (
    'serie_vermelha', 'serie_branca', 'plaquetas', 'bioquimica_renal', 'bioquimica_hepatica'
  )),

  -- Valor e unidade
  valor         numeric(12, 4),               -- null = não encontrado no laudo
  unidade       text,                          -- ex: 'g/dL', '%', '/µL'

  -- Intervalo de referência (espécie-específico, gravado no momento da extração)
  ref_min       numeric(12, 4),
  ref_max       numeric(12, 4),
  especie       text        NOT NULL DEFAULT 'canino'
                CHECK (especie IN ('canino', 'felino', 'outro')),

  -- Status calculado em relação ao intervalo de referência
  -- Calculado na inserção e re-calculado se ref_min/ref_max mudarem
  status_ref    text        CHECK (status_ref IN ('normal', 'alto', 'baixo', 'indisponivel')),

  -- Data clínica do exame (da coleta, não do upload)
  data_coleta   date,                          -- null se IA não encontrou a data

  -- Auditoria
  extracted_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Constraint de unicidade: 1 linha por parâmetro por laudo
  CONSTRAINT uq_exam_result_items_laudo_parametro UNIQUE (laudo_id, parametro)
);

COMMENT ON TABLE public.exam_result_items IS
  'FEAT-001: resultados laboratoriais normalizados (1 linha por parâmetro por laudo). Fonte de verdade permanente após deleção do PDF original.';

COMMENT ON COLUMN public.exam_result_items.valor IS
  'Valor numérico extraído pela IA. NULL indica que o parâmetro estava ausente ou ilegível no laudo.';

COMMENT ON COLUMN public.exam_result_items.status_ref IS
  'Status calculado em relação ao intervalo de referência espécie-específico no momento da extração.';

-- ──────────────────────────────────────────────────────────────
-- Índices para queries de performance
-- ──────────────────────────────────────────────────────────────

-- Query mais comum: evolução de um parâmetro de um pet ao longo do tempo
-- SELECT * FROM exam_result_items WHERE pet_id = $1 AND parametro = $2 ORDER BY data_coleta
CREATE INDEX IF NOT EXISTS idx_exam_items_pet_parametro_data
  ON public.exam_result_items (pet_id, parametro, data_coleta ASC NULLS LAST);

-- Query de dashboard: todos os resultados de um laudo específico
CREATE INDEX IF NOT EXISTS idx_exam_items_laudo
  ON public.exam_result_items (laudo_id);

-- Query analítica: parâmetros por clínica (relatórios, agregações)
CREATE INDEX IF NOT EXISTS idx_exam_items_clinic_parametro
  ON public.exam_result_items (clinic_id, parametro, data_coleta DESC NULLS LAST);

-- Filtro por status (alertas: todos os resultados 'alto' ou 'baixo' da clínica)
CREATE INDEX IF NOT EXISTS idx_exam_items_status_ref
  ON public.exam_result_items (clinic_id, status_ref)
  WHERE status_ref IN ('alto', 'baixo');

-- Export CSV/XLSX: busca todos os itens de um pet por período
CREATE INDEX IF NOT EXISTS idx_exam_items_pet_data_coleta
  ON public.exam_result_items (pet_id, data_coleta ASC NULLS LAST);

-- ──────────────────────────────────────────────────────────────
-- RLS — segue o mesmo padrão das outras tabelas clínicas
-- Usa a função STABLE SECURITY DEFINER criada em PERF-002
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.exam_result_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_result_items FORCE ROW LEVEL SECURITY;

-- Service role tem acesso total (para a Edge Function populate)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.exam_result_items TO service_role;
-- Autenticados apenas leem (a gravação é exclusiva da Edge Function via service_role)
GRANT SELECT ON TABLE public.exam_result_items TO authenticated;

DROP POLICY IF EXISTS "exam_items_select_vet_admin" ON public.exam_result_items;
DROP POLICY IF EXISTS "exam_items_insert_service"   ON public.exam_result_items;

CREATE POLICY "exam_items_select_vet_admin"
  ON public.exam_result_items
  FOR SELECT
  TO authenticated
  USING (public.current_user_is_vet_or_admin());

-- Inserts só via service_role (Edge Function); FORCE RLS + GRANT acima garantem isso.
-- Não criamos policy INSERT para authenticated propositalmente.

COMMIT;
