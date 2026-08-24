BEGIN;
SELECT plan(16);

SELECT is(
  (
    SELECT count(*)
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY (ARRAY[
        'tutores', 'pets', 'triagens', 'follow_ups', 'colaboradores',
        'laudos_pdf', 'exam_result_items'
      ]::name[])
      AND c.relrowsecurity
      AND c.relforcerowsecurity
  ),
  7::bigint,
  'every tenant-owned business table enables and forces RLS'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'tutores', 'pets', 'triagens', 'follow_ups', 'colaboradores',
        'laudos_pdf', 'exam_result_items'
      ]::name[])
  ),
  18::bigint,
  'tenant-owned tables expose only the reviewed 18-policy allowlist'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'tutores', 'pets', 'triagens', 'follow_ups', 'colaboradores',
        'laudos_pdf', 'exam_result_items'
      ]::name[])
      AND lower(coalesce(qual, '') || ' ' || coalesce(with_check, ''))
        NOT LIKE '%has_clinic_role%'
  ),
  0::bigint,
  'every tenant policy authorizes through active clinic membership'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'tutores', 'pets', 'triagens', 'follow_ups', 'colaboradores',
        'laudos_pdf', 'exam_result_items'
      ]::name[])
      AND lower(coalesce(qual, '') || ' ' || coalesce(with_check, ''))
        SIMILAR TO '%(current_user_is_vet_or_admin|profiles)%'
  ),
  0::bigint,
  'no tenant policy authorizes through a global profile role'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'tutores', 'pets', 'triagens', 'follow_ups', 'colaboradores',
        'laudos_pdf', 'exam_result_items'
      ]::name[])
      AND (
        regexp_replace(coalesce(qual, ''), '[[:space:]]', '', 'g') ~ '^\(*true\)*$'
        OR regexp_replace(coalesce(with_check, ''), '[[:space:]]', '', 'g') ~ '^\(*true\)*$'
      )
  ),
  0::bigint,
  'no tenant policy reduces to a global true predicate'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'laudos_pdf'
      AND cmd = 'UPDATE'
  ),
  0::bigint,
  'laudos_pdf has no direct authenticated UPDATE policy'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.laudos_pdf', 'UPDATE'),
  'authenticated cannot update laudos_pdf directly'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'tutores', 'pets', 'triagens', 'follow_ups', 'colaboradores',
        'laudos_pdf', 'exam_result_items'
      ]::name[])
      AND roles <> ARRAY['authenticated']::name[]
  ),
  0::bigint,
  'all tenant policies target authenticated explicitly'
);

SELECT ok(
  pg_catalog.to_regprocedure('public.current_user_is_vet_or_admin()') IS NULL,
  'the obsolete public role-only SECURITY DEFINER helper is removed'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'populate_exam_result_items'
      AND pg_get_userbyid(p.proowner) = 'postgres'
      AND NOT p.prosecdef
      AND coalesce(array_to_string(p.proconfig, ','), '') IN (
        'search_path=',
        'search_path=""',
        'search_path='''''
      )
  ),
  1::bigint,
  'the exposed population RPC is a postgres-owned invoker with empty search_path'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.populate_exam_result_items(uuid)',
    'EXECUTE'
  ),
  'service_role can execute the exposed population RPC'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.populate_exam_result_items(uuid)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.populate_exam_result_items(uuid)',
    'EXECUTE'
  ),
  'Data API client roles cannot execute the population RPC'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) AS privilege
    WHERE n.nspname = 'public'
      AND p.proname = 'populate_exam_result_items'
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'the exposed population RPC grants no EXECUTE to PUBLIC'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'private.populate_exam_result_items(uuid)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'private.populate_exam_result_items(uuid)',
    'EXECUTE'
  ),
  'only the service flow can reach the private population implementation'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_index AS i
    JOIN pg_class AS idx ON idx.oid = i.indexrelid
    JOIN pg_class AS rel ON rel.oid = i.indrelid
    JOIN pg_namespace AS n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND rel.relname = 'laudos_pdf'
      AND idx.relname = 'idx_laudos_pending_deletion'
      AND i.indisvalid
      AND i.indisready
      AND pg_get_expr(i.indpred, i.indrelid)
        = '((status = ''concluido''::text) AND (storage_deleted_at IS NULL))'
  ),
  1::bigint,
  'the cleanup index exists, is valid and keeps the reviewed partial predicate'
);

SELECT is(
  (
    SELECT count(*)
    FROM (VALUES
      ('tutores'), ('pets'), ('triagens'), ('follow_ups'), ('colaboradores'),
      ('laudos_pdf'), ('exam_result_items')
    ) AS expected(table_name)
    WHERE EXISTS (
      SELECT 1
      FROM pg_index AS i
      JOIN pg_class AS rel ON rel.oid = i.indrelid
      JOIN pg_namespace AS n ON n.oid = rel.relnamespace
      JOIN pg_attribute AS a
        ON a.attrelid = rel.oid
       AND a.attnum = (i.indkey::smallint[])[0]
      WHERE n.nspname = 'public'
        AND rel.relname = expected.table_name
        AND i.indisvalid
        AND i.indisready
        AND a.attname = 'clinic_id'
    )
  ),
  7::bigint,
  'every tenant-owned table has a valid index led by clinic_id for RLS filtering'
);

SELECT * FROM finish();
ROLLBACK;
