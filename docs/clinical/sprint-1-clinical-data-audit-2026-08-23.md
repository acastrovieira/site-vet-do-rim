# Auditoria clínica de dados laboratoriais — Sprint 1

**Data:** 2026-08-23  
**Escopo:** unidades, faixas de referência e classificação de resultados laboratoriais  
**Dados usados:** somente fixtures sintéticas/anônimas  
**Veredito:** **NO-GO** para classificação automática de registros legados, migrations remotas e deleção do laudo original

## Resultado executivo

O fluxo legado guarda apenas números em `resultado_ia`. Ele não preserva, para
cada analito, a unidade nem a faixa impressa pelo laboratório. Portanto, não há
evidência suficiente para atribuir unidade, converter escala ou calcular status
de referência posteriormente.

A proteção implementada nesta auditoria cria uma observação canônica que:

- preserva o texto revisado do valor, unidade e faixa do laudo;
- separa texto impresso, número parseado e unidade canônica;
- nunca converte silenciosamente `/µL`, `×10³/µL` ou unidades bioquímicas;
- classifica apenas quando valor, unidade e os dois limites provêm do mesmo
  laudo, estão completos e possuem unidades compatíveis;
- retorna `not_classified` diante de dado ausente, qualificador, unidade
  desconhecida, faixa incompleta, divergência de unidade ou referência de
  catálogo legado;
- impede tendência numérica entre exames com unidades incompatíveis.

## Achados bloqueadores

### P0 — O schema legado perdeu a dimensão do resultado

`supabase/functions/parse-laudo/index.ts` solicita somente números para
hemograma, plaquetas, ureia, creatinina e demais analitos. A unidade e a faixa
impressa não fazem parte do item. O mesmo número pode representar escalas
diferentes, especialmente em contagens celulares.

**Consequência:** nenhuma rotina posterior pode inferir a unidade com segurança.
Esses registros devem permanecer sem classificação até revisão do original.

### P0 — A migration normalizadora presume unidade e faixa não capturadas

`supabase/migrations/20260823000300_pdf_lifecycle_and_populate.sql` atribui
unidades e intervalos fixos a números que chegaram sem esses campos. Também
usa espécie canina como fallback quando a espécie/paciente não é resolvida.

Foram encontradas divergências internas entre essa migration e
`web/src/lib/lab/reference-values.ts` para plaquetas, VPM, ureia, creatinina e
outros analitos. Esta auditoria não escolhe um dos intervalos: ambos carecem de
proveniência laboratorial/versionamento e exigem validação humana.

**Consequência:** `status_ref` produzido por essa função não é clinicamente
confiável e não deve ser publicado, filtrado como alerta ou usado para decisão.

### P0 — Escala de plaquetas e leucograma pode divergir por fator 1.000

Laudos podem expressar contagens em `/µL` ou `×10³/µL`. O fluxo legado
não informa qual escala acompanhava o número. A migration presume uma unidade
para cada parâmetro. O catálogo TypeScript também continha faixa na escala
absoluta com rótulo `×10³/µL`; o rótulo foi corrigido dimensionalmente para
`/µL`, mas o catálogo deixou de ser fallback da tabela/exportação.

**Consequência:** valores legados de plaquetas e leucograma não podem receber
status nem tendência sem recuperar e revisar unidade/faixa do laudo.

### P0 mitigado localmente — Descarte imediato removia a evidência primária

As migrations históricas `20260823000200`/`00300` descrevem `Extract & Discard`
e o runtime removia o PDF após uma extração concluída. Isso conflita com o ADR-003, que exige
original privado e imutável, hash verificável e política de retenção aprovada.
Um hash sem o objeto não permite conferir novamente valor, unidade ou faixa.

**Contenção aplicada:** `parse-laudo` não remove mais o original; o cron legado
passou a responder sem consulta ou mutação e saiu do agendamento local. O fluxo
local confirma a existência de `original.pdf` e o mantém após o sucesso. O hash,
tamanho e versões de extração permanecem na proveniência da IA.

**Consequência residual:** o descarte deve permanecer bloqueado. A decisão de retenção
exige Architect, Security e Data Governance/DPO; não é decisão do validador
clínico.

## Mudanças seguras aplicadas

- `canonical-observation.ts`: contrato sem intervalos clínicos embutidos e
  classificação fail-closed contra a faixa do próprio laudo.
- extração local: preserva texto revisado do valor/faixa, unidade, página,
  origem e observação canônica.
- validação server-side: rejeita divergência entre texto revisado e números.
- parser: reconhece variações sintáticas de `/µL`, `/mm³`, `×10³/µL`,
  `mmol/L` e `µmol/L`, preservando a escala numérica original.
- tabela evolutiva: não usa faixa por espécie como fallback e não calcula
  tendência entre unidades diferentes/ausentes.
- exportação: não inventa unidade canina para registros legados e somente
  exporta status derivado da observação canônica.
- evidência original: exclusão automática retirada da Edge Function e do cron;
  nenhum prazo de retenção foi inventado.
- fixtures: plaquetas, leucograma, ureia e creatinina sintéticos, incluindo
  escalas/unidades incompatíveis e ausência de evidência.

## Decisões que exigem patologista veterinário humano

1. Validar quais nomes representam o mesmo mensurando em cada laboratório
   (por exemplo, ureia versus outro analito nitrogenado); o sistema não deve
   mapear por semelhança textual sem contrato do laboratório.
2. Definir tratamento de resultados qualificados (`<`, `>`, `≤`, `≥`) e
   faixas unilaterais. O comportamento atual é não classificar.
3. Aprovar se alguma conversão de unidade será permitida. Cada conversão deve
   ter mensurando, fórmula, versão, fonte e testes próprios; nenhuma foi criada.
4. Definir como registrar flags morfológicos e pré-analíticos (por exemplo,
   observações que invalidem uma contagem) sem transformá-los em diagnóstico.
5. Homologar catálogos de apoio somente se houver fonte, população, método,
   equipamento/laboratório, vigência e versionamento. Até lá, não devem
   classificar resultados.

## Evidência de validação local

- `npm test`: 149/149 testes aprovados.
- `npm run typecheck`: aprovado.
- Testes clínicos novos não contêm dados identificáveis nem alegam intervalos
  universais; validam somente preservação, compatibilidade dimensional e
  comportamento fail-closed.
