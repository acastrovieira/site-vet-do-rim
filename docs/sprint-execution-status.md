# Status das Sprints

> **REGISTRO HISTORICO:** os resultados abaixo refletem execucoes anteriores e nao autorizam producao nem operacoes remotas. O estado vigente e **NO-GO**; consulte `docs/README.md`.

Plano mestre: `docs/sprint-master-execution-plan.md`.

## Lab Evolution CRUD real

Status: concluida em E2E remoto com usuario vet temporario.

Evidencias locais:
- APIs `POST` e `PATCH` de tutores/pacientes com validacao reforcada.
- `test:e2e:lab-crud` criado para usuario vet temporario.
- Scripts E2E/cleanup agora carregam envs do shell ou de `web/.env.local`/`.env`, sem imprimir valores sensiveis.
- Runbook operacional criado em `docs/lab-crud-real-runbook.md`.
- Fluxo de laudos validado ate a tela de upload, `accept=application/pdf`, selecao de PDF e botoes de IA/troca.
- `cleanup:e2e:lab-crud` criado em dry-run por padrao.
- `npm run check:predeploy` passou.
- `npm run test:e2e:lab-crud` passou no projeto de staging registrado na evidência privada da execução.
- Usuario vet temporario `e2e-vet-<run-id>@example.test` foi deletado pelo script.
- `npm run cleanup:e2e:lab-crud` em dry-run retornou zero residuos: usuarios 0, tutores 0, pets 0, laudos 0, storageObjects 0.

Pendente:
- Nenhuma pendencia funcional aberta para esta sprint.

Tentativa apos confirmacao:
- Confirmacao recebida para executar `test:e2e:lab-crud`.
- `npm run check:remote-readiness` executado antes de criar dados remotos.
- Primeira tentativa nao iniciou porque `SUPABASE_SERVICE_ROLE_KEY` e `NEXT_PUBLIC_SUPABASE_URL` nao estavam carregadas neste ambiente.
- Apos ajuste de envs, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` foram detectadas em `web/.env.local`.
- `npm run test:e2e:lab-crud` foi iniciado, mas falhou antes de criar usuario temporario: Supabase retornou `Invalid API key`.
- Chamada minima ao API Gateway tambem recusou a chave publica e a administrativa com `Invalid API key`.
- Nenhum usuario vet temporario foi criado pelo script, pois `auth.admin.createUser` falhou antes de retornar usuario.
- Proxima acao: substituir as chaves por Publishable/Secret atuais (`sb_publishable_*` e `sb_secret_*`) ou Legacy `anon`/`service_role` ainda ativas do projeto correto.
- Apos ajuste do readiness para publishable key, as chaves publica e administrativa foram aceitas pelo Supabase.
- E2E final executado com sucesso em 2026-06-28.

## Upload/IA de laudos

Status: preparado localmente; aplicacao remota pendente de pre-requisitos e confirmacao.

Evidencias locais:
- Edge Function `parse-laudo` endurecida para erro rastreavel e PDF via `input_file`.
- Migration local de quota atomica criada.
- `test:e2e:upload-ia` criado para upload real e Edge Function.
- `cleanup:e2e:upload-ia` criado em dry-run por padrao.
- Runbook operacional criado em `docs/upload-ia-laudos-runbook.md`.
- Bucket usado pelo fluxo atual confirmado como `laudos`, apesar de planejamento antigo citar `laudos-pdf`.
- `npm run check:predeploy` passou novamente em 2026-06-28, com lint, typecheck, build e 7 testes mobile/publicos aprovados; Lab CRUD, Lab mobile autenticado e Upload/IA ficaram skipped nessa bateria por dependerem de credenciais/segredos reais.

Pendente:
- Instalar ou disponibilizar Deno no PATH para validar Edge Function.
- Definir `SUPABASE_DB_PASSWORD` fora do chat para permitir `supabase migration list` e `supabase db push --dry-run`.
- Cadastrar `OPENAI_API_KEY` nos secrets da Edge Function, sem expor o valor em logs/chat.
- Aplicar migration de quota.
- Deploy da Edge Function.
- Rodar `npm run test:e2e:upload-ia` somente no projeto `<staging-project-ref>` explicitamente confirmado.

Pre-checagem apos Sprint Lab CRUD:
- Supabase CLI disponivel nesta sessao: `2.107.0`.
- Chave publica/anônima em `web/.env.local` aceita pelo Supabase.
- Chave administrativa em `web/.env.local` aceita pelo Supabase.
- `npm run check:remote-readiness` agora separa `readiness.labCrud` e `readiness.uploadIa`; resultado atual: `labCrud=true`, `uploadIa=false`.
- `SUPABASE_DB_PASSWORD` ainda nao esta definido para a CLI Postgres.
- `supabase functions list`: `parse-laudo` existe remoto, status `ACTIVE`, versao `1`, atualizado em `2026-05-15 04:24:08 UTC`.
- `supabase secrets list` consultado sem expor valores: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` presentes; `OPENAI_API_KEY` ausente; `OPENAI_MODEL` opcional ausente.
- `supabase db advisors --linked --type security`: apenas aviso conhecido `auth_leaked_password_protection` no plano Free.
- `supabase db advisors --linked --type performance`: sem issues.
- `supabase db lint --linked --schema public --fail-on warning`: passou sem erros.
- `supabase db lint --linked --schema public,storage --fail-on warning`: falhou apenas em warning conhecido de `storage.search_by_timestamp`, funcao interna do Supabase.
- `supabase migration list` e `supabase db push --dry-run`: bloqueados por autenticacao Postgres (`SUPABASE_DB_PASSWORD` ausente/incorreta nesta sessao).
- Deno ainda nao esta no PATH, pendente para `deno check` e fluxo de Edge Function.

## Mobile/UX refinada

Status: concluida localmente para os fluxos cobertos.

Evidencias locais:
- `mobile-layout.spec.ts` cobre rotas publicas, formulario longo, copy de ferramentas profissionais, gate anonimo do Lab e `/api/health`.
- `mobile-layout.spec.ts` agora cobre tambem botoes visiveis sem nome acessivel no header mobile.
- `ThemeToggle` deixou de renderizar placeholder invisivel como `<button>` antes da hidratacao, reduzindo ruído de acessibilidade e foco.
- `playwright.config.ts` passou a usar a mesma origem `localhost` do servidor dev, evitando bloqueio cross-origin de recursos Next.js e testes sem hidratacao.
- Toasts agora ocupam `left-4 right-4` no mobile e preservam canto inferior direito no desktop.
- `LabShell` agora alterna `aria-label` e `aria-expanded` no menu mobile autenticado.
- `TutorPetActions` ganhou modais responsivos com altura maxima por viewport e rolagem interna, reduzindo risco de corte em telas pequenas ou teclado aberto.
- `LaudoUploader` passou a priorizar painel de acao/resultado antes do preview do PDF no mobile; o iframe usa `50dvh` no mobile e mantem `600px` no desktop.
- `lab-crud.spec.ts` ganhou smoke mobile autenticado para abrir navegacao do Lab e validar ausencia de overflow; roda apenas quando houver credenciais E2E.
- Runbook operacional criado em `docs/mobile-ux-runbook.md`.
- Validacao por Browser embutido: home mobile sem overflow horizontal, menu abre/fecha, ferramentas publicas com copy clara, ferramenta profissional anonima sem campos de calculo, Lab anonimo redireciona para login com `redirectTo`.
- `npx playwright test tests/e2e/mobile-layout.spec.ts tests/e2e/lab-crud.spec.ts`: 7 passed, 2 skipped.
- `npm run check:predeploy` passou com 7 testes mobile aprovados, 3 testes remotos sensiveis skipped.

Pendente:
- Validacao visual em dispositivo fisico real, se desejado.
- Execucao real da cobertura mobile autenticada do Lab ainda depende de credenciais E2E carregadas no ambiente.

## Observabilidade e producao

Status: preparado localmente; validacao remota pendente.

Evidencias locais:
- `/api/health` criado sem expor segredos.
- Erros de upload/IA de laudos agora exibem fallback humano acionavel: tentar novamente e suporte via WhatsApp com mensagem sem dados sensiveis.
- Checklist de producao documentado.
- Runbook operacional criado em `docs/observability-production-runbook.md`.
- Build de raiz corrigido: `npm run vercel-build` agora delega para `npm --prefix web run build`.
- `npm run vercel-build` passou na raiz do projeto.
- `check:predeploy` automatiza sintaxe dos scripts, lint, typecheck, build e E2E seguro.
- `check:predeploy` tambem valida sintaxe de `scripts/lib/env-file.mjs`.
- `check:remote-readiness` verifica se CLI, Deno, envs, secrets remotos e arquivos criticos estao prontos para a etapa remota.
- `check:remote-readiness` agora reconhece `web/.env.local`/`.env` e informa apenas a origem das chaves, sem exibir valores.
- `npm run check:remote-readiness` executado nesta sessao:
  - arquivos criticos encontrados;
  - Supabase CLI encontrado no PATH;
  - `web/.env.local` carregado;
  - chaves publica e administrativa aceitas pela API Supabase;
  - Deno nao encontrado no PATH;
  - `SUPABASE_DB_PASSWORD` ausente ou placeholder;
  - secret remoto `OPENAI_API_KEY` ausente.

Pendente:
- Confirmar `/api/health` em ambiente publicado.
- Rodar advisors Supabase apos migrations remotas.
- Validar logs da Edge Function apos upload real.
- Implementar alerta ativo/monitoramento externo, se a meta de producao exigir notificacao automatica fora dos logs.
