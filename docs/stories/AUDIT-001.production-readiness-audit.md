# Story AUDIT-001: Auditoria integral e readiness de produção

## Status

InProgress

## Executor Assignment

```yaml
executor: "@qa"
quality_gate: "@po"
quality_gate_tools:
  - lint
  - typecheck
  - unit-tests
  - build
  - playwright
  - security-review
  - migration-review
  - release-checklist
```

## Story

**Como** responsável pelo lançamento do ecossistema Vet do Rim,  
**eu quero** uma auditoria integral e baseada em evidências do frontend, backend, banco, integrações, rotas, scripts, documentação, testes, segurança, responsividade e operação,  
**para que** o produto só seja colocado em produção após correção segura dos defeitos confirmados e registro explícito dos riscos e melhorias remanescentes.

## Contexto e escopo

Esta story deriva do pedido explícito de auditoria integral do sistema e do checklist de lançamento do PRD. O trabalho deve preservar comportamento existente, evitar alterações destrutivas e separar claramente: defeito confirmado, risco, hipótese, recomendação e item não verificável.

O fluxo de produto a verificar é: páginas públicas, autenticação, ferramentas e área Lab → rotas Next.js e integrações Supabase/OpenAI → persistência e RLS → resposta e renderização responsiva → observabilidade e operação em produção.

Referências de origem:

- `docs/prd/VETDORIM_PRD_ECOSYSTEM.md#10-checklist-de-lançamento`
- `docs/production-readiness-checklist.md`
- `docs/sprint-master-execution-plan.md`
- `docs/stories/EXECUTION_DASHBOARD.md`
- Solicitação do responsável pelo projeto nesta auditoria.

## Acceptance Criteria

1. O inventário cobre documentos, manifests e locks, configurações, scripts, rotas frontend/backend, migrations, funções Supabase, testes e artefatos de deploy existentes no repositório.
2. Cada finding contém severidade P0-P3, arquivo e linha quando aplicável, evidência reproduzível, impacto, correção proposta e estado (`corrigido`, `pendente`, `bloqueado` ou `não verificável`).
3. Correções de código são feitas apenas para falhas confirmadas, em mudanças pequenas, reversíveis e verificadas; alterações potencialmente disruptivas ficam como recomendação até aprovação e validação apropriadas.
4. As rotas e fluxos críticos são rastreados de ponta a ponta: UI → API/Server Action → serviço/dados → resposta → UI, incluindo estados de erro e autorização.
5. A experiência é verificada em desktop, tablet e celular, incluindo overflow, navegação, formulários, tabelas, modais, teclado e critérios essenciais de acessibilidade.
6. Os quality gates aplicáveis são executados e registrados: lint, typecheck, testes automatizados, build, E2E, segurança, migrations/RLS e readiness de produção. Gates indisponíveis ou dependentes de credenciais são explicitamente marcados como não verificados.
7. Nenhum segredo, dado pessoal ou dado clínico identificável é exposto em relatórios, logs ou evidências.
8. A documentação de operação inclui variáveis obrigatórias, deploy, rollback, observabilidade, incidentes, backup/restauração e validação pós-deploy, ou a ausência de cada item é registrada como finding.
9. O relatório final apresenta plano de remediação em sprints, dependências, squad/agente responsável, modelo recomendado, gates de entrada/saída e risco residual antes do go-live.
10. A checklist e a File List desta story são atualizadas antes do encerramento, e a decisão final de release é `GO`, `GO CONDICIONAL` ou `NO-GO`, sempre sustentada por evidências.

## 🤖 CodeRabbit Integration

### Story Type Analysis

**Primary Type**: Security  
**Secondary Type(s)**: Architecture, Integration, Deployment, Database, API, Frontend  
**Complexity**: High — abrange o fluxo completo, dados clínicos, autenticação, produção e múltiplas superfícies.

### Specialized Agent Assignment

**Primary Agents**:

- @qa — evidências, riscos, cobertura e verdict de qualidade
- @dev — correções pequenas e revisão pre-commit

**Supporting Agents**:

- @architect — contratos, fronteiras e decisões de alto impacto
- @data-engineer/@db-sage — migrations, RLS, integridade e desempenho SQL
- @ux-design-expert — responsividade, acessibilidade e fluxos
- @devops/@github-devops — CI/CD, Vercel, segredos, rollback e release
- @po/@sm — rastreabilidade, priorização e qualidade da story

### Quality Gate Tasks

- [ ] Pre-Commit (@dev): revisar apenas mudanças confirmadas e executar gates proporcionais ao risco.
- [ ] Pre-PR (@github-devops): executar CodeRabbit contra a base e confirmar ausência de issues CRITICAL.
- [ ] Pre-Deployment (@github-devops): validar configuração, segredos, migrations, rollback e smoke tests.

### Self-Healing Configuration

**Expected Self-Healing**:

- Primary Agent: @qa (full mode)
- Max Iterations: 3
- Timeout: 30 minutos por ciclo
- Severity Filter: CRITICAL, HIGH

**Predicted Behavior**:

- CRITICAL issues: correção automática apenas quando pequena, segura e integralmente verificável; caso contrário, bloquear release.
- HIGH issues: corrigir quando seguro; senão, documentar responsável, mitigação e gate de saída.

### CodeRabbit Focus Areas

**Primary Focus**:

- autenticação/autorização, RLS, validação de entrada, exposição de dados e segredos;
- contratos UI/API/dados, tratamento de erros, migrations e compatibilidade de deploy.

**Secondary Focus**:

- acessibilidade e responsividade mobile-first;
- cobertura útil de testes, observabilidade, rollback e documentação operacional.

## Tasks / Subtasks

- [x] 1. Preparar rastreabilidade e baseline (AC: 1, 2, 10)
  - [x] Inspecionar `docs/stories/` e criar esta story específica.
  - [x] Inventariar o repositório por domínio e registrar arquivos fora do escopo gerado/vendor.
  - [x] Registrar estado inicial do worktree e impedir sobreposição entre squads.
- [x] 2. Auditar Produto/QA/Release (AC: 1, 6, 8, 9)
  - [x] Revisar documentação, manifests/locks e configurações Next/Vercel/Playwright/ESLint/TypeScript.
  - [x] Revisar estratégia, cobertura e qualidade dos testes, runbooks e checklist de produção.
  - [x] Executar checagens read-only e registrar findings P0-P3.
- [x] 3. Auditar frontend e responsividade (AC: 4, 5, 6)
  - [x] Mapear rotas, layouts, estados, acessibilidade e breakpoints críticos.
  - [x] Verificar desktop, tablet e celular com evidência visual/automatizada.
- [x] 4. Auditar backend, integrações e segurança (AC: 4, 6, 7)
  - [x] Rastrear contratos, autenticação, validação, respostas e falhas.
  - [x] Revisar limites, timeouts, retries, idempotência e observabilidade.
- [ ] 5. Auditar banco, migrations e RLS (AC: 1, 4, 6, 7)
  - [x] Verificar ordem, atomicidade, compatibilidade, índices, constraints e rollback.
  - [ ] Validar isolamento entre usuários e menor privilégio com testes seguros.
- [x] 6. Corrigir e verificar (AC: 2, 3, 6)
  - [x] Corrigir apenas defeitos confirmados em mudanças pequenas e reversíveis.
  - [x] Conter fail-closed os três motores clínicos com P0, sem reescrever fórmulas sem homologação.
  - [x] Corrigir mistura de pacientes, datas futuras, storage silencioso e semântica de tendência no histórico de peso.
  - [x] Endurecer foco, diálogos, menu/sidebar móvel, reduced motion, SEO e tratamento de mutações no frontend.
  - [x] Rodar os gates afetados e registrar evidências e risco residual.
- [x] 7. Preparar decisão de release (AC: 8, 9, 10)
  - [x] Consolidar findings, sprints, squads/modelos e dependências.
  - [x] Emitir verdict GO/GO CONDICIONAL/NO-GO e atualizar checklist/File List.

## Dev Notes

### Evidências e restrições conhecidas

- O PRD define Next.js App Router, Supabase/PostgreSQL, Vercel, Resend, PostHog, RLS e responsividade/SEO como partes do produto. `[Source: docs/prd/VETDORIM_PRD_ECOSYSTEM.md#2-arquitetura-técnica-pragmatismo-extremo-para-solo-founder]`
- O checklist de lançamento exige Lighthouse, sitemap/robots, teste de isolamento RLS, DKIM/SPF e analytics. `[Source: docs/prd/VETDORIM_PRD_ECOSYSTEM.md#10-checklist-de-lançamento]`
- A Constituição exige lint, typecheck, testes e build bem-sucedidos antes de release. `[Source: .aiox-core/constitution.md#v-quality-first-must]`
- Mudanças de produção, deploy, push, PR e release permanecem sob autoridade de @devops; esta story não concede autorização para executá-las.
- Não há documentação de arquitetura shardada nos caminhos declarados por `.aiox-core/core-config.yaml`; a auditoria deve registrar esse drift e usar apenas os artefatos reais encontrados.

### Testing

- Gates mínimos do repositório: `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
- E2E deve cobrir fluxos públicos, autenticação, Lab CRUD, ferramentas, upload de laudos e layout mobile quando os pré-requisitos de ambiente estiverem disponíveis.
- Testes que usam dados reais devem usar contas e registros próprios de QA, mascarar evidências e limpar os dados com scripts controlados.
- A ausência de credenciais ou ambiente externo não equivale a aprovação; deve ser marcada como evidência ausente.

## Story Draft Checklist

| Category | Status | Notes |
|---|---|---|
| Goal & Context Clarity | PASS | Objetivo, valor e fluxo integral definidos. |
| Technical Implementation Guidance | PASS | Domínios, gates e responsáveis explicitados sem prescrever correções não confirmadas. |
| Reference Effectiveness | PASS | Referências apontam para seções e artefatos reais. |
| Self-Containment Assessment | PASS | Restrições, evidências, estados e edge cases de verificação estão definidos. |
| Testing Guidance | PASS | Gates e fluxos críticos estão listados; ambiente ausente não gera falso positivo. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos estão preenchidos. |

**Story readiness**: READY  
**Clarity score**: 9/10  
**Known gap**: a arquitetura shardada declarada no core-config não existe e deverá ser tratada como finding documental.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-07-16 | 0.1 | Story criada para rastrear a auditoria integral e o readiness de produção. | @sm / @po |
| 2026-07-16 | 0.2 | Auditoria consolidada, correções/contensão integradas, ADR de tenancy e gates finais atualizados. | @qa / @dev / @architect |
| 2026-07-16 | 0.3 | Scripts legados/E2E quarentenados, APIs/proxy/IA endurecidos, drafts S1/S2 e plano clínico entregues; gates repetidos. | @qa / @dev / @architect / @security |
| 2026-07-16 | 0.4 | Cleanup fail-closed, liveness/readiness, cross-browser CI, CSP, logos WebP e lock oficial integrados e revalidados. | @qa / @dev / @security / @devops / @ux |
| 2026-07-16 | 0.5 | Auth/consultas fail-closed, minimização de PII, breakpoint tablet, supply chain/SBOM/Dependabot e auditoria AIOX integrados; gate final repetido. | @qa / @dev / @security / @devops / @ux / @architect |
| 2026-07-16 | 0.6 | Inventário global reconciliado em 1.633 arquivos; segunda passagem de migrations/RLS/Storage, Auth/runtime, wrappers e contratos de IA consolidada. | @qa / @dev / @security / @db-sage / @architect |
| 2026-07-17 | 0.7 | Runner Playwright isolado da porta de preview, suíte ampliada para 35 unitários e revalidação final por componentes com 64/64 E2E e smoke pós-LCP 23/23. | @qa / @dev / @ux |
| 2026-07-17 | 0.8 | APIs clínicas e frontend autenticado endurecidos, fallback clínico removido, matriz de autoridade e auditoria read-only de staging adicionadas; inventário reconciliado em 1.645 e gate final em 49 unitários + 65 E2E executados. | @qa / @dev / @security / @db-sage / @ux / @architect |
| 2026-07-17 | 0.9 | Autorização da Edge Function, cleanup Auth, grants da Data API, onboarding, textos legais, storage local, scripts de assets e temas foram endurecidos; inventário 1.646, 58 testes, predeploy 65/65, Chromium 66/73 e cross-browser 6/6. | @qa / @dev / @security / @db-sage / @ux / @legal / @architect |
| 2026-07-17 | 1.0 | Tema/Auth/Lab, configuração local de senha, busca, contagem, paginação e fronteiras 50/200 foram endurecidos; gate final repetido com 61 testes, predeploy 65/65, Chromium 66/73 e cross-browser 6/6. | @qa / @dev / @security / @ux / @backend / @architect |
| 2026-07-17 | 1.1 | Recovery PKCE, IDs/paginação/APIs, storage local, referência laboratorial, contraste/touch targets e hero móvel foram endurecidos; gate limpo final em 79 testes, predeploy 67/67, Chromium 68/75 e cross-browser 6/6. | @qa / @dev / @security / @ux / @backend / @architect |
| 2026-07-17 | 1.2 | Reenvio cego de criações com resultado ambíguo foi contido sem alterar schema/API; contrato definitivo de idempotência foi condicionado a tenancy+ledger+RPC, e o gate final passou com 81 testes, predeploy 67/67, Chromium completo aprovado e cross-browser 6/6. | @qa / @dev / @security / @ux / @backend / @db-sage / @architect |
| 2026-07-17 | 1.3 | Fluxo de óbito multi-etapas foi removido do browser e contido na UI/PATCH até RPC transacional; inativação passou à API com CAS, e os gates fecharam em 82/82 unitários, predeploy 67/67, Chromium 68/75 e cross-browser 6/6. | @qa / @dev / @security / @ux / @backend / @db-sage / @architect |
| 2026-07-17 | 1.4 | Last-write-wins da planilha gratuita foi eliminado com documento v2, Web Locks, revisão esperada, backup legado, conflito explícito e preservação de rascunho; corrida real passou nos três browsers e os gates fecharam em 89/89 unitários, predeploy 67/67, Chromium 68/75 e cross-browser 9/9. | @qa / @dev / @security / @ux / @frontend-data / @privacy / @architect |
| 2026-07-17 | 1.5 | Replay das 11 migrations foi comprovado em PG17 local; índice/grants/default ACL, 17 pgTAP, audit pack PG17 fail-closed e limites/schema da Edge Function foram adicionados. Gate final: 94/94 unitários, predeploy 67/67 e cross-browser 9/9. | @qa / @dev / @security / @db-sage / @backend / @ai / @release / @architect |
| 2026-07-17 | 1.6 | Manifesto SHA-256 append-only e ADR de drift, dependências/lock/tipos Deno e jobs CI de contrato DB/Edge foram implementados e reproduzidos localmente. Gate final: 97/97 unitários, predeploy 67/67, replay 11/11, pgTAP 17/17 e check/lint/bundle Edge verdes. | @qa / @dev / @security / @db-sage / @backend / @platform / @release / @architect |
| 2026-07-17 | 1.7 | SEO duplicado, privacy/analytics, chave pública Supabase, cron/Data API, HTTP 404/413, redirects de IA, touch targets e bypasses do verificador Edge foram corrigidos. Playwright passou a testar `next start`; gate final: 99/99 unitários, predeploy 69 pass/4 skips remotos e cross-browser de produção 9/9. O CI público remoto continua vermelho e bloqueia release. | @qa / @dev / @security / @privacy / @backend / @platform / @release / @ux / @architect |
| 2026-07-17 | 1.8 | O ledger histórico de migrations foi tornado exatamente imutável após o bootstrap e o CI Edge passou a descobrir, verificar, lintar e empacotar todas as funções versionadas. Os gates locais seguem em 99/99 contratos, 11 migrations íntegras e configuração Edge verde; a execução remota continua pendente. | @qa / @security / @db-sage / @platform / @release / @architect |
| 2026-07-17 | 1.9 | O consumidor Edge passou a interpretar `FunctionsHttpError` e bloquear retry de resultado desconhecido; enumeração de laudo foi removida; datas civis, boundary raiz, rotas sensíveis do WhatsApp, timers e escopo do cookie de recovery foram corrigidos. Gate final: 102/102 contratos, predeploy de produção 69/73 e cross-browser 9/9. | @qa / @security / @frontend / @backend / @edge / @privacy / @ux / @architect |
| 2026-07-17 | 2.0 | Cronologia clínica foi normalizada sem inferência, o recovery passou a consumir o marcador no servidor e a home ganhou política compartilhada de movimento/visibilidade com quatro E2E de runtime. Gate final: 104/104 contratos, predeploy de produção 74/78, Chromium completo 74/81, cross-browser 9/9 e build de 38 superfícies. | @qa / @security / @frontend / @backend / @edge / @privacy / @ux / @clinical-safety / @architect |
| 2026-07-17 | 2.1 | Métricas e depoimentos clínicos sem dossiê verificável foram removidos da home, substituídos por princípios e política pública de evidências; a demo foi marcada como fictícia, alvos `aria-labelledby` foram corrigidos e duas ilhas cliente com timers/autoplay viraram conteúdo estático. Gate final: 105/105 contratos, último predeploy monolítico 74/78, Chromium completo atual 75/82, cross-browser 9/9 e build de 38 superfícies. | @qa / @security / @frontend / @privacy / @ux / @clinical-safety / @architect |

## Dev Agent Record

### Agent Model Used

Codex, com frentes especializadas de Frontend/UX, Frontend Data/concorrência, Backend/Security, Banco/RLS, Edge/Deno, CI/Release e Clinical Safety. Os modelos recomendados por sprint estão no relatório integral; decisões clínicas e de produção permanecem humanas.

### Debug Log References

- `npm run check:predeploy`: última execução monolítica PASS no build de produção — supply chain, integridade de migrations/Edge, sintaxe, lint, tipos, 105/105 testes, build e 74/78 Playwright Chromium; 4 fluxos remotos ignorados explicitamente. O contrato adicional de labels foi adicionado depois e deve integrar a próxima execução monolítica antes de deploy.
- Build Next.js 16.2.6: PASS — 38 superfícies.
- Playwright completo atual: 75/82 no Chromium; 7 fluxos remotos foram ignorados por falta intencional de credenciais. Cross-browser público/multiaba: 9/9, sendo 3/3 em Chromium tablet, Firefox e WebKit.
- Inspeção visual final: 1440×900, 1280×720, 1275 px, 768×1024 e 390×844, somada às matrizes anteriores; sem overflow/error/warning de aplicação; modal móvel contido em 366 px, foco inicial correto e botões visíveis com pelo menos 44 px. A política pública de evidências foi conferida em desktop, tablet e celular.
- Quatro audits npm: PASS — 0 vulnerabilidades conhecidas; SBOM CycloneDX 1.5 validado com 216 componentes.
- Banco local isolado: PostgreSQL 17.6.1, reset 11/11 migrations, pgTAP 17/17, lint `public,private` e advisors de segurança/desempenho sem finding de projeto; a stack descartável foi removida ao final sem interromper `app_incise`.
- Integridade de migrations: PASS — 11 hashes em bytes brutos e uma transição histórica conhecida; verificação append-only local/contra Git passou, com `remoteAttestation=false` explícito.
- Edge/Deno: PASS local — dependências exatas, lock v4, `deno check --frozen`, lint e bundle limpo no Edge Runtime fixado por digest. O formatter histórico e a execução hospedada permanecem pendentes.
- Novos jobs CI `Database Contract` e `Edge Runtime Contract`: YAML validado e sequência reproduzida localmente; primeira execução no GitHub ainda pendente.
- Auditoria de staging: plano offline 4/4 sem rede; os quatro SQLs também compilaram/rodaram read-only em PG17 local e o contrato final marcou corretamente NO-GO. Nenhuma consulta remota.

### Completion Notes List

- Story inicial criada antes das inspeções detalhadas.
- Frente Produto/QA/Release auditada somente com checagens read-only; nenhuma correção de código foi aplicada por esta frente.
- Auditorias de Frontend/UX e Backend/Security concluídas; correções locais pequenas e reversíveis foram integradas pela frente principal.
- Três ferramentas com falhas clínicas P0 foram retiradas preventivamente, marcadas `noindex` e removidas do sitemap.
- Inventário final: 1.673 arquivos não ignorados reconciliados — 299 de produto/release, 227 wrappers de agentes/IDEs e 1.147 do AIOX vendorizado.
- Gate final: integridade de migrations/Edge, lint, typecheck, 105/105 testes, build, último predeploy de produção 74/78, Chromium completo atual 75/82, cross-browser de produção 9/9 e pgTAP 17/17; fluxos autenticados/IA remotos foram ignorados de forma explícita.
- Chromium, Firefox e WebKit passaram localmente 9/9 em servidor isolado, incluindo conflito determinístico entre duas abas; ainda falta evidência do workflow remoto e da matriz autenticada.
- Logos efetivamente renderizados caíram de 1,27–6,33 MB para derivados WebP de 42–94 KB; as fontes originais foram preservadas.
- O lock web não possui mais referências ao mirror externo; instalação limpa pelo registry npm oficial passou.
- Callback/login/proxy/layout usam redirects normalizados e autorização por papel; consultas autenticadas auditadas falham fechado e não transformam erro de banco em vazio/404.
- CI usa Actions fixadas por SHA, permissões mínimas, Dependabot, verificação dos locks, SBOM e contratos DB/Edge com CLI/imagens fixadas; execução remota e branch protection continuam pendentes.
- A raiz delega os gates ao produto; o AIOX vendorizado é privado e possui auditoria própria, mas não está homologado como framework publicável.
- Scripts RLS legados estão mecanicamente bloqueados e operações E2E remotas exigem alvo de staging explícito e confirmação vinculada ao projeto.
- O pack de staging inicia offline, verifica quatro SQLs read-only/rollback-only, não trata `PUBLIC` como role e exige alvo/confirmação fortes; o resumo máquina falha fechado se qualquer check for falso.
- As APIs de pacientes/tutores consultam o papel persistido no servidor; formulários possuem mutex e o frontend não inventa referência laboratorial para espécie não suportada.
- A Edge Function de laudos exige papel persistido `vet/admin`, entrada/envelopes limitados, schema local estrito e CORS allowlist; dependências/lock Deno são reproduzíveis e o runtime local passou, mas Auth/Storage/provedores hospedados não foram acionados. O autocadastro cria somente tutor e não promete aprovação profissional inexistente.
- Páginas legais e banner usam afirmações verificáveis, descrevem o armazenamento local e permanecem preliminares até revisão jurídica; cadastro/legal passaram em temas claro/escuro.
- Tema/Auth/Lab ganharam contraste e nomes acessíveis; listas de pacientes, tutores, animais e laudos usam contagem/paginação explícita, e a criação de paciente falha fechado quando a seleção de tutor excede a janela segura.
- Recovery aceita apenas intenção verificada pelo SDK PKCE; visita direta ao reset não expõe campos de senha.
- A planilha gratuita preserva corrupção, valida snapshots cruzados, usa estado canônico v2, serializa mutações com Web Locks, exige revisão esperada, verifica o pós-write e não classifica valor como normal sem referência numérica completa.
- Duas abas não perdem mais escrita silenciosamente: conflitos, aba legada, lock indisponível e resultado incerto falham fechados, o backup original permanece intacto e rascunhos são preservados. Criações remotas ainda exigem tenancy+ledger+RPC idempotente; óbito/follow-up permanece contido até a transação definitiva.
- A política local de Auth exige no mínimo 8 caracteres, mas a equivalência com a configuração remota ainda precisa ser comprovada no staging.
- A matriz canônica de autoridade resolve as 12 referências PM/PO/SM sem ampliar permissão de publicação, deploy ou migration.
- Drafts S1/S2 permanecem fora de migrations, com sentinelas incondicionais. Apenas as 11 migrations **ativas** foram executadas em PostgreSQL local descartável; nenhuma conexão, migration ou mutação remota ocorreu.
- Plano clínico definiu 49 casos golden/fronteira, mas doses e assinaturas veterinárias continuam pendentes.
- Métricas “500+”/“98%” e depoimentos clínicos nominais sem fonte, metodologia, data e consentimento foram removidos da home; qualquer reintrodução depende de dossiê e aprovação Product/Legal/DPO.
- Veredito final: NO-GO enquanto tenancy/RLS, transação de laudos, onboarding profissional auditável, correção/homologação clínica e readiness remoto não forem concluídos.

### File List

- `docs/stories/AUDIT-001.production-readiness-audit.md` — criado.
- `docs/auditoria-production-readiness-2026-07-16.md` — relatório integral, findings, correções, gates e sprints.
- `docs/aiox-root-config-audit-2026-07-16.md` — drift, recursos ausentes e decisão de não homologação do AIOX vendorizado.
- `docs/architecture/ADR-001-tenancy-clinica-rls.md` — desenho fail-closed de tenancy, rollout e matriz negativa; sem SQL aplicado.
- `docs/architecture/ADR-002-migration-integrity-and-drift.md` — baseline SHA-256 append-only, transição histórica conhecida e proibição de alegar igualdade remota sem artefato confiável.
- `docs/architecture/command-authority-matrix.md` — autoridade canônica de comandos e ações críticas.
- `docs/architecture/drafts/tenancy/*` — drafts `expand/enforce`, testes Vet A × Vet B e README; todos quarentenados.
- `docs/architecture/drafts/laudos-ia/*` — contrato, SQL claim/finalize/refund e matriz de falhas; todos quarentenados.
- `docs/clinical/clinical-engine-revalidation-plan.md` — plano de 49 casos e dupla revisão humana.
- `docs/README.md` e banners em runbooks legados — governança da decisão NO-GO.
- `.github/workflows/*.yml`, `web/scripts/*`, `web/tests/*` — gates, E2E, cleanup e contratos DB/Edge endurecidos.
- `supabase/migration-integrity.json`, `web/scripts/lib/migration-integrity.mjs`, `web/scripts/verify-migration-integrity.mjs` e `web/tests/unit/migration-integrity.test.ts` — hashes em bytes brutos, política append-only e regressões de drift.
- `web/scripts/staging-audit.mjs`, `web/scripts/staging-audit/*` e `web/scripts/lib/staging-audit-safety.mjs` — auditoria de staging offline/read-only e contratos de segurança.
- `.antigravity/rules.md`, `.claude/rules/mcp-usage.md`, `.claude/hooks/enforce-git-push-authority.cjs` e `.codex/skills/aiox-vibe-framework/SKILL.md` — portabilidade, segredo e autoridade de push endurecidos.
- `supabase/migrations_archive/README.md` — quarentena explícita de migrations históricas, sem alterar o histórico executável.
- `web/src/app`, `web/src/components`, `web/src/hooks`, `web/src/lib` — correções públicas, clínicas, privacidade, acessibilidade e segurança.
- `web/playwright.config.ts` e `web/scripts/predeploy-check.mjs` — servidor E2E isolado em porta própria, sem reutilizar preview alheio.
- `web/src/app/auth/redefinir-senha/ResetForm.tsx`, `web/src/app/lab/perfil/ProfileForm.tsx`, `web/src/components/lab/LaudoUploader.tsx`, `web/src/components/lab/LabShell.tsx`, `web/src/app/lab/layout.tsx` e `web/src/proxy.ts` — fail-closed, minimização de PII e estados responsivos de Auth/Lab.
- `web/src/components/ui/ThemeToggle.tsx`, `web/src/app/auth/login/LoginForm.tsx`, `web/src/app/auth/recuperar-senha/*` e `web/src/app/auth/redefinir-senha/*` — tema resolvido, nomes acessíveis e contraste Auth claro/escuro.
- `web/src/components/lab/ListPagination.tsx`, `web/src/app/lab/pacientes/*`, `web/src/app/lab/tutores/*` e `web/src/app/lab/pacientes/[petId]/laudos/page.tsx` — busca, total, paginação e limites explícitos sem truncamento silencioso.
- `web/tests/e2e/api-security.spec.ts`, `web/src/app/legal/*`, `web/src/components/auth/CadastroForm.tsx`, `web/src/lib/lab-free/storage.ts` e scripts de assets — contratos HTTP, verdade legal, onboarding contido, storage local validado e manutenção fail-closed.
- `web/src/lib/auth-recovery.ts`, `web/src/lib/identifiers.ts`, `web/src/lib/list-pagination.ts`, `web/src/lib/lab/tutor-selection.ts` e `web/src/lib/lab-free/reference-status.ts` — recovery verificado, fronteiras de rota/lista e classificação laboratorial estrita.
- `web/src/app/auth/redefinir-senha/concluir/route.ts` e `web/src/app/auth/redefinir-senha/ResetForm.tsx` — consumo server-side do marcador de recovery, papel/destino revalidados e fallback seguro pós-troca de senha.
- `web/src/hooks/useMotionActivity.ts`, `MotionPreferencesProvider.tsx`, `ProductDemo.tsx` e `web/tests/e2e/motion-runtime.spec.ts` — política de viewport/foco/visibilidade/reduced-motion da demo e regressão de runtime em produção; `AnimatedStats.tsx` e `TestimonialsCarousel.tsx` agora renderizam conteúdo estático de princípios/evidências sem métricas, nomes clínicos, timers ou autoplay.
- `web/src/lib/civil-date.ts`, `web/src/lib/lab/transform-laudo-data.ts`, `LabEvolutionTable.tsx`, `LaudoUploader.tsx` e contratos `parse-laudo` — datas clínicas ISO reais ou nulas, fallback São Paulo rotulado e ordenação determinística.
- `web/src/lib/client-mutation.ts`, `web/src/app/lab/tutores/novo/TutorForm.tsx`, `web/src/app/lab/pacientes/novo/PacienteForm.tsx` e `web/tests/unit/frontend-safety.test.ts` — contenção de reenvio cego após resultado remoto ambíguo; idempotência transacional permanece pendente.
- `web/src/app/lab/tutores/[id]/TutorPetActions.tsx`, `web/src/app/api/pets/[id]/route.ts` e consumidores de `TutorPetActions` — mutações diretas removidas, inativação via API/CAS e óbito não transacional contido até RPC definitiva.
- `web/src/lib/lab-free/storage.ts`, `web/src/lib/lab-free/id.ts`, `web/src/components/ferramentas/lab-free/*`, `web/tests/unit/frontend-safety.test.ts` e `web/tests/e2e/cross-browser-smoke.spec.ts` — estado v2, Web Locks, revisão/conflito, UUID criptográfico, preservação de rascunho e corrida multiaba real; também responsividade, dark mode, foco e alvos de toque.
- `supabase/functions/parse-laudo/index.ts`, `database.types.ts`, `deno.json`, `deno.lock`, `supabase/config.toml` e migration de performance — hardening local e reprodutibilidade da IA/plataforma sem aplicação remota.
- `web/scripts/verify-edge-functions.mjs` — versões exatas, lock, configuração JWT/entrypoint e fronteira de imports da Edge Function.
- `supabase/functions/parse-laudo/contracts.ts` e `web/tests/unit/parse-laudo-contracts.test.ts` — limites streaming, CORS, envelope de provedor e validação recursiva testáveis sem chamar IA.
- `supabase/migrations/20260717114557_add_colaboradores_supabase_uid_index.sql`, `20260717114916_restrict_data_api_table_privileges.sql` e `supabase/tests/production_safety_test.sql` — índice, menor privilégio e 17 invariantes pgTAP reaplicados localmente.

## QA Results

### Estado pós-correção e contenção

| Área | Estado atual | Evidência/risco residual |
|---|---|---|
| CI, lint, tipos, build e E2E público | Corrigido localmente; remoto bloqueado | 105/105 testes, último predeploy de produção 74/78, Chromium completo atual 75/82, cross-browser de produção 9/9 e 38 superfícies. A próxima execução monolítica deve incluir o contrato E2E novo; os runs públicos recentes seguem vermelhos e os workflows novos ainda não foram executados remotamente. |
| Analytics/LGPD técnico | Corrigido parcialmente | Opt-in/opt-out, PostHog pós-consentimento e textos públicos verificáveis; revisão jurídica, responsáveis, canal e direitos do titular pendentes. |
| Cleanup E2E | Mitigado | Identidade exata, alvo/ref/URL explícitos, staging confirmado, falha agregada e verificação de resíduos; manifesto/metadata e prova remota ainda recomendados. |
| Cron | Corrigido localmente | Falha fechada sem secret, no-store e erros saneados; configuração remota não verificada. |
| Frontend/Lab | Corrigido localmente | Timeouts/erros/diálogos/foco, mutexes, trava conservadora após resultado ambíguo, inativação via API/CAS, óbito inseguro contido, temas, strings longas, busca/contagem/paginação e papéis server-side; sessão autenticada densa, tenancy/RLS, idempotência/RPC transacional e staging pendentes. |
| Ferramentas clínicas | Contido | Fluidoterapia, eletrólitos e dieta sem resultados, `noindex`, fora do sitemap; motores precisam ser reescritos/homologados. |
| Histórico de peso | Corrigido localmente | Separação por nome+espécie, tendência neutra e storage seguro; ID clínico estável continua recomendado. |
| Tenancy/RLS | P0 pendente | Baseline ativa reaplica 11/11 e passa 17/17 pgTAP; ADR + drafts tenant permanecem quarentenados e não há isolamento Vet A × Vet B/staging. |
| Laudos/IA | P0/P1 pendente | CAS, streaming, CORS, schema local, logs, lock Deno e runtime local mitigados; draft transacional pronto, mas claim/finalize/refund/lease e contrato hospedado com Auth/Storage/provedores ainda ausentes. |
| Onboarding profissional | P1 pendente | Autocadastro tutor-only e opção vet contida; verificação/aprovação/provisionamento/revogação auditáveis ainda ausentes. |
| Release/LGPD/backup | P1 pendente | Staging, restore, rollback, subprocessadores e operação real sem evidência. |

O quadro abaixo preserva os findings do baseline para rastreabilidade histórica; quando houver divergência de estado, prevalece a tabela pós-correção acima e o relatório integral.

### Veredito parcial da frente Produto/QA/Release

**NO-GO** até a correção e revalidação dos itens P0/P1 abaixo. O typecheck read-only passou e o `npm audit` do app web não encontrou vulnerabilidades conhecidas, mas os demais gates não sustentam release.

| ID | Severidade | Finding e evidência resumida | Estado |
|---|---|---|---|
| QA-001 | P0 | Os cleanups E2E aceitavam qualquer `E2E_CLEANUP_RUN_ID` não vazio e seleção parcial. | Mitigado: identidade exata + staging/ref/URL/confirmação; manifesto/metadata segue recomendado. |
| QA-002 | P1 | Workflows executavam na raiz e em Node incompatível. | Corrigido: `web`, Node 22.18 e gates reais. |
| QA-003 | P1 | O lint do app falhava em `CookieBanner`. | Corrigido; lint sem erros/warnings. |
| QA-004 | P1 | Consentimento LGPD não era respeitado: PostHog inicializava quando havia chave, antes de consentimento, e o banner não oferecia recusa. | Corrigido tecnicamente: opt-in/opt-out, storage fail-closed, rotas clínicas/Auth excluídas, autocapture/replay desligados; revisão jurídica e prova de rede em staging continuam pendentes. |
| QA-005 | P1 | A política afirmava retenção inexistente para dados enviados a provedores de IA. | Texto corrigido; configuração, contrato e retenção efetiva dos provedores ainda precisam ser comprovados em staging/produção. |
| QA-006 | P1 | O gate local podia ficar verde sem suíte pública funcional e removia evidência. | Corrigido para integridade de migrations/Edge, lint, tipos, 105/105 testes, build e 74/78 Playwright no `next start`; Auth/RLS, CRUD e IA remotos continuam como gates separados e obrigatórios. |
| QA-007 | P1 | Não havia testes unitários para limites clínicos e nenhum E2E era executado no CI. | Parcialmente corrigido: unitários/limites e E2E público Chromium/cross-browser foram adicionados; 9/9 cross-browser passaram localmente, mas matriz autenticada e primeiro workflow remoto continuam pendentes. |
| QA-008 | P1 | Cleanup dentro dos ciclos E2E apenas registrava erros e podia terminar com sucesso deixando resíduos. | Corrigido localmente: falha não-zero, todas as etapas executadas, IDs/objetos conferidos e resíduos verificados; natureza não transacional e staging permanecem riscos. |
| QA-009 | P1 | O endpoint cron falhava aberto sem `CRON_SECRET` e expunha mensagens internas. | Corrigido localmente; secret remoto/monitor não verificado. |
| QA-010 | P1 | Documentos legados apresentam estados contraditórios. | Mitigado por `docs/README.md` e banners NO-GO; consolidação/arquivo definitivo pendente. |
| QA-011 | P1 | Readiness operacional incompleto: não há rollback de Vercel/migrations, backup/restore testado, RTO/RPO, resposta a incidentes, responsáveis/escalonamento ou monitoramento ativo; o próprio status mantém validação remota, upload/IA e alertas pendentes. `sprint-execution-status.md:95-123`; busca documental sem esses artefatos. | Confirmado. |
| QA-012 | P2 | Playwright cobria somente Chromium/Desktop Chrome e viewport móvel. | Mitigado: Chromium tablet, Firefox e WebKit passaram 9/9 localmente, incluindo concorrência entre abas; falta execução comprovada do workflow e matriz autenticada nesses browsers. |
| QA-013 | P2 | O CSP permitia `'unsafe-eval'`, acesso browser à OpenAI, `'unsafe-inline'` e wildcard Supabase. | Parcialmente corrigido: eval/OpenAI removidos e `object-src 'none'`; inline e wildcard ainda exigem nonces/host específico. |
| QA-014 | P2 | O lock web resolvia 522 pacotes por `registry.npmmirror.com`. | Corrigido: zero referências ao mirror, 635 ao registry npm oficial e `npm ci --ignore-scripts` aprovado. |
| QA-015 | P2 | Configuração AIOX aponta para PRD, arquitetura, framework, backlog e QA inexistentes. `.aiox-core/core-config.yaml:7-31,246-249`. | Confirmado. |
| QA-016 | P2 | O AIOX declara suíte/build ausentes e tinha duas vulnerabilidades moderadas diretas. | Dependências corrigidas; audit 0. Suíte/build AIOX continuam ausentes. |
| QA-017 | P2 | `/api/health` misturava liveness/configuração; remote-readiness aceitava status não-401 e project ref padrão. | Corrigido localmente: endpoints separados e rede opt-in/read-only; disponibilidade real continua pendente de staging. |
| QA-018 | P2 | Não havia automação suficiente de segurança/qualidade nos workflows. | Audits, E2E público/cross-browser, Actions por SHA, Dependabot, verificação de locks, SBOM, replay de migrations/pgTAP e check/lint/bundle Edge foram adicionados; primeira execução remota, required checks, CodeQL, Secret Scanning/Push Protection, Dependency Review, cobertura e Lighthouse continuam pendentes. |
| QA-019 | P3 | Há drift de versões AIOX, caminhos absolutos pessoais nos runbooks, ausência de `packageManager` no app e patches disponíveis em dependências. | Paths pessoais foram removidos, `engines` e gates raiz foram adicionados e AIOX virou privado; drift/recursos ausentes e `packageManager` seguem documentados. |
| QA-020 | P1 | A bateria chamada `auth-rls` testa redirecionamento por papel, mas não cria dois tenants/vets nem prova que usuário A não lê/altera dados do usuário B. O documento declara “Auth/RLS validado”, embora a própria matriz só contenha navegação. `auth.spec.ts:27-61`; `e2e-auth-rls-cycle.mjs:114-151`; `auth-rls-functional-validation.md:1-12,34-59`. | Confirmado; requisito de lançamento sem evidência. |
| QA-021 | P2 | O contrato de ambiente estava fragmentado e scripts remotos usavam fallback de project ref; o Root Directory efetivo da Vercel não está comprovado. | Variáveis e alvo explícito foram alinhados nos exemplos/scripts; configuração real da Vercel ainda precisa ser verificada. |
| QA-022 | P1 | O cadastro sugeria papel veterinário/aprovação sem workflow profissional seguro; `requested_role` não constitui autoridade. | Contido: autocadastro tutor-only, metadata removida e CTAs corrigidos; onboarding auditável continua bloqueador. |
| QA-023 | P1 | `parse-laudo` autenticava o JWT, mas usava `service_role` sem exigir papel persistido vet/admin. | Corrigido localmente com 403/503 antes do claim; execução real e tenancy continuam pendentes. |
| QA-024 | P1 | O projeto não detectava alteração/remoção retroativa de migrations e o drift histórico conhecido não tinha ledger verificável. | Corrigido no baseline do repositório com manifesto SHA-256, exceção única auditável e comparação append-only contra Git; reconciliação/atestação remota continua pendente. |
| QA-025 | P1 | A Edge Function usava imports flutuantes e não tinha `deno.json`, lock, tipos nem gate no runtime. | Corrigido localmente com versões exatas, lock v4, tipos, config explícita, check/lint/bundle e job CI; `deno fmt`, execução hospedada e contrato real com provedores continuam pendentes. |

### Evolução da correção fail-closed de QA-001

1. **Implementado parcialmente:** seleção por `includes()` foi removida e o run ID exige regex integral específica; ainda se recomenda acrescentar entropia além da resolução de segundos.
2. **Implementado parcialmente:** e-mail de tutor/usuário e relações por `tutor_id` são exatos; `app_metadata` e manifesto persistido ainda são recomendados.
3. **Implementado:** project ref/URL explícitos, allowlist `staging`, confirmação vinculada ao alvo e recusa de produção.
4. **Pendente:** hash/nonce de manifesto e limites formais de contagem no dry-run.
5. **Implementado localmente:** qualquer falha produz exit não-zero, todas as etapas são tentadas e resíduos são verificados; a comprovação real continua restrita a projeto/branch Supabase efêmero e isolado.

### Baseline read-only preservado

Os resultados abaixo registram o estado inicial da frente Produto/QA/Release. O estado final validado está nas tabelas anteriores e nas Completion Notes.

- `npm run lint` na raiz: falhou, script ausente.
- `npm test` na raiz: falhou, script ausente.
- `npm run lint` em `web`: falhou com 1 erro e 3 warnings.
- TypeScript em `web` com `--noEmit --incremental false`: passou.
- `playwright test --list`: 57 casos listados em 7 specs; somente projeto Chromium.
- `node --check` nos scripts JS/MJS de `web/scripts`: passou.
- `npm audit` em `web`: 0 vulnerabilidades conhecidas no momento da auditoria.
- `npm audit` em `.aiox-core`: inicialmente 2 moderadas; após atualização compatível, 0.
- Build e E2E executável não foram rodados nesta frente porque escrevem artefatos/estado e a verificação encontrou gates anteriores quebrados.
