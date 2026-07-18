# ADR-002 — Integridade append-only das migrations e tratamento de drift

- **Status:** aceito como baseline local; reconciliação remota pendente
- **Data:** 2026-07-17
- **Story:** `AUDIT-001`
- **Escopo:** `supabase/migrations/*.sql`

## Contexto

A lista de versões do Supabase compara timestamps, não o conteúdo byte a byte. O repositório também contém uma alteração histórica confirmada em `20260625051920_rls_performance_advisor_cleanup.sql`: o SQL original pressupunha a existência de `public.subscriptions`, embora nenhuma migration ativa crie essa tabela. O guard atual preserva a policy quando a tabela existe e permite replay limpo quando ela não existe.

O SHA-256 do artefato efetivamente aplicado em staging/produção não foi recuperado. Portanto, nem o conteúdo original do Git nem o conteúdo local atual podem ser apresentados como prova do estado remoto.

## Decisão

1. `supabase/migration-integrity.json` passa a ser a baseline canônica **do repositório**, usando SHA-256 dos bytes brutos e entradas ordenadas.
2. O manifesto declara obrigatoriamente `remoteAttestation: false`; sua aprovação não significa igualdade com staging ou produção.
3. Migrations presentes na base Git são append-only: não podem ser modificadas, removidas ou renomeadas.
4. Novas migrations devem usar versão superior à maior versão da base.
5. A transição histórica conhecida é permitida somente para o par exato de hashes registrado no ledger. Qualquer outra mudança falha.
6. O ledger de transições também é append-only. Nunca se substitui um evento antigo para fazer um gate passar.
7. Não se usa `migration repair`, `db push` ou reescrita remota para mascarar divergência. A reconciliação começa por consulta read-only, inventário e diff autorizado em staging isolado.
8. O diretório `supabase/migrations_archive` permanece fora da cadeia executável e do manifesto ativo.

## Consequências

- Alterações acidentais em SQL histórico passam a falhar localmente e no CI.
- A adoção inicial mantém uma exceção explícita, limitada e revisável em vez de normalizar silenciosamente o drift.
- O manifesto reduz deriva futura, mas não substitui replay PostgreSQL, pgTAP, lint, advisors, diff de schema ou teste de isolamento multi-tenant.
- Branch protection e revisão obrigatória de DB/Security continuam necessárias. `CODEOWNERS` não será inventado sem o identificador real do time responsável.

## Gate

```text
node web/scripts/verify-migration-integrity.mjs --check
node web/scripts/verify-migration-integrity.mjs --check --base-ref <commit-base-completo>
```

O primeiro comando prova autoconsistência local. O segundo compara a branch com a base Git e impõe a política append-only. Nenhum deles consulta ou altera ambiente remoto.

## Reconciliação remota obrigatória antes do GO

1. Confirmar project ref e ambiente de staging sem expor credenciais.
2. Executar o pack `audit:staging` em modo read-only autorizado.
3. Comparar catálogo, policies, grants, funções e schema efetivo com a baseline esperada.
4. Registrar o hash do artefato remoto apenas se houver evidência byte a byte confiável; caso contrário, manter `remoteArtifactSha256: null` e reconciliar pelo estado estrutural.
5. Produzir nova migration forward para qualquer correção remota. Não editar novamente um arquivo histórico.
