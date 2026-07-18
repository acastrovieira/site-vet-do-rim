-- Data API roles only need explicit DML grants. RLS does not govern TRUNCATE,
-- and browser-facing roles must never create triggers or foreign keys.
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

-- Keep future project-owned objects fail-closed under PostgreSQL 17.
-- Migrations run as postgres. Supabase-managed defaults owned by
-- supabase_admin are intentionally left to the platform because postgres is
-- not allowed to change them. Functional access remains an explicit
-- per-object decision in the migration that defines the RLS or RPC contract.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL
  ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL
  ON SEQUENCES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE
  ON FUNCTIONS FROM PUBLIC, anon, authenticated;
