# Extração de intervalos de referência laboratoriais — 2026-08-30

Transcrição das tabelas de intervalos de referência para **cão e gato** localizadas
nas obras de referência disponíveis, para alimentar a biblioteca clínica do
Lab Evolution.

## Escopo do que foi extraído

Foram transcritas **apenas as tabelas de intervalos de referência**, com citação de
obra, autor, instrumento analítico e página. Os livros não foram convertidos na
íntegra: intervalos laboratoriais são dados factuais e citar a origem deles é a
prática científica normal, mas reproduzir a obra inteira não é.

## Método e sua limitação

A extração usou `pdftotext -table` (Xpdf 4.06), que reconstrói a tabela por
posição de coluna. **Isso importa:** o modo `-layout` convencional embaralhou as
mesmas tabelas — na Tabela 10.1 do Thrall, o intervalo `0 a 300` apareceu sob
*Neutrófilos segmentados* quando pertence a *Bastonetes*. Nenhum valor abaixo foi
lido daquela saída desalinhada.

### Conferência visual — feita em 2026-08-31

Com o `pdftoppm` (poppler 26.02.0) instalado, as três tabelas foram renderizadas
em PNG e conferidas contra a transcrição, célula a célula:

| Página renderizada | Tabela | Resultado |
|---|---|---|
| Thrall, p. 266 | Tabela 10.1 — série branca | **Confere integralmente** |
| Knoll, p. 1211 | Apêndice 1 — hematologia | **Confere integralmente** |
| IRIS 2026, p. 2 | Estadiamento CKD | **Confere integralmente** |

Nenhuma divergência entre o texto extraído e a página renderizada. A grafia
"CHM" (em vez de HCM) foi confirmada na imagem da edição brasileira.

**O que isso cobre e o que não cobre:** a conferência garante que a transcrição
reproduz fielmente a página. Ela **não** substitui a decisão clínica sobre qual
fonte adotar, nem sobre a adequação dos intervalos à população atendida — por
isso a biblioteca segue em `draft-awaiting-clinical-approval`.

---

## Fonte A — Knoll (Tufts University)

> Knoll JS. *Apêndice 1: Tabelas de Valores Laboratoriais Normais*. In: **Exames
> Laboratoriais e Procedimentos Diagnósticos: Canino e Felino** (ed. bras. de
> *Laboratory Tests and Diagnostic Procedures: Canine and Feline*), p. 1211–1212
> do PDF.

Intervalos em uso na **Cummings School of Veterinary Medicine, Tufts University**.
Hematologia obtida em **CellDyn 3700** (Abbott), diferencial de leucócitos manual;
bioquímica em **Hitachi 911** (Roche), reagentes Roche.

> Advertência da própria fonte: os resultados variam conforme metodologia,
> aparelho e reagente; recomenda-se usar os intervalos do laboratório que analisa
> a amostra. **É por isso que o intervalo impresso no laudo tem prioridade sobre
> o catálogo — este é fallback.**

### A.1 Hematologia

| Exame | Unidade | Cães | Gatos |
|---|---|---|---|
| Contagem de hemácias | ×10⁶/ml | 5,8 – 8,5 | 6,8 – 10,0 |
| Hemoglobina | g/dl | 14,0 – 19,1 | 10,5 – 14,9 |
| Volume globular (VG) | % | 39 – 55 | 31 – 46 |
| Hematócrito (Ht) | % | 40,0 – 56,0 | 31,0 – 49,0 |
| VCM | fl | 60,0 – 75,0 | 39,0 – 56,0 |
| HCM (grafado "CHM" na edição) | pg | 19,1 – 26,2 | 13,8 – 17,1 |
| CHCM | g/dl | 33,0 – 36,0 | 30,5 – 36,2 |
| RDW | % | 14,5 – 19,9 | 17,9 – 24,8 |
| Contagem de leucócitos | ×10³/µl | 4,9 – 16,9 | 4,5 – 15,7 |
| Neutrófilos | ×10³/µl | 2,8 – 11,5 | 2,1 – 10,1 |
| Bastonetes | ×10³/µl | 0,0 – 0,3 | 0,0 – 0,3 |
| Linfócitos | ×10³/µl | 1,0 – 4,8 | 1,1 – 6,0 |
| Monócitos | ×10³/µl | 0,1 – 1,5 | 0,0 – 1,6 |
| Eosinófilos | ×10³/µl | 0,1 – 1,25 | 0,0 – 1,9 |
| Basófilos | ×10³/µl | 0,0 – 0,3 | 0,0 – 0,3 |
| Plaquetas | ×10³/µl | 181 – 525 | 183 – 643 |

Nota da fonte: a contagem diferencial em contador automático varia, com mais
monócitos e menos basófilos que a contagem manual.

### A.2 Bioquímica clínica

| Exame | Cães | Gatos | Unidade | Conversão SI |
|---|---|---|---|---|
| Alanina aminotransferase (ALT) | 18 – 86 | 29 – 145 | UI/l | — |
| Aspartato aminotransferase (AST) | 16 – 54 | 12 – 42 | UI/l | — |
| Albumina | 2,8 – 4,0 | 2,4 – 4,0 | g/dl | ×10 = g/l |
| Amilase | 409 – 1.203 | 496 – 1.874 | UI/l | — |
| Amônia | 1 – 55 | 30 – 65 | µg/dl | ×0,587 = mmol/l |
| Bilirrubina total | 0,1 – 0,3 | 0,1 – 0,3 | mg/dl | ×17,1 = mmol/l |
| Cálcio total | 9,4 – 11,6 | 8,9 – 11,5 | mg/dl | ×0,25 = mmol/l |
| Cloreto | 106 – 116 | 110 – 125 | mEq/l | ×1 = mmol/l |
| CO₂ total (bicarbonato) | 15 – 28 | 13 – 22 | mEq/l | ×1 = mmol/l |
| Colesterol | 82 – 355 | 77 – 258 | mg/dl | ×0,026 = mmol/l |
| Creatinina | 0,6 – 2,0 | 0,9 – 2,1 | mg/dl | ×88,4 = µmol/l |
| Creatinoquinase | 48 – 400 | 14 – 528 | UI/l | — |
| Fosfatase alcalina | 12 – 121 | 10 – 72 | UI/l | — |
| Fósforo | 2,6 – 7,2 | 3,0 – 6,3 | mg/dl | ×0,323 = mmol/l |
| Gamaglutamiltransferase (GGT) | 2 – 10 | 0 – 5 | UI/l | — |
| Glicose | 67 – 135 | 70 – 120 | mg/dl | ×0,0555 = mmol/l |
| Globulina (calculada) | 2,3 – 4,2 | 2,5 – 5,8 | g/dl | ×10 = g/l |
| Lipase | 53 – 770 | 17 – 179 | UI/l | — |
| Magnésio total | 1,8 – 2,6 | 2,0 – 2,7 | mg/dl | ×0,411 = mmol/l |
| Potássio | 3,9 – 5,6 | 3,6 – 5,4 | mEq/l | ×1 = mmol/l |
| Proteína total | 5,5 – 7,8 | 6,0 – 8,4 | g/dl | ×10 = g/l |
| Razão sódio:potássio | 29 – 40 | 28 – 43 | — | — |
| Sódio | 143 – 154 | 149 – 162 | mEq/l | ×1 = mmol/l |
| Triglicerídios | 30 – 321 | 25 – 191 | mg/dl | ×0,0113 = mmol/l |
| Ureia (BUN) | 8 – 30 | 15 – 32 | mg/dl | ×0,357 = mmol/l |

Hemogasometria venosa (cão e gato, mesmos valores): pH 7,36 – 7,44 · PCO₂ 36 – 40 mmHg
· HCO₃⁻ 20 – 24 mEq/l · excesso de base ±4 · PO₂ (nível do mar) 90 – 100 mmHg.

---

## Fonte B — Thrall (série branca absoluta)

> Thrall MA et al. **Hematologia e Bioquímica Clínica Veterinária**, 2ª ed.,
> Tabela 10.1 — *Intervalos de referência da concentração leucocitária absoluta
> das espécies comuns de animais domésticos*, p. 266 do PDF.

A própria obra registra que estes valores seguem diretrizes derivadas do trabalho
original de **Schalm**, usadas há décadas e semelhantes às de muitos laboratórios
veterinários.

| Leucócitos | Caninos | Felinos |
|---|---|---|
| Leucócitos totais (células/µl) | 6.000 – 17.000 | 5.500 – 19.500 |
| Bastonetes (células/µl) | 0 – 300 | 0 – 300 |
| Neutrófilos segmentados (células/µl) | 3.000 – 11.500 | 2.500 – 12.500 |
| Linfócitos (células/µl) | 1.000 – 5.000 | 1.500 – 7.000 |
| Monócitos (células/µl) | 0 – 1.200 | 0 – 800 |
| Eosinófilos (células/µl) | 100 – 1.200 | 0 – 1.500 |
| Basófilos (células/µl) | Raros, 0 – 100 | Raros, 0 – 100 |

---

---

## Fonte C — IRIS Staging of CKD (Modified 2026)

> **IRIS Staging of CKD (Modified 2026)**. International Renal Interest Society
> (IRIS) Ltd. — `iris-kidney.com`, `IRIS_staging_guidelines 2026.pdf`.

Transcrito da diretriz oficial. **Substitui a versão 2023**, que era a base do
JSON entregue em 2026-08-30.

Estadiamento após diagnóstico de DRC, com creatinina e/ou SDMA em jejum, em ao
menos duas ocasiões, em paciente hidratado e estável.

### C.1 Estadiamento

| Marcador | Espécie | Estágio 1 | Estágio 2 | Estágio 3 | Estágio 4 |
|---|---|---|---|---|---|
| Creatinina (mg/dL) | cão | < 1,4 | 1,4 – 2,8 | 2,9 – 5,0 | > 5,0 |
| Creatinina (mg/dL) | gato | < 1,6 | 1,6 – 2,8 | 2,9 – 5,0 | > 5,0 |
| Creatinina (µmol/L) | cão | < 125 | 125 – 250 | 251 – 440 | > 440 |
| Creatinina (µmol/L) | gato | < 140 | 140 – 250 | 251 – 440 | > 440 |
| SDMA (µg/dL) | cão | < 18 | 18 – 35 | 36 – 54 | > 54 |
| SDMA (µg/dL) | **gato** | < 18 | **18 – 25** | **26 – 38** | **> 38** |

**O que mudou de 2023 para 2026:** o SDMA felino ganhou faixas próprias em vez de
repetir as do cão, e o estágio 2 canino foi ampliado com estreitamento do 3.
O JSON de 2023 trazia SDMA felino igual ao canino — **estava desatualizado**.

**Discrepância entre marcadores:** estadiar pelo marcador persistentemente mais
avançado. SDMA persistentemente > 14 µg/dL pode diagnosticar DRC precoce.

**Advertência da própria diretriz:** as recomendações de SDMA baseiam-se na
metodologia proprietária IDEXX; não se sabe se outros ensaios são equivalentes.
Os valores de creatinina aplicam-se a cães de porte médio.

### C.2 Subestadiamento por proteinúria (UP/C)

| Categoria | Cães | Gatos |
|---|---|---|
| Não proteinúrico (NP) | < 0,2 | < 0,2 |
| Borderline proteinúrico (BP) | 0,2 – 0,5 | 0,2 – 0,4 |
| Proteinúrico (P) | > 0,5 | > 0,4 |

### C.3 Subestadiamento por pressão arterial

Mesmos cortes para cão e gato. Raças de pressão naturalmente alta (*sight hounds*)
devem usar referência da própria raça.

| PA sistólica (mmHg) | Subestágio | Risco de lesão de órgão-alvo |
|---|---|---|
| < 140 | Normotenso | Mínimo |
| 140 – 159 | Pré-hipertenso | Baixo |
| 160 – 179 | Hipertenso | Moderado |
| ≥ 180 | Gravemente hipertenso | Alto |

### C.4 Bordas — a diretriz não se sobrepõe

As faixas oficiais são `<X`, `[a,b]` e `>Y`: **não há valor em dois estágios**.
As sobreposições que apareciam no JSON de 2023 eram artefato de representá-las
como `min`/`max` com limites repetidos.

O vão aparente entre 2,8 e 2,9 mg/dL vem do arredondamento a partir de µmol/L
(250 → 2,8; 251 → 2,9). O código já resolve isso classificando `<= 2,8` como
estágio 2 — decisão de implementação, não alteração de corte clínico.

### C.5 Conferência com o código já publicado

`web/src/lib/tfg-calculator.ts` foi conferido linha a linha contra esta diretriz
e **já está correto para IRIS 2026**, incluindo o SDMA felino diferenciado, os
cortes de UP/C por espécie, as faixas de PA e a regra do marcador mais avançado.
Nenhuma correção foi necessária no estadiamento.

---

## Conflitos entre fontes — precisam de arbitragem

As duas fontes discordam na série branca. **Nenhuma foi escolhida automaticamente.**
Valores convertidos para /µl para comparação direta:

| Parâmetro | Espécie | Knoll (Tufts) | Thrall (Schalm) | Em uso hoje |
|---|---|---|---|---|
| Leucócitos totais | cão | 4.900 – 16.900 | 6.000 – 17.000 | 6.000 – 17.000 |
| Leucócitos totais | gato | 4.500 – 15.700 | 5.500 – 19.500 | 5.500 – 19.500 |
| Neutrófilos segm. | cão | 2.800 – 11.500 | 3.000 – 11.500 | 3.000 – 11.500 |
| Neutrófilos segm. | gato | 2.100 – 10.100 | 2.500 – 12.500 | 2.500 – 12.500 |
| Bastonetes | ambos | 0 – 300 | 0 – 300 | 0 – 300 |
| Linfócitos | cão | 1.000 – 4.800 | 1.000 – 5.000 | 1.000 – 4.800 |
| Linfócitos | gato | 1.100 – 6.000 | 1.500 – 7.000 | 1.500 – 7.000 |
| Monócitos | cão | 100 – 1.500 | 0 – 1.200 | 150 – 1.350 |
| Monócitos | gato | 0 – 1.600 | 0 – 800 | 0 – 850 |
| Eosinófilos | cão | 100 – 1.250 | 100 – 1.200 | 100 – 1.250 |
| Eosinófilos | gato | 0 – 1.900 | 0 – 1.500 | 0 – 1.500 |
| Basófilos | ambos | 0 – 300 | 0 – 100 | 0 – 100 |

**Observação:** o catálogo em uso hoje não segue nenhuma das duas de forma
consistente — ele mistura as duas (leucócitos e neutrófilos de Thrall, linfócitos
de cão e eosinófilos de cão de Knoll, monócitos de nenhuma das duas). Isso reforça
por que ele está marcado `@deprecated` e sem proveniência.

**Recomendação:** adotar **uma fonte por painel** em vez de misturar. Knoll tem a
vantagem de cobrir hematologia e bioquímica no mesmo instrumento e população.

## Pendente

| Parâmetro | Situação |
|---|---|
| `plaquetas_vpm` (VPM) | **Não encontrado** em nenhuma das duas tabelas. Continua sem fonte. |
| SDMA | Resolvido pela Fonte C: normal até 14 µg/dL (IRIS 2026 — acima disso, persistente, diagnostica DRC precoce). |
| Cálcio ionizado | **Sem fonte.** Não consta da diretriz IRIS de estadiamento nem das tabelas de Knoll/Thrall. O valor do JSON de 2023 não tem origem rastreável e foi movido para `unsourced`. |
| UPC | Não é faixa de normalidade: é limiar de subestadiamento (Fonte C, seção C.2). |
| Densidade urinária, pH urinário, proteína de fita | Ausentes nas três fontes. Continuam pendentes. |
| Reticulócitos | Citados no texto do Thrall, sem tabela de intervalo canino/felino localizada. |

---

## Ferramentas usadas (para repetir o processo)

Duas suítes de PDF convivem nesta máquina, e a distinção importa:

| Ferramenta | Origem | Onde | Para quê |
|---|---|---|---|
| `pdftotext -table` | **Xpdf 4.06** | `/mingw64/bin` | Reconstrói tabelas por coluna. O poppler **não tem** esse modo. |
| `pdftoppm`, `pdfinfo`, `pdfimages` | **poppler 26.02.0** | `~/tools/poppler/Library/bin` | Renderiza páginas em PNG para conferência visual. |

O poppler foi instalado em nível de usuário (sem admin) a partir do release
oficial `oschwartz10612/poppler-windows`, e o diretório foi anexado ao **fim** do
`Path` do usuário — deliberadamente ao fim, porque o poppler traz seu próprio
`pdftotext` sem o modo `-table`, e sobrepô-lo quebraria a extração de tabelas.

Fluxo usado para conferir uma tabela:

```bash
# 1. extrair o texto preservando colunas (Xpdf)
pdftotext -table -f <pagina> -l <pagina> -enc UTF-8 arquivo.pdf -

# 2. renderizar a mesma página para conferência visual (poppler)
pdftoppm -png -r 150 -f <pagina> -l <pagina> arquivo.pdf saida
```
