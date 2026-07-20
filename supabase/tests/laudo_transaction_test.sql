-- AUDIT-001 Fase 2 (Tarefa 2.1) — pgTAP ESTRUTURAL do contrato claim/finalize/refund.
--
-- Escopo: so invariantes que passam de forma deterministica num replay FRESCO
-- (supabase db reset --local --no-seed) — banco sem auth.users e sem linhas
-- legadas. So cataloga o schema deixado por
-- 20260718110000_laudo_claim_finalize_refund.sql: existencia das RPCs, seguranca
-- (SECURITY DEFINER + search_path fixo + dono postgres), privilegios minimos
-- (EXECUTE so para service_role; revogado de PUBLIC/anon/authenticated), tabelas
-- privadas fechadas, indices de invariantes e a coluna nova de proveniencia.
--
-- Deliberadamente FORA deste arquivo (ver docs/architecture/drafts/laudos-ia/test-matrix.md
-- e a Tarefa 2.4/qa): TODO teste COMPORTAMENTAL de concorrencia, lease, quota,
-- reclaim e compensacao (exige duas sessoes reais, auth.users e barreira
-- deterministica). Aqui nada persiste nem executa as RPCs.
--
-- Estilo: mesmo padrao de supabase/tests/production_safety_test.sql e
-- tenancy_structural_test.sql (plan/is/ok/finish, BEGIN/ROLLBACK).

BEGIN;
SELECT plan(17);

-- 1. As tres RPCs privilegiadas existem em private.
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname IN ('claim_laudo_ia', 'finalize_laudo_ia', 'refund_laudo_ia')
  ),
  3::bigint,
  'private.claim_laudo_ia, finalize_laudo_ia and refund_laudo_ia all exist'
);

-- 2. As tres RPCs privadas sao SECURITY DEFINER, dono postgres, search_path vazio.
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname IN ('claim_laudo_ia', 'finalize_laudo_ia', 'refund_laudo_ia')
      AND p.prosecdef
      AND pg_get_userbyid(p.proowner) = 'postgres'
      AND coalesce(array_to_string(p.proconfig, ','), '') IN (
        'search_path=',
        'search_path=""',
        'search_path='''''
      )
  ),
  3::bigint,
  'the three private RPCs are postgres-owned SECURITY DEFINER with an empty search_path'
);

-- 3. Os tres wrappers da Data API existem em public e sao SECURITY INVOKER
--    (a autoridade fica na implementacao private, nao no wrapper exposto).
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('claim_laudo_ia', 'finalize_laudo_ia', 'refund_laudo_ia')
      AND NOT p.prosecdef
      AND coalesce(array_to_string(p.proconfig, ','), '') IN (
        'search_path=',
        'search_path=""',
        'search_path='''''
      )
  ),
  3::bigint,
  'the three public wrappers exist as SECURITY INVOKER with an empty search_path'
);

-- 4. Nenhuma das seis funcoes concede EXECUTE a PUBLIC (grantee 0).
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) AS privilege
    WHERE n.nspname IN ('public', 'private')
      AND p.proname IN ('claim_laudo_ia', 'finalize_laudo_ia', 'refund_laudo_ia')
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'none of the claim/finalize/refund functions grant EXECUTE to PUBLIC'
);

-- 5. anon nao pode executar nenhuma das seis funcoes.
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      AND p.proname IN ('claim_laudo_ia', 'finalize_laudo_ia', 'refund_laudo_ia')
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  0::bigint,
  'anon cannot execute any claim/finalize/refund function'
);

-- 6. authenticated NAO pode executar nenhuma das seis funcoes (contrato:
--    somente service_role; o browser nunca chama estas RPCs direto).
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      AND p.proname IN ('claim_laudo_ia', 'finalize_laudo_ia', 'refund_laudo_ia')
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  0::bigint,
  'authenticated cannot execute any claim/finalize/refund function'
);

-- 7. service_role PODE executar exatamente as seis funcoes (o unico papel do contrato).
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      AND p.proname IN ('claim_laudo_ia', 'finalize_laudo_ia', 'refund_laudo_ia')
      AND has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  6::bigint,
  'service_role can execute all six wrapper/implementation functions'
);

-- 8. finalize (public e private) expoe o parametro de proveniencia p_provenance jsonb.
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      AND p.proname = 'finalize_laudo_ia'
      AND pg_get_function_arguments(p.oid) LIKE '%p_provenance jsonb%'
  ),
  2::bigint,
  'both finalize wrappers accept the p_provenance jsonb argument'
);

-- 9. A coluna de proveniencia existe em laudos_pdf como jsonb NULLABLE,
--    SEPARADA do resultado_ia clinico.
SELECT is(
  (
    SELECT count(*)
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'laudos_pdf'
      AND c.column_name = 'ia_provenance'
      AND c.data_type = 'jsonb'
      AND c.is_nullable = 'YES'
  ),
  1::bigint,
  'public.laudos_pdf.ia_provenance exists as a nullable jsonb column'
);

-- 10. As duas tabelas privadas de estado existem.
SELECT is(
  (
    SELECT count(*)
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'private'
      AND c.relkind = 'r'
      AND c.relname IN ('laudo_ia_claims', 'laudo_ia_claim_events')
  ),
  2::bigint,
  'private.laudo_ia_claims and private.laudo_ia_claim_events exist'
);

-- 11. As tabelas privadas nao concedem NENHUM privilegio a anon/authenticated/
--     service_role — todo acesso passa pelas RPCs SECURITY DEFINER (dono postgres).
SELECT is(
  (
    SELECT count(*)
    FROM information_schema.table_privileges
    WHERE table_schema = 'private'
      AND table_name IN ('laudo_ia_claims', 'laudo_ia_claim_events')
      AND grantee IN ('anon', 'authenticated', 'service_role')
  ),
  0::bigint,
  'the private claim/event tables grant nothing to anon, authenticated or service_role'
);

-- 12. Indice parcial que garante NO MAXIMO UMA reserva aberta por laudo.
SELECT is(
  (
    SELECT count(*)
    FROM pg_index AS i
    JOIN pg_class AS ir ON ir.oid = i.indexrelid
    WHERE ir.relname = 'laudo_ia_claims_one_open_reservation_per_laudo_idx'
      AND i.indisunique
      AND i.indpred IS NOT NULL
  ),
  1::bigint,
  'a partial UNIQUE index enforces at most one open reservation per laudo'
);

-- 13. Chave idempotente unica por (clinic_id, actor_user_id, idempotency_key).
SELECT is(
  (
    SELECT count(*)
    FROM pg_constraint
    WHERE conname = 'laudo_ia_claims_idempotency_uniq'
      AND contype = 'u'
      AND conrelid = 'private.laudo_ia_claims'::regclass
  ),
  1::bigint,
  'the idempotency key is unique per (clinic_id, actor_user_id, idempotency_key)'
);

-- 14. Cardinalidade maxima 1 de finalized e 1 de refunded/attempts_exhausted por claim.
SELECT is(
  (
    SELECT count(*)
    FROM pg_index AS i
    JOIN pg_class AS ir ON ir.oid = i.indexrelid
    WHERE ir.relname IN (
        'laudo_ia_claim_events_one_finalized_idx',
        'laudo_ia_claim_events_one_refunded_idx'
      )
      AND i.indisunique
      AND i.indpred IS NOT NULL
  ),
  2::bigint,
  'partial UNIQUE indexes cap finalized and refunded events at one per claim'
);

-- 15. service_role tem USAGE no schema private (necessario para os wrappers
--     invoker alcancarem as RPCs); anon NAO tem.
SELECT ok(
  has_schema_privilege('service_role', 'private', 'USAGE')
    AND NOT has_schema_privilege('anon', 'private', 'USAGE'),
  'service_role has USAGE on private; anon does not'
);

-- 16. Num replay fresco (sem auth.users/linhas legadas), zero claims sao criados.
SELECT is(
  (SELECT count(*) FROM private.laudo_ia_claims),
  0::bigint,
  'a fresh replay creates zero laudo IA claims'
);

-- 17. Num replay fresco, zero eventos de claim sao registrados.
SELECT is(
  (SELECT count(*) FROM private.laudo_ia_claim_events),
  0::bigint,
  'a fresh replay records zero claim events'
);

SELECT * FROM finish();
ROLLBACK;
