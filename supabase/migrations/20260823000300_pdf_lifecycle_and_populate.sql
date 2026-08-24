-- ============================================================
-- FEAT-001 — Suporte a deleção imediata de PDF + populate de exam_result_items
--
-- Adiciona:
--   1. laudos_pdf.storage_deleted_at — timestamp da deleção do PDF do Storage
--   2. laudos_pdf.pdf_sha256 — hash do PDF original para trilha de auditoria
--   3. private.populate_exam_result_items() — extrai resultado_ia → exam_result_items
--      Chamada pela Edge Function parse-laudo após finalize_laudo_ia
-- ============================================================

BEGIN;

-- Preflight
DO $$
BEGIN
  IF pg_catalog.to_regclass('public.exam_result_items') IS NULL THEN
    RAISE EXCEPTION 'preflight: public.exam_result_items ausente (20260823000200 deve rodar antes)';
  END IF;
END
$$;

-- ──────────────────────────────────────────────────────────────
-- Colunas de controle de ciclo de vida do PDF
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.laudos_pdf
  ADD COLUMN IF NOT EXISTS storage_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_sha256          text;  -- hash SHA-256 do arquivo original (gravado pela Edge Function)

COMMENT ON COLUMN public.laudos_pdf.storage_deleted_at IS
  'FEAT-001: timestamp em que o PDF foi deletado do Supabase Storage. NULL = arquivo ainda existe ou nunca foi enviado.';
COMMENT ON COLUMN public.laudos_pdf.pdf_sha256 IS
  'FEAT-001: hash SHA-256 do PDF original para trilha de auditoria e integridade. Gravado pela Edge Function no momento do processamento.';

-- Índice para o cron de cleanup (laudos concluídos que ainda não foram deletados).
-- Esta migration usa uma transação explícita; PostgreSQL não permite
-- CREATE INDEX CONCURRENTLY dentro de BEGIN/COMMIT.
CREATE INDEX IF NOT EXISTS idx_laudos_pending_deletion
  ON public.laudos_pdf (created_at ASC)
  WHERE status = 'concluido' AND storage_deleted_at IS NULL;

-- ──────────────────────────────────────────────────────────────
-- Função: private.populate_exam_result_items
--
-- Lê o resultado_ia JSONB de um laudo concluído e insere/atualiza
-- as linhas correspondentes em exam_result_items.
--
-- Chamada pela Edge Function parse-laudo após finalize_laudo_ia.
-- ON CONFLICT DO UPDATE: idempotente, seguro para reprocessar.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.populate_exam_result_items(
  p_laudo_id uuid
)
RETURNS integer  -- número de linhas inseridas/atualizadas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_laudo        record;
  v_resultado    jsonb;
  v_rows_affected integer := 0;
  v_request_role text := COALESCE(
    NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    (SELECT auth.jwt() ->> 'role'),
    ''
  );
BEGIN
  IF v_request_role <> 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'service_role_required';
  END IF;

  IF p_laudo_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_request';
  END IF;

  -- Carrega o laudo e valida estado
  SELECT l.id, l.pet_id, l.clinic_id, l.resultado_ia, l.status, l.created_at
  INTO v_laudo
  FROM public.laudos_pdf AS l
  WHERE l.id = p_laudo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'laudo_not_found';
  END IF;

  IF v_laudo.status <> 'concluido' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'laudo_not_concluded';
  END IF;

  v_resultado := v_laudo.resultado_ia;

  IF v_resultado IS NULL OR pg_catalog.jsonb_typeof(v_resultado) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'resultado_ia_missing';
  END IF;

  -- Resolve espécie do pet para calcular status_ref
  DECLARE
    v_especie text;
    v_data_coleta date;
  BEGIN
    SELECT
      LOWER(COALESCE(p.especie, 'canino')),
      (v_resultado->>'data_coleta')::date
    INTO v_especie, v_data_coleta
    FROM public.pets AS p
    WHERE p.id = v_laudo.pet_id;

    IF NOT FOUND THEN
      v_especie := 'canino';
      v_data_coleta := NULL;
    END IF;

    -- Normaliza espécie para os valores suportados
    IF v_especie NOT IN ('canino', 'felino') THEN
      v_especie := 'outro';
    END IF;

    -- ──────────────────────────────────────────────────────────
    -- INSERT dos parâmetros extraídos
    -- Cada parâmetro: valor, unidade, ref_min, ref_max, status_ref
    -- Referências baseadas em CANINE_REF / FELINE_REF do TypeScript
    -- ──────────────────────────────────────────────────────────
    WITH parametros(parametro, categoria, valor, unidade, ref_min_canino, ref_max_canino, ref_min_felino, ref_max_felino) AS (
      VALUES
        -- Série Vermelha
        ('hemacias',                  'serie_vermelha',     (v_resultado->'serie_vermelha'->>'hemacias')::numeric,                  '×10⁶/µL', 5.5,   8.5,   5.0,   10.0),
        ('hemoglobina',               'serie_vermelha',     (v_resultado->'serie_vermelha'->>'hemoglobina')::numeric,               'g/dL',    12.0,  18.0,  8.0,   15.0),
        ('hematocrito',               'serie_vermelha',     (v_resultado->'serie_vermelha'->>'hematocrito')::numeric,               '%',       37.0,  55.0,  24.0,  45.0),
        ('vcm',                       'serie_vermelha',     (v_resultado->'serie_vermelha'->>'vcm')::numeric,                       'fL',      60.0,  74.0,  39.0,  55.0),
        ('hcm',                       'serie_vermelha',     (v_resultado->'serie_vermelha'->>'hcm')::numeric,                       'pg',      19.5,  24.5,  13.0,  17.0),
        ('chcm',                      'serie_vermelha',     (v_resultado->'serie_vermelha'->>'chcm')::numeric,                      'g/dL',    32.0,  36.0,  30.0,  36.0),
        ('rdw',                       'serie_vermelha',     (v_resultado->'serie_vermelha'->>'rdw')::numeric,                       '%',       14.0,  17.0,  14.0,  18.0),
        -- Série Branca
        ('leucocitos_totais',         'serie_branca',       (v_resultado->'serie_branca'->>'leucocitos_totais')::numeric,           '/µL',     6000,  17000, 5500,  19500),
        ('neutrofilos_segmentados',   'serie_branca',       (v_resultado->'serie_branca'->>'neutrofilos_segmentados')::numeric,     '/µL',     3000,  11500, 2500,  12500),
        ('neutrofilos_bastoes',       'serie_branca',       (v_resultado->'serie_branca'->>'neutrofilos_bastoes')::numeric,         '/µL',     0,     300,   0,     300),
        ('linfocitos',                'serie_branca',       (v_resultado->'serie_branca'->>'linfocitos')::numeric,                  '/µL',     1000,  4800,  1500,  7000),
        ('monocitos',                 'serie_branca',       (v_resultado->'serie_branca'->>'monocitos')::numeric,                   '/µL',     150,   1350,  0,     850),
        ('eosinofilos',               'serie_branca',       (v_resultado->'serie_branca'->>'eosinofilos')::numeric,                 '/µL',     100,   1250,  0,     1500),
        ('basofilos',                 'serie_branca',       (v_resultado->'serie_branca'->>'basofilos')::numeric,                   '/µL',     0,     100,   0,     100),
        -- Plaquetas
        ('plaquetas_contagem',        'plaquetas',          (v_resultado->'plaquetas'->>'contagem')::numeric,                       '×10³/µL', 200,   500,   180,   550),
        ('plaquetas_vpm',             'plaquetas',          (v_resultado->'plaquetas'->>'vpm')::numeric,                            'fL',      7.0,   12.0,  12.0,  18.0),
        -- Bioquímica Renal
        ('ureia',                     'bioquimica_renal',   (v_resultado->'bioquimica'->>'ureia')::numeric,                         'mg/dL',   15.0,  40.0,  20.0,  50.0),
        ('creatinina',                'bioquimica_renal',   (v_resultado->'bioquimica'->>'creatinina')::numeric,                    'mg/dL',   0.5,   1.5,   0.8,   2.4),
        ('fosforo',                   'bioquimica_renal',   (v_resultado->'bioquimica'->>'fosforo')::numeric,                       'mg/dL',   2.5,   6.0,   3.1,   7.5),
        ('potassio',                  'bioquimica_renal',   (v_resultado->'bioquimica'->>'potassio')::numeric,                      'mEq/L',   3.6,   5.5,   3.5,   5.8),
        ('sodio',                     'bioquimica_renal',   (v_resultado->'bioquimica'->>'sodio')::numeric,                         'mEq/L',   140,   154,   149,   162),
        ('albumina',                  'bioquimica_renal',   (v_resultado->'bioquimica'->>'albumina')::numeric,                      'g/dL',    2.6,   3.3,   2.1,   3.3),
        ('proteina_total',            'bioquimica_renal',   (v_resultado->'bioquimica'->>'proteina_total')::numeric,                'g/dL',    5.4,   7.1,   5.2,   8.8),
        -- Bioquímica Hepática
        ('alt_tgp',                   'bioquimica_hepatica',(v_resultado->'bioquimica'->>'alt_tgp')::numeric,                       'U/L',     0,     65.0,  0,     75.0),
        ('ast_tgo',                   'bioquimica_hepatica',(v_resultado->'bioquimica'->>'ast_tgo')::numeric,                       'U/L',     0,     40.0,  0,     40.0)
    ),
    com_refs AS (
      SELECT
        p.parametro,
        p.categoria,
        p.valor,
        p.unidade,
        CASE WHEN v_especie = 'felino' THEN p.ref_min_felino ELSE p.ref_min_canino END AS ref_min,
        CASE WHEN v_especie = 'felino' THEN p.ref_max_felino ELSE p.ref_max_canino END AS ref_max,
        v_especie AS especie,
        v_data_coleta AS data_coleta,
        CASE
          WHEN p.valor IS NULL THEN 'indisponivel'
          WHEN v_especie = 'outro' THEN 'indisponivel'
          WHEN p.valor < (CASE WHEN v_especie = 'felino' THEN p.ref_min_felino ELSE p.ref_min_canino END) THEN 'baixo'
          WHEN p.valor > (CASE WHEN v_especie = 'felino' THEN p.ref_max_felino ELSE p.ref_max_canino END) THEN 'alto'
          ELSE 'normal'
        END AS status_ref
      FROM parametros p
    )
    INSERT INTO public.exam_result_items (
      laudo_id, clinic_id, pet_id,
      parametro, categoria,
      valor, unidade,
      ref_min, ref_max, especie,
      status_ref, data_coleta
    )
    SELECT
      v_laudo.id,
      v_laudo.clinic_id,
      v_laudo.pet_id,
      cr.parametro, cr.categoria,
      cr.valor, cr.unidade,
      cr.ref_min, cr.ref_max, cr.especie,
      cr.status_ref, cr.data_coleta
    FROM com_refs cr
    ON CONFLICT (laudo_id, parametro) DO UPDATE SET
      valor        = EXCLUDED.valor,
      status_ref   = EXCLUDED.status_ref,
      data_coleta  = EXCLUDED.data_coleta,
      extracted_at = now();

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  END;

  RETURN v_rows_affected;
END;
$function$;

ALTER FUNCTION private.populate_exam_result_items(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.populate_exam_result_items(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.populate_exam_result_items(uuid) TO service_role;

COMMENT ON FUNCTION private.populate_exam_result_items(uuid) IS
  'FEAT-001: extrai resultado_ia JSONB de um laudo concluído e popula exam_result_items com valores tipados. Idempotente via ON CONFLICT DO UPDATE. Somente service_role.';

COMMIT;
