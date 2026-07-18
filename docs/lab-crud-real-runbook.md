# Runbook: Sprint Lab CRUD Real

> **RUNBOOK LEGADO EM REVISAO:** o RLS atual nao comprova isolamento entre clinicas. Nao executar contra producao; use somente homologacao isolada com o gate de `docs/README.md`.

## Objetivo

Executar a validacao real de Lab Evolution CRUD em um projeto Supabase de staging explicitamente confirmado, criando um usuario vet temporario, validando tutor/paciente/laudos e removendo todos os dados temporarios ao final.

## Confirmacao exigida

Antes de rodar comandos que criam ou deletam dados reais, registrar confirmacao explicita:

```text
Confirmo executar test:e2e:lab-crud com usuário vet temporário e limpeza final no projeto <staging-project-ref>
```

## Pre-checagem segura

Rodar no terminal em que Supabase CLI e envs reais estejam disponiveis:

```powershell
Set-Location (Join-Path (git rev-parse --show-toplevel) "web")
npm run check:remote-readiness
```

Resultado esperado:

- `Supabase CLI no PATH`: `ok: true`.
- `NEXT_PUBLIC_SUPABASE_URL definido`: `ok: true`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY definido`: `ok: true`.
- `SUPABASE_SERVICE_ROLE_KEY definido`: `ok: true`.
- Migration, Edge Function e `supabase/config.toml`: `ok: true`.

Observacao: `Deno no PATH` e obrigatorio para validacao/deploy de Edge Function na Sprint Upload/IA. Para Lab CRUD, o teste pode rodar sem deploy de Edge Function, mas o readiness ainda aponta essa pendencia para a proxima sprint.

## Variaveis necessarias

Podem estar no shell ou em `web/.env.local`.

```powershell
SUPABASE_PROJECT_REF=<staging-project-ref>
NEXT_PUBLIC_SUPABASE_URL=https://<staging-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key ou anon key legacy ativa>
SUPABASE_SERVICE_ROLE_KEY=<secret key ou service_role legacy ativa>
```

Nunca commitar `SUPABASE_SERVICE_ROLE_KEY` e nunca colocar essa chave em `NEXT_PUBLIC_*`.

No Dashboard Supabase, as chaves atuais ficam em `Settings > API Keys`.
Use a Publishable key para o cliente e a Secret key para scripts/backend. Se estiver usando a aba Legacy API Keys, confirme que `anon` e `service_role` ainda estao ativas.

## Execucao

```powershell
npm run test:e2e:lab-crud
```

O script deve:

- criar usuario temporario `e2e-vet-labcrud-*`;
- ajustar `public.profiles.role = 'vet'`;
- escrever env publico temporario para o Playwright;
- limpar cache `.next`;
- executar `tests/e2e/lab-crud.spec.ts`;
- criar/listar/editar tutor;
- criar/listar/editar paciente;
- validar fluxo de laudos ate rejeicao de nao-PDF e aceite de PDF;
- remover dados temporarios;
- deletar usuario temporario;
- restaurar `.env.local`;
- limpar `.next`.

## Evidencia esperada

Ao final:

- Playwright sem falhas no spec `lab-crud.spec.ts`;
- usuario `e2e-vet-labcrud-*` deletado;
- tutor `Tutor E2E CRUD labcrud-*` removido;
- paciente `Paciente E2E CRUD labcrud-*` removido;
- sem residuos em `laudos_pdf` ou Storage para esse `runId`.

## Cleanup manual em caso de interrupcao

Primeiro rode dry-run:

```powershell
$env:E2E_CLEANUP_RUN_ID="labcrud-YYYYMMDDHHMMSS"
npm run cleanup:e2e:lab-crud
```

Se o dry-run listar apenas residuos daquele teste temporario, aplicar:

```powershell
$env:E2E_CLEANUP_RUN_ID="labcrud-YYYYMMDDHHMMSS"
npm run cleanup:e2e:lab-crud -- --apply
```

Sem `E2E_CLEANUP_RUN_ID`, o cleanup real e recusado.

## Criterio de saida

A Sprint Lab CRUD real so fica concluida quando houver evidencia de:

- teste remoto executado;
- dados temporarios limpos;
- usuario temporario removido;
- nenhum erro de RLS/Auth no fluxo validado.
