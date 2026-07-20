# Runbook — Primeira execução remota do CI (Fase 0)

Público-alvo: Dr. Anderson (sem experiência em CI/CD). Este documento explica, passo a passo,
como disparar a primeira execução dos workflows do GitHub Actions no repositório
`acastrovieira/site-vet-do-rim`, o que configurar em Settings > Branches, e os problemas
encontrados na auditoria dos arquivos YAML antes dessa primeira execução.

Agente responsável pela auditoria: DEVOPS (squad AIOX). Data: 2026-07-18.
Análise feita 100% localmente (sem acesso de rede ao GitHub/Supabase no sandbox de auditoria).

---

## 1. Visão geral: o que existe hoje

O repositório tem dois workflows em `.github/workflows/`:

| Arquivo | Nome do workflow | O que faz |
|---|---|---|
| `ci.yml` | CI - Vet do Rim | 3 jobs: `Quality Gates` (lint/typecheck/testes/build/SBOM/auditoria de dependências), `Database Contract` (sobe Postgres local via Supabase CLI, roda migrations, testes de banco, advisors de segurança/performance), `Edge Runtime Contract` (valida e empacota a Edge Function `parse-laudo` em runtime Deno isolado) |
| `node.js.yml` | Public UI tests | 2 jobs: `build` (build de produção + Playwright em fluxos públicos não-destrutivos) e `cross-browser-smoke` (smoke test em Chromium/Firefox/WebKit) |

**Nenhum dos dois workflows depende hoje de segredos do Supabase remoto ou de produção.**
Todos os jobs rodam contra: (a) um Supabase local descartável, subido pela própria Supabase CLI
dentro do runner, ou (b) valores de placeholder para build do Next.js
(`NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co`). Isso é proposital: o CI de Fase 0
não toca no projeto Supabase de produção nem precisa de credenciais reais.

**`node.js.yml` NÃO é o template default do GitHub.** Foi verificado o conteúdo por completo:
é um workflow customizado ("Public UI tests"), com comentário próprio explicando o escopo
("fluxos públicos, não-mutantes"), matriz de navegadores e suítes Playwright reais do projeto.
Não deve ser removido — ele cobre uma responsabilidade que `ci.yml` não cobre (testes E2E
cross-browser). Os dois workflows são complementares, não duplicados.

---

## 2. Problema crítico encontrado — BLOQUEIA a primeira execução

### Deno lock ausente da Edge Function `parse-laudo`

**O que é:** dois passos do CI (`Verify Edge Function dependency pins` no job `Quality Gates`
e `Verify every Edge Function contract` no job `Edge Runtime Contract`) exigem o arquivo
`supabase/functions/parse-laudo/deno.lock`. Esse arquivo **não existe no repositório** — nem
localmente, nem versionado no Git.

**Causa raiz confirmada:** a linha 52 do `.gitignore` tem a regra `**/deno.lock`, que exclui
qualquer arquivo `deno.lock` do controle de versão em qualquer pasta do projeto.

**Evidência (reproduzido localmente):**
```
node scripts/verify-edge-functions.mjs
Error: supabase/functions/parse-laudo/deno.lock is not valid UTF-8 JSON:
ENOENT: no such file or directory
```

**Impacto:** com o estado atual, a primeira execução do CI no GitHub **vai falhar** em dois
pontos: no job `Quality Gates` (passo "Verify Edge Function dependency pins") e no job
`Edge Runtime Contract` (passos "Verify every Edge Function contract" e o `deno check
--frozen --lock=deno.lock`). Isso derruba o CI inteiro antes mesmo de chegar aos testes.

**Por que eu não corrigi isso sozinho:** gerar um `deno.lock` correto exige rodar o Deno
localmente (`deno cache` ou equivalente) para resolver e travar as dependências reais da
função `parse-laudo`. O ambiente desta auditoria não tem Deno instalado nem acesso de rede
para baixar dependências — gerar esse arquivo às cegas seria arriscado (poderia travar
versões erradas). Isso precisa ser feito por alguém com Deno instalado localmente.

**Ação necessária antes do primeiro push que dispare o CI (fazer na máquina do
desenvolvedor, não neste ambiente de auditoria):**

1. Remover a linha `**/deno.lock` do `.gitignore` (ou trocar por uma exceção específica,
   por exemplo permitir só o lock da função e ignorar outros, se houver motivo para isso).
2. Gerar o lock real da função, dentro de `supabase/functions/parse-laudo/`:
   ```
   deno cache --lock=deno.lock index.ts
   ```
   (No Deno 2 — que é a versão fixada em `config.toml`, `deno_version = 2` — o lockfile é
   escrito/atualizado automaticamente; a flag `--lock-write` foi **removida** no Deno 2 e não
   deve ser usada. `deno install --entrypoint index.ts` também gera o lock. Qualquer
   engenheiro com Supabase CLI/Deno instalados roda isso em segundos.)
3. Confirmar que o arquivo gerado é JSON válido, versão `4` (é o que
   `verify-edge-functions.mjs` exige — ele rejeita explicitamente qualquer `"version"`
   diferente de `"4"`), e commitar `supabase/functions/parse-laudo/deno.lock` junto com o
   ajuste do `.gitignore`. **Atenção:** versões mais novas do Deno 2.x geram lockfile
   `"version": "5"`, que o script vai reprovar. Se isso acontecer, use uma versão do Deno que
   emita o lock v4 (a mesma da imagem `denoland/deno` fixada no CI) ou atualize
   `verify-edge-functions.mjs` para aceitar v5 — decisão do time de banco/DevOps, não faça às
   cegas.
4. Rodar `node web/scripts/verify-edge-functions.mjs` localmente antes do push — deve
   terminar com `Edge Function configuration PASS.`

Sem esse passo, **não adianta disparar o CI** — ele vai falhar de forma previsível e
determinística nos dois jobs citados.

---

## 3. Outros pontos verificados (sem problema, ou risco baixo)

- **Versão do Node:** `web/package.json` exige `"node": ">=22.18.0"`. Os dois workflows usam
  `actions/setup-node` com `node-version: '22.18.0'` — compatível, sem mismatch.
- **Lockfiles:** todos os `package-lock.json` referenciados (`package-lock.json` raiz,
  `web/package-lock.json`, `.aiox-core/package-lock.json`,
  `.aiox-core/scripts/diagnostics/health-dashboard/package-lock.json`) existem e estão em
  `lockfileVersion: 3`, como os scripts de auditoria exigem.
- **Scripts chamados pelo CI existem:** `verify-supply-chain.mjs`,
  `verify-migration-integrity.mjs`, `verify-edge-functions.mjs` — todos presentes em
  `web/scripts/`. Rodei os dois primeiros localmente e ambos **passam** sem erro:
  ```
  Migration integrity PASS: 11 active file(s)...
  package-lock.json: 0 registry packages verified...
  web/package-lock.json: 635 registry packages verified...
  .aiox-core/package-lock.json: 127 registry packages verified...
  .aiox-core/scripts/diagnostics/health-dashboard/package-lock.json: 351 registry packages verified...
  ```
- **Migration integrity em push/PR "zerado":** a variável `MIGRATION_BASE_REF` usa
  `github.event.pull_request.base.sha || github.event.before`. Em um push muito antigo/primeiro
  push de uma branch nova, `github.event.before` pode vir como 40 zeros — o script já trata
  esse caso (`/^0+$/` vira "sem base ref", não falha). Testado localmente sem base ref: passa.
- **Actions pinadas por SHA:** `actions/checkout`, `actions/setup-node` e
  `supabase/setup-cli` estão fixadas por hash de commit com comentário da versão (boa prática
  de supply-chain). Não foi possível confirmar contra o GitHub (sandbox sem rede) que os
  hashes correspondem exatamente às tags comentadas — isso é normalmente automático e
  confiável quando mantido por Dependabot (ver seção 5), mas vale conferir visualmente na
  primeira execução se o log mostra a versão esperada (`v4.3.1`, `v4.4.0`, `v2.1.1`).
- **Imagens Docker fixadas por digest** (`denoland/deno@sha256:...` e
  `public.ecr.aws/supabase/edge-runtime@sha256:...`): mesma limitação de verificação offline;
  a auditoria de produção já registra que esse pipeline foi "aprovado no runtime local
  fixado", então o risco aqui é baixo.
- **`workflow_dispatch` ausente:** nenhum dos dois workflows tinha gatilho manual — só
  disparavam em `push`/`pull_request`. **Já corrigido nesta auditoria** (mudança aplicada e
  revalidada, ver seção 6): agora dá para disparar manualmente pela aba Actions, sem precisar
  fazer push.
- **Sem segredos hoje:** nenhum dos dois arquivos YAML referencia `secrets.*` — não há
  segredo nenhum a configurar para este CI funcionar (ver seção 4).

---

## 4. Segredos do repositório (Settings > Secrets and variables > Actions)

**Nenhum segredo é necessário para `ci.yml` e `node.js.yml` funcionarem hoje.** Os dois
workflows foram desenhados para não tocar em Supabase/produção real — usam Supabase local
efêmero (subido e destruído dentro do runner) e uma URL/chave de placeholder só para o
Next.js conseguir fazer build.

Isso é bom para a Fase 0: significa que o primeiro CI pode rodar com segurança, sem
nenhuma chave real no GitHub.

**Atenção para o futuro (fora do escopo desta Fase 0):** quando o time criar um workflow de
deploy real (para Vercel e/ou push de migrations para o Supabase remoto), ele vai
precisar de segredos como (apenas os NOMES, para reservar o espaço — nenhum valor deve ser
colocado aqui nem em nenhum arquivo do repositório):
- Um token de acesso à CLI do Supabase (para `supabase link`/`db push` remoto).
- A referência/ID do projeto Supabase de produção.
- A senha do banco de produção, se o deploy usar `supabase db push` direto.
- Token de deploy da Vercel (se o deploy for automatizado por Actions em vez do
  Vercel Git Integration nativo).

Esses NÃO precisam existir agora. Só documentar aqui para não esquecer quando a Fase de
deploy automatizado chegar.

---

## 5. Descoberta importante: Dependabot já está ativo

O repositório tem `.github/dependabot.yml` configurado e funcionando — existem branches
remotas de PRs abertas pelo Dependabot esperando merge:
- `dependabot/github_actions/actions/checkout-7.0.0`
- `dependabot/github_actions/actions/setup-node-7.0.0`
- `dependabot/github_actions/supabase/setup-cli-3.0.0`
- Várias atualizações de npm em `.aiox-core`, no dashboard de diagnóstico e em `web/`.

**Antes de tratar isso como "a primeira execução do CI", verifique na aba "Pull requests" e
na aba "Actions" do GitHub se essas PRs do Dependabot já dispararam alguma execução.** Como
essas PRs miram a branch `main` e o gatilho `pull_request` do `ci.yml` cobre `branches:
[main, develop]`, é possível que o CI já tenha rodado (com sucesso ou falha) nessas PRs antes
mesmo deste runbook. Se já rodou, os resultados reais de lá são mais confiáveis que qualquer
previsão feita aqui — vale conferir primeiro.

---

## 6. Passo a passo para o Dr. Anderson

### 6.1. Prepare o pré-requisito (bloqueador da seção 2)

Peça para alguém do squad técnico (ou você mesmo, se tiver Deno/Supabase CLI instalados):
1. Gerar o `supabase/functions/parse-laudo/deno.lock`.
2. Remover a linha `**/deno.lock` do `.gitignore`.
3. Commitar os dois arquivos junto.
4. Fazer push dessa correção para `main` (ou abrir PR).

**Não pule este passo** — sem ele, o CI vai falhar de forma garantida em dois jobs.

### 6.2. Dispare a primeira execução

Duas formas, à sua escolha:

**Opção A — Disparo manual (recomendado para o primeiro teste, mais controlado):**
1. Acesse `https://github.com/acastrovieira/site-vet-do-rim/actions`.
2. Na lista à esquerda, clique no workflow **"CI - Vet do Rim"**.
3. Clique no botão **"Run workflow"** (canto superior direito da lista de execuções).
4. Escolha a branch `main` e clique em **"Run workflow"** de novo para confirmar.
5. Repita os passos 2–4 para o workflow **"Public UI tests"**.

   *(Esse botão só aparece porque adicionamos o gatilho `workflow_dispatch` nos dois
   arquivos durante esta auditoria — antes ele não existia.)*

**Opção B — Push ou merge de PR:**
Qualquer push ou merge de Pull Request para `main` ou `develop` dispara os dois workflows
automaticamente — não precisa fazer nada extra além do fluxo normal de trabalho.

### 6.3. Acompanhe a execução

1. Na aba **Actions**, clique na execução que apareceu (fica com um círculo amarelo
   "em andamento", depois verde ✓ ou vermelho ✗).
2. Clique dentro dela para ver os jobs: `Quality Gates`, `Database Contract`,
   `Edge Runtime Contract` (do `ci.yml`) e `build`, `Smoke chromium-tablet-smoke`,
   `Smoke firefox-smoke`, `Smoke webkit-smoke` (do `node.js.yml`).
3. Se algum passo falhar, clique nele para expandir o log. Copie a mensagem de erro e
   encaminhe para o squad técnico — não tente "adivinhar" a correção sozinho.
4. Os jobs `Database Contract` e `Edge Runtime Contract` demoram mais (sobem containers
   Docker/Postgres) — é normal levar alguns minutos.

### 6.4. Depois do primeiro sucesso: configure os "required checks"

Só faça isto **depois** de ver pelo menos uma execução verde de ponta a ponta (senão você
vai travar todos os merges com um check que nunca passa).

1. Vá em `Settings` (do repositório) > `Branches`.
2. Em "Branch protection rules", edite (ou crie) a regra para a branch `main`.
3. Marque **"Require status checks to pass before merging"**.
4. Marque também **"Require branches to be up to date before merging"**.
5. Na caixa de busca dos checks, adicione (o nome exato como aparece depois de já ter
   rodado pelo menos uma vez):
   - `Quality Gates`
   - `Database Contract`
   - `Edge Runtime Contract`
   - `build`
   - `Smoke chromium-tablet-smoke`
   - `Smoke firefox-smoke`
   - `Smoke webkit-smoke`
6. Salve. A partir daqui, nenhum PR entra em `main` sem esses sete checks passarem.

   Dica: se a lista de checks demorar a aparecer na busca do GitHub, é porque ele só
   sugere checks que já rodaram pelo menos uma vez naquele repositório — é por isso que
   a ordem importa (primeiro rodar, depois proteger).

### 6.5. Repita para `develop`, se o time usar essa branch ativamente

Mesma coisa da seção 6.4, mas escolhendo a branch `develop` no passo 2.

---

## 7. Resumo executivo

| Item | Status |
|---|---|
| Sintaxe YAML dos dois workflows | Válida (validado com o parser `yaml` do Node) |
| `node.js.yml` é template legado sem valor? | Não — customizado, deve ser mantido |
| Bloqueador confirmado para a 1ª execução | `deno.lock` da função `parse-laudo` ausente + `.gitignore` excluindo `**/deno.lock` |
| Correção aplicada nesta auditoria | Adicionado `workflow_dispatch` em `ci.yml` e `node.js.yml` (revalidado, sem erro) |
| Correção pendente (ação humana) | Gerar `deno.lock` real e ajustar `.gitignore` (precisa de Deno instalado) |
| Segredos necessários hoje | Nenhum |
| Segredos previstos para depois (deploy) | Token de acesso Supabase, referência do projeto, senha do banco, token de deploy da Vercel — apenas nomes, sem valores aqui |
| Dependabot | Já ativo, com PRs abertas — conferir se já geraram execuções de CI antes de assumir "primeira vez" |
