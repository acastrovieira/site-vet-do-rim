-- AUDIT-001 Fase 2 (Tarefa 2.5) — pgTAP ESTRUTURAL da reserva server-side de
-- upload de laudo + compensacao deterministica de Storage (P1-3).
--
-- Escopo: so invariantes que passam de forma deterministica num replay FRESCO
-- (supabase db reset --local --no-seed) — banco sem auth.users e sem linhas
-- legadas. So cataloga o schema deixado por
-- 20260718120000_laudo_upload_reservation.sql: existencia dos RPCs,
-- seguranca (SECURITY DEFINER/INVOKER + search_path fixo + dono postgres),
-- privilegios minimos (EXECUTE so para authenticated; revogado de
-- PUBLIC/anon/service_role), as duas policies de Storage aditivas, a trilha
-- de compensacao (abandoned_at/abandoned_by) e o novo status 'abandonado'.
--
-- Deliberadamente FORA deste arquivo (mesmo espirito de
-- supabase/tests/laudo_transaction_test.sql): qualquer teste COMPORTAMENTAL
-- que exija auth.users real (reserva de fato, limite anti-abuso de 5
-- reservas orfas, abandon cross-tenant, upload via Storage API). Aqui nada
-- persiste nem executa os RPCs.
--
-- Estilo: mesmo padrao de supabase/tests/laudo_transaction_test.sql e
-- tenancy_structural_test.sql (plan/is/ok/finish, BEGIN/ROLLBACK).

BEGIN;
SELECT plan(20);

-- 1. As duas RPCs privilegiadas existem em private.
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname IN ('reserve_laudo_upload', 'abandon_laudo_upload')
  ),
  2::bigint,
  'private.reserve_laudo_upload and abandon_laudo_upload both exist'
);

-- 2. As duas RPCs privadas sao SECURITY DEFINER, dono postgres, search_path vazio.
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname IN ('reserve_laudo_upload', 'abandon_laudo_upload')
      AND p.prosecdef
      AND pg_get_userbyid(p.proowner) = 'postgres'
      AND coalesce(array_to_string(p.proconfig, ','), '') IN (
        'search_path=',
        'search_path=""',
        'search_path='''''
      )
  ),
  2::bigint,
  'the two private RPCs are postgres-owned SECURITY DEFINER with an empty search_path'
);

-- 3. Os dois wrappers da Data API existem em public e sao SECURITY INVOKER.
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('reserve_laudo_upload', 'abandon_laudo_upload')
      AND NOT p.prosecdef
      AND coalesce(array_to_string(p.proconfig, ','), '') IN (
        'search_path=',
        'search_path=""',
        'search_path='''''
      )
  ),
  2::bigint,
  'the two public wrappers exist as SECURITY INVOKER with an empty search_path'
);

-- 4. Nenhuma das quatro funcoes concede EXECUTE a PUBLIC (grantee 0).
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) AS privilege
    WHERE n.nspname IN ('public', 'private')
      AND p.proname IN ('reserve_laudo_upload', 'abandon_laudo_upload')
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'none of the reserve/abandon functions grant EXECUTE to PUBLIC'
);

-- 5. anon nao pode executar nenhuma das quatro funcoes.
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      AND p.proname IN ('reserve_laudo_upload', 'abandon_laudo_upload')
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  0::bigint,
  'anon cannot execute any reserve/abandon function'
);

-- 6. service_role NAO pode executar nenhuma das quatro funcoes (contrato:
--    somente o browser autenticado via API server-side; nao ha claim/finalize/
--    refund aqui).
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      AND p.proname IN ('reserve_laudo_upload', 'abandon_laudo_upload')
      AND has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  0::bigint,
  'service_role cannot execute any reserve/abandon function'
);

-- 7. authenticated PODE executar exatamente as quatro funcoes.
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      AND p.proname IN ('reserve_laudo_upload', 'abandon_laudo_upload')
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  4::bigint,
  'authenticated can execute all four wrapper/implementation functions'
);

-- 8. O helper de autorizacao de Storage existe, e SECURITY DEFINER, dono
--    postgres, search_path vazio (mesmo padrao de private.has_clinic_role,
--    necessario para nao sofrer dupla aplicacao de RLS de laudos_pdf).
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname = 'can_access_reserved_laudo_object'
      AND p.prosecdef
      AND pg_get_userbyid(p.proowner) = 'postgres'
      AND coalesce(array_to_string(p.proconfig, ','), '') IN (
        'search_path=',
        'search_path=""',
        'search_path='''''
      )
  ),
  1::bigint,
  'private.can_access_reserved_laudo_object is a postgres-owned SECURITY DEFINER helper with an empty search_path'
);

-- 9. authenticated pode executar o helper; anon e PUBLIC nao.
SELECT ok(
  has_function_privilege('authenticated', 'private.can_access_reserved_laudo_object(text, text[], boolean)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'private.can_access_reserved_laudo_object(text, text[], boolean)', 'EXECUTE'),
  'authenticated can execute the storage authorization helper; anon cannot'
);

-- 10. As duas policies de Storage ADITIVAS existem com o comando esperado.
SELECT is(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        (policyname = 'reserved_upload_laudos' AND cmd = 'INSERT')
        OR (policyname = 'reserved_read_laudos' AND cmd = 'SELECT')
      )
  ),
  2::bigint,
  'reserved_upload_laudos (INSERT) and reserved_read_laudos (SELECT) both exist on storage.objects'
);

-- 11. As policies legadas (owner_upload_laudos, owner_read_laudos) continuam
--     ativas — a migration e ADITIVA, nunca remove a autorizacao existente.
SELECT is(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname IN ('owner_upload_laudos', 'owner_read_laudos')
  ),
  2::bigint,
  'the legacy owner_upload_laudos and owner_read_laudos policies remain active'
);

-- 12. Nenhuma das duas policies novas reduz a USING(true)/WITH CHECK(true).
SELECT is(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname IN ('reserved_upload_laudos', 'reserved_read_laudos')
      AND (
        regexp_replace(coalesce(qual, ''), '[[:space:]]', '', 'g') ~ '^\(*true\)*$'
        OR regexp_replace(coalesce(with_check, ''), '[[:space:]]', '', 'g') ~ '^\(*true\)*$'
      )
  ),
  0::bigint,
  'neither new storage policy reduces to a global true predicate'
);

-- 13. Nenhuma policy de UPDATE existe para storage.objects no bucket laudos —
--     upsert continua proibido (nenhum caminho de re-escrita de objeto).
SELECT is(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd = 'UPDATE'
  ),
  0::bigint,
  'storage.objects has no UPDATE policy — object upsert remains impossible'
);

-- 14. laudos_pdf.abandoned_at e abandoned_by existem, nullable, com os tipos
--     esperados (trilha de compensacao).
SELECT is(
  (
    SELECT count(*)
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'laudos_pdf'
      AND (
        (c.column_name = 'abandoned_at' AND c.data_type = 'timestamp with time zone' AND c.is_nullable = 'YES')
        OR (c.column_name = 'abandoned_by' AND c.data_type = 'uuid' AND c.is_nullable = 'YES')
      )
  ),
  2::bigint,
  'laudos_pdf.abandoned_at and abandoned_by exist as nullable columns'
);

-- 15. O CHECK de status aceita o novo valor 'abandonado' junto dos quatro
--     valores legados — nenhum deles foi removido.
SELECT is(
  (
    SELECT count(*)
    FROM pg_constraint
    WHERE conname = 'laudos_pdf_status_check'
      AND conrelid = 'public.laudos_pdf'::regclass
      AND pg_get_constraintdef(oid) LIKE '%''pendente''%'
      AND pg_get_constraintdef(oid) LIKE '%''processando''%'
      AND pg_get_constraintdef(oid) LIKE '%''concluido''%'
      AND pg_get_constraintdef(oid) LIKE '%''erro''%'
      AND pg_get_constraintdef(oid) LIKE '%''abandonado''%'
  ),
  1::bigint,
  'the status CHECK constraint keeps all four legacy values and adds abandonado'
);

-- 16. abandoned_by referencia auth.users com ON DELETE SET NULL (mesmo padrao
--     de laudos_pdf.created_by).
SELECT is(
  (
    SELECT count(*)
    FROM pg_constraint AS con
    JOIN pg_class AS rel ON rel.oid = con.confrelid
    JOIN pg_namespace AS rel_ns ON rel_ns.oid = rel.relnamespace
    WHERE con.conrelid = 'public.laudos_pdf'::regclass
      AND con.contype = 'f'
      AND con.confdeltype = 'n'
      AND rel_ns.nspname = 'auth'
      AND rel.relname = 'users'
      AND con.conkey = ARRAY[
        (
          SELECT attnum FROM pg_attribute
          WHERE attrelid = 'public.laudos_pdf'::regclass AND attname = 'abandoned_by'
        )
      ]
  ),
  1::bigint,
  'abandoned_by has a validated FK to auth.users with ON DELETE SET NULL'
);

-- 17. private.has_clinic_role (pre-requisito) continua existindo e acessivel
--     — a nova migration depende dele para os checks de membership.
SELECT ok(
  has_function_privilege('authenticated', 'private.has_clinic_role(uuid, text[])', 'EXECUTE'),
  'private.has_clinic_role remains callable by authenticated (dependency of this migration)'
);

-- 18. service_role tem USAGE no schema private (herdado da migration
--     anterior); authenticated tambem (necessario para os wrappers invoker
--     desta migration alcancarem private).
SELECT ok(
  has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated has USAGE on the private schema'
);

-- 19. Num replay fresco (sem auth.users/linhas legadas), zero laudos existem.
SELECT is(
  (SELECT count(*) FROM public.laudos_pdf),
  0::bigint,
  'a fresh replay creates zero laudos_pdf rows'
);

-- 20. Num replay fresco, o bucket "laudos" existe (pre-requisito consumido
--     pelo helper anti-abuso e pelas policies desta migration).
SELECT is(
  (SELECT count(*) FROM storage.buckets WHERE id = 'laudos'),
  1::bigint,
  'the "laudos" storage bucket exists on a fresh replay'
);

SELECT * FROM finish();
ROLLBACK;
