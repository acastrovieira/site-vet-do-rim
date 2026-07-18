-- Machine-readable release assertions. Expected failures keep the release NO-GO.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';

WITH checks AS (
  SELECT
    'SEC-001-tenancy-tables'::text AS check_id,
    'P0'::text AS severity,
    to_regclass('public.clinics') IS NOT NULL
      AND to_regclass('public.clinic_memberships') IS NOT NULL AS passed,
    'clinics and clinic_memberships must exist'::text AS expectation

  UNION ALL

  SELECT
    'SEC-002-tenant-columns',
    'P0',
    count(*) = 6,
    'six clinical tables must expose clinic_id'
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'clinic_id'
    AND table_name IN (
      'tutores', 'pets', 'triagens', 'follow_ups', 'colaboradores', 'laudos_pdf'
    )

  UNION ALL

  SELECT
    'SEC-003-core-rls',
    'P0',
    count(*) FILTER (WHERE c.relrowsecurity) = 7,
    'all seven core public tables must have RLS enabled'
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'profiles', 'tutores', 'pets', 'colaboradores',
      'laudos_pdf', 'triagens', 'follow_ups'
    )

  UNION ALL

  SELECT
    'SEC-004-anon-core-grants',
    'P0',
    count(*) = 0,
    'anon must have no core-table privilege'
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN (
      'profiles', 'tutores', 'pets', 'colaboradores',
      'laudos_pdf', 'triagens', 'follow_ups'
    )
    AND grantee = 'anon'

  UNION ALL

  SELECT
    'SEC-005-laudo-server-fields',
    'P0',
    NOT EXISTS (
      SELECT 1
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = 'laudos_pdf'
        AND grantee = 'authenticated'
        AND privilege_type = 'UPDATE'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.role_column_grants
      WHERE table_schema = 'public'
        AND table_name = 'laudos_pdf'
        AND grantee = 'authenticated'
        AND privilege_type = 'UPDATE'
        AND column_name IN (
          'vet_id', 'pet_id', 'storage_path', 'status', 'resultado_ia', 'erro_ia'
        )
    ),
    'authenticated must not change server-owned laudo fields directly'

  UNION ALL

  SELECT
    'SEC-006-storage-bucket-private',
    'P0',
    count(*) = 1 AND bool_and(NOT public),
    'laudos bucket must exist exactly once and remain private'
  FROM storage.buckets
  WHERE id = 'laudos'

  UNION ALL

  SELECT
    'SEC-007-storage-pdf-limits',
    'P1',
    count(*) = 1
      AND bool_and(file_size_limit IS NOT NULL AND file_size_limit <= 10485760)
      AND bool_and('application/pdf' = ANY(COALESCE(allowed_mime_types, ARRAY[]::text[]))),
    'laudos bucket must enforce PDF and a maximum of 10 MiB'
  FROM storage.buckets
  WHERE id = 'laudos'

  UNION ALL

  SELECT
    'SEC-008-storage-removal-policy',
    'P1',
    count(*) >= 1,
    'authenticated rollback needs a tenant-aware object removal policy'
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND lower(cmd) = 'delete'
    AND 'authenticated' = ANY(roles)

  UNION ALL

  SELECT
    'SEC-009-public-security-definer',
    'P0',
    count(*) = 0,
    'SECURITY DEFINER functions must not be executable by PUBLIC'
  FROM pg_catalog.pg_proc AS p
  JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public', 'private')
    AND p.prosecdef
    AND EXISTS (
      SELECT 1
      FROM pg_catalog.aclexplode(
        COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
      ) AS function_acl
      WHERE function_acl.grantee = 0
        AND function_acl.privilege_type = 'EXECUTE'
    )

  UNION ALL

  SELECT
    'SEC-010-unconditional-core-policy',
    'P0',
    count(*) = 0,
    'core policies must not use an unconditional true predicate'
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'profiles', 'tutores', 'pets', 'colaboradores',
      'laudos_pdf', 'triagens', 'follow_ups'
    )
    AND (
      btrim(COALESCE(qual, '')) IN ('true', '(true)')
      OR btrim(COALESCE(with_check, '')) IN ('true', '(true)')
    )

  UNION ALL

  SELECT
    'SEC-011-authenticated-data-api-grants',
    'P1',
    count(*) = 6,
    'authenticated needs explicit SELECT grants for every app-critical table'
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN (
      'profiles', 'tutores', 'pets', 'laudos_pdf', 'triagens', 'follow_ups'
    )
    AND grantee = 'authenticated'
    AND privilege_type = 'SELECT'

  UNION ALL

  SELECT
    'SEC-012-service-role-data-api-grants',
    'P1',
    count(*) = 4,
    'service_role needs explicit SELECT and UPDATE grants for profiles and laudos_pdf'
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('profiles', 'laudos_pdf')
    AND grantee = 'service_role'
    AND privilege_type IN ('SELECT', 'UPDATE')
)
SELECT pg_catalog.jsonb_build_object(
  'contract', 'vetdorim-release-gate-v1',
  'passed', bool_and(passed),
  'checks', pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'checkId', check_id,
      'severity', severity,
      'passed', passed,
      'expectation', expectation
    )
    ORDER BY severity, check_id
  )
)::text AS release_gate_json
FROM checks;

ROLLBACK;
