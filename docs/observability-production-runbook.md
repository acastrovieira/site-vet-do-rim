# Runbook: Observabilidade e Producao

> **RUNBOOK COMPLEMENTAR, NAO APROVACAO:** observabilidade nao compensa os bloqueios de tenancy, transacao de IA e validacao clinica. O estado vigente e **NO-GO**; consulte `docs/README.md`.

## Objetivo

Validar readiness de producao do site Vet do Rim e do Lab Evolution, cobrindo health checks, logs, estados de erro, fallback humano, Supabase Advisors, Edge Function `parse-laudo` e evidencias pos-deploy.

## Entrada

- `npm run check:predeploy` passando.
- `npm run vercel-build` passando na raiz.
- Sprint Lab CRUD real executada com limpeza final.
- Sprint Upload/IA executada ou, se ainda pendente, suas acoes remotas explicitamente registradas como pendentes.

## Pre-deploy local

Na raiz:

```powershell
Set-Location (git rev-parse --show-toplevel)
npm run vercel-build
```

No app web:

```powershell
Set-Location (Join-Path (git rev-parse --show-toplevel) "web")
npm run check:predeploy
npm run check:remote-readiness
```

Sem argumentos, `check:remote-readiness` executa somente verificacoes locais e informa
`networkConsulted: false`. A consulta externa read-only exige autorizacao consciente:

```powershell
npm run check:remote-readiness -- --remote
```

Mesmo no modo remoto, o script nao altera banco, secrets ou deploys. Ele nao deve
imprimir valores de secrets, project ref, URLs completas ou caminhos absolutos.

## Health check

Liveness (processo Next.js respondendo):

```text
/api/health
```

Resposta esperada em producao:

```json
{
  "ok": true,
  "status": "alive",
  "service": "vetdorim-web",
  "timestamp": "ISO-8601",
  "checks": {
    "runtime": true
  }
}
```

Status esperado: `200`. Este endpoint nao consulta Supabase e nao declara que as
dependencias estao prontas.

Readiness local (contrato das configuracoes obrigatorias, sem rede):

```text
/api/health/readiness
```

Status esperado:

- `200` quando envs publicas obrigatorias estiverem configuradas.
- `503` quando faltar env publica obrigatoria.

Ambos devem retornar `Cache-Control` com `no-store`. O cron
`/api/cron/keep-alive` e o unico destes endpoints que consulta dependencias; ele
exige `CRON_SECRET` com no minimo 32 caracteres, aplica timeout de 1-10 segundos
por dependencia e aceita `VPS_HEALTH_URL` apenas em HTTPS.

Nunca deve conter:

- `SUPABASE_SERVICE_ROLE_KEY`;
- `OPENAI_API_KEY`;
- tokens;
- valores completos de secrets.

## Supabase Advisors

Apos migrations remotas:

```powershell
supabase db lint --linked --schema public,storage --fail-on warning
supabase db advisors --linked --type security
supabase db advisors --linked --type performance
```

Evidencia esperada:

- sem novos avisos de RLS/policies nas tabelas tocadas;
- sem novos avisos de performance nas policies consolidadas;
- warning conhecido de leaked password protection pode permanecer em plano Free.

## Logs da Edge Function

Funcao:

```text
parse-laudo
```

Verificar no Dashboard Supabase ou CLI:

- chamadas `POST` autenticadas;
- erros com prefixo `[parse-laudo]`;
- fallback de quota com prefixo `[parse-laudo quota fallback]`;
- ausencia de secrets nos logs;
- ausencia de stack trace exibido na resposta publica.

## Estados esperados de laudo

Tabela:

```text
public.laudos_pdf
```

Estados esperados:

- `processando`: apos inicio da Edge Function;
- `concluido`: quando IA retorna JSON valido e resultado e salvo;
- `erro`: quando download, OpenAI, JSON ou persistencia falham.

Campos de auditoria:

- `resultado_ia`: preenchido apenas em sucesso;
- `erro_ia`: preenchido em falha controlada, limitado a mensagem interna rastreavel;
- `storage_path`: mantido quando a remocao de Storage falha, para rastreabilidade.

## Fallback humano

Quando Upload/IA falhar:

- usuario deve ver mensagem generica e acionavel;
- laudo deve ficar rastreavel como `status = 'erro'`;
- time operacional deve consultar logs da Edge Function;
- se a falha for configuracao (`OPENAI_API_KEY`, secret ou modelo), corrigir config antes de retestar;
- se a falha for PDF invalido/ilegivel, orientar novo upload;
- se a falha for quota, orientar upgrade/liberacao conforme regra comercial.

## Analytics e privacidade

PostHog e opcional e inicializa somente com `NEXT_PUBLIC_POSTHOG_KEY`.

Validar:

- nenhuma chave privada em `NEXT_PUBLIC_*`;
- eventos de ferramenta nao carregam dados clinicos sensiveis identificaveis;
- politica de privacidade continua refletindo analytics ativo.

## Evidencias pos-deploy

Guardar no fechamento:

- resultado de `npm run vercel-build`;
- resultado de `npm run check:predeploy`;
- resultado de `npm run check:remote-readiness`;
- resposta de `/api/health` sem secrets;
- advisors Supabase;
- log resumido da Edge Function apos upload real;
- resultado dos E2E remotos executados;
- confirmacao de limpeza dos usuarios/dados temporarios.

## Criterio de saida

A Sprint Observabilidade e Producao so fica concluida quando:

- `/api/health` responde corretamente no ambiente publicado;
- advisors foram revisados apos migrations;
- logs e estados de erro da Edge Function foram validados com upload real;
- fallback humano esta documentado;
- evidencias foram anexadas ao fechamento da sprint.
