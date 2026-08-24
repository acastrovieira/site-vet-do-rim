-- Sprint 3: contador distribuído por identidade autenticada e operação.
-- Não armazena IP, paciente, tutor, laudo, arquivo ou conteúdo clínico.
-- A política (escopo, janela e limite) fica no banco; o cliente não a escolhe.

CREATE TABLE private.clinical_rate_limit_windows (
  scope text NOT NULL,
  actor_user_id uuid NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  CONSTRAINT clinical_rate_limit_windows_pkey PRIMARY KEY (scope, actor_user_id)
);

ALTER TABLE private.clinical_rate_limit_windows ENABLE ROW LEVEL SECURITY;
CREATE INDEX clinical_rate_limit_windows_expiry_idx
  ON private.clinical_rate_limit_windows (window_started_at);

CREATE OR REPLACE FUNCTION public.consume_clinical_rate_limit(p_scope text)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private, auth
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
  v_limit integer;
  v_window_seconds integer;
  v_window_started_at timestamptz;
  v_request_count integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'unauthenticated';
  END IF;

  -- Estado efêmero: remove contadores ociosos antes de 5 minutos. Não há
  -- histórico de atividade, logs ou dados clínicos nesta tabela.
  DELETE FROM private.clinical_rate_limit_windows
  WHERE window_started_at < v_now - interval '5 minutes';

  CASE p_scope
    WHEN 'laudo_reserve' THEN v_limit := 10; v_window_seconds := 60;
    WHEN 'laudo_local_extraction' THEN v_limit := 20; v_window_seconds := 60;
    WHEN 'lab_export' THEN v_limit := 30; v_window_seconds := 60;
    ELSE RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_rate_limit_scope';
  END CASE;

  INSERT INTO private.clinical_rate_limit_windows AS rate_limit (
    scope, actor_user_id, window_started_at, request_count
  ) VALUES (p_scope, v_actor_user_id, v_now, 1)
  ON CONFLICT (scope, actor_user_id) DO UPDATE
  SET
    window_started_at = CASE
      WHEN rate_limit.window_started_at + make_interval(secs => v_window_seconds) <= v_now THEN v_now
      ELSE rate_limit.window_started_at
    END,
    request_count = CASE
      WHEN rate_limit.window_started_at + make_interval(secs => v_window_seconds) <= v_now THEN 1
      ELSE rate_limit.request_count + 1
    END
  RETURNING rate_limit.window_started_at, rate_limit.request_count
  INTO v_window_started_at, v_request_count;

  IF v_request_count <= v_limit THEN
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    false,
    GREATEST(1, CEIL(EXTRACT(EPOCH FROM (
      (v_window_started_at + make_interval(secs => v_window_seconds)) - v_now
    )))::integer);
END;
$$;

ALTER FUNCTION public.consume_clinical_rate_limit(text) OWNER TO postgres;

REVOKE ALL ON TABLE private.clinical_rate_limit_windows FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_clinical_rate_limit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_clinical_rate_limit(text) TO authenticated;
