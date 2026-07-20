-- ADR-001 Tenancy — Fase 2 (Backfill revisado, single-clinic).
-- Escrita do zero conforme docs/architecture/fase1-tenancy-implementation-spec.md
-- (secao 2.2). NAO deriva de nenhum draft (o draft omite backfill de proposito).
--
-- Autorizacao: decisao formal do owner (Dr. Anderson, 2026-07-18) — todo o acervo
-- legado pertence a UMA unica clinica "Vet do Rim". Backfill auditavel via
-- private.tenant_backfill_manifest (uma linha por registro atribuido).
--
-- Constantes deterministas do lote AUDIT-001 (documentadas para reprodutibilidade
-- e auditoria — permitem re-execucao idempotente e rollback por batch_id):
--   * clinica default "Vet do Rim": 00000000-0000-4000-8000-00000000c11c
--   * batch_id do lote:             00000000-0000-4000-8000-0000000ba7c1
--
-- Idempotente: cada passo usa ON CONFLICT DO NOTHING ou WHERE clinic_id IS NULL.
-- Replica LIMPO em banco vazio (supabase db reset --local): sem colaboradores,
-- sem auth.users e sem linhas legadas, os preflights nao disparam (checam
-- ambiguidade via EXISTS, que e falso em tabelas vazias) e nenhuma escrita ocorre
-- alem da propria clinica default. Fingerprint usa md5() built-in do catalogo
-- (NAO digest/pgcrypto — pgcrypto nao e garantido; md5 nao exige extensao).

BEGIN;

-- ---------------------------------------------------------------------------
-- (A) Preflights que ABORTAM em ambiguidade — antes de qualquer escrita.
--     Todos usam EXISTS: em banco vazio nao ha linhas, logo nao abortam.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  required_column record;
BEGIN
  -- (A.1) clinic_id/created_by uuid presentes nas 6 tabelas (padrao do enforce).
  FOR required_column IN
    SELECT *
    FROM (VALUES
      ('tutores', 'clinic_id'), ('tutores', 'created_by'),
      ('pets', 'clinic_id'), ('pets', 'created_by'),
      ('triagens', 'clinic_id'), ('triagens', 'created_by'),
      ('follow_ups', 'clinic_id'), ('follow_ups', 'created_by'),
      ('colaboradores', 'clinic_id'), ('colaboradores', 'created_by'),
      ('laudos_pdf', 'clinic_id'), ('laudos_pdf', 'created_by')
    ) AS required_columns(table_name, column_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns AS c
      WHERE c.table_schema = 'public'
        AND c.table_name = required_column.table_name
        AND c.column_name = required_column.column_name
        AND c.data_type = 'uuid'
    ) THEN
      RAISE EXCEPTION 'Backfill blocked: missing or incompatible column public.%.%',
        required_column.table_name,
        required_column.column_name;
    END IF;
  END LOOP;

  -- (A.2) FKs quebradas que impediriam atribuicao coerente de tenant.
  IF EXISTS (
    SELECT 1
    FROM public.pets AS p
    LEFT JOIN public.tutores AS t ON t.id = p.tutor_id
    WHERE t.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Backfill blocked: pet with tutor_id pointing to a missing tutor';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.triagens AS tr
    LEFT JOIN public.pets AS p ON p.id = tr.pet_id
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Backfill blocked: triagem with pet_id pointing to a missing pet';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.follow_ups AS f
    LEFT JOIN public.triagens AS tr ON tr.id = f.triagem_id
    WHERE tr.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Backfill blocked: follow_up with triagem_id pointing to a missing triagem';
  END IF;

  -- laudo sem dono/pet -> abortar (nao ha como derivar tenant).
  IF EXISTS (
    SELECT 1
    FROM public.laudos_pdf AS l
    LEFT JOIN public.pets AS p ON p.id = l.pet_id
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Backfill blocked: laudo with pet_id pointing to a missing pet';
  END IF;

  -- (A.3) Integridade do autor: laudos_pdf.vet_id nao nulo deve existir em
  --       profiles (vet_id REFERENCES public.profiles(id) no schema real).
  IF EXISTS (
    SELECT 1
    FROM public.laudos_pdf AS l
    WHERE l.vet_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles AS pr WHERE pr.id = l.vet_id
      )
  ) THEN
    RAISE EXCEPTION 'Backfill blocked: laudo vet_id points to a missing profile';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- (B) Clinica default (idempotente, UUID determinista AUDIT-001).
--     created_by = NULL: a clinica e de origem sistemica, sem criador humano.
-- ---------------------------------------------------------------------------
INSERT INTO public.clinics (id, nome, status, created_by, criado_em, atualizado_em)
VALUES ('00000000-0000-4000-8000-00000000c11c', 'Vet do Rim', 'active', NULL, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- (C) Atribuicao de clinic_id nas 6 tabelas — so onde ainda nulo (idempotente).
--     created_by das linhas legadas permanece NULL de proposito: e o marcador
--     "linha legada" que o preflight do enforce usa (created_by IS NULL exige
--     manifesto aprovado batendo). Preencher created_by mascararia a origem.
-- ---------------------------------------------------------------------------
UPDATE public.tutores
  SET clinic_id = '00000000-0000-4000-8000-00000000c11c'
  WHERE clinic_id IS NULL;
UPDATE public.pets
  SET clinic_id = '00000000-0000-4000-8000-00000000c11c'
  WHERE clinic_id IS NULL;
UPDATE public.triagens
  SET clinic_id = '00000000-0000-4000-8000-00000000c11c'
  WHERE clinic_id IS NULL;
UPDATE public.follow_ups
  SET clinic_id = '00000000-0000-4000-8000-00000000c11c'
  WHERE clinic_id IS NULL;
UPDATE public.colaboradores
  SET clinic_id = '00000000-0000-4000-8000-00000000c11c'
  WHERE clinic_id IS NULL;
UPDATE public.laudos_pdf
  SET clinic_id = '00000000-0000-4000-8000-00000000c11c'
  WHERE clinic_id IS NULL;

-- ---------------------------------------------------------------------------
-- (D) Memberships derivadas de colaboradores ativos (so onde ha auth.users).
--     nivel_acesso -> role: admin->clinic_admin, vet->vet, recepcao->recepcao.
--     O admin NAO e inventado: se nenhum colaborador mapear para clinic_admin,
--     a clinica fica 'active' sem admin (seguro na Fase 1 — o constraint trigger
--     de admin so existe no enforce). Provisionar o clinic_admin com o auth uid
--     real do responsavel e passo separado, pre-condicao do enforce (spec 1.3).
--     Um vet legado (laudos_pdf.vet_id) sem colaborador ativo vira lacuna que o
--     preflight do enforce (laudo vet_id has no membership) capturara — esperado.
--     Em banco vazio (CI) este INSERT nao insere nada: correto.
-- ---------------------------------------------------------------------------
INSERT INTO public.clinic_memberships (clinic_id, user_id, role, status, created_by)
SELECT
  '00000000-0000-4000-8000-00000000c11c',
  c.supabase_uid,
  CASE c.nivel_acesso
    WHEN 'admin' THEN 'clinic_admin'
    WHEN 'vet' THEN 'vet'
    WHEN 'recepcao' THEN 'recepcao'
  END,
  'active',
  NULL
FROM public.colaboradores AS c
WHERE c.supabase_uid IS NOT NULL
  AND c.ativo = true
  AND c.nivel_acesso IN ('admin', 'vet', 'recepcao')
ON CONFLICT (clinic_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- (E) Registro no manifesto — uma linha por registro atribuido em (C).
--     decision='approved' + target_clinic_id = clinica default (o CHECK do
--     manifesto exige target nao-nulo quando aprovado). row_fingerprint = md5
--     (built-in) de um subconjunto estavel de colunas identificadoras da linha.
--     O preflight do enforce compara manifest.target_clinic_id com e.clinic_id
--     para toda linha created_by IS NULL; como (C) e (E) usam o mesmo UUID, o
--     match e garantido. ON CONFLICT evita duplicar em re-execucao.
--     Em banco vazio nao ha linhas de negocio: 0 linhas de manifesto.
-- ---------------------------------------------------------------------------
INSERT INTO private.tenant_backfill_manifest
  (entity_table, entity_id, target_clinic_id, decision, source_evidence,
   row_fingerprint, batch_id, reviewer_id, reviewed_at)
SELECT
  'tutores', e.id, '00000000-0000-4000-8000-00000000c11c', 'approved',
  'Owner formal confirmation 2026-07-18: entire legacy acervo belongs to clinic Vet do Rim (AUDIT-001)',
  md5(
    e.id::text || '|' || e.nome || '|' || coalesce(e.cpf, '') || '|' || e.telefone
  ),
  '00000000-0000-4000-8000-0000000ba7c1', NULL, now()
FROM public.tutores AS e
WHERE e.clinic_id = '00000000-0000-4000-8000-00000000c11c'
ON CONFLICT (entity_table, entity_id) DO NOTHING;

INSERT INTO private.tenant_backfill_manifest
  (entity_table, entity_id, target_clinic_id, decision, source_evidence,
   row_fingerprint, batch_id, reviewer_id, reviewed_at)
SELECT
  'pets', e.id, '00000000-0000-4000-8000-00000000c11c', 'approved',
  'Owner formal confirmation 2026-07-18: entire legacy acervo belongs to clinic Vet do Rim (AUDIT-001)',
  md5(
    e.id::text || '|' || e.tutor_id::text || '|' || e.nome || '|' || e.especie
  ),
  '00000000-0000-4000-8000-0000000ba7c1', NULL, now()
FROM public.pets AS e
WHERE e.clinic_id = '00000000-0000-4000-8000-00000000c11c'
ON CONFLICT (entity_table, entity_id) DO NOTHING;

INSERT INTO private.tenant_backfill_manifest
  (entity_table, entity_id, target_clinic_id, decision, source_evidence,
   row_fingerprint, batch_id, reviewer_id, reviewed_at)
SELECT
  'triagens', e.id, '00000000-0000-4000-8000-00000000c11c', 'approved',
  'Owner formal confirmation 2026-07-18: entire legacy acervo belongs to clinic Vet do Rim (AUDIT-001)',
  md5(
    e.id::text || '|' || e.pet_id::text || '|' || coalesce(e.tutor_id::text, '')
    || '|' || e.status
  ),
  '00000000-0000-4000-8000-0000000ba7c1', NULL, now()
FROM public.triagens AS e
WHERE e.clinic_id = '00000000-0000-4000-8000-00000000c11c'
ON CONFLICT (entity_table, entity_id) DO NOTHING;

INSERT INTO private.tenant_backfill_manifest
  (entity_table, entity_id, target_clinic_id, decision, source_evidence,
   row_fingerprint, batch_id, reviewer_id, reviewed_at)
SELECT
  'follow_ups', e.id, '00000000-0000-4000-8000-00000000c11c', 'approved',
  'Owner formal confirmation 2026-07-18: entire legacy acervo belongs to clinic Vet do Rim (AUDIT-001)',
  md5(
    e.id::text || '|' || e.triagem_id::text || '|' || coalesce(e.canal, '')
    || '|' || e.criado_em::text
  ),
  '00000000-0000-4000-8000-0000000ba7c1', NULL, now()
FROM public.follow_ups AS e
WHERE e.clinic_id = '00000000-0000-4000-8000-00000000c11c'
ON CONFLICT (entity_table, entity_id) DO NOTHING;

INSERT INTO private.tenant_backfill_manifest
  (entity_table, entity_id, target_clinic_id, decision, source_evidence,
   row_fingerprint, batch_id, reviewer_id, reviewed_at)
SELECT
  'colaboradores', e.id, '00000000-0000-4000-8000-00000000c11c', 'approved',
  'Owner formal confirmation 2026-07-18: entire legacy acervo belongs to clinic Vet do Rim (AUDIT-001)',
  md5(
    e.id::text || '|' || coalesce(e.supabase_uid::text, '') || '|' || e.email
    || '|' || e.nivel_acesso
  ),
  '00000000-0000-4000-8000-0000000ba7c1', NULL, now()
FROM public.colaboradores AS e
WHERE e.clinic_id = '00000000-0000-4000-8000-00000000c11c'
ON CONFLICT (entity_table, entity_id) DO NOTHING;

INSERT INTO private.tenant_backfill_manifest
  (entity_table, entity_id, target_clinic_id, decision, source_evidence,
   row_fingerprint, batch_id, reviewer_id, reviewed_at)
SELECT
  'laudos_pdf', e.id, '00000000-0000-4000-8000-00000000c11c', 'approved',
  'Owner formal confirmation 2026-07-18: entire legacy acervo belongs to clinic Vet do Rim (AUDIT-001)',
  md5(
    e.id::text || '|' || e.pet_id::text || '|' || e.storage_path
    || '|' || coalesce(e.vet_id::text, '')
  ),
  '00000000-0000-4000-8000-0000000ba7c1', NULL, now()
FROM public.laudos_pdf AS e
WHERE e.clinic_id = '00000000-0000-4000-8000-00000000c11c'
ON CONFLICT (entity_table, entity_id) DO NOTHING;

COMMIT;
