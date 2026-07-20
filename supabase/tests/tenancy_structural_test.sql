-- ADR-001 Tenancy — Fase 1 (Expand + Backfill) — pgTAP estrutural.
--
-- Escopo: só invariantes que passam de forma determinística em um replay
-- FRESCO (supabase db reset --local --no-seed), isto é, um banco sem
-- auth.users e sem linhas legadas. Não cria fixtures, não usa auth.users e
-- não assume nenhum dado de negócio — só cataloga o schema deixado por
-- 20260718100000_tenancy_expand.sql e 20260718100100_tenancy_backfill_default_clinic.sql.
--
-- Deliberadamente FORA deste arquivo (ver docs/architecture/fase1-tenancy-implementation-spec.md
-- §5.2/§5.3 e supabase/tests_staged/README.md):
--   * qualquer teste que exija usuários reais em auth.users (matriz Vet A x Vet B);
--   * qualquer invariante do `enforce` (NOT NULL, imutabilidade de tenant, troca de
--     policies legadas por policies de membership) — esse migration ainda está em
--     supabase/migrations_staged/, não na cadeia ativa.
--
-- Estilo: mesmo padrão de supabase/tests/production_safety_test.sql (plan/is/ok/finish,
-- BEGIN/ROLLBACK — nada aqui persiste).

BEGIN;
SELECT plan(16);

-- 1. As três tabelas novas do tenant root existem.
SELECT is(
  (
    SELECT count(*)
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND (
        (n.nspname = 'public' AND c.relname IN ('clinics', 'clinic_memberships'))
        OR (n.nspname = 'private' AND c.relname = 'tenant_backfill_manifest')
      )
  ),
  3::bigint,
  'clinics, clinic_memberships and private.tenant_backfill_manifest all exist'
);

-- 2. RLS habilitada em ambas as tabelas expostas novas.
SELECT is(
  (
    SELECT count(*)
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('clinics', 'clinic_memberships')
      AND c.relrowsecurity
  ),
  2::bigint,
  'RLS is enabled on clinics and clinic_memberships'
);

-- 3. FORCE RLS também habilitado (fecha até para o dono da tabela).
SELECT is(
  (
    SELECT count(*)
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('clinics', 'clinic_memberships')
      AND c.relforcerowsecurity
  ),
  2::bigint,
  'FORCE RLS is enabled on clinics and clinic_memberships'
);

-- 4. As duas policies fail-closed esperadas (por membership ativa) existem.
SELECT is(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (tablename = 'clinics' AND policyname = 'clinics_select_active_member')
        OR (tablename = 'clinic_memberships' AND policyname = 'clinic_memberships_select_self_or_admin')
      )
      AND cmd = 'SELECT'
  ),
  2::bigint,
  'clinics and clinic_memberships each expose exactly the expected membership-scoped SELECT policy'
);

-- 5. Nenhuma policy nessas tabelas reduz a USING(true)/WITH CHECK(true).
SELECT is(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('clinics', 'clinic_memberships')
      AND (
        regexp_replace(coalesce(qual, ''), '[[:space:]]', '', 'g') ~ '^\(*true\)*$'
        OR regexp_replace(coalesce(with_check, ''), '[[:space:]]', '', 'g') ~ '^\(*true\)*$'
      )
  ),
  0::bigint,
  'no policy on clinics or clinic_memberships reduces to global true'
);

-- 6. clinic_id/created_by existem como uuid NULLABLE nas 6 tabelas legadas
--    (Fase 1 é expand: obrigatoriedade só chega no enforce).
SELECT is(
  (
    SELECT count(*)
    FROM (VALUES
      ('tutores', 'clinic_id'), ('tutores', 'created_by'),
      ('pets', 'clinic_id'), ('pets', 'created_by'),
      ('triagens', 'clinic_id'), ('triagens', 'created_by'),
      ('follow_ups', 'clinic_id'), ('follow_ups', 'created_by'),
      ('colaboradores', 'clinic_id'), ('colaboradores', 'created_by'),
      ('laudos_pdf', 'clinic_id'), ('laudos_pdf', 'created_by')
    ) AS expected(table_name, column_name)
    WHERE EXISTS (
      SELECT 1
      FROM information_schema.columns AS c
      WHERE c.table_schema = 'public'
        AND c.table_name = expected.table_name
        AND c.column_name = expected.column_name
        AND c.data_type = 'uuid'
        AND c.is_nullable = 'YES'
    )
  ),
  12::bigint,
  'clinic_id and created_by are nullable uuid columns on all six legacy tables'
);

-- 7. As 19 FKs de tenant/composição entram como NOT VALID (não bloqueiam
--    linhas legadas no expand; VALIDATE só acontece no enforce).
SELECT is(
  (
    SELECT count(*)
    FROM pg_constraint
    WHERE contype = 'f'
      AND NOT convalidated
      AND conname = ANY (ARRAY[
        'fk_tutores_clinic', 'fk_tutores_created_by',
        'fk_pets_clinic', 'fk_pets_created_by', 'fk_pets_tutor_same_clinic',
        'fk_triagens_clinic', 'fk_triagens_created_by',
        'fk_triagens_pet_same_clinic', 'fk_triagens_pet_tutor_same_clinic',
        'fk_follow_ups_clinic', 'fk_follow_ups_created_by',
        'fk_follow_ups_triagem_same_clinic',
        'fk_colaboradores_clinic', 'fk_colaboradores_created_by',
        'fk_colaboradores_membership_same_clinic',
        'fk_laudos_pdf_clinic', 'fk_laudos_pdf_created_by',
        'fk_laudos_pdf_pet_same_clinic', 'fk_laudos_pdf_vet_membership'
      ])
  ),
  19::bigint,
  'all nineteen tenancy foreign keys exist and are still NOT VALID'
);

-- 8. private.has_clinic_role é SECURITY DEFINER, dono postgres, search_path
--    vazio fixo — os três pré-requisitos para ser seguro contra recursão de RLS.
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname = 'has_clinic_role'
      AND pg_get_userbyid(p.proowner) = 'postgres'
      AND p.prosecdef
      AND coalesce(array_to_string(p.proconfig, ','), '') IN (
        'search_path=',
        'search_path=""',
        'search_path=''''
      )
  ),
  1::bigint,
  'private.has_clinic_role is a postgres-owned SECURITY DEFINER helper with an empty search_path'
);

-- 9. EXECUTE do helper não vai para PUBLIC (grantee 0) nem para anon.
SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname = 'has_clinic_role'
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        OR EXISTS (
          SELECT 1
          FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) AS privilege
          WHERE privilege.grantee = 0
            AND privilege.privilege_type = 'EXECUTE'
        )
      )
  ),
  0::bigint,
  'EXECUTE on private.has_clinic_role is not granted to PUBLIC or anon'
);

-- 10. authenticated é o único papel de cliente autorizado a chamar o helper.
SELECT ok(
  has_function_privilege('authenticated', 'private.has_clinic_role(uuid, text[])', 'EXECUTE'),
  'authenticated can execute private.has_clinic_role'
);

-- 11. anon não tem NENHUM privilégio de tabela sobre as três entidades de tenant.
SELECT is(
  (
    SELECT count(*)
    FROM information_schema.table_privileges
    WHERE grantee = 'anon'
      AND (
        (table_schema = 'public' AND table_name IN ('clinics', 'clinic_memberships'))
        OR (table_schema = 'private' AND table_name = 'tenant_backfill_manifest')
      )
  ),
  0::bigint,
  'anon has no table privileges on clinics, clinic_memberships or the backfill manifest'
);

-- 12. authenticated só recebe SELECT em clinics/clinic_memberships (fail-closed:
--     toda escrita do tenant root passa por service_role/servidor).
SELECT is(
  (
    SELECT count(*)
    FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND grantee = 'authenticated'
      AND table_name IN ('clinics', 'clinic_memberships')
      AND privilege_type <> 'SELECT'
  ),
  0::bigint,
  'authenticated has only SELECT on clinics and clinic_memberships'
);

-- 13. O manifesto de backfill é 100% privado: nem authenticated nem service_role
--     recebem grant direto (a escrita é feita como superuser pela própria migration).
SELECT is(
  (
    SELECT count(*)
    FROM information_schema.table_privileges
    WHERE table_schema = 'private'
      AND table_name = 'tenant_backfill_manifest'
      AND grantee IN ('anon', 'authenticated', 'service_role')
  ),
  0::bigint,
  'private.tenant_backfill_manifest grants no privileges to anon, authenticated or service_role'
);

-- 14. A clínica default determinística "Vet do Rim" existe e está ativa
--     (criada pelo backfill, mesmo em banco vazio de CI).
SELECT is(
  (
    SELECT count(*)
    FROM public.clinics
    WHERE id = '00000000-0000-4000-8000-00000000c11c'::uuid
      AND nome = 'Vet do Rim'
      AND status = 'active'
  ),
  1::bigint,
  'the deterministic default clinic "Vet do Rim" exists and is active'
);

-- 15. Em um replay fresco (sem colaboradores/auth.users), o backfill não cria
--     nenhuma membership — não há admin a inventar (spec §2.2 item D).
SELECT is(
  (SELECT count(*) FROM public.clinic_memberships),
  0::bigint,
  'a fresh replay creates zero clinic memberships (no legacy collaborator to derive one from)'
);

-- 16. Em um replay fresco, o manifesto de backfill fica com zero linhas
--     (não há linha de negócio legada para registrar).
SELECT is(
  (SELECT count(*) FROM private.tenant_backfill_manifest),
  0::bigint,
  'private.tenant_backfill_manifest has zero rows on a fresh replay'
);

SELECT * FROM finish();
ROLLBACK;
