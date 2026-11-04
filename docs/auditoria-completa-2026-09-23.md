# Auditoria integral — Vet do Rim

**Data:** 23/09/2026  
**Repositório:** `site-vet-do-rim`  
**Baseline auditada:** branch `main`, commit `17ea8dccc151432e6b6a5a05af74490406dab91b` (igual ao `main` no GitHub durante a auditoria).  
**Veredito:** **NO-GO para novo deploy e para uso clínico real até sanar os bloqueadores abaixo.** O site público responde, mas isso não prova segurança do otimizador de imagens nem estado atual do banco remoto.

## Notas de 0 a 100

| Área | Nota | Leitura |
|---|---:|---|
| Site institucional/educacional | **65/100** | Boa navegação, layout responsivo e cabeçalhos HTTP; perde pontos por conteúdo clínico público com limites IRIS invertidos, risco crítico na dependência Next.js e desalinhamento de domínio/sitemap. |
| Ferramentas do site | **62/100** | Os fluxos públicos mais importantes têm boa cobertura local e controles de segurança; parte do catálogo está deliberadamente indisponível, há duas rotas de estadiamento IRIS e o backend real não foi atestado. |
| Backend/Supabase — prontidão de produção | **40/100** | O código e a integridade local das migrations têm bons controles, mas o replay do banco falha no CI e não há prova read-only do estado remoto de RLS, grants, Storage ou funções. |

As notas são uma avaliação de engenharia e produto baseada nas evidências listadas; **não são certificação clínica, pentest externo nem aprovação do Supabase de produção**.

## O que foi inspecionado e executado

- Frontend Next.js, rotas públicas, páginas de ferramentas, metadados SEO e regras de segurança.
- Rotas API, Edge Function `parse-laudo`, configurações, testes e principais controles de autenticação/autorização.
- 27 migrations ativas, manifesto SHA-256, migrações de tenancy/RLS e testes SQL presentes no repositório.
- Site publicado: páginas públicas, ferramenta IRIS, diretório de ferramentas, sitemap/robots e cabeçalhos HTTP.
- `npm run check:predeploy`: **PASS** — lint/typecheck, build Next.js, integridade das migrations e Edge Function, **162/162 testes unitários/contratuais**, **76/80 E2E Chromium passaram**; 4 fluxos de autenticação foram ignorados por dependerem de credenciais/serviços remotos.
- `npm run audit:staging`: **PASS em modo plan-only**, sem rede, sem consulta ao Supabase.
- `npm run check:remote-readiness`: **NO-GO local**, sem `SUPABASE_PROJECT_REF`, senha de banco e chave administrativa para validar o ambiente remoto.
- `npm audit` em `web`: **8 avisos conhecidos — 1 crítico, 5 altos, 2 moderados**.
- Cross-browser local: **6/9 passaram** em Chromium tablet e WebKit; os 3 do Firefox não rodaram porque o executável Firefox esperado pelo Playwright não está instalado. Isso é uma limitação do ambiente, não evidência de falha funcional no app.

## Findings prioritários

### F-01 — P0 — Next.js afetado por RCE crítico com otimização AVIF

`web/package.json:49` fixa `next` em `16.2.11`; `web/next.config.ts:10–14` habilita explicitamente `image/avif`. O `npm audit` sinalizou Next.js como crítico e Sharp como alto. Os advisories descrevem RCE no otimizador Next quando AVIF é otimizado e, separadamente, RCE em servidor Windows para a faixa afetada.[4][5]

**Ação recomendada:** atualizar Next.js e `eslint-config-next` juntos para uma versão corrigida (o advisory informa `16.3.3` como corrigida; o audit local sugeriu `16.3.6`), atualizar Sharp para versão corrigida, resolver os demais advisories compatíveis e repetir `npm audit` + todos os quality gates. Não rodei `npm audit fix --force` nem fiz deploy: a atualização precisa ser revisada e testada antes de tocar produção.

### F-02 — P1 — Artigo público inverte os limites de creatinina entre cão e gato

A página ao vivo `/blog/estadiamento-iris-doenca-renal-cronica` diz estágio 1 `<1,6 mg/dL` para cães e `<1,4 mg/dL` para gatos; no estágio 2 repete a inversão.[1] O material oficial IRIS 2026 apresenta `<1,4` / `1,4–2,8` para cães e `<1,6` / `1,6–2,8` para gatos.[2][7] A página está publicada e listada no sitemap; portanto, usuários podem receber informação clínica contraditória à calculadora IRIS do próprio site.

**Ação recomendada:** pedir revisão de médico-veterinário responsável do artigo inteiro (incluindo UPC, SDMA e recomendações terapêuticas). Até a revisão, considerar retirar a página da navegação/sitemap ou marcá-la como não indexável. Não corrigi o conteúdo clínico por conta própria.

### F-03 — P1 — CI do `main` está vermelho; replay do banco falha

O workflow `CI - Vet do Rim` do commit auditado falhou nos jobs **Edge Runtime Contract**, **Quality Gates** e **Database Contract**.[3]

- O replay do Supabase falha ao chegar em `supabase/migrations/20260823000000_perf_001_missing_indexes.sql:49`: `CREATE INDEX CONCURRENTLY cannot be executed within a pipeline (SQLSTATE 25001)`. A checagem de hashes passa, mas isso **não** prova que as migrations conseguem ser reaplicadas.
- Os jobs de Edge/Quality não encontram `supabase/functions/parse-laudo/deno.lock`: no snapshot de `main` auditado, `.gitignore:52` ignorava `**/deno.lock`, então o lock local não estava no GitHub. A iteração local substituiu essa regra ampla por uma exceção específica.

**Iteração local aplicada:** removi a regra ampla e adicionei uma exceção específica para `supabase/functions/parse-laudo/deno.lock`. Agora o Git mostra o lock como arquivo não rastreado, e `node web/scripts/verify-edge-functions.mjs` e `node web/scripts/verify-supply-chain.mjs` passam localmente. **Nada foi staged, commitado, enviado ou publicado**; o CI remoto continua vermelho até alguém revisar e incluir essa mudança e o lock no Git.

**Ação recomendada para a migration:** resolver pelo processo append-only definido em `docs/architecture/ADR-002-migration-integrity-and-drift.md`, criar uma transição histórica explícita e testar o replay em banco local efêmero. Não aplicar `db push` na produção.

### F-04 — P1 — Estado real do Supabase não foi atestado

`supabase/migration-integrity.json` declara `remoteAttestation: false`. O manifesto verifica os 27 arquivos versionados, mas não prova igualdade com o banco hospedado. O audit de staging executado ficou em `plan-only` (`networkConsulted=false`); o verificador local não tinha alvo/ref e credenciais suficientes. Há registro no histórico de migrations sobre função ausente em produção em agosto, seguida de migration de remediação, mas não verifiquei o estado atual do remoto.

**Ação recomendada:** fazer primeiro uma auditoria **read-only** em staging isolado com project ref/URL coincidentes e evidência de policies, grants, funções, Storage e migrations; depois comparar produção somente com autorização explícita. Nenhuma consulta, migration ou mutação remota foi feita nesta auditoria.

### F-05 — P2 — Domínio canônico e sitemap apontam para hosts diferentes

O domínio sem `www` retorna `307` para `https://www.vetdorim.com.br/`, enquanto sitemap/robots publicados anunciam URLs `https://vetdorim.com.br`.[6][12][13] O código também usa o domínio apex como padrão para `NEXT_PUBLIC_SITE_URL`.

**Ação recomendada:** escolher um único host canônico (o `www` é o destino atual), configurar `NEXT_PUBLIC_SITE_URL`, canonical, sitemap e robots com o mesmo host e usar redirect permanente após revisar o domínio preferido.

### F-06 — P2 — Duas URLs públicas apresentam o mesmo estadiamento IRIS

`/ferramentas/calculadora-tfg` informa corretamente que não mede TFG; `/ferramentas/estadiamento-iris` também apresenta estadiamento IRIS 2026. As duas páginas têm canonical próprio e ambas constam no sitemap. Isso pode confundir usuários e dividir sinais de SEO.[8][10][11]

**Ação recomendada:** escolher uma rota principal e fazer a outra redirecionar para ela, ou diferenciar claramente finalidade e conteúdo. Também revisar se o slug `calculadora-tfg` é apropriado para uma página que diz não calcular TFG.

### F-07 — P2 — Catálogo seguro, mas com cobertura funcional reduzida

A página pública explica que ferramentas em revisão ficam indisponíveis — uma boa decisão de segurança clínica.[8] Os testes locais confirmam contenção de saídas não homologadas; dieta renal, fluidoterapia e reposição eletrolítica permanecem indisponíveis; a ferramenta de injúria renal aguda requer acesso profissional validado. Isso reduz a utilidade do catálogo até revisão clínica independente.

**Ação recomendada:** manter os bloqueios; para cada reativação, exigir responsável clínico, fonte/versão de diretriz, golden cases, revisão independente e regressões automatizadas.

### F-08 — P2 — Resultado de `npm audit` não é coberto pelo gate de predeploy

O gate local de produção passou, mas o `npm audit` encontrou 8 advisories. Outros pacotes citados incluem `adm-zip`, `sharp`, `browserslist`, `fflate` e `js-yaml`. `adm-zip` é usado no export XLSX para **criar** um ZIP (`web/src/app/api/lab/export/route.ts:417–429`); não encontrei nesse caminho uso de extração de ZIP não confiável, então a exploração específica desse advisory não está provada. Ainda assim, a dependência deve ser atualizada e o audit incorporado a um gate/revisão recorrente.

## Pontos positivos observados

- Página pública ao vivo responde em `www`; HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e Permissions-Policy estão configurados.[9]
- A suíte local verifica navegação por teclado, skip link, foco/tecla Escape no menu móvel, `prefers-reduced-motion`, overflow em telas pequenas, rotas públicas, metadados e comportamento fail-closed das ferramentas.
- A calculadora IRIS publicada informa que depende de diagnóstico de DRC e paciente estável/hidratado; não promete medir TFG.
- A lista pública exclui do sitemap as ferramentas em revisão clínica.
- O código da função de papel de clínica usa `SECURITY DEFINER` com `search_path = ''`, qualifica objetos por schema e confere membership/clinic ativos; as migrations habilitam `FORCE ROW LEVEL SECURITY` nas tabelas clínicas. Isso é evidência favorável **do código local**, não validação da configuração remota.
- A verificação de integridade local passou: 27 migrations ativas, hashes SHA-256 e 4 transições históricas declaradas.

## Squads/agentes e limites desta execução

Tentei delegar frentes independentes de Frontend/UX, Backend/Security, Supabase/Migrations e QA do site público. **Nenhum agente chegou a iniciar:** a delegação do perfil está configurada para `opencode-free`, provider removido/indisponível. Os CLIs `codex`, `claude` e `opencode` também não estão no PATH. Não vou trocar de provider nem consumir a cota Nous/Codex sem sua autorização; esta rodada foi uma auditoria conduzida diretamente, sem fingir revisão de squads.

O Browser Use local foi bloqueado pelo Controle de Aplicativos do Windows. Usei extração textual/HTTP do site ao vivo e Playwright no build local; não submeti formulários, não fiz login e não acessei dados clínicos. Os 4 testes de autenticação foram ignorados por dependerem de credenciais; o Supabase remoto não foi consultado.

## Plano de melhoria sugerido

1. **Urgente — segurança e conteúdo:** atualizar Next/Sharp e dependências vulneráveis; obter revisão veterinária do artigo IRIS e corrigir/retirar temporariamente a página publicada.
2. **Desbloquear CI:** revisar o diff local do `.gitignore` e do lock Deno, então, com sua aprovação, incluí-los em commit; ajustar o replay da migration concorrente com transição auditável e executar banco descartável + pgTAP.
3. **Validar Supabase sem risco:** configurar alvo de staging explícito e executar apenas o pack read-only; reconciliar RLS/grants/Storage antes de qualquer operação de escrita.
4. **SEO/UX:** unificar host canônico, consolidar as rotas IRIS duplicadas e revisar as datas/fontes dos artigos.
5. **Reabrir as ferramentas clínicas somente com governança:** fontes versionadas, casos de referência, revisão veterinária independente e monitoramento pós-release.

**Estado desta iteração:** ajuste local do `.gitignore` feito e verificado; nenhuma atualização de dependências, alteração de fórmulas clínicas, migration, commit, push ou deploy executados.

## Sources

[1] https://www.vetdorim.com.br/blog/estadiamento-iris-doenca-renal-cronica
    > "Creatinina: < 1,6 mg/dL (cães) / < 1,4 mg/dL (gatos)"
[2] https://www.iris-kidney.com/s/IRIS_staging_guidelines-2026.pdf
    > "|  | Dogs | Cats | Dogs | Cats | Dogs | Cats | Dogs | Cats |"
    > "| Blood creatinine*mg/dl | <1.4 | <1.6 | 1.4-2.8 | 1.6-2.8 | 2.9-5.0 | 2.9-5.0 | >5.0 | >5.0 |"
[3] https://github.com/acastrovieira/site-vet-do-rim/actions/runs/34405897820
    > "ERROR: CREATE INDEX CONCURRENTLY cannot be executed within a pipeline (SQLSTATE 25001)"
[4] https://github.com/advisories/GHSA-p293-qw3h-jr36
    > "A vulnerability in applications using Pages and App router without Cache Component can lead to remote code execution when the server is hosted on machines using a Windows filesystem."
[5] https://github.com/advisories/GHSA-2xp9-vwfh-vxw4
    > "A vulnerability in the underlying `libheif` library used by `sharp` which Next.js uses for image optimization can lead to remote code execution when AVIF files are optimized."
[6] https://www.vetdorim.com.br/sitemap.xml
    > "<loc>https://vetdorim.com.br</loc> <changefreq>weekly</changefreq> <priority>1</priority>"
[7] https://www.iris-kidney.com/s/IRIS_Pocket_Guide_to_CKD_June-2026-cn6g.pdf
    > "| Creatinine in mg/dLStagebased on | Less than1.4(125μmol/L) | 1.4-2.8(125-250μmol/L) | 2.9-5.0(251-440μmol/L) | Greater than5.0(440μmol/L) |"
    > "| Creatinine in mg/dLStagebased on | Less than1.6(140μmol/L) | 1.6-2.8(140-250μmol/L) | 2.9-5.0(251-440μmol/L) | Greater than5.0(440μmol/L) |"
[8] https://www.vetdorim.com.br/ferramentas
    > "Temporariamente indisponível enquanto fórmulas, produtos, unidades e limites passam por revisão clínica independente."
[9] https://www.vetdorim.com.br
    > "HTTP/1.1 200 OK Strict-Transport-Security: max-age=63072000; includeSubDomains; preload X-Content-Type-Options: nosniff X-Frame-Options: DENY Referrer-Policy: strict-origin-when-cross-origin"
[10] https://www.vetdorim.com.br/ferramentas/calculadora-tfg
    > "Esta ferramenta não mede nem estima a TFG."
[11] https://www.vetdorim.com.br/ferramentas/estadiamento-iris
    > "Faixas de estadiamento segundo as diretrizes IRIS 2026"
[12] https://vetdorim.com.br
    > "HTTP/1.1 307 Temporary Redirect Location: https://www.vetdorim.com.br/"
[13] https://www.vetdorim.com.br/robots.txt
    > "Host: https://vetdorim.com.br Sitemap: https://vetdorim.com.br/sitemap.xml"
