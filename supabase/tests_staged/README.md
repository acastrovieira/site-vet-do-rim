# `supabase/tests_staged/` — testes acoplados a migrations ainda não promovidas

Este diretório é o espelho, em testes, de `supabase/migrations_staged/`: guarda
pgTAP/scripts que só fazem sentido **depois** que um candidato de promoção
específico virar migration ativa. Nada aqui é descoberto por
`supabase test db --local` — a extensão `.sql.staged` garante isso (mesma
convenção usada em `supabase/migrations_staged/README.md`).

## Conteúdo atual

| Arquivo | Migration/gate ao qual está acoplado | Status |
|---|---|---|
| `tenancy_negative_test.sql.staged` | `supabase/migrations_staged/20260718100200_tenancy_enforce.sql.staged` (Fase 4 — Enforcement, ADR-001) | **Aguardando promoção conjunta** |

Adaptado de `docs/architecture/drafts/tenancy/90-negative-tests.sql` conforme
`docs/architecture/fase1-tenancy-implementation-spec.md` §5.3. O conteúdo das
asserções não foi reescrito — os nomes de função/policy/trigger foram
conferidos linha a linha contra `20260718100200_tenancy_enforce.sql.staged`
(`private.enforce_tenant_row`, `private.prepare_laudo_insert`,
`private.enforce_laudo_immutable_fields`,
`private.assert_active_clinic_has_admin`,
`storage_laudos_insert_exact_record`, `storage_laudos_select_exact_record`) e
batem exatamente.

## Por que isto NÃO pode virar `supabase/tests/*.sql` hoje

O teste prova isolamento **por membership** (Vet A não vê Clinic B, revogação
de membership fecha o acesso, etc.). Isso só é verdade depois que o `enforce`
troca as policies globais legadas por policies de membership. Hoje, na cadeia
ativa (`expand` + `backfill`), as policies clínicas legadas por
`profiles.role` **continuam no ar** deliberadamente (ver
`docs/architecture/fase1-tenancy-implementation-spec.md` §1.2/§3). Isso
significa duas coisas ao mesmo tempo:

1. As tabelas/objetos que este teste espera (`private.enforce_tenant_row` e
   companhia, as duas policies de Storage por reserva exata) **não existem**
   ainda na cadeia ativa — o script falharia já no preflight de contagem de
   policies/funções.
2. Mesmo que existissem, o job **Database Contract** do CI não semeia
   `auth.users` (`supabase test db --local` roda pgTAP contra um banco vazio
   recém-nascido de `supabase db reset --local --no-seed`) — não há como
   fornecer os quatro UUIDs (`test.vet_a/admin_a/vet_b/admin_b`) que o
   preflight deste script exige.

Incluir este arquivo em `supabase/tests/` faria o CI falhar de forma
determinística e por um motivo errado (setup ausente), mascarando o motivo
real (o `enforce` ainda não foi promovido). Por isso ele fica em
`tests_staged/`, com a mesma lógica documentada para `migrations_staged/`.

## Análise: criar os 4 usuários dentro da própria transação pgTAP é viável?

Avaliado e **descartado para o CI**, viável só como operação manual pontual no
efêmero:

- **Tecnicamente possível em teoria.** A stack efêmera do Database Contract
  roda como superuser (`postgres`), e o script inteiro está dentro de uma
  transação que termina em `ROLLBACK`, então um `INSERT INTO auth.users (...)`
  feito ali não deixaria rastro. Não há bloqueio de permissão que impeça isso.
- **Descartado para o CI mesmo assim**, por três razões concretas:
  1. **Schema `auth` não é um contrato nosso.** `auth.users` tem colunas,
     triggers e uma tabela satélite (`auth.identities`) mantidas pelo GoTrue
     (o serviço de Auth do Supabase), não pela nossa migration. Fabricar uma
     linha "boa o suficiente" para passar o preflight de FK
     (`auth.users(id)` existe) é fácil; fabricar uma linha que o restante do
     serviço de Auth aceitaria como usuário real (hash de senha,
     `email_confirmed_at`, `aud`, `role`, `instance_id`, e principalmente a
     linha correspondente em `auth.identities`) é replicar um contrato interno
     do GoTrue que pode mudar entre versões do Supabase sem aviso — o teste
     ficaria acoplado a um detalhe de implementação de terceiros, não ao
     nosso schema.
  2. **O gate que importa é o `enforce`, não os quatro usuários.** Mesmo se os
     quatro usuários fossem fabricados com sucesso, o `enforce` ainda não
     está na cadeia ativa (ver seção acima) — o teste continuaria falhando
     pelo motivo #1 (objetos ausentes). Resolver a fabricação de usuários sem
     resolver isso não destrava o CI; só troca um motivo de falha por outro.
  3. **O uso real deste teste é manual, num projeto descartável, com
     usuários criados pela Auth Admin API** (`supabase.auth.admin.createUser`
     ou equivalente), exatamente como o restante da suíte E2E do repositório
     já faz (`web/scripts/e2e-*-cycle.mjs`). Isso garante que os quatro
     usuários são indistinguíveis de usuários reais para qualquer política ou
     trigger que dependa do estado interno do GoTrue — sem precisar adivinhar
     esse estado à mão.

**Conclusão:** nenhum código de fabricação de `auth.users` foi adicionado a
este arquivo. O script continua exigindo os quatro UUIDs via
`SET test.vet_a/admin_a/vet_b/admin_b`, provisionados por fora (Auth Admin
API) antes da execução — igual ao draft original.

## Protocolo de promoção (executar junto com o `enforce`, nunca sozinho)

1. Cumprir todos os itens do gate de promoção em
   `supabase/migrations_staged/README.md` (expand+backfill auditados no
   remoto, app Fase 1.5 publicada, `clinic_admin` real provisionado,
   inventário de `storage.objects` reconciliado).
2. Provisionar os quatro usuários Auth (`vet_a`, `admin_a`, `vet_b`,
   `admin_b`) no projeto efêmero descartável via Auth Admin API.
3. Promover `20260718100200_tenancy_enforce.sql.staged` para
   `supabase/migrations/20260718100200_tenancy_enforce.sql` (remover a
   extensão `.staged`, registrar o SHA-256 em
   `supabase/migration-integrity.json`).
4. **No mesmo lote**, promover este arquivo: mover/renomear
   `tenancy_negative_test.sql.staged` para
   `supabase/tests/tenancy_negative_test.sql` (remover a extensão `.staged`).
   Os dois movimentos são uma unidade — não faz sentido promover um sem o
   outro.
5. Rodar manualmente no efêmero (nunca no CI compartilhado, por causa dos
   quatro usuários reais e do `ROLLBACK` sobre dados de teste):
   ```
   psql "$EFEMERO_DB_URL" \
     -v vet_a="'<uuid>'" -v admin_a="'<uuid>'" \
     -v vet_b="'<uuid>'" -v admin_b="'<uuid>'" \
     -c "SET test.allow_tenancy_destructive_fixture = 'yes';" \
     -f supabase/tests/tenancy_negative_test.sql
   ```
   (ou o equivalente via `SET` prévio de cada `test.*` na mesma sessão —
   ver o cabeçalho do arquivo).
6. Só depois disso, com o resultado documentado, seguir para o restante do
   gate de `docs/architecture/drafts/tenancy/README.md` (Storage API, Edge
   Function, E2E completo).

Não registrar e-mails, senhas, tokens ou service keys neste diretório.
