# Plano de Revalidacao dos Motores Clinicos

Status: **bloqueado para uso clinico ate homologacao**  
Data-base: 2026-07-16  
Escopo: fluidoterapia, potassio, bicarbonato, calcio, fosforo, magnesio, dieta renal e controle de peso.

## 1. Objetivo e regra de seguranca

Este documento define o processo necessario para revalidar os motores clinicos antes de qualquer reativacao. Ele nao prescreve doses, nao substitui avaliacao veterinaria e nao aprova formulas, faixas, produtos ou protocolos.

Enquanto qualquer criterio deste plano estiver pendente:

- o motor correspondente deve permanecer **fail-closed**;
- nenhum resultado numerico prescritivo deve ser apresentado;
- falha de fonte, validacao, unidade ou calculo nao pode produzir valor de contingencia;
- aviso ou disclaimer nao torna um calculo inseguro aceitavel;
- a reativacao exige aprovacao humana independente de dois revisores veterinarios e aprovacao tecnica separada.

Todas as faixas clinicas, metas, formulas, coeficientes, limites, contraindicacoes e regras de monitoramento citadas nos artefatos de implementacao devem ser classificadas como **decisao veterinaria pendente** ate assinatura formal.

## 2. Estados obrigatorios de cada motor

| Estado | Significado | Comportamento publico |
| --- | --- | --- |
| `blocked` | Nao homologado ou reprovado | Nao calcula; explica indisponibilidade sem expor protocolo incompleto |
| `clinical_review` | Evidencias e regras em revisao | Continua bloqueado |
| `technical_validation` | Regras clinicas aprovadas, testes tecnicos em execucao | Continua bloqueado |
| `pilot` | Homologado para piloto controlado | Disponivel apenas ao publico, papel e ambiente aprovados pelos revisores |
| `released` | Homologacao clinica e tecnica vigente | Resultado inclui versao do motor e fonte aplicavel |
| `suspended` | Fonte, produto, incidente ou teste invalidou a homologacao | Retorna imediatamente ao comportamento fail-closed |

Nao deve existir transicao automatica de `blocked` para `released`.

## 3. Matriz mestre de revalidacao

| Motor | Inputs clinicos minimos a homologar | Unidades canonicas internas | Invariantes de seguranca | Bloqueio imediato |
| --- | --- | --- | --- | --- |
| Fluidos | Especie; peso; estado de perfusao; hidratacao; perdas mensuradas; objetivo e fase; funcao renal; diurese; comorbidades; fluido; janela de reavaliacao | Massa em kg; volume em mL; taxa em mL/kg/h e mL/h como campos distintos; tempo em h | Ressuscitacao, reidratacao, manutencao e perdas sao fases separadas; volume de uma fase nao pode ser extrapolado para outra; reavaliacao e obrigatoria; soma de componentes deve ser rastreavel | Input ausente; peso/tempo invalido; objetivo ambiguo; hipovolemia sem fluxo por etapas; risco de sobrecarga sem plano de monitoramento; fonte ou regra nao aprovada |
| Potassio | Especie; peso; potassio medido; unidade do laboratorio; tendencia; funcao renal; diurese; fluido e volume; dispositivo de infusao; monitoramento | Concentracao em unidade unica aprovada; taxa por kg e taxa absoluta em campos distintos; volume em mL; tempo em h | Nunca converter silenciosamente entre por-volume e por-litro; nunca confundir taxa por kg com absoluta; resultado nao pode recomendar suplementacao diante de estado bloqueado pela regra clinica aprovada; mistura e administracao devem ser rastreaveis | Valor ausente/incompativel; unidade desconhecida; funcao renal/diurese nao avaliadas; faixa nao homologada; taxa ou concentracao fora da matriz assinada; bomba/monitoramento exigidos e indisponiveis |
| Bicarbonato | Especie; peso; gasometria e contexto aprovados; bicarbonato medido; alvo homologado; perfusao; ventilacao; sodio; causa provavel; horario da amostra | Concentracao e quantidade em unidade unica aprovada; peso em kg; tempo em h; pH sem unidade | Se alvo nao representar deficit positivo, nao existe dose negativa; formula e alvo devem ser versionados juntos; indicacao depende do contexto, nao apenas de um numero | Gasometria/contexto ausentes; amostra sem data; alvo menor ou igual ao medido; unidade desconhecida; formula ou indicacao sem duas assinaturas |
| Calcio | Especie; peso; indicacao; calcio relevante medido; unidade e tipo de amostra; produto/concentracao; via; acesso; ECG/monitoramento; funcao renal | Calcio elementar como base canonica; produto e concentracao em campos separados; volume e taxa nunca reutilizam o mesmo campo | Produtos nao compartilham limites por conveniencia; conversao produto-elementar e explicita; limite e compatibilidade sao especificos do produto; entrada invalida nao produz resultado | Produto/concentracao ambiguos; monitoramento exigido indisponivel; valor/indicacao ausentes; limite especifico nao homologado; incompatibilidade conhecida |
| Fosforo | Especie; peso; fosforo medido; unidade; indicacao; funcao renal; calcio; magnesio; produto/concentracao; fluido; acesso; monitoramento | Taxa por kg e taxa absoluta separadas; quantidade em mmol ou unidade clinicamente aprovada; volume em mL; tempo em h | Campo por kg nunca recebe valor absoluto; compatibilidade de mistura e obrigatoria; conversoes devem preservar dimensao; protocolo empirico/extralabel deve estar explicitamente aprovado | Fosforo nao medido; unidade desconhecida; incompatibilidade; funcao renal nao avaliada; formula/faixa sem aprovacao; ausencia do plano de monitoramento requerido |
| Magnesio | Especie; peso; magnesio medido; unidade e tipo; indicacao/sintomas; funcao renal; diurese; produto/concentracao; acesso; monitoramento | Quantidade, concentracao, taxa por kg e taxa absoluta em campos distintos | Nao inferir necessidade somente por especie; funcao renal e valor medido participam da decisao; nao usar ponto medio fixo como protocolo | Medida/indicacao ausentes; insuficiencia renal ou oliguria sem regra assinada; unidade/produto ambiguos; monitoramento indisponivel |
| Dieta renal | Especie; identificador exato do produto/SKU; pais; apresentacao; peso; ECC; MCS; ingestao atual; apetite; fase de vida; condicoes clinicas e estadio aprovados; objetivo nutricional | Energia na unidade oficial aprovada; massa corporal em kg; alimento em g/dia; escore com escala identificada | Quantidade deve reproduzir a tabela oficial da versao/SKU; nao extrapolar fora da tabela; ECC e MCS sao independentes; peso baixo nao pode ser rotulado como ideal; contraindicacao bloqueia resultado | SKU/regiao/versao sem fonte; peso fora da tabela; fase de vida/contraindicacao nao avaliadas; fonte expirada ou alterada; produto descontinuado; dois revisores nao aprovaram a transcricao |
| Controle de peso | Identificador estavel do paciente; especie; data/hora da observacao; peso; unidade; ECC; MCS quando aplicavel; meta definida pelo veterinario; contexto/observacao opcional | Peso canonico em kg; data ISO 8601 com fuso/politica definida; percentuais derivados sem arredondamento intermediario | Nunca misturar pacientes; ganho/perda nao recebe semantica positiva/negativa sem meta; ordem e intervalo temporal devem ser reais; dado corrompido nao pode ser silenciosamente apagado | Paciente ausente/ambiguo; especie divergente; data futura proibida pela politica; unidade desconhecida; armazenamento corrompido; meta clinica necessaria e ausente |

Os inputs listados sao requisitos candidatos para revisao. A obrigatoriedade final de cada campo, inclusive situacoes em que um campo pode ser dispensado, e **decisao veterinaria pendente**.

## 4. Contrato comum dos motores

Cada motor deve ser uma funcao pura e versionada, separada da interface. O contrato deve retornar um destes resultados:

```ts
type ClinicalEngineResult<T> =
  | {
      status: "ok";
      value: T;
      engineVersion: string;
      sourceSetVersion: string;
      reviewedRuleIds: string[];
    }
  | {
      status: "blocked";
      reasonCode: string;
      userMessage: string;
      missingOrInvalidFields: string[];
    };
```

Regras do contrato:

- `blocked` nao inclui resultado parcial, dose, sugestao numerica ou valor anterior em cache;
- todo numero carrega unidade no tipo ou no nome do campo;
- conversoes sao centralizadas e testadas, nunca feitas diretamente no componente visual;
- a interface nao recalcula nem corrige resultados do motor;
- `NaN`, infinito, numero negativo impossivel, overflow e divisao por zero resultam em `blocked`;
- arredondamento ocorre somente na apresentacao e segue regra assinada pelos revisores;
- logs registram versao, regra e motivo de bloqueio, sem dados identificaveis do paciente;
- nenhuma telemetria clinica deve ser adicionada sem revisao de privacidade e base legal.

## 5. Golden cases e casos de fronteira

Os valores concretos de entrada e saida dos casos clinicos devem ser fornecidos e assinados pelos revisores. A engenharia nao deve criar numeros plausiveis para preencher a suite.

### 5.1 Fluidos

| ID | Caso | Assercao obrigatoria |
| --- | --- | --- |
| FL-01 | Paciente estavel com apenas manutencao | Saida coincide exatamente com a formula e o arredondamento homologados |
| FL-02 | Desidratacao sem hipovolemia | Deficit aparece somente na fase e janela aprovadas; volume total e soma explicavel das fases |
| FL-03 | Hipovolemia e desidratacao concomitantes | Ressuscitacao ocorre como etapa com reavaliacao; deficit nao e somado cegamente ao bolus |
| FL-04 | Janela de correcao menor que o horizonte exibido | Taxa de correcao nao e multiplicada alem da duracao da fase |
| FL-05 | Perdas continuas | Perdas sao componente separado e nao duplicam manutencao ou deficit |
| FL-06 | Risco renal/cardiaco de sobrecarga | Motor bloqueia ou segue somente a regra especial assinada, com monitoramento exigido |
| FL-07 | Peso, tempo ou perda zero/negativo/extremo | Resultado `blocked`, sem numero parcial |
| FL-08 | Troca de especie mantendo os demais dados | Formula e regras correspondem exclusivamente a especie selecionada |

### 5.2 Potassio

| ID | Caso | Assercao obrigatoria |
| --- | --- | --- |
| K-01 | Valor medido em estado no qual suplementacao e vedada | Bloqueio explicito; nenhum K e adicionado |
| K-02 | Limite inferior e superior de cada faixa aprovada | Inclusividade das bordas coincide com a tabela assinada, sem lacunas ou sobreposicao |
| K-03 | Conversao de concentracao | Igualdade dimensional entre unidade canonica e unidade de exibicao |
| K-04 | Taxa por kg versus absoluta | Relacao usa peso uma unica vez e preserva rotulos distintos |
| K-05 | Taxa dentro da concentracao, mas fora do limite de administracao, e vice-versa | Qualquer violacao isolada bloqueia a saida |
| K-06 | Funcao renal, diurese, bomba ou monitoramento ausentes | Bloqueio conforme matriz clinica assinada |

### 5.3 Bicarbonato

| ID | Caso | Assercao obrigatoria |
| --- | --- | --- |
| HC-01 | Medido abaixo do alvo aprovado e contexto valido | Resultado coincide com o caso assinado e identifica formula/versao |
| HC-02 | Medido igual ao alvo | Nao existe deficit positivo; nenhuma dose e exibida |
| HC-03 | Medido acima do alvo | Nao produz valor negativo; retorna bloqueio ou ausencia de indicacao conforme regra assinada |
| HC-04 | Gasometria antiga, incompleta ou unidade ambigua | Resultado `blocked` |
| HC-05 | Alteracao isolada do coeficiente ou alvo | Teste falha, pois formula e alvo sao um conjunto versionado |

### 5.4 Calcio

| ID | Caso | Assercao obrigatoria |
| --- | --- | --- |
| CA-01 | Produto A homologado | Conversao para calcio elementar coincide com o caso assinado |
| CA-02 | Produto B com mesma entrada volumetrica | Nao reutiliza regra ou limite do produto A |
| CA-03 | Produto/concentracao nao cadastrado | Resultado `blocked` |
| CA-04 | Valor exatamente nas bordas aprovadas | Inclusividade coincide com a decisao assinada |
| CA-05 | Monitoramento ou acesso requerido ausente | Resultado `blocked` |

### 5.5 Fosforo

| ID | Caso | Assercao obrigatoria |
| --- | --- | --- |
| P-01 | Taxa clinica assinada | Campo por kg preserva a taxa e campo absoluto aplica o peso uma unica vez |
| P-02 | Alteracao do peso mantendo taxa por kg | Somente o campo absoluto varia de forma proporcional |
| P-03 | Mistura incompativel | Resultado `blocked`, sem sugestao de preparo |
| P-04 | Fosforo, calcio, magnesio ou funcao renal ausentes quando requeridos | Resultado `blocked` |
| P-05 | Unidade laboratorial diferente | Conversao homologada ou bloqueio; nunca interpretacao implicita |

### 5.6 Magnesio

| ID | Caso | Assercao obrigatoria |
| --- | --- | --- |
| MG-01 | Especie informada sem magnesio medido | Resultado `blocked`; nao selecionar ponto medio fixo |
| MG-02 | Valor medido e indicacao homologada | Resultado coincide com o caso assinado e identifica a fonte |
| MG-03 | Comprometimento renal/diurese inadequada | Aplica o bloqueio ou regra especial explicitamente assinada |
| MG-04 | Limites e conversoes | Bordas e dimensoes coincidem com os artefatos aprovados |

### 5.7 Dieta renal

| ID | Caso | Assercao obrigatoria |
| --- | --- | --- |
| DR-01 | Peso existente na tabela oficial do SKU | Gramas/dia reproduzem a linha oficial aprovada |
| DR-02 | Peso entre linhas, quando a fonte nao autoriza interpolacao | Resultado `blocked`; nao inventa quantidade |
| DR-03 | Peso abaixo/acima da tabela | Resultado `blocked`; nao extrapola |
| DR-04 | Mesmo nome comercial, regiao ou apresentacao diferente | Seleciona SKU distinto ou bloqueia por ambiguidade |
| DR-05 | ECC baixo e/ou MCS reduzido | Nao classifica automaticamente como ideal nem reduz alimento sem decisao clinica |
| DR-06 | Contraindicacao ou fase de vida incompativel | Resultado `blocked` |
| DR-07 | Fonte alterada, removida ou produto descontinuado | Suspensao automatica do SKU ate nova revisao |
| DR-08 | Tabela oficial transcrita | Teste parametrizado cobre todas as linhas, nao apenas exemplos |

### 5.8 Controle de peso

| ID | Caso | Assercao obrigatoria |
| --- | --- | --- |
| PW-01 | Dois pacientes com registros intercalados | Historico, grafico e tendencia permanecem isolados por paciente |
| PW-02 | Cao e gato no mesmo navegador | Nenhuma comparacao cruza especie ou paciente |
| PW-03 | Perda ou ganho sem meta clinica | Cor e texto permanecem neutros |
| PW-04 | Meta clinica assinada para o paciente | Interpretacao usa somente a meta vigente e mostra sua data/autor |
| PW-05 | Intervalos temporais desiguais | Eixo e calculo de tendencia preservam os intervalos reais |
| PW-06 | JSON/armazenamento corrompido | Dados sao colocados em quarentena; novo salvamento nao sobrescreve silenciosamente o historico |
| PW-07 | Limite de armazenamento | Usuario recebe aviso, exportacao e opcao segura; nenhum registro e descartado silenciosamente |
| PW-08 | Exclusao individual ou total | Exige confirmacao e oferece recuperacao conforme politica aprovada |

## 6. Registro e versionamento de fontes

Cada regra clinica e cada produto devem apontar para uma entrada imutavel no registro de fontes:

| Campo | Obrigatorio |
| --- | --- |
| `sourceId` e `sourceSetVersion` | Sim |
| Instituicao/autoria responsavel | Sim |
| Titulo oficial | Sim |
| URL primaria direta | Sim |
| Data/versao da publicacao | Sim, quando publicada |
| Data de acesso em ISO 8601 | Sim |
| Pais, especie, produto, SKU e apresentacao | Quando aplicavel |
| Regra ou dado extraido, com pagina/secao/tabela | Sim |
| Unidade exatamente como publicada | Sim |
| Metodo de conversao, se houver | Sim |
| Identificador do artefato verificado ou checksum permitido | Sim |
| Revisor 1, revisor 2 e respectivas datas | Sim |
| Estado: vigente, substituida, retirada ou pendente | Sim |
| Proxima revisao | Definida pelo Clinical Product Owner; decisao veterinaria pendente |

Regras de versionamento:

- mudanca de formula, tabela, coeficiente, limite, indicacao, fonte ou arredondamento cria nova versao do motor;
- atualizacao de produto/SKU cria nova versao da fonte, sem sobrescrever o historico;
- dados de pais ou apresentacao diferentes nao podem compartilhar registro por similaridade de nome;
- link indisponivel, pagina alterada ou fonte substituida suspende as regras dependentes ate revisao;
- o artefato de homologacao registra o diff clinico e o diff tecnico;
- a versao exibida ao usuario deve permitir reconstruir quais regras e fontes produziram o resultado;
- o intervalo de revalidacao e definido pelos revisores, sem prazo presumido pela engenharia.

## 7. Fontes primarias e de autoridade candidatas

Estas fontes sao pontos de partida, nao homologacao automatica:

### Fluidos e eletrolitos

- AAHA, *2024 AAHA Fluid Therapy Guidelines for Dogs and Cats*: <https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/>
- AAHA, *Fluids for Replacement and Maintenance*: <https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/section-3-fluids-for-replacement-and-maintenance/>
- AAHA, *Fluid Therapy in Ill Patients*: <https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/section-5-fluid-therapy-in-ill-patients/>
- AAHA, *Fluid Administration and Monitoring*: <https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/section-8-fluid-administration-and-monitoring/>
- Merck Veterinary Manual, calcio: <https://www.merckvetmanual.com/metabolic-disorders/disorders-of-calcium-metabolism/eclampsia-in-small-animals>
- Merck Veterinary Manual, fosforo: <https://www.merckvetmanual.com/metabolic-disorders/disorders-of-phosphorus-metabolism/hypophosphatemia-in-animals>
- Merck Veterinary Manual, magnesio: <https://www.merckvetmanual.com/metabolic-disorders/disorders-of-magnesium-metabolism/hypermagnesemia-in-animals>
- Merck Veterinary Manual, monitoramento e bicarbonato: <https://www.merckvetmanual.com/emergency-medicine-and-critical-care/monitoring-the-critically-ill-small-animal/monitoring-the-critically-ill-small-animal-using-the-rule-of-20>

### Doenca renal, nutricao e peso

- IRIS, diretrizes vigentes: <https://www.iris-kidney.com/iris-guidelines-1>
- IRIS, recomendacoes para caes, 2026: <https://www.iris-kidney.com/s/IRIS-DOG-Treatment_Recommendations_may-2026.pdf>
- IRIS, recomendacoes para gatos, 2026: <https://www.iris-kidney.com/s/IRIS_CAT_Treatment_Recommendations_-2026.pdf>
- IRIS, dietas para gatos com DRC: <https://www.iris-kidney.com/diets-for-cats-with-chronic-kidney-disease-ckd>
- WSAVA, Global Nutrition Guidelines: <https://wsava.org/global-guidelines/global-nutrition-guidelines/>
- AAHA, *2021 Nutrition and Weight Management Guidelines*: <https://www.aaha.org/resources/2021-aaha-nutrition-and-weight-management-guidelines/screening-evaluation/>

### Produtos

Para cada SKU, usar exclusivamente pagina, rotulo ou ficha tecnica oficial do fabricante aplicavel ao Brasil e a apresentacao comercial selecionada. Exemplos de portais oficiais que ainda precisam de transcricao e dupla revisao:

- Hill's Brasil: <https://www.hillspet.com.br/>
- Royal Canin Brasil: <https://www.royalcanin.com/br>
- Premier Pet: <https://premierpet.com.br/>
- Farmina Brasil: <https://www.farmina.com/pt/>

Fonte secundaria pode apoiar contexto, mas nao substituir fonte primaria ou de autoridade quando esta existir. Conflitos entre fontes permanecem bloqueados ate decisao documentada dos dois revisores.

## 8. Revisao humana independente

### Revisor 1 - responsavel clinico do dominio

- medico-veterinario com experiencia documentada no dominio do motor;
- fluidos e eletrolitos: preferencialmente nefrologia e/ou terapia intensiva;
- dieta e peso: preferencialmente nutricao clinica e/ou nefrologia;
- seleciona fontes, define indicacoes, inputs, limites, monitoramento, arredondamento e condicoes de bloqueio;
- fornece golden cases com entradas, saidas e racional clinico;
- assina a versao exata do pacote de regras e testes.

### Revisor 2 - validador clinico independente

- medico-veterinario qualificado no mesmo dominio;
- nao pode ser autor do codigo nem apenas repetir a revisao do Revisor 1;
- recalcula de forma independente os golden cases;
- revisa unidades, fronteiras, contraindicacoes, linguagem publica e fluxo fail-closed;
- registra aprovacao, ressalva ou rejeicao com justificativa e fonte.

### Engenharia e QA

- implementam somente regras assinadas;
- demonstram equivalencia entre especificacao, motor, interface e testes;
- nao resolvem conflito clinico escolhendo a formula que "parece correta";
- mantem rastreabilidade de commits, versoes, testes e artefatos;
- bloqueiam release diante de divergencia, inclusive se ambos os revisores aprovarem uma implementacao tecnicamente inconsistente.

Nao ha aprovacao por maioria. Discordancia entre revisores, ausencia de assinatura ou ressalva aberta mantem o motor bloqueado.

## 9. Criterios de bloqueio e suspensao

Qualquer item abaixo bloqueia ou suspende o motor:

- fonte primaria ausente, inacessivel, substituida ou sem identificacao de versao;
- regra clinica, limite, unidade ou arredondamento sem duas assinaturas;
- produto sem SKU, regiao, apresentacao ou tabela inequivoca;
- input clinico obrigatorio ausente, invalido, desatualizado ou com unidade desconhecida;
- conversao implicita ou dimensionalmente incorreta;
- intervalo com lacuna, sobreposicao ou comportamento de borda nao especificado;
- resultado parcial, negativo impossivel, nao finito ou fora da matriz homologada;
- extrapolacao ou interpolacao nao autorizada;
- teste golden, de fronteira, propriedade, integracao ou regressao falhando;
- divergencia entre resultado do motor e texto/interface;
- impossibilidade de reconstruir fonte e versao do resultado;
- incidente clinico, near miss ou relato plausivel ainda nao investigado;
- interface truncando unidade, alerta, motivo de bloqueio ou versao em desktop, celular ou tablet;
- acessibilidade insuficiente para compreender unidade, erro ou bloqueio;
- falha de isolamento, privacidade, integridade ou recuperacao dos dados do paciente.

Quando suspenso, o motor nao deve reutilizar o ultimo resultado calculado nem continuar disponivel apenas porque a falha ocorreu depois do carregamento da pagina.

## 10. Checklist de homologacao

### Evidencia clinica

- [ ] Existe inventario de todas as afirmacoes, formulas, tabelas, faixas e conversoes.
- [ ] Cada regra possui `ruleId`, fonte primaria, secao/pagina e versao.
- [ ] Inputs obrigatorios e opcionais foram decididos por veterinarios.
- [ ] Indicacoes, contraindicacoes e monitoramento foram decididos por veterinarios.
- [ ] Unidades e arredondamentos foram aprovados explicitamente.
- [ ] Golden cases concretos foram fornecidos pelo Revisor 1.
- [ ] Golden cases foram recalculados independentemente pelo Revisor 2.
- [ ] Ambos assinaram o mesmo hash/versao do pacote.
- [ ] Nao existem conflitos ou ressalvas abertas.

### Implementacao e testes

- [ ] Motor e funcao pura, versionada e separado da interface.
- [ ] Tipos impedem confusao entre taxa por kg, taxa absoluta, concentracao e volume.
- [ ] Todos os caminhos invalidos retornam `blocked` sem valor parcial.
- [ ] Suite cobre golden cases, fronteiras, unidades e propriedades.
- [ ] Dieta cobre todas as linhas de cada tabela oficial homologada.
- [ ] Peso cobre dois ou mais pacientes intercalados e recuperacao de corrupcao.
- [ ] Integracao confirma que a interface nao altera o calculo.
- [ ] Regressao inclui cada falha clinica ja identificada.
- [ ] Lint, typecheck, testes unitarios, integracao, E2E e build passam.
- [ ] O pacote testado e exatamente o pacote revisado e versionado.

### Interface, dispositivos e acessibilidade

- [ ] Desktop, celular e tablet exibem integralmente unidade, fonte, versao, alertas e bloqueios.
- [ ] Nenhuma acao clinica depende apenas de cor.
- [ ] Leitor de tela anuncia erros, unidade e motivo de bloqueio.
- [ ] Teclado e toque permitem revisar inputs antes do calculo.
- [ ] Alterar especie, produto ou unidade invalida imediatamente resultado anterior.
- [ ] Atualizar ou retornar a pagina nao ressuscita resultado suspenso.
- [ ] Textos nao usam "seguro", "recomendado" ou "protocolo" fora do escopo homologado.

### Privacidade, auditoria e operacao

- [ ] Dados identificaveis sao minimizados e protegidos conforme LGPD.
- [ ] Logs nao registram nome, nota clinica livre ou identificador desnecessario.
- [ ] Resultado registra versao de motor e conjunto de fontes.
- [ ] Existe canal de incidente e procedimento de suspensao imediata.
- [ ] Existe responsavel por vigiar alteracoes de fonte e produto.
- [ ] Existe plano de rollback fail-closed testado.
- [ ] Retencao, exportacao, exclusao e recuperacao do historico foram definidas.

### Aprovacao final

- [ ] Revisor 1 aprovou formalmente.
- [ ] Revisor 2 aprovou formalmente e de modo independente.
- [ ] QA clinico anexou evidencias dos golden cases.
- [ ] QA tecnico anexou resultados de testes e matriz de rastreabilidade.
- [ ] Responsavel de seguranca/privacidade aprovou o fluxo de dados.
- [ ] Product Owner confirmou que o escopo publico e igual ao homologado.
- [ ] O motor foi liberado primeiro no ambiente/papel de piloto aprovado.
- [ ] O release possui criterio objetivo de suspensao e responsavel de plantao.

## 11. Artefatos de saida exigidos

Cada motor deve produzir, antes da reativacao:

1. especificacao clinica versionada;
2. registro das fontes e extracoes;
3. matriz de inputs, unidades, regras e bloqueios;
4. golden cases assinados pelos dois revisores;
5. suite automatizada com evidencias;
6. matriz de rastreabilidade `fonte -> regra -> codigo -> teste -> interface`;
7. parecer de privacidade quando houver dado de paciente;
8. termo de homologacao com versao, data, escopo e assinaturas;
9. plano de monitoramento, incidente, suspensao e rollback.

Sem os nove artefatos, o estado permanece `blocked`, independentemente de o calculo parecer correto em testes informais.
