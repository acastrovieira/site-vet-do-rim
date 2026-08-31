# LAB-EVO-001 — Plano de sprints: custo zero de IA, referências IRIS e acesso do tutor

**Criado:** 2026-08-30
**Status:** Draft — aguarda validação (@po `*validate-story-draft`)
**Entradas:** revisão em `docs/relatorios/revisao-migrations-2026-08-30.md`; JSON de referências clínicas fornecido pelo responsável técnico em 2026-08-30.

## Objetivo

Reduzir a zero o custo de IA no caminho principal de lançamento de exames, substituir o catálogo de referências legado por um versionado com fonte citada, e abrir acesso do tutor sem duplicar paciente nem contaminar dado clínico.

## Estado atual (verificado, não presumido)

| Frente | Onde está |
|---|---|
| Parser local | Ampliado e testado em 2026-08-29 (aliases BR, faixa de referência em qualquer posição, melhor match global). 13 testes. |
| Modo econômico da IA | `interpretacao_ia` não é mais pedida ao modelo; bloco neutro no servidor. **Não deployado.** |
| Lançamento manual | Camada de validação pronta (`manual-entry.ts`), com as mesmas travas do fluxo de PDF. Falta migration, API e UI. |
| Acesso do tutor | **Não existe.** `/portal` tem 3 links institucionais; `tutores` não tem vínculo com `auth.users`; nenhuma RLS menciona o papel de tutor. |
| Integridade do banco | 4 defeitos abertos (M-01 a M-04) — ver relatório de revisão. |

---

# Sprint 0 — Integridade do banco (bloqueante)

Nada das sprints seguintes deve ir a produção antes disto. Duas das seis migrations revisadas impedem que um ambiente limpo suba do zero, e o isolamento entre clínicas está hoje sem trava no schema.

| # | Tarefa | Agente | Skill | Saída |
|---|---|---|---|---|
| 0.1 | Migration que adiciona as FKs de tenant ausentes, incluindo `fk_pets_tutor_same_clinic` (NOT VALID, depois VALIDATE) | @data-engineer (Dara) | `architect-first` | migration + query de órfãos |
| 0.2 | Migration que resolve a clínica padrão dinamicamente, encerrando o UUID hardcoded (M-02) | @data-engineer | — | migration |
| 0.3 | Rota `/api/cron/purge-claim-events` no padrão da `cleanup-storage`, protegida por `CRON_SECRET` (M-04) | @dev (Dex) | — | route + teste |
| 0.4 | Converter o recovery de laudos presos em rotina operacional via `refund_laudo_ia` (M-03) | @dev | — | script/rota + runbook |
| 0.5 | Validar isolamento multi-tenant end-to-end após as FKs | @qa (Quinn) | `security-review` | gate PASS/CONCERNS |
| 0.6 | Deploy: `supabase db push`, `functions deploy parse-laudo`, `GEMINI_MODEL` | @devops (Gage) | — | release |

**DoD:** `check:predeploy` verde; ambiente limpo sobe do zero com `db push`; tentativa de gravar pet e tutor de clínicas diferentes é rejeitada pelo banco.

---

# Sprint 1 — Referências clínicas versionadas

Substitui `CANINE_REF` e `FELINE_REF` (hoje marcados `@deprecated`, sem proveniência) pelo catálogo fornecido, e separa duas coisas que hoje se confundem: **faixa de normalidade** ("este valor está normal?") e **corte de estadiamento IRIS** ("este animal está em que estágio?").

| # | Tarefa | Agente | Skill | Saída |
|---|---|---|---|---|
| 1.1 | Resolver as 5 pendências clínicas abaixo com o responsável técnico | @analyst (Alex) | — | decisões registradas |
| 1.2 | Catálogo versionado com `fonte`, `versao` e `revisado_em` por parâmetro | @architect (Aria) | `architect-first` | ADR + módulo |
| 1.3 | Migrar `CANINE_REF`/`FELINE_REF` para o novo catálogo, preservando os parâmetros que o JSON não cobre | @dev | — | refactor + testes |
| 1.4 | Novas chaves numéricas: SDMA, cálcio total, cálcio ionizado, cloro, reticulócitos | @dev | — | tipo + schema + planilha |
| 1.5 | Urinálise qualitativa (densidade, pH, proteína de fita, UPC) — tipo próprio, não `RefRange` | @architect + @dev | — | contrato novo |
| 1.6 | Migration ampliando o `CHECK (parametro IN ...)` de `exam_result_items` | @data-engineer | — | migration |
| 1.7 | Estadiamento IRIS a partir do histórico da planilha (creatinina/SDMA + subestadiamento UPC e PAS) | @dev | — | módulo + testes de borda |
| 1.8 | Revisão clínica dos cortes implementados | @qa | `checklist-runner` | gate |

## Pendências clínicas — precisam da sua decisão antes da tarefa 1.2

**P-1. As bordas dos estágios IRIS têm sobreposições e lacunas.** Como está no JSON, alguns valores caem em dois estágios e outros em nenhum:

| Espécie | Parâmetro | Problema |
|---|---|---|
| Cão | creatinina | `1.4` cai no estágio 1 **e** no 2; `5.0` no 3 **e** no 4; nada entre `2.8` e `2.9` |
| Gato | creatinina | `1.6` no estágio 1 **e** no 2; mesmo vazio em `2.8`–`2.9` e sobreposição em `5.0` |
| Ambos | SDMA | `18` em dois estágios; `54` em dois; nada entre `35` e `36` |
| Gato | UPC | `0.2` em não-proteinúrico e borderline; `0.4` em borderline e proteinúrico |
| — | PAS | `140` em normotenso e pré-hipertenso; nada entre `159` e `160` |

Um classificador precisa de uma regra única. A convenção usual é **limite inferior inclusivo, superior exclusivo** (`min <= valor < max`), que resolve todas as sobreposições e a maioria dos vazios. Confirma essa convenção?

**P-2. O JSON não cobre o catálogo inteiro.** Ele traz hematologia parcial, bioquímica e urinálise, mas **não** traz: HCM, RDW, leucócitos totais, neutrófilos (segmentados e bastões), linfócitos, monócitos, eosinófilos, basófilos, plaquetas, VPM, ALT/TGP e AST/TGO. Se eu substituir o catálogo legado inteiro, esses 13 parâmetros ficam sem referência. Mantenho os legados para eles, ou você envia um segundo bloco?

**P-3. Divergências entre o JSON e o catálogo em uso.** Onde os dois discordam, o JSON prevalece — mas vale conferir, porque muda a classificação de resultados já lançados:

| Parâmetro | Espécie | Em uso hoje | JSON novo |
|---|---|---|---|
| Creatinina | cão | 0,5 – 1,8 | **0,5 – 1,5** |
| Ureia | cão | 21 – 60 | **15 – 60** |
| Ureia | gato | 42 – 64 | **20 – 65** |
| Hematócrito | gato | 24 – 45 | **30 – 45** |
| VCM | cão | 60 – 74 | **60 – 77** |
| Fósforo | cão | 2,6 – 6,2 | **2,5 – 5,0** |
| Fósforo | gato | 3,1 – 6,8 | **2,5 – 5,0** |
| Potássio | cão | 4,0 – 5,8 | **3,5 – 5,5** |
| Potássio | gato | 4,0 – 5,3 | **3,5 – 5,5** |
| Sódio | gato | 147 – 156 | **145 – 158** |
| Albumina | cão | 2,6 – 3,3 | **2,5 – 4,0** |
| Albumina | gato | 2,1 – 3,3 | **2,5 – 4,0** |
| Proteína total | cão | 5,4 – 7,1 | **5,4 – 7,5** |
| Proteína total | gato | 5,7 – 7,8 | **6,0 – 8,0** |

**P-1 e P-4 — RESOLVIDAS em 2026-08-30.** A diretriz vigente é a **IRIS Staging
of CKD (Modified 2026)**, transcrita da fonte oficial em
`docs/clinical/referencias-laboratoriais-extracao-2026-08-30.md` (Fonte C). Ela
não tem bordas sobrepostas, então a convenção proposta em P-1 é desnecessária: os
cortes são usados como a diretriz os define. O `tfg-calculator.ts` foi conferido
e já estava correto. O que estava desatualizado era o JSON de 2023, cujo SDMA
felino repetia o canino.

~~**P-4. Versão do IRIS.**~~ *(resolvida — mantida abaixo como registro)* O JSON cita *IRIS Staging Guidelines 2023*. O código já publicado cita **2026** — em `IRACalculator.tsx` ("IRIS AKI Grading Guidelines 2026") e na página de estadiamento. Duas versões citadas no mesmo produto é problema de confiabilidade clínica. Qual é a vigente?

**P-5. Fósforo e potássio como meta terapêutica.** O JSON os marca com `tipo: meta_terapeutica`, e o próprio aviso diz que são metas por estágio, não critério de estadiamento. Meta por estágio não é faixa de normalidade fixa — modelo isso como um terceiro tipo, ou por ora trato os dois apenas como faixa de normalidade?

---

# Sprint 2 — Planilha interativa com lançamento manual

Custo de IA: zero. É o caminho do plano free.

| # | Tarefa | Agente | Skill | Saída |
|---|---|---|---|---|
| 2.1 | Migration: `laudos_pdf.storage_path` nullable, coluna `origem_resultado` com `CHECK`, e a invariante "lançamento manual não tem arquivo" | @data-engineer | — | migration |
| 2.2 | Rota `POST /api/lab/pacientes/[petId]/exames-manuais` (padrão da `results-local`: authorize, rate limit, service client) | @dev | — | route + testes |
| 2.3 | Popular `exam_result_items` no lançamento manual via `populate_exam_result_items` | @dev | — | integração |
| 2.4 | Formulário interativo por categoria, com as unidades do catálogo e validação em tempo real | @ux-design-expert (Uma) + @dev | `frontend-design` | componente |
| 2.5 | Marcar visualmente a procedência na planilha evolutiva (manual, PDF local, IA) | @ux-design-expert | — | UI |
| 2.6 | Garantir que o export CSV/XLSX carrega a procedência | @dev | — | ajuste + teste |
| 2.7 | Revisão de segurança do novo caminho de escrita clínica | @qa | `security-review` | gate |

**Já pronto:** `manual-entry.ts` valida o payload reusando as travas do fluxo de PDF, exige data de coleta e recusa a origem manual no caminho do PDF. 2 testes.

---

# Sprint 3 — Portal do tutor

Escopo decidido: **leitura + lançamento marcado**, com confirmação do veterinário antes de o valor contar como dado clínico.

| # | Tarefa | Agente | Skill | Saída |
|---|---|---|---|---|
| 3.1 | Desenho técnico: vínculo N:N conta/ficha, fluxo de convite, matriz de RLS | @architect | `architect-first` | ADR |
| 3.2 | Migration: tabela de vínculo + código de convite com expiração e uso único | @data-engineer | — | migration |
| 3.3 | RLS de leitura do tutor (pets e exames pelos vínculos da conta) | @data-engineer | — | policies |
| 3.4 | Fluxo de convite: veterinário gera, tutor resgata | @dev | — | rotas + UI |
| 3.5 | `/portal` real: histórico e evolução dos pets vinculados, com export | @ux-design-expert + @dev | `frontend-design` | páginas |
| 3.6 | Lançamento do tutor em estado "aguardando confirmação", fora da evolução clínica até o veterinário aprovar | @dev | — | fluxo |
| 3.7 | Fila de confirmação no lado do veterinário | @dev | — | UI |
| 3.8 | Teste de isolamento: tutor A jamais alcança pet de tutor B nem de outra clínica | @qa | `security-review` | gate |

**Invariante que elimina a duplicidade:** o tutor **nunca cria paciente**. Ele se vincula a um pet que a clínica já cadastrou, por convite. Sem convite, tem conta e não enxerga paciente nenhum. O vínculo é N:N porque `tutores` é multi-tenant (tem `clinic_id`), então o mesmo humano tem uma ficha por clínica; uma conta apontando para várias fichas resolve "atendida em duas clínicas" sem nunca duplicar o pet.

---

## Ordem e dependências

```
Sprint 0 ─┬─> Sprint 1 ─┐
          │             ├─> Sprint 3
          └─> Sprint 2 ─┘
```

Sprint 1 e 2 podem correr em paralelo depois do Sprint 0, com frentes diferentes: 1 é catálogo clínico, 2 é fluxo de aplicação. A tarefa 2.1 depende da 0.1. Sprint 3 depende de 2 (reusa a validação de lançamento) e de 0 (as FKs de tenant sustentam a RLS do tutor).

## Regras de autoridade (`.claude/rules/agent-authority.md`)

- `git push`, PR e deploy: **@devops apenas**.
- DDL, RLS e migrations: **@data-engineer**.
- Ciclo de story: `@sm *draft` → `@po *validate-story-draft` → `@dev` → `@qa *qa-gate` → `@devops *push`.
- Nenhuma referência clínica entra sem fonte citada (Constitution, Artigo IV — No Invention).
