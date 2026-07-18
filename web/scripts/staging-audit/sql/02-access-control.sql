-- Security metadata only. Policy expressions may be reviewed, but no rows are read.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';

SELECT
  table_schema,
  table_name,
  grantee,
  string_agg(privilege_type, ',' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema IN ('public', 'storage')
  AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
GROUP BY table_schema, table_name, grantee
ORDER BY table_schema, table_name, grantee;

SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  permissive,
  qual,
  with_check
FROM pg_catalog.pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  p.prosecdef AS security_definer,
  p.proconfig AS runtime_settings,
  EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(
      COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) AS function_acl
    WHERE function_acl.grantee = 0
      AND function_acl.privilege_type = 'EXECUTE'
  ) AS public_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'private')
ORDER BY n.nspname, p.proname, identity_arguments;

SELECT
  b.id AS bucket_id,
  b.public,
  b.file_size_limit,
  b.allowed_mime_types
FROM storage.buckets AS b
WHERE b.id = 'laudos';

SELECT
  pg_catalog.pg_get_userbyid(d.defaclrole) AS owner_role,
  n.nspname AS schema_name,
  d.defaclobjtype AS object_type,
  CASE
    WHEN x.grantee = 0 THEN 'PUBLIC'
    ELSE pg_catalog.pg_get_userbyid(x.grantee)
  END AS grantee,
  x.privilege_type
FROM pg_catalog.pg_default_acl AS d
LEFT JOIN pg_catalog.pg_namespace AS n ON n.oid = d.defaclnamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) AS x
WHERE n.nspname IN ('public', 'storage') OR n.nspname IS NULL
ORDER BY owner_role, schema_name, object_type, grantee, privilege_type;

ROLLBACK;
