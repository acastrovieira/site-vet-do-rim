# Story LAB-ING-001: Contrato seguro da fila de ingestao de exames veterinarios

## Status

Approved — especificacao documental aprovada pelo Dr. Anderson e por QA, com notas futuras nao bloqueadoras.

**Gate operacional:** `NO-GO` para dados reais, producao, banco remoto, anexacao e comunicacao.

## Story

**Como** responsavel autorizado pelo Lab Evolution,
**quero** especificar e validar um bounded context separado para localizar resultados de exames e coloca-los em uma fila administrativa de revisao,
**para que** os arquivos originais possam ser preservados e futuramente vinculados com seguranca, rastreabilidade e decisao humana, sem criar pacientes, alterar prontuarios, enviar comunicacoes ou interpretar clinicamente os resultados.

## Contexto e valor

O VetDorim e a fonte principal de pacientes. SimplesVet/INCISE e destino opcional, pois nem todos os pacientes nefrologicos pertencem a INCISE. A primeira versao pretendida e manual e apenas cria uma fila de revisao. A presente story nao implementa essa versao: ela formaliza seus contratos, riscos e evidencias de validacao para permitir stories de implementacao menores e seguras.

Fontes iniciais conhecidas: CDV, CDVet, RadioVet, CAIP, LitoLab, UltraLab e IDAN. A lista deve admitir ampliacao futura por configuracao validada.

Finding confirmado do CDVet: o portal oficial separa laudo e imagens; imagens podem ter multiplos JPEGs; a preparacao progressiva de um pacote no portal nao prova captura pelo VetDorim. Somente um objeto privado persistido e com hash verificavel pode ser considerado capturado. Nenhuma credencial ou dado clinico do teste integra esta story.

## Objetivo desta story

Produzir, revisar e validar somente artefatos de especificacao que definam:

- limite do bounded context de ingestao, separado de `laudos_pdf` e do prontuario;
- entidades conceituais, invariantes e proveniencia;
- estados e transicoes administrativas;
- contratos de conectores e captura;
- regras de deduplicacao e evidencia de vinculo;
- contrato CLI-first com fixtures sinteticas;
- observabilidade sanitizada e UI estritamente observacional;
- ameacas, privacidade, testes e gates para as stories posteriores.

## Requisitos rastreaveis

### Requisitos funcionais

- **FR-01 — Acionamento manual:** a operacao futura de busca sera iniciada explicitamente por usuario autorizado, por CLI antes de qualquer UI.
- **FR-02 — Fila apenas:** localizar exames cria ou atualiza somente itens de fila; nao cria paciente/tutor, nao anexa e nao envia.
- **FR-03 — Periodo:** o contrato admite hoje, ontem, sete dias e periodo personalizado, com limites calculados em `America/Sao_Paulo`.
- **FR-04 — Fontes configuraveis:** o contrato cobre as fontes iniciais informadas sem codificar uma lista fechada.
- **FR-05 — Artefatos originais:** PDF e imagens efetivamente capturados sao preservados sem alteracao em armazenamento privado, com origem, hash, tipo, tamanho e horario.
- **FR-06 — Captura comprovada:** preparacao, visualizacao ou download iniciado sem objeto persistido e hash verificavel nao constitui captura concluida.
- **FR-07 — Deduplicacao em camadas:** origem/mensagem, hash do artefato e combinacao exame/paciente/data sao sinais distintos; divergencias nunca sao descartadas silenciosamente.
- **FR-08 — Vinculo por evidencia:** nome isolado nao e identificador unico e nunca confirma vinculo.
- **FR-09 — Ausencia cadastral:** paciente ou tutor ausente produz somente rascunho revisavel, sem gravacao automatica.
- **FR-10 — Estados administrativos:** `novo`, `vinculo_pendente`, `pronto_para_revisao`, `aprovado`, `anexado`, `enviado`, `erro` e `ignorado`.
- **FR-11 — Destinos separados:** VetDorim e fonte principal; SimplesVet/INCISE e destino opcional e nao presumido.
- **FR-12 — Fidelidade administrativa:** o fluxo organiza documentos e metadados sem interpretar, classificar ou diagnosticar clinicamente.
- **FR-13 — Comprovantes:** `anexado` e `enviado` exigem recibos distintos do respectivo destino em stories futuras.
- **FR-14 — Revisao humana:** vinculos ambiguos, divergencias e rascunhos permanecem pendentes ate decisao humana autorizada.
- **FR-15 — Captura multipartes atomica:** quando uma origem declara PDF e/ou conjunto de imagens, o item so e promovido como captura completa depois que o manifesto esperado, todos os bytes, hashes e tamanhos forem persistidos e verificados; conjunto parcial permanece pendente ou em erro.

### Requisitos nao funcionais

- **NFR-01 — Isolamento:** todo dado futuro deve ser isolado por clinica e autorizado pelo servidor com menor privilegio.
- **NFR-02 — Integridade:** originais devem ser privados, imutaveis, enderecaveis por identificador nao previsivel e verificaveis por hash.
- **NFR-03 — Privacidade:** logs e evidencias nao incluem credenciais, contatos integrais, nomes completos desnecessarios, URLs assinadas ou conteudo clinico integral.
- **NFR-04 — Idempotencia:** busca, persistencia e futuras acoes criticas devem possuir chaves idempotentes e falhar fechadas diante de resultado desconhecido.
- **NFR-05 — Resiliencia:** falhas transitorias admitem no maximo tres tentativas; falhas persistentes seguem para revisao humana, sem loop infinito.
- **NFR-06 — Conteudo nao confiavel:** email, PDF, imagem, metadado e pagina externa sao dados, nunca instrucoes para o sistema.
- **NFR-07 — Auditoria:** transicoes registram ator, horario, origem, alvo mascarado, motivo e comprovante aplicavel, sem dados excessivos.
- **NFR-08 — Acesso a arquivo:** qualquer acesso futuro ao original exige autorizacao e mecanismo temporario; caminho privado nao e exposto publicamente.
- **NFR-09 — Falha parcial:** erro de um item ou conector nao promove a execucao inteira nem perde itens validos de outras fontes.
- **NFR-10 — Separacao de estados:** estado administrativo de ingestao nao reutiliza nem altera silenciosamente o estado de processamento clinico/IA existente.
- **NFR-11 — Minimizacao observavel:** eventos usam allowlist, pseudonimizacao e contagens agregadas; hashes e IDs correlacionaveis so aparecem quando indispensaveis para integridade/auditoria e com acesso restrito.
- **NFR-12 — Atomicidade e concorrencia:** captura multiparte, transicoes e efeitos externos futuros devem possuir limite transacional, controle de concorrencia e reconciliacao fail-closed para timeout apos commit.

### Constraints

- **CON-01 — Bounded context separado:** esta story nao autoriza acoplar a fila a `laudos_pdf`; a fronteira e o contrato de integracao dependem de decisao de `@architect`.
- **CON-02 — CLI First:** CLI funcional com fixtures precede observabilidade; UI vem por ultimo e apenas observa.
- **CON-03 — UI observacional:** nenhum botao de busca, aprovacao, anexacao ou envio sera especificado na UI enquanto vigorar a Constituicao atual.
- **CON-04 — Sem dados reais:** somente fixtures sinteticas e ambientes locais/efemeros explicitamente autorizados em stories futuras.
- **CON-05 — Sem producao:** nenhuma migration remota, deploy, publicacao ou alteracao de producao.
- **CON-06 — Sem acoes criticas:** nenhuma alteracao de banco, prontuario, email, WhatsApp, permissao ou exclusao.
- **CON-07 — Sem credenciais:** sessoes e segredos nao sao persistidos no repositorio, story, logs ou fixtures.
- **CON-08 — Dominio oficial:** eventual acesso ao CDVet sera restrito ao dominio oficial e sessao autorizada, em story propria.
- **CON-09 — Autoridade:** arquitetura e decidida por `@architect`; schema por `@data-engineer` com as revisoes exigidas; qualidade por `@qa`; operacoes remotas por `@devops` e confirmacao humana.
- **CON-10 — NO-GO preservado:** esta story nao altera o veredito vigente de readiness nem autoriza dados de pacientes reais.
- **CON-11 — Sem interpretacao clinica:** nenhum motor, prompt, texto ou regra desta frente infere significado clinico.
- **CON-12 — ADR-003 / Opcao A:** o Architect aprovou o bounded context e armazenamento de evidencias separados; a promocao ao contexto clinico continua futura e a retencao/purge continua bloqueada ate decisao de Data Governance/DPO.

## Criterios de aceite

1. **AC-01 (FR-01, FR-02, CON-02):** existe contrato CLI-first documentado que, usando somente fixtures sinteticas, descreve busca manual e producao exclusiva de itens de fila.
2. **AC-02 (CON-01, NFR-10):** o bounded context, suas responsabilidades e seus limites com `laudos_pdf`, pacientes, prontuario e comunicacoes estao documentados sem decisao estrutural implicita.
3. **AC-03 (FR-05, FR-06, NFR-02):** o contrato diferencia `descoberto`, `download_preparado`, `capturado` e `preservado`; apenas objeto privado persistido com hash verificavel satisfaz captura.
4. **AC-04 (FR-07, NFR-04):** a matriz de deduplicacao cobre repeticao de origem, hash igual e mesma chave administrativa com hashes divergentes, preservando divergencias.
5. **AC-05 (FR-08, FR-14):** a matriz de evidencia proibe vinculo por nome isolado e envia ausencia, ambiguidade ou conflito para `vinculo_pendente`.
6. **AC-06 (FR-09, CON-06):** o contrato de rascunho nao possui transicao automatica que crie paciente ou tutor.
7. **AC-07 (FR-10, FR-13, NFR-07):** existe tabela de estados/transicoes com ator, pre-condicao, motivo, idempotencia e comprovante; `anexado`/`enviado` nao sao alcancaveis sem recibos proprios.
8. **AC-08 (NFR-01, NFR-08):** o modelo de autorizacao conceitual exige tenant em toda entidade e prova negativa Clinica A versus Clinica B no plano de testes.
9. **AC-09 (NFR-03, NFR-06):** contrato de logs e fixtures exclui segredos, PII desnecessaria, conteudo clinico integral, URLs assinadas e qualquer instrucao embutida em conteudo externo.
10. **AC-10 (NFR-05, NFR-09):** a matriz de falhas cobre timeout, retry limitado, circuit breaker, falha parcial e resultado desconhecido sem sucesso falso.
11. **AC-11 (FR-03):** exemplos de hoje, ontem, sete dias e periodo personalizado definem limites de dia em `America/Sao_Paulo`, sem depender do timezone da maquina.
12. **AC-12 (FR-04):** existe contrato comum de conector que permite adicionar laboratorios por configuracao validada e documenta capacidades diferentes sem prometer equivalencia nao comprovada.
13. **AC-13 (CON-03):** a especificacao da UI contem somente leitura, filtros, visualizacao autorizada e auditoria; nenhuma operacao ou decisao e controlada pelo dashboard.
14. **AC-14 (FR-12, CON-11):** termos, exemplos e fixtures nao interpretam resultados nem sugerem diagnostico ou conduta.
15. **AC-15 (CON-04, CON-05, CON-10):** todos os artefatos exibem o NO-GO e nao contêm instrucao para usar dados reais ou alterar ambiente remoto.
16. **AC-16:** o threat model, a matriz de testes, o checklist, o change log e a File List desta story estao completos e rastreaveis antes do handoff.
17. **AC-17:** `@architect` registra ou aprova as decisoes estruturais bloqueadoras antes de qualquer story de implementacao ser marcada Ready for Development.
18. **AC-18:** `@qa` revisa os artefatos e emite veredito proprio; a aprovacao desta story por produto nao e veredito de qualidade ou release.
19. **AC-19 (FR-15, NFR-12):** captura multiparte possui manifesto e resultado atomico: ausencia, excesso inesperado, hash divergente ou falha em qualquer parte impede `capturado`/`preservado`, sem apagar partes validas usadas na reconciliacao.
20. **AC-20 (NFR-11):** observabilidade possui allowlist campo a campo, justificativa para identificadores correlacionaveis, acesso restrito e teste automatizado de ausencia de PII/segredos/conteudo clinico.
21. **AC-21 (CON-12):** a story registra a Opcao A do ADR-003 como decisao arquitetural aprovada e mantem explicitamente pendentes a politica de retencao/purge e o contrato de promocao.
22. **AC-22 (NFR-01 a NFR-12, CON-04 a CON-12):** a matriz de testes negativos define identificador, pre-condicao, ataque/falha, resultado fail-closed esperado e evidencia exigida para cada controle critico.

## Escopo

- especificacao do bounded context de ingestao;
- modelo conceitual e invariantes, sem SQL;
- matriz de estados, transicoes e autoridades;
- contratos CLI, conectores, artefatos, deduplicacao e vinculo;
- contrato de observabilidade e UI observacional;
- threat model e requisitos LGPD;
- fixtures sinteticas descritas, sem conteudo clinico real;
- plano de testes e gates para implementacoes futuras;
- registro das decisoes pendentes para `@architect`, Data Governance/DPO e `@qa`.

## Fora do escopo

- codigo executavel ou alteracao do runtime;
- acesso a Gmail ou portais;
- implementacao de qualquer conector;
- banco, SQL, migration, RLS ou Storage;
- criacao de paciente/tutor;
- anexacao ao prontuario;
- envio de email/WhatsApp;
- interpretacao ou classificacao clinica;
- uso de nomes, contatos, exames ou imagens reais;
- push, PR, deploy, release ou publicacao;
- remocao do NO-GO.

## Fluxo CLI especificado

1. Validar configuracao, identidade, tenant, periodo e modo fixture.
2. Recusar execucao sem fixture sintetica enquanto o NO-GO estiver ativo.
3. Consultar o conector fixture dentro de limites definidos.
4. Normalizar metadados administrativos sem interpretar conteudo clinico.
5. Persistir conceitualmente o original privado e calcular hash antes de promover a captura.
6. Deduplicar em camadas e registrar divergencias.
7. Avaliar somente evidencias administrativas de vinculo.
8. Produzir itens de fila e rascunhos, sem criar cadastros ou executar destinos.
9. Emitir resumo agregado e sanitizado por estado, fonte e classe de falha.
10. Permitir reexecucao idempotente e modo de simulacao.

## Observabilidade

### Permitido

- identificador interno da execucao;
- tenant/clínica por identificador interno;
- ator por identificador interno;
- conector e periodo;
- contagens agregadas por estado;
- hashes e IDs internos estritamente necessarios;
- preferencialmente contagens agregadas e codigos opacos; IDs/hashes correlacionaveis exigem finalidade documentada e acesso restrito;
- duracao, tentativa e codigo de erro sanitizado;
- recibos futuros minimizados.

### Proibido

- senha, token, cookie ou segredo;
- nome ou contato integral;
- corpo integral de mensagem;
- conteudo clinico integral;
- URL assinada;
- PDF, imagem ou metadado externo bruto em logs.

Eventos devem partir de schema/allowlist fechado, rejeitar campos extras e passar por scanner automatizado de PII/segredos. Payload de erro de conector deve ser transformado em codigo interno sanitizado, nunca propagado integralmente.

## UI observacional

A UI futura pode exibir resumo, filtros, fila, proveniencia, estado, divergencias, evidencias administrativas mascaradas e historico auditavel. Ela nao apresenta botao, escolha, confirmacao ou qualquer controle que inicie busca, aprove, ignore, vincule, anexe, envie ou altere estado. A operacao e as decisoes permanecem integralmente fora do dashboard e devem funcionar pela CLI autorizada sem depender da UI.

## Ameacas e mitigacoes exigidas

| Ameaca | Impacto | Mitigacao contratual |
|---|---|---|
| Pacientes homonimos ou identificadores conflitantes | Vinculo incorreto | Nome isolado proibido; conflito segue para revisao humana |
| Mistura entre clinicas | Violacao de sigilo/LGPD | Tenant obrigatorio, autorizacao server-side e testes negativos |
| Prompt injection em email/PDF/pagina | Execucao indevida | Conteudo externo tratado somente como dado nao confiavel |
| MIME falso, arquivo malicioso ou excessivo | Comprometimento/indisponibilidade | Validacao de tipo, tamanho, assinatura e processamento isolado a definir |
| Path traversal ou substituicao | Perda/adulteracao | Identificador nao previsivel, caminho canonico e original imutavel |
| Replay e concorrencia | Duplicacao/transicao dupla | Chaves idempotentes, CAS/transacao a decidir e recibos unicos |
| Download incompleto | Falso sucesso | Persistencia privada e hash obrigatorios antes de `capturado` |
| Vazamento de URL temporaria | Acesso indevido | Autorizacao por solicitacao e validade curta |
| Logs com PII/clinica | Exposicao secundaria | Allowlist de campos e sanitizacao testavel |
| Conta/sessao externa comprometida | Coleta indevida | Menor privilegio, dominio oficial, segredo seguro e revogacao |
| Destino incorreto | Anexacao/envio indevido | Confirmacao futura vinculada ao alvo e recibo especifico |
| Exclusao prematura do original | Perda de evidencia | Preservacao imutavel e politica de retencao aprovada |
| Estado enviado pelo cliente | Escalada de privilegio | Transicoes controladas pelo servidor/CLI autorizado |
| Enumeracao de itens | Exposicao | IDs nao previsiveis e autorizacao antes de metadados/arquivo |

## Matriz rastreavel de testes negativos

Todos os casos abaixo usam fixtures sinteticas e ambiente local/efemero. Resultado fail-closed significa negar a operacao ou manter o item pendente/em quarentena, sem promocao, vazamento, delecao ou efeito externo. Nenhum caso autoriza execucao remota nesta story.

| ID | Requisitos / AC | Cenario negativo | Resultado fail-closed esperado | Evidencia futura exigida |
|---|---|---|---|---|
| NEG-AUTH-01 | NFR-01, AC-08, AC-22 | Membership revogada com sessao/JWT ainda valido | Acesso negado imediatamente; nenhuma listagem, leitura ou mutacao | Teste com membership ativa, revogacao e repeticao da mesma chamada |
| NEG-AUTH-02 | NFR-01, AC-08, AC-22 | Usuario `admin` de outra clinica usa UUID valido cross-tenant | `404` logico/negacao; zero metadado ou existencia revelada | Matriz Clinica A x Clinica B para banco, API e Storage |
| NEG-AUTH-03 | NFR-01, NFR-07, AC-08, AC-22 | Cliente forja `clinic_id`, papel, estado, `pet_id`, path ou destinatario | Campos autoritativos ignorados/revalidados server-side; transicao negada | Contratos de request com cada campo adulterado |
| NEG-URL-01 | NFR-08, NFR-11, AC-20, AC-22 | Signed URL expirada, reutilizada, vazada ou solicitada cross-tenant | URL nao emitida ou acesso negado; URL ausente de logs | Testes de expiracao/replay/tenant e varredura de logs |
| NEG-FILE-01 | NFR-02, NFR-06, AC-03, AC-22 | MIME declarado diverge de magic bytes | Quarentena; nenhuma promocao/processamento ativo | Fixture MIME falso e registro sanitizado da razao |
| NEG-FILE-02 | NFR-02, NFR-06, AC-03, AC-22 | Nome/path contem traversal ou separadores maliciosos | Path fornecido e ignorado; path canonico server-side ou rejeicao | Fixtures `../`, absolutos e variantes codificadas |
| NEG-FILE-03 | NFR-05, NFR-06, AC-10, AC-22 | Arquivo ou pacote excede limites | Interrupcao controlada/quarentena; sem alocacao ilimitada ou retry inutil | Testes de limite-1, limite e limite+1 |
| NEG-FILE-04 | FR-15, NFR-12, AC-19, AC-22 | Galeria multiparte incompleta, parte extra ou hash divergente | Conjunto nao vira capturado/preservado; manifesto registra pendencia | Fixtures de falta, excesso, duplicata e corrupcao de parte |
| NEG-INJ-01 | NFR-06, CON-11, AC-09, AC-14, AC-22 | Email/PDF/HTML/metadado contem prompt injection | Texto permanece dado inerte; nenhuma ferramenta, instrucao ou inferencia clinica executada | Fixtures adversariais e assercao de zero chamada/acao |
| NEG-IDEM-01 | NFR-04, NFR-12, AC-04, AC-10, AC-22 | Timeout do cliente apos commit e retry com mesma chave | Um unico efeito; resposta reconciliada pelo estado/recibo existente | Teste fault-injection entre commit e resposta |
| NEG-IDEM-02 | NFR-04, NFR-12, AC-04, AC-19, AC-22 | Duas execucoes concorrentes capturam/promovem a mesma origem | Uma decisao canonica; sem duplicata, overwrite ou promocao dupla | Teste concorrente com barreira e invariantes pos-execucao |
| NEG-LOG-01 | NFR-03, NFR-11, AC-09, AC-20, AC-22 | Fixture injeta nome, contato, token, URL e conteudo clinico em erros | Scanner encontra zero ocorrencia proibida nos logs/eventos exportados | Scan automatizado com canarios sinteticos unicos |
| NEG-ACTION-01 | FR-13, NFR-07, NFR-12, AC-07, AC-22 | Cliente declara sucesso sem recibo ou usa recibo de outro tenant/acao | Estado nao avanca; evento de tentativa sanitizado | Testes de recibo ausente, adulterado, reutilizado e cross-tenant |
| NEG-SNAP-01 | FR-14, NFR-04, NFR-07, AC-05, AC-07, AC-22 | Artefato, hash, vinculo ou destino muda apos aprovacao | Aprovacao invalidada; nova revisao exigida sobre novo snapshot | Teste de version/hash mismatch antes da transicao |

## Plano de testes da especificacao

### Contratos e unidade futuros

- periodos e limites de dia em Sao Paulo;
- normalizacao de fonte sem inferencia clinica;
- hashing e deduplicacao em tres camadas;
- transicoes validas e invalidas;
- mascaramento e allowlist de logs;
- avaliacao de evidencia de vinculo;
- retry, timeout, circuit breaker e resultado desconhecido.

### Integracao local/efemera futura

- persistencia idempotente e imutabilidade;
- concorrencia e falha parcial;
- autorizacao de acesso temporario;
- Clinica A versus Clinica B;
- divergencia de hashes;
- ausencia/ambiguidade de paciente;
- recibos separados por destino.
- captura multiparte atomica por manifesto;
- timeout apos commit e execucao concorrente;
- membership revogada, admin cross-tenant e inputs autoritativos forjados;
- signed URL expirada/reutilizada e scanner de PII/segredos.

### Contratos de conectores com fixtures

- origem valida e origem fora da allowlist;
- PDF unico e imagens multiplas;
- laudo e imagens em acoes separadas;
- download progressivo completo e incompleto;
- objeto ausente apos preparacao;
- indisponibilidade, timeout e mudanca de capacidade;
- duplicata por origem, por hash e por chave administrativa.

### UI futura

- somente leitura, inclusive por teclado e em lote;
- ausencia de controles mutantes;
- filtros, paginacao, estados vazios, loading e falha parcial;
- mascaramento e autorizacao da visualizacao;
- desktop, tablet e celular.

## Gates

Nesta story documental:

- revisao de rastreabilidade FR/NFR/CON -> AC -> tarefa;
- revisao por `@architect` das decisoes estruturais;
- revisao de privacidade/Data Governance;
- veredito independente de `@qa`;
- confirmacao de que somente documentacao foi alterada.
- cobertura integral da matriz FR/NFR/CON -> AC -> tarefa;
- aprovacao LGPD/Data Governance de finalidade, base legal, minimizacao, retencao, direitos do titular, subprocessadores, resposta a incidente e purge antes de promocao para dados reais.

Antes de concluir qualquer story de implementacao:

- `npm run lint`;
- `npm run typecheck`;
- `npm test`;
- `npm run build`;
- `npm run check:predeploy`;
- CodeRabbit sem finding CRITICAL quando o recurso estiver habilitado;
- testes negativos de tenancy/RLS/Storage;
- matriz `NEG-*` integralmente verde, incluindo captura multiparte, concorrencia, recibo/snapshot e scan de PII;
- staging isolado com fixtures sinteticas e limpeza verificavel;
- evidencia de minimizacao e controles LGPD aprovada por Data Governance/DPO;
- veredito formal de `@qa`.

Nenhum gate local autoriza producao ou dados reais.

## Tarefas / Subtarefas

- [x] **T1 — Formalizar o bounded context** (AC-02, AC-17)
  - [x] Delimitar ingestao, `laudos_pdf`, pacientes, prontuario e comunicacoes.
  - [x] Submeter fronteiras e integracoes a `@architect`.
- [x] **T2 — Especificar modelo conceitual e proveniencia** (AC-03, AC-08)
  - [x] Definir entidades e invariantes sem escolher schema ou tecnologia nova.
  - [x] Exigir tenant, origem e cadeia artefato/hash.
- [x] **T3 — Especificar estados e transicoes** (AC-06, AC-07)
  - [x] Mapear ator, pre-condicao, motivo, idempotencia e recibo.
  - [x] Separar estados administrativos dos estados de IA/processamento.
- [x] **T4 — Especificar contratos de captura e conectores** (AC-03, AC-10, AC-12)
  - [x] Definir interface comum e capacidades opcionais.
  - [x] Documentar falha parcial, retry e captura incompleta.
- [x] **T5 — Especificar deduplicacao e vinculo** (AC-04, AC-05)
  - [x] Criar matriz de sinais, conflitos e resultados no nivel aprovado para esta especificacao.
  - [x] Proibir nome isolado e criacao automatica.
- [x] **T6 — Especificar CLI e fixtures** (AC-01, AC-11, AC-14)
  - [x] Documentar comandos/entradas/saidas conceituais sem implementar.
  - [x] Definir fixtures sinteticas e sanitizadas.
- [x] **T7 — Especificar observabilidade e UI** (AC-09, AC-13)
  - [x] Definir allowlist de eventos e campos.
  - [x] Manter UI estritamente observacional.
- [ ] **T8 — Consolidar seguranca, privacidade e retencao** (AC-08, AC-09, AC-15)
  - [x] Revisar threat model e controles documentais com Security/Privacy/QA.
  - [ ] Obter decisao de Data Governance/DPO para retencao e descarte.
- [x] **T9 — Validar a especificacao** (AC-16, AC-18)
  - [x] Executar revisao de rastreabilidade e checklist.
  - [x] Obter veredito de `@qa` sem confundi-lo com aprovacao de produto.
- [x] **T10 — Preparar decomposicao do epico** (AC-17)
  - [x] Criar propostas documentais de stories separadas para CLI fixture, persistencia, matching, conectores, observabilidade e UI.
  - [x] Manter anexacao e comunicacao em stories futuras independentes.
- [x] **T11 — Validar atomicidade, testes negativos e minimizacao** (AC-19, AC-20, AC-22)
  - [x] Revisar manifesto de captura multiparte e reconciliacao de timeout/concurrency no contrato documental.
  - [x] Revisar todos os casos `NEG-*` e as evidencias fail-closed exigidas.
  - [x] Validar o contrato de allowlist observavel e scanner sintetico de PII/segredos.
- [x] **T12 — Registrar decisao arquitetural aprovada** (AC-21)
  - [x] Referenciar ADR-003 e a Opcao A sem modificar o ADR.
  - [x] Manter retencao/purge e promocao como gates pendentes.

## Decomposicao / proximas stories

1. CLI local com fixtures sinteticas e zero acesso externo.
2. Modelo fisico, persistencia privada e isolamento em ambiente efemero, apos decisao de retencao aplicavel.
3. Matching administrativo e revisao humana, incluindo obrigatoriamente:
   - `NEG-MATCH-01`: homonimos ou nome isolado nunca confirmam vinculo e permanecem `vinculo_pendente`;
   - `NEG-MATCH-02`: identificadores administrativos conflitantes, stale snapshot ou candidato cross-tenant invalidam a sugestao/aprovacao e exigem nova revisao.
4. Um conector por contrato/capacidade comprovada, sempre iniciado por fixtures.
5. Observabilidade sanitizada apos CLI funcional.
6. UI estritamente observacional apos observabilidade.
7. Promocao/anexacao e comunicacao em stories distintas, somente depois dos respectivos contratos, confirmacoes e gates.

Esta decomposicao nao cria schema, autoriza implementacao, remove gates ou aprova dados reais.

## Matriz de rastreabilidade

| Origem | Criterios de aceite | Tarefas |
|---|---|---|
| FR-01, FR-02 | AC-01 | T6 |
| FR-03 | AC-11 | T6 |
| FR-04 | AC-12 | T4 |
| FR-05, FR-06 | AC-03 | T2, T4 |
| FR-07 | AC-04 | T5 |
| FR-08, FR-14 | AC-05 | T5 |
| FR-09 | AC-06 | T3, T5 |
| FR-10, FR-13 | AC-07 | T3 |
| FR-11 | AC-02, AC-07 | T1, T3 |
| FR-12 | AC-14 | T6 |
| FR-15 | AC-19 | T4, T11 |
| NFR-01, NFR-08 | AC-08, AC-22 | T2, T8, T11 |
| NFR-02 | AC-03, AC-19, AC-22 | T2, T4, T11 |
| NFR-03, NFR-06 | AC-09, AC-20, AC-22 | T7, T8, T11 |
| NFR-04 | AC-04, AC-10, AC-22 | T3, T5, T11 |
| NFR-05, NFR-09 | AC-10, AC-22 | T4, T11 |
| NFR-07 | AC-07, AC-22 | T3, T7, T11 |
| NFR-10 | AC-02 | T1, T3 |
| NFR-11 | AC-20, AC-22 | T7, T11 |
| NFR-12 | AC-19, AC-22 | T3, T4, T11 |
| CON-01 | AC-02, AC-17, AC-21 | T1, T12 |
| CON-02, CON-03 | AC-01, AC-13 | T6, T7 |
| CON-04, CON-05, CON-10 | AC-15, AC-22 | T8, T9, T11 |
| CON-06 | AC-06, AC-07, AC-22 | T3, T5, T11 |
| CON-07, CON-08 | AC-09, AC-12, AC-22 | T4, T7, T11 |
| CON-09 | AC-17, AC-18 | T1, T8, T9 |
| CON-11 | AC-14, AC-22 | T6, T11 |
| CON-12 | AC-21 | T12 |
| Artefatos obrigatorios da story | AC-16 | T9 |

## Decisoes pendentes e autoridades

| Decisao | Autoridade | Gate |
|---|---|---|
| Bounded context e armazenamento separados (Opcao A) | `@architect`, aprovado no ADR-003 | Decidido; implementacao ainda bloqueada |
| Contrato de promocao fila -> contexto clinico | `@architect` + `@po` | Pendente; story futura |
| Politica de retencao, purge, base legal e direitos LGPD | Data Governance/DPO | Pendente; antes de persistencia com dados reais |
| Schema, constraints, RLS e migration | `@data-engineer` com Architecture/Security | Story posterior; somente efemero inicialmente |
| Evidencia minima de vinculo e papeis autorizados | Dr. Anderson / `@po`, com Privacy/Security | Antes de matching |
| Veredito de qualidade | `@qa` | Antes de Ready for Development/Review |
| Qualquer operacao remota | `@devops` + confirmacao humana explicita | Fora desta story |

## Checklist da story

- [x] Story e valor estao claros.
- [x] Escopo e fora do escopo estao explicitos.
- [x] FR, NFR e CON possuem identificadores.
- [x] Criterios de aceite possuem rastreabilidade.
- [x] CLI precede observabilidade e UI.
- [x] UI foi limitada a observacao.
- [x] NO-GO para dados reais e producao foi preservado.
- [x] Nenhuma acao critica foi autorizada.
- [x] Nenhuma interpretacao clinica foi incluida.
- [x] Ameacas e privacidade foram documentadas.
- [x] Plano de testes e gates foram incluidos.
- [x] Tarefas desta story estao limitadas a especificacao/validacao.
- [x] Opcao A do ADR-003 registrada como decisao arquitetural aprovada.
- [ ] Contrato de promocao aprovado em story futura.
- [ ] Politica de retencao aprovada.
- [x] Veredito independente de `@qa` registrado: `APPROVED WITH NON-BLOCKING NOTES`.
- [x] File List atualizada para a criacao inicial.

## Resultado de readiness

**Story documental:** APPROVED WITH NON-BLOCKING NOTES por QA.

**Arquitetura:** Opcao A aprovada no ADR-003; promocao e modelo fisico pendentes.

**Implementacao:** BLOCKED ate conclusao das decisoes, gates LGPD e validacoes pendentes.
**Dados reais/producao:** NO-GO.

## Change Log

| Data | Versao | Alteracao | Autoridade |
|---|---:|---|---|
| 2026-08-23 | 0.1 | Story criada apos aprovacao explicita do Dr. Anderson; bounded context separado, originais privados, CLI com fixtures primeiro, UI observacional e NO-GO formalizados. | `@sm` / `@po` |
| 2026-08-23 | 0.2 | Ajustes de QA: Opcao A/ADR-003 registrada, UI estritamente observacional, matriz negativa `NEG-*`, rastreabilidade integral, captura multiparte atomica, minimizacao observavel e gates LGPD reforcados. | `@sm` / `@po` |
| 2026-08-23 | 0.3 | Fechamento administrativo apos aprovacao de QA; tarefas documentais satisfeitas marcadas, pendencias operacionais preservadas e `NEG-MATCH-01/02` encaminhados para a story futura de matching. | `@sm` / `@po` |

## File List

- `docs/stories/LAB-ING-001.ingestao-segura-exames.md` — story documental criada, refinada e encerrada administrativamente com aprovacao de QA; nenhum codigo, banco ou ambiente alterado.
- `docs/architecture/ADR-003-exam-ingestion-evidence-preservation.md` — decisao arquitetural aprovada (Opcao A), criada pela frente Architect e apenas referenciada por esta story; nao alterada por `@sm`/`@po`.

## Referencias

- `AGENTS.md` — CLI First, story-driven development e gates do repositorio.
- `web/AGENTS.md` — leitura obrigatoria da documentacao local do Next.js antes de futura implementacao web.
- `.aiox-core/constitution.md` — autoridades exclusivas, CLI First, UI observacional e No Invention.
- `docs/README.md` — NO-GO vigente e governanca documental.
- `docs/stories/AUDIT-001.production-readiness-audit.md` — findings e bloqueadores atuais.
- `docs/architecture/command-authority-matrix.md` — matriz operacional de autoridades.
- `docs/architecture/ADR-001-tenancy-clinica-rls.md` — arquitetura proposta de isolamento; nao autoriza migration.
- `docs/architecture/fase1-tenancy-implementation-spec.md` — dependencia entre runtime, tenancy e reserva de laudo.
- `docs/architecture/drafts/laudos-ia/README.md` — contrato transacional de laudos em quarentena.
- `docs/architecture/ADR-003-exam-ingestion-evidence-preservation.md` — Opcao A, bounded context separado, preservacao de evidencias e gates pendentes.
