# Checklist de Producao

> **CHECKLIST LEGADO:** nao representa aprovacao de producao. Use os onze criterios de GO do relatorio `docs/auditoria-production-readiness-2026-07-16.md` e o gate de `docs/README.md`.

Plano mestre das sprints: `docs/sprint-master-execution-plan.md`.

Runbook operacional: `docs/observability-production-runbook.md`.

## Antes do deploy

- Rodar `npm run lint`.
- Rodar `npm run typecheck`.
- Rodar `npm run build`.
- Na raiz do projeto, rodar `npm run vercel-build` para confirmar que deploys apontando para a raiz delegam corretamente para `web`.
- Rodar `npm run check:predeploy` para a bateria local segura.
  - Valida sintaxe do loader de env local usado pelos scripts remotos.
  - Valida sintaxe dos scripts E2E/cleanup com `node --check`.
  - Roda integridade de migrations/Edge, lint, typecheck, 105 testes unitários/de contrato e build.
  - Roda Playwright no artefato de produção (`next start`): a última execução monolítica registrou 74 pass e 4 skips autenticados/remotos, sem mutações remotas. Toda alteração de E2E exige nova execução monolítica verde antes do deploy.
  - Preserva evidências de falha do Playwright.
  - Auth/RLS, Lab CRUD e Upload/IA são gates remotos separados e nunca são tratados como aprovados por ausência de credenciais.
- Rodar `npm run check:remote-readiness` no modo local antes de qualquer acao remota.
- Usar `npm run check:remote-readiness -- --remote` somente com consulta externa read-only autorizada; esse comando nao autoriza migrations, deploy ou mutacoes.
  - Verifica CLI Supabase, Deno, variaveis obrigatorias e arquivos criticos.
  - Nao aplica migration, nao cria usuarios e nao exibe segredos.
- Rodar `npm run audit:staging` primeiro no modo padrao, que apenas valida o pacote SQL e nao abre rede.
- Usar `npm run audit:staging -- --remote-read-only` somente em staging isolado, com alvo e confirmacao vinculados ao project ref.
  - Coleta apenas catalogo e contagens agregadas de grants, RLS, funcoes, Storage, papeis e integridade.
  - Cada arquivo executa em transacao `READ ONLY` com `ROLLBACK`; a saida nao deve ser versionada.
  - O resumo final usa o contrato `vetdorim-release-gate-v1`; qualquer check falso deve encerrar o comando com codigo nao zero. Saida SQL bem-formada nao equivale a aprovacao.
- Em stack **local isolada**, antes de staging, executar os gates de banco abaixo com `--local` explicito:
  - `supabase db reset --local --no-seed` — destrutivo apenas para o banco local selecionado; nunca usar enquanto houver duvida sobre project id/portas.
  - `supabase migration list --local` — todas as 11 versoes devem estar alinhadas.
  - `supabase test db --local` — baseline atual: 17/17 invariantes pgTAP.
  - `supabase db lint --local --schema public,private --level warning --fail-on warning`.
  - `supabase db advisors --local --type security --fail-on warn` e `--type performance --fail-on warn`.
  - Nao copiar `.temp` para workspace efemero, nao usar `--linked`, nao usar `stop --all` e nao alterar a stack concorrente. Usar project id e todas as portas exclusivos quando a stack completa for necessaria.
  - O replay manual local em PostgreSQL 17.6.1 passou; isso nao prova Auth/Data API/Storage/Edge Function hospedados nem autoriza push.
- Rodar `npm run check:migrations` e exigir os 11 hashes SHA-256 mais a sequencia historica exatamente imutavel depois do bootstrap. Em CI/PR, comparar com o SHA base completo; o manifesto sela somente o baseline do repositorio e nunca prova igualdade remota.
- Rodar `npm run check:edge`; em seguida exigir `deno check --frozen`, `deno lint` e bundle com cache limpo no Edge Runtime fixado. O baseline local passou; `deno fmt --check` ainda deve ser resolvido em diff mecanico isolado.
- Exigir os jobs `Database Contract` e `Edge Runtime Contract` no CI: o primeiro deve resetar as 11 migrations, executar 17/17 pgTAP, lint e advisors; o segundo deve descobrir todas as funcoes versionadas com `deno.json` e usar imagens Deno/Edge fixadas por digest para check, lint e bundle. A sequencia foi reproduzida localmente, mas a primeira execucao no GitHub e os required checks ainda sao obrigatorios.
- Bloquear release enquanto o mesmo SHA não tiver Quality, Public UI, Database Contract e Edge Runtime verdes. Em 2026-07-17, os runs públicos mais recentes estavam vermelhos e os workflows novos ainda não tinham evidência remota.
- Exigir que o Playwright do CI teste `next start`, inclua `api-security.spec.ts` e redirecionamento anônimo do Lab, e valide a supply-chain antes de todo `npm ci`.
- Rodar `npm run test:e2e`; a matriz Chromium atual passou com 75 cenários e 7 fluxos que exigem credenciais foram ignorados explicitamente.
- Preservar `motion-runtime.spec.ts` no predeploy: a demonstração deve pausar fora da viewport, em aba oculta/sem foco e sob `prefers-reduced-motion`; a política estática de evidências públicas deve permanecer visível e sem overflow em celular/tablet. Não reintroduzir contadores, depoimentos nominais, resultados clínicos ou autoplay sem o dossiê de evidências aprovado.
- Rodar `npm run test:e2e:cross-browser` em um ambiente com Chromium, Firefox e WebKit Playwright instalados; o baseline local é 9/9 (3/3 em cada engine), incluindo uma corrida determinística entre duas abas. Ausência de executável é falha de infraestrutura, não aprovação do navegador.
- Manter a regressão multiaba da planilha gratuita: mesma revisão inicial deve gerar um commit e um conflito explícito; exclusão obsoleta não pode apagar exame novo; paciente removido não pode receber exame; migração/aba legada/lock indisponível devem preservar os bytes anteriores e falhar fechados. Não remover Web Locks, revisão esperada ou verificação pós-escrita sem um contrato equivalente em IndexedDB.
- Rodar `npm run test:e2e:auth-rls`.
- Rodar `npm run test:e2e:lab-crud` com usuario temporario e limpeza final.
  - Seguir `docs/lab-crud-real-runbook.md`.
- Rodar `npm run test:e2e:upload-ia` somente apos aplicar migration de quota e deploy da Edge Function `parse-laudo`.
  - Seguir `docs/upload-ia-laudos-runbook.md`.
- Em caso de interrupcao do Upload/IA E2E, usar `npm run cleanup:e2e:upload-ia` primeiro em dry-run e depois com `-- --apply` somente com `E2E_CLEANUP_RUN_ID` definido.
- Em caso de interrupcao do Lab CRUD E2E, usar `npm run cleanup:e2e:lab-crud` primeiro em dry-run e depois com `-- --apply` somente com `E2E_CLEANUP_RUN_ID` definido.
- Depois de S1/S2 aprovados, rodar `supabase db push --dry-run` somente contra staging explicitamente confirmado.
- Rodar `supabase db lint --linked --schema public --fail-on warning`.
- Rodar `supabase db advisors --linked --type security`.
- Rodar `supabase db advisors --linked --type performance`.

## Supabase

- Confirmar que `SUPABASE_PROJECT_REF`, URL, host Postgres e `SUPABASE_ENVIRONMENT=staging` apontam para o mesmo projeto isolado; nao manter project ref real fixo neste documento.
- Reconciliar migrations remotas, grants, RLS, policies de Storage e versao PostgreSQL com o pacote `audit:staging` antes de qualquer `supabase db push`.
- Resolver formalmente no staging o drift de `20260625051920_rls_performance_advisor_cleanup.sql`. O manifesto SHA-256 append-only e a transicao historica conhecida ja foram adicionados, mas `remoteAttestation=false`: lista de versoes e baseline local nao provam igualdade de conteudo remoto.
- Confirmar grants mínimos explícitos da Data API, separados das policies RLS, para todas as tabelas consumidas pelo app.
  - Nao conceder DML amplo antes de concluir tenancy: no baseline local, a ausencia de grants nas tabelas clinicas principais e fail-closed, mas tambem bloqueia a integracao funcional.
  - Preservar a revogacao de `TRUNCATE`, `REFERENCES`, `TRIGGER` e `MAINTAIN` para `anon`/`authenticated`; RLS nao protege `TRUNCATE`.
- Reconciliar a política de senha do Auth remoto com `supabase/config.toml` e com os validadores de cadastro/reset; não assumir que a configuração local altera o projeto hospedado.
- Preservar a conclusão server-side do recovery: POST same-origin, marcador HttpOnly consumido em toda resposta, papel persistido revalidado e destinos limitados a `/lab`/`/portal`; comprovar o ciclo PKCE e SMTP no staging.
- Nao promover a migration de quota/Edge Function atuais como solucao final: S2 deve entregar `claim/finalize/refund` transacional, idempotencia e lease antes do deploy clinico.
- Depois de tenancy/grants/RLS, implantar concorrencia otimista de tutores/pets por rollout expand/contract: `revision bigint`, ETag/`If-Match`, UPDATE atomico, 428 sem precondicao, 409 em revisao obsoleta e corrida real em staging. Nao exigir o cabecalho antes de inventariar/migrar consumidores externos.
- Confirmar secrets da Edge Function:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GEMINI_API_KEY` e `GEMINI_MODEL`, quando Gemini for o provedor aprovado
  - `OPENAI_API_KEY` e `OPENAI_MODEL`, somente quando o fallback for aprovado
- Preservar os imports exatos `2.105.4`, lock Deno v4, `verify_jwt=true`, check congelado, lint e bundle no Edge Runtime. Esses gates passaram localmente; ainda executar o contrato HTTP com Auth, Storage, CORS e provedores no Supabase hospedado antes do deploy.
- Rejeitar qualquer `sb_secret_*` ou JWT `service_role` em `NEXT_PUBLIC_SUPABASE_ANON_KEY`; o readiness e os clientes reais devem usar a mesma regra fail-closed.
- Manter PostHog desabilitado em `/auth`, `/lab` e `/portal`, com autocapture e session replay desligados; validar no proxy/rede que pesquisas e nomes clínicos não saem do navegador.
- Antes de publicar métricas, depoimentos, credenciais ou resultados institucionais, anexar fonte, metodologia, período/data, autorização específica, política de revogação e aprovação Product/Legal/DPO. A home pública atual deliberadamente não exibe os antigos números “500+”/“98%” nem depoimentos nominais.
- Preservar na Edge Function: body streaming limitado a 4 KiB, PDF de ate 10 MiB antes de `arrayBuffer`, envelope de provedor limitado, JSON Schema local estrito, CORS por allowlist e catch condicionado a `status=processando`.
- Exigir `data_coleta`/`data_resultado` como data civil ISO real ou `null`; ordenar evolução por coleta válida e rotular fallback de upload em `America/Sao_Paulo`, sem inferir data ausente.
- Confirmar bucket de laudos: `laudos`.
- Confirmar bucket privado, PDF/10 MiB e policies tenant-aware de reserva, leitura e rollback; o path final deve ser derivado no servidor e nao apenas por `auth.uid()`.
- Confirmar que onboarding profissional usa verificação/aprovação auditável e que nenhum cliente pode promover o próprio papel por metadata ou update direto.
- Confirmar que criação de tutor/paciente aceita `Idempotency-Key` separado, escopado por clínica+ator+operação, e usa ledger privado/fingerprint server-side dentro da mesma RPC do insert. A trava atual da UI após resultado ambíguo é apenas contenção: retry/timeout concorrente deve ser provado em staging sem duplicar registros.
- Confirmar que óbito do paciente, encerramento de triagens e supressão de follow-ups executam em uma RPC tenant-aware, idempotente e transacional, com auditoria imutável e bloqueio de novos envios. A função está deliberadamente contida na UI e no PATCH genérico até esse gate; clientes autenticados também não devem possuir grant de update que permita bypass pela Data API.

## Pos-deploy

- Acessar `/api/health` e confirmar liveness `200` sem dependencia externa.
- Acessar `/api/health/readiness` e confirmar readiness local `200`; `503` bloqueia o deploy.
- Executar QA Mobile/UX seguindo `docs/mobile-ux-runbook.md`.
- Validar Auth e Lab autenticado em claro/escuro, 390×844, 768×1024 e 1440×900, incluindo teclado, leitor de tela, textos longos e estados loading/empty/error.
- Popular dados sintéticos acima de 50 pacientes/laudos e 200 tutores; confirmar busca, totais, ordenação e paginação sem omissão ou duplicidade.
- Validar a janela operacional de paginação e os planos/latências dos índices com volume denso; contagem nula/erro deve bloquear, não simular lista vazia.
- Exercitar a matriz HTTP de cada API (`400/401/403/404/415/503/201`) e falhas da Data API.
- Fazer login com usuario vet real de teste.
- Criar tutor temporario.
- Criar paciente temporario.
- Enviar PDF de laudo temporario.
- Confirmar `laudos_pdf.status = 'concluido'` ou, em falha controlada, `status = 'erro'` com `erro_ia`.
- Confirmar incremento de `profiles.ai_quota_used` apenas em processamento concluido.
- Confirmar limpeza dos dados temporarios e arquivos no bucket.

## Fallback humano

- Se o provedor de IA falhar, orientar o usuario sem expor o provedor/erro interno e manter estado compensado conforme o contrato transacional de S2.
- Se upload falhar antes do insert, nenhum registro deve ficar pendente.
- Se insert falhar depois do upload, o arquivo deve ser removido do bucket.
- Se a IA retornar JSON invalido, registrar erro interno e exibir mensagem generica ao usuario.

## Evidencias esperadas

- Logs da Edge Function sem stack trace sensivel em resposta publica.
- Resultado da bateria E2E anexado ao fechamento da sprint.
- Security Advisor sem novos avisos alem de limitacoes conhecidas do plano.
- Performance Advisor sem novos avisos em policies tocadas.
