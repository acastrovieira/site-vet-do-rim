# Vet do Rim Web

Aplicacao Next.js do site Vet do Rim e Lab Evolution.

## Setup Local

1. Instale dependencias:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env.local
```

3. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com valores reais do projeto Supabase.
   - Para projetos atuais, use a publishable key (`sb_publishable_*`) em `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Em projetos legacy, a `anon` key tambem funciona se ainda estiver ativa.

> Login, cadastro, recuperacao de senha e area `/lab` nao funcionam com host dummy de Supabase.

Para rodar E2E remoto que cria usuarios/dados temporarios, tambem defina localmente:

```bash
SUPABASE_PROJECT_REF=ycclyzoslirpnnwgzrqx
SUPABASE_SERVICE_ROLE_KEY=...
```

Use uma secret key atual (`sb_secret_*`) ou uma `service_role` legacy ainda ativa em `SUPABASE_SERVICE_ROLE_KEY`.
Essa chave nunca deve ser exposta em `NEXT_PUBLIC_*`.

4. Rode o servidor:

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Comandos de Qualidade

```bash
npm run lint
npm run typecheck
npm run build
npm run check:predeploy
npm run check:remote-readiness
npm run test:e2e
npm run test:e2e:auth-rls
npm run test:e2e:lab-crud
npm run test:e2e:upload-ia
```

Limpeza manual segura de residuos E2E, sempre primeiro em dry-run:

```bash
npm run cleanup:e2e:lab-crud
npm run cleanup:e2e:upload-ia
```

Para aplicar limpeza real apos um teste interrompido:

```bash
E2E_CLEANUP_RUN_ID=labcrud-YYYYMMDDHHMMSS npm run cleanup:e2e:lab-crud -- --apply
E2E_CLEANUP_RUN_ID=uploadia-YYYYMMDDHHMMSS npm run cleanup:e2e:upload-ia -- --apply
```

## Supabase

Secrets de backend devem ficar no Dashboard/Edge Functions do Supabase, nao no cliente Next:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

Migrations ficam em `../supabase/migrations`. Aplique primeiro em staging antes de producao, especialmente migrations de RLS.

## Rotas Criticas

- Publicas: `/`, `/blog`, `/ferramentas`, `/auth/login`, `/auth/cadastro`
- Protegidas: `/lab`, `/lab/pacientes`, `/lab/tutores`, `/lab/perfil`
- Tutor: `/portal`
- Operacional: `/api/health`

## Observabilidade Basica

- `/api/health` retorna estado do app Next.js e presenca das variaveis publicas obrigatorias, sem expor segredos.
- Edge Function `parse-laudo` registra falhas no log do Supabase e persiste `status = 'erro'` com `erro_ia` em `laudos_pdf`.
- Erros globais do App Router passam por `web/src/app/error.tsx`, sem exibir stack trace em producao.
- Antes de deploy, rode a bateria de qualidade e confira logs da Edge Function apos um upload real.

## Observacoes

- O app usa `@supabase/ssr` para cookies/sessao.
- `/lab` exige perfil `vet` ou `admin`.
- `/portal` e o destino seguro para usuarios `tutor`.
