---
name: aiox-vibe-framework
description: Orquestra e padroniza o desenvolvimento de software no padrão AIOX (CLI First, Agent Authority, Story-Driven Dev, No Invention, Quality First) em ambientes de vibe coding (Antigravity, Claude Code, Codex, Cursor) e aplica as diretrizes globais do AI Governance Pack (Guardrails, Cost Rules). Não suporta modificações diretas no core do framework AIOX nem ignora a constituição.
---

# aiox-vibe-framework — Metodologia e Governança de Vibe Coding

## Missão
Orquestrar a execução de desenvolvimento de software em workspaces AIOX. Garantir que todas as IAs e subagentes sigam a hierarquia CLI-First, a autoridade de agentes, o desenvolvimento guiado por histórias (stories), as validações de qualidade e os limites do AI Governance Pack.

---

<!-- SQUAD-RUNTIME-BOOTSTRAP:START -->
## Orquestração do Squad
Esta skill é operada de forma coordenada pelo squad de agentes especializados. Para detalhes de orquestração e fluxos de trabalho, veja [squad-runtime.md](references/squad-runtime.md).
- **Líder do Squad**: `@aiox-master`
<!-- SQUAD-RUNTIME-BOOTSTRAP:END -->

---

## Diretrizes de Vibe Coding & Padrões Core

### 1. Rastreamento e Escopo (Story-Driven)
- Verifique se a story ativa está documentada sob `docs/stories/` antes de iniciar a modificação de arquivos de código fonte.
- Atualize os checkboxes de progresso e a lista de arquivos alterados diretamente no arquivo da story durante o desenvolvimento.
- Evite criar novas features ou alterar escopos fora do especificado nos critérios de aceitação.

### 2. Hierarquia de Desenvolvimento (CLI First)
- Desenvolva e teste 100% da lógica e das funcionalidades em nível de CLI (scripts locais ou de comando) antes de implementar componentes de interface visual.
- Garanta que qualquer painel ou painéis de controle na web sirvam estritamente para observar ou apresentar métricas, sem possuir autoridade para realizar mutações no banco de dados de forma autônoma.

### 3. Divisão de Trabalho (Agent Authority)
- Delegue as tarefas do fluxo conforme as personas autorizadas:
  - `@architect` para decisões de arquitetura de pastas, design patterns e schemas.
  - `@dev` para escrever lógica de frontend/backend e funções de negócio.
  - `@qa` para escrever casos de teste e validar critérios de aceitação.
  - `@devops` para criar commits, realizar pushes e gerar tags de lançamento.

### 4. Rastreabilidade de Requisitos (No Invention)
- Associe cada bloco de desenvolvimento a uma especificação em `docs/prd.md` (como requisitos funcionais `FR-*`, não-funcionais `NFR-*` ou constraints `CON-*`).
- Recuse pedidos que solicitem a adição de recursos não contemplados nos artefatos de requisitos previamente ratificados.

### 5. Gates de Qualidade (Quality First)
- Execute `npm run lint`, `npm run typecheck` e os testes unitários (`npm test`) antes de considerar a story como concluída.
- Certifique-se de que a cobertura de testes não regrida durante a inclusão de novas lógicas.
- Utilize aliases absolutos (`@/`) para todas as importações fora do escopo imediato da feature.

---

## Guardrails Globais de IA & Segurança

### 1. Políticas de Proteção de Dados (LGPD)
- Mascare e oculte informações sensíveis pessoais ou comerciais (CPFs, e-mails, telefones, dados clínicos de tutores/pacientes).
- É proibido embutir chaves de API, segredos corporativos, tokens ou senhas estaticamente nos arquivos do projeto.

### 2. Política de Confirmação de Ferramentas
- **Sem Confirmação Necessária**: Operações passivas de consulta, leitura de logs, resumos de texto, análises de conformidade e geração de rascunhos de arquivos.
- **Confirmação Explícita Exigida**: Enviar e-mails/WhatsApp, deleção de arquivos do sistema, transações financeiras e alteração ou inserção direta em bancos de dados de produção.

### 3. Prevenção de Alucinação
- Responda apenas com base em evidências verificáveis. Se a informação não puder ser confirmada no workspace ou em referências oficiais, declare explicitamente a incerteza.
- Nunca invente dependências tecnológicas, dados numéricos ou referências científicas/clínicas.

### 4. Controle de Custos e Contexto (Cost Rules)
- Responda de forma concisa e objetiva por padrão, evitando explicações teóricas repetitivas ou prolixas.
- Resuma e condense o histórico longo do chat antes de carregar arquivos volumosos na memória para otimizar o consumo de tokens de API.

---

## Roteamento e Ativação de X-Squads

Sempre que a tarefa exigir conhecimentos de negócio, tráfego, design, segurança ou branding, consulte a lista de squads disponíveis no catálogo e indique ao modelo para ler o respectivo prompt compilado em `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia/`.

| Caso de Uso / Problema | Squad Recomendado | Caminho do Prompt Condensado |
| :--- | :--- | :--- |
| Estratégia de Negócios / Investimentos | Advisory Board | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\01-advisory-board.md` |
| Branding / Naming / Identidade Visual | Brand Squad | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\02-brand-squad.md` |
| Estruturação e Decisões de Diretoria (C-Level) | C-Level Squad | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\03-c-level-squad.md` |
| Automações MCP, Workflows de IA, Claude Code | Claude Code Mastery | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\04-claude-code-mastery.md` |
| Copywriting / Páginas de Venda / Anúncios | Copy Master / Copy Squad | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\05-copy-master.md` |
| Auditoria de Segurança / Pentest / IAM / LGPD | Cybersecurity | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\07-cybersecurity.md` |
| Análise de Dados / Growth Experiments / SQL | Data Squad | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\08-data-squad.md` |
| Design Systems / Atomic Design / UX / UI | Design Squad | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\09-design-squad.md` |
| Ofertas Irresistíveis / Geração de Leads (Hormozi) | Hormozi Squad | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\10-hormozi-squad.md` |
| Criação de Comunidades e Movimentos de Marca | Movement | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\11-movement.md` |
| Apresentações / Pitch / Narrativa do Produto | Storytelling | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\12-storytelling.md` |
| Tráfego Pago / Facebook Ads / Google Ads / Mídia | Traffic Masters | `C:\Users\acast\PROJETOS\.x-squads\squad-prompts - cópia\13-traffic-masters.md` |
