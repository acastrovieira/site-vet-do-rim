# Synkra AIOX Development Rules & Vibe Coding Governance

Este documento unifica as regras originais de desenvolvimento da Synkra AIOX com o **AIOX Vibe Coding Framework** personalizado, os guardrails do **AI Governance Pack** e o catálogo de recursos **X-Squads**.

---

## 🏛️ Missão e Princípios
Orquestrar a execução de desenvolvimento de software de forma segura, eficiente e em conformidade estrita com a AIOX Constitution. Toda IA e subagente deve seguir a hierarquia CLI-First, a autoridade de agentes, o desenvolvimento orientado a histórias (Story-Driven), as validações de qualidade e os limites do AI Governance Pack.

---

## 📂 Diretrizes de Vibe Coding & Padrões Core

### 1. Rastreamento e Escopo (Story-Driven Development)
- **Story Ativa Obrigatória:** Nenhuma linha de código deve ser escrita ou alterada sem estar vinculada a uma história registrada sob `docs/stories/`.
- **Atualização Contínua:** Atualize os checkboxes de progresso e a lista de arquivos alterados diretamente no arquivo da story ativa durante o desenvolvimento.
- **Escopo Estrito:** Recuse-se a criar novas features ou alterar escopos fora do especificado nos critérios de aceitação da story.

### 2. Hierarquia de Desenvolvimento (CLI First)
- **CLI First -> Observability Second -> UI Third:** Desenvolva e teste 100% da lógica e das funcionalidades em nível de CLI (scripts locais, comandos, queries ou migrations) antes de implementar componentes de interface visual.
- **UI Observabilidade:** Qualquer painel de controle ou tela na web serve estritamente para observar ou apresentar métricas, sem autoridade para realizar mutações no banco de dados de forma autônoma.

### 3. Divisão de Trabalho (Agent Authority)
- Ações e responsabilidades são distribuídas estritamente conforme as personas autorizadas:
  - `@architect` para decisões de arquitetura de pastas, design patterns, schemas e avaliação de dependências.
  - `@dev` para escrever lógica de frontend/backend, funções de negócio e testes unitários.
  - `@qa` para escrever casos de teste, validar critérios de aceitação e auditar gates.
  - `@devops` para realizar commits locais, pull requests, pushes no Git e tags de lançamento.

### 4. Rastreabilidade de Requisitos (No Invention)
- Associe cada bloco de desenvolvimento a uma especificação em `docs/prd/` (requisitos funcionais `FR-*`, não-funcionais `NFR-*` ou restrições `CON-*`).
- Não invente requisitos ou tecnologias fora dos artefatos e diretrizes previamente homologados.

### 5. Gates de Qualidade (Quality First)
- Antes de considerar uma story como concluída, execute e garanta aprovação limpa em:
  - Linting: `npm run lint`
  - Typecheck: `npm run typecheck`
  - Testes: `npm test`
  - Build: `npm run build`
- **Imports Absolutos:** Use aliases absolutos (`@/`) para todas as importações fora do escopo imediato da feature no frontend/backend JS/TS.

---

## 🛡️ Guardrails Globais de IA & Segurança (AI Governance Pack)

### 1. Políticas de Proteção de Dados (LGPD)
- **Mascaramento de Dados:** Mascare e oculte informações sensíveis pessoais ou comerciais (CPFs, e-mails, telefones, dados clínicos de tutores/pacientes).
- **Segredos no Código:** É terminantemente proibido embutir chaves de API, senhas, tokens ou segredos estaticamente em arquivos de código fonte. Utilize variáveis de ambiente (`.env`).

### 2. Política de Confirmação de Ferramentas
- **Sem Confirmação (Passiva/Leitura):** Consultas, leitura de logs, resumos de texto, análises de conformidade e geração de rascunhos de arquivos.
- **Confirmação Explícita Exigida (Mutação/Rede):** Enviar e-mails/WhatsApp, exclusão física de arquivos, alteração direta em bancos de dados de produção, execução de transações financeiras e publicação de conteúdo de marketing.

### 3. Prevenção de Alucinação
- Diga "não consigo confirmar isso" ou declare explicitamente a incerteza sempre que faltar evidência verificável no workspace ou em referências oficiais.
- Nunca invente dependências tecnológicas, dados numéricos ou referências científicas/clínicas.

### 4. Controle de Custos e Contexto (Cost Rules)
- **Respostas Objetivas:** Responda de forma concisa e direta, limitando o tamanho das respostas ao estritamente necessário.
- **Gerenciamento de Contexto:** Resuma e condense históricos longos do chat antes de carregar arquivos volumosos para otimizar tokens.
- **Alertas de Orçamento:** Notificar o usuário quando o consumo atingir os gates de **50%**, **75%**, **90%** e **100%** do consumo planejado.

---

## 🏛️ Roteamento de X-Squads Integrados

Sempre que a tarefa exigir competências específicas de negócio, tráfego, design, segurança ou branding, consulte a lista abaixo e leia o prompt compilado correspondente em `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia/`.

| Squad Recomendado | Caso de Uso / Problema | Caminho do Prompt Condensado |
| :--- | :--- | :--- |
| **Advisory Board** | Planejamento estratégico, tomada de decisão e análise de riscos de negócios. | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\01-advisory-board.md` |
| **Brand Squad** | Naming, identidade visual, marca e posicionamento de comunicação. | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\02-brand-squad.md` |
| **C-Level Squad** | Alinhamento executivo, análise GTM (Go-To-Market) e infraestrutura. | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\03-c-level-squad.md` |
| **Claude Code Mastery** | Otimização de prompts, ferramentas MCP e automações avançadas. | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\04-claude-code-mastery.md` |
| **Copy Master / Copy Squad** | E-mails de conversão, VSLs, páginas de venda e anúncios persuasivos. | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\05-copy-master.md` |
| **Cybersecurity** | Auditoria de segurança, pentests, LGPD e conformidade ISO. | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\07-cybersecurity.md` |
| **Data Squad** | Growth hacking, SQL complexo, analítica de funil e métricas. | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\08-data-squad.md` |
| **Design Squad** | Design Systems, Atomic Design, UX Research e layouts UI. | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\09-design-squad.md` |
| **Hormozi Squad** | Estruturação de ofertas comerciais irresistíveis e captação de leads. | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\10-hormozi-squad.md` |
| **Movement** | Criação de comunidades de marca, narrativas e programas de embaixadores. | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\11-movement.md` |
| **Storytelling** | Apresentações impactantes, pitch decks e narrativa do produto. | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\12-storytelling.md` |
| **Traffic Masters** | Gestão de tráfego pago (Meta Ads, Google Ads, TikTok Ads, YouTube). | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\13-traffic-masters.md` |

---

## 🛠️ Padrões e Convenções Comuns

### Git & GitHub
- Use commits semânticos: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
- Sempre inclua o ID da story nos commits: `feat: implementar validação de RLS [Story 1.2.3]`.
- Apenas o agente `@devops` tem autorização para realizar `git push` no branch remoto ou criar Pull Requests.

### Tratamento de Erros (JS/TS)
```typescript
try {
  // Operação
} catch (error) {
  console.error(`Erro ao executar ${operacao}:`, error);
  throw new Error(`Falha na operação ${operacao}: ${(error as Error).message}`);
}
```

### Operações com Arquivos
- Sempre resolva caminhos usando caminhos absolutos baseados no diretório do projeto para evitar inconsistências entre ambientes.

---
*Synkra AIOX & Vibe Coding Governance Rules v1.1*
