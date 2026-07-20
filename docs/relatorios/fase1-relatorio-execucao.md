# Relatório de Execução — Fase 1 (Tenancy / Isolamento clínico)

**Data:** 2026-07-18 · **Orquestração:** aiox-master (Claude Fable) · **Status:** ✅ Concluída na camada local; aplicação remota gated (ver seção final)

## Decisões do owner que habilitaram a fase

ADR-001 aprovado com defaults (tenant = clínica; sem compartilhamento entre clínicas; recepção fail-closed; admin nunca global) e confirmação formal de que todo o acervo legado pertence à clínica única "Vet do Rim".

## Resultado por tarefa

| Tarefa | Agente / Modelo | Resultado |
|---|---|---|
| 1.1 Spec de promoção | architect / Opus | `docs/architecture/fase1-tenancy-implementation-spec.md` criado; ADR-001 atualizado para "Aprovado (owner, 2026-07-18)". **Decisão-chave:** `enforce` fica FORA deste lote de migrations — se entrasse, o replay do CI falharia (banco efêmero sem `auth.users` não consegue satisfazer o preflight de admin ativo) e o corte é o ponto de não-retorno que exige app publicada + backfill remoto auditado. Storage permanece na policy atual por prefixo `auth.uid()` (mais restritiva que bucket global; a virada por reserva vem com o enforce). |
| 1.2 Migration expand | db-sage / Opus | `supabase/migrations/20260718100000_tenancy_expand.sql`: schema `private`, `clinics`, `clinic_memberships`, manifesto de backfill, helper `private.has_clinic_role` (SECURITY DEFINER, search_path vazio, EXECUTE revogado de PUBLIC/anon), RLS+FORCE fail-closed, `clinic_id`/`created_by` nullable nas 6 tabelas legadas, FKs compostas `NOT VALID`. |
| 1.2b Migration backfill | db-sage / Opus | `20260718100100_tenancy_backfill_default_clinic.sql`: clínica "Vet do Rim" com UUID determinístico `...c11c`, memberships derivadas de colaboradores ativos, atribuição de `clinic_id` só onde nulo, manifesto por linha com fingerprint `md5` e batch UUID, preflights que ABORTAM em ambiguidade (FKs quebradas, laudo sem dono) e replay limpo em banco vazio. Manifesto de integridade atualizado: **13 migrations ativas, PASS**. |
| 1.3 Migration enforce | db-sage / Opus | Autorada e **staged de propósito**: `supabase/migrations_staged/20260718100200_tenancy_enforce.sql.staged` + README com o gate de promoção (expand+backfill aplicados e auditados no remoto → app 1.5 publicada → clinic_admin real provisionado → validação em projeto efêmero). |
| 1.4 Testes pgTAP | qa / Sonnet | `supabase/tests/tenancy_structural_test.sql`: **16 invariantes** novos (RLS+FORCE, ausência de USING(true), privilégios de anon/authenticated, clínica default, manifesto vazio em replay). Matriz negativa Vet A × Vet B adaptada do draft e **staged junto com o enforce** (`supabase/tests_staged/`) — hoje ela deveria falhar, pois as policies de membership ainda não existem; promover os dois juntos. Runbook: `docs/runbooks/fase1-validacao-tenancy-runbook.md`. |
| 1.5 App tenancy-aware | dev / Sonnet | Novo `web/src/lib/server-clinic-context.ts` (resolução de clínica ativa via membership, sem cache, fail-closed p/ null); `authorizeClinicAccess` retrocompatível em `server-authorization.ts`; 4 rotas de API (pets/tutores POST+PATCH) gravam `clinic_id`+`created_by` e filtram por clínica quando há contexto; cross-tenant responde **404** (não confirma existência); pets validam tutor da mesma clínica; `clinic_id`/`created_by`/`vet_id` continuam bloqueados no body. Tipos de `database.ts` estendidos com aviso de regeneração (ADR §6.4). **9 testes novos.** |

## Gates verificados

| Gate | Resultado |
|---|---|
| `npm run check:migrations` | ✅ PASS — 13 ativas, append-only preservado |
| `npx tsc --noEmit` | ✅ 0 erros |
| `npm test` | ✅ **114/114** (105 → 114) |
| `eslint` nos 7 arquivos alterados | ✅ 0 erros (rodado pelo orquestrador; lint completo do repo excede o teto de 45s do sandbox — cobertura total fica no CI) |
| Revisão de orquestrador | ✅ Diffs inspecionados (módulo de contexto de clínica e rotas) — contrato conforme spec |
| Quarentena dos drafts | ✅ Intacta (teste mecânico verde) |

## O que SÓ o CI / projeto efêmero vai provar (não simulei nada disso)

Replay real das 13 migrations (`supabase db reset`), os 16 invariantes pgTAP novos + 17 existentes, `db lint` e advisors. O sandbox não tem Postgres — esta é exatamente a função do job *Database Contract* que a Fase 0 destravou. **Isolamento Vet A × Vet B ainda NÃO está provado em lugar nenhum**: isso é intencional e só acontece na promoção do enforce (os testes já estão prontos e acoplados a ele).

## Pendências para aplicar no remoto (ordem obrigatória)

1. Você roda a auditoria 0.3 (`npm run audit:staging`) e o CI fica verde (inclui as 2 migrations novas).
2. `supabase db push` das migrations expand+backfill (momento em que suas memberships reais passam a existir).
3. Deploy da app com o código 1.5.
4. Promoção do enforce + testes negativos em projeto efêmero → só então aplicar enforce no remoto (runbook da fase detalha).

## Consumo de tokens (medido por subagente)

| Agente | Modelo | Tokens | Tool calls |
|---|---|---:|---:|
| architect | Opus | 139.506 | 23 |
| db-sage | Opus | 164.208 | 24 |
| qa | Sonnet | 155.392 | 29 |
| dev | Sonnet | 186.964 | 88 |
| **Total Fase 1** | | **646.070** | 164 |

Nota de custo: uma tentativa de disparo do dev falhou por indisponibilidade temporária do classificador (0 tokens consumidos) e foi reexecutada. Acumulado Fases 0+1 (subagentes): **976.321 tokens**.
