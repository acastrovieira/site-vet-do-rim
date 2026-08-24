# ADR-003 — Ingestão de exames e preservação de evidências

- **Status:** Opção A e fronteira arquitetural aprovadas por `@architect` e pelo owner (2026-08-23); retenção/DPO, contrato de promoção e implementação permanecem pendentes e bloqueados pelos gates deste ADR
- **Data:** 2026-08-23
- **Responsáveis pela decisão:** Architect / Security / Data Governance
- **Aprovador:** Dr. Anderson
- **Story:** `LAB-ING-001` — draft aprovado para especificação e validação local
- **Escopo:** descoberta de exames, captura de arquivos, revisão de vínculo, armazenamento privado, conectores, CLI, observabilidade e UI
- **Natureza deste documento:** decisão de arquitetura; não define schema físico e não autoriza migration, acesso remoto, publicação ou ação sobre prontuário/comunicação

## 1. Decisão executiva

A localização de exames externos será implementada em um **bounded context separado**, denominado conceitualmente `exam_ingestion`. Itens descobertos, arquivos capturados, evidências de correspondência e decisões de revisão não serão tratados como `laudos_pdf` antes de uma promoção humana explícita.

Os originais capturados serão preservados em um contexto privado de evidências,
separado do ciclo de vida legado de `laudos_pdf`. O pipeline legado está sob
**preservation hold** local: sua deleção automática foi neutralizada, mas ele
continua isolado da nova ingestão até existir política de retenção e promoção
aprovada.

A ordem obrigatória de entrega será:

`CLI funcional → observabilidade sanitizada → UI observacional`

Os estados administrativos da ingestão serão separados dos estados técnicos de processamento de `laudos_pdf`. Vínculo, anexação a prontuário e envio por qualquer canal serão ações distintas, server-side, auditadas e sujeitas a confirmação humana explícita no momento da ação.

A aprovação arquitetural limita-se à fronteira da **Opção A**: contexto de ingestão e evidências preservadas separados do pipeline legado. Ela não aprova prazo de retenção, purge, schema físico, contrato de promoção, conectores, acesso a dados reais ou qualquer ação operacional. Esses pontos continuam sujeitos às autoridades e gates próprios.

Esta decisão não autoriza uso de dados reais. O produto permanece **NO-GO** até que os gates de staging, tenancy, retenção, segurança e qualidade descritos neste ADR sejam satisfeitos.

## 2. Contexto e forças da decisão

O produto precisa localizar resultados provenientes inicialmente de CDV, CDVet, RadioVet, CAIP, LitoLab, UltraLab e IDAN, com expansão posterior por configuração. A primeira versão será iniciada por comando manual na CLI, correspondente à intenção de “Buscar exames agora”, e produzirá somente uma fila de revisão. O botão originalmente solicitado não integra a UI sob a Constituição vigente; sua eventual adoção depende de emenda constitucional formal.

O VetDorim é a fonte principal para pacientes. SimplesVet/INCISE é destino opcional, pois nem todo paciente nefrológico pertence à INCISE. Nome isolado não identifica unicamente paciente ou tutor, e nenhum dos dois pode ser criado automaticamente.

Laudos e imagens são documentos de origem e precisam manter proveniência, integridade e acesso restrito. Uma preparação de download em portal não equivale a captura armazenada: sucesso só existe quando os bytes foram persistidos e verificados.

O ADR-001 já decide que clínica é a fronteira de tenant, que caminhos de Storage não provam autorização e que DELETE depende de retenção e workflow auditado (`ADR-001`, seções 3.3, 6.2, 6.3 e 7.1). Também mantém o produto NO-GO até reconciliação remota e testes Vet A × Vet B.

## 3. Achados críticos identificados na auditoria inicial

Estes achados não são autorização para corrigir código nesta decisão. Eles são bloqueios e requisitos de compatibilidade para stories futuras.

1. A Edge Function valida `storage_path` pelo prefixo `${user.id}/` em `supabase/functions/parse-laudo/index.ts:650-662`, mas a reserva vigente gera o caminho canônico `clinics/{clinic_id}/laudos/{laudo_id}/original.pdf` em `supabase/migrations/20260718120000_laudo_upload_reservation.sql:203-224`. Os contratos são incompatíveis.
2. Depois de finalizar a IA, normalização e gravação do SHA-256 são tratadas como best-effort em `supabase/functions/parse-laudo/index.ts:835-867`; o PDF é removido mesmo assim em `supabase/functions/parse-laudo/index.ts:869-894`. Isso permite perda do original sem confirmação persistida de integridade ou normalização.
3. O cron `web/src/app/api/cron/cleanup-storage/route.ts:12-20,52-100` remove laudos concluídos que ainda não possuem `storage_deleted_at`, reforçando a estratégia de descarte.
4. `supabase/migrations/20260823000300_pdf_lifecycle_and_populate.sql:11-37` contém `CREATE INDEX CONCURRENTLY` dentro de um bloco `BEGIN`, combinação que PostgreSQL não permite executar em uma transação.
5. `exam_result_items` usa `public.current_user_is_vet_or_admin()` sem predicado de `clinic_id` em `supabase/migrations/20260823000200_exam_result_items.sql:133-145`. O helper consulta papel global em `profiles` (`supabase/migrations/20260823000100_perf_002_rls_policy_optimization.sql:26-49`), contrariando a membership por clínica decidida no ADR-001.
6. As relações de `exam_result_items` com laudo e paciente são FKs simples (`supabase/migrations/20260823000200_exam_result_items.sql:38-44`) e não provam que todas as linhas pertencem ao mesmo tenant.
7. O pipeline normalizado atribui intervalos e estados `normal`, `alto` e `baixo` (`supabase/migrations/20260823000200_exam_result_items.sql:72-80` e `supabase/migrations/20260823000300_pdf_lifecycle_and_populate.sql:118-193`). Isso é processamento clínico e não faz parte da ingestão administrativa aprovada.
8. A chave idempotente de `parse-laudo` é gerada novamente em cada requisição (`supabase/functions/parse-laudo/index.ts:675-689`). A proteção por claim reduz dupla cobrança por laudo, mas a chave não é estável entre retries do chamador e não serve como modelo para conectores.

Nenhuma nova ingestão poderá depender desses comportamentos. Os itens 1 a 5
receberam contenções locais: path canônico, preservação do original, cron sem
mutação, reparo de replay registrado e RLS clinic-scoped forward. O item 7
permanece fail-closed na UI/exportação, e os registros legados não são
reclassificados. Correções remotas continuam exigindo reconciliação e migration
forward. As três exceções históricas mínimas de replay estão registradas no
ledger do ADR-002 e não autorizam nova reescrita.

### Nota de contenção local — 2026-08-23

Como medida de segurança reversível, autorizada no Sprint 1 e sem alterar
migrations históricas ou estado remoto:

- `parse-laudo` deixou de remover o objeto original após a extração; o SHA-256,
  tamanho, provider, modelo, prompt e schema continuam registrados na
  proveniência transacional;
- o endpoint legado `/api/cron/cleanup-storage` foi convertido em guarda
  autenticada sem banco, service role ou mutação;
- o agendamento desse endpoint foi removido da configuração local de deploy;
- o fluxo local continua confirmando a existência de `original.pdf` antes de
  salvar resultados revisados e não remove o objeto depois do sucesso.

Esta contenção não aprova prazo de retenção, purge, alteração remota ou
convergência arquitetural com o novo bounded context. Esses pontos permanecem
sob decisão de Data Governance/DPO, Architect e Security.

## 4. Opções consideradas

### Opção A — Contexto e armazenamento de evidências separados

Criar fronteira própria para descoberta, captura, deduplicação, revisão e promoção, com originais em armazenamento privado separado do descarte legado.

**Vantagens:** reduz o raio de impacto, preserva documentos desde a primeira captura, mantém estados administrativos coerentes e permite introdução gradual de conectores.

**Custos:** adiciona uma fronteira explícita e exige contrato de promoção para `laudos_pdf` ou outro destino futuro.

### Opção B — Converter imediatamente todo `laudos_pdf` para retenção

Desativar deleção na Edge Function e no cron e transformar o modelo existente no repositório de originais.

**Vantagens:** um único modelo aparente para arquivos.

**Custos:** mistura ingestão não revisada com laudo já vinculado, amplia o impacto sobre produção e exige política de retenção, reconciliação remota e correção de contratos antes da primeira entrega.

### Opção C — Reutilizar “Extract & Discard”

Capturar arquivos externos, extrair dados e apagar os originais.

**Rejeitada:** viola o requisito de preservação, impede revisão fiel da origem e conflita com a regra do ADR-001 de que purge depende de retenção e workflow auditado.

### Decisão

Adotar a **Opção A** na primeira versão. Esta fronteira foi aprovada por `@architect` e pelo owner. A Opção B pode ser avaliada posteriormente como convergência arquitetural, mediante ADR complementar e política de retenção aprovada. A Opção C não é admissível. O contrato de promoção ao prontuário/`laudos_pdf` e todas as decisões de retenção continuam expressamente pendentes.

## 5. Modelo conceitual

Os nomes abaixo expressam responsabilidades, não nomes finais de tabelas, buckets, filas ou APIs:

| Conceito | Responsabilidade |
|---|---|
| Execução de busca | Registra ator, clínica, conector, período, idempotência e resumo operacional. |
| Item de origem | Representa mensagem, exame ou registro externo por identidade estável do conector. |
| Evidência original | Representa bytes capturados, hash, tamanho, tipo verificado, origem e localização privada imutável. |
| Item de revisão | Mantém estado administrativo e agrega evidências sem presumir paciente. |
| Candidato de vínculo | Registra possível paciente e as evidências administrativas que sustentam ou contradizem a correspondência. |
| Decisão humana | Registra ator, tenant, versão e hash do snapshot aprovado, sem aceitar autoridade enviada pelo cliente. |
| Intenção de ação | Representa pedido confirmado de promoção, anexação ou envio, com chave idempotente e escopo único. |
| Recibo de ação | Prova o resultado retornado pelo destino; sem recibo não existe estado de sucesso. |
| Evento de auditoria | Registra transições e ações críticas de forma append-only e sanitizada. |

`pet_id` e qualquer destino externo permanecem ausentes ou pendentes enquanto não houver evidência suficiente e decisão humana. O schema físico, cardinalidades, índices e particionamento serão propostos pelo `@data-engineer` em uma story aprovada e validados pelo `@architect`.

## 6. Estados e transições

Os estados administrativos são:

`novo → vinculo_pendente → pronto_para_revisao → aprovado → anexado → enviado`

Estados terminais ou laterais: `erro` e `ignorado`.

Regras:

1. Esses estados pertencem à ingestão e não substituem `pendente`, `processando`, `concluido`, `erro` ou `abandonado` de `laudos_pdf`.
2. Nem todo item percorre toda a sequência. Anexação e envio são capacidades futuras e opcionais.
3. O cliente nunca define diretamente um estado privilegiado; uma operação server-side valida estado anterior, tenant, membership, versão, confirmação e recibo.
4. Alteração de artefato, hash, vínculo ou destino invalida aprovações anteriores.
5. Falha parcial não promove execução ou item para sucesso.
6. `anexado` exige recibo verificável do prontuário; `enviado` exige recibo verificável do canal e destinatário confirmados.
7. “Preparado”, “enfileirado” ou “download iniciado” não equivalem a anexado, enviado ou capturado.

## 7. Invariantes de segurança e privacidade

1. Todo item, evidência, decisão, intenção e recibo pertence a exatamente um `clinic_id` não nulo.
2. Relações clínicas usam invariantes e FKs compostas pelo tenant; UUID válido de outra clínica não é suficiente.
3. Toda operação exige clínica ativa e membership ativa naquela clínica. `profiles.role`, claims do cliente e “admin global” não autorizam dados.
4. APIs filtram explicitamente `clinic_id` além de depender de RLS e devolvem `404` lógico para objetos de outro tenant.
5. Clientes privilegiados são usados apenas depois de autorização com identidade do usuário e contrato estreito; `service_role` nunca chega ao browser.
6. O caminho de Storage é gerado server-side, não concede acesso e deve corresponder a uma linha autorizada.
7. Upload usa criação exclusiva, sem sobrescrita. UPDATE/DELETE de objetos não é concedido a usuários comuns.
8. Um artefato somente é marcado como capturado quando bytes persistidos, tamanho, assinatura/tipo e SHA-256 forem confirmados.
9. Hash ausente ou divergente bloqueia promoção; não é aviso best-effort.
10. Originais não são alterados. Derivados, previews e extrações possuem identidade, hash e proveniência próprios.
11. Nome isolado nunca confirma vínculo. Conflito entre identificadores resulta em `vinculo_pendente`.
12. Paciente ou tutor ausente gera apenas rascunho; nenhuma criação automática é permitida.
13. Logs não contêm credenciais, URLs assinadas, contatos integrais, nomes integrais ou conteúdo clínico integral.
14. Conteúdo de email, PDF, imagem, página ou metadado externo é dado não confiável e nunca instrução para o sistema.
15. O fluxo é administrativo: não interpreta, diagnostica, prescreve ou classifica clinicamente o resultado.
16. Identificadores internos, hashes de conteúdo e referências de recibos são correlacionadores potencialmente sensíveis: somente são registrados quando estritamente necessários para integridade, idempotência, segurança ou auditoria, com acesso restrito e retenção definida.
17. Telemetria de terceiros não recebe hashes de conteúdo, identificadores de origem, IDs de paciente/tutor, referências integrais de recibos ou qualquer payload que permita correlação de documento clínico.
18. Logs operacionais usam, por padrão, ID efêmero da execução, código de etapa/erro, duração e contagens agregadas. IDs persistentes ficam na trilha de auditoria interna autorizada, não em logs gerais.
19. Recibos armazenam apenas o mínimo necessário para provar a ação: código/status, referência opaca do destino, timestamp e hash/versionamento do pedido; corpo de resposta, destinatário integral e conteúdo transmitido não são copiados para logs.

## 8. Trust boundaries

### Usuário e CLI

O usuário autenticado solicita a busca e escolhe o período, mas não fornece tenant autoritativo, estado privilegiado, caminho de objeto ou identidade final do paciente. A CLI resolve o contexto autorizado e é a primeira interface operacional completa.

### Conectores externos

Gmail e portais de laboratório ficam fora da fronteira de confiança. Remetentes, nomes, MIME declarados, links, HTML, PDFs e imagens podem estar incorretos ou maliciosos. Cada conector entrega dados a um contrato comum de captura e não escreve diretamente em prontuário ou tabelas clínicas finais.

### Orquestração server-side

A camada server-side valida autorização, limites, idempotência e transições antes de usar credenciais de conector ou serviço. Segredos permanecem em mecanismo próprio de secrets e não são armazenados em linhas de domínio ou logs.

### Banco e armazenamento privado

Banco e Storage aplicam isolamento por clínica independentemente da UI. O armazenamento preserva a evidência; metadados no banco não substituem a existência verificável dos bytes.

### Destinos futuros

VetDorim, SimplesVet/INCISE, email e WhatsApp são destinos separados. Cada ação possui confirmação, idempotência e recibo próprios. Autorizar um destino não autoriza outro.

## 9. Contrato de conectores

Todo conector seguirá conceitualmente:

`discover → fetch metadata → capture bytes → verify → persist evidence → enqueue review`

Requisitos comuns:

- configuração por allowlist de fonte, domínio e remetente, sem confiar apenas em texto exibido;
- credenciais com menor escopo, rotação e armazenamento seguro;
- Gmail inicialmente read-only; nenhuma modificação, resposta ou envio;
- sessão de portal efêmera e autorizada, nunca gravada no repositório ou em logs;
- domínio oficial fixado e redirects validados;
- limites de tamanho, quantidade, tempo e tipo; validação por magic bytes além de MIME;
- quarentena de conteúdo inválido ou suspeito, sem processamento ativo de scripts/macros;
- timeout e no máximo três tentativas para falhas transitórias, com circuit breaker;
- erro sanitizado e revisão humana após esgotamento;
- fixtures exclusivamente sintéticas até o fechamento integral dos gates deste ADR.

### Captura multipartes

Para CDVet e qualquer fonte que entregue laudo, galeria ou pacote em múltiplas partes, a unidade administrativa de captura é o conjunto, não cada arquivo isolado:

1. Antes da captura, o conector cria um manifesto esperado com identidade da origem, partes enumeradas quando a fonte permitir, contagem esperada ou marcador explícito de conclusão e versão da descoberta.
2. Cada parte é gravada inicialmente em quarentena, com identidade própria, tamanho, tipo verificado e SHA-256.
3. O conjunto somente é promovido atomicamente de quarentena para `captured` quando todas as partes esperadas estiverem persistidas, íntegras, vinculadas ao mesmo tenant/origem e reconciliadas com o manifesto.
4. Parte ausente, duplicada de forma conflitante, hash divergente, alteração do manifesto ou timeout mantém todo o conjunto em quarentena; nenhum subconjunto entra na fila como exame completo.
5. Retry reutiliza a identidade estável do conjunto e das partes. A reconciliação pode completar partes ausentes, mas não sobrescreve bytes já confirmados nem promove automaticamente um manifesto divergente.
6. Um reconciliador idempotente compara manifesto, objetos e metadados, registra somente contagens/códigos sanitizados e encaminha divergências para revisão humana.
7. A promoção deve ser transacional no estado de domínio. Se o Storage não oferecer transação multiobjeto, os objetos permanecem inacessíveis fora da quarentena até o commit único do manifesto no banco.

Para CDVet, a preparação progressiva de um pacote não comprova captura. Galerias JPEG com múltiplas imagens exigem manifesto completo; somente o conjunto integral, persistido, verificado e reconciliado entra na fila.

## 10. Idempotência e deduplicação

A idempotência ocorrerá em camadas:

1. **Execução:** chave estável do comando/retry, associada a clínica, conector e escopo temporal.
2. **Origem:** unicidade conceitual por clínica, conector e identificador externo estável, como message-id ou identificador oficial.
3. **Artefato:** SHA-256 e tamanho identificam bytes iguais; colisão ou metadado incompatível entra em quarentena.
4. **Exame administrativo:** laboratório, paciente confirmado, tipo/data e demais evidências sinalizam duplicidade provável ou versão divergente.
5. **Ação externa:** cada promoção, anexação ou envio usa chave própria e recibo do destino.

Deduplicação nunca apaga silenciosamente. Arquivos iguais podem compartilhar armazenamento físico se a implementação futura provar isolamento e rastreabilidade, mas cada origem mantém sua proveniência. Arquivos diferentes para o mesmo exame são preservados como versões ou divergência para revisão.

## 11. Confirmações humanas

Confirmações são server-side, explícitas e just-in-time. Cada uma registra:

- ator autenticado e membership;
- clínica;
- ação exata;
- alvo mascarado;
- versão e hash do snapshot revisado;
- timestamp e expiração quando aplicável;
- chave idempotente;
- resultado e recibo, se executada.

São confirmações independentes:

1. aprovar vínculo e conteúdo administrativo;
2. promover/anexar ao prontuário;
3. enviar por email a destinatário específico;
4. enviar por WhatsApp a destinatário específico.

Uma aprovação geral da story ou deste ADR não substitui nenhuma confirmação operacional futura.

## 12. CLI, observabilidade e UI

### CLI

A CLI é a fonte operacional inicial. Deve suportar validação de configuração, execução manual limitada, período em `America/Sao_Paulo`, modo de simulação, resumo sanitizado, retry idempotente e inspeção de pendências. Ela não anexa nem envia na V1.

### Observabilidade

Depois da CLI, métricas e eventos mostrarão execução, duração, contagens por estado/fonte, duplicidades, falhas por etapa, retries e integridade pendente. A observabilidade geral usa dados agregados e IDs efêmeros. Hashes de conteúdo, IDs persistentes e referências de recibo permanecem apenas na trilha interna quando necessários, com acesso e retenção restritos. É proibido enviá-los a telemetria de terceiros. Conteúdo clínico, PII, segredos, URLs assinadas e corpos de recibo não são registrados.

### UI

A UI é **estritamente observacional**, conforme a Constituição vigente. Ela somente exibe estado, métricas sanitizadas, pendências e histórico já produzidos pela CLI/backend. Não inicia busca, retry, captura, matching, transição, aprovação, anexação, envio nem apresenta controles que constituam escolhas operacionais. Toda operação e decisão pertencem à CLI e aos contratos server-side autorizados; eventual mudança dessa regra exige emenda constitucional aprovada, não uma exceção neste ADR.

## 13. Retenção, LGPD e purge

Os originais serão preservados, mas a política completa ainda depende de decisão formal de Data Governance/DPO. A aprovação deverá abranger, no mínimo:

- finalidade específica e necessidade de cada categoria de dado/artefato;
- base legal, prazos de retenção, arquivamento, legal hold e critérios de purge;
- identificação de controlador, operadores e responsabilidades por fluxo;
- inventário e aprovação de subprocessadores, com contratos e menor compartilhamento;
- transferências nacionais/internacionais, regiões de processamento e salvaguardas aplicáveis;
- atendimento a acesso, correção, portabilidade, oposição, eliminação e demais direitos aplicáveis do titular;
- comunicação, contenção, investigação e registro de incidentes;
- trilha de auditoria, segregação de acesso e revisões periódicas;
- retenção, criptografia, restauração e expurgo verificável de backups e réplicas;
- exportação LGPD e comprovação de purge em sistemas primários, derivados e backups conforme a política aprovada.

Enquanto essa decisão estiver pendente:

- não haverá purge automático dos objetos da nova ingestão;
- não haverá retenção “para sempre” declarada como política definitiva;
- DELETE permanecerá negado a fluxos comuns;
- testes usarão dados sintéticos descartáveis em ambiente isolado, com limpeza controlada e comprovada;
- qualquer rotina futura de purge exigirá escopo exato, dupla validação, trilha auditável e possibilidade de interromper antes da execução.

## 14. Consequências

### Positivas

- elimina o acoplamento entre descoberta não revisada e prontuário;
- preserva origem e versões divergentes;
- reduz risco de associação incorreta e ação externa prematura;
- permite conectores adicionais sem ampliar privilégios do núcleo clínico;
- mantém a ingestão administrativa separada de interpretação clínica;
- torna confirmação e recibos verificáveis por ação.

### Custos e complexidade

- exige novo modelo e armazenamento conceitualmente separados;
- requer operação de promoção entre contextos;
- aumenta volume armazenado e demanda política de retenção/custo;
- exige testes de isolamento também para conectores, evidências e recibos;
- o pipeline legado continuará com dívida técnica até story específica.

### Riscos residuais

- comprometimento de conta externa ou sessão autorizada;
- mudanças de contrato/layout em portais;
- correspondência ambígua entre pacientes;
- malware ou conteúdo adversarial em anexos;
- custo e crescimento de armazenamento;
- erro humano na confirmação.

Esses riscos são reduzidos, não eliminados, pelos controles deste ADR.

## 15. Gates e NO-GO

O uso de dados reais e qualquer ação externa permanecem bloqueados até existir evidência de **todos** os gates abaixo, sem exceção implícita, além de uma story específica aprovada para a operação pretendida e confirmação humana explícita just-in-time no momento da ação:

- [x] Story formal `LAB-ING-001` criada em draft e aprovada para especificação/validação local.
- [ ] Modelo físico e migrations forward revisados por `@data-engineer`, Architect e Security.
- [ ] Política completa de Data Governance/DPO aprovada, cobrindo finalidade, papéis de controlador/operador, subprocessadores, transferências, direitos dos titulares, retenção/purge, incidentes, auditoria e backups.
- [ ] Catálogo remoto reconciliado por auditoria read-only; `remoteAttestation` não presumida.
- [ ] Replay completo das migrations em ambiente efêmero.
- [x] Reparos históricos mínimos de replay registrados como transições exatas;
  manifesto e gate contra commit-base aprovados localmente, sem atestação remota.
- [ ] RLS, grants, FKs compostas e Storage passam na matriz Clínica A × Clínica B.
- [ ] JWT de membership desativada perde acesso imediatamente.
- [ ] Conectores usam escopos mínimos, secrets seguros, allowlists e fixtures aprovadas.
- [ ] Captura multipartes é atômica no domínio; quarentena, manifesto e reconciliação foram testados para ausência, duplicidade, divergência, timeout e retry.
- [ ] Confirmações são invalidadas por mudança de snapshot e ações não avançam sem recibo.
- [ ] CLI funciona integralmente antes da observabilidade e da UI.
- [ ] `lint`, `typecheck`, `test`, `build` e `check:predeploy` verdes.
- [ ] Security/Performance Advisors sem findings críticos ou altos relacionados.
- [ ] Veredito formal de `@qa` em staging sintético.
- [ ] Existe story específica aprovada para qualquer futura alteração de banco, acesso a dado real, promoção, prontuário, envio ou publicação.
- [ ] Confirmação explícita e just-in-time do Dr. Anderson foi obtida para a ação crítica exata; aprovação deste ADR/story não é reutilizada como consentimento operacional.

Até o fechamento de **todos** esses gates, é permitido apenas especificar, implementar e testar localmente com dados exclusivamente sintéticos dentro de uma story autorizada. Não existe exceção por “teste controlado”, autorização genérica, ambiente autenticado ou gate parcial. Não é permitido consultar/capturar dados reais, alterar ambiente remoto ou produção, promover/anexar ao prontuário, enviar mensagens ou publicar.

## 16. Decisões posteriores necessárias

1. `@sm`/`@po`: formalizar a story e a rastreabilidade FR/NFR/CON.
2. Data Governance/DPO: aprovar a política completa descrita na seção 13, incluindo finalidade, controlador/operadores, subprocessadores, transferências, direitos, incidentes, auditoria e backups.
3. `@data-engineer`: propor schema físico, constraints compostas, índices e migrations forward.
4. Security: aprovar OAuth/scopes, secret management, allowlists, quarentena e threat model detalhado.
5. `@architect`: definir o contrato de promoção ao prontuário e eventual convergência com `laudos_pdf`.
6. `@qa`: definir e emitir o veredito dos gates de staging.
7. Produto/owner: aprovar separadamente cada capacidade futura de anexação e comunicação.

## 17. Relação com decisões existentes

- **ADR-001 permanece vigente:** clínica é o tenant; membership é a autoridade; admin não é global; Storage e relações precisam provar o mesmo tenant; dados reais continuam NO-GO até os gates.
- **ADR-002 permanece vigente:** migrations são append-only; achados atuais serão corrigidos somente por novas migrations, após reconciliação e story aprovada.
- **Este ADR prevalece para a nova ingestão:** nenhum original do `exam_ingestion` entra no ciclo automático de descarte do pipeline legado.
