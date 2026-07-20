# Relatório de Execução — Fase 0 (Baseline e CI remoto)

**Data:** 2026-07-18 · **Orquestração:** aiox-master (Claude Fable) · **Status:** ✅ Concluída na parte executável localmente; 4 ações humanas pendentes

## Restrições de ambiente constatadas (transparência)

O sandbox desta sessão **não tem rota de rede** para GitHub nem para o Supabase remoto, e não possui `gh`/`deno`. Consequência: 0.1 e 0.2 foram entregues como correção local + runbook clique-a-clique; 0.3 foi entregue como pacote de auditoria pronto para execução em 1 comando na sua máquina (onde a rede alcança o Supabase). Nada disso foi simulado ou inventado.

## Resultado por tarefa

| Tarefa | Agente / Modelo | Resultado |
|---|---|---|
| 0.1 CI GitHub | devops / Sonnet | **Bloqueador real encontrado:** `deno.lock` da Edge Function não existe porque `.gitignore` (linha 52, `**/deno.lock`) o exclui do git — os jobs *Quality Gates* e *Edge Runtime Contract* falhariam na 1ª execução. `workflow_dispatch` adicionado aos 2 workflows (disparo manual). `node.js.yml` confirmado como workflow legítimo (Public UI tests), não removido. Runbook: `docs/runbooks/fase0-ci-first-run.md`. |
| 0.2 Reconciliar Auth | devops / Sonnet + cyber-chief / Opus | Divergências mapeadas do `config.toml`: confirmação de email OFF, proteção de senha vazada OFF (exige plano Pro), MFA OFF, site_url/redirects em localhost, rede do banco aberta (0.0.0.0/0), sem CAPTCHA. Cyber-chief acrescentou 2 lacunas críticas: **SMTP de produção** (sem ele, confirmação de email e reset quebram) e **rotação de chaves legacy → publishable/secret**. Checklist: `docs/runbooks/fase0-auth-reconciliation-checklist.md`. |
| 0.3 Auditoria remota | db-sage / Sonnet | Criado `web/scripts/staging-audit/sql/05-role-escalation-audit.sql` — 100% read-only (transação READ ONLY + ROLLBACK), integrado automaticamente ao `npm run audit:staging`. Cobre: perfis por papel, escalada via `raw_user_meta_data`, perfis vet/admin sem colaborador ativo, laudos/objetos órfãos, FKs quebradas. Runbook: `docs/runbooks/fase0-auditoria-remota-runbook.md`. Testes: 105/105 ✅. |
| 0.4 Dívidas mecânicas | dev / Haiku | CORS da Edge Function: `localhost` removido dos defaults; agora só entra via env `PARSE_LAUDO_EXTRA_ORIGINS` (regex bloqueia wildcard, credenciais na URL e paths). Diff de 3 linhas revisado pelo orquestrador e aprovado pelo cyber-chief. `deno fmt` ficou pendente (sem Deno no sandbox; você tem Deno 2.9.3 na sua máquina — FIX-115). Testes: 105/105 ✅. |

## Revisão de segurança (cyber-chief / Opus)

Veredito: **APROVADO COM RESSALVAS** — nenhuma reprovação. Correções cirúrgicas aplicadas pelos próprios revisores nos 2 runbooks (flag `--lock-write` não existe no Deno 2; `verify-edge-functions.mjs` exige lock v4 e Deno 2.x recente gera v5 — avisos incluídos no runbook). `index.ts` não precisou de ajuste.

## Ações humanas pendentes (Dr. Anderson)

1. **Gerar e commitar `supabase/functions/parse-laudo/deno.lock`** (na sua máquina com Deno) + remover `**/deno.lock` do `.gitignore` — sem isso o CI falha garantido. Passos exatos no runbook fase0-ci-first-run.
2. Disparar a 1ª execução do CI (push ou aba Actions → Run workflow) e depois configurar os 7 required checks listados no runbook.
3. Executar o checklist de Auth no Dashboard Supabase (11 seções; itens Pro marcados). Decisão de negócio: upgrade Free→Pro para senha vazada + MFA.
4. Rodar a auditoria remota: `cd web && npm run audit:staging` (leitura apenas; interpretar com o runbook fase0-auditoria-remota).

## Consumo de tokens (medido pelo harness por subagente)

| Agente | Modelo | Tokens | Chamadas de ferramenta |
|---|---|---:|---:|
| devops | Sonnet | 127.727 | 58 |
| db-sage | Sonnet | 98.784 | 40 |
| dev | Haiku | 40.587 | 18 |
| cyber-chief | Opus | 63.153 | 14 |
| **Total subagentes** | | **330.251** | 130 |

Orquestração (Fable, este chat): não há medidor exposto ao modelo; o valor exato aparece no seu console de billing. A distribuição seguiu sua tabela de roteamento — o item mais caro por token (Opus) ficou restrito à revisão de segurança.

## Gate para a Fase 1

ADR-001 aprovado por você com defaults + acervo legado confirmado como clínica única. O gate formal do ADR pede reconciliação local × remoto **antes de aplicar** migrations no ambiente hospedado — portanto a Fase 1 será escrita e validada localmente, e a aplicação remota ficará condicionada ao resultado da sua execução do item 4 acima.
