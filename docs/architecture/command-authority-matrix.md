# Matriz de autoridade de comandos

**Status:** referência operacional derivada  
**Fonte normativa:** `.aiox-core/constitution.md`, artigo II  
**Escopo:** agentes e wrappers AIOX deste repositório brownfield

Este documento resolve a referência compartilhada pelos agentes PM, PO e SM.
Ele não concede autoridade, não substitui a Constituição e não autoriza ações
remotas. Em caso de divergência, prevalecem as instruções de sistema, os
guardrails do projeto e a Constituição, nessa ordem.

## Matriz

| Operação | Autoridade | Condição mínima | Delegação obrigatória |
|---|---|---|---|
| Criar ou refinar story | `@sm` ou `@po` | Requisito rastreável e critérios de aceite | Não aplicável |
| Priorizar backlog e aceitar escopo | `@po` | Evidência de produto e impacto | Não aplicável |
| Tomar decisão de arquitetura | `@architect` | ADR ou registro equivalente revisado | Outros agentes propõem; `@architect` decide |
| Implementar código local | `@dev` | Story aprovada e escopo definido | Mudança de arquitetura volta ao `@architect` |
| Alterar schema ou migration | `@data-engineer`/DBA, com `@architect` e Security | Ambiente isolado, revisão SQL e rollback | Produção exige `@devops` e aprovação humana |
| Emitir veredito de qualidade | `@qa` | Gates executados e evidências registradas | Falhas retornam ao responsável técnico |
| Commit local | `@dev` no fluxo da story | Diff revisado e gates proporcionais verdes | Publicação continua com `@devops` |
| `git push` | `@devops` | Autorização explícita, branch e diff confirmados | Exclusiva; nenhum outro agente executa |
| Criar ou atualizar Pull Request | `@devops` | Push autorizado e checks disponíveis | Exclusiva |
| Criar tag ou release | `@devops` | Aprovação de release e gates obrigatórios | Exclusiva |
| Deploy ou promoção de ambiente | `@devops`/Release Manager | Alvo explícito, rollback, aprovações e smoke | Banco/segurança/clínica aprovam quando aplicável |
| Aplicar migration remota | `@devops` + DBA/Data Engineer | Backup/restore, dry-run, revisão por duas pessoas e alvo explícito | Nunca inferir autorização de uma story |

## Regras fail-closed

- Identidade de agente desconhecida não pode executar operação remota.
- Variável de ambiente definida dentro do próprio comando não comprova a
  identidade do agente.
- Aprovação para consulta, análise ou implementação local não autoriza push,
  PR, deploy, release ou migration remota.
- Falha em lint, tipos, testes, build ou gate aplicável impede publicação.
- Dados clínicos, pessoais ou segredos não devem ser copiados para logs,
  evidências ou comentários de PR.
- Nenhuma ferramenta deve contornar branch protection, revisão humana ou
  confirmação explícita de alvo.

## Fluxo padrão

1. `@po`/`@sm` registra escopo e critérios.
2. `@architect` decide mudanças estruturais quando necessárias.
3. `@dev` implementa e verifica localmente.
4. `@qa` revisa evidências e emite o veredito.
5. `@devops` confirma o alvo e executa, quando explicitamente autorizado, as
   operações remotas de publicação.

Esta matriz deve ser atualizada somente junto de uma alteração explícita da
Constituição ou do modelo operacional do projeto.
