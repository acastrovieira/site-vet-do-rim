# Plano Mestre de Execucao das Sprints

## Objetivo

Coordenar a execucao das sprints Lab CRUD real, Upload/IA, Mobile/UX e Observabilidade/Producao com criterios claros de entrada, saida, evidencias e confirmacoes exigidas.

## Ordem recomendada

1. Sprint Lab Evolution CRUD real.
2. Sprint Upload/IA de laudos.
3. Sprint Mobile/UX refinada.
4. Sprint Observabilidade e producao.

A Sprint Lab CRUD real continua sendo o gate principal, porque valida Auth/RLS, usuario vet real temporario e o nucleo operacional antes de tocar em IA, Storage e Edge Function.

## Sprint 1: Lab Evolution CRUD real

Runbook: `docs/lab-crud-real-runbook.md`.

Status atual:

- preparado localmente;
- execucao remota pendente de confirmacao explicita.

Entrada:

- envs reais carregadas no shell ou em `web/.env.local`;
- `SUPABASE_SERVICE_ROLE_KEY` disponivel somente localmente/CI;
- `npm run check:remote-readiness` aprovado ou pendencias compreendidas;
- confirmacao explicita registrada.

Confirmacao exigida:

```text
Confirmo executar test:e2e:lab-crud com usuário vet temporário e limpeza final no projeto ycclyzoslirpnnwgzrqx
```

Comando:

```powershell
cd "C:\Users\acast\PROJETOS\SITE VET DO RIM\site-vet-do-rim\web"
npm run test:e2e:lab-crud
```

Saida esperada:

- usuario vet temporario criado e deletado;
- tutor temporario criado/listado/editado e removido;
- paciente temporario criado/listado/editado e removido;
- fluxo de laudos validado ate PDF;
- sem residuos `labcrud-*`.

## Sprint 2: Upload/IA de laudos

Runbook: `docs/upload-ia-laudos-runbook.md`.

Status atual:

- preparado localmente;
- migration, deploy de Edge Function e E2E real pendentes.

Entrada:

- Sprint Lab CRUD real aprovada;
- Supabase CLI e Deno disponiveis;
- secrets da Edge Function confirmados sem expor valores;
- `supabase db push --dry-run` revisado;
- confirmacao explicita registrada.

Confirmacao exigida:

```text
Confirmo aplicar Upload/IA de laudos no projeto ycclyzoslirpnnwgzrqx com migration, deploy da Edge Function, teste temporário e limpeza final
```

Comandos principais:

```powershell
cd "C:\Users\acast\PROJETOS\SITE VET DO RIM\site-vet-do-rim"
supabase db push --dry-run
supabase db push
supabase functions deploy parse-laudo

cd "C:\Users\acast\PROJETOS\SITE VET DO RIM\site-vet-do-rim\web"
npm run test:e2e:upload-ia
```

Saida esperada:

- migration `20260626010000_ai_quota_rpc_and_parse_laudo_hardening.sql` aplicada;
- Edge Function `parse-laudo` deployada;
- PDF enviado ao bucket `laudos`;
- `laudos_pdf` chega a `concluido` ou falha controlada investigada;
- cota incrementa apenas em sucesso;
- sem residuos `uploadia-*`.

## Sprint 3: Mobile/UX refinada

Runbook: `docs/mobile-ux-runbook.md`.

Status atual:

- concluida localmente para fluxos cobertos por Playwright;
- QA visual real pendente.

Entrada:

- `npm run check:predeploy` aprovado;
- ambiente publicado ou local acessivel em dispositivo real;
- Sprint Lab CRUD real aprovada para rotas autenticadas.

Saida esperada:

- menu mobile, formularios, modais, tabelas e Lab autenticado inspecionados;
- screenshots coletadas;
- problemas P0/P1 corrigidos;
- pendencias menores documentadas.

## Sprint 4: Observabilidade e producao

Runbook: `docs/observability-production-runbook.md`.

Status atual:

- preparado localmente;
- validacao remota pendente.

Entrada:

- `npm run vercel-build` aprovado na raiz;
- `npm run check:predeploy` aprovado;
- migrations/advisors remotos executados quando aplicavel;
- ambiente publicado acessivel.

Saida esperada:

- `/api/health` retorna `200` em producao;
- advisors Supabase revisados;
- logs da Edge Function revisados apos upload real;
- fallback humano documentado e testado por falha controlada quando possivel;
- evidencias anexadas ao fechamento.

## Comandos seguros sem confirmacao remota

```powershell
cd "C:\Users\acast\PROJETOS\SITE VET DO RIM\site-vet-do-rim"
npm run vercel-build

cd "C:\Users\acast\PROJETOS\SITE VET DO RIM\site-vet-do-rim\web"
npm run check:predeploy
npm run check:remote-readiness
```

Esses comandos nao criam usuarios, nao aplicam migrations e nao fazem deploy remoto.

## Acoes que exigem confirmacao explicita

- criar/deletar usuarios temporarios no Supabase;
- alterar `public.profiles.role`;
- rodar `npm run test:e2e:lab-crud`;
- rodar `npm run test:e2e:auth-rls`;
- rodar `npm run test:e2e:upload-ia`;
- rodar `supabase db push`;
- deployar `parse-laudo`;
- executar cleanup real com `--apply`.

## Status de bloqueio atual

Na sessao Codex atual:

- `supabase` nao esta no PATH;
- `deno` nao esta no PATH;
- `NEXT_PUBLIC_SUPABASE_URL` nao esta carregada;
- `SUPABASE_SERVICE_ROLE_KEY` nao esta carregada.

Use o terminal do usuario onde `supabase login` e `supabase link --project-ref ycclyzoslirpnnwgzrqx` ja funcionaram, ou ajuste PATH/envs antes da execucao remota.

