# Reconciliação do banco de produção com o repositório — 2026-11-04

**Story:** AUDIT-001 · **Executor:** @devops (Gage) com o responsável técnico no SQL Editor
**Ambiente:** Supabase de produção (projeto ligado ao domínio www.vetdorim.com.br)

## Por que foi necessário

O histórico `supabase_migrations.schema_migrations` de produção registrava só 8 das
29 migrations do repositório (até `20260625051920`). As demais foram aplicadas à mão
ao longo do tempo, algumas com adaptações (por exemplo, a clínica de produção não usa
o UUID que `20260718100100` criaria). Com o histórico assim, um `supabase db push`
tentaria reaplicar migrations antigas — inclusive `20260823000100`, cujas policies
globais foram substituídas por policies de membership, e `20260626010000`, que
recriaria a RPC de cota liberada para `authenticated`.

## Diagnóstico (somente leitura)

Presença em produção do objeto característico de cada migration fora do histórico:

| Migration | Presente | Observação |
|---|---|---|
| 20260626010000 | não | RPC `increment_ai_quota` legada; revogada por 20260830000000 (HIGH-03) e sem uso no app nem na Edge Function |
| 20260717114557 | não | índice `idx_colaboradores_supabase_uid` |
| 20260717114916 | não | privilégios padrão de tabelas novas abertos para `anon`/`authenticated` |
| 20260718100000 | parcial | `clinics`/`clinic_memberships` existiam, mas sem policies, sem FORCE RLS, com DML para `anon`/`authenticated`, sem triggers de `atualizado_em`, sem 4 índices e sem `private.tenant_backfill_manifest` |
| 20260823000100 | não | `current_user_is_vet_or_admin` — ausência correta: 20260823234842 remove a função |
| 20260825000100 | parcial | `private.purge_old_claim_events` existia (via 20260830000000), faltava o wrapper `public.purge_old_claim_events()` usado por `/api/cron/purge-claim-events` |
| Demais (15) | sim | — |

Achados relevantes para o app:

- Sem policy de SELECT em `clinic_memberships`, o usuário logado não lia o próprio
  vínculo: `resolveActiveClinic` retornava nulo e o lançamento manual de exames
  respondia 403 `CLINIC_REQUIRED`.
- `anon` tinha privilégios em 11 tabelas de `public` (no repositório, nenhuma).
  Nenhuma página pública acessa tabelas como anônimo: o navegador só lê `profiles`
  depois do login.

## SQL aplicado

Os dois blocos foram validados antes num banco local recriado do zero e depois
degradado para reproduzir o estado de produção (inclusive testes como veterinário
logado, outro usuário, anônimo e service_role). Ambos são idempotentes e
transacionais.

### Bloco A — função de expurgo, índice e privilégios padrão

```sql
begin;
grant usage on schema private to service_role;
create or replace function public.purge_old_claim_events()
returns integer language sql security invoker set search_path = ''
as $function$ select private.purge_old_claim_events(90); $function$;
alter function public.purge_old_claim_events() owner to postgres;
revoke all on function public.purge_old_claim_events() from public, anon, authenticated;
grant execute on function public.purge_old_claim_events() to service_role;
create index if not exists idx_colaboradores_supabase_uid on public.colaboradores (supabase_uid);
revoke truncate, references, trigger, maintain on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
commit;
```

### Bloco C — tenancy, acesso anônimo e histórico

Resumo (texto completo idêntico às definições de `20260718100000_tenancy_expand.sql`):

- `clinics`: colunas `created_by`, `criado_em`, `atualizado_em` (se ausentes) e FK
  `fk_clinics_created_by` NOT VALID.
- Triggers `trg_clinics_updated_at` e `trg_clinic_memberships_updated_at`.
- Índices `idx_clinics_status`, `idx_clinic_memberships_user_active`,
  `idx_clinic_memberships_clinic_active`, `idx_pets_clinic_tutor`.
- ENABLE + FORCE RLS e policies `clinics_select_active_member` e
  `clinic_memberships_select_self_or_admin`.
- Privilégios: `authenticated` só SELECT; `service_role` DML; nada para `anon`/PUBLIC.
- `revoke all on schema private from public, anon`; EXECUTE de
  `private.has_clinic_role` só para `authenticated`.
- `private.tenant_backfill_manifest` (vazia) e seu índice, sem privilégios.
- `revoke all privileges on all tables in schema public from anon`.
- Inserção das 21 versões ausentes em `supabase_migrations.schema_migrations`
  (`on conflict do nothing`), incluindo `20260626010000` **sem executá-la**.

## Verificação

- Histórico de produção: 29 versões, igual ao repositório.
- `safe_parse_date` com volatilidade `s` (STABLE) após `20261104000000`.
- Workflow `Supabase Keep-Alive` disparado manualmente: a leitura anônima de
  `profiles` passou a responder 401 / `42501`, confirmando o fechamento do papel `anon`.

## Consequências e pendências

- **Keep-alive:** o workflow usava a chave anônima para ler `profiles` e deixou de
  funcionar. Ele passa a chamar `/api/cron/keep-alive` e `/api/cron/purge-claim-events`
  no site com `CRON_SECRET`.
- **`CRON_SECRET` ausente na Vercel:** as rotas agendadas respondiam 503 desde antes desta
  reconciliação. É preciso criar o segredo (≥ 32 caracteres) na produção da Vercel e,
  com o mesmo valor, nos segredos do GitHub Actions; depois, um novo deploy.
- **Drift aceito:** `clinic_memberships` de produção tem uma coluna extra `created_at`,
  que não existe no repositório e não é usada pelo app.
- **Edge Function `parse-laudo`:** o código do repositório ainda precisa de
  `supabase functions deploy parse-laudo`.
