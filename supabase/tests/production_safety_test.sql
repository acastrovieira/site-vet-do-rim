BEGIN;
SELECT plan(17);

SELECT is(
  (
    SELECT count(*)
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname = ANY (ARRAY[
        'profiles',
        'tutores',
        'pets',
        'colaboradores',
        'laudos_pdf',
        'triagens',
        'follow_ups'
      ])
  ),
  7::bigint,
  'all seven clinical tables exist'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relrowsecurity
      AND c.relname = ANY (ARRAY[
        'profiles',
        'tutores',
        'pets',
        'colaboradores',
        'laudos_pdf',
        'triagens',
        'follow_ups'
      ])
  ),
  7::bigint,
  'RLS is enabled on every clinical table'
);

SELECT is(
  (
    SELECT count(*)
    FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND grantee = 'anon'
      AND table_name = ANY (ARRAY[
        'profiles',
        'tutores',
        'pets',
        'colaboradores',
        'laudos_pdf',
        'triagens',
        'follow_ups'
      ])
  ),
  0::bigint,
  'anon has no table privileges on clinical data'
);

SELECT is(
  (
    SELECT count(*)
    FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND grantee IN ('anon', 'authenticated')
      AND privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN')
  ),
  0::bigint,
  'Data API roles have no schema-administration table privileges'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_default_acl AS d
    JOIN pg_roles AS owner ON owner.oid = d.defaclrole
    CROSS JOIN LATERAL aclexplode(d.defaclacl) AS privilege
    JOIN pg_roles AS grantee ON grantee.oid = privilege.grantee
    WHERE d.defaclnamespace = 'public'::regnamespace
      AND d.defaclobjtype = 'r'
      AND owner.rolname = 'postgres'
      AND grantee.rolname IN ('anon', 'authenticated')
  ),
  0::bigint,
  'future public tables do not grant privileges to Data API roles'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_default_acl AS d
    JOIN pg_roles AS owner ON owner.oid = d.defaclrole
    CROSS JOIN LATERAL aclexplode(d.defaclacl) AS privilege
    JOIN pg_roles AS grantee ON grantee.oid = privilege.grantee
    WHERE d.defaclnamespace = 'public'::regnamespace
      AND d.defaclobjtype = 'S'
      AND owner.rolname = 'postgres'
      AND grantee.rolname IN ('anon', 'authenticated')
  ),
  0::bigint,
  'future public sequences do not grant privileges to Data API roles'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_default_acl AS d
    JOIN pg_roles AS owner ON owner.oid = d.defaclrole
    CROSS JOIN LATERAL aclexplode(d.defaclacl) AS privilege
    WHERE d.defaclnamespace = 'public'::regnamespace
      AND d.defaclobjtype = 'f'
      AND owner.rolname = 'postgres'
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'future public functions do not grant EXECUTE to PUBLIC'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_index AS i
    JOIN pg_class AS index_relation ON index_relation.oid = i.indexrelid
    JOIN pg_class AS table_relation ON table_relation.oid = i.indrelid
    JOIN pg_namespace AS n ON n.oid = table_relation.relnamespace
    WHERE n.nspname = 'public'
      AND table_relation.relname = 'colaboradores'
      AND index_relation.relname = 'idx_colaboradores_supabase_uid'
      AND i.indisvalid
      AND i.indisready
      AND pg_get_indexdef(i.indexrelid) LIKE '% (supabase_uid)'
  ),
  1::bigint,
  'the colaboradores Auth foreign key has a valid covering index'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  0::bigint,
  'anon cannot execute project-owned SECURITY DEFINER functions'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      AND p.prosecdef
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
      AND NOT (
        (n.nspname = 'private' AND p.proname = 'current_user_is_admin')
        OR (n.nspname = 'public' AND p.proname = 'increment_ai_quota')
      )
  ),
  0::bigint,
  'authenticated has no unapproved SECURITY DEFINER entry point'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE p.prosecdef
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
      AND (
        (n.nspname = 'private' AND p.proname = 'current_user_is_admin')
        OR (n.nspname = 'public' AND p.proname = 'increment_ai_quota')
      )
  ),
  2::bigint,
  'authenticated can execute the two approved SECURITY DEFINER functions'
);

SELECT ok(
  NOT has_schema_privilege('anon', 'private', 'USAGE'),
  'anon cannot use the private schema'
);

SELECT is(
  (
    SELECT count(*)
    FROM storage.buckets
    WHERE id = 'laudos'
      AND public = false
      AND file_size_limit = 10485760
      AND allowed_mime_types = ARRAY['application/pdf']::text[]
  ),
  1::bigint,
  'the laudos bucket is private and only accepts PDFs up to 10 MiB'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
      AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%auth.role%'
  ),
  0::bigint,
  'active RLS policies do not use deprecated auth.role() checks'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS setting
        WHERE setting LIKE 'search_path=%'
      )
  ),
  0::bigint,
  'every project-owned SECURITY DEFINER function fixes its search_path'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(
      COALESCE(p.proacl, acldefault('f', p.proowner))
    ) AS privilege
    WHERE n.nspname IN ('public', 'private')
      AND p.prosecdef
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'SECURITY DEFINER functions do not grant EXECUTE to PUBLIC'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.increment_ai_quota(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.increment_ai_quota(uuid)', 'EXECUTE'),
  'the quota RPC is authenticated-only'
);

SELECT * FROM finish();
ROLLBACK;
