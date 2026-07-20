-- Role-escalation & orphan-record audit (Fase 0 / Tarefa 0.3, P0-5).
-- Before the 2026-06-23 auth/RLS hardening, handle_new_user() trusted
-- raw_user_meta_data to assign the initial profile role, so a profile with
-- role 'vet'/'admin' created before that cutoff may be a self-escalation
-- rather than a legitimate staff account. This file also checks for
-- laudos/storage and pets/triagens/follow_ups records left dangling by
-- incomplete writes or manual data surgery.
--
-- Unlike 01-04, this file intentionally selects identifying columns
-- (auth.users.email, profile/laudo/object ids) because a human reviewer
-- must be able to recognize which specific accounts and files need
-- remediation. Treat the console output as PII: do not paste it into
-- shared channels, tickets, or commit it to the repository.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';

-- (a) Profile counts by role, with creation-date range and how many
-- predate the auth/RLS hardening cutoff.
SELECT
  role,
  count(*) AS profile_count,
  min(created_at) AS first_created_at,
  max(created_at) AS last_created_at,
  count(*) FILTER (
    WHERE created_at < timestamptz '2026-06-23 00:01:00+00'
  ) AS created_before_auth_hardening
FROM public.profiles
GROUP BY role
ORDER BY role;

-- (b) Every vet/admin profile with its auth.users email and any role
-- metadata the pre-hardening trigger could have consumed. A profile
-- created before the hardening cutoff whose auth metadata requests an
-- elevated role is the strongest signal of a privilege-escalation account.
SELECT
  p.id AS profile_id,
  p.role,
  p.created_at AS profile_created_at,
  u.email,
  u.created_at AS auth_user_created_at,
  u.created_at < timestamptz '2026-06-23 00:01:00+00' AS created_before_auth_hardening,
  u.raw_user_meta_data->>'role' AS metadata_role,
  u.raw_user_meta_data->>'requested_role' AS metadata_requested_role
FROM public.profiles AS p
JOIN auth.users AS u ON u.id = p.id
WHERE p.role IN ('vet', 'admin')
ORDER BY p.created_at;

-- (c) vet/admin profiles with no matching active colaboradores row.
-- A privileged profile nobody registered as staff is unexplained and
-- should be reviewed before treating it as legitimate.
SELECT
  p.id AS profile_id,
  p.role,
  p.created_at AS profile_created_at,
  u.email
FROM public.profiles AS p
JOIN auth.users AS u ON u.id = p.id
WHERE p.role IN ('vet', 'admin')
  AND NOT EXISTS (
    SELECT 1
    FROM public.colaboradores AS c
    WHERE c.supabase_uid = p.id
      AND c.ativo = true
  )
ORDER BY p.created_at;

-- (d.1) laudos_pdf rows whose storage_path has no matching object in the
-- private "laudos" bucket (file missing, moved, or never uploaded).
SELECT
  l.id AS laudo_id,
  l.pet_id,
  l.vet_id,
  l.status,
  l.storage_path,
  l.created_at
FROM public.laudos_pdf AS l
WHERE NOT EXISTS (
  SELECT 1
  FROM storage.objects AS o
  WHERE o.bucket_id = 'laudos'
    AND o.name = l.storage_path
)
ORDER BY l.created_at;

-- (d.2) objects in the "laudos" bucket with no corresponding laudos_pdf
-- row (file uploaded but its DB row was never created, or was deleted
-- without removing the object).
SELECT
  o.id AS storage_object_id,
  o.name AS storage_path,
  o.created_at
FROM storage.objects AS o
WHERE o.bucket_id = 'laudos'
  AND NOT EXISTS (
    SELECT 1
    FROM public.laudos_pdf AS l
    WHERE l.storage_path = o.name
  )
ORDER BY o.created_at;

-- (e.1) pets with no matching tutor row. tutor_id is NOT NULL with
-- ON DELETE CASCADE, so a hit here would mean the FK itself is broken or
-- the row was written outside the normal application path.
SELECT
  p.id AS pet_id,
  p.tutor_id,
  p.nome,
  p.status_paciente,
  p.criado_em
FROM public.pets AS p
WHERE NOT EXISTS (
  SELECT 1 FROM public.tutores AS t WHERE t.id = p.tutor_id
)
ORDER BY p.criado_em;

-- (e.2) triagens whose tutor_id disagrees with the pet's current
-- tutor_id. triagens.tutor_id is a point-in-time reference (ON DELETE SET
-- NULL), so a mismatch usually means the pet was reassigned to a
-- different tutor after the triagem was recorded.
SELECT
  tr.id AS triagem_id,
  tr.pet_id,
  tr.tutor_id AS triagem_tutor_id,
  p.tutor_id AS pet_current_tutor_id,
  tr.status,
  tr.criado_em
FROM public.triagens AS tr
JOIN public.pets AS p ON p.id = tr.pet_id
WHERE tr.tutor_id IS NOT NULL
  AND tr.tutor_id <> p.tutor_id
ORDER BY tr.criado_em;

-- (e.3) triagens pointing at a pet_id that no longer exists. pet_id is
-- NOT NULL with ON DELETE CASCADE, so a hit here would mean the FK itself
-- is broken.
SELECT
  tr.id AS triagem_id,
  tr.pet_id,
  tr.tutor_id,
  tr.status,
  tr.criado_em
FROM public.triagens AS tr
WHERE NOT EXISTS (
  SELECT 1 FROM public.pets AS p WHERE p.id = tr.pet_id
)
ORDER BY tr.criado_em;

-- (e.4) follow_ups pointing at a triagem_id that no longer exists.
-- triagem_id is NOT NULL with ON DELETE CASCADE, so a hit here would mean
-- the FK itself is broken.
SELECT
  f.id AS follow_up_id,
  f.triagem_id,
  f.canal,
  f.scheduled_at,
  f.sent_at,
  f.criado_em
FROM public.follow_ups AS f
WHERE NOT EXISTS (
  SELECT 1 FROM public.triagens AS tr WHERE tr.id = f.triagem_id
)
ORDER BY f.criado_em;

ROLLBACK;
