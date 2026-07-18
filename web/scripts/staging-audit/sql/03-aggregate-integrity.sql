-- Aggregate-only evidence. Do not add identifying columns to this file.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';

SELECT
  role,
  count(*) AS profile_count,
  count(*) FILTER (
    WHERE created_at < timestamptz '2026-06-23 00:01:00+00'
  ) AS created_before_auth_hardening
FROM public.profiles
GROUP BY role
ORDER BY role;

SELECT
  count(*) FILTER (
    WHERE p.role IN ('vet', 'admin')
  ) AS privileged_profile_count,
  count(*) FILTER (
    WHERE p.role IN ('vet', 'admin')
      AND u.created_at < timestamptz '2026-06-23 00:01:00+00'
  ) AS privileged_users_before_hardening,
  count(*) FILTER (
    WHERE p.role IN ('vet', 'admin')
      AND u.raw_user_meta_data ? 'role'
  ) AS privileged_users_with_user_metadata_role
FROM public.profiles AS p
JOIN auth.users AS u ON u.id = p.id;

SELECT
  count(*) FILTER (
    WHERE COALESCE(ai_quota_used, 0) < 0
  ) AS negative_quota_count,
  count(*) FILTER (
    WHERE COALESCE(ai_quota_used, 0) > COALESCE(ai_quota_limit, 5)
  ) AS quota_over_limit_count,
  count(*) FILTER (
    WHERE ai_quota_reset_date IS NOT NULL
      AND ai_quota_reset_date <= now()
      AND COALESCE(ai_quota_used, 0) > 0
  ) AS expired_cycle_with_usage_count
FROM public.profiles;

SELECT
  status,
  count(*) AS laudo_count,
  count(*) FILTER (
    WHERE status = 'concluido' AND resultado_ia IS NULL
  ) AS completed_without_result_count,
  count(*) FILTER (
    WHERE status <> 'concluido' AND resultado_ia IS NOT NULL
  ) AS noncompleted_with_result_count,
  count(*) FILTER (
    WHERE status = 'erro' AND erro_ia IS NULL
  ) AS failed_without_controlled_code_count
FROM public.laudos_pdf
GROUP BY status
ORDER BY status;

SELECT
  count(*) FILTER (
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tutores AS t WHERE t.id = p.tutor_id
    )
  ) AS pets_without_tutor_count
FROM public.pets AS p;

SELECT
  count(*) FILTER (
    WHERE tr.tutor_id IS NOT NULL AND tr.tutor_id <> p.tutor_id
  ) AS triage_pet_tutor_mismatch_count
FROM public.triagens AS tr
JOIN public.pets AS p ON p.id = tr.pet_id;

SELECT
  count(*) FILTER (
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pets AS p WHERE p.id = l.pet_id
    )
  ) AS laudos_without_pet_count,
  count(*) FILTER (
    WHERE l.vet_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles AS p WHERE p.id = l.vet_id
      )
  ) AS laudos_without_profile_count,
  count(*) - count(DISTINCT storage_path) AS duplicate_storage_path_count
FROM public.laudos_pdf AS l;

SELECT
  count(*) FILTER (
    WHERE NOT EXISTS (
      SELECT 1
      FROM storage.objects AS o
      WHERE o.bucket_id = 'laudos' AND o.name = l.storage_path
    )
  ) AS laudo_rows_without_storage_object_count
FROM public.laudos_pdf AS l;

SELECT
  count(*) FILTER (
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.laudos_pdf AS l
      WHERE l.storage_path = o.name
    )
  ) AS storage_objects_without_laudo_row_count
FROM storage.objects AS o
WHERE o.bucket_id = 'laudos';

ROLLBACK;
