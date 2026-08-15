# Auditoria das Ferramentas Clínicas — Vet do Rim

**Data:** 22/07/2026
**Escopo:** 7 ferramentas em `/ferramentas` + planilha laboratorial
**Referências usadas:** IRIS oficial (iris-kidney.com, revisão vigente), docs internos (`clinical-engine-revalidation-plan.md`), guias de fabricantes de dieta renal
**Método:** leitura da lógica pura + componentes, verificação de faixas contra fonte oficial, execução da suíte de testes, revisão dimensional das calculadoras e segunda opinião independente (subagente) no motor de maior risco (eletrólitos)

---

## Resumo executivo

O estadiamento IRIS (DRC e IRA) está **clinicamente correto e atualizado** — inclusive a ampliação recente do Estágio 2 do cão (≈2,8 mg/dL / 249 µmol/L). O motor de fluidoterapia está dimensionalmente coerente. O motor de **eletrólitos concentrava os problemas mais sérios**: três deles já foram corrigidos com segurança (rótulos de unidade e guarda contra dose negativa).

Achado estrutural mais importante: existe uma **contradição de governança** — o `clinical-engine-revalidation-plan.md` determina que fluidoterapia, eletrólitos e dieta fiquem *fail-closed* (bloqueados) até homologação por dois revisores veterinários, mas essas ferramentas estão **no ar e prescritivas**. Isso precisa de decisão sua.

Nenhuma calculadora clínica tem teste automatizado (os 120 testes que passam cobrem só segurança/tenancy/migração).

### Correções já aplicadas (seguras, sem alterar dose)

| # | Ferramenta | Problema | Correção |
|---|---|---|---|
| 1 | Fósforo | Card "Taxa" exibia o total (`rate×peso` = mmol/h) mas rotulado **"mmol/kg/h"** — risco de o vet multiplicar de novo pelo peso (~10×) | Rótulo → **"mmol/h"** |
| 2 | Potássio | "Conc. no frasco" exibia mEq/L mas rotulado **"mEq/100mL"** (erro de 10×) | Rótulo → **"mEq/L"** |
| 3 | Bicarbonato | Sem alvo > medido, exibia **déficit e doses negativas** (viola regra HC-03) | Guarda *fail-closed*: bloqueia e explica quando HCO₃⁻ medido ≥ alvo |
| 4 | Potássio | Erro de digitação "suplementão" | → "suplementação" |

Validação: `esbuild` compila o arquivo sem erros; suíte `npm test` continua 120/120.

---

## Achados por ferramenta

### 1. Estadiamento IRIS / TFG (`tfg-calculator.ts`) — OK
- Creatinina, SDMA, proteinúria (UPC) e pressão arterial conferem com a revisão vigente do IRIS. Creatinina cão Estágio 2 até 2,8 mg/dL reflete a ampliação oficial (mirror do gato, 249 µmol/L). SDMA por espécie (gato ≤25/≤38; cão ≤35/≤54) e subestágios de UPC (cão 0,2–0,5; gato 0,2–0,4) e PA (<140 / 140–159 / 160–179 / ≥180) corretos.
- Regra "usar o maior estágio entre creatinina e SDMA" está de acordo com o IRIS.
- Observação (produto, não bug): `requiresAuth: finalStage >= 2` bloqueia detalhes dos estágios 2–4 para não autenticados.

### 2. Injúria Renal Aguda (`aki-grading.ts` + `IRACalculator.tsx`) — OK
- Faixas IRIS AKI (I <1,6 / II 1,7–2,5 / III 2,6–5,0 / IV 5,1–10 / V >10) corretas. Critério Δ ≥0,3 mg/dL em ≤48h correto. Débito urinário tratado como subgrau O/NO sem elevar o grau — correto.
- O intervalo entre cortes (ex.: 1,6–1,7) retorna *bloqueio* com mensagem "intervalos entre cortes exigem interpretação veterinária" — é **fail-safe intencional**, não bug. Sugestão: documentar essa decisão para não ser "corrigida" por engano no futuro.

### 3. Fluidoterapia (`FluidoterapiaCalculator.tsx`) — OK dimensional
- Manutenção alométrica (cão 132×kg^0,75; gato 80×kg^0,75), déficit (%×kg×1000 = mL), bolus de choque (cão 20 / gato 10 mL/kg; máx. cão 90 mL/kg) — todos coerentes e citados (AAHA/AAFP 2013, DiBartola).
- Sem bug de cálculo. Depende da governança (ver seção final).

### 4. Reposição Eletrolítica (`ReposicaoEletroliticaCalculator.tsx`) — corrigido + pendências
Confirmado por segunda opinião independente: escala de potássio (DiBartola 80/60/40/28/20 mEq/L), limite absoluto 0,5 mEq/kg/h, as duas opções de segurança, cálculo de Ca elementar (gluconato 9,3 / CaCl₂ 27,2 mg/mL), MgSO₄ 50% ≈4 mEq/mL e NaHCO₃ 8,4% =1 mEq/mL — **todos corretos**. Déficit de bicarbonato com fator 0,3 (espaço de distribuição) é defensável e conservador.
- Corrigidos itens 1–4 acima.
- **Pendências que exigem seu aval** (ver seção "Propostas clínicas").

### 5. Dieta Renal (`dieta-renal-calculator.ts`) — verificar fonte
- Interpolação linear e estimativa de peso ideal por ECC funcionam. Tabelas monotônicas e kcal plausíveis.
- **Não foi possível verificar os gramas exatos** contra os fabricantes (sites regionais/renderizados em JS). A governança exige SKU/versão com fonte e transcrição aprovada por dois revisores. Recomendo tratar as tabelas como **não verificadas** até checagem na embalagem atual (dado marcado "mai/2025").
- Nuance clínica: para ECC < 5 (abaixo do peso), `estimarPesoIdeal` usa o peso atual → pode **subalimentar** o paciente renal que precisa recuperar peso. Revisar.

### 6. Controle de Peso (`peso-controller.ts` + `ControlePesoTool.tsx`) — pequenos ajustes
- Armazenamento local com validação, proteção contra CSV injection e limite de 500 registros — bom.
- `listarPesos` com filtro **não ordena** (sem filtro, ordena). Inconsistência menor.
- Sem guarda contra **data futura** (a governança proíbe). Recomendo bloquear datas futuras.

### 7. Planilha Laboratorial (`reference-status.ts`) — OK
- Faixas de referência são inseridas pelo usuário (não há valores clínicos fixos a auditar). Parsing robusto (aceita vírgula/ponto, rejeita parciais). Marca fora de faixa corretamente.

---

## Propostas clínicas (precisam do seu aval antes de aplicar)

Estas mudanças alteram comportamento clínico; conforme combinado, listo para sua decisão como revisor veterinário.

**Alta prioridade**
- **P1 — Guarda de hipercalemia (Potássio):** hoje a ferramenta aceita K⁺ até 8 mEq/L e ainda recomenda suplementar mesmo com K⁺ alto. Propor bloqueio/aviso a partir de um corte (ex.: K⁺ ≥ 5,0–5,5 mEq/L — *corte a definir por você*).
- **P2 — Checar função renal/diurese antes de suplementar K⁺:** exigir confirmação de débito urinário/ausência de anúria antes de exibir dose (crítico num público renal). Alinha com a matriz da governança.

**Média prioridade**
- **P3 — Limites de taxa graduados do potássio:** a coluna `maxRate` (0,50/0,25/0,15/0,10/0,05) existe na tabela mas **nunca é usada** — só o teto fixo de 0,5 é aplicado. Definir se os limites graduados devem valer por faixa.
- **P4 — Magnésio/Fósforo sem ponto médio fixo:** magnésio usa ponto médio fixo (0,875/0,225 mEq/kg/dia) e fósforo taxa fixa; a governança pede não usar ponto médio como protocolo. Avaliar pedir o valor sérico e faixa.

**Estrutural**
- **P5 — Governança:** decidir se fluidoterapia/eletrólitos/dieta devem (a) voltar a *fail-closed* conforme o plano, ou (b) o plano ser atualizado para refletir que estão liberadas como "ferramenta de suporte". Hoje há contradição documentada.

---

## Recomendações de aperfeiçoamento

1. **Adicionar testes de golden cases** para cada função pura (`tfg-calculator`, `aki-grading`, `dieta-renal-calculator`, e o motor de eletrólitos). Hoje há zero cobertura clínica. Posso escrever testes que travam o comportamento atual (sem inventar valores novos).
2. **Versão do motor e fonte no resultado** (o contrato da governança já prevê `engineVersion`/`sourceSetVersion`). Ajuda auditoria e reprodutibilidade.
3. **Datar e sourcear as tabelas de dieta** por SKU/região, com link direto ao guia do fabricante.
4. **Documentar o fail-safe do AKI** (intervalos entre cortes) para não ser removido por engano.

---

## Referências oficiais consultadas
- IRIS Staging System — https://www.iris-kidney.com/iris-staging-system
- IRIS Guidelines — https://www.iris-kidney.com/iris-guidelines-1
- IRIS AKI Grading — referenciado nas próprias ferramentas
