-- AUDIT-001 Fase 2 (Tarefa 2.5) — Reserva server-side de upload de laudo +
-- compensacao deterministica de Storage (P1-3).
--
-- Fecha um GAP CRITICO descoberto na Tarefa 2.2: private.claim_laudo_ia
-- (migration 20260718110000) exige storage_path CANONICO no formato
-- clinics/{clinic_id}/laudos/{laudo_id}/original.pdf, mas ate esta migration
-- o browser gravava {user_id}/{timestamp}_{nome} via insert direto em
-- laudos_pdf, e a unica policy de Storage ativa (owner_upload_laudos,
-- migration 20260623000100) so autoriza upload no prefixo auth.uid(). Sem
-- esta migration, 100% dos claims falhavam com path_mismatch.
--
-- Fonte de verdade do contrato: docs/architecture/drafts/laudos-ia/
-- claim-finalize-contract.md, secao 8 ("Contrato de Storage"):
--   * um RPC server-side autorizado cria laudos_pdf.id, atribui clinic_id,
--     liga o pet do mesmo tenant e grava o path canonico;
--   * o browser recebe apenas o path ja reservado e faz upload(upsert:false);
--   * policies de Storage exigem que storage.objects.name corresponda a uma
--     reserva laudos_pdf acessivel por membership;
--   * o cliente privilegiado usa a API de Storage; NAO altera storage.objects
--     por SQL direto.
--
-- DECISAO registrada (Tarefa 2.5, item 1b): abandon_laudo_upload NAO apaga
-- linhas de storage.objects via SQL. Embora tecnicamente possivel dentro de
-- uma funcao SECURITY DEFINER de propriedade de postgres, um DELETE direto em
-- storage.objects so remove a linha de metadado -- o objeto binario
-- permanece orfao no backend de armazenamento (S3/local), que nao e
-- alcancavel por SQL e nao e monitorado por nenhuma trilha. Isso contradiz
-- explicitamente o contrato de Storage acima ("nao altera storage.objects por
-- SQL") e o requisito desta tarefa ("nunca deixar objeto orfao SEM TRILHA").
-- A funcao portanto so MARCA o laudo como 'abandonado' (com trilha auditavel:
-- abandoned_at + abandoned_by) e devolve bucket/path; a remocao do objeto
-- (quando existir) e feita pela API server-side (Next.js) usando a API de
-- Storage do Supabase com um cliente service_role, exatamente como o
-- contrato exige para o "cliente privilegiado".
--
-- Replica LIMPO em banco vazio (supabase db reset --local --no-seed): so cria
-- schema/objetos; nenhuma linha de negocio e exigida.

BEGIN;

-- ---------------------------------------------------------------------------
-- Preflight: falha cedo se apontada para um schema sem os pre-requisitos.
-- Todos os checks sao de catalogo (nao de dados), logo passam em banco vazio.
-- ---------------------------------------------------------------------------
DO $preflight$
BEGIN
  IF pg_catalog.to_regclass('public.clinics') IS NULL THEN
    RAISE EXCEPTION 'missing prerequisite: public.clinics (ADR-001 tenancy expand)';
  END IF;

  IF pg_catalog.to_regclass('public.clinic_memberships') IS NULL THEN
    RAISE EXCEPTION 'missing prerequisite: public.clinic_memberships (ADR-001 tenancy expand)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'pets'
      AND c.column_name = 'clinic_id'
      AND c.data_type = 'uuid'
  ) THEN
    RAISE EXCEPTION 'missing prerequisite: public.pets.clinic_id uuid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'laudos_pdf'
      AND c.column_name = 'clinic_id'
      AND c.data_type = 'uuid'
  ) THEN
    RAISE EXCEPTION 'missing prerequisite: public.laudos_pdf.clinic_id uuid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname = 'has_clinic_role'
  ) THEN
    RAISE EXCEPTION 'missing prerequisite: private.has_clinic_role (ADR-001 tenancy expand)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'laudos'
  ) THEN
    RAISE EXCEPTION 'missing prerequisite: storage bucket "laudos"';
  END IF;
END
$preflight$;

-- ---------------------------------------------------------------------------
-- Trilha de compensacao. Colunas aditivas e NULLABLE (nao quebram linhas
-- legadas). abandoned_by referencia auth.users, no mesmo padrao de
-- laudos_pdf.created_by (ADR-001 tenancy expand); a coluna e nova e vazia,
-- entao a FK entra ja VALIDATED (nao ha linha legada para violar).
-- ---------------------------------------------------------------------------
ALTER TABLE public.laudos_pdf
  ADD COLUMN IF NOT EXISTS abandoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS abandoned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.laudos_pdf.abandoned_at IS
  'AUDIT-001 Fase 2 (Tarefa 2.5): timestamp da desistencia deterministica de uma reserva de upload via private.abandon_laudo_upload. NULL enquanto o laudo nunca foi abandonado.';
COMMENT ON COLUMN public.laudos_pdf.abandoned_by IS
  'AUDIT-001 Fase 2 (Tarefa 2.5): ator (auth.uid()) que confirmou a desistencia. Gravado apenas por private.abandon_laudo_upload, nunca pelo cliente.';

-- O estado 'abandonado' e novo. Reservas abandonadas nunca podem ser
-- reclamadas por claim_laudo_ia: o check existente
-- `status NOT IN ('pendente', 'erro')` (migration 20260718110000, preservada
-- sem alteracao) ja trata qualquer outro valor, incluindo 'abandonado', como
-- "already_processing" — fail-closed por construcao, sem exigir mudanca na
-- migration do claim.
ALTER TABLE public.laudos_pdf
  DROP CONSTRAINT IF EXISTS laudos_pdf_status_check;

ALTER TABLE public.laudos_pdf
  ADD CONSTRAINT laudos_pdf_status_check
  CHECK (status IN ('pendente', 'processando', 'concluido', 'erro', 'abandonado'));

-- ---------------------------------------------------------------------------
-- reserve_laudo_upload. Chamada diretamente pelo browser autenticado (via API
-- Next.js server-side, que revalida papel de app antes de chamar o RPC).
-- auth.uid() e a UNICA fonte do ator; o pet informa o tenant (clinic_id), a
-- clinica NUNCA vem do cliente. Idempotencia simples: cada chamada cria uma
-- reserva NOVA (sem idempotency key) — o limite defensivo abaixo evita o
-- acumulo de reservas orfas nunca consumidas por upload.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.reserve_laudo_upload(p_pet_id uuid)
RETURNS TABLE (
  laudo_id uuid,
  storage_bucket text,
  storage_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_pet record;
  v_new_id uuid;
  v_storage_path text;
  v_open_orphans integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthenticated';
  END IF;

  IF p_pet_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_request';
  END IF;

  SELECT p.id, p.clinic_id
  INTO v_pet
  FROM public.pets AS p
  WHERE p.id = p_pet_id;

  -- Pet inexistente e pet de outro tenant respondem com a MESMA mensagem
  -- generica (ADR-001 §6.2): a ausencia de acesso nunca confirma a existencia
  -- do registro para quem nao tem membership na clinica dona do pet.
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'pet_not_found';
  END IF;

  IF v_pet.clinic_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'tenant_not_ready';
  END IF;

  IF NOT private.has_clinic_role(v_pet.clinic_id, ARRAY['vet', 'clinic_admin']::text[]) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'pet_not_found';
  END IF;

  -- Anti-abuso: no maximo 5 reservas 'pendente' ORFAS (sem objeto de Storage
  -- correspondente em storage.objects) criadas nas ultimas 24h para este pet.
  -- Uma reserva com objeto ja enviado nao conta aqui (o upload a torna um
  -- laudo real, nao uma reserva ociosa). O limite protege contra flood de
  -- reservas nunca consumidas; nao e um controle de seguranca rigido, entao
  -- nenhum lock adicional e tomado sobre esta contagem.
  SELECT count(*)
  INTO v_open_orphans
  FROM public.laudos_pdf AS l
  WHERE l.pet_id = p_pet_id
    AND l.status = 'pendente'
    AND l.created_at > v_now - interval '24 hours'
    AND NOT EXISTS (
      SELECT 1
      FROM storage.objects AS o
      WHERE o.bucket_id = 'laudos'
        AND o.name = l.storage_path
    );

  IF v_open_orphans >= 5 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'reservation_limit_exceeded';
  END IF;

  v_new_id := pg_catalog.gen_random_uuid();

  -- Path CANONICO — deve ser byte-a-byte identico ao formato validado por
  -- private.claim_laudo_ia (migration 20260718110000):
  --   pg_catalog.format('clinics/%s/laudos/%s/original.pdf', clinic_id, laudo_id)
  v_storage_path := pg_catalog.format(
    'clinics/%s/laudos/%s/original.pdf',
    v_pet.clinic_id,
    v_new_id
  );

  -- nome_arquivo permanece NOT NULL no schema legado (20260531000000). No
  -- momento da reserva o nome real do arquivo ainda nao existe no servidor
  -- (o upload acontece DEPOIS, diretamente do browser para o Storage) —
  -- gravamos o mesmo nome fixo do path canonico como placeholder auditavel.
  -- Preservar o nome original de exibicao fica fora do escopo desta tarefa
  -- (P1-3 fecha o gap de path canonico; nao introduz um novo parametro na
  -- assinatura do RPC, que e p_pet_id uuid unico, por contrato).
  INSERT INTO public.laudos_pdf (
    id, pet_id, vet_id, clinic_id, created_by,
    storage_path, nome_arquivo, tipo_exame, status
  )
  VALUES (
    v_new_id, p_pet_id, v_actor, v_pet.clinic_id, v_actor,
    v_storage_path, 'original.pdf', 'hemograma', 'pendente'
  );

  RETURN QUERY
  SELECT v_new_id, 'laudos'::text, v_storage_path;
END;
$function$;

ALTER FUNCTION private.reserve_laudo_upload(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- abandon_laudo_upload. Compensacao deterministica de uma reserva 'pendente'
-- que o upload nunca concluiu (ou que o usuario decidiu descartar). So marca
-- o estado + trilha; a remocao do objeto de Storage (se existir) e feita pela
-- API server-side com um cliente service_role, NUNCA aqui (ver decisao acima).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.abandon_laudo_upload(p_laudo_id uuid)
RETURNS TABLE (
  disposition text,
  storage_bucket text,
  storage_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_laudo record;
  v_now timestamptz := pg_catalog.clock_timestamp();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthenticated';
  END IF;

  IF p_laudo_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_request';
  END IF;

  SELECT l.id, l.status, l.clinic_id, l.created_by, l.vet_id, l.storage_path
  INTO v_laudo
  FROM public.laudos_pdf AS l
  WHERE l.id = p_laudo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'laudo_not_found';
  END IF;

  IF v_laudo.clinic_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'tenant_not_ready';
  END IF;

  -- Somente quem criou/reservou (created_by ou vet_id — a mesma pessoa nesta
  -- reserva) ou um clinic_admin da MESMA clinica podem abandonar. Um vet
  -- comum de outro colaborador na mesma clinica nao pode desistir de uma
  -- reserva alheia. Cross-tenant e ausencia de acesso respondem da mesma
  -- forma generica ('laudo_not_found'), sem confirmar a existencia do
  -- registro (ADR-001 §6.2).
  IF NOT (
    v_laudo.created_by = v_actor
    OR v_laudo.vet_id = v_actor
    OR private.has_clinic_role(v_laudo.clinic_id, ARRAY['clinic_admin']::text[])
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'laudo_not_found';
  END IF;

  -- Idempotente: repetir o abandon da mesma reserva ja abandonada devolve o
  -- mesmo path para a API tentar a limpeza de Storage novamente, sem
  -- reescrever a trilha (abandoned_at/abandoned_by preservam o primeiro
  -- evento).
  IF v_laudo.status = 'abandonado' THEN
    RETURN QUERY
    SELECT 'already_abandoned'::text, 'laudos'::text, v_laudo.storage_path;
    RETURN;
  END IF;

  IF v_laudo.status <> 'pendente' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid_laudo_state';
  END IF;

  UPDATE public.laudos_pdf AS l
  SET
    status = 'abandonado',
    abandoned_at = v_now,
    abandoned_by = v_actor
  WHERE l.id = p_laudo_id;

  RETURN QUERY
  SELECT 'abandoned'::text, 'laudos'::text, v_laudo.storage_path;
END;
$function$;

ALTER FUNCTION private.abandon_laudo_upload(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- Wrappers estreitos da Data API. SECURITY INVOKER; a autoridade fica na
-- implementacao private (que roda auth.uid() como SECURITY DEFINER). Ao
-- contrario de claim/finalize/refund (somente service_role), estes DOIS RPCs
-- sao chamados pelo PROPRIO browser autenticado (via API Next.js
-- server-side), entao o grant de EXECUTE vai para authenticated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_laudo_upload(p_pet_id uuid)
RETURNS TABLE (
  laudo_id uuid,
  storage_bucket text,
  storage_path text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT * FROM private.reserve_laudo_upload(p_pet_id);
$function$;

ALTER FUNCTION public.reserve_laudo_upload(uuid) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.abandon_laudo_upload(p_laudo_id uuid)
RETURNS TABLE (
  disposition text,
  storage_bucket text,
  storage_path text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT * FROM private.abandon_laudo_upload(p_laudo_id);
$function$;

ALTER FUNCTION public.abandon_laudo_upload(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- Privilegios minimos. Contrato: chamador e o browser autenticado (via API
-- server-side) — nunca service_role (nao ha claim/finalize/refund aqui) nem
-- anon/PUBLIC.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION private.reserve_laudo_upload(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.abandon_laudo_upload(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reserve_laudo_upload(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.abandon_laudo_upload(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.reserve_laudo_upload(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_laudo_upload(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.abandon_laudo_upload(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.abandon_laudo_upload(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Helper de autorizacao para as policies de Storage abaixo. Precisa ser
-- SECURITY DEFINER (mesmo padrao de private.has_clinic_role) para NAO sofrer
-- dupla aplicacao de RLS: se a policy de storage.objects apenas fizesse um
-- EXISTS direto contra public.laudos_pdf, a subconsulta ficaria presa pela
-- RLS de laudos_pdf (vet_id = auth.uid() OR admin), que nao conhece
-- membership de clinica e bloquearia silenciosamente o caso "membro" do
-- contrato (item 1c: "SELECT correspondente para o dono/membros").
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.can_access_reserved_laudo_object(
  p_object_name text,
  p_allowed_roles text[],
  p_require_pending boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.laudos_pdf AS l
    WHERE l.storage_path = p_object_name
      AND l.clinic_id IS NOT NULL
      AND (NOT p_require_pending OR l.status = 'pendente')
      AND (
        l.created_by = (SELECT auth.uid())
        OR l.vet_id = (SELECT auth.uid())
        OR private.has_clinic_role(l.clinic_id, p_allowed_roles)
      )
  );
$function$;

ALTER FUNCTION private.can_access_reserved_laudo_object(text, text[], boolean) OWNER TO postgres;

REVOKE ALL ON FUNCTION private.can_access_reserved_laudo_object(text, text[], boolean)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_reserved_laudo_object(text, text[], boolean)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Policies de Storage ADITIVAS. As policies legadas (owner_upload_laudos,
-- owner_read_laudos — migration 20260623000100) NAO sao removidas nem
-- alteradas: continuam permitindo o prefixo auth.uid() para qualquer objeto
-- futuro fora deste fluxo de reserva. Upsert continua proibido (nenhuma
-- policy de UPDATE e criada para storage.objects nesta migration nem nas
-- anteriores).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "reserved_upload_laudos" ON storage.objects;
CREATE POLICY "reserved_upload_laudos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'laudos'
    AND private.can_access_reserved_laudo_object(
      name,
      ARRAY['vet', 'clinic_admin']::text[],
      true
    )
  );

DROP POLICY IF EXISTS "reserved_read_laudos" ON storage.objects;
CREATE POLICY "reserved_read_laudos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'laudos'
    AND private.can_access_reserved_laudo_object(
      name,
      ARRAY['vet', 'clinic_admin']::text[],
      false
    )
  );

COMMIT;
