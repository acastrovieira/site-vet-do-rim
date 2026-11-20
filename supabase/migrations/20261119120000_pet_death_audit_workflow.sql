-- =============================================================================
-- Iteracao C: Workflow Transacional Auditavel de Obito de Paciente (public.pets)
--
-- Substitui o bloqueio sem destino anterior por um workflow atomico:
--   1. public.pet_death_events (tabela append-only com FORCE RLS, trigger
--      bloqueando UPDATE/DELETE e FK composta (clinic_id, pet_id)).
--   2. private.record_pet_death(...) + wrapper public.record_pet_death(...)
--      exclusivos de service_role (chamados por POST /api/pets/[id]/obito):
--      * trava pessimista (FOR UPDATE) no pet dentro da clinica;
--      * valida papel clinico ativo (vet/clinic_admin) em clinic_memberships;
--      * valida data_obito civil (1990-01-01..hoje America/Sao_Paulo) e motivo;
--      * atualiza status_paciente = 'obito' e data_obito em public.pets;
--      * encerra triagens abertas ('encerrada_obito') do paciente na clinica;
--      * marca opt_out = true em follow_ups pendentes dessas triagens;
--      * grava registro imutavel em public.pet_death_events na mesma transacao.
-- =============================================================================

BEGIN;

DO $preflight$
BEGIN
  IF pg_catalog.to_regclass('public.clinics') IS NULL THEN
    RAISE EXCEPTION 'missing prerequisite: public.clinics';
  END IF;
  IF pg_catalog.to_regclass('public.clinic_memberships') IS NULL THEN
    RAISE EXCEPTION 'missing prerequisite: public.clinic_memberships';
  END IF;
  IF pg_catalog.to_regclass('public.pets') IS NULL THEN
    RAISE EXCEPTION 'missing prerequisite: public.pets';
  END IF;
  IF pg_catalog.to_regclass('public.triagens') IS NULL THEN
    RAISE EXCEPTION 'missing prerequisite: public.triagens';
  END IF;
  IF pg_catalog.to_regclass('public.follow_ups') IS NULL THEN
    RAISE EXCEPTION 'missing prerequisite: public.follow_ups';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname = 'has_clinic_role'
  ) THEN
    RAISE EXCEPTION 'missing prerequisite: private.has_clinic_role';
  END IF;
END
$preflight$;

CREATE TABLE IF NOT EXISTS public.pet_death_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  pet_id uuid NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  previous_status text NOT NULL,
  data_obito date NOT NULL,
  motivo text NOT NULL CHECK (char_length(btrim(motivo)) BETWEEN 3 AND 200),
  observacoes text CHECK (observacoes IS NULL OR char_length(btrim(observacoes)) <= 1000),
  triagens_encerradas integer NOT NULL DEFAULT 0 CHECK (triagens_encerradas >= 0),
  follow_ups_cancelados integer NOT NULL DEFAULT 0 CHECK (follow_ups_cancelados >= 0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_pet_death_events_pet_same_clinic
    FOREIGN KEY (clinic_id, pet_id)
    REFERENCES public.pets(clinic_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pet_death_events_clinic_pet
  ON public.pet_death_events(clinic_id, pet_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_pet_death_events_clinic_recorded
  ON public.pet_death_events(clinic_id, recorded_at DESC);

ALTER TABLE public.pet_death_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_death_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pet_death_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.pet_death_events TO authenticated;
GRANT SELECT, INSERT ON TABLE public.pet_death_events TO service_role;

DROP POLICY IF EXISTS "pet_death_events_select_active_member" ON public.pet_death_events;
CREATE POLICY "pet_death_events_select_active_member"
  ON public.pet_death_events
  FOR SELECT
  TO authenticated
  USING (private.has_clinic_role(clinic_id, ARRAY['clinic_admin', 'vet', 'recepcao']));

CREATE OR REPLACE FUNCTION private.prevent_pet_death_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'pet_death_events_append_only';
END;
$function$;

ALTER FUNCTION private.prevent_pet_death_event_mutation() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.prevent_pet_death_event_mutation() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_pet_death_events_append_only ON public.pet_death_events;
CREATE TRIGGER trg_pet_death_events_append_only
  BEFORE UPDATE OR DELETE ON public.pet_death_events
  FOR EACH ROW EXECUTE FUNCTION private.prevent_pet_death_event_mutation();

CREATE OR REPLACE FUNCTION private.record_pet_death(
  p_clinic_id uuid,
  p_actor_user_id uuid,
  p_pet_id uuid,
  p_data_obito date,
  p_motivo text,
  p_observacoes text DEFAULT NULL
)
RETURNS TABLE (
  event_id uuid,
  pet_id uuid,
  clinic_id uuid,
  previous_status text,
  data_obito date,
  triagens_encerradas integer,
  follow_ups_cancelados integer,
  recorded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_today_br date := (pg_catalog.timezone('America/Sao_Paulo', v_now))::date;
  v_motivo text := NULLIF(pg_catalog.btrim(p_motivo), '');
  v_observacoes text := NULLIF(pg_catalog.btrim(p_observacoes), '');
  v_pet record;
  v_triagens_encerradas integer := 0;
  v_follow_ups_cancelados integer := 0;
  v_event_id uuid;
BEGIN
  IF p_clinic_id IS NULL OR p_actor_user_id IS NULL OR p_pet_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_request';
  END IF;

  IF p_data_obito IS NULL OR p_data_obito < DATE '1990-01-01' OR p_data_obito > v_today_br THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_death_date';
  END IF;

  IF v_motivo IS NULL OR pg_catalog.char_length(v_motivo) < 3 OR pg_catalog.char_length(v_motivo) > 200 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_death_reason';
  END IF;

  IF v_observacoes IS NOT NULL AND pg_catalog.char_length(v_observacoes) > 1000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_death_notes';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clinic_memberships AS m
    JOIN public.clinics AS c ON c.id = m.clinic_id
    WHERE m.clinic_id = p_clinic_id
      AND m.user_id = p_actor_user_id
      AND m.status = 'active'
      AND m.role IN ('vet', 'clinic_admin')
      AND c.status = 'active'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'actor_not_authorized';
  END IF;

  SELECT p.id, p.status_paciente
  INTO v_pet
  FROM public.pets AS p
  WHERE p.id = p_pet_id
    AND p.clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'pet_not_found';
  END IF;

  IF v_pet.status_paciente = 'obito' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'pet_already_deceased';
  END IF;

  UPDATE public.pets AS p
  SET
    status_paciente = 'obito',
    data_obito = p_data_obito,
    atualizado_em = v_now
  WHERE p.id = p_pet_id
    AND p.clinic_id = p_clinic_id;

  UPDATE public.triagens AS t
  SET
    status = 'encerrada_obito',
    atualizado_em = v_now
  WHERE t.pet_id = p_pet_id
    AND t.clinic_id = p_clinic_id
    AND t.status NOT IN ('encerrada', 'encerrada_obito', 'cancelada');

  GET DIAGNOSTICS v_triagens_encerradas = ROW_COUNT;

  UPDATE public.follow_ups AS f
  SET
    opt_out = true,
    atualizado_em = v_now
  FROM public.triagens AS t
  WHERE f.triagem_id = t.id
    AND t.pet_id = p_pet_id
    AND t.clinic_id = p_clinic_id
    AND f.clinic_id = p_clinic_id
    AND f.sent_at IS NULL
    AND f.opt_out = false;

  GET DIAGNOSTICS v_follow_ups_cancelados = ROW_COUNT;

  INSERT INTO public.pet_death_events (
    clinic_id,
    pet_id,
    actor_user_id,
    previous_status,
    data_obito,
    motivo,
    observacoes,
    triagens_encerradas,
    follow_ups_cancelados,
    recorded_at
  )
  VALUES (
    p_clinic_id,
    p_pet_id,
    p_actor_user_id,
    v_pet.status_paciente,
    p_data_obito,
    v_motivo,
    v_observacoes,
    v_triagens_encerradas,
    v_follow_ups_cancelados,
    v_now
  )
  RETURNING public.pet_death_events.id
  INTO v_event_id;

  RETURN QUERY
  SELECT
    v_event_id,
    p_pet_id,
    p_clinic_id,
    v_pet.status_paciente,
    p_data_obito,
    v_triagens_encerradas,
    v_follow_ups_cancelados,
    v_now;
END;
$function$;

ALTER FUNCTION private.record_pet_death(uuid, uuid, uuid, date, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.record_pet_death(uuid, uuid, uuid, date, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.record_pet_death(uuid, uuid, uuid, date, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.record_pet_death(
  p_clinic_id uuid,
  p_actor_user_id uuid,
  p_pet_id uuid,
  p_data_obito date,
  p_motivo text,
  p_observacoes text DEFAULT NULL
)
RETURNS TABLE (
  event_id uuid,
  pet_id uuid,
  clinic_id uuid,
  previous_status text,
  data_obito date,
  triagens_encerradas integer,
  follow_ups_cancelados integer,
  recorded_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT *
  FROM private.record_pet_death(
    p_clinic_id,
    p_actor_user_id,
    p_pet_id,
    p_data_obito,
    p_motivo,
    p_observacoes
  );
$function$;

ALTER FUNCTION public.record_pet_death(uuid, uuid, uuid, date, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.record_pet_death(uuid, uuid, uuid, date, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_pet_death(uuid, uuid, uuid, date, text, text)
  TO service_role;

COMMENT ON FUNCTION public.record_pet_death(uuid, uuid, uuid, date, text, text) IS
  'Iteracao C: workflow transacional auditavel de obito de paciente. Somente service_role via API Next.js.';

COMMIT;
