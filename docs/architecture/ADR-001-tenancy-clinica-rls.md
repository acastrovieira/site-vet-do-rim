# ADR-001 — Tenancy por clínica e autorização RLS

- **Status:** Aprovado (owner, 2026-07-18) — defaults registrados
- **Data:** 2026-07-16
- **Responsáveis pela decisão:** Architect / DB Security
- **Story:** `AUDIT-001`
- **Escopo:** Auth, PostgreSQL, Data API, Storage, Edge Functions, rotas Next.js e tipos
- **Natureza deste documento:** desenho não executável; nenhuma migration ou alteração remota foi aplicada

## 1. Decisão executiva

O limite de isolamento será a **clínica**, identificado por `clinic_id`. Usuários profissionais acessarão dados somente por meio de uma membership ativa naquela clínica. `profiles.role`, `colaboradores.nivel_acesso`, um prefixo de arquivo ou um claim enviado pelo cliente não serão fontes suficientes de autorização.

Cada registro clínico ou identificável deverá pertencer a exatamente uma clínica. Esse vínculo será armazenado diretamente nas tabelas operacionais e protegido também por constraints relacionais compostas, evitando que RLS correta conviva com relações cruzadas incorretas.

A implantação seguirá obrigatoriamente:

`expand → backfill revisado → validação → enforcement → contract`

Não haverá migração big-bang, preenchimento automático sem evidência ou rollback para policies globais. Enquanto o enforcement e os testes Vet A × Vet B não estiverem aprovados, o produto permanece **NO-GO para dados reais multi-tenant**.

## 2. Contexto e evidências do estado atual

### 2.1 Requisito já existente

O PRD exige pacientes isolados por veterinário e RLS zero-trust (`docs/prd/VETDORIM_PRD_ECOSYSTEM.md:117-139`) e condiciona o lançamento a um teste no qual o usuário A não obtém o paciente do usuário B (`docs/prd/VETDORIM_PRD_ECOSYSTEM.md:180-186`). A clínica como tenant preserva esse requisito e permite trabalho em equipe sem transferir a propriedade clínica ao trocar o veterinário responsável.

### 2.2 Ausência de fronteira de tenant

- `tutores` contém PII, mas não possui `clinic_id`, `owner_id` ou `created_by` (`supabase/migrations/20260531000000_full_schema_setup.sql:58-71`).
- `pets` depende somente de `tutor_id`; também não possui tenant (`supabase/migrations/20260531000000_full_schema_setup.sql:87-100`).
- `colaboradores` tem `supabase_uid`, `nivel_acesso` e `ativo`, porém o e-mail é globalmente único e não existe clínica (`supabase/migrations/20260531000000_full_schema_setup.sql:116-129`).
- `laudos_pdf` guarda `pet_id`, `vet_id` e um caminho fornecido pela aplicação, mas não guarda clínica (`supabase/migrations/20260531000000_full_schema_setup.sql:143-156`).
- `triagens` e `follow_ups` foram criados sem tenant (`supabase/migrations/20260623000200_schema_drift_completion.sql:14-50`).
- Os tipos declarados repetem essa ausência e registram `Relationships: []`, inclusive para tabelas que possuem FKs (`web/src/types/database.ts:61-236`).

Consequência: não há informação suficiente para provar a qual clínica pertencem todos os registros legados. Um backfill automático seria uma invenção e pode atribuir PII ao tenant errado.

### 2.3 Policies autenticam o papel, mas não autorizam a linha

- O hardening atual permite que qualquer perfil `vet` ou `admin` leia e altere todos os tutores e pets (`supabase/migrations/20260623000100_auth_rls_hardening.sql:106-172`).
- O mesmo padrão global foi aplicado a `triagens` e `follow_ups` (`supabase/migrations/20260623000200_schema_drift_completion.sql:58-116`).
- O tratamento de laudos limita o registro ao `vet_id`, mas o admin continua global e o vínculo do pet não é validado contra um tenant (`supabase/migrations/20260623000100_auth_rls_hardening.sql:174-217`).
- O script operacional legado recria `USING (true)` / `WITH CHECK (true)` para tutores e pets (`supabase/apply-rls.js:21-48`), e outro script pode reabrir leitura global de laudos e Storage (`supabase/fix-laudos-storage.sql:7-20,35-50`).

Esse desenho evita acesso de tutor às tabelas profissionais, mas não evita BOLA/IDOR entre profissionais.

### 2.4 Autorização duplicada na aplicação

- O acesso ao Lab é decidido por `profiles.role` no layout (`web/src/app/lab/layout.tsx:21-31`) e no proxy (`web/src/proxy.ts:77-103`), sem membership ou clínica ativa.
- As rotas criam tutores e pets sem tenant (`web/src/app/api/tutores/route.ts:56-69`; `web/src/app/api/pets/route.ts:68-81`).
- Updates filtram apenas pelo UUID recebido (`web/src/app/api/tutores/[id]/route.ts:83-88`; `web/src/app/api/pets/[id]/route.ts:103-108`). RLS deverá continuar sendo a autoridade, mas a API também precisa filtrar explicitamente o tenant como defesa em profundidade.
- A UI de laudos escolhe o caminho, envia `vet_id` e insere o registro diretamente (`web/src/components/lab/LaudoUploader.tsx:161-199`).
- A Edge Function usa um cliente `service_role` para consultar, alterar e baixar o laudo; a checagem explícita atual depende de `vet_id` e do prefixo do caminho (`supabase/functions/parse-laudo/index.ts:397-469`). `service_role` ignora RLS, portanto a segurança depende integralmente dessas verificações manuais.

### 2.5 Data API e mudança atual da plataforma

`public` e `graphql_public` estão expostos pela configuração local (`supabase/config.toml:7-24`). O Supabase diferencia explicitamente:

1. `GRANT`, que decide se o papel alcança o objeto pela Data API; e
2. RLS, que decide quais linhas são alcançadas.

O changelog foi revisado em 2026-07-16. A mudança relevante é a retirada gradual dos grants automáticos para novos objetos: projetos novos já adotam exposição opt-in e a mudança alcançará projetos existentes em 2026-10-30. O desenho, portanto, exige grants explícitos e não pressupõe defaults históricos.

Fontes oficiais atuais:

- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Storage ownership](https://supabase.com/docs/guides/storage/security/ownership)
- [Breaking change: tabelas não expostas automaticamente](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)

## 3. Modelo de autorização decidido

### 3.1 Entidades novas

| Entidade | Campos conceituais mínimos | Regra |
|---|---|---|
| `clinics` | `id`, nome, status, timestamps | Uma clínica ativa é a raiz do tenant. Não há criação ou exclusão direta pelo browser. |
| `clinic_memberships` | `clinic_id`, `user_id`, papel, status, timestamps, autor da alteração | Chave única `(clinic_id, user_id)`. É a única fonte de papel profissional por tenant. |
| `private.tenant_backfill_manifest` | entidade, registro, clínica proposta, origem da evidência, hash/lote, revisor, decisão e timestamp | Não exposto à Data API. Torna o backfill reproduzível e auditável. |

Papéis de membership inicialmente admitidos:

- `clinic_admin`: administra aquela clínica e sua equipe; não é admin global;
- `vet`: trabalha nos dados clínicos daquela clínica;
- `recepcao`: acesso mínimo a dados cadastrais; acesso clínico começa negado e depende de decisão explícita de Produto/Compliance.

`tutor` continua sendo um tipo de conta, não uma membership profissional. Uma futura exposição de dados ao tutor deve usar uma relação consentida e revogável entre conta, tutor e paciente; não deve reutilizar `clinic_memberships`.

### 3.2 Alterações conceituais nas tabelas existentes

| Tabela | Expansão | Invariante após enforcement |
|---|---|---|
| `tutores` | `clinic_id`, `created_by`, estado de arquivamento | Um tutor pertence a uma única clínica por registro. PII não existe sem tenant. |
| `pets` | `clinic_id`, `created_by` | `(clinic_id, tutor_id)` referencia o tutor da mesma clínica. |
| `triagens` | `clinic_id`, `created_by` | Pet e eventual tutor pertencem à mesma clínica. |
| `follow_ups` | `clinic_id`, `created_by` | A triagem referenciada pertence à mesma clínica. |
| `laudos_pdf` | `clinic_id`, `created_by`, caminho canônico imutável | Pet, metadado e objeto pertencem à mesma clínica. `vet_id` pode permanecer temporariamente como atribuição, nunca como fronteira única. |
| `colaboradores` | `clinic_id`; reconciliação com membership | O e-mail deixa de ser globalmente único e passa a ser único dentro da clínica. `nivel_acesso` não autoriza RLS. |
| `profiles` | nenhum tenant obrigatório | Perfil é global à pessoa. `role` fica apenas como compatibilidade/navegação durante a transição e não autoriza dados clínicos. |

Cada relação filha usará uma constraint composta pelo tenant e pelo identificador pai. Para isso, cada tabela pai terá uma chave/unique auxiliar em `(clinic_id, id)`. O objetivo é impedir no próprio banco operações como “Pet da Clínica A apontando para Tutor da Clínica B”, mesmo quando um cliente manipula UUIDs válidos.

### 3.3 Invariantes de segurança

1. Toda linha com PII, dado clínico ou comunicação possui exatamente um `clinic_id` não nulo.
2. Toda leitura ou mutação clínica exige usuário autenticado, clínica ativa e membership ativa naquela mesma clínica.
3. O tenant de uma linha é imutável para papéis da Data API; transferências exigem workflow administrativo auditado.
4. Um papel administrativo vale somente dentro da clínica de sua membership. Não existe `OR profiles.role = 'admin'` nas policies clínicas.
5. Desativar uma membership revoga acesso imediatamente, inclusive para JWT ainda válido, porque a autorização consulta o banco e não depende de claim em cache.
6. `raw_user_meta_data`, cookies, parâmetros, headers e campos do body são dados não confiáveis. Podem indicar contexto, mas nunca conceder acesso.
7. `service_role` nunca é enviado ao browser e não substitui autorização do usuário em uma Edge Function.
8. Um caminho de Storage não prova autorização. O objeto deve estar associado a um `laudos_pdf` autorizado.
9. Updates usam predicado sobre a linha existente e sobre a linha resultante; a operação também possui policy de SELECT correspondente.
10. Excluir dados clínicos não é uma operação CRUD comum. O padrão é arquivar; purge segue retenção, LGPD, auditoria e aprovação própria.

## 4. RLS e matriz de acesso

### 4.1 Helpers privados

As policies usarão helpers pequenos no schema `private`, com estes contratos:

- verificar `auth.uid()` não nulo;
- confirmar clínica e membership ativas;
- opcionalmente exigir um conjunto de papéis;
- usar nomes totalmente qualificados e `search_path` vazio/fixo;
- não aceitar o usuário como argumento controlável;
- ser `STABLE` e sem SQL dinâmico;
- revogar execução de `PUBLIC` e `anon`; conceder somente o necessário a `authenticated`;
- permanecer fora dos schemas expostos.

Se um helper precisar de `SECURITY DEFINER` para evitar recursão da RLS de memberships, seu owner será controlado, a função terá checks internos de `auth.uid()` e passará pelo Security Advisor. Nenhuma função privilegiada será criada em `public` para “resolver” erro de permissão.

Não serão usados claims de clínica no JWT como fonte primária. Além do risco de claim desatualizado, um usuário pode pertencer a várias clínicas. Claims podem futuramente otimizar UX, mas a policy continua consultando membership ativa.

### 4.2 Matriz inicial de menor privilégio

| Recurso/operação | `clinic_admin` | `vet` | `recepcao` | Tutor/anon |
|---|---:|---:|---:|---:|
| Clínica — leitura | própria | própria | própria | negar |
| Membership — leitura | própria clínica | somente própria | somente própria | negar |
| Membership — mutação | API administrativa auditada | negar | negar | negar |
| Tutores/pets — leitura/criação/edição | permitir no tenant | permitir no tenant | permitir somente dados cadastrais aprovados | negar |
| Triagens/follow-ups | permitir no tenant | permitir no tenant | negar por padrão | negar |
| Laudo e resultado | permitir no tenant | permitir no tenant | negar | negar |
| Hard delete/purge | workflow auditado | negar | negar | negar |
| Alterar `clinic_id`, `created_by`, quota, resultado ou status interno | negar direto | negar direto | negar | negar |

Permissões de recepção que toquem observação clínica, comunicação ou opt-out precisam de decisão funcional antes da implementação; o default seguro é negar.

### 4.3 Regras por tabela

- `clinics`: membro ativo enxerga sua clínica; somente workflow administrativo altera dados sensíveis ou status.
- `clinic_memberships`: usuário enxerga sua própria membership; `clinic_admin` pode listar sua equipe. INSERT/UPDATE/DELETE direto fica revogado. A API de administração deve impedir autoelevação, alteração entre tenants e remoção do último admin ativo.
- tabelas clínicas: SELECT/INSERT/UPDATE exigem membership e papel compatível em `row.clinic_id`. UPDATE também exige que o tenant permaneça igual.
- relações: a RLS não substitui FK composta. As duas proteções são obrigatórias.
- hard delete: sem grant direto para `authenticated`; quando necessário, passa por operação transacional com trilha de auditoria.
- `profiles`: leitura própria; edição somente de colunas pessoais permitidas. Papel, quota e campos administrativos continuam fora da edição do usuário.
- views: somente `security_invoker = true`; caso contrário, permanecem fora da Data API.

## 5. Grants e superfície da Data API

O projeto já declara `public` como schema exposto. O rollout deve adotar estes princípios:

- `anon`: nenhum grant em tabelas de clínica, memberships, PII, dados clínicos ou laudos;
- `authenticated`: grants explícitos somente para operações exigidas pela aplicação, sempre acompanhados de RLS;
- mutações administrativas, mudança de tenant, status interno de IA e purge: sem grant direto; usar contratos estreitos e auditados;
- `service_role`: somente em processos server-side inventariados; nunca como variável pública;
- funções: default `EXECUTE` revogado de `PUBLIC`; concessões listadas função por função;
- novos objetos: default privileges revogados e grants declarados na mesma mudança que RLS;
- Security Advisor e catálogo de grants devem provar que não existe objeto clínico exposto por acidente.

Os grants existentes devem ser inventariados no ambiente remoto antes da primeira migration. O repositório não contém prova suficiente do estado real do catálogo.

## 6. Integração com aplicação e APIs

### 6.1 Seleção de clínica

O contexto ativo será resolvido no servidor:

1. usuário sem membership profissional ativa não entra no Lab;
2. uma única membership ativa pode ser selecionada automaticamente;
3. várias memberships exigem seletor de clínica;
4. o identificador escolhido pode ser guardado em cookie HttpOnly ou URL, mas é apenas uma preferência não confiável;
5. cada request revalida a membership no banco.

`profiles.role` deixa de controlar `/lab` e `/admin`. Layout, proxy e gates consultam memberships. O proxy melhora a UX, mas RLS permanece a barreira real.

### 6.2 Rotas Next.js

Todas as consultas e mutações devem:

- receber ou resolver uma clínica ativa;
- filtrar explicitamente `clinic_id` além de depender da RLS;
- ignorar `clinic_id`, `created_by`, `vet_id` ou status privilegiado enviados pelo body quando esses valores devem vir do contexto autenticado;
- validar FKs no mesmo tenant;
- devolver `404` para UUID de outro tenant, evitando confirmar a existência do registro;
- devolver contratos estáveis, sem detalhes internos de RLS, schema ou Storage;
- usar operação transacional quando uma ação toca pet, triagem e follow-up.

As mutações client-side diretas em `TutorPetActions` e `LaudoUploader` devem migrar para APIs/RPCs estreitos antes do enforcement. O cliente pode continuar usando a chave pública e o JWT, mas não define a autoridade.

### 6.3 Edge Function `parse-laudo`

O desenho alvo separa dois contextos:

- um cliente com JWT do usuário para provar, via RLS/RPC, a membership e o acesso ao laudo;
- um cliente privilegiado apenas onde a operação interna realmente exigir, depois da autorização e com `laudoId` já vinculado ao tenant.

O claim do trabalho deve ser atômico e idempotente. A transação valida tenant, status, quota e ator, marca processamento e retorna o caminho canônico. A finalização também deve validar o mesmo claim. Um `laudoId` da Clínica B enviado por Vet A deve se comportar como inexistente, não baixar arquivo, não alterar status e não consumir quota.

### 6.4 Tipos

`web/src/types/database.ts` não deve continuar como uma cópia manual rotulada como “gerada”. Depois de cada migration aprovada, os tipos devem ser regenerados a partir do schema do ambiente efêmero e o diff precisa incluir `clinic_id`, FKs, funções e relações reais. Typecheck verde com tipos manuais não comprova alinhamento de schema.

## 7. Storage de laudos

### 7.1 Contrato alvo

1. A aplicação reserva o laudo por uma operação server-side autorizada.
2. O servidor gera `laudoId` e caminho canônico imutável, por exemplo conceitual `clinics/{clinic_id}/laudos/{laudo_id}/original.pdf`.
3. O upload somente é aceito se já existir a reserva correspondente e o ator for membro autorizado da clínica.
4. SELECT/download verifica a linha de `laudos_pdf` associada ao `storage.objects.name`; prefixo ou `owner_id` isoladamente não bastam.
5. `upsert` fica desabilitado; UPDATE de objeto não é concedido por padrão.
6. DELETE segue retenção e workflow auditado. Signed URLs, quando usadas, só são geradas após autorização e têm duração curta.

A policy atual baseada na primeira pasta do `auth.uid()` (`supabase/migrations/20260623000100_auth_rls_hardening.sql:219-251`) impede leitura entre usuários, mas também impede colaboração normal na clínica. A autorização por laudo + membership substitui essa limitação sem abrir o bucket globalmente.

### 7.2 Objetos legados

Objetos existentes não serão movidos durante `expand`. Primeiro, `laudos_pdf.storage_path` será reconciliado com `storage.objects.name`, tamanho e checksum. A mudança para o caminho canônico será feita por cópia, verificação de integridade e cutover. O original só poderá ser removido depois do período de segurança e da aprovação de retenção; falha em qualquer verificação preserva o objeto antigo.

## 8. Plano de rollout reversível

### Fase 0 — Descoberta e contenção

- congelar onboarding multi-tenant e deploy de scripts RLS manuais;
- retirar `supabase/apply-rls.js` e `supabase/fix-laudos-storage.sql` de qualquer runbook executável, sem apagá-los antes de preservar histórico;
- exportar somente metadados seguros do catálogo remoto: tabelas, FKs, RLS, policies, grants, funções, buckets e contagens;
- confirmar projeto/ambiente, versão do Postgres e migrations efetivamente aplicadas;
- gerar backup e executar restore em ambiente isolado;
- aprovar matriz de papéis, política de retenção e dono de cada lote legado.

**Gate:** nenhuma migration é escrita antes da reconciliação local × remoto e da aprovação deste ADR.

### Fase 1 — Expand

- criar `clinics`, `clinic_memberships` e manifesto privado;
- adicionar `clinic_id` e campos de auditoria como nullable nas tabelas existentes;
- criar índices de suporte sem remover índices atuais;
- adicionar chaves/constraints novas inicialmente validáveis sem bloquear dados legados; constraints compostas entram como não validadas quando aplicável;
- publicar uma versão de aplicação capaz de escrever tenant e ler registros antigos apenas no ambiente controlado;
- habilitar telemetria de linhas sem tenant e falhas de resolução, sem registrar PII.

Durante esta fase, nenhuma nova clínica recebe dados reais. Policies globais antigas ainda tornam o estado incompatível com multi-tenancy.

**Rollback:** desabilitar a feature flag e voltar à versão anterior. Objetos novos permanecem sem uso; não se apagam dados legados.

### Fase 2 — Backfill revisado

- criar candidatos de membership usando `colaboradores.supabase_uid`, `ativo` e `nivel_acesso`, mas exigir revisão; `profiles.role` não é prova suficiente;
- atribuir cada registro por meio do manifesto, com fonte, revisor e lote;
- uma clínica padrão só pode receber todos os dados legados se o responsável confirmar formalmente que o acervo inteiro pertence a ela;
- `laudos_pdf.vet_id` é evidência auxiliar, não prova de que tutor/pet pertence a uma clínica específica;
- registros ambíguos permanecem sem tenant e entram em quarentena fail-closed;
- reconciliar contagens pai/filho, duplicidades, FKs, objetos órfãos e checksums de Storage;
- executar o backfill em lotes idempotentes e reexecutáveis.

**Gate:** zero divergência entre manifesto aprovado e linhas preenchidas; zero relação cruzada; 100% dos registros ativos classificados ou explicitamente em quarentena.

**Rollback:** reverter somente os valores do lote pelo identificador/hash do manifesto. Não apagar linhas nem objetos.

### Fase 3 — Validação

- validar constraints compostas e índices;
- executar matriz Vet A × Vet B em SQL/Data API, rotas, UI, Storage e Edge Function;
- medir planos de consulta das policies e limites de paginação;
- rodar reset do banco apenas em Supabase local/efêmero, nunca no ambiente com dados reais;
- executar Security Advisor e comparar grants/policies com allowlist versionada;
- realizar canário com dados sintéticos e logging sem PII.

**Gate:** todos os testes negativos e positivos passam; nenhum finding de segurança crítico/alto; rollback ensaiado.

### Fase 4 — Enforcement

- ativar modo manutenção/read-only curto e drenar mutações;
- substituir policies globais por policies de membership em uma mudança atômica;
- aplicar grants explícitos mínimos;
- tornar `clinic_id` obrigatório nas linhas não quarantinadas e impedir sua alteração direta;
- ativar as FKs compostas e o acesso de Storage por reserva/laudo;
- publicar a versão da aplicação que exige clínica ativa;
- executar smoke tests A/B imediatamente e monitorar negações.

**Rollback seguro:** manter o schema expandido e trocar para modo read-only/fail-closed, retornando somente a uma versão anterior que também entenda tenant. É proibido restaurar `USING (true)` ou admin global para recuperar disponibilidade.

### Fase 5 — Contract

Somente após período de estabilidade e aprovação:

- remover paths e writes de compatibilidade;
- retirar `profiles.role` e `colaboradores.nivel_acesso` das decisões de autorização;
- substituir a unicidade global de `colaboradores.email` pela unicidade por clínica;
- remover grants e funções obsoletas;
- arquivar scripts manuais perigosos;
- migrar objetos para caminhos canônicos e, após retenção, tratar cópias antigas;
- regenerar tipos e documentação operacional final.

**Rollback:** contract não começa sem backup restaurável e sem uma janela definida de rollback de dados/Storage. Alterações destrutivas ficam em migrations separadas e exigem confirmação explícita.

## 9. Plano de testes Vet A × Vet B

### 9.1 Fixtures mínimas

| Fixture | Membership |
|---|---|
| Vet A | ativa somente na Clínica A |
| Vet B | ativa somente na Clínica B |
| Admin A | `clinic_admin` somente na Clínica A |
| Recepção A | ativa somente na Clínica A |
| Vet AB | ativa em A e B, alternando clínica explicitamente |
| Vet A inativo | membership A desativada, sessão/JWT ainda existente |
| Tutor | sem membership profissional |

Cada clínica terá tutor, pet, triagem, follow-up, laudo e objeto com nomes semelhantes, evitando testes que passam por diferença de nome em vez de autorização.

### 9.2 Matriz obrigatória

| Caso | Ação de Vet A | Resultado obrigatório |
|---|---|---|
| Listagem | listar tabelas clínicas | somente linhas A; nenhuma linha B |
| Acesso direto | consultar UUID B | zero linha / `404`, sem revelar existência |
| Insert spoofado | criar com `clinic_id = B` | negar; nenhuma linha criada |
| FK cruzada | criar Pet A com Tutor B | negar por RLS e/ou FK composta |
| Update cruzado | alterar registro B por UUID | zero linha / `404`; estado B idêntico |
| Transferência | mudar `clinic_id` de A para B | negar |
| Delete | excluir registro B | negar; estado e auditoria inalterados |
| Relações | consultar pet A e tentar obter tutor/laudo B | negar em todos os joins/requests |
| Desativação | acessar A com membership inativa e JWT antigo | negar imediatamente |
| Multi-clínica | Vet AB seleciona A e depois B | vê exatamente um tenant por contexto; sem mistura |
| Storage list/read | listar ou baixar objeto B | negar; nenhum signed URL emitido |
| Storage upload | enviar para path B ou laudo inexistente | negar; nenhum objeto órfão |
| Storage delete | remover objeto B | negar |
| Edge Function | processar `laudoId` B | `404` lógico/seguro; sem download, status ou quota alterados |
| Papel | tutor/anon tenta acessar Lab/Data API | negar |
| Admin | Admin A consulta B | negar; admin não é global |

### 9.3 Camadas de teste

1. **Banco:** testes transacionais das policies, grants, helpers e constraints com contexto JWT controlado.
2. **Data API/Supabase JS:** usuários Auth reais no projeto efêmero; operações positivas e negativas por tabela.
3. **Storage:** upload, list, download, delete e tentativa de path traversal/cross-tenant.
4. **Edge Function:** autorização, idempotência e invariantes de estado/quota.
5. **Next.js:** APIs retornam `404` cross-tenant e páginas nunca renderizam PII de outro tenant.
6. **E2E:** seletor de clínica e fluxos completos em desktop, tablet e celular.

O teste atual cria papéis `admin`, `vet` e `tutor`, mas não cria duas clínicas ou prova isolamento (`web/scripts/e2e-auth-rls-cycle.mjs:25-68,114-151`). Ele continua útil para navegação por papel, porém não satisfaz este gate.

## 10. Gates de aprovação

- [ ] ADR e matriz de papéis aprovados por Produto, Security e responsável clínico.
- [ ] Catálogo remoto reconciliado com migrations, sem segredos nos artefatos.
- [ ] Backup restaurado com sucesso em ambiente isolado.
- [ ] Reset completo das migrations em projeto efêmero.
- [ ] Todos os objetos expostos possuem RLS e grants explícitos mínimos.
- [ ] Nenhuma policy clínica contém `USING (true)`, `WITH CHECK (true)` ou admin global.
- [ ] `clinic_id` indexado nas tabelas e helpers medidos com volume representativo.
- [ ] FKs compostas validadas; zero referência cross-tenant.
- [ ] Backfill 100% rastreável por manifesto; ambiguidades em quarentena.
- [ ] Vet A × Vet B passa em todas as camadas, incluindo Storage e Edge Function.
- [ ] Desativação de membership bloqueia JWT já emitido.
- [ ] Tipos regenerados a partir do schema e typecheck/build verdes.
- [ ] Security/Performance Advisors sem findings críticos ou altos relacionados.
- [ ] Rollback fail-closed ensaiado; nunca depende de reabrir acesso global.
- [ ] Retenção, purge, trilha de auditoria e resposta a incidente aprovados.

## 11. Ameaças tratadas

| Ameaça | Controle decidido |
|---|---|
| BOLA/IDOR por UUID | RLS por membership + filtro de tenant + `404` + teste negativo |
| Relação pai/filho cruzada | FK composta incluindo `clinic_id` |
| Elevação por `profiles.role`/metadata | membership no banco como autoridade; metadata ignorada |
| Admin global acidental | papel administrativo sempre associado a uma clínica |
| Membership desativada com JWT válido | lookup de membership em tempo de query |
| Path de Storage forjado | reserva server-side + vínculo exato objeto/laudo/tenant |
| Bypass por Edge Function | autorização com contexto do usuário antes do cliente privilegiado |
| Exposure por defaults | grants explícitos e default privileges revogados |
| Backfill atribuído ao tenant errado | manifesto, revisão humana e quarentena fail-closed |
| Rollback inseguro | modo read-only/fail-closed; nunca restaurar policy global |

## 12. Alternativas rejeitadas

### `owner_vet_id` como única fronteira

Rejeitada como modelo final porque impede continuidade por equipe, recepção, troca do veterinário responsável e atuação em mais de uma clínica. `created_by`/`vet_id` continua útil para atribuição e auditoria, não para tenant.

### Claim `clinic_id` no JWT como autoridade

Rejeitada porque claims podem ficar desatualizados até refresh e representam mal usuários multi-clínica. Membership no banco permite revogação imediata.

### `profiles.role = admin` com acesso global

Rejeitada por violar menor privilégio. Suporte de plataforma, se necessário, deve ser um workflow separado, temporário, auditado e fora das policies clínicas normais.

### Prefixo `auth.uid()` como autorização de Storage

Rejeitada como regra final porque usuário e clínica não são equivalentes e um path não comprova vínculo com o paciente/laudo.

### Todas as operações por `service_role`

Rejeitada porque desloca a segurança de RLS para checks manuais em cada endpoint e aumenta o impacto de uma falha.

### Migration big-bang

Rejeitada porque o schema legado não contém evidência suficiente para backfill automático e porque mistura mudança estrutural, atribuição de PII e corte de acesso sem rollback seguro.

## 13. Decisões ainda exigidas antes da implementação

> **Registro do owner (Dr. Anderson, 2026-07-18):** aprovadas as três decisões que destravam a Fase 1: (a) tenant = clínica, com tutor/paciente NÃO compartilhado entre clínicas, recepção sem acesso clínico (fail-closed) e admin nunca global (itens 1–3 abaixo, defaults do ADR confirmados); (b) todo o acervo legado pertence a uma única clínica, "Vet do Rim", por confirmação formal do responsável, autorizando backfill single-clinic auditável via `private.tenant_backfill_manifest` (item 4); (c) aplicação remota somente após auditoria read-only (`npm run audit:staging`) e CI (Database Contract) verdes — o trabalho da Fase 1 permanece local.

1. Confirmar que “clínica” é a unidade comercial/legal de isolamento e quem pode criá-la.
2. Aprovar o papel da recepção em dados de triagem, follow-up e opt-out.
3. Definir se um tutor/paciente pode ser compartilhado entre clínicas; o default deste ADR é **não**.
4. Aprovar o responsável por cada lote legado e o critério documental de atribuição.
5. Definir retenção, arquivamento, purge, exportação LGPD e transferência clínica.
6. Definir UX de seleção para usuários com várias memberships.
7. Definir eventual acesso do tutor a pacientes por consentimento explícito.
8. Confirmar se existe necessidade real de suporte administrativo de plataforma e seu processo de acesso temporário.

Até essas decisões e os gates da seção 10 estarem fechados, este ADR autoriza somente planejamento e testes em ambiente efêmero; não autoriza SQL em produção.
