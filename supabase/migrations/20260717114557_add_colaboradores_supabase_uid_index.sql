-- Cover the FK used to resolve a collaborator by Supabase Auth user without
-- blocking normal reads/writes while the index is built on a populated table.
-- A duplicate name must fail loudly: IF NOT EXISTS could hide schema drift.
CREATE INDEX CONCURRENTLY idx_colaboradores_supabase_uid
  ON public.colaboradores (supabase_uid);
