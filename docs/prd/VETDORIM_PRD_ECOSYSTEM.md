# 📄 PRD & Arquitetura Técnica: Ecossistema Digital "Vete do Rim"

*Documento Estratégico - Engenharia de Produto & Arquitetura de Software*
*Nível: Arquiteto Staff / Solo Founder*

---

## 1. Visão Geral do Produto e Estratégia

O ecossistema "Vet do Rim" unificará a presença institucional premium, a autoridade em SEO e a aplicação SaaS ("Lab Evolution") em uma **única plataforma digital coesa**. Focado no nicho de nefrologia e urologia veterinária de alta complexidade.

**Objetivo Central:** Construir autoridade orgânica (SEO), capturar leads (veterinários/tutores) por meio de ferramentas úteis gratuitas, e convertê-los para o SaaS/Consultorias em um ambiente "AI-first" e premium.

---

## 2. Arquitetura Técnica (Pragmatismo Extremo para Solo Founder)

A arquitetura selecionada é o **Modular Monolith (Monolito Modular)**. Microserviços adicionariam overhead operacional massivo. O monolito modular permite código centralizado, deploy único, mas isolamento lógico.

**Stack Tecnológica Validadada:**

- **Frontend/Core:** Next.js (App Router). Combina perfeitamente renderização estática (para o Blog/Institucional SEO) com renderização cliente (para o SaaS Lab Evolution).
- **Styling/UI:** TailwindCSS + shadcn/ui. Maior velocidade de mercado, sem arquivos CSS espalhados. Garante design system uniforme e premium.
- **Backend/Database:** Supabase (PostgreSQL). Evita criar e manter uma API Node.js/Express do zero. Entrega Banco de Dados, Autenticação, Storage de exames e Realtime.
- **Deploy/Infraestrutura:** Vercel. Zero devops. Push para o GitHub faz o build, cache na borda (Edge Network) global para o site carregar instantaneamente.
- **Content (Blog):** MDX (arquivos locais parseados em tempo de build). Custo zero, versão via Git. Quando escalar muito, pluga um CMS Headless (ex: Sanity).
- **Comunicações:** Resend. Simples, focado em desenvolvedores, alta entregabilidade de emails.
- **Analytics/UX:** PostHog (eventos, funil e gravação de sessão) em substituição a múltiplas ferramentas fragmentadas.

**Vantagem Solo Founder:** Você codifica apenas regras de negócios e UI. O resto (infra, auth, DB) é gerenciado.

---

## 3. Estrutura do Domínio (Route Groups no Next.js)

Tudo sob `vetdorim.com.br` para alavancar o **Domain Authority (SEO)**. Subdomínios (ex: `app.vetdorim.com.br`) dividem o SEO do site. O Next.js com Route Groups resolve isso lindamente:

- `/` -> Institucional (Alta conversão, branding premium)
- `/blog` -> Artigos científicos, cluster de SEO (Gerado no servidor, ultra rápido).
- `/ferramentas` -> Calculadoras renais (Ex: TFG, Fluidoterapia).
- `/lab` -> "Lab Evolution" (SPA/Dashboard interativo e logado).
- `/auth` -> Autenticação Supabase centralizada.

**Estrutura de Pastas Sugerida:**

```text
/src
  /app
    /(marketing)        # Landing pages estáticas e rápidas
      /page.tsx
    /(conteudo)         # Foco em leitura, SSR/SSG
      /blog/page.tsx
      /blog/[slug]
    /(ferramentas)      # Lead magnets indexáveis
      /calculadora-tfg/page.tsx 
    /(auth)             # Fluxos de entrada
      /login/page.tsx
    /(saas)             # Lab Evolution - App logado
      layout.tsx        # Middleware protege essa área
      /lab/page.tsx     # Dashboard
  /components
    /ui                 # shadcn/ui primitivos
    /marketing          # Hero, Features, Testimonials
    /saas               # Formulários médicos, tabelas
  /lib
    /supabase           # Clientes server/client
    /seo                # Metadados estritos
```

---

## 4. SEO — Prioridade Máxima (Mecanismo de Crescimento)

- **Topical Authority:** Criar "Clusters" de conteúdo sobre Doença Renal Crônica, Hemodiálise Veterinária e Urolitíase.
- **EEAT (Expertise, Authoritativeness, Trustworthiness):** Fundamental no nicho médico (YMYL - Your Money or Your Life). Todo artigo terá Schema Markup do tipo `MedicalWebPage` e `Person` com seu CRMV atrelado.
- **Technical SEO:**
  - *Core Web Vitals*: Foco total em LCP (carregamento < 2s) usando `next/image` e `next/font`.
  - *Semantic HTML*: H1 único, H2 hierárquicos, tags `<article>` e `<aside>`.
- **Growth Funnel (Lead Magnets):** Ferramentas clínicas abertas na web. O Vet preenche os dados do paciente, vê um resultado parcial, e precisa criar conta gratuita para salvar e ver os insights completos da TFG.

---

## 5. Estratégia IA - Evolução AI-First

Não complique o MVP, mas deixe a base pronta:

- **Base (Pronto):** PostgreSQL no Supabase já suporta `pgvector`.
- **Fase 2 (Automação de Exames):** Vet faz upload do PDF de hemograma. Usar API da OpenAI (Structured Outputs) para ler o PDF, extrair ureia, creatinina, fósforo, e salvar formatado no JSONB do Supabase. Reduz tempo de digitação a zero.
- **Fase 3 (Agente Clínico RAG):** Um chatbot no painel que analisa o histórico do paciente do Lab e sugere manejo baseado apenas em diretrizes da literatura veterinária embutidas no seu banco vetorial.

---

## 6. UX/UI e Branding Premium

- **"Clinical Luxury":** Design minimalista, focado em ciência e empatia.
- **Paleta de Cores:** Fundo principal `White` (#FFFFFF) ou `Off-white` (#FAFAFA). Acentos em Tons de `Slate` (Cinza Azulado) para sobriedade e `Sky Blue` (#0ea5e9) para tecnologia/confiança.
- **Tipografia:** `Inter` para clareza em dashboards com muitos números, ou `Plus Jakarta Sans` para marketing.
- **Interações:** Zero telas de carregamento brancas (usar skeletons no shadcn/ui). Animações de micro-interação suaves (`transition-all duration-300`).
- **Acessibilidade:** Contrastes estritos na área de laudos (médicos podem estar com pressa ou em ambientes muito iluminados).

---

## 7. Estrutura de Banco de Dados (Visão Macro Supabase)

Arquitetura RDBMS limpa com políticas Row Level Security (RLS).

```sql
-- Profiles (Extensão da tabela nativa auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  role TEXT CHECK (role IN ('vet', 'tutor', 'admin')),
  full_name TEXT,
  crmv TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pacientes (Isolados por Vet)
CREATE TABLE patients (
  id UUID PRIMARY KEY,
  vet_id UUID REFERENCES profiles(id),
  tutor_id UUID REFERENCES profiles(id),
  name TEXT,
  species TEXT,
  medical_history JSONB
);

-- Exames / Avaliações
CREATE TABLE exams (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  exam_date DATE,
  results JSONB, -- Flexível para não travar o esquema inicialmente
  ai_summary TEXT
);

-- RLS: Isolamento Absoluto (Segurança Zero-Trust)
CREATE POLICY "Vets only view their own patients" 
ON patients FOR SELECT 
USING ((select auth.uid()) = vet_id);
```

---

## 8. Roadmap de Execução (Evolutivo)

### Fase 1: MVP & Dominação Orgânica (Semanas 1-4)

- Setup do Next.js App Router (Monolito).
- Criação das Landing Pages Institucionais de alta conversão.
- Sistema de Blog MDX focado em SEO + Primeiros 5 artigos.
- Autenticação Supabase funcional.
- Integração do que já existe no "Lab Evolution" para dentro da rota `/lab`.

### Fase 2: Conversão & Inteligência (Meses 2-3)

- Lançamento das "Ferramentas Abertas" (Lead magnets de SEO).
- Upload de arquivos no Supabase Storage.
- POC de IA: Upload de PDF de laudo e extração automática dos números do exame usando LLM.
- Dashboards com gráficos renais longitudinais para os pacientes.

### Fase 3: SaaS Pleno e Comunidade (Meses 4+)

- Integração Stripe Checkout (Plano Freemium -> Premium).
- Sistema multiusuário (Clínica Veterinária com sub-contas de Vets).
- Sistema de RAG Inteligente (O médico pergunta: "Baseado nestes últimos 3 exames, qual o estadiamento IRIS?").

---

## 9. DevOps e Infraestrutura

- **Controle de Versão:** GitHub (`main` = Prod).
- **Ambientes:**
  - `Local` (Supabase CLI + Next.js localhost).
  - `Preview` (Vercel gera URLs únicos por PR).
  - `Production` (Branch main).
- **Segurança:** Middleware do Next.js bloqueando a rota `/lab` sem token válido de sessão. Políticas RLS do Postgres aplicadas rigidamente.

---

## 10. Checklist de Lançamento

- [ ] Conectar Vercel ao Domínio `vetdorim.com.br` (Cloudflare DNS proxy desativado para o deploy inicial da Vercel gerenciar os certificados SSL).
- [ ] Executar Lighthouse SEO > 95 em mobile e desktop.
- [ ] Sitemap e Robots.txt gerados e validados no Google Search Console.
- [ ] RLS do Supabase amplamente testado (usuário A tentando acessar paciente de usuário B recebe array vazio).
- [ ] Configuração DKIM/SPF do Resend no DNS para evitar que emails de "Recuperação de Senha" caiam no Spam.
- [ ] Analytics (PostHog) configurado focado em rastrear o funil: `Artigo` -> `Ferramenta` -> `Cadastro Lab`.
