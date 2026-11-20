# Checklist e Dossiê de Homologação Clínica — Vet do Rim

- **Data de Consolidação Técnica:** 2026-11-19
- **Referências Normativas Internas:** [`clinical-engine-revalidation-plan.md`](../../docs/clinical/clinical-engine-revalidation-plan.md), [`auditoria-ferramentas-clinicas-2026-07-22.md`](../../docs/auditoria-ferramentas-clinicas-2026-07-22.md)
- **Regra Inviolável:** nenhuma calculadora prescritiva contida (`fluidoterapia`, `reposicao-eletrolitica`, `dieta-renal`) nem o catálogo de referências em rascunho podem ser reativados sem a homologação clínica formal exclusiva do **Clínico e Administrador responsável** e a respectiva validação técnica automatizada.

---

## 1. Inventário Atual das 7 Ferramentas em `/ferramentas`

| Ferramenta | Rotas | Estado Atual | Cobertura Automatizada Local | Observação / Gate |
| --- | --- | --- | --- | --- |
| **Estadiamento IRIS da DRC** | `/ferramentas/estadiamento-iris`, `/ferramentas/calculadora-tfg` | Liberada (triagem IRIS 2026) | [`tfg-calculator.ts`](../../web/src/lib/tfg-calculator.ts), [`clinical-homologation-gates.test.ts`](../../web/tests/unit/clinical-homologation-gates.test.ts) | Estágios 2–4 exigem login (`requiresAuth: finalStage >= 2`). |
| **Injúria Renal Aguda (IRIS AKI 2026)** | `/ferramentas/injuria-renal-aguda` | Liberada com SSR Gate (`VetOnlyGate` -> papel `vet` ou `admin`) | [`aki-grading.ts`](../../web/src/lib/aki-grading.ts), [`clinical-homologation-gates.test.ts`](../../web/tests/unit/clinical-homologation-gates.test.ts), [`tools-functional.spec.ts`](../../web/tests/e2e/tools-functional.spec.ts) | Lacunas entre cortes (`1.6`, `2.55`, `5.05`) retornam bloqueio intencional (`null`). |
| **Planilha Laboratorial Gratuita** | `/ferramentas/planilha-laboratorial` | Liberada (comparação estrita contra faixa informada pelo usuário) | [`reference-status.ts`](../../web/src/lib/lab-free/reference-status.ts), [`clinical-homologation-gates.test.ts`](../../web/tests/unit/clinical-homologation-gates.test.ts) | Rejeita valores parciais (`"1.2 mg/dL"`) e faixas invertidas. |
| **Controle de Peso** | `/ferramentas/controle-de-peso` | Liberada (armazenamento local do navegador) | [`peso-controller.ts`](../../web/src/lib/peso-controller.ts), [`weight-history-safety.spec.ts`](../../web/tests/e2e/weight-history-safety.spec.ts), [`clinical-homologation-gates.test.ts`](../../web/tests/unit/clinical-homologation-gates.test.ts) | Corrigida em 2026-11-19 a ordenação em `listarPesos({ nomePaciente })` e adicionada validação civil + bloqueio de data futura diretamente em `salvarPeso`. |
| **Calculadora de Fluidoterapia** | `/ferramentas/fluidoterapia` | **Contida (`blocked`)** via `<ClinicalReviewNotice />`, `noindex, follow` | Verificado em [`clinical-homologation-gates.test.ts`](../../web/tests/unit/clinical-homologation-gates.test.ts) e [`tools-functional.spec.ts`](../../web/tests/e2e/tools-functional.spec.ts) | Permanece bloqueada até assinatura do Clínico e Administrador + contrato `ClinicalEngineResult<T>`. |
| **Reposição Eletrolítica** | `/ferramentas/reposicao-eletrolitica` | **Contida (`blocked`)** via `<ClinicalReviewNotice />`, `noindex, follow` | Verificado em [`clinical-homologation-gates.test.ts`](../../web/tests/unit/clinical-homologation-gates.test.ts) e [`tools-functional.spec.ts`](../../web/tests/e2e/tools-functional.spec.ts) | Depende das decisões veterinárias **P1–P5** abaixo. |
| **Dieta Terapêutica Renal** | `/ferramentas/dieta-renal` | **Contida (`blocked`)** via `<ClinicalReviewNotice />`, `noindex, follow` | Verificado em [`clinical-homologation-gates.test.ts`](../../web/tests/unit/clinical-homologation-gates.test.ts) e [`tools-functional.spec.ts`](../../web/tests/e2e/tools-functional.spec.ts) | Depende de validação das tabelas/SKUs Brasil e revisão de peso ideal quando `ECC < 5` pelo Clínico e Administrador. |

---

## 2. Decisões Veterinárias Pendentes

### 2.1 Calculadoras Prescritivas Contidas (`docs/auditoria-ferramentas-clinicas-2026-07-22.md`)

- [ ] **P1 (Alta) — Corte de Hipercalemia (`K⁺`):** definir o teto sérico (ex.: `≥ 5,0` ou `≥ 5,5 mEq/L`) a partir do qual suplementação de potássio é **bloqueada (`blocked`)** sem resposta numérica.
- [ ] **P2 (Alta) — Pré-requisito Renal/Diurese (`K⁺` e eletrólitos):** exigir confirmação explícita de débito urinário adequado (ausência de oligúria/anúria) e avaliação de função renal antes de calcular reposição.
- [ ] **P3 (Média) — Limites Graduados de Taxa (`K⁺`):** confirmar aplicação dos tetos graduados (`maxRate`) por faixa sérica de potássio na escala DiBartola em vez de teto único de `0,5 mEq/kg/h`.
- [ ] **P4 (Média) — Magnésio e Fósforo sem Ponto Médio Fixo:** definir regra clínica condicionada a nível sérico medido e faixa homologada (substituindo pontos médios fixos `0,875 / 0,225 mEq/kg/dia` e taxa empírica fixa).
- [ ] **P5 (Estrutural) — Governança e Escopo de Liberação:** confirmar quais motores serão reativados mediante contrato puro `ClinicalEngineResult<T>` e quais permanecerão contidos até piloto dedicado.
- [ ] **Dieta Renal — SKUs Brasil e `ECC < 5`:** validar e aprovar as tabelas vigentes diretamente a partir dos rótulos/fichas oficiais Brasil (Hill's, Royal Canin, Premier Pet, Farmina) e definir a regra nutricional para pacientes renais abaixo do peso (`ECC < 5`).

### 2.2 Biblioteca de Referências Laboratoriais (`reference-library.json`)

Status atual: **`draft-awaiting-clinical-approval`** (`35` parâmetros catalogados; permanece **proibida** como fallback de classificação em evolução/exportação até aprovação formal).

- [ ] **Arbitrar 6 conflitos registrados entre fontes (`knoll-tufts` vs `thrall-schalm`):** `basofilos`, `eosinofilos`, `leucocitos_totais`, `linfocitos`, `monocitos` e `neutrofilos_segmentados`.
- [ ] **Decidir cobertura dos 7 itens declarados em `unsourced`:** `plaquetas_vpm`, `reticulocitos`, `upc`, `densidade_urinaria`, `ph_urinario`, `proteina_fita`, `calcio_ionizado`.
- [ ] **Promover `status`** de `draft-awaiting-clinical-approval` apenas após aprovação formal do Clínico e Administrador e atualização de `clinical-references.test.ts` + `clinical-data-contract.test.ts` em PR próprio.

---

## 3. Os 9 Artefatos Obrigatórios por Motor Antes de Reativação (`clinical-engine-revalidation-plan.md` §11)

1. Especificação clínica versionada.
2. Registro imutável de fontes primárias (`sourceId`, `sourceSetVersion`, URL direta, data de publicação e acesso ISO 8601).
3. Matriz de inputs, unidades canônicas internas, regras e condições de `blocked`.
4. **Golden cases** e casos de borda assinados pelo Clínico e Administrador.
5. Suíte automatizada (unitária, fronteiras e integração UI) executada sobre a exata versão assinada.
6. Matriz de rastreabilidade `fonte -> regra -> codigo -> teste -> interface`.
7. Parecer de privacidade/LGPD (quando houver dado clínico identificável).
8. Termo formal de homologação com versão, data, escopo e assinatura do Clínico e Administrador.
9. Plano de monitoramento, canal de incidente, suspensão imediata e rollback fail-closed.

---

## 4. Termo de Aprovação e Assinatura (Homologação Única — Clínico e Administrador)

> **Estado atual:** **AGUARDANDO DECISÃO E ASSINATURA DO CLÍNICO E ADMINISTRADOR**. As 3 calculadoras prescritivas permanecem **bloqueadas** até aprovação formal.

- **Clínico e Administrador Responsável (Nefrologia / Governança Clínica e Técnica):**
  - Nome / CRMV: `________________________________________` · Data: `____/____/______` · Commit / Versão: `______________` · Assinatura: `____________________`
