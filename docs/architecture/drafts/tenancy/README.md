# Draft quarantinado — tenancy/RLS

> **NÃO EXECUTAR. NÃO COPIAR PARA `supabase/migrations/`. NÃO USAR EM PRODUÇÃO.**

Status: `QUARANTINED / ARCHITECTURE REVIEW ONLY` | Data da revisão estática: 2026-07-16 | ADR: `docs/architecture/ADR-001-tenancy-clinica-rls.md`

Este diretório contém uma implementação SQL candidata do ADR-001. Os arquivos foram escritos contra o schema reconstruído pelas migrations atuais, mas não foram aplicados local ou remotamente. A promoção exige gerar migrations novas pelo Supabase CLI, revisar o diff e executar os gates abaixo em um projeto descartável.

`01-expand.sql` e `02-enforce.sql` possuem uma sentinela logo após `BEGIN` que sempre lança exceção. Isso torna a quarentena mecânica, não apenas documental. A promoção deve derivar migrations novas e remover conscientemente a sentinela somente nessas cópias revisadas; os drafts deste diretório devem permanecer bloqueados.

## Arquivos e ordem lógica

1. `01-expand.sql`
   - cria `clinics`, `clinic_memberships` e o manifesto privado de backfill;
   - adiciona `clinic_id`/`created_by` como nullable às seis tabelas existentes;
   - cria índices e FKs compostas `NOT VALID`;
   - deixa as entidades novas fail-closed, exceto leitura autorizada de clínica/membership;
   - não altera as policies clínicas legadas.
2. **Backfill não incluído**
   - é obrigatoriamente derivado de um manifesto revisado;
   - não existe valor default seguro para dados legados;
   - linhas ambíguas ficam em quarentena e impedem enforcement.
3. `02-enforce.sql`
   - aborta se o preflight encontrar tenant nulo, relação cruzada, membership ausente, bucket público ou divergência de Storage;
   - valida FKs, torna `clinic_id` obrigatório e imutável;
   - remove todas as policies das tabelas-alvo e recria uma allowlist por membership;
   - aplica grants mínimos, paths de laudo gerados pelo banco e policies de Storage vinculadas ao registro reservado;
   - não concede hard delete ao papel `authenticated`.
4. `90-negative-tests.sql`
   - roda somente em Supabase descartável, dentro de uma transação que termina em `ROLLBACK`;
   - requer quatro usuários Auth efêmeros já provisionados: Vet A, Admin A, Vet B e Admin B;
   - prova isolamento Vet A × Vet B em tabelas, grants, FKs, revogação de membership e camada SQL das policies de Storage.

## Schema atual considerado

| Objeto atual | Origem |
|---|---|
| `profiles`, `tutores`, `pets`, `colaboradores`, `laudos_pdf` | `supabase/migrations/20260531000000_full_schema_setup.sql` |
| campos de quota em `profiles` | `20260531000050_ai_usage_limits.sql` |
| hardening global por `profiles.role` | `20260623000100_auth_rls_hardening.sql` |
| `triagens`, `follow_ups`, `profiles.phone/address`, `pets.data_obito` | `20260623000200_schema_drift_completion.sql` |
| schema `private` e helper admin | `20260624000100_security_advisor_fixes.sql` |
| policies finais de `profiles`/`colaboradores` | `20260625051920_rls_performance_advisor_cleanup.sql` |
| RPC de quota | `20260626010000_ai_quota_rpc_and_parse_laudo_hardening.sql` |
| bucket `laudos` e policies históricas | migration inicial, `auth_rls_hardening`, migrations arquivadas e `supabase/fix-laudos-storage.sql` |

O draft preserva as colunas, tipos e relações atuais e adiciona a fronteira de tenant. FKs antigas de uma coluna permanecem durante expand/enforcement; as compostas adicionam a garantia cross-tenant. A remoção das FKs redundantes pertence ao contract, não a estes arquivos.

## Garantias pretendidas

- `clinic_memberships` é a única fonte de autorização profissional por tenant.
- `profiles.role`, `colaboradores.nivel_acesso`, metadata JWT e path enviado pelo cliente não autorizam acesso.
- Toda linha clínica recebe `clinic_id`; relações filhas carregam e validam o mesmo tenant.
- Clínica suspensa ou membership inativa falha fechada, mesmo com JWT anterior.
- `clinic_admin` só administra a própria clínica; não existe admin global nas policies clínicas.
- `recepcao` acessa somente cadastro de tutores/pets e diretório ativo; triagem, follow-up e laudos permanecem negados.
- `clinic_id` é imutável; `created_by` só pode ser nulificado pela ação referencial após desaparecimento comprovado da chave Auth, nunca por alteração direta.
- Laudo novo tem `vet_id`, `created_by`, status inicial e `storage_path` definidos/normalizados por trigger.
- `vet_id`/`supabase_uid` só podem ser nulificados pela remoção da membership-pai; atribuição direta a outro usuário permanece bloqueada pela FK/trigger e pelos grants.
- Storage aceita upload somente para uma reserva exata de `laudos_pdf`; nenhum prefixo, `owner_id` ou pasta do usuário concede acesso sozinho.
- UPDATE possui policy SELECT correspondente e usa `USING` + `WITH CHECK`.
- `anon` não recebe grants sobre objetos do tenant.

## Riscos e ambiguidades que bloqueiam promoção

### 1. Mapeamento legado não é inferível

`tutores`, `pets`, `triagens` e `follow_ups` não guardam criador ou clínica. `laudos_pdf.vet_id` e `colaboradores.supabase_uid` são apenas indícios. Produto/Compliance deve aprovar um manifesto por linha ou confirmar formalmente que todo o acervo pertence a uma única clínica.

### 2. Estado remoto não foi inspecionado

Não há prova de que policies, grants, constraints, funções e objetos de Storage remotos sejam iguais ao repositório. Antes da promoção é obrigatório exportar o catálogo seguro e reconciliar:

- `pg_policy`/`pg_policies`;
- `information_schema.role_table_grants` e grants de funções;
- `pg_constraint`, `pg_index` e `pg_trigger`;
- `storage.buckets` e a correspondência `laudos_pdf.storage_path ↔ storage.objects.name`;
- inventário completo de policies em `storage.objects`; qualquer nome não revisado bloqueia o enforcement para evitar bypass por composição permissiva;
- migrations aplicadas e versão real do PostgreSQL.

### 3. Contrato runtime ainda é incompatível

O frontend atual envia o PDF antes de criar `laudos_pdf`, define `vet_id`/`storage_path` no cliente e usa path `{auth.uid()}/...`. O enforcement exige o fluxo inverso: reservar laudo, receber o path canônico e então fazer upload. Não promover antes de adaptar e testar `LaudoUploader` e `parse-laudo`.

As rotas de tutor/pet também precisam resolver clínica ativa no servidor e enviar `clinic_id`. O gate `/lab` deve migrar de `profiles.role` para membership.

### 4. Administração de memberships não existe

O draft não concede INSERT/UPDATE/DELETE de memberships ao browser. É necessário definir uma API administrativa transacional, auditada e protegida contra:

- autoelevação;
- mudança de tenant;
- remoção do último `clinic_admin` ativo;
- reativação indevida;
- exclusão de histórico.

O browser também não recebe grant para definir ou trocar `colaboradores.supabase_uid`; esse vínculo pertence ao mesmo workflow administrativo auditado.

O banco já bloqueia uma clínica ativa sem admin, mas isso não substitui contrato de API, autorização adicional e trilha de auditoria.

### 5. Papel `recepcao` requer aprovação

O draft implementa o default conservador do ADR: cadastro de tutor/pet e leitura do diretório ativo; nenhum acesso a observação clínica, triagem, follow-up ou laudo. Qualquer ampliação precisa de decisão funcional/LGPD e novos testes.

### 6. `colaboradores` e membership duplicam informação

`nivel_acesso` permanece apenas por compatibilidade e não participa da RLS. A sincronização entre `colaboradores.ativo`, `supabase_uid` e membership ainda precisa de um workflow. A unicidade global de e-mail é substituída no enforcement por unicidade case-insensitive dentro da clínica.

### 7. Auth user deletion e retenção

Membership usa FK restritiva para `auth.users` para preservar histórico. O fluxo de exclusão/anominização de conta, retenção clínica, purge LGPD e transferência de paciente ainda precisa de aprovação jurídica/operacional.

### 8. Locks e volume não foram medidos

Os índices do draft são criados dentro de transação, sem `CONCURRENTLY`. Isso é correto para o projeto efêmero, mas a estratégia de produção depende de contagens, tamanho, tráfego e orçamento de lock. Um DBA deve decidir se os índices serão migrations não transacionais separadas.

### 9. `service_role` continua de alto impacto

Grants do `service_role` são explícitos porque scripts E2E/cleanup e a Edge Function atuais os exigem. É necessário inventariar cada consumidor e reduzir a allowlist antes de produção. RLS não protege operações executadas com service key.

### 10. Teste SQL não valida o objeto físico do Storage

`90-negative-tests.sql` inspeciona somente o catálogo das policies de Storage, sem executar DML em `storage.objects`. A documentação do Supabase determina que uploads/cópias/deletes reais sejam feitos pela Storage API. A promoção exige uma suíte adicional pela API e prova de que nenhuma operação deixou objeto órfão.

### 11. Edge Function não é exercitada pelo SQL

O teste SQL não prova que Vet A não consegue invocar `parse-laudo` com `laudoId` B. É obrigatório um teste de integração que confirme: resposta indistinguível de “não encontrado”, nenhum download, nenhum status alterado e nenhuma quota consumida.

### 12. Versão PostgreSQL

`supabase/config.toml` declara PostgreSQL 17. O draft usa a extensão PostgreSQL `ON DELETE SET NULL (coluna)` para preservar `clinic_id` em FK composta. A versão remota deve ser confirmada antes da promoção.

## Gates obrigatórios antes de remover a quarentena

- [ ] ADR-001 aprovado por Produto, Security, DBA e responsável clínico.
- [ ] Estado remoto reconciliado e backup restaurado em ambiente isolado.
- [ ] Manifesto de backfill aprovado; zero linha ativa sem tenant.
- [ ] Runtime adaptado para clínica ativa e reserva de laudo antes do upload.
- [ ] API de membership e trilha de auditoria definidas.
- [ ] SQL promovido por `supabase migration new`, nunca por cópia manual do nome do draft.
- [ ] Reset completo em projeto efêmero e tipos regenerados do schema real.
- [ ] Security Advisor e Performance Advisor sem findings críticos/altos.
- [ ] `90-negative-tests.sql` aprovado com quatro usuários Auth efêmeros.
- [ ] Storage API, Edge Function e E2E Vet A × Vet B aprovados.
- [ ] Lock/tempo de cada etapa medido com volume representativo.
- [ ] Rollback fail-closed ensaiado; nunca restaurar `USING (true)`.
- [ ] Retenção, exportação, anonimização e purge LGPD aprovados.

## Execução futura dos testes — somente após promoção em ambiente descartável

O teste espera quatro UUIDs de usuários Auth já existentes na mesma sessão, via custom settings:

```text
test.vet_a
test.admin_a
test.vet_b
test.admin_b
```

O operador deve usar `ON_ERROR_STOP`, definir os quatro settings e incluir `90-negative-tests.sql` na mesma conexão. O arquivo aborta se estiver fora de banco local/descartável conforme o marcador `test.allow_tenancy_destructive_fixture = 'yes'`; ainda assim termina sempre em `ROLLBACK` quando passa.

Não registrar e-mails, senhas, tokens ou service keys neste diretório.

## Referências atuais

- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase — Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase — Storage schema é read-only](https://supabase.com/docs/guides/storage/schema/design)
- [Supabase — mudança de grants automáticos](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
- [PostgreSQL 17 — foreign keys e `SET NULL (coluna)`](https://www.postgresql.org/docs/17/ddl-constraints.html)
