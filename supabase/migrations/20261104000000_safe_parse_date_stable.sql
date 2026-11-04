-- ============================================================================
-- private.safe_parse_date: IMMUTABLE -> STABLE
-- ============================================================================
-- 20260830000000 declarou a função IMMUTABLE, mas o cast text::date depende
-- do parâmetro DateStyle da sessão e por isso é STABLE no PostgreSQL. O
-- `supabase db lint --fail-on warning` do CI rejeita essa divergência.
--
-- Nenhum índice, coluna gerada ou constraint usa a função; o único chamador é
-- private.populate_exam_result_items(uuid), que não depende da volatilidade.
-- O corpo e os privilégios não mudam.
-- ============================================================================

BEGIN;

ALTER FUNCTION private.safe_parse_date(text) STABLE;

COMMIT;
