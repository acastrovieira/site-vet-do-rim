# `supabase/migrations_staged/` — candidatos de promoção (NÃO ativos)

Este diretório guarda migrations **revisadas mas ainda não promovidas** para a
cadeia ativa `supabase/migrations/`. Nada aqui é executado pelo Supabase CLI: o
`supabase db reset --local` e o job **Database Contract** do CI só leem
`supabase/migrations/*.sql`. Os arquivos aqui usam a extensão `.sql.staged`
justamente para **não** casarem esse padrão e **não** entrarem no manifesto de
integridade (`supabase/migration-integrity.json`), que é append-only.

## Conteúdo atual

| Arquivo | Fase ADR | Status |
|---|---|---|
| `20260718100200_tenancy_enforce.sql.staged` | Fase 4 (Enforcement) | **Aguardando gate de promoção** |

Derivado de `docs/architecture/drafts/tenancy/02-enforce.sql` conforme
`docs/architecture/fase1-tenancy-implementation-spec.md` (seção 2.3), com a
sentinela de quarentena removida na cópia promovível. É o **único ponto de
não-retorno** do ADR-001 (`NOT NULL` em `clinic_id`, imutabilidade de tenant,
troca atômica das policies globais por policies de membership, unicidade de
e-mail por clínica, storage por reserva).

## Por que o `enforce` fica fora da cadeia ativa agora

Ver a spec, seção 1.2. Resumo:

1. **Replay do CI em banco vazio.** O `enforce` cria o constraint trigger
   `assert_active_clinic_has_admin` e um preflight que **aborta** se existir
   clínica `active` sem `clinic_admin` ativo. No replay do CI o banco começa
   vazio e **sem `auth.users`**; o `backfill` cria a clínica default "Vet do
   Rim" mas **não há usuário Auth** para virar `clinic_admin`. Incluir o
   `enforce` no lote faria o `supabase db reset` do Database Contract **falhar**.
2. **Acoplamento com o runtime (Fase 1.5).** O `enforce` exige o fluxo
   reservar-laudo → path canônico → upload, incompatível com o app atual.
3. **Fail-closed e rollout gated.** `expand`+`backfill` são reversíveis e não
   cortam acesso; `enforce` é a virada irreversível de autorização.

## Gate de promoção (spec §1.3) — cumprir TODOS antes de mover para `migrations/`

- [ ] `expand`+`backfill` aplicados e auditados no remoto (audit read-only:
      `clinic_id` populado, zero relação cruzada, manifesto batendo).
- [ ] App **Fase 1.5** publicada (filtro `clinic_id`, resolução de clínica ativa,
      reservar-antes-de-upload) — spec §4.
- [ ] Membership `clinic_admin` **ativa** provisionada para a clínica "Vet do
      Rim" com o `auth.users.id` real do responsável, e clínica `active` (senão o
      preflight aborta).
- [ ] `docs/architecture/drafts/tenancy/90-negative-tests.sql` aprovado no
      projeto efêmero com 4 usuários Auth reais (Vet A × Vet B).
- [ ] Inventário read-only de `pg_policies` em `storage.objects` reconciliado com
      a allowlist do preflight (linhas 233-249 do draft); confirmar que
      `colaboradores_email_key` é o nome real do UNIQUE de e-mail; conferir os
      grants coluna-a-coluna contra o schema real.

## Como promover (lote futuro, fora desta tarefa)

1. Renomear/copiar para `supabase/migrations/20260718100200_tenancy_enforce.sql`
   (remover a extensão `.staged`).
2. Registrar o SHA-256 dos bytes crus no array `migrations` de
   `supabase/migration-integrity.json`, mantendo a ordenação estrita por nome
   (append-only; sem `approvedHistoricalTransitions` — é arquivo novo).
3. `cd web && npm run check:migrations` deve passar.
4. Validar no efêmero com usuários Auth reais antes de qualquer aplicação remota.
