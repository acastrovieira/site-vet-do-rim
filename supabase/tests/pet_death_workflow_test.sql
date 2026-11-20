BEGIN;
SELECT plan(9);

SELECT ok(
  pg_catalog.to_regclass('public.pet_death_events') IS NOT NULL,
  'public.pet_death_events exists'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'pet_death_events'
      AND c.relrowsecurity
      AND c.relforcerowsecurity
  ),
  1::bigint,
  'pet_death_events enables and forces RLS'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.pet_death_events', 'SELECT')
    AND has_table_privilege('authenticated', 'public.pet_death_events', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'public.pet_death_events', 'INSERT')
    AND NOT has_table_privilege('authenticated', 'public.pet_death_events', 'UPDATE')
    AND NOT has_table_privilege('authenticated', 'public.pet_death_events', 'DELETE'),
  'authenticated has SELECT-only privilege on pet_death_events and anon has none'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_constraint
    WHERE conrelid = 'public.pet_death_events'::regclass
      AND conname = 'fk_pet_death_events_pet_same_clinic'
      AND contype = 'f'
      AND convalidated
  ),
  1::bigint,
  'pet_death_events enforces validated same-clinic FK to pets'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_trigger
    WHERE tgrelid = 'public.pet_death_events'::regclass
      AND tgname = 'trg_pet_death_events_append_only'
      AND NOT tgisinternal
  ),
  1::bigint,
  'pet_death_events keeps an append-only BEFORE UPDATE/DELETE trigger'
);

SELECT ok(
  NOT has_function_privilege(
    'PUBLIC',
    'private.record_pet_death(uuid, uuid, uuid, date, text, text)',
    'EXECUTE'
  )
    AND NOT has_function_privilege(
      'authenticated',
      'private.record_pet_death(uuid, uuid, uuid, date, text, text)',
      'EXECUTE'
    )
    AND has_function_privilege(
      'service_role',
      'private.record_pet_death(uuid, uuid, uuid, date, text, text)',
      'EXECUTE'
    ),
  'private.record_pet_death is restricted to service_role'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.record_pet_death(uuid, uuid, uuid, date, text, text)',
    'EXECUTE'
  )
    AND NOT has_function_privilege(
      'anon',
      'public.record_pet_death(uuid, uuid, uuid, date, text, text)',
      'EXECUTE'
    )
    AND has_function_privilege(
      'service_role',
      'public.record_pet_death(uuid, uuid, uuid, date, text, text)',
      'EXECUTE'
    ),
  'public.record_pet_death wrapper is service_role-only'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname = 'record_pet_death'
      AND p.prosecdef
      AND pg_get_userbyid(p.proowner) = 'postgres'
      AND coalesce(array_to_string(p.proconfig, ','), '') IN (
        'search_path=',
        'search_path=""',
        'search_path='''''
      )
  ),
  1::bigint,
  'private.record_pet_death is a postgres-owned SECURITY DEFINER function with empty search_path'
);

SELECT is(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pet_death_events'
      AND policyname = 'pet_death_events_select_active_member'
      AND cmd = 'SELECT'
      AND lower(coalesce(qual, '')) LIKE '%has_clinic_role%'
  ),
  1::bigint,
  'pet_death_events exposes a membership-scoped SELECT policy'
);

SELECT * FROM finish();
ROLLBACK;
