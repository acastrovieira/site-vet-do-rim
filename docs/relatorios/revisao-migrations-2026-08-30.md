# Revisão das 6 migrations pendentes — 2026-08-30

Revisão linha a linha das migrations que estavam no diretório mas fora de
`supabase/migration-integrity.json`, feita antes de atestá-las no manifesto.

**Resultado do manifesto:** as 6 foram incluídas (27 arquivos, `check:migrations` PASS).
O manifesto atesta **integridade de bytes**, não correção semântica — os defeitos
abaixo continuam abertos e são corrigidos por migrations NOVAS (o histórico é
append-only; nenhuma das seis deve ser editada).

## Veredito

| Migration | Veredito | Bloqueia deploy limpo? |
|---|---|---|
| `20260825000000_fix_service_insert_profile_policy` | Aprovada | Não |
| `20260825000100_fix_claim_events_ttl` | Aprovada com ressalva | Não |
| `20260825000200_fix_missing_clinic_memberships` | Ressalva grave | **Sim** |
| `20260825000300_fix_stuck_processing_laudos` | Ressalva grave | Não |
| `20260828000000_remediation_001_recreate_has_clinic_role` | Aprovada | Não |
| `20260829000000_remediation_002_missing_tenant_columns` | Ressalva crítica | **Sim** |

---

## M-01 (CRÍTICO) — Colunas de tenant recriadas sem integridade referencial

`remediation_002` adiciona `clinic_id` e `created_by` a `tutores`, `pets`,
`triagens`, `follow_ups`, `colaboradores` e `laudos_pdf` como `uuid` solto.

A migration original `20260718100000_tenancy_expand.sql` adicionava as mesmas
colunas **com constraints**, entre elas:

```sql
ALTER TABLE public.pets
  ADD CONSTRAINT fk_pets_tutor_same_clinic
  FOREIGN KEY (clinic_id, tutor_id)
  REFERENCES public.tutores(clinic_id, id) ON DELETE CASCADE NOT VALID;
```

Essa FK composta é a trava que garante, no banco, que **um pet e seu tutor
pertencem à mesma clínica**. Em produção a `tenancy_expand` não aplicou as
colunas, e a `remediation_002` as recriou sem nenhuma constraint. Consequência:
o isolamento multi-tenant hoje depende **apenas** das policies RLS e do código
da aplicação — não há trava no schema. Um `clinic_id` inexistente ou cruzado
entre clínicas é gravável.

Também faltam: `fk_tutores_clinic`, `fk_tutores_created_by`, `fk_pets_clinic`,
`fk_pets_created_by` e as equivalentes das demais tabelas.

**Correção:** migration nova que adiciona as constraints ausentes como
`NOT VALID` e depois `VALIDATE CONSTRAINT` (não bloqueia escrita), precedida de
uma query que confirme que não há linha órfã ou cruzada.

---

## M-02 (BLOQUEANTE) — UUID de produção hardcoded impede ambiente limpo

`fix_missing_clinic_memberships` e `remediation_002` exigem, em preflight, a
clínica `00000000-0000-0000-0000-000000000001` e abortam se ela não existir.

Mas a migration versionada que cria a clínica padrão
(`20260718100100_tenancy_backfill_default_clinic.sql`) usa outro UUID:
`00000000-0000-4000-8000-00000000c11c`.

Num ambiente limpo as migrations rodam em ordem, a clínica nasce com `...c11c`,
o preflight não a encontra e **o `supabase db push` falha**. Essas duas
migrations só funcionam naquele banco de produção específico — foram escritas
para o SQL Editor, não para o pipeline versionado.

**Correção:** migration nova que resolve a clínica padrão dinamicamente
(por `status = 'active'` + nome, ou por uma tabela de configuração), em vez de
comparar UUID literal. Enquanto não houver, staging e local não sobem do zero.

---

## M-03 (GRAVE) — `fix_stuck_processing_laudos` contorna o contrato de compensação

O script decrementa `profiles.ai_quota_used` e muda `laudo_ia_claims.state`
com `UPDATE` direto. A AUDIT-001 estabeleceu que toda compensação passa por
`refund_laudo_ia` — o próprio `parse-laudo/index.ts` comenta que a compensação
"nunca" deve ser feita por update direto de status.

Dois efeitos colaterais concretos:

1. **Não é determinística.** Os `UPDATE` dependem de `now()` no instante da
   execução. Reaplicar a migration em outro momento age sobre um conjunto
   diferente de claims — comportamento proibido para um arquivo versionado.
2. **Insere eventos de auditoria falsos.** O passo 5 insere `'refunded'` para
   *todo* claim `terminal_error` + `worker_crashed` sem evento prévio, não
   apenas os que o próprio script corrigiu. Claims que terminaram em erro por
   outro caminho passam a ter um "refunded" que nunca ocorreu.

**Correção:** transformar em rotina operacional (job chamando `refund_laudo_ia`),
não migration. O que já foi aplicado em produção não é revertido; o registro
fica aqui.

---

## M-04 (MÉDIO) — `purge_old_claim_events` nasce sem chamador e barra o cron

`fix_claim_events_ttl` cria a função de TTL, mas:

- não há nenhuma referência a `purge_old_claim_events` em `web/src` — nenhuma
  rota de cron a chama, ao contrário de `/api/cron/cleanup-storage`;
- a função exige `request.jwt.claim.role = 'service_role'`. Chamada por `pg_cron`
  não há JWT, `auth.jwt()` é nulo, e ela lança `service_role_required`. Ou seja,
  o caminho de cron nativo do Postgres **não funciona** — só via HTTP com JWT de
  service role.

A tabela continua crescendo sem purge. O defeito é de completude, não de segurança.

**Correção:** rota `/api/cron/purge-claim-events` no padrão da `cleanup-storage`,
protegida por `CRON_SECRET`.

---

## Aprovadas sem ressalva

**`fix_service_insert_profile_policy`** — corrige uma policy real e perigosa:
`CREATE POLICY "service_insert_profile" ... FOR INSERT WITH CHECK (true)` sem
cláusula `TO`, o que a aplicava também a `authenticated`. Verificado que
`public.profiles` tem apenas `ENABLE ROW LEVEL SECURITY` (não `FORCE`), então o
trigger `handle_new_user` (SECURITY DEFINER, owner `postgres` = owner da tabela)
continua inserindo normalmente. A troca não quebra o cadastro de novos usuários.

**`remediation_001_recreate_has_clinic_role`** — `CREATE OR REPLACE` idempotente,
`SET search_path = ''`, referências qualificadas, `REVOKE` de `PUBLIC/anon/
service_role` e `GRANT EXECUTE` só a `authenticated`, que é quem as policies
Sprint-0 usam. Correta.

## Observação transversal

Quatro das seis terminam com um `SELECT` de relatório. É inócuo em
`supabase db push`, mas denuncia a origem: foram escritas para colar no SQL
Editor. Uma delas (`fix_missing_clinic_memberships`) devolve `auth.users.email`
no output — PII em log de migration.
