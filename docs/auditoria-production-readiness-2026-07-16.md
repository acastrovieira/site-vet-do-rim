# Auditoria integral e readiness de produção — Vet do Rim

**Data:** 2026-07-17  
**Decisão:** **NO-GO para dados e pacientes reais**  
**Escopo:** frontend, backend Next.js, autenticação, Supabase/PostgreSQL, RLS, Storage, Edge Function de IA, migrations, scripts, documentos, CI/CD, responsividade, acessibilidade, segurança, privacidade e operação.

## 1. Resumo executivo

A camada pública está compilando, responsiva e funcional nos cenários automatizados. Foram registradas **114 correções seguras e rastreáveis** para defeitos confirmados de CSS, consentimento de analytics, CI, testes, autorização de rotas e da Edge Function, validação das APIs, segurança de scripts E2E, contenção de RLS legado, hardening parcial da IA, conteúdo clínico e institucional, exportação CSV, histórico de peso, acessibilidade, JSON-LD, SEO, temas claro/escuro, textos legais, paginação/busca, armazenamento local e tratamento de integrações. O gate local passou com **105/105 testes de contrato/unitários**, **74/78 cenários na última execução monolítica do predeploy sobre `next start`** (4 fluxos remotos ignorados por ausência intencional de credenciais) e, após o contrato adicional de acessibilidade, **75/82 na matriz Chromium completa** (7 cenários remotos ignorados), **9/9 cenários cross-browser também sobre o build de produção** em Chromium tablet, Firefox e WebKit, **17/17 invariantes pgTAP** e **38 superfícies** geradas no build. As **11 migrations ativas** também foram reaplicadas do zero em PostgreSQL 17 local isolado, seguidas de lint e advisors sem finding de projeto. O baseline ganhou manifesto SHA-256 append-only, verificador de drift, dependências Deno exatas com lock v4 e jobs de contrato de banco/Edge no CI; essas provas continuam locais e não atestam o estado hospedado. O GitHub público permanece vermelho no último SHA remoto e ainda não executou os workflows novos, portanto a evidência local não autoriza release.

O sistema ainda não deve receber dados reais. O bloqueio principal é estrutural: as políticas atuais de `tutores`, `pets`, `triagens` e `follow_ups` autorizam pelo papel `vet/admin`, mas não isolam registros por clínica ou profissional. Assim, dois veterinários autenticados podem, em princípio, acessar a mesma base clínica. Há também risco residual no fluxo de IA porque resultado, status e consumo de cota não formam uma única transação idempotente. A revisão clínica encontrou oito falhas P0 em fluidoterapia, eletrólitos e dieta; essas três ferramentas foram retiradas preventivamente das rotas públicas e do sitemap, mas seus motores não podem ser reativados antes de correção e homologação independente. O autocadastro profissional foi corretamente desativado porque ainda não existe workflow auditável de verificação/aprovação de médicos-veterinários; isso evita escalada de papel, mas também impede considerar o onboarding profissional pronto.

As migrations foram aplicadas **somente** a um PostgreSQL 17 local descartável, em portas temporárias e sem dados reais. Nenhuma migration ou consulta foi executada contra staging/produção, nenhum dado remoto foi alterado e nenhum deploy foi realizado nesta auditoria. Ao final, a stack isolada `site-vet-do-rim` foi removida, as portas temporárias foram restauradas no arquivo de configuração e a stack concorrente `app_incise` permaneceu ativa e intacta.

## 2. Cobertura e método

O inventário final reconciliado encontrou **1.673 arquivos não ignorados**, excluindo dependências instaladas, builds e resultados de teste. A separação evita confundir o produto implantável com o framework vendorizado e seus wrappers de IDE:

| Camada | Arquivos | Tratamento |
|---|---:|---|
| Produto/release: raiz, `web`, `supabase`, `docs` e `.github` | 299 | revisão de código/configuração/documentos, gates e testes proporcionais ao risco |
| `.aiox-core` vendorizado | 1.147 | inventário, configuração, paths, links, manifests, dependências e supply chain; não homologado para release |
| Wrappers de agentes/IDEs: `.agent`, `.antigravity`, `.claude`, `.codex`, `.cursor`, `.kimi` | 227 | sintaxe, frontmatter, scripts, links, segredos, portabilidade e drift de cópias |

A cobertura do produto/release por domínio foi:

| Domínio | Arquivos | Cobertura aplicada |
|---|---:|---|
| `web/src/app` | 56 | páginas, layouts e handlers; 38 superfícies de rota no build |
| `web/src/components` | 41 | marketing, Lab, ferramentas, providers e UI |
| `web/src/lib` + `hooks` | 34 | cálculos, Supabase, validação, autorização, health/readiness, JSON-LD, exportação, consentimento, datas civis e política de movimento |
| `web/src/content` | 3 | artigos clínicos MDX |
| `web/src/types` | 1 | contrato local do banco |
| `web/tests` | 19 | E2E e unitários |
| `web/scripts` | 30 | readiness, E2E, cleanup, auditoria read-only de staging, integridade de migrations/Edge, alvo remoto explícito, supply chain e geração de ativos |
| `supabase/migrations` | 11 | schema, RLS, perfis, quota, índice de FK e privilégios Data API |
| `supabase/migrations_archive` | 3 | dois SQLs históricos de laudos/bucket e README de quarentena |
| `supabase/functions` | 5 | `parse-laudo`, contratos puros, tipos mínimos do banco e configuração/lock Deno |
| `supabase/tests` | 1 | 17 invariantes pgTAP de schema, RLS, grants, bucket, índice e funções privilegiadas |
| `docs` | 30 | PRD, governança, matriz canônica de autoridade, ADRs, drafts quarentenados, relatórios, runbooks, planos, status e checklists |
| `.github` | 16 | dois workflows, Dependabot e metadados de automação/projeto |
| manifests/configurações | 11 | npm, Next, TS, ESLint, Playwright, Vercel, Supabase e integridade de migrations |

Extensões predominantes do produto/release: 82 TSX, 71 TS, 46 Markdown, 26 MJS, 23 SQL, 11 PNG, 8 JSON, 6 SVG, 4 JPG, 3 YML, 3 MDX, 3 WebP, 2 JS, 2 ICO, 1 TOML, 1 LOCK e 1 CSS.

### Wrappers de agentes e IDEs

Nos 227 arquivos não ignorados dessa camada, 123 frontmatters, 3 JSONs, 2 YAMLs, 1 XML, 9 scripts Python e 2 hooks CJS passaram nos parsers/compiladores aplicáveis. A busca redigida por chaves privadas, JWTs, tokens de GitHub/AWS/Supabase e atribuições de segredo não encontrou candidato. Outros 14 arquivos locais ignorados foram examinados como defesa adicional, mas não integram o inventário versionável.

Foi corrigido um frontmatter YAML inválido em `.claude/rules/mcp-usage.md` e removida da mesma regra a orientação insegura de gravar token em catálogo Docker. Os caminhos pessoais do catálogo de squads em `.antigravity/rules.md` e `.codex/skills/aiox-vibe-framework/SKILL.md` foram substituídos pelo contrato explícito `X_SQUADS_HOME`. O campo `workspace` de `.antigravity/antigravity.json` permanece absoluto: sem schema local que comprove suporte a caminho relativo, alterá-lo seria uma mudança especulativa com risco de quebra.

A referência ausente das 12 cópias de agentes PM/PO/SM foi resolvida com a matriz canônica `docs/architecture/command-authority-matrix.md`, derivada da constituição versionada e sem ampliar permissões. A dívida residual é de 48 arquivos com marcadores compatíveis com mojibake e drift de sync entre IDEs. Esses artefatos não entram no runtime web e devem ser regenerados a partir de uma versão AIOX homologada, em vez de receber uma reescrita em massa sem fonte canônica.

### Rotas verificadas no build

- Públicas: `/`, `/blog`, três artigos, `/ferramentas` e oito ferramentas, páginas legais, login, cadastro, recuperação e redefinição de senha, conclusão server-side do recovery, `/portal`, `/robots.txt` e `/sitemap.xml`.
- Autenticadas/dinâmicas: `/lab`, pacientes, laudos, tutores, perfil.
- Backend: `/api/health`, `/api/health/readiness`, `/api/cron/keep-alive`, `/api/pets`, `/api/pets/[id]`, `/api/tutores`, `/api/tutores/[id]`, `/auth/callback`.

### Restrições da evidência

Não foram executados contra ambiente remoto:

- reset de staging/produção e aplicação remota das migrations;
- testes com duas contas veterinárias reais e dados clínicos isolados;
- upload real para Storage e chamada real aos provedores de IA;
- validação de secrets, Auth, SMTP/DKIM/SPF, PostHog e Vercel de produção;
- backup/restauração e rollback.

Essas ações exigem ambiente de staging isolado, credenciais próprias e/ou confirmação explícita. Ausência de teste não foi tratada como aprovação.

### Matriz pedido → evidência → lacuna

| Requisito solicitado | Evidência local obtida | Estado e lacuna objetiva |
|---|---|---|
| Sistema inteiro, arquivo/documento/script | 1.673 caminhos não ignorados reconciliados; 299 do produto, 1.147 do AIOX e 227 wrappers | Cobertura estática local concluída; AIOX/wrappers têm dívida de empacotamento, encoding e sync |
| Todas as rotas | 38 superfícies no build; handlers e fronteiras de rota revisados; última execução monolítica do predeploy 74/78, com 4 remotos ignorados, e matriz Chromium atual 75/82 | Rotas públicas e redirecionamento anônimo comprovados localmente; fluxos autenticados reais dependem de staging |
| Frontend desktop/celular/tablet | 390×844, 768×1024, 1024×768, 1280×720 e 1440×900; inspeção renderizada e regressão Playwright | Público aprovado em Chromium, Firefox e WebKit; cadastro e páginas legais foram reinspecionados em tema claro/escuro; Lab autenticado ainda depende de staging |
| Backend e integração frontend/backend | lint, tipos, unitários, build; contratos/erros/auth/APIs revisados e saneados | Integração local/pública aprovada; Supabase Auth/Data API/Storage/IA reais não foram acionados |
| Migrations, RLS e Storage | leitura integral, replay das 11 migrations em PG17 local, 17/17 pgTAP, lint/advisors, manifesto SHA-256 append-only, scripts legados quarentenados e pack SQL read-only executado localmente | Baseline local comprovada; manifesto não atesta igualdade remota, tenancy e grants funcionais continuam deliberadamente fail-closed, e isolamento Vet A × Vet B/staging não foi executado |
| Eficácia e segurança | quatro audits, verificador de 1.113 entradas, SBOM, CSP, minimização de PII, timeouts e fail-closed | Gate local forte; performance/Lighthouse, observabilidade, concorrência e operação real permanecem pendentes |
| Correções sem quebra | mudanças pequenas, duas novas migrations forward-only, drafts não executáveis, ferramentas clínicas contidas e reteste integral | Apenas banco local descartável foi alterado; nenhum deploy/dado remoto; compatibilidade final ainda exige staging |
| Prontidão para vida real | critérios de GO, sprints, squads, modelos e responsáveis definidos | **NO-GO** até tenancy, transação de laudos, onboarding profissional, homologação clínica e gates operacionais |

## 3. Correções seguras realizadas

| ID | Correção | Estado/evidência |
|---|---|---|
| FIX-01 | Workflows passaram a executar no diretório `web`, com Node 22.18, cache correto, lint, tipos, unitários, audit, build e Playwright público. | Corrigido; configuração local validada. |
| FIX-02 | `check:predeploy` passou a executar build e fluxos públicos reais, preservar evidências e usar um worker para evitar saturação. | Corrigido; gate completo verde. |
| FIX-03 | Cleanups E2E deixaram de aceitar `includes(runId)` e agora exigem identidade exata por suíte. | Corrigido e coberto por teste unitário. Ainda requer metadata/manifesto e staging isolado. |
| FIX-04 | Consentimento de analytics ganhou aceitar/recusar; PostHog só inicializa após opt-in. | Corrigido e coberto por E2E. |
| FIX-05 | Cron passou a negar acesso quando `CRON_SECRET` estiver ausente e a usar respostas sem cache. | Corrigido localmente. Secret remoto não verificado. |
| FIX-06 | CTA principal voltou a receber estilos; regra customizada foi retirada de uma camada CSS eliminada no build. | Corrigido; desktop, tablet e mobile sem overflow. |
| FIX-07 | Chave React duplicada, imports/props sem uso, texto de rotas e link de artigo incorreto foram corrigidos. | Corrigido; lint sem erro ou warning. |
| FIX-08 | Exportação CSV passou a escapar aspas, quebras de linha e fórmulas de planilha. | Corrigido e coberto por unitário. |
| FIX-09 | Ferramentas IRIS foram alinhadas às faixas 2026 por espécie; a “TFG estimada” sem método validado foi removida. | Corrigido e coberto por limites unitários; exige homologação de nefrologista veterinário. |
| FIX-10 | Classificação de AKI foi isolada em motor puro, exige evidência de lesão e não eleva grau com base apenas no débito urinário. | Corrigido e coberto por unitário. |
| FIX-11 | Recomendações automáticas potencialmente prescritivas/doses foram retiradas das telas revisadas. | Corrigido nas ferramentas IRIS/AKI auditadas. |
| FIX-12 | `parse-laudo` recebeu timeout, `Cache-Control: no-store`, modelos atuais configuráveis, `store:false` para OpenAI e chave Gemini em header. | Corrigido localmente; chamadas reais não executadas. |
| FIX-13 | Edge Function passou a exigir `vet_id` do usuário e prefixo do usuário no `storage_path`; fallback não atômico de quota foi removido. | Mitigação aplicada; transação integral permanece pendente. |
| FIX-14 | O frontend de quota preserva limite `0` com `??`, em vez de convertê-lo para `5`. | Corrigido. |
| FIX-15 | Migration que dependia de `subscriptions` ganhou guarda de existência; seed inexistente foi desabilitado. | Corrigido; o reset limpo das 11 migrations ativas passou em PostgreSQL 17 local. |
| FIX-16 | Política de privacidade passou a citar Google, OpenAI, PostHog e Vercel sem prometer retenção inexistente. | Corrigido tecnicamente; revisão jurídica ainda necessária. |
| FIX-17 | Node mínimo foi declarado e foram adicionados testes unitários de segurança/limites clínicos. | Corrigido. |
| FIX-18 | Respostas Supabase SSR receberam cabeçalhos para evitar cache compartilhado. | Corrigido. |
| FIX-19 | `VetOnlyGate` ganhou timeout de 8 s, retry, mensagem segura e falha fechada; instruções internas não chegam mais ao usuário. | Corrigido no cliente; API/RLS continuam sendo a autoridade obrigatória. |
| FIX-20 | Formulários Lab passaram a tratar timeout, rede, resposta não JSON, sessão expirada e zero linhas alteradas; diálogos ganharam foco inicial, trap, Escape e retorno de foco. | Corrigido e coberto por 4 unitários e E2E focalizados; mutações multi-tabela ainda pedem RPC. |
| FIX-21 | Fluidoterapia, reposição eletrolítica e dieta renal foram substituídas por contenção clínica, marcadas `noindex` e retiradas do sitemap/showcase ativo. | Mitigação fail-closed validada em desktop/celular e E2E. Motores permanecem bloqueados. |
| FIX-22 | Histórico de peso passou a separar paciente por nome normalizado + espécie, comparar datas do mesmo paciente, bloquear data futura, usar tendência neutra, confirmar exclusões e alertar storage corrompido/lotado. | Corrigido e coberto por E2E; identificador clínico estável continua recomendado. |
| FIX-23 | Header/sidebar ganharam skip link, foco/retorno/Escape e conteúdo oculto não focável; `prefers-reduced-motion` foi respeitado. | Corrigido; Chromium, 390×844, 768×1024 e 1440×900 verificados. |
| FIX-24 | `sitemap.ts`, `robots.ts`, `noindex` do Lab e testes de indexação foram adicionados. | Corrigido; 5 cenários SEO passaram. |
| FIX-25 | Caminhos Unicode problemáticos dos logos foram substituídos por ativo ASCII e wordmark textual responsivo, eliminando 404 no dev/prod. | Corrigido; console limpo e sem imagem quebrada nos fluxos cobertos. |
| FIX-26 | Foi criado o ADR de tenancy por clínica, com membership, `clinic_id`, FKs compostas, rollout fail-closed e matriz Vet A × Vet B. | Projeto arquitetural concluído; nenhuma migration de tenancy foi promovida ou aplicada. |
| FIX-27 | `fix-laudos-storage.sql` e `apply-rls.js` foram mecanicamente quarentenados; o SQL sempre aborta e o JS não aceita segredo nem chama rede. | Corrigido e coberto por unitário; histórico preservado sem DDL executável. |
| FIX-28 | Scripts E2E/cleanup e remote-readiness deixaram de usar projeto padrão: exigem ref/URL coincidentes; mutações aceitam apenas `staging` e confirmação vinculada ao alvo. | Corrigido e coberto por unitário; nenhuma operação remota foi executada. |
| FIX-29 | As quatro APIs de tutor/paciente passaram a rejeitar JSON nulo/lista/inválido ou excessivo, limitar textos/números e omitir IDs/detalhes sensíveis dos logs. | Corrigido; lint, tipos, unitários e build verdes. CPF/CEP ainda pedem validação de domínio aprovada. |
| FIX-30 | O proxy aplica fronteiras exatas e autorização server-side fail-closed: `/admin` só admin, `/lab` vet/admin e `/portal` tutor, preservando cookies nos redirects. | Corrigido e coberto por matriz unitária; tenancy/RLS continua sendo autoridade de dados. |
| FIX-31 | `parse-laudo` limita método/body/PDF/saída, valida UUID e assinatura PDF, usa no máximo três tentativas, claim/finalize condicionais por dono/estado e códigos de falha sem body/PII. | Hardening local validado sintaticamente e por guardrails estáticos; transação integral permanece P0. |
| FIX-32 | Drafts de tenancy/RLS e claim/finalize/refund foram criados fora de migrations, com sentinelas incondicionais; matriz Vet A × Vet B e testes de falha/concorrência foram especificados. | Projeto estático concluído e mecanicamente bloqueado; não executado em PostgreSQL. |
| FIX-33 | Plano de revalidação dos motores clínicos definiu unidades, invariantes, 49 casos golden/fronteira, duas revisões veterinárias e critérios de suspensão. | Documento concluído; valores/doses concretos dependem de especialistas e ferramentas seguem bloqueadas. |
| FIX-34 | Dependências vulneráveis do AIOX foram atualizadas para `js-yaml 4.3.0` e `tar 7.5.20`; ambos os audits ficaram em zero. | Corrigido no manifesto/lock; testes/build declarados pelo AIOX estão ausentes e não puderam validar compatibilidade. |
| FIX-35 | Documentos legados receberam banners de NO-GO e foi criado índice de governança; JSON-LD passou a escapar terminadores de script; imagem LCP recebeu carregamento antecipado. | Corrigido e testado; conteúdo histórico foi preservado como evidência, não como autorização. |
| FIX-36 | Ciclos e scripts de cleanup E2E passaram a propagar qualquer falha, executar todas as etapas, conferir IDs removidos e detectar resíduos em PostgreSQL, Storage e Auth; `--apply` usa e-mail/tutor exatos. | Corrigido e coberto por unitários/sintaxe; comportamento remoto ainda precisa de staging. |
| FIX-37 | `/api/health` foi separado em liveness puro e `/api/health/readiness` em validação local; cron ganhou segredo mínimo, comparação em tempo constante, HTTPS, timeout e logs/respostas saneados. | Corrigido localmente e coberto por unitário/E2E; dependências reais não foram consultadas. |
| FIX-38 | Foi criada matriz smoke isolada para Chromium tablet, Firefox e WebKit no CI, mantendo o gate principal Chromium estável. | Matriz local passou 6/6; o primeiro workflow remoto e a cobertura autenticada continuam pendentes. |
| FIX-39 | CSP deixou de permitir `'unsafe-eval'` e acesso direto do browser à OpenAI; `object-src 'none'` foi adicionado. Logos renderizados passaram a WebP de 42–94 KB, com LCP eager. | Corrigido por teste estático, inspeção visual, build e smoke sem warning; `'unsafe-inline'` e wildcard Supabase permanecem. |
| FIX-40 | As 522 referências do lock web ao `registry.npmmirror.com` foram normalizadas para o registry oficial, preservando integridades. | `npm ci --ignore-scripts` e audit passaram; zero referências ao mirror e 635 ao npm oficial. |
| FIX-41 | O breakpoint do menu principal foi movido de `md` para `lg`, evitando navegação espremida e quebra de rótulos em tablets; o fluxo ganhou regressão automatizada em 768×1024. | Inspeção renderizada em 390×844, 768×1024 e 1024×768 sem overflow/console error; teste mobile 8/8 e smoke tablet 2/2. |
| FIX-42 | Login e callback passaram a compartilhar redirect interno normalizado e autorização por papel; callback é dinâmico/no-store/no-referrer, perfis inválidos falham fechado e mensagens brutas do provedor deixaram de chegar ao usuário. | Lint, tipos, unitários e E2E verdes; PKCE/recovery/cookies reais continuam pendentes em staging. |
| FIX-43 | Dashboard, perfil, tutor, paciente e laudos distinguem erro Supabase de vazio/404; exceções usam códigos estáveis e o perfil entregue ao shell cliente foi minimizado para `id`, papel e nome. | Corrigido sem copiar SQL/PII para erros; relação paciente–tutor e contagens falham fechado. |
| FIX-44 | CI recebeu permissões mínimas, ações oficiais fixadas por SHA, checkout sem credenciais, concurrency/timeout, Dependabot, quatro audits, SBOM CycloneDX e verificador de registry/integridade/scripts de instalação nos quatro lockfiles. | SHAs oficiais confirmados; 1.113 entradas de pacote verificadas, quatro audits em zero e SBOM 1.5 com 216 componentes. Workflows ainda precisam de execução remota. |
| FIX-45 | A raiz passou a delegar gates para `web`; o AIOX vendorizado foi marcado privado, runbooks perderam caminhos pessoais e ganhou relatório próprio de drift/recursos ausentes. | Gates do produto ficaram inequívocos; AIOX continua não homologado e fora do release até decisão de restauração ou arquivamento. |
| FIX-46 | Cadastro, recuperação de senha, perfil, login e uploader deixaram de reutilizar mensagens brutas de Auth/Storage/IA; logs globais/APIs omitem mensagens do provedor e retornos públicos usam códigos estáveis. | Corrigido e coberto por teste de não vazamento de SQL/PII; gate final repetido após a mudança. |
| FIX-47 | A regra MCP do Claude teve o frontmatter YAML corrigido e deixou de recomendar token real gravado em catálogo Docker; o texto agora exige secret store suportado, rotação e ausência em disco/VCS/logs. | 123 frontmatters e os formatos executáveis/configuráveis dos 227 wrappers passaram; busca redigida de segredos sem candidato. |
| FIX-48 | Regras versionadas de X-Squads deixaram de depender de 26 referências ao diretório pessoal do autor e agora usam `X_SQUADS_HOME`, com falha explícita quando o catálogo estiver ausente. | Restou apenas o `workspace` absoluto do Antigravity, preservado até validação do schema para não quebrar a ferramenta. |
| FIX-49 | O hook de autoridade Git deixou de confiar em `AIOX_ACTIVE_AGENT=devops` declarado dentro do próprio comando, que permitia contornar o bloqueio de publicação. | Sintaxe aprovada; comando com identidade injetada e agente desconhecido foram negados, enquanto contexto DevOps externo foi permitido; nenhuma operação Git remota ocorreu. |
| FIX-50 | O parser de laudos deixou de sugerir IRIS a partir de creatinina isolada; o prompt proíbe diagnóstico/tratamento/estadiamento e o campo de estágio é normalizado para `null` antes de salvar/retornar. | Compatível com schema/UI atuais; transpile estático e guardrail unitário passaram. Unidades, referências, página e validação clínica permanecem bloqueadores. |
| FIX-51 | Recovery/reset e perfil tiveram cleanup/timers/transições corrigidos, senha limitada, troca de email idempotente na sessão, falhas públicas estáveis e alertas acessíveis; shell/logout e boundary servidor→cliente deixaram de serializar objetos completos de User/profile. | Lint, tipos, build e testes verdes; Auth/recovery/email reais ainda exigem staging. |
| FIX-52 | Uploader passou a falhar fechado na cota, revogar object URLs corretamente e exigir confirmação exata do rollback de Storage; se a remoção falhar, bloqueia nova tentativa/troca e orienta suporte. Proxy/cron evitam Auth/linhas clínicas desnecessárias, usam no-store privado e health Auth oficial; breadcrumb/modal foram ajustados para telas estreitas. | Contém multiplicação de órfãos sem abrir policy insegura; lint, tipos, testes e build passaram. DELETE tenant-aware e transação upload+insert permanecem P1. |
| FIX-53 | `supabase/migrations_archive/README.md` passou a declarar os SQLs arquivados como histórico não executável e apontar somente para ADR/drafts quarentenados e o fluxo correto de nova migration. | Teste estático exige a quarentena; nenhum SQL arquivado foi promovido. As novas migrations ativas desta auditoria foram validadas somente no banco local descartável. |
| FIX-54 | O predeploy deixou de reutilizar silenciosamente qualquer servidor na porta 3000; o E2E agora possui `127.0.0.1:3310` e proíbe reuse, evitando testar o preview do Codex ou outra aplicação. | A colisão foi reproduzida por snapshots “Your site is taking shape”/`Not Found`; após a correção, a matriz exata passou 64/64 em 2,6 min. Guardrail unitário impede regressão. |
| FIX-55 | O logo do footer recebeu carregamento eager quando pode ocupar a dobra em páginas curtas, eliminando o warning LCP emitido pelo Next. | Guardrail de asset passou e 23 fluxos de home/blog/ferramentas/legal/auth repetiram sem warning. |
| FIX-56 | Foi criada a matriz canônica de autoridade de comandos referenciada pelos agentes PM/PO/SM, derivada da constituição do repositório e com publicação, deploy e migrations remotas reservados ao papel competente. | As 12 referências de wrappers agora resolvem e um teste unitário impede nova quebra; nenhuma autoridade foi ampliada. |
| FIX-57 | Foi criado um pack de auditoria de staging offline/read-only para catálogo, grants/RLS, integridade agregada e bloqueadores de release. O runner exige alvo de staging coincidente, confirmação vinculada, transação read-only e `ROLLBACK`. | Plano local 4/4 aprovado; os SQLs também compilaram em PostgreSQL 17 local. Nenhuma consulta, migration ou mutação remota foi executada. |
| FIX-58 | As quatro APIs clínicas de pacientes/tutores passaram a consultar o papel persistido em `profiles` no servidor, falhar fechado em indisponibilidade, exigir JSON, limitar payloads e responder com cache privado desabilitado. | 401/403/415/503 e 201 foram padronizados; logs/erros não expõem PII ou detalhes do provedor. RLS/tenancy continua sendo a segunda barreira obrigatória. |
| FIX-59 | Formulários Auth/Lab, ações e uploads receberam mutex contra duplo envio, estados acessíveis e cleanup; o uploader não reenvia PDF já salvo após falha de IA; drawer/modal ganharam trap de foco, Escape, restauração e scroll lock. | Unitários, inspeção visual e E2E Chromium passaram; operações reais continuam dependentes de staging. |
| FIX-60 | Referências laboratoriais deixaram de assumir canino para espécie desconhecida; agrupamento visual foi separado de intervalo clínico e a UI mostra referência indisponível quando não houver fonte homologada. | Equino/espécie não suportada cobertos por teste; nenhum intervalo clínico foi inventado ou alterado. |
| FIX-61 | Lookup de blog foi contido contra traversal; transformação de laudo ignora seções malformadas da IA; tendência 0→0 tornou-se estável e mensagens de autorização ficaram provider-agnostic. | Guardrails unitários e build aprovados, sem ecoar slug inseguro ou derrubar a tabela evolutiva. |
| FIX-62 | O comando E2E padrão foi separado da matriz cross-browser e fixado em Chromium/um worker, evitando saturação do `next dev` e falsos negativos por binários Firefox/WebKit ausentes. | Reteste final: 68/75 passaram no Chromium e 7 remotos foram ignorados por falta intencional de credenciais. |
| FIX-63 | O sumário de release da auditoria read-only passou a bloquear staging sem grants mínimos explícitos da Data API para `authenticated` e `service_role`, separados das policies RLS. | Plano offline 4/4 passou; o catálogo real continua obrigatório antes do release. Nenhum `GRANT` foi aplicado. |
| FIX-64 | Os comandos E2E principal e cross-browser agora possuem host/porta próprios e `reuseExistingServer=0`; Firefox 151 e WebKit 26.5 foram instalados somente no runtime local de teste. | Matriz pública isolada passou 6/6: Chromium tablet 2/2, Firefox 2/2 e WebKit 2/2. |
| FIX-65 | Foi adicionado smoke HTTP de runtime para as quatro APIs clínicas de mutação, cobrindo POST/PATCH anônimos, status 401, JSON estável, `private, no-store` e ausência de vazamento de infraestrutura. | Incluído no predeploy; 4 contratos verificados em um único cenário E2E. |
| FIX-66 | `parse-laudo` passou a consultar `profiles.role` e negar `tutor` ou papel revogado antes de qualquer claim/uso do cliente `service_role`; indisponibilidade de autorização retorna 503 e papel sem privilégio retorna 403. | Ordem autorização→claim protegida por guardrail; check/lint/bundle no runtime Deno local passaram, enquanto execução Supabase hospedada permanece pendente. |
| FIX-67 | O cleanup do ciclo Auth/RLS agora valida identidades exatas, tenta todas as exclusões, pagina Auth com proteção de loop, verifica ausência por ID/e-mail e preserva simultaneamente falha primária e falhas de limpeza. | Sintaxe e testes de agregação/resíduo passaram; comportamento remoto exige staging autorizado. |
| FIX-68 | Política de Privacidade, Termos e banner deixaram de afirmar conformidade, DPO, TLS/RLS, prazos, bases legais e notificações não comprovadas; `localStorage`, dispositivo compartilhado, persistência, perda e limpeza foram explicados. | Texto marcado preliminar, com guardrail contra regressão e revisão jurídica ainda obrigatória. |
| FIX-69 | O autocadastro foi limitado a tutor e deixou de enviar `requested_role`; a opção veterinário está desabilitada e CTAs não prometem aprovação inexistente. | Escalada por metadata e expectativa enganosa foram contidas; workflow profissional auditável permanece P1. |
| FIX-70 | A planilha laboratorial local passou a validar a estrutura completa de pacientes, exames e parâmetros, falhando fechado sem apagar o valor original nem registrar conteúdo clínico no console. | Casos válidos, JSON malformado e registros incompletos passaram em testes. |
| FIX-71 | Scripts legados de ativos deixaram de apagar logo antes de validar origem, sobrescrever ICO com PNG renomeado, depender de paths pessoais e encerrar com sucesso após erro. | Somente scripts foram corrigidos; nenhum ativo foi regenerado/removido. Sintaxe e guardrail passaram. |
| FIX-72 | Cadastro ganhou tema claro/escuro coerente e controle de tema visível; páginas legais receberam hierarquia explícita sem depender do plugin Typography ausente, além de contraste dark. | Browser 390×844 e 1280×720: sem overflow, logo/inputs/títulos visíveis, console sem error/warning; build e E2E verdes. |
| FIX-73 | Identificador real de projeto Supabase e e-mail temporário histórico foram removidos de runbooks/README e substituídos por placeholders ou referência à evidência privada. | Reduz risco de alvo remoto incorreto e exposição desnecessária; scripts continuam exigindo ref/URL/confirmação coincidentes. |
| FIX-74 | O contrato local de Auth passou a rejeitar senhas com menos de 8 caracteres, alinhado ao mínimo já exigido pela interface. | Guardrail unitário aprovado. A configuração remota ainda deve ser reconciliada em staging; não foi alterada nesta auditoria. |
| FIX-75 | O seletor de tema passou a usar o tema efetivamente resolvido, nome acessível dinâmico e marcação HTML válida; login, recuperação e redefinição receberam contraste dark e controle de tema. | Inspeção em 390×844, 768×1024 e 1280×720 confirmou claro/escuro, textos longos, estados sem sessão e ausência de overflow/error/warning. |
| FIX-76 | As listas de pacientes e tutores deixaram de truncar silenciosamente em 50 registros: ganharam busca server-side, contagem exata, ordenação estável e paginação limitada. | Contratos unitários, tipos, build e jornadas públicas passaram; a matriz com dados remotos densos permanece gate de staging. |
| FIX-77 | A criação de paciente passou a detectar mais de 200 tutores, recuperar por ID um tutor pré-selecionado fora da primeira janela e falhar fechado quando não há seleção inequívoca. | Evita associação ao tutor errado; teste de fronteira com base sintética >200 ainda é obrigatório em staging. |
| FIX-78 | O histórico de laudos passou a renderizar paginação real; a tela do paciente declara explicitamente que a janela evolutiva usa até os 50 laudos mais recentes e aponta para o histórico completo. | Elimina o falso “ver todos” e torna o limite clínico visível; evolução longitudinal além da janela requer decisão clínica/produto. |
| FIX-79 | Animais do tutor passaram a usar contagem exata, filtro ativo no banco, ordenação estável e paginação, evitando o limite implícito da Data API. | Contrato local aprovado; concorrência elevada pode justificar paginação por cursor na próxima sprint. |
| FIX-80 | Telas Lab de listas, detalhes, perfil, laudos, upload, tabela evolutiva, loading e modais receberam contraste dark, quebra de strings longas e ajustes responsivos locais. | Lint, tipos, unitários e build verdes; sessão Lab autenticada em navegadores reais continua pendente no staging autorizado. |
| FIX-81 | O dashboard laboratorial gratuito ganhou semântica de tabs, nomes acessíveis para controles compactos e contenção de nomes longos em celular. | Guardrail unitário e E2E mobile aprovados sem alterar o armazenamento clínico local. |
| FIX-82 | IDs de rota passaram a exigir UUID válido; páginas repetidas/malformadas falham para a primeira página; paginação foi limitada a 10.000 páginas com ordenação de desempate e contagem nula fail-closed. | Unitários de fronteira e build aprovados; volume/latência/planos SQL ainda dependem de staging denso. |
| FIX-83 | APIs rejeitam campos desconhecidos, cancelam corpo JSON em streaming acima do limite, exigem UUID no cliente e comprovam a linha retornada no perfil; o shell é atualizado após salvar o perfil. | Lint, tipos e contratos unitários aprovados; matriz funcional completa de status HTTP e constraints de banco permanece recomendada. |
| FIX-84 | Recovery deixou de confiar em `type`/`next` da URL: o callback usa o `redirectType` verificado pelo SDK PKCE, emite marcador HttpOnly/SameSite estrito de curta duração e bloqueia redirects pós-login para `/auth`. Visita direta ao reset não exibe campos de senha. | Unitários e E2E público aprovados; SMTP, redirects permitidos e `secure_password_change` hospedado ainda exigem staging. |
| FIX-85 | A planilha gratuita passou a validar o snapshot cruzado paciente×exame antes de toda mutação, limitar coleções, bloquear N+1, preservar corrupção, compensar escrita parcial e elevar erro irrecuperável ao bloqueio global. | Testes cobrem corrupção, storage indisponível, limites e rollback; o risco multiaba então residual foi eliminado no FIX-93. |
| FIX-86 | Estado canônico de pacientes/exames foi movido ao pai e sincronizado por evento de storage; exclusões externas removem o dashboard fantasma. Modais, retorno de foco, rowgroups, tabs, alvos de toque e temas claro/escuro foram corrigidos. | Inspeção renderizada em 390/768/1440, console limpo e E2E aprovados. |
| FIX-87 | A classificação de referência laboratorial passou a ter três estados (`normal`, `anormal`, `indisponível`), aceitar vírgula decimal sem `parseFloat` parcial e compartilhar o mesmo parser com tabela, gráfico e PDF. | Evita anunciar faixa normal sem referência e evita classificação errada de `1,8`; unitário funcional e prova renderizada aprovados. |
| FIX-88 | Tokens dourados inexistentes do header/footer foram substituídos por tokens reais; o alternador de tema, menu e links sociais de ícone passaram a 44×44 px e contraste mensurado. | Navegador confirmou texto dourado sobre navy, controles 44×44, zero overflow e zero erros/warnings. |
| FIX-89 | O hero do paciente gratuito deixou de disputar a mesma linha com o CTA em celular; abaixo de 640 px o botão ocupa linha própria e o nome preserva largura legível. | Falha visual reproduzida em 390×844, corrigida e aprovada no reteste integral. |
| FIX-90 | A suíte ganhou prova de reset direto negado, corrupção local preservada, superfícies dark e evidência numérica/referência estrita. | Gate daquele ciclo: 79/79 unitários, predeploy 67/67, Chromium 68/75 com 7 skips remotos e cross-browser 6/6. |
| FIX-91 | Cadastros de tutor e paciente passaram a bloquear reenvio cego quando timeout, rede, resposta inválida ou 5xx deixam o resultado remoto incerto; a UI exige conferência da lista e o mutex permanece travado após sucesso até a navegação. | Mitiga duplicação sem alterar API/schema. Não é idempotência: tenancy + ledger privado + RPC transacional continuam obrigatórios. Gate final: 81/81 unitários, predeploy 67/67, Chromium completo aprovado e cross-browser 6/6. |
| FIX-92 | O fluxo inseguro de óbito foi contido: o componente não chama mais `pets`/`triagens`/`follow_ups` no navegador, a UI não promete suspensão inexistente e o PATCH genérico bloqueia transições para/de `obito`. A inativação simples passou a usar a API autenticada com compare-and-set e bloqueio persistente quando a resposta é ambígua. | Evita estado clínico parcial e bypass dentro do app sem migration. A Data API/RLS global ainda permite bypass direto e o registro de óbito permanece indisponível até RPC tenant-aware, idempotente, auditável e transacional. Gate final: 82/82 unitários, predeploy 67/67, Chromium 68/75 com 7 skips remotos e cross-browser 6/6. |
| FIX-93 | A planilha gratuita migrou para um documento canônico v2 de escrita única por mutação, com revisão esperada, Web Locks, verificação pós-escrita, UUID criptográfico, preservação byte a byte do legado e detecção de divergência por fingerprint. Conflitos, lock indisponível e resultado incerto falham fechados; o formulário preserva o rascunho e exige atualização/reconfirmação em vez de mesclar ou repetir silenciosamente. | Duas abas reais foram serializadas em Chromium, Firefox e WebKit: uma gravação vence, a obsoleta recebe conflito explícito e o retry consciente preserva os dois registros. Exclusão obsoleta, criação concorrente de exame, quota na migração, escrita ambígua, aba legada e ausência de Web Locks também estão cobertas. Gate final: 89/89 unitários, predeploy 67/67, Chromium 68/75 com 7 skips remotos e cross-browser 9/9. |
| FIX-94 | A FK `colaboradores.supabase_uid` recebeu índice concorrente forward-only; privilégios administrativos (`TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN`) foram removidos de `anon`/`authenticated`, e defaults de objetos criados por migrations `postgres` passaram a negar tabelas, sequências e execução de funções até grant explícito. | As 11 migrations reaplicaram do zero em PostgreSQL 17.6.1 local. Lint `public,private`, Security Advisor e Performance Advisor passaram; a FK deixou de aparecer sem índice. Grants DML ausentes não foram abertos antes de tenancy. |
| FIX-95 | Foi criada suíte pgTAP com 17 invariantes de schema/RLS/grants/default ACL/bucket/índice/`SECURITY DEFINER`; o pack de staging deixou de tratar `PUBLIC` como role PostgreSQL e o resumo agora emite contrato JSON que força exit não zero quando qualquer check falha. | `supabase test db --local`: 17/17. Os quatro SQLs read-only compilaram/rodaram em PostgreSQL 17 local; o resumo marcou corretamente NO-GO por tenancy, DELETE Storage e grants funcionais ausentes. |
| FIX-96 | `parse-laudo` ganhou leitura streaming limitada, JSON/content-type/chaves estritos, CORS sem fallback enganoso, verificação de tamanho do Blob antes de alocar, limite do envelope de cada provedor, validação recursiva local do JSON Schema e catch condicionado ao estado `processando`. | 4 contratos executáveis passaram; evita sobrescrever laudo concluído e rejeita campos/tipos extras. Claim/quota/lease transacional continuam P0/P1. |
| FIX-97 | Foi criado manifesto SHA-256 em bytes brutos para as 11 migrations, com verificador append-only, validação contra base Git e exceção auditável apenas para a transição histórica já conhecida. | Verificação local e contra `HEAD` passou; 3 contratos unitários impedem alteração, remoção, reordenação ou versão retroativa. O escopo é explicitamente `repository-baseline-only`: igualdade remota não foi afirmada e a reconciliação do drift continua obrigatória. |
| FIX-98 | `parse-laudo` recebeu `deno.json` com versões exatas, lock v4, tipos mínimos do banco e config explícita de entrypoint/JWT; imports flutuantes foram eliminados. | `deno check --frozen`, `deno lint` e bundle limpo no Edge Runtime fixado por digest passaram. O `deno fmt --check` ainda aponta formatação histórica e ficou como dívida mecânica P2; função/provedores hospedados não foram acionados. |
| FIX-99 | O CI ganhou contratos separados de banco e Edge: Supabase CLI fixada, replay das 11 migrations, pgTAP, lint/advisors, check Deno congelado, lint e bundle em imagens fixadas por digest. | YAML validado e sequência integral reproduzida localmente em stack descartável: 11/11, 17/17, lint/advisors e Edge verdes. A primeira execução no GitHub e os required checks permanecem pendentes. |
| FIX-100 | Títulos de nove páginas deixaram de repetir `Vet do Rim`; o template global volta a acrescentar a marca exatamente uma vez. | Confirmado no navegador e por E2E executado no build de produção. |
| FIX-101 | Consentimento de analytics passou a tolerar `localStorage` bloqueado sem derrubar a hidratação; PostHog foi desabilitado em `/auth`, `/lab` e `/portal`, com autocapture e session replay explicitamente desligados. | Dois contratos unitários novos; analytics permanece fail-closed e nenhum dado clínico é capturado automaticamente pelo cliente. |
| FIX-102 | Chaves Supabase públicas agora rejeitam `sb_secret_*` e JWT `service_role`; `VetOnlyGate` usa o cliente central validado. Dependências Supabase do frontend foram fixadas exatamente nas versões já presentes no lock. | Unitários, supply-chain, typecheck e build aprovados; impede empacotar um segredo por erro de configuração. |
| FIX-103 | O cron deixou de consultar `tutores` como `anon` e passou a testar a raiz da Data API sem ler linhas clínicas; PATCH de pet inexistente retorna 404, payload excessivo retorna 413 e redirects de provedores de IA são recusados. | 102/102 contratos, Edge check e E2E anônimo aprovados; sem concessão insegura a `anon`. |
| FIX-104 | O predeploy e o workflow público passaram a compilar e exercitar `next start`; `api-security.spec.ts` e o redirecionamento anônimo do Lab entraram no CI, e a supply-chain é verificada antes de cada `npm ci`. | Predeploy de produção: 69 pass, 4 skips remotos; cross-browser de produção: 9/9. A primeira execução remota continua obrigatória. |
| FIX-105 | O verificador Edge passou a varrer recursivamente TS/JS e variantes, detectar `import()` dinâmico, rejeitar symlinks, exigir `strict` e confirmar o entrypoint. | Check local verde em três fontes e duas dependências exatas; o job runtime continua sendo a prova complementar. |
| FIX-106 | Texto de paginação corrompido, afirmação falsa de notificação de erro, botão visual inerte e alvos de toque pequenos foram corrigidos; desktop, celular e tablet foram reinspecionados. | Predeploy e matriz Chromium/Firefox/WebKit verdes, sem overflow nas rotas cobertas. |
| FIX-107 | O ledger de migrations deixou de aceitar eventos históricos adicionais, ainda que fossem sintaticamente válidos e preservassem o prefixo publicado. Depois do bootstrap, a sequência histórica precisa coincidir exatamente com a versão já selada. | Teste adversarial rejeita a inclusão retroativa de um evento inventado; `check:migrations` e 102/102 contratos permanecem verdes. O manifesto continua sem atestação remota. |
| FIX-108 | O job Edge deixou de apontar apenas para `parse-laudo`: agora descobre toda função versionada com `deno.json`, executa o verificador estático e aplica check congelado, lint e bundle por função em imagens fixadas por digest. | YAML e descoberta estática validados localmente; a primeira execução no GitHub continua obrigatória e bloqueia release. |
| FIX-109 | O uploader passou a ler, com limite de 16 KiB e validação de JSON, o corpo de `FunctionsHttpError` que o SDK mantém em `error.context`; falhas de rede/relay e HTTP 5xx bloqueiam reenvio cego e exigem reconciliação. Laudo inexistente e laudo de outro usuário agora produzem a mesma resposta. | Remove perda de erro sanitizado e um oracle de existência sem trocar o protocolo V1. O fluxo transacional/idempotente e os status semânticos permanecem em S2. |
| FIX-110 | Datas civis do blog ganharam parser estrito e formatação UTC estável; foi criado `global-error.tsx`; WhatsApp deixou de aparecer em Auth/Lab/Portal/Admin/Dashboard; timers pendentes passaram a ser cancelados; o cookie de recovery foi restrito à rota de redefinição. | Gate daquele ciclo: 102/102 contratos, build de 37 superfícies, predeploy 69/73 e cross-browser 9/9. As três lacunas locais então registradas foram tratadas nos FIX-111–FIX-113. |
| FIX-111 | Datas de coleta/resultado extraídas por IA passaram a aceitar somente datas civis ISO reais ou `null`; a evolução ordena por coleta válida, usa upload em `America/Sao_Paulo` apenas como fallback explicitamente rotulado e desempata por upload/ID sem inventar cronologia. | Casos de ano bissexto, data impossível, campo ausente, timestamp inválido e empate determinístico passaram; validação clínica do PDF real continua obrigatória em staging. |
| FIX-112 | A recuperação de senha ganhou endpoint POST server-side que consome o marcador HttpOnly em todas as respostas, verifica origem quando presente, revalida sessão/papel persistido e limita o destino a `/lab` ou `/portal`; falha de conclusão usa login como fallback sem alegar que a troca de senha falhou. | Contratos unitários, build e E2E anônimo passaram; o ciclo PKCE autenticado real e a configuração Auth/SMTP remota continuam pendentes. |
| FIX-113 | Demo, contadores e carrossel passaram a compartilhar uma política fail-closed de movimento: sem loops fora da viewport, em aba oculta/sem foco ou com movimento reduzido; interação manual pausa autoplay, timers preservam progresso e controles possuem alvos adequados. | Browser real em 390×844/768×1024 sem overflow e quatro E2E de runtime passaram no build de produção. Os contadores e o carrossel foram posteriormente substituídos por conteúdo estático no FIX-114. |
| FIX-114 | Métricas e depoimentos clínicos sem evidência versionada foram retirados da home e substituídos por princípios verificáveis e uma política pública de evidências; a demonstração passou a declarar dados fictícios, quatro relações `aria-labelledby` receberam alvos reais e duas ilhas cliente com timers/autoplay foram convertidas em conteúdo estático renderizado no servidor. | Contratos impedem a regressão de “500+”, “98%”, nomes, desfechos removidos e `aria-labelledby` sem alvo; Browser real em desktop, 390×844 e 768×1024 ficou sem overflow/error/warning; 105/105 unitários, Chromium atual 75/82 e cross-browser de produção 9/9. |

## 4. Findings que bloqueiam produção

### P0 — histórico de escalada de papel exige auditoria dos dados existentes

**Fato confirmado no código:** a migration inicial copiava `raw_user_meta_data.role` controlável pelo usuário ao criar `profiles` e a policy inicial de update permitia ao titular atualizar a própria linha inteira (`20260531000000_full_schema_setup.sql:39-43,184-190`). O hardening posterior passou a criar usuários como `tutor` e bloqueou mudança de papel/cota (`20260623000100_auth_rls_hardening.sql:15-20,28-58`).

**Incerteza crítica:** o repositório não contém migration ou evidência remota que reconcilie perfis promovidos antes do hardening. Isso não prova exploração, mas impede afirmar que os papéis atuais são íntegros.

**Gate:** consulta somente leitura de todos os `vet/admin`, origem/data/aprovação humana de cada promoção, revisão de eventos Auth/auditoria e revogação de sessões quando necessário. Não executar downgrade/backfill automático: um erro pode retirar acesso legítimo ou ocultar incidente.

### P0 — isolamento de dados clínicos ausente

**Evidência:** `supabase/migrations/20260623000100_auth_rls_hardening.sql:116-166` e `20260623000200_schema_drift_completion.sql:63-110`.

As policies verificam somente se o usuário possui papel `vet` ou `admin`. As tabelas centrais não apresentam uma fronteira consistente como `clinic_id`, `owner_vet_id` ou membership. Isso é incompatível com menor privilégio e pode produzir acesso horizontal indevido a PII e dados clínicos.

**Correção exigida:** executar o desenho de [ADR-001 — tenancy clínica e RLS](architecture/ADR-001-tenancy-clinica-rls.md): `clinic_memberships` como autoridade, `clinic_id` obrigatório, FKs compostas, Storage vinculado à reserva/laudo e matriz Vet A × Vet B. A mudança deve seguir `expand → backfill revisado → validação → enforcement → contract`, com rollback fail-closed.

### P0 — motores clínicos inseguros, agora contidos

**Estado:** risco de exposição mitigado nas rotas; **bloqueador para reativação**. As páginas exibem somente aviso de revisão, não possuem controles/resultados clínicos, usam `noindex` e não aparecem no sitemap.

| Falha confirmada | Evidência reproduzível | Impacto |
|---|---|---|
| Volume de fluidos de 24 h superestimado | `FluidoterapiaCalculator.tsx`: a taxa contém `déficit/horas`, depois é multiplicada por 24. Cão 10 kg, 9% e 8 h: 3.442 mL exibidos versus 1.642 mL por fases, **+109,6%**. | Sobrecarga volêmica, especialmente perigosa em paciente renal. |
| Choque e reidratação somados no mesmo período | O motor soma bolus/choque, déficit e manutenção; presets permitem correção em 4–8 h. | Administração simultânea sem reavaliação e excesso de volume. |
| KCl sugerido em hipercalemia | Qualquer K ≥ 3,5, inclusive 6–8, cai em faixa com adição de KCl. | Arritmia e parada cardíaca. |
| Concentração de K rotulada 10× acima | Valor multiplicado por 1.000 e mostrado como `mEq/100 mL`; deveria ser ×100 ou `mEq/L`. | Erro de preparo/administração. |
| Fósforo com unidade incompatível | Taxa multiplicada pelo peso vira mmol/h, mas permanece rotulada mmol/kg/h. | Dose aparente multiplicada pelo peso. |
| Cálcio sem limite específico por produto | Gluconato e cloreto aceitam a mesma faixa de 0,1–3 mL/kg. | Sobredose, arritmia e necrose, principalmente com CaCl₂. |
| Bicarbonato negativo | HCO₃ medido acima do alvo produz déficit e volumes negativos. | Resultado prescritivo sem sentido. |
| Tabelas de dieta desatualizadas/extrapoladas | Ex.: Hill felino, 4 kg: ferramenta 46 g/dia versus fabricante 60 g/dia, **−23,3%**; valores fora de tabelas são interpolados até 200 kg. | Subalimentação e perda de peso/massa muscular. |

**Correção exigida:** motores puros separados da UI; análise dimensional; casos de fronteira e golden cases; catálogo nutricional versionado por SKU/país/data; duas revisões clínicas independentes e assinatura formal de intensivista/nefrologista/nutricionista veterinário antes de qualquer reativação. A AAHA 2024 enfatiza prescrição individualizada, fases separadas, reavaliação e prevenção de sobrecarga.

### P0 — processamento de laudo não é uma transação idempotente

**Evidência:** `supabase/functions/parse-laudo/index.ts:508-668` e `20260626010000_ai_quota_rpc_and_parse_laudo_hardening.sql`.

Status/resultado são gravados antes do consumo de cota. A RPC torna o incremento atômico, mas o conjunto “reservar processamento, chamar provedor, validar JSON, salvar resultado, consumir/refundar cota” não é atômico e não possui chave de idempotência. Repetições concorrentes podem desperdiçar custo ou deixar estados inconsistentes.

**Correção exigida:** RPC transacional de claim/finalize, estado `processando` com lock/lease, idempotency key, limite de tentativas, compensação explícita e auditoria. O caminho de Storage deve ser derivado no servidor a partir do registro autorizado, não confiado ao cliente.

Há uma segunda superfície no mesmo agregado: `vet_update_own_laudos` autoriza o dono a atualizar a linha inteira pela Data API (`20260623000100_auth_rls_hardening.sql:200-211`). Assim, campos controlados pelo servidor como `status`, `resultado_ia`, `erro_ia`, `pet_id` e `storage_path` podem ser forjados por um cliente autenticado. RLS limita linhas, não colunas. O contrato final deve revogar update direto nesses campos e expor apenas RPCs estreitas/validadas; fazer isso antes de mapear todos os consumidores pode quebrar o uploader e, por isso, pertence ao rollout transacional de S2.

### P0 — interpretação de laudo por IA não possui proveniência clínica suficiente

O schema atual transporta números sem unidade, intervalo de referência, método, confiança ou evidência de página (`supabase/functions/parse-laudo/index.ts`) e, mesmo com validação recursiva estrita de tipos/campos/tamanho, ainda não comprova correspondência semântica com o PDF. Uma saída estruturalmente válida pode atribuir um número ao analito errado ou omitir a origem de página.

**Contenção aplicada:** o prompt agora proíbe diagnóstico/tratamento/estadiamento e `estadiamento_iris_sugerido` é forçado a `null` antes da persistência/retorno, com guardrail unitário. Resultados históricos não foram alterados. O recurso continua **não homologado** até adotar extração por analito com valor + unidade + referência + página, validação determinística contra o PDF e revisão humana.

### P1 — replay local provado; paridade, histórico e grants funcionais de staging permanecem abertos

O replay DB-only local foi concluído em PostgreSQL 17.6.1: as 11 migrations ativas aplicaram do zero, 17 invariantes pgTAP passaram, a FK de `colaboradores.supabase_uid` recebeu índice e os privilégios administrativos de `anon`/`authenticated` foram revogados. Lint de `public,private` e advisors de segurança/desempenho ficaram sem finding de projeto. Warnings da função Supabase-managed `storage.search_by_timestamp` foram separados e não motivaram alteração indevida no schema `storage`.

Isso não comprova paridade hospedada. A migration historicamente aplicada `20260625051920_rls_performance_advisor_cleanup.sql` está diferente no worktree, e a tabela de histórico da CLI registra versão/nome, não um checksum semântico usado por este projeto. O manifesto SHA-256 agora sela o baseline atual e registra a única transição histórica conhecida, mas declara `remoteAttestation: false` porque não existe artefato remoto confiável para comparação. **Gate restante:** decisão formal e evidenciada sobre o drift histórico, replay sobre baseline/cópia anonimizada autorizada, pacote de staging, Data API real e matriz de permissões por papel/tenant. Nunca executar reset em produção.

As tabelas centrais `profiles`, `tutores`, `pets`, `colaboradores` e `laudos_pdf` continuam sem grants DML mínimos, enquanto o app as acessa via `supabase-js`/Data API; localmente, apenas `triagens` e `follow_ups` mantêm DML para `authenticated`. Conceder agora faria as policies globais de vet/admin virarem BOLA operacional. O rollout de tenancy deve versionar `GRANT`/`REVOKE` junto de RLS e testar a Data API, sem conceder privilégio a `anon`; até lá, a falha `42501` é contenção fail-closed e também bloqueador funcional.

### P1 — deleção/compensação de Storage e bucket não são determinísticos

O hardening remove policies de DELETE de `storage.objects`, mas recria apenas INSERT e SELECT (`20260623000100_auth_rls_hardening.sql:220-252`). O rollback do uploader pode, portanto, deixar PDF órfão quando a criação do registro falha. A UI deve tornar a falha de cleanup observável, e S1 deve criar deleção/RPC tenant-aware com teste de resíduos. A criação do bucket também usa `ON CONFLICT DO NOTHING` (`20260531000000_full_schema_setup.sql:291-293`), que não corrige bucket preexistente público, MIME ou limite incorretos; o gate de staging precisa afirmar a configuração efetiva.

### P1 — ciclo de quota/lease permanece incompleto

`ai_quota_reset_date` é criado, mas não há rotina versionada de reset; `processando` não possui lease/expiração. O catch agora só marca erro quando a linha ainda está `processando`, portanto não sobrescreve um resultado já concluído. Ainda assim, se a quota falhar depois do resultado salvo, a resposta ao cliente e a cobrança divergem e não existe marcador durável de reconciliação. Esse risco e o custo duplicado sob retry são parte obrigatória do contrato claim/finalize/refund de S2.

### P1 — integridade referencial, PII e ciclo de vida dos dados

- `colaboradores_select_active_or_admin` permite a qualquer autenticado ler linhas ativas, incluindo email, telefone e CRMV (`20260625051920_rls_performance_advisor_cleanup.sql:59-71`). Separar diretório público mínimo de dados privados e aplicar tenancy/menor privilégio.
- `triagens` carrega `pet_id` e `tutor_id`, mas nenhuma constraint garante que o tutor seja o dono daquele pet (`20260623000200_schema_drift_completion.sql:14-24`). A inconsistência pode associar dados clínicos a pessoa errada.
- Cascatas entre pets, laudos, triagens e follow-ups não estão coordenadas com retenção/auditoria nem com a limpeza de Storage. Definir soft-delete/legal hold/expurgo verificável antes de exclusão real.
- `subscriptions` é tratada condicionalmente, mas nenhuma migration ativa cria a tabela; uso amplo de `IF NOT EXISTS` pode aceitar objeto preexistente incompatível. O reset/diff deve rejeitar drift estrutural, não apenas concluir sem erro.

### P1 — configuração Auth/Edge remota não reconciliada

`supabase/config.toml` local agora declara senha mínima de 8 caracteres e troca segura de senha, mas mantém signup aberto, confirmação de email/MFA e restrições de rede desativadas, além de PostgreSQL 17. Isso é evidência da configuração local, **não prova** o estado remoto. O formulário exige oito caracteres e o autocadastro agora só solicita papel `tutor`, mas o contrato final deve ser coerente em todos os ambientes. A Edge Function exige perfil `vet/admin`, deixou de emitir `Access-Control-Allow-Origin` para origem desconhecida e possui imports exatos, lock v4, `verify_jwt=true`, check/lint/bundle aprovados no runtime local fixado. Ainda faltam origens explícitas de staging/preview e execução HTTP com Auth/Storage/provedores no Supabase hospedado. S0/S5 devem reconciliar Dashboard × config versionada e testar o contrato sem expor detalhes.

### P1 — onboarding profissional não implementado

O código não possui fila de solicitação, verificação de CRMV/identidade, aprovador, trilha de auditoria, expiração/revogação nem promoção administrativa versionada para médicos-veterinários. O uso anterior de `requested_role` em metadata não era uma autoridade segura e foi removido do autocadastro público; a opção profissional e os CTAs foram contidos para não prometer um fluxo inexistente.

**Gate:** definir processo humano e técnico de solicitação→verificação→aprovação→provisionamento→revogação, com menor privilégio, dupla checagem para papéis privilegiados, registro imutável de aprovador/motivo/timestamp e teste de tentativa de autoelevação. Até lá, contas profissionais só podem ser provisionadas em staging por procedimento controlado e dados sintéticos.

### P1 — fluxos autenticados e integração remota sem evidência suficiente

Os testes públicos comprovam redirecionamento anônimo, não isolamento real. CRUD Lab, Auth, Storage e IA dependem de ambiente seguro de QA. O teste chamado `auth-rls` não substitui uma matriz com dois tenants.

### P1 — autorização profissional parcialmente no cliente

**Evidência:** `web/src/components/ferramentas/VetOnlyGate.tsx`.

O proxy do Lab/Admin/Portal agora autoriza papéis no servidor e falha fechado. Porém `VetOnlyGate`, usado em ferramentas profissionais públicas, ainda consulta sessão/perfil no navegador; embora timeout/retry tenham sido corrigidos, código/conteúdo de valor clínico não deve depender de ocultação client-side. API/RLS e renderização de servidor devem ser a autoridade; o cliente apenas representa o resultado.

### P1 — consistência de formulários e mutações Lab

Timeout, rede, resposta não JSON, sessão expirada, zero linhas afetadas e mensagens internas foram corrigidos nas superfícies revisadas. Tutor/paciente agora bloqueiam um segundo envio cego quando o resultado remoto é ambíguo e exigem conferência da lista; isso é contenção de UX, não prova de idempotência. O antigo fluxo de óbito fazia três operações independentes e podia afirmar que comunicações futuras estavam pausadas sem comprovação; foi removido do cliente, o PATCH genérico agora recusa transições para/de `obito` e a UI informa que a função está em revisão. A inativação de paciente usa a API server-side e compara o status lido com o status atualizado para detectar concorrência. Criar tutor/paciente requer, depois de S1, `Idempotency-Key` separado e escopado por clínica+ator+operação, fingerprint server-side em ledger privado e claim+insert numa RPC única; óbito + encerramento de triagens + supressão de follow-ups também requer RPC transacional e trilha imutável. A RLS global ainda permite que um vet/admin contorne a UI pela Data API, portanto a contenção não substitui S1. As telas autenticadas ainda não foram exercitadas contra staging.

### P1 — homologação clínica incompleta

IRIS/AKI receberam correções de referência. Fluidoterapia, eletrólitos e dieta foram contidos após a confirmação dos oito P0 acima. Qualquer calculadora que sugira dose, dieta ou conduta precisa de validação formal por médico-veterinário habilitado, tabela de fonte/versão/unidade e testes de limites. O software deve permanecer apoio à decisão, nunca diagnóstico ou prescrição automática.

### P1 — privacidade e operação LGPD incompletas

Faltam fluxo verificável de exclusão/exportação, matriz de retenção, base legal por finalidade, DPA/contratos com subprocessadores, gestão de incidentes, identificação formal de controlador/operadores/encarregado quando aplicável, canal testado, backup/restauração, RTO/RPO e evidência de revogação. As páginas públicas agora declaram essas lacunas e estão marcadas como preliminares; texto correto não substitui controles técnicos nem parecer jurídico.

### P1 — pipeline remoto vermelho e gate de staging ausente

Os seis runs públicos mais recentes do GitHub estavam em falha na verificação de 2026-07-17; o último SHA remoto `ad6f58c` falhou em lint/testes e os novos jobs locais de banco, Edge e UI pública ainda não foram executados no GitHub. Também não existe workflow manual ligado a um `environment: staging` protegido para `audit:staging`, readiness remoto e os ciclos Auth/RLS, CRUD e Upload/IA. Publicação, PR, configuração de secrets e alteração de branch protection não foram autorizadas nesta auditoria.

**Gate:** abrir PR somente após autorização, exigir todos os workflows novos verdes e criar gate manual de staging, read-only por padrão, com aprovação humana e secrets isolados. Fluxos mutantes/destrutivos devem permanecer separados e exigir confirmação explícita.

### P1 — concorrência otimista remota ainda incompleta

O PATCH de tutor ainda filtra apenas por ID. O PATCH de paciente compara o status esperado, mas essa proteção parcial não cobre nome, peso, raça, tutor, idade, duas gravações do mesmo status nem uma alteração concorrente de campo não usado no predicado. As páginas não carregam um token de versão e o helper de mutação não envia precondição; o perfil do profissional também grava diretamente em last-write-wins. Duas sessões podem, portanto, perder uma atualização sem aviso.

O contrato recomendado é `revision bigint` monotônica, ETag forte e `If-Match`, com UPDATE atômico por `id + revision`, `428` sem precondição, `400` para tag inválida, `409 REVISION_CONFLICT` para revisão obsoleta e `404` indistinguível para linha ausente/invisível pela RLS. O rollout precisa ser expand→migração de consumidores→prova concorrente em staging→contract; exigir o cabeçalho imediatamente sem inventário de clientes externos seria breaking change. A revisão não corrige BOLA e pode ser contornada por UPDATE direto enquanto tenancy, grants/RLS e a autoridade de escrita não forem fechados, por isso a migration não foi criada nesta auditoria.

### P1 — cronologia clínica sem contrato canônico

**Contenção local concluída no FIX-111.** `data_coleta` e `data_resultado` aceitam somente data civil ISO real ou `null`; a evolução ordena por coleta válida, usa o upload em `America/Sao_Paulo` somente como fallback rotulado e desempata por upload/ID, sem reinterpretar dados clínicos legados ausentes ou inválidos. O risco residual é operacional: ainda falta provar o contrato com PDFs sintéticos/reais autorizados e histórico hospedado em staging.

### P1 — alegações públicas sem evidência versionada

O repositório não contém fonte, metodologia, data de medição ou consentimento comprovável para as antigas métricas “500+”/“98%” e seis depoimentos nominais com desfechos clínicos. Não foi inferido se eram verdadeiros ou falsos: o FIX-114 removeu essas alegações da saída pública, substituiu-as por compromissos verificáveis e identificou a demonstração como fictícia. Qualquer reintrodução exige dossiê versionado de fonte/metodologia/data, autorização específica, política de revogação e aprovação de Product/Legal/DPO; credenciais profissionais e demais alegações institucionais também devem entrar no mesmo inventário probatório.

## 5. Melhorias importantes, não bloqueadoras isoladamente

| Prioridade | Item | Evidência/impacto |
|---|---|---|
| P3 | Arquivar fontes de marca | Os logos renderizados usam WebP de 42–94 KB, mas PNG/SVG originais de 1,19–9,00 MB ainda ficam em `public`; mover as fontes para área não publicada após confirmar o fluxo de design. |
| P3 | Código visual morto | `PremiumBackground.tsx` não possui consumidor no projeto, mas contém canvas contínuo de 30–90 partículas, animações infinitas e classes sem definição local. Não reativar por import acidental: decidir entre remoção isolada ou reconstrução sob a política de movimento/visibilidade, com medição de CPU e `prefers-reduced-motion`. |
| P2 | Acessibilidade autenticada | Diálogos e sidebar revisados foram corrigidos; falta auditoria WCAG completa do Lab com leitor de tela e dados densos em staging. |
| P2 | Estados de erro | As consultas server-side auditadas agora diferenciam vazio/404 de falha de rede/RLS; completar o mesmo contrato nas superfícies restantes e oferecer retry observável. |
| P2 | Browser matrix | Chromium tablet, Firefox e WebKit passaram 9/9 localmente em servidor isolado, incluindo concorrência real entre abas; falta evidência do workflow remoto e da matriz autenticada multi-browser. |
| P2 | CSP | `'unsafe-eval'` e acesso direto à OpenAI foram removidos; ainda é preciso eliminar gradualmente `'unsafe-inline'`, restringir `img-src`/hosts Supabase e validar nonces/hashes. |
| P2 | SEO/performance | Sitemap, robots e indexação foram corrigidos; falta Lighthouse/LCP/CLS, orçamento de assets e link checker externo. |
| P2 | Health/readiness | Liveness e readiness local estão separados; testar conectividade real e alertas em staging sem expor segredos. |
| P2 | Contrato HTTP da Edge | O consumidor dual-stack já lê `FunctionsHttpError` e contém resultados desconhecidos; a V1 ainda usa HTTP 200 para vários erros lógicos. Adicionar códigos tipados e envelope aditivo, criar `parse-laudo-v2` com 400/404/409/429/502/503 e validar por feature flag sem fallback automático para V1. |
| P2 | Tipos do banco | `database.types.ts` da Edge é mínimo/manual; gerar e comparar tipos após o replay, ou adicionar contratos SQL de colunas/nulabilidade/RPC para impedir drift silencioso. |
| P2 | Datas civis e timestamps | O blog usa agora data civil estrita/UTC. Aplicar contrato distinto aos dados clínicos somente após saneamento e testar meia-noite UTC/São Paulo/Kiritimati para impedir deslocamento ou reordenação. |
| P2 | Movimento e CPU | Cleanup de timeout/interval/rAF confirmado foi corrigido; ainda criar política única para pausa por foco/toque/aba oculta/viewport e `prefers-reduced-motion`, com E2E que prove os loops JavaScript. |
| P2 | Erro global/telemetria | O boundary raiz autossuficiente foi criado e não serializa mensagem/stack; falta transporte operacional sanitizado, alertas e teste induzido em ambiente controlado antes de afirmar notificação. |
| P2 | Recovery | O cookie HttpOnly foi restrito à rota de redefinição; limpar/consumir após sucesso via ação/endpoint server-side e validar redirecionamento final por papel em PKCE real. |
| P2 | Supply chain | Dependabot, SBOM e verificação de lock foram adicionados; ainda ativar branch protection/checks obrigatórios, Secret Scanning/Push Protection, CodeQL/Dependency Review, assinatura do SBOM e lock Python com hashes. |
| P2 | Framework AIOX | Vulnerabilidades diretas foram corrigidas e a cópia foi marcada privada; versões, build/test/lint/typecheck, 19/35 paths, IDE sync, links e templates continuam incoerentes. Ver [auditoria dedicada do AIOX](aiox-root-config-audit-2026-07-16.md). |
| P2 | Wrappers de agentes/IDEs | Frontmatter, orientação de segredo e os 12 links da matriz de autoridade foram corrigidos; ainda regenerar 48 arquivos com encoding suspeito e o workspace absoluto remanescente usando fonte AIOX canônica homologada. |
| P2 | Paginação/busca | Pacientes, tutores, animais e histórico de laudos agora usam busca/contagem/paginação estável e limites explícitos; validar índices e testes com bases densas e migrar para cursor/keyset se concorrência ou volume tornarem o offset inadequado. |
| P2 | Validação CPF/PII | CPF opcional ainda tem validação fraca; Product/DPO devem decidir necessidade/base legal e, se mantido, aplicar normalização/validação server-side sem registrar o valor em logs. |
| P2 | Edge/runtime | Versões exatas, lock v4, check/lint e bundle local foram concluídos; preservar esses gates, corrigir a formatação histórica em diff isolado e testar CORS/semântica HTTP/Auth/Storage/provedores no ambiente hospedado. |
| P2 | Contratos do banco | Adicionar `CHECK`/domínios versionados para limites de perfil e demais textos validados apenas na UI/API; provar compatibilidade em reset efêmero antes de promover. |
| P2 | Matriz das APIs | Cobrir funcionalmente `400/401/403/404/415/503/201`, falha do banco e resposta sem linha para cada handler; os testes estruturais atuais não substituem integração com Data API. |
| P3 | Persistência local | O last-write-wins foi eliminado com documento v2, Web Locks, revisão e conflito explícito. Antes de ampliar volume/offline, medir quota e considerar IndexedDB com a mesma revisão/idempotência; manter teste de compatibilidade que bloqueia abas antigas sem apagar o backup legado. |
| P2 | PDF e strings extremas | Testar nomes de paciente/tutor/laboratório/parâmetro nos limites no PDF e quebrar/truncar cabeçalho de forma determinística sem perder o dado clínico. |
| P2 | Auditoria clínica | Registrar versão da diretriz, inputs, resultado, usuário e timestamp sem armazenar mais dados que o necessário. |
| P3 | Documentação | O índice e os banners definem o relatório atual como autoridade; consolidar ou arquivar definitivamente o conteúdo contraditório legado. |
| P3 | Tema/contraste | `prefers-reduced-motion`, `resolvedTheme`, Auth, cadastro, páginas legais e principais telas Lab foram corrigidos; ainda validar contraste e todos os estados autenticados com dados reais sintéticos em staging. |

## 6. Responsividade e frontend

Foram validados desktop (1440×900, 1280×720 e 1024×768), tablet (768×1024) e celular (390×844). Não houve overflow horizontal nos fluxos públicos cobertos. O tablet usa o menu acessível até o breakpoint `lg`, eliminando a quebra dos rótulos observada em 768 px. Navegação mobile, skip link, foco/Escape, reduced motion, formulários de autenticação, CTAs, diretório de ferramentas, ferramentas locais e redirecionamento anônimo do Lab passaram. A rodada final reinspecionou cadastro, login, recuperação, redefinição, páginas legais e o fluxo completo da planilha gratuita em claro/escuro; confirmou cadastro paciente→exame→tabela, estado neutro sem referência, nome legível no hero móvel, logo com contraste, controles 44×44, nomes acessíveis, textos longos, console sem error/warning e ausência de overflow. No reteste do FIX-93, o modal móvel ocupou 366 px dentro da viewport de 390 px, manteve o foco inicial correto e não gerou overflow; tablet e desktop também ficaram sem overflow e sem botões visíveis abaixo de 44 px. A matriz pública isolada passou em Firefox, WebKit e Chromium tablet, inclusive no conflito determinístico entre duas abas.

O resultado não cobre integralmente as telas autenticadas do Lab com dados remotos. Essas telas devem ser repetidas no staging com tabelas densas, nomes longos, teclado, leitor de tela e estados loading/empty/error.

## 7. Quality gates executados

| Gate | Resultado |
|---|---|
| `npm run lint` (`web`) | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 105/105 |
| Audits npm raiz/web/AIOX/dashboard | PASS — 4/4, 0 vulnerabilidades conhecidas |
| `npm run build` | PASS — 38 superfícies compiladas |
| `npm run check:predeploy` | PASS na última execução monolítica no build de produção — supply chain, integridade de migrations/Edge, sintaxe, lint, tipos, 105/105 testes, build e 74/78 Playwright Chromium; 4 fluxos autenticados remotos ignorados explicitamente. A nova regressão E2E foi adicionada depois e deve estar incluída na próxima execução monolítica antes de qualquer deploy. |
| Playwright completo | PASS — 75/82 no Chromium, 1 worker; 7 cenários de Auth/Lab/IA que exigem staging foram ignorados de forma explícita |
| Playwright tablet | PASS — Chromium 768×1024 validado no layout responsivo e 3/3 no projeto cross-browser tablet |
| Firefox/WebKit/corrida multiaba | PASS local no build de produção — Chromium, Firefox e WebKit 3/3 cada; matriz cross-browser 9/9 em porta própria. Workflow remoto ainda sem evidência |
| Inspeção visual Browser | PASS — 1440×900, 1280×720, 768×1024 e 390×844 nas rodadas; sem overflow/error/warning de aplicação; menu/tema, Auth, redirect anônimo, títulos SEO, textos longos, foco, modal e pausa de movimento confirmados |
| GitHub Actions remoto | FAIL/BLOQUEADO — seis runs públicos recentes vermelhos; workflows novos e jobs DB/Edge/UI ainda não executados remotamente |
| `npm run audit:staging` | PASS em modo plano — 4 SQLs verificados, `networkConsulted: false`, nenhuma conexão ou mutação; o runner agora falha quando o contrato final contém `passed:false` |
| Pack SQL de staging em PG17 local | PASS de compilação/runtime — 4/4 em transação read-only/rollback; resumo correto: NO-GO por tenancy, DELETE Storage e grants funcionais ausentes |
| `git diff --check` | PASS |
| Links Markdown locais | PASS — nenhum destino relativo ausente em `docs` |
| Verificação de supply chain | PASS — 4 lockfiles, 1.113 entradas no registry oficial, SHA-512 e 6 scripts de lifecycle em allowlist revisada |
| SBOM CycloneDX | PASS — versão 1.5, 216 componentes de produção; geração também configurada no CI |
| Audit/configuração AIOX | PARCIAL — vulnerabilidades em zero e pacote privado; build/test/lint/typecheck internos e sync estrito continuam reprovados/ausentes |
| Integridade das migrations | PASS local — 11 hashes SHA-256 e uma transição histórica conhecida; validação append-only contra Git passou, sem alegar igualdade remota |
| `parse-laudo` no Deno/Edge Runtime | PASS local — `deno check --frozen`, lint e bundle com cache limpo em imagens fixadas por digest; `deno fmt --check` permanece P2 e execução hospedada não ocorreu |
| Drafts SQL de tenancy/IA | PASS — sentinelas e checks estruturais; parser estático do draft IA; PostgreSQL real não executado |
| `supabase db reset --local --no-seed` | PASS — 11/11 migrations em PostgreSQL 17.6.1 local isolado; duas repetições limpas após as migrations novas |
| `supabase test db --local` | PASS — 17/17 invariantes pgTAP |
| `supabase db lint --local --schema public,private` | PASS — zero erro/warning de schema do projeto |
| Advisors Supabase locais | PASS — segurança e desempenho sem finding warn/error; índices sem uso em DB vazio tratados apenas como informação |
| Contrato DB do novo job de CI | PASS reproduzido localmente — CLI fixada, stack efêmera, 11/11 migrations, 17/17 pgTAP, lint e advisors; workflow remoto ainda não executado |
| `npm run check:remote-readiness` | FAIL-CLOSED esperado — sem rede: alvo/ref e senha de banco de staging ausentes, Deno fora do PATH; nenhuma lacuna foi tratada como aprovação |
| Reset/migrations em staging | NÃO EXECUTADO |
| Auth/RLS Vet A × Vet B | NÃO EXECUTADO |
| Storage/IA real | NÃO EXECUTADO |
| WebKit/Firefox | PASS local 9/9 na matriz de três engines; configurado no CI, ainda sem evidência do workflow remoto e sem sessão autenticada real |
| Backup/restore/rollback | NÃO EXECUTADO |

Durante a auditoria, gates intermediários detectaram expectativas E2E desatualizadas, dois 404 causados por nomes Unicode/parênteses em logos, navegação desktop espremida em 768 px, mensagens técnicas residuais em fluxos Auth/Storage/IA, reutilização indevida da porta 3000, saturação do servidor de desenvolvimento, títulos SEO duplicados, falha de consentimento quando storage é bloqueado, risco de captura analítica em rotas clínicas, health-check incompatível com grants, segredo Supabase aceito em variável pública, PATCH inexistente classificado como 500, redirect de provedor seguido, payload excessivo classificado como 400, controles de toque pequenos, datas civis deslocadas por fuso, timers sem cleanup, WhatsApp em rotas sensíveis, ausência de boundary raiz, payload HTTP Edge descartado pelo cliente, enumeração de laudo por mensagem, alegações legais não comprovadas, métricas/depoimentos clínicos sem evidência versionada, temas Auth/Lab incompletos, listas com truncamento silencioso, referência laboratorial falsamente normal, compressão do hero móvel, mutação clínica de óbito não transacional, perda silenciosa por concorrência entre abas, FK sem índice, defaults de grants excessivos, dois SQLs de auditoria incompatíveis com PostgreSQL 17, ausência de checksum das migrations e imports Edge flutuantes. As correções foram revalidadas; o reteste final passou com 105/105 testes, última execução monolítica do predeploy 74/78 com 4 skips remotos explícitos, Chromium atual 75/82 com 7 skips remotos, build de 38 superfícies, cross-browser de produção 9/9, replay 11/11, pgTAP 17/17, verificação append-only e check/lint/bundle Deno/Edge.

## 8. Plano de remediação por sprint

Os modelos abaixo seguem o [catálogo oficial atual da OpenAI](https://developers.openai.com/api/docs/models): “Sol” é reservado a arquitetura/risco alto, “Terra” à implementação e revisão, e “Luna” a tarefas determinísticas/documentais. Sempre manter revisão humana para segurança, banco e conteúdo veterinário.

**Estado em 2026-07-17:** a parte local de S0 foi ampliada pelos FIX-100–FIX-108 (produção real no Playwright, privacy fail-closed, validação de chave pública, health sem linha clínica, HTTP 404/413, redirect externo bloqueado, ledger histórico imutável e CI Edge por descoberta), mas o sprint só encerra quando o CI remoto estiver verde, houver staging isolado, reconciliação do drift e configuração remota comprovada. O boundary hardening local de S2 foi ampliado nos FIX-96/FIX-98/FIX-103/FIX-105/FIX-109/FIX-111, sem substituir a RPC transacional nem a prova hospedada. Em S4, a concorrência da planilha foi concluída no FIX-93; FIX-110–FIX-113 fecharam cronologia clínica segura, consumo do recovery e política local de movimento/visibilidade. O FIX-114 concluiu a contenção pública local de métricas/depoimentos sem evidência, mas a governança para qualquer publicação futura permanece em S6. S1–S6 permanecem pendentes ou parciais nos demais itens, e nenhuma evidência local substitui seus gates de tenant, clínica, LGPD e operação.

| Sprint | Duração | Objetivo e tarefas | Squad/agentes | Modelo recomendado | Gate de saída |
|---|---:|---|---|---|---|
| S0 — Contenção | 1–2 dias | congelar release; arquivar scripts RLS perigosos; corrigir dependências AIOX; fechar contrato de staging, secrets e providers; revisar diff atual | Tech Lead, Security, DevOps, QA | GPT-5.6 Terra; Sol para threat model | nenhum script legado alcança produção; staging isolado disponível |
| S1 — Tenancy/RLS | 5–8 dias | ADR de tenancy; `clinic_id`/membership; migration expand/backfill/contract; constraints/índices; RLS e Storage; testes Vet A × Vet B | Architect, DB Sage, Security, Backend, QA | GPT-5.6 Sol (xhigh) + Terra na implementação | matriz negativa completa; reset limpo; revisão humana de SQL |
| S2 — Laudos/IA | 4–6 dias | claim/finalize transacional; idempotência; path server-side; quota/reset; schema de saída; retry/circuit breaker; logs sem PII; avaliação Gemini/OpenAI | Backend, DB, AI Engineer, Security, QA | GPT-5.6 Sol no contrato; Terra no código | concorrência e falhas injetadas passam; sem bypass de quota/storage |
| S3 — Segurança clínica | 5–7 dias | revisar IRIS/AKI, fluidoterapia, eletrólitos, dieta e peso; fontes/versionamento/unidades; casos-limite; retirar prescrição automática | Nefrologista veterinário, Clinical Safety, QA, Frontend | GPT-5.6 Sol; decisão final humana | assinatura clínica formal e suíte de golden cases |
| S4 — Frontend/Auth/A11y | 4–7 dias | workflow profissional verificável; completar autorização server-side; erros/retries observáveis; mutações transacionais; reconciliar política de senha; validar paginação/índices e WCAG em matrizes autenticadas | IAM/Backend, Frontend, UX/A11y, Product Ops, QA | GPT-5.6 Terra; Sol para IAM | onboarding auditável; WCAG essencial; mobile/tablet/desktop autenticados; fronteiras >50/>200 e assets dentro do budget |
| S5 — Release Engineering | 4–6 dias | Supabase efêmero; migrations no CI; Chrome/Firefox/WebKit; CodeQL/secret/dependency review; assinatura do SBOM; Lighthouse; smoke pós-deploy e rollback | DevOps, Security, QA, Release Manager | GPT-5.6 Terra; Luna para matrizes/docs | pipeline reproduzível e verde; rollback ensaiado |
| S6 — Operação/LGPD | 3–5 dias | retenção/exclusão/exportação; subprocessadores; incidentes; alertas; backup/restore; RTO/RPO; runbooks e responsáveis | DPO/Jurídico, SRE, Security, Product | GPT-5.6 Sol para riscos; Luna para documentação | parecer jurídico; restore comprovado; on-call e alertas ativos |

Dependência principal: S1 precede S2, a idempotência de criações de S4 e os E2E autenticados de S4/S5. S3 pode avançar em paralelo apenas com ambiente e dados sintéticos.

### Matriz executável por tarefa

| Sprint | Tarefa | Agente principal | Squad/revisores | Modelo | Gate objetivo |
|---|---|---|---|---|---|
| S0 | Quarentenar `fix-laudos-storage.sql` e `apply-rls.js`; inventariar todos os caminhos operacionais | DevOps/Release | Security + DB Sage | GPT-5.6 Terra | busca de pipeline não encontra script legado executável; rollback documentado |
| S0 | Corrigir dependências e drift de `.aiox-core`; normalizar registry/lock | Supply-chain Security | DevOps + QA | GPT-5.6 Terra | audit sem alta/crítica; lock reproduzível; SBOM gerado |
| S0 | Auditar somente leitura todos os perfis `vet/admin` criados antes/depois do hardening e reconciliar cada promoção com aprovação humana | IAM Security | Product Owner + DPO + DB Sage | GPT-5.6 Sol | 100% dos papéis privilegiados possuem origem, aprovador e evidência; sessões suspeitas revogadas |
| S0 | Manter replay PG17 local, 17 invariantes pgTAP, pack de auditoria compatível com PG17 e hashes imutáveis das migrations | DB Sage/Release | Security + QA + DevOps | GPT-5.6 Terra | **parcial local concluído:** replay/lint/advisors/pgTAP e manifesto SHA-256 append-only verdes; falta reconciliar formalmente o drift histórico com staging |
| S0 | Publicar por PR apenas após autorização, executar os workflows novos e exigir todos os checks verdes | Release/DevOps | QA + Security + DB Sage + Platform | GPT-5.6 Terra | CI remoto verde no mesmo SHA; jobs Quality, Public UI, DB e Edge concluídos, branch protection aplicada |
| S0 | Criar workflow manual de staging, read-only por padrão, com GitHub Environment protegido e aprovação humana | Platform Engineer | Security + SRE + QA + Release | GPT-5.6 Terra; Sol no threat model | readiness e audit read-only passam; mutações ficam em workflow separado, confirmado e auditado |
| S1 | Converter ADR em migrations `expand` com `clinics`, membership, `clinic_id`, índices e FKs compostas | DB Sage | Architect + Security | GPT-5.6 Sol, raciocínio `xhigh` | revisão SQL de duas pessoas; reset efêmero verde |
| S1 | Backfill com quarentena de registros ambíguos e relatório de reconciliação | Data Engineer | Product Ops + DPO | GPT-5.6 Sol | zero atribuição automática sem evidência; contagens reconciliadas |
| S1 | Policies RLS/Storage fail-closed, grants explícitos mínimos, DELETE tenant-aware e afirmação da configuração do bucket | Security Engineer | DB Sage + Backend | GPT-5.6 Sol | Vet A × Vet B bloqueado em CRUD, Data API, Storage e Edge Function; cleanup sem órfão |
| S1 | Restringir PII de colaboradores e garantir por constraint que tutor/animal/triagem pertencem ao mesmo tenant | DB Sage | DPO + Backend + QA | GPT-5.6 Sol | diretório mínimo não expõe contato; combinações inconsistentes falham no banco |
| S1 | Suíte negativa multi-tenant e rollback ensaiado | QA Security | DB Sage + DevOps | GPT-5.6 Terra | matriz completa, resíduos zero, rollback não reabre acesso global |
| S2 | RPC `claim/finalize/refund` idempotente com lease e transação | Backend Lead | DB Sage + AI Engineer | GPT-5.6 Sol | concorrência/retry/falhas injetadas não duplicam custo nem resultado |
| S2 | Derivar path de Storage no servidor; restringir update direto de campos server-owned; implementar reset de quota/lease | Backend Security | DB Sage + QA | GPT-5.6 Sol | cliente não escolhe tenant/path/status/resultado; estados impossíveis e quota sem reset são bloqueados |
| S2 | Preservar os limites streaming, schema local estrito, CORS allowlist e proteção de estado do FIX-96 | Backend Security | AI Engineer + QA | GPT-5.6 Terra | **concluído localmente:** contratos, `deno check --frozen`, lint e bundle Edge passam; contrato HTTP/Auth/Storage e provedores reais ainda são gates de staging |
| S2 | Redesenhar extração IA com valor, unidade, referência, método e página; validar contra o PDF e auditar resultados históricos | AI/Clinical Safety Engineer | Patologista clínico veterinário + QA + DPO | GPT-5.6 Sol | cada dado tem proveniência verificável; nenhuma interpretação/IRIS automática sem revisão humana |
| S3 | Reescrever motor de fluidos por fases, reavaliação e unidades canônicas | Clinical Engineer | Intensivista + nefrologista veterinário + QA | GPT-5.6 Sol | análise dimensional + golden cases + dupla assinatura clínica |
| S3 | Reescrever eletrólitos por produto/contraindicação/unidade | Clinical Engineer | Intensivista + farmacologia veterinária + QA | GPT-5.6 Sol | hipercalemia/dose negativa/unidades inválidas sempre bloqueadas |
| S3 | Reconstruir catálogo nutricional versionado por SKU/país/data | Data/Clinical Engineer | Nutricionista veterinário + QA | GPT-5.6 Terra | 100% das quantidades rastreáveis à fonte; sem extrapolação silenciosa |
| S3 | Migrar histórico de peso para ID estável, ECC+MCS e política de privacidade | Product Engineer | Clinical Safety + DPO + UX | GPT-5.6 Terra | pacientes nunca se misturam; exportação/retensão/consentimento definidos |
| S4 | Mover autorização profissional para servidor/RLS | Backend Security | Frontend + QA | GPT-5.6 Sol | bypass do cliente não libera conteúdo/operação profissional |
| S4 | Implementar solicitação, verificação de CRMV/identidade, aprovação, provisionamento e revogação profissional com trilha auditável | IAM Engineer | Product Ops + Security + Jurídico/DPO + QA | GPT-5.6 Sol | autoelevação negada; toda promoção tem aprovador, motivo, evidência e timestamp; revogação testada |
| S4 | Tornar óbito/follow-up transacional e criar ledger privado de idempotência para tutor/paciente, escopado por clínica+ator+operação, com fingerprint server-side e RPC atômica | Backend Lead | DB Sage + Security + Frontend + QA | GPT-5.6 Sol no contrato/SQL; Terra no cliente/testes | 10 requests concorrentes geram uma linha; resposta perdida retorna o mesmo ID; payload/ator/tenant divergente recebe 409 genérico; rollback, hard-delete/tombstone e isolamento do ledger passam |
| S4 | Validar Lab autenticado em celular/tablet/desktop e leitor de tela | UX/A11y QA | Frontend + usuários veterinários | GPT-5.6 Terra | WCAG essencial e matrizes 390/768/1440 aprovadas |
| S4 | Reconciliar a política de senha local/remota e compartilhar o mesmo validador entre cadastro, reset e backend | IAM Engineer | Frontend + Security + QA | GPT-5.6 Terra | mínimo e composição coincidem em todos os ambientes; cadastro e reset passam com casos-limite |
| S4 | Testar paginação, busca e ordenação com bases sintéticas acima de 50/200 registros; revisar índices e adotar cursor/keyset quando necessário | Backend/Data Engineer | DB Sage + Frontend + QA | GPT-5.6 Terra | nenhum registro some/duplica; planos de consulta e latência aprovados |
| S4 | Completar matriz funcional das quatro APIs e versionar constraints de tamanho/domínio no banco | Backend QA | DB Sage + Security + Frontend | GPT-5.6 Terra | `400/401/403/404/415/503/201`, falha da Data API e resposta sem linha passam; UI/API/DB compartilham limites |
| S4 | Implantar `revision bigint` + ETag/`If-Match` em PATCH de tutor/paciente e reconciliar o mesmo risco no perfil | Backend Lead | DB Sage + Frontend + QA + Security | GPT-5.6 Sol no contrato/SQL; Terra nos clientes/testes | rollout expand/contract; uma de duas gravações com a mesma revisão vence e a outra recebe 409; 428/400/404 cobertos; UI preserva dados e reconcilia; corrida real passa sob RLS tenant-aware |
| S4 | Corrigir movimento automático, timers, targets e boundary raiz; normalizar datas civis/timestamps com testes de fuso | Frontend/A11y | UX + QA + Backend Clinical | GPT-5.6 Terra | **concluído localmente:** reduced-motion/foco/aba oculta/viewport, datas UTC/São Paulo, `global-error` e recovery server-side passam; repetir Lab autenticado em staging |
| S4 | Decidir e executar limpeza segura de `PremiumBackground`: remover código morto ou reconstruir como efeito opt-in, estático sob redução de movimento e pausado fora da viewport | Frontend Performance | UX + QA + Accessibility | GPT-5.6 Terra | nenhum import implícito; se mantido, orçamento de CPU/frames, `prefers-reduced-motion`, foco/aba oculta e mobile/tablet aprovados |
| S4 | Manter o FIX-93 contra last-write-wins: documento versionado, Web Locks, revisão esperada, backup legado e conflito explícito | Frontend Data Engineer | UX + QA + Privacy | GPT-5.6 Terra | **concluído localmente:** 7 contratos unitários de concorrência/migração e corrida real 3/3 browsers; preservar no CI e reavaliar IndexedDB antes de ampliar volume/offline |
| S5 | Supabase efêmero, migrations, pgTAP, Chrome/Firefox/WebKit e Lighthouse no CI | DevOps | QA + Security | GPT-5.6 Terra | **jobs DB/Edge implementados e reproduzidos localmente; browsers já configurados**; falta primeira execução remota, required checks, Lighthouse e rollback |
| S5 | Gerar/comparar tipos do banco, descobrir todas as Edge Functions e publicar traces/screenshots sanitizados somente em falha | Platform QA | DB Sage + Edge/Backend + AppSec | GPT-5.6 Terra | drift de tipo/função nova falha o CI; evidência tem retenção curta e nenhuma PII |
| S5 | Ativar CodeQL, Secret Scanning/Push Protection, Dependency Review, checks obrigatórios e assinar/arquivar SBOM por release | AppSec | DevOps + Release Manager | GPT-5.6 Terra | zero segredo e alta/crítica; artefato rastreável; rollback ensaiado |
| S5 | Reconciliar Auth/Postgres/CORS por ambiente, preservar imports/lock Edge exatos e testar contrato HTTP/observabilidade | Platform Engineer | Security + Backend + SRE | GPT-5.6 Terra | **reprodutibilidade local concluída**; config versionada coincide com staging, previews autorizados explicitamente e contrato hospedado aprovado |
| S5 | Transformar readiness em prova remota monitorada de Auth, Data API e Storage, sem PII nem mutação | SRE/Platform | Security + Backend + QA | GPT-5.6 Terra | falha de dependência produz `503`/alerta; liveness continua independente; nenhum secret é exposto |
| S6 | LGPD: bases legais, retenção, exportação/exclusão, DPA e incidente | DPO/Jurídico | Security + Product + SRE | GPT-5.6 Sol | parecer jurídico e evidência técnica de cada direito do titular |
| S6 | Governar métricas, depoimentos e credenciais: impedir reintrodução sem fonte, metodologia, data, consentimento e revogação | Product/Legal | DPO + Clinical Safety + Marketing + QA | GPT-5.6 Luna para inventário; Sol para risco | **contenção pública local concluída no FIX-114**; qualquer nova alegação possui dossiê/versionamento/consentimento e aprovação formal antes de publicar |
| S6 | Definir ciclo de vida/soft-delete/legal hold/expurgo e coordenar cascatas PostgreSQL × Storage | Data Governance | DB Sage + DPO + SRE + QA | GPT-5.6 Sol | exclusão preserva obrigação legal, não deixa órfão e produz trilha auditável |
| S6 | Backup/restore, RTO/RPO, alertas e on-call | SRE | DB Sage + Release Manager | GPT-5.6 Terra | restore cronometrado, alertas testados e runbook aprovado |

Use GPT-5.6 Luna apenas para normalização documental, checklists e matrizes determinísticas; decisões de banco, segurança e conteúdo clínico exigem Sol/Terra e aprovação humana. O catálogo de modelos foi reconfirmado em 2026-07-17.

## 9. Critérios objetivos para mudar de NO-GO para GO

1. Vet A não lê, altera ou exclui dados de Vet B em nenhuma tabela, API, Storage ou função.
2. Todas as migrations aplicam do zero localmente **e** sobre uma baseline/cópia anonimizada autorizada, com hashes reconciliados e rollback ensaiado. O primeiro subgate passou; os demais não.
3. Processamento de laudos é idempotente e não ultrapassa quota sob concorrência/falha.
4. Fluxos Auth/Lab/Storage/IA passam em staging com dados sintéticos e limpeza verificável.
5. Ferramentas clínicas recebem assinatura de veterinário responsável e golden tests.
6. LGPD, retenção, exclusão, subprocessadores e consentimento recebem validação jurídica/técnica.
7. Backup/restore, rollback, incidentes, monitoramento e alertas são exercitados.
8. Chrome, Firefox, WebKit, tablet e mobile passam sem P0/P1; acessibilidade essencial aprovada.
9. CI não contém vulnerabilidade crítica/alta, secret exposto ou migration não testada.
10. Onboarding profissional verifica, aprova, audita e revoga acessos sem permitir autoelevação.
11. Release Manager, Security, responsável clínico e Product Owner registram aceite.

## 10. Fontes técnicas e clínicas consultadas

- IRIS, [CKD Staging Guidelines 2026](https://www.iris-kidney.com/s/IRIS_staging_guidelines-2026.pdf).
- IRIS, [AKI Grading 2026](https://www.iris-kidney.com/s/IRIS-AKI-Grading_2026.pdf).
- AAHA, [2024 Fluid Therapy Guidelines for Dogs and Cats](https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/).
- Merck Veterinary Manual, [Eclampsia in Small Animals](https://www.merckvetmanual.com/metabolic-disorders/disorders-of-calcium-metabolism/eclampsia-in-small-animals).
- WSAVA, [Global Nutrition Guidelines](https://wsava.org/global-guidelines/global-nutrition-guidelines/).
- Supabase, [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [Storage ownership](https://supabase.com/docs/guides/storage/security/ownership) e [SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
- Supabase, [restrição de acesso aos schemas Auth, Storage e Realtime](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025).
- Supabase, [mudança de grants/autoexposição da Data API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), [fim do suporte ao PostgreSQL 14](https://supabase.com/changelog/45827-deprecation-notice-support-for-postgres-14-ending-on-1st-july-2026), [Securing your API](https://supabase.com/docs/guides/api/securing-your-api), [Password security](https://supabase.com/docs/guides/auth/password-security) e [configuração local da CLI](https://supabase.com/docs/guides/local-development/cli/config).
- Supabase, [dependências de Edge Functions](https://supabase.com/docs/guides/functions/dependencies), [configuração por função e verificação JWT](https://supabase.com/docs/guides/functions/function-configuration), [setup oficial da CLI em CI](https://github.com/supabase/setup-cli) e [Supabase CLI](https://github.com/supabase/cli).
- OpenAI, [Models](https://developers.openai.com/api/docs/models), [File inputs](https://developers.openai.com/api/docs/guides/file-inputs), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create) e [data controls](https://platform.openai.com/docs/guides/your-data).
- Google AI, [Gemini models](https://ai.google.dev/gemini-api/docs/models) e [deprecations](https://ai.google.dev/gemini-api/docs/deprecations).
- Fabricantes consultados para dieta: [Hill felina](https://www.hillspet.com.br/cat-food/prescription-diet-kd-kidney-care-dry), [Hill canina](https://www.hillspet.com.br/dog-food/pd-canine-kd-dry-current), [Premier felina](https://premierpet.com.br/produto/premier-nutricao-clinica-gatos-renal/), [Premier canina](https://premierpet.com.br/produto/premier-nutricao-clinica-renal-caes-portes-medio-e-grande/), [Farmina](https://www.farmina.com/pt/eshop/alimentos-para-c%C3%A3es/farmina-vet-life-canine/69-renal.html) e [Royal Canin](https://www.royalcanin.com/br/cats/products/vet-products/renal-special-feline-dry-3949).

## 11. Conclusão

O projeto evoluiu de uma base com gates quebrados e riscos clínicos/operacionais expostos para uma camada pública verificável, scripts perigosos contidos, três motores de alto risco suspensos, migrations ativas reaplicáveis em PG17 local, baseline selado por hashes append-only, Edge Function reproduzível e contratos DB/Edge integrados ao CI. Isso não promove os drafts de tenancy/IA nem prova o ambiente hospedado: o manifesto não possui atestação remota e continuam ausentes isolamento multiusuário em staging, grants funcionais pós-tenancy, transação integral de laudos, onboarding profissional auditável e homologação humana dos motores suspensos. A recomendação é concluir o gate remoto read-only de S0 e implementar/validar S1 antes de qualquer piloto, manter as três ferramentas clínicas indisponíveis e bloquear produção até os onze critérios de GO serem atendidos.
