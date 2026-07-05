# Checklist de Producao

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
  - Roda lint, typecheck e build.
  - Roda E2E mobile.
  - Compila specs Lab CRUD e Upload/IA, que ficam `skipped` sem credenciais reais.
  - Remove `web/test-results/` ao final.
- Rodar `npm run check:remote-readiness` antes de qualquer acao remota.
  - Verifica CLI Supabase, Deno, variaveis obrigatorias e arquivos criticos.
  - Nao aplica migration, nao cria usuarios e nao exibe segredos.
- Rodar `npm run test:e2e`.
- Rodar `npm run test:e2e:auth-rls`.
- Rodar `npm run test:e2e:lab-crud` com usuario temporario e limpeza final.
  - Seguir `docs/lab-crud-real-runbook.md`.
- Rodar `npm run test:e2e:upload-ia` somente apos aplicar migration de quota e deploy da Edge Function `parse-laudo`.
  - Seguir `docs/upload-ia-laudos-runbook.md`.
- Em caso de interrupcao do Upload/IA E2E, usar `npm run cleanup:e2e:upload-ia` primeiro em dry-run e depois com `-- --apply` somente com `E2E_CLEANUP_RUN_ID` definido.
- Em caso de interrupcao do Lab CRUD E2E, usar `npm run cleanup:e2e:lab-crud` primeiro em dry-run e depois com `-- --apply` somente com `E2E_CLEANUP_RUN_ID` definido.
- Rodar `supabase db push --dry-run`.
- Rodar `supabase db lint --linked --schema public --fail-on warning`.
- Rodar `supabase db advisors --linked --type security`.
- Rodar `supabase db advisors --linked --type performance`.

## Supabase

- Confirmar projeto alvo: `ycclyzoslirpnnwgzrqx`.
- Confirmar migrations pendentes antes de `supabase db push`.
- Aplicar a migration de quota atomica antes do deploy da Edge Function `parse-laudo`.
- Confirmar secrets da Edge Function:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL` opcional
- Confirmar bucket de laudos: `laudos`.
- Confirmar policies de Storage para pasta `auth.uid()`.

## Pos-deploy

- Acessar `/api/health` e confirmar status `200`.
- Executar QA Mobile/UX seguindo `docs/mobile-ux-runbook.md`.
- Fazer login com usuario vet real de teste.
- Criar tutor temporario.
- Criar paciente temporario.
- Enviar PDF de laudo temporario.
- Confirmar `laudos_pdf.status = 'concluido'` ou, em falha controlada, `status = 'erro'` com `erro_ia`.
- Confirmar incremento de `profiles.ai_quota_used` apenas em processamento concluido.
- Confirmar limpeza dos dados temporarios e arquivos no bucket.

## Fallback humano

- Se OpenAI falhar, orientar usuario a repetir depois e manter o laudo com `status = 'erro'`.
- Se upload falhar antes do insert, nenhum registro deve ficar pendente.
- Se insert falhar depois do upload, o arquivo deve ser removido do bucket.
- Se a IA retornar JSON invalido, registrar erro interno e exibir mensagem generica ao usuario.

## Evidencias esperadas

- Logs da Edge Function sem stack trace sensivel em resposta publica.
- Resultado da bateria E2E anexado ao fechamento da sprint.
- Security Advisor sem novos avisos alem de limitacoes conhecidas do plano.
- Performance Advisor sem novos avisos em policies tocadas.
