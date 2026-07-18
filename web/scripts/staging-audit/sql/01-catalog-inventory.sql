-- Catalog-only evidence. No application row values are selected.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';

SELECT
  current_database() AS database_name,
  current_user AS database_role,
  current_setting('server_version') AS postgres_version,
  current_setting('transaction_read_only') AS transaction_read_only;

WITH expected(relation_name) AS (
  VALUES
    ('public.profiles'),
    ('public.tutores'),
    ('public.pets'),
    ('public.colaboradores'),
    ('public.laudos_pdf'),
    ('public.triagens'),
    ('public.follow_ups'),
    ('storage.buckets'),
    ('storage.objects')
)
SELECT
  relation_name,
  to_regclass(relation_name) IS NOT NULL AS present
FROM expected
ORDER BY relation_name;

SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname IN ('public', 'storage')
ORDER BY n.nspname, c.relname;

SELECT
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles', 'tutores', 'pets', 'colaboradores',
    'laudos_pdf', 'triagens', 'follow_ups',
    'clinics', 'clinic_memberships'
  )
ORDER BY table_name, ordinal_position;

SELECT
  version,
  name
FROM supabase_migrations.schema_migrations
ORDER BY version;

ROLLBACK;
