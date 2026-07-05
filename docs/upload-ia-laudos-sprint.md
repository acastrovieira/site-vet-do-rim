# Sprint Upload/IA de Laudos

## Status

Parcialmente concluida em ambiente local. A aplicacao remota no Supabase ainda exige pre-requisitos externos e confirmacao explicita.

Runbook operacional: `docs/upload-ia-laudos-runbook.md`.

## Correcoes aplicadas

- `parse-laudo` passou a enviar PDF para a OpenAI pela Responses API usando `input_file`, em vez de tratar PDF como `image_url`.
- Conversao PDF -> base64 agora usa chunks para evitar estouro de stack em PDFs maiores.
- Falhas da Edge Function agora persistem `status = 'erro'` e `erro_ia` em `laudos_pdf`.
- Respostas de erro da Edge Function foram padronizadas e nao expõem detalhes internos ao usuario final.
- Registro de laudo agora volta para estado rastreavel quando download, OpenAI ou persistencia do resultado falham.
- Cota de IA ganhou migration local para RPC atomica `public.increment_ai_quota(uuid)`.
- Fallback de cota na Edge Function agora so roda se a RPC falhar.
- Upload no front-end remove o PDF do bucket `laudos` se o insert em `laudos_pdf` falhar.
- Nome de arquivo enviado ao Storage agora passa por sanitizacao.
- Troca de PDF no componente revoga a blob URL anterior para evitar vazamento de memoria.
- Chamada da Edge Function valida sessao antes de enviar e propaga mensagem de erro retornada pela funcao.
- Adicionado `test:e2e:upload-ia` para criar usuario/paciente temporarios, fazer upload real de PDF, invocar `parse-laudo` e limpar dados ao final.
- Adicionado `cleanup:e2e:upload-ia` em modo dry-run por padrao para limpar residuos de execucoes interrompidas.

## Validacoes executadas

- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm run build`: passou.
- `npx playwright test tests/e2e/upload-ia.spec.ts` sem credenciais reais: passou como `1 skipped`, confirmando compilacao do spec sem tocar no banco.
- `npm run check:predeploy`: passou novamente em 2026-06-28, incluindo `upload-ia.spec.ts` como skipped sem credenciais reais.
- `npm run check:remote-readiness`: `readiness.labCrud=true` e `readiness.uploadIa=false`; chaves publica e administrativa aceitas, com bloqueios restantes em Deno, `SUPABASE_DB_PASSWORD` e `OPENAI_API_KEY`.

## Validacoes pendentes

- `deno check supabase/functions/parse-laudo/index.ts`: pendente porque `deno` nao esta acessivel nesta sessao.
- `supabase db push --dry-run`: pendente porque `SUPABASE_DB_PASSWORD` ainda nao esta configurado para a CLI Postgres.
- Cadastrar secret remoto `OPENAI_API_KEY` para a Edge Function, sem expor o valor em chat ou logs.
- Aplicar migration `20260626010000_ai_quota_rpc_and_parse_laudo_hardening.sql` no projeto `ycclyzoslirpnnwgzrqx`.
- Deploy da Edge Function `parse-laudo`.
- `npm run test:e2e:upload-ia` com usuario vet temporario, pet temporario, upload de PDF, Edge Function e limpeza final.
- Se houver interrupcao forte, rodar `E2E_CLEANUP_RUN_ID=<runId> npm run cleanup:e2e:upload-ia -- --apply`.

## Riscos remanescentes

- Confirmar em ambiente real se o modelo configurado em `OPENAI_MODEL` aceita `input_file` com PDF e Structured Outputs.
- Confirmar se a chave `OPENAI_API_KEY` esta definida nos secrets da Edge Function.
- Confirmar se o bucket correto em producao continua sendo `laudos`.
- O runbook registra que o planejamento antigo citava `laudos-pdf`, mas o codigo atual usa `laudos`.
- Confirmar se o fluxo de quota deve cobrar apenas em processamento concluido, como esta agora, ou tambem em tentativa iniciada.
