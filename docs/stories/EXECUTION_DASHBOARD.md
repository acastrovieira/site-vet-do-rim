# 📊 Dashboard de Execução e Orquestração de Agentes (AIOX)

> **ARQUIVO HISTORICO:** este dashboard contem estados contraditorios e nao e fonte de readiness. O estado vigente e **NO-GO**; consulte `docs/README.md` e `docs/auditoria-production-readiness-2026-07-16.md`.

**Projeto:** Ecossistema Digital "Vet do Rim"
**Metodologia:** Sprints Ágeis (Story-Driven Development)
**Gerenciado por:** `@aiox-master`

> [!IMPORTANT]
> **Como usar este dashboard:**
> Este documento atua como a "Fonte da Verdade" do progresso de desenvolvimento. Cada Sprint e Tarefa (Story) possui um Agente Especialista designado. Para iniciar uma tarefa, mencione o agente responsável (ex: `@[/dev] inicie a STORY-101`). O agente atualizará o status nesta tabela conforme avança.

## 📈 Resumo de Progresso (Visão Executiva)

| Fase / Sprint | Foco Estratégico | Status | Agentes Líderes |
|---------------|------------------|--------|-----------------|
| **Sprint 0** | Setup, Infra e Arquitetura DB | ✅ Concluída | `@architect`, `@devops`, `@data-engineer` |
| **Sprint 1** | Institucional & Motor SEO Blog | ✅ Concluída | `@dev`, `@analyst` |
| **Sprint 2** | Auth & Integração Lab Evolution | ✅ Concluída | `@dev`, `@qa` |
| **Sprint 3** | Lead Magnets (Ferramentas Grátis) | ✅ Concluída | `@pm`, `@dev` |
| **Sprint 4** | Storage de PDF e MVP Inteligência Artificial | ✅ Concluída | `@data-engineer`, `@dev` |
| **Sprint 5** | Qualidade, Observabilidade e Go-Live | ✅ Concluída | `@devops`, `@qa`, `@analyst` |

---

## 🏃 Detalhamento das Sprints e Atribuição de Agentes

### Sprint 0: Fundação e Arquitetura (Fase 1 Base)
*Objetivo: Preparar o terreno, configurar banco de dados de forma segura e o ambiente de deploy contínuo.*

| ID | Descrição da Tarefa (Story) | Responsável | Status | Check |
|----|-----------------------------|-------------|--------|-------|
| `STORY-001` | Inicializar Monorepo Next.js + Tailwind + shadcn/ui. Configurar aliases absolutos (`@/*`). | `@dev` | To Do | [ ] |
| `STORY-002` | Configurar projeto no Supabase: Habilitar Auth, Email customizado (Resend) vazio por ora. | `@devops` | To Do | [ ] |
| `STORY-003` | Desenhar e aplicar migrations SQL iniciais (Tabelas: `profiles`, `patients`) com RLS estrito. | `@data-engineer` | To Do | [ ] |
| `STORY-004` | Integrar repositório com Vercel (CI/CD) e travar variáveis de ambiente principais. | `@devops` | To Do | [ ] |

### Sprint 1: Motor SEO e Marketing Premium (Fase 1 Core)
*Objetivo: Colocar o site no ar rápido para indexação do Google e estabelecer o padrão de design "Clinical Luxury".*

| ID | Descrição da Tarefa (Story) | Responsável | Status | Check |
|----|-----------------------------|-------------|--------|-------|
| `STORY-101` | Desenvolver `app/(marketing)/page.tsx` (Home Institucional) com animações leves e responsividade máxima. | `@dev` | To Do | [ ] |
| `STORY-102` | Criar motor de Blog via MDX local (`app/(conteudo)/blog/[slug]`) e listar os 5 primeiros artigos de Nefrologia. | `@dev` | To Do | [ ] |
| `STORY-103` | Implementar geradores de Schema Markup (E-E-A-T) e sitemap xml automático. | `@analyst` | To Do | [ ] |

### Sprint 2: Autenticação e Integração Lab Evolution (Transição Fase 1/2)
*Objetivo: Trazer o SaaS existente para debaixo do guarda-chuva do domínio único.*

| ID | Descrição da Tarefa (Story) | Responsável | Status | Check |
|----|-----------------------------|-------------|--------|-------|
| `STORY-201` | Implementar UI/UX de Login/Cadastro (`app/(auth)`) consumindo API do Supabase Auth. | `@dev` | To Do | [ ] |
| `STORY-202` | Migrar o código atual do "Lab Evolution" para dentro de `app/(saas)/lab`. | `@dev` | To Do | [ ] |
| `STORY-203` | Proteger a rota `/lab` com Next.js Middleware. Validar sessões de servidor (Supabase SSR). | `@architect` | To Do | [ ] |

### Sprint 3: Crescimento e Lead Magnets (Fase 2 Iniciada)
*Objetivo: Ferramentas clínicas para capturar leads.*

| ID | Descrição da Tarefa (Story) | Responsável | Status | Check |
|----|-----------------------------|-------------|--------|-------|
| `STORY-301` | Desenvolver UI interativa da "Calculadora de Taxa de Filtração Glomerular (TFG)". | `@dev` | To Do | [ ] |
| `STORY-302` | Implementar bloqueio parcial de resultados exigindo cadastro (Funil de Aquisição). | `@pm` / `@dev`| To Do | [ ] |

### Sprint 4: IA Base e Uploads (Fase 2 Avançada)
*Objetivo: Zerar atrito de digitação usando OpenAI para ler PDFs de laudos.*

| ID | Descrição da Tarefa (Story) | Responsável | Status | Check |
|----|-----------------------------|-------------|--------|-------|
| `STORY-401` | Configurar Supabase Storage para PDFs (Buckets restritos via RLS). | `@devops` | To Do | [ ] |
| `STORY-402` | Criar Edge Function (Supabase) que recebe PDF, aciona OpenAI (Structured Outputs) e devolve JSON do hemograma. | `@data-engineer`| To Do | [ ] |
| `STORY-403` | Criar UI no Lab Evolution para visualizar o PDF lado a lado com os dados extraídos pela IA. | `@dev` | To Do | [ ] |

### Sprint 5: Go-Live, Segurança e Analítica (Encerramento de Ciclo)
*Objetivo: Polimento profissional digno de plataforma $500k+.*

| ID | Descrição da Tarefa (Story) | Responsável | Status | Check |
|----|-----------------------------|-------------|--------|-------|
| `STORY-501` | Validar e ativar domínios DKIM/SPF do Resend para zerar queda de emails em spam. | `@devops` | To Do | [ ] |
| `STORY-502` | Instalar e configurar SDK do PostHog para mapear cliques, scroll e conversões no SaaS. | `@analyst` | To Do | [ ] |
| `STORY-503` | Executar bateria de auditoria CodeRabbit e Lighthouse SEO. Correção de qualquer issue CRITICAL. | `@qa` | To Do | [ ] |

---
*Documento autogerado e orquestrado por @aiox-master. Sincronizado via `.aiox-core`.*
