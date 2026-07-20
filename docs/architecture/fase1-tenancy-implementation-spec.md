# Fase 1 (Tenancy) — Spec de implementação executável para o db-sage

- **Autor:** Architect (squad AIOX)
- **Data:** 2026-07-18
- **Baseia-se em:** `docs/architecture/ADR-001-tenancy-clinica-rls.md` (Aprovado pelo owner em 2026-07-18) e nos drafts quarentenados em `docs/architecture/drafts/tenancy/`
- **Executor:** db-sage (Opus) — implementa o SQL; o Architect NÃO cria/edita migrations
- **Escopo desta tarefa:** trabalho LOCAL apenas. Nenhuma aplicação remota. Remoto só depois de `npm run audit:staging` (read-only) + CI (job Database Contract) verdes, decisão do owner.

> Regra de ouro deste documento: nenhuma coluna é inventada. Todo nome de coluna abaixo foi conferido contra as migrations reais (`20260531000000`, `20260623000200`). Onde o draft e o schema divergem, a spec manda seguir o schema real.

---

## 0. Decisões do owner tratadas como fatos (Dr. Anderson, 2026-07-18)

1. **ADR-001 aprovado** com os defaults: tenant = clínica; tutor/paciente **não** compartilhado entre clínicas; recepção **sem** acesso clínico (fail-closed); admin **nunca** global.
2. **Todo o acervo legado pertence a UMA clínica: "Vet do Rim"** (confirmação formal do responsável). Backfill single-clinic autorizado, porém obrigatoriamente **auditável via manifesto** `private.tenant_backfill_manifest`.
3. **Aplicação remota** só após auditoria read-only + CI verde. Este lote é local.

---

## 1. Recomendação de granularidade e corte (LEIA PRIMEIRO)

### 1.1 Resumo executivo da recomendação

- **Vão para `supabase/migrations/` AGORA (este lote):** `expand` e `backfill`, em **migrations separadas**. São aditivas, reversíveis e **não cortam acesso**. Replicam limpo no CI (`supabase db reset --local` sobre banco vazio) e, quando aplicadas no remoto, correspondem a Fase 1 (expand) + Fase 2 (backfill) do ADR sem tornar o produto indisponível.
- **`enforce` NÃO entra em `supabase/migrations/` neste lote.** É o **ponto de não-retorno** (troca atômica de policies globais por policies de membership, NOT NULL, imutabilidade de tenant, storage por reserva). Deve ser **autorado e validado no projeto efêmero** (com os testes negativos e 4 usuários Auth reais), mas só é **promovido** para `supabase/migrations/` num PR/lote posterior, depois de três pré-condições cumpridas.

### 1.2 Por que `enforce` fica fora do lote agora — justificativa técnica

1. **Problema da clínica sem admin no replay do CI.** O `enforce` cria o constraint trigger `assert_active_clinic_has_admin` e um preflight que **aborta** se existir clínica `active` sem `clinic_admin` ativo. No replay do CI/efêmero o banco começa **vazio e sem `auth.users`**; o `backfill` cria a clínica default 'Vet do Rim', mas **não há usuário Auth** para virar `clinic_admin`. Logo, se `enforce` estivesse no lote de migrations, o `supabase db reset` do job **Database Contract falharia**. As memberships (inclusive o admin) só existem onde há `auth.users` reais — projeto efêmero com usuários semeados, ou remoto após provisionamento do admin.
2. **Acoplamento com o runtime (Fase 1.5).** O `enforce` exige o fluxo **reservar-laudo → path canônico → upload** (trigger `prepare_laudo_insert` gera `storage_path`, policy de INSERT exige `created_by = auth.uid()` e clínica ativa, storage exige registro reservado exato). O runtime atual faz o inverso (upload antes do registro, `vet_id`/`storage_path` no cliente, path `{auth.uid()}/...`) e cria tutor/pet **sem** `clinic_id`. Aplicar `enforce` antes do app adaptado **quebra** criação de tutor/pet/laudo e upload.
3. **Fail-closed e rollout gated.** `expand`+`backfill` são reversíveis por dado/lote; `enforce` é a virada irreversível de autorização. Mantê-los em commits separados permite o owner **travar `enforce` atrás da evidência Vet A × Vet B** e da versão de app compatível.

### 1.3 Pré-condições para promover `enforce` (lote futuro, fora desta tarefa)

- [ ] `expand`+`backfill` aplicados e auditados no remoto (audit read-only confirma `clinic_id` populado, zero relação cruzada, manifesto batendo).
- [ ] App **Fase 1.5** publicada (filtro `clinic_id`, resolução de clínica ativa, reserva-antes-de-upload) — ver seção 4.
- [ ] Membership `clinic_admin` **ativa** provisionada para a clínica 'Vet do Rim' com o `auth.users.id` real do responsável, e clínica `active` (o preflight passa).
- [ ] `90-negative-tests.sql` aprovado no efêmero com 4 usuários Auth reais.

### 1.4 Corte de granularidade final

| Ordem | Arquivo | Vai para `supabase/migrations/` neste lote? | Fase ADR |
|---|---|---|---|
| 1 | `20260718100000_tenancy_expand.sql` | **SIM** | Fase 1 (Expand) |
| 2 | `20260718100100_tenancy_backfill_default_clinic.sql` | **SIM** | Fase 2 (Backfill revisado) |
| 3 | `tenancy_enforce` (slot reservado `20260718100200_tenancy_enforce.sql`) | **NÃO** — autorar/validar no efêmero, promover depois | Fase 4 (Enforcement) |

> Mantenha `expand` e `backfill` em **migrations separadas** mesmo sendo aplicadas juntas: o rollback de backfill (por `batch_id`) não pode arrastar a criação das tabelas/colunas.

---

## 2. Migrations a criar

### Regras comuns a TODOS os arquivos

- Nomes casam o regex do manifesto: `^\d{14}_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$` (minúsculas, dígitos, `_`). Timestamps `202607181xxxxx`, todos **maiores** que a última migration ativa `20260717114916`.
- **Codificação:** UTF-8 **sem BOM**, quebras de linha LF. O verificador de integridade rejeita BOM.
- **Remover a sentinela de quarentena** (`DO $quarantine$ ... RAISE EXCEPTION`) ao derivar do draft — e SOMENTE nas cópias promovidas. Os arquivos de `docs/architecture/drafts/tenancy/` continuam bloqueados e não são tocados.
- Cada arquivo é uma transação (`BEGIN;`/`COMMIT;`), idempotente onde o draft já garante (`IF NOT EXISTS`, guardas em `pg_constraint`).
- Ao final, **atualizar `supabase/migration-integrity.json`** (seção 5).

### 2.1 `20260718100000_tenancy_expand.sql`

**Origem:** copiar de `drafts/tenancy/01-expand.sql`.

**Copiar como está (é o núcleo do expand):**
- Guard de versão PostgreSQL + `to_regclass` das 9 relações requeridas.
- `CREATE SCHEMA private` + REVOKE/GRANT USAGE (`authenticated`).
- Tabelas novas: `public.clinics`, `public.clinic_memberships`, `private.tenant_backfill_manifest` — com os `CHECK`, PKs e comentários do draft.
- Triggers `trg_clinics_updated_at` / `trg_clinic_memberships_updated_at` usando `public.handle_updated_at()` (confere: essa função existe em `20260531000000` e seta `atualizado_em`, coluna que ambas as tabelas novas possuem).
- Índices das tabelas novas.
- Helper `private.has_clinic_role(uuid, text[])` (`SECURITY DEFINER`, `search_path=''`, owner `postgres`, EXECUTE só para `authenticated`).
- `ENABLE`/`FORCE ROW LEVEL SECURITY` em `clinics` e `clinic_memberships`; policies de SELECT (`clinics_select_active_member`, `clinic_memberships_select_self_or_admin`); REVOKE + GRANT SELECT p/ `authenticated`; GRANT CRUD p/ `service_role` (necessário para fixtures/backfill).
- `ADD COLUMN IF NOT EXISTS clinic_id uuid` + `created_by uuid` (nullable) nas 6 tabelas: `tutores`, `pets`, `triagens`, `follow_ups`, `colaboradores`, `laudos_pdf`.
- Todos os índices `idx_*_clinic*` e `uq_*_clinic_id*`.
- Todas as FKs `NOT VALID` no bloco `DO $$ ... pg_constraint ... $$` (simples + compostas: `fk_pets_tutor_same_clinic`, `fk_triagens_pet_same_clinic`, `fk_triagens_pet_tutor_same_clinic`, `fk_follow_ups_triagem_same_clinic`, `fk_colaboradores_membership_same_clinic`, `fk_laudos_pdf_pet_same_clinic`, `fk_laudos_pdf_vet_membership`).

**MUDAR em relação ao draft:**
- **Remover a sentinela** `DO $quarantine$`.
- **Confirmar a extensão FK `ON DELETE SET NULL (coluna)`** (usada em `fk_colaboradores_membership_same_clinic` e `fk_laudos_pdf_vet_membership`). Requer PostgreSQL 17 (`supabase/config.toml` declara 17; o CI usa Supabase CLI 2.107.0). Manter, pois o ambiente é 17. Se o `supabase db reset` do CI falhar por sintaxe, é sinal de versão divergente — **não** contornar removendo a coluna da ação referencial; escalar ao Architect.
- **Não alterar** nenhuma policy legada das tabelas clínicas (expand não corta acesso) — o draft já respeita isso.

**Colunas conferidas (não inventar):** `tutores.criado_em`; `pets.tutor_id/criado_em`; `triagens.pet_id/tutor_id/criado_em`; `follow_ups.triagem_id/criado_em`; `colaboradores.supabase_uid/ativo/email(UNIQUE global)/criado_em`; `laudos_pdf.pet_id/vet_id/storage_path/status/created_at`. Índices do draft usam `criado_em` para as 5 primeiras e `created_at` para `laudos_pdf` — **correto** (laudos_pdf usa `created_at`/`updated_at`; as demais usam `criado_em`/`atualizado_em`).

### 2.2 `20260718100100_tenancy_backfill_default_clinic.sql`

**Origem:** **NÃO existe no draft** (o draft omite backfill de propósito). db-sage escreve do zero, seguindo este contrato. Autorizado pela decisão 2 do owner (acervo = clínica única 'Vet do Rim'), auditável via manifesto.

**Ordem interna obrigatória:**

**(A) Preflights que ABORTAM em ambiguidade (antes de qualquer escrita):**
- Abortar se as colunas `clinic_id`/`created_by` não existirem/incompatíveis nas 6 tabelas (reusar o padrão de `information_schema.columns` do `02-enforce`).
- Abortar se houver **FK quebrada** que impeça atribuição coerente de tenant:
  - `pets` com `tutor_id` sem tutor correspondente;
  - `triagens` com `pet_id` sem pet; `follow_ups` com `triagem_id` sem triagem;
  - `laudos_pdf` com `pet_id` sem pet **(laudo sem dono/pet → abortar)**.
- Abortar se algum `laudos_pdf.vet_id` **não nulo** apontar para um `profiles.id` inexistente (integridade do autor).
- Como este backfill é single-clinic, **não** há decisão por linha; a "evidência" é a confirmação formal do owner. Ainda assim, registrar tudo no manifesto (item D).

**(B) Criação da clínica default (idempotente, UUID determinístico para reprodutibilidade/auditoria):**
```
INSERT INTO public.clinics (id, nome, status, created_by, criado_em, atualizado_em)
VALUES ('00000000-0000-4000-8000-00000000c11c', 'Vet do Rim', 'active', NULL, now(), now())
ON CONFLICT (id) DO NOTHING;
```
- UUID fixo (escolher um UUIDv4 válido e documentá-lo no topo do arquivo como "clínica default Vet do Rim — lote AUDIT-001"). Determinismo é o que torna o backfill re-executável e auditável.
- `created_by = NULL` é aceitável (sistema); a clínica não tem "criador" humano.

**(C) Atribuição de `clinic_id` nas 6 tabelas (idempotente, só onde ainda nulo):**
```
UPDATE public.<tabela> SET clinic_id = '<UUID default>' WHERE clinic_id IS NULL;
```
para `tutores`, `pets`, `triagens`, `follow_ups`, `colaboradores`, `laudos_pdf`.
- **NÃO** preencher `created_by` das linhas legadas (permanece NULL): é o marcador "linha legada" que o preflight do `enforce` usa (`created_by IS NULL` exige manifesto aprovado batendo). Preencher `created_by` legado mascararia a origem.

**(D) Memberships derivadas de colaboradores ativos + o admin (só onde há `auth.users`):**
- Para cada `colaboradores` com `supabase_uid IS NOT NULL AND ativo = true`, criar membership na clínica default mapeando papel:
  - `nivel_acesso = 'admin'` → `role = 'clinic_admin'`
  - `nivel_acesso = 'vet'`  → `role = 'vet'`
  - `nivel_acesso = 'recepcao'` → `role = 'recepcao'`
  ```
  INSERT INTO public.clinic_memberships (clinic_id, user_id, role, status, created_by)
  SELECT '<UUID default>', c.supabase_uid, <map>, 'active', NULL
  FROM public.colaboradores c
  WHERE c.supabase_uid IS NOT NULL AND c.ativo = true
  ON CONFLICT (clinic_id, user_id) DO NOTHING;
  ```
- **Admin:** se nenhum colaborador mapear para `clinic_admin`, o backfill **não** inventa admin. A clínica fica `active` sem admin — o que é seguro na Fase 1 (o constraint trigger de admin só existe no `enforce`). O provisionamento explícito do `clinic_admin` (uid real do Dr. Anderson) é passo separado, pré-condição de `enforce` (§1.3). Documentar isso em comentário no arquivo.
- Também derivar `laudos_pdf.vet_id` legado → deve ter membership: já coberto se o vet for colaborador ativo. Vet sem colaborador ativo vira lacuna que o preflight do `enforce` (`laudo vet_id has no membership`) capturará — fail-closed, esperado.
- No CI (sem `colaboradores` e sem `auth.users`), este bloco simplesmente não insere nada. Correto.

**(E) Registro no manifesto `private.tenant_backfill_manifest` (auditoria):**
Para cada linha atribuída em (C), inserir uma linha de manifesto:
```
INSERT INTO private.tenant_backfill_manifest
  (entity_table, entity_id, target_clinic_id, decision, source_evidence, row_fingerprint, batch_id, reviewer_id, reviewed_at)
SELECT '<tabela>', e.id, '<UUID default>', 'approved',
       'Owner formal confirmation 2026-07-18: entire legacy acervo belongs to clinic Vet do Rim (AUDIT-001)',
       encode(digest(<colunas estáveis da linha>::text, 'sha256'), 'hex'),
       '<UUID de lote fixo>', NULL, now()
FROM public.<tabela> e
ON CONFLICT (entity_table, entity_id) DO NOTHING;
```
- `batch_id` = UUID fixo do lote (documentado no topo). `decision='approved'` com `target_clinic_id` = clínica default (o `CHECK` do manifesto exige target não-nulo quando aprovado).
- `row_fingerprint`: hash SHA-256 de um subconjunto **estável** de colunas identificadoras da linha (ex.: para `tutores`: `id||nome||coalesce(cpf,'')||telefone`). Precisa de `pgcrypto` para `digest()`; **confirmar** que a extensão está disponível — `20260531000000` cria só `uuid-ossp`. Se `pgcrypto` não estiver garantido, usar `md5(...)` do catálogo (built-in, sem extensão) como fingerprint, documentando a escolha. **Não** adicionar `CREATE EXTENSION` sem necessidade; preferir `md5` built-in.
- O preflight de `enforce` compara `manifest.target_clinic_id` com `e.clinic_id` para toda linha `created_by IS NULL`. Como (C) e (E) usam o mesmo UUID, o match é garantido.

**(F) Idempotência:** todo passo usa `ON CONFLICT ... DO NOTHING` ou `WHERE clinic_id IS NULL`. Re-execução não duplica manifesto nem memberships.

### 2.3 `tenancy_enforce` (slot `20260718100200_tenancy_enforce.sql`) — AUTORAR, NÃO COMMITAR EM `migrations/` AGORA

**Origem:** `drafts/tenancy/02-enforce.sql`, com a sentinela removida na cópia promovível.

**Onde vive até a promoção:** manter como arquivo revisado **fora** de `supabase/migrations/` (ex.: `docs/architecture/drafts/tenancy/promotion/02-enforce.candidate.sql`, sem sentinela, claramente marcado "promoção pendente — não é migration ativa"). Assim o CI **não** o replica e o manifesto não o inclui até as pré-condições de §1.3.

**Copiar como está:** todo o preflight fail-closed; `SET NOT NULL`; `VALIDATE CONSTRAINT` de todas as FKs; troca de unicidade de email (`colaboradores_email_key` → `uq_colaboradores_clinic_email_ci`); `uq_laudos_pdf_storage_path`; triggers `enforce_tenant_row`, `prepare_laudo_insert`, `enforce_laudo_immutable_fields`, `assert_active_clinic_has_admin`; drop+recriação de TODAS as policies das 9 tabelas por allowlist de membership; policies de storage por registro exato; grants explícitos mínimos + `ALTER DEFAULT PRIVILEGES`.

**MUDAR / VERIFICAR na promoção (lote futuro):**
- Remover a sentinela.
- **Reconciliar a allowlist de nomes de policies de storage** (`02-enforce.sql:233-249`) com o inventário REAL do remoto (`pg_policies` em `storage.objects`). O preflight aborta se existir policy não revisada — isso é proposital; db-sage deve rodar o inventário read-only antes.
- Confirmar que `colaboradores_email_key` é o nome real do constraint UNIQUE de email (criado por `email text NOT NULL UNIQUE` em `20260531000000` → o nome default é `colaboradores_email_key`). O `DROP CONSTRAINT IF EXISTS` cobre divergência, mas registrar no inventário.
- Confirmar colunas dos grants coluna-a-coluna contra o schema real (ex.: `tutores`: `nome, telefone, email, cpf, cep, endereco, cidade, estado, lgpd_aceito_em, lgpd_ip` — o grant de INSERT do draft inclui `lgpd_ip` e `lgpd_aceito_em`; OK). Não expandir grants além do draft.

---

## 3. Explicitamente FORA da Fase 1 (vai para Fase 2 / enforcement)

1. **Reserva server-side de storage + caminho canônico imutável.** As policies `storage_laudos_insert_exact_record` / `storage_laudos_select_exact_record` e o trigger `prepare_laudo_insert` (que gera `clinics/{clinic_id}/laudos/{id}/original.pdf`) vivem no `enforce`, não neste lote.
2. **Migração/cutover dos objetos legados de Storage** para o caminho canônico (cópia + verificação de checksum + retenção do original) — Fase 2/contract do ADR §7.2. Não tocar objetos físicos agora.
3. **Quota/claim transacional do parse-laudo** (claim atômico + idempotente do trabalho de IA vinculado ao tenant) — Fase 2. O RPC de quota atual (`20260626010000`) permanece.
4. **API administrativa de memberships** (INSERT/UPDATE/DELETE auditados, anti-autoelevação, anti-remoção do último admin) — necessária antes de `enforce`, mas é trabalho de aplicação, não desta spec de DB.

### 3.1 Corte de segurança do Storage — as policies atuais por `auth.uid()` prefix PODEM permanecer na Fase 1

**Decisão: SIM, mantê-las intactas neste lote.** Justificativa de segurança:

- A policy de Storage atual (introduzida no `auth_rls_hardening`, ADR §7.1/linha 219-251) isola por **primeira pasta = `auth.uid()`**: é estritamente **mais restritiva** que "bucket inteiro" e **nunca concede leitura entre usuários**. O pior caso dela é *sub*-permissão (bloqueia colaboração legítima da clínica), não vazamento cross-tenant.
- Substituí-la agora pela policy de reserva exigiria o **path canônico gerado no servidor**, que só existe após a Fase 1.5 + `enforce`. Trocar antes disso obrigaria a reabrir para `bucket_id='laudos'` global (menos seguro) ou quebraria os uploads.
- Portanto o `expand`+`backfill` **não tocam `storage.objects`**. A virada para storage-por-reserva é atômica dentro do `enforce`, gated. Isso preserva o princípio fail-closed: em nenhum momento o bucket fica mais aberto do que hoje.

---

## 4. Contrato para a aplicação (Fase 1.5) — mudanças mínimas, sem escrever código

Objetivo: preparar o app para **escrever `clinic_id` e resolver clínica ativa** enquanto as policies globais ainda vigoram (compatível com `expand`+`backfill`), de modo que, quando `enforce` entrar, nada quebre. Nesta fase a RLS ainda é global; o app passa a mandar `clinic_id` como defesa em profundidade e para preparar o cutover.

| Arquivo | Mudança mínima | Assinatura / contrato |
|---|---|---|
| `web/src/lib/server-authorization.ts` | Adicionar resolução de **clínica ativa via membership** (não confiar em `profiles.role` como fronteira). Nova função que, dado o client + userId, retorna a(s) membership(s) ativas. | `resolveActiveClinic(supabase, opts?: { preferredClinicId?: string }): Promise<{ ok: true; clinicId: string; role: 'clinic_admin'\|'vet'\|'recepcao' } \| { ok: false; code: 'NO_MEMBERSHIP'\|'AMBIGUOUS'\|'UNAVAILABLE'; status: 403\|409\|503 }>`. Fonte: `clinic_memberships` (status='active'). Múltiplas memberships sem preferência → `AMBIGUOUS` (409, exige seletor). |
| `web/src/proxy.ts` | Deixar de decidir `/lab` e `/admin` só por `profiles.role`; passar a exigir **pelo menos uma membership ativa** para rotas do Lab. `role` permanece como navegação/compat durante a transição. | Após `getUser()`, para rotas com `requiredRoles`, consultar existência de membership ativa; sem membership → redirect fail-closed para `roleHome`/login. Nenhuma decisão de dados aqui (RLS é a barreira). |
| `web/src/app/lab/layout.tsx` | Trocar o gate `role !== 'vet' && role !== 'admin'` por gate de **membership ativa**; carregar a clínica ativa para o `LabShell`. | `LabLayout` resolve `resolveActiveClinic`; sem membership → `redirect(roleHome(role))`. Passar `clinicId` ativo ao contexto do shell. |
| `web/src/app/api/tutores/route.ts` (POST) | Resolver clínica ativa no servidor e **injetar `clinic_id` + `created_by`** no insert. Ignorar qualquer `clinic_id`/`created_by` vindo do body. | Após `authorizeServerRoles`, chamar `resolveActiveClinic`; `insert({ ...campos, clinic_id, created_by: userId })`. `clinic_id` nunca vem do cliente. |
| `web/src/app/api/pets/route.ts` (POST) | Idem tutores; além disso **validar que o `tutor_id` pertence à mesma clínica ativa** antes do insert (defesa em profundidade além da FK composta). | `insert({ ...campos, clinic_id, created_by: userId })`; pré-checar `tutores` filtrando `clinic_id` = clínica ativa; tutor de outra clínica → 404. |
| `web/src/app/api/tutores/[id]/route.ts` e `web/src/app/api/pets/[id]/route.ts` (PATCH/PUT/DELETE) | **Filtrar explicitamente `clinic_id`** = clínica ativa em todo update/select por id; **404 para UUID de outro tenant** (não confirmar existência). Nunca aceitar `clinic_id`/`created_by`/`vet_id` do body. | `update(...).eq('id', id).eq('clinic_id', activeClinicId)`; resultado vazio → `404`. |
| `web/src/components/lab/LaudoUploader.tsx` | **Preparar** a migração para reservar-antes-de-upload: parar de definir `storage_path`/`vet_id` no cliente e de subir o PDF antes do registro. (Adaptação completa é pré-condição de `enforce`.) | Novo fluxo: chamar uma rota/RPC de reserva que devolve `laudoId` + path canônico; só então `upload`. Nesta fase pode ser feature-flagged. |
| `supabase/functions/parse-laudo/index.ts` | Sem mudança obrigatória na Fase 1; documentar que o claim atômico por tenant + `laudoId` vinculado à clínica é Fase 2. | (Fase 2) validar tenant/membership com JWT do usuário antes do cliente privilegiado. |

> Nenhuma dessas mudanças de app entra nas migrations. São itens do db-sage apenas na medida em que definem o **contrato** que o `enforce` assume; a implementação de app é de outro executor do squad.

---

## 5. Gates de aceite locais

### 5.1 Manifesto de integridade (`check:migrations`)

Para cada novo `.sql` adicionado a `supabase/migrations/` (neste lote: `expand` e `backfill`), db-sage deve:
1. Calcular SHA-256 dos **bytes crus** do arquivo (sem BOM, LF).
2. **Inserir** o par `{ "file": "...", "sha256": "..." }` no array `migrations` de `supabase/migration-integrity.json`, **mantendo a ordenação estrita por nome de arquivo** (o validador exige `file` estritamente crescente).
3. **Não** adicionar entradas em `approvedHistoricalTransitions` — são arquivos **novos**, não alterações de migrations históricas. Transições só existem para reescrever um arquivo já publicado.
4. Rodar `npm run check:migrations` (em `web/`) → deve passar (`Migration integrity PASS`). No CI, o job "Verify append-only migration integrity" roda com `MIGRATION_BASE_REF` e valida append-only (versões novas > `20260717114916`; nada removido/alterado).

### 5.2 Database Contract (CI) — o que roda

O job `database-contract` (`.github/workflows/ci.yml`) faz, com Supabase CLI 2.107.0:
- `supabase db start` + `supabase db reset --local --no-seed` → **replay fresco de todas as migrations ativas**, incluindo `expand`+`backfill` sobre banco vazio. Deve concluir sem erro (por isso `enforce` fica fora — ver §1.2).
- `supabase migration list --local`.
- `supabase test db --local` → **pgTAP**. Adicionar testes pgTAP **estruturais** em `supabase/tests/` que rodem sem usuários Auth: existência de `clinics`/`clinic_memberships`/`tenant_backfill_manifest`, colunas `clinic_id`/`created_by` nas 6 tabelas, FKs `NOT VALID` presentes, helper `has_clinic_role` com owner/`secdef`/`search_path` corretos, RLS habilitada nas tabelas novas. **NÃO** colocar aqui os testes que exigem 4 usuários Auth.
- `supabase db lint --schema public,private --level warning --fail-on warning`.
- `supabase db advisors --type security --fail-on warn` e `--type performance --fail-on warn`.

### 5.3 Testes negativos que EXIGEM usuários Auth reais (fora do CI)

`docs/architecture/drafts/tenancy/90-negative-tests.sql` prova Vet A × Vet B, mas:
- exige `current_user = postgres`, `SET test.allow_tenancy_destructive_fixture='yes'` e **4 UUIDs de `auth.users` reais** (`test.vet_a/admin_a/vet_b/admin_b`);
- termina em `ROLLBACK`;
- só faz sentido **depois** de `expand`+`backfill`+`enforce` aplicados no **projeto efêmero descartável**.
- **Não roda no CI** (o `supabase test db` não semeia usuários Auth). É um **gate de promoção do `enforce`**, executado manualmente no efêmero pelo db-sage/owner.

### 5.4 App

- `npm run typecheck`, `npm run lint`, `npm test` (em `web/`) verdes.
- Após cada migration aprovada no efêmero, **regenerar `web/src/types/database.ts`** a partir do schema real (o ADR §6.4 proíbe tipos manuais rotulados "gerados"); o diff deve conter `clinic_id`, FKs e as tabelas novas.

---

## 6. Riscos, pontos de não-retorno e rollback por migration

### 6.1 Pontos de não-retorno

- **`enforce` é o único ponto de não-retorno** (NOT NULL, imutabilidade de tenant, troca de policies, unicidade de email por clínica, storage por reserva). Por isso está fora deste lote e gated (§1.3). `expand` e `backfill` **não** cortam acesso e são reversíveis.
- A troca `colaboradores_email_key` (unicidade global) → `uq_colaboradores_clinic_email_ci` (unicidade por clínica) acontece **só no `enforce`**; não fazer antes.

### 6.2 Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Replay do CI falhar se `enforce` fosse incluído (clínica sem admin) | `enforce` fora do lote; §1.2. |
| `pgcrypto` ausente para `digest()` no fingerprint do manifesto | Usar `md5()` built-in; não adicionar extensão. |
| Extensão FK `ON DELETE SET NULL (coluna)` exigir PG17 | Ambiente é PG17; se `db reset` falhar, escalar — não remover a coluna da ação referencial. |
| Laudo legado com `vet_id` de usuário sem membership | Preflight do `enforce` bloqueia (fail-closed); resolver provisionando membership ou nulificando via workflow antes de promover. |
| Backfill atribuir tenant errado | Single-clinic por decisão formal do owner + manifesto por linha (fingerprint/lote/evidência) → auditável e reversível por `batch_id`. |
| App enviar `clinic_id`/`created_by` pelo body | Contrato §4: servidor ignora e injeta do contexto autenticado. |

### 6.3 Rollback por migration (SEMPRE fail-closed — nunca restaurar policy global)

- **`expand`** — Rollback: como não há corte de acesso, o rollback é **desabilitar o uso** (feature flag / não referenciar as colunas). Objetos novos ficam ociosos. **Não** dropar colunas/tabelas com dado já escrito por engano. Se for imperativo reverter estrutura em ambiente sem dados (efêmero), um script inverso pode `DROP` as tabelas/colunas/índices/FKs criados — **nunca** aplicar isso onde houve backfill.
- **`backfill`** — Rollback **por lote/manifesto**: `UPDATE ... SET clinic_id = NULL WHERE clinic_id = '<default>'` **somente** para linhas cujo `entity_id` está no `batch_id` do lote e `created_by IS NULL`; remover as memberships criadas pelo lote; remover as linhas de manifesto do `batch_id`. **Nunca apagar linhas de negócio nem objetos de Storage.** Reverter valores, não dados.
- **`enforce`** (quando existir) — Rollback seguro do ADR §8/Fase 4: manter o schema expandido e ir para **read-only/fail-closed**, voltando a uma versão de app que também entende tenant. **Proibido** `USING (true)`/`WITH CHECK (true)` ou admin global para recuperar disponibilidade. O `90-negative-tests.sql` (assert "no policy reduces to global true") existe justamente para travar essa regressão.

---

## 7. Checklist de entrega do db-sage (este lote)

- [ ] Criar `supabase/migrations/20260718100000_tenancy_expand.sql` (derivado de `01-expand.sql`, sem sentinela).
- [ ] Criar `supabase/migrations/20260718100100_tenancy_backfill_default_clinic.sql` (novo, contrato §2.2).
- [ ] Autorar `tenancy_enforce` como candidato de promoção **fora** de `supabase/migrations/` (sem sentinela), pronto para o efêmero — **não** commitar em `migrations/`.
- [ ] Atualizar `supabase/migration-integrity.json` com os 2 novos SHA-256 (ordenados; sem transições históricas).
- [ ] Adicionar pgTAP estrutural em `supabase/tests/` (sem usuários Auth) para o expand.
- [ ] `npm run check:migrations` verde; `supabase db reset --local` verde localmente; advisors sem findings críticos/altos.
- [ ] Regenerar `web/src/types/database.ts` do schema efêmero após aplicar expand+backfill.
