# Runbook: Sprint Upload/IA de Laudos

## Objetivo

Aplicar e validar em ambiente Supabase real o fluxo de upload de PDF, processamento pela Edge Function `parse-laudo`, persistencia do resultado de IA, controle de cota e limpeza final dos dados temporarios.

Projeto alvo: `ycclyzoslirpnnwgzrqx`.

## Dependencia

Executar somente depois da Sprint Lab CRUD real passar com usuario vet temporario e limpeza final.

## Confirmacao exigida

Antes de aplicar migration, deployar Edge Function ou criar dados temporarios, registrar confirmacao explicita:

```text
Confirmo aplicar Upload/IA de laudos no projeto ycclyzoslirpnnwgzrqx com migration, deploy da Edge Function, teste temporário e limpeza final
```

## Pre-checagem segura

Rodar no terminal com Supabase CLI, Deno e envs reais:

```powershell
cd "C:\Users\acast\PROJETOS\SITE VET DO RIM\site-vet-do-rim\web"
npm run check:remote-readiness
```

Resultado esperado:

- Supabase CLI no PATH: `ok: true`.
- Deno no PATH: `ok: true`.
- `SUPABASE_DB_PASSWORD`: `ok: true`.
- `NEXT_PUBLIC_SUPABASE_URL`: `ok: true`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `ok: true`.
- `SUPABASE_SERVICE_ROLE_KEY`: `ok: true`.
- Migration de quota atomica existe: `ok: true`.
- Edge Function `parse-laudo` existe: `ok: true`.
- `supabase/config.toml` existe: `ok: true`.
- `readiness.uploadIa`: `true`.

Se `readiness.labCrud` for `true` e `readiness.uploadIa` for `false`, normalmente ainda falta `Deno` e/ou `SUPABASE_DB_PASSWORD`.

Status observado em 2026-06-28:

- Supabase CLI: disponivel.
- Chaves publica e administrativa: aceitas pelo Supabase.
- `readiness.labCrud`: `true`.
- `readiness.uploadIa`: `false`.
- Pendencias atuais: Deno no PATH, `SUPABASE_DB_PASSWORD` e secret remoto `OPENAI_API_KEY`.

## Pre-requisitos externos atuais

Configurar sem expor valores no chat, prints ou logs:

```powershell
$env:SUPABASE_DB_PASSWORD="COLE_A_SENHA_DO_BANCO_APENAS_NO_TERMINAL"
```

Para a Edge Function, cadastrar o segredo pela Dashboard ou CLI. Pela CLI, use placeholder localmente e nao compartilhe o valor:

```powershell
supabase secrets set OPENAI_API_KEY="COLE_A_CHAVE_APENAS_NO_TERMINAL"
```

`OPENAI_MODEL` e opcional. Se nao for definido, a funcao usa o modelo padrao configurado no codigo.

Para validar a Edge Function localmente, Deno precisa estar instalado e acessivel no PATH:

```powershell
deno --version
```

## Conferencias antes da aplicacao

Na raiz do projeto:

```powershell
cd "C:\Users\acast\PROJETOS\SITE VET DO RIM\site-vet-do-rim"
supabase migration list
supabase db push --dry-run
supabase db lint --linked --schema public,storage --fail-on warning
```

Revisar se a migration pendente esperada inclui:

```text
20260626010000_ai_quota_rpc_and_parse_laudo_hardening.sql
```

## Migration remota

Somente apos confirmacao explicita:

```powershell
supabase db push
```

Depois:

```powershell
supabase db advisors --linked --type security
supabase db advisors --linked --type performance
```

Aviso conhecido: protecao contra senhas vazadas pode seguir como warning no plano Free.

## Secrets da Edge Function

Confirmar no Dashboard ou CLI, sem imprimir valores em chat/log:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
OPENAI_MODEL opcional
```

## Validacao local da Edge Function

Se `deno` estiver disponivel:

```powershell
deno check supabase/functions/parse-laudo/index.ts
```

## Deploy da Edge Function

Na raiz do projeto:

```powershell
supabase functions deploy parse-laudo
```

## Bucket usado

O fluxo atual usa o bucket:

```text
laudos
```

Observacao: planejamentos antigos citavam `laudos-pdf`, mas o codigo atual, scripts E2E e cleanup usam `laudos`. Antes de alterar isso, revisar migrations, policies, `LaudoUploader` e `parse-laudo`.

## Teste E2E real

No diretorio `web`:

```powershell
cd "C:\Users\acast\PROJETOS\SITE VET DO RIM\site-vet-do-rim\web"
npm run test:e2e:upload-ia
```

O script deve:

- criar usuario temporario `e2e-vet-uploadia-*`;
- criar tutor temporario;
- criar paciente temporario;
- fazer upload de PDF temporario;
- inserir linha em `laudos_pdf`;
- chamar `parse-laudo`;
- validar retorno estruturado;
- limpar Storage, `laudos_pdf`, paciente, tutor e usuario temporario;
- restaurar `.env.local`;
- limpar `.next`.

## Evidencia esperada

Ao final:

- Playwright sem falhas no spec `upload-ia.spec.ts`;
- `laudos_pdf.status = 'concluido'` durante o teste ou `status = 'erro'` apenas em falha controlada investigada;
- `profiles.ai_quota_used` incrementado apenas se processamento concluir;
- nenhum dado temporario `uploadia-*` restante;
- nenhum arquivo temporario restante no bucket `laudos`;
- logs da Edge Function sem stack trace exposto ao usuario final.

## Cleanup manual em caso de interrupcao

Primeiro rode dry-run:

```powershell
$env:E2E_CLEANUP_RUN_ID="uploadia-YYYYMMDDHHMMSS"
npm run cleanup:e2e:upload-ia
```

Se listar apenas residuos daquele teste temporario:

```powershell
$env:E2E_CLEANUP_RUN_ID="uploadia-YYYYMMDDHHMMSS"
npm run cleanup:e2e:upload-ia -- --apply
```

Sem `E2E_CLEANUP_RUN_ID`, o cleanup real e recusado.

## Criterio de saida

A Sprint Upload/IA so fica concluida quando houver evidencia de:

- migration aplicada no projeto correto;
- Edge Function deployada;
- teste E2E real executado;
- upload, processamento, cota e limpeza final verificados;
- advisors revisados apos a alteracao remota.
