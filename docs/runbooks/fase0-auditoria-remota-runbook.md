# Runbook: Auditoria Remota Fase 0 (Tarefa 0.3 / P0-5)

> **Somente leitura.** Todo SQL executado por este runbook roda dentro de
> `BEGIN TRANSACTION READ ONLY; ... ROLLBACK;`, com `default_transaction_read_only=on`
> forçado na sessão do psql. Nenhum comando deste runbook altera dados, schema,
> privilégios ou secrets. As sugestões de correção ao final são **comentários SQL
> para revisão manual** — nunca são executadas por este processo.

## Objetivo

Responder, com evidência do banco remoto real, à pergunta deixada em aberto pela
auditoria de 2026-07-16 (P0-5): antes do hardening de 2026-06-23, o trigger
`handle_new_user` aceitava o papel (`role`) vindo de `raw_user_meta_data`, ou
seja, qualquer usuário podia se autocadastrar como `vet`/`admin`. É preciso
confirmar se existem perfis assim no projeto remoto, e se existem laudos ou
arquivos de Storage órfãos.

## Quem executa

Dr. Anderson (ou outro operador com a senha do Postgres do projeto de
**staging/homologação**, nunca produção com dados reais de pacientes). O
sandbox do agente que preparou este pacote não tem rede até o Supabase —
por isso a execução é manual, na máquina do operador.

## Pré-requisitos (uma vez só)

1. `psql` instalado e no `PATH` (`psql --version` deve funcionar).
2. Repositório clonado, dependências instaladas: `cd web && npm install`.
3. Arquivo `web/.env.local` preenchido a partir de `web/.env.example` com os
   valores **do projeto de staging** (nunca produção):
   - `SUPABASE_PROJECT_REF`, `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_ENVIRONMENT=staging`
   - `STAGING_AUDIT_CONFIRMATION=CONFIRM_STAGING_READ_ONLY:<project-ref>`
   - `SUPABASE_DB_HOST`, `SUPABASE_DB_USER`, `SUPABASE_DB_NAME`, `SUPABASE_DB_PORT`
   - `SUPABASE_DB_PASSWORD`
4. Confirme que está mesmo apontando para o projeto que você espera: o script
   recusa a execução se `SUPABASE_ENVIRONMENT` não for exatamente `staging`,
   se o host não for o host direto/pooler oficial do `SUPABASE_PROJECT_REF`, ou
   se a confirmação não bater com o project ref.

Se o projeto que guarda os dados reais dos usuários for tecnicamente o único
disponível (sem um staging separado), trate a execução com o mesmo cuidado de
produção: rode em horário de baixo uso e não compartilhe a saída fora do
círculo de confiança do projeto.

## Comando (1 linha)

Dentro de `web/`:

```powershell
npm run audit:staging -- --remote-read-only
```

Sem `-- --remote-read-only`, o comando roda em modo `--plan` (sem rede
nenhuma) e apenas lista os arquivos SQL que seriam executados — útil para
conferir o pacote antes de autorizar a execução real.

O script:
1. Valida todos os arquivos `web/scripts/staging-audit/sql/*.sql` localmente
   (cada um precisa começar com `BEGIN TRANSACTION READ ONLY;`, terminar com
   `ROLLBACK;` e não conter nenhuma palavra-chave de escrita/DDL).
2. Só então abre uma conexão `psql` com `PGOPTIONS` forçando
   `default_transaction_read_only=on`, `statement_timeout=15s` e
   `lock_timeout=3s`.
3. Executa os arquivos em ordem alfabética (`01` → `05`) e imprime a saída de
   cada um no terminal.
4. Para no primeiro arquivo que falhar (`exit 1`) — os arquivos seguintes não
   rodam.

## O que cada arquivo verifica

| Arquivo | Conteúdo | Isto é novo? |
|---|---|---|
| `01-catalog-inventory.sql` | Tabelas/colunas existentes, RLS ligada, migrations aplicadas | Não |
| `02-access-control.sql` | Grants por role, policies, funções `SECURITY DEFINER`, bucket `laudos` | Não |
| `03-aggregate-integrity.sql` | Contagens agregadas (sem PII) de perfis, laudos, integridade referencial | Não |
| `04-release-blocker-summary.sql` | Gate GO/NO-GO machine-readable (`SEC-001`...`SEC-012`) | Não |
| `05-role-escalation-audit.sql` | **Este runbook.** Lista nominal de perfis `vet`/`admin`, divergências com `colaboradores`, laudos/objetos órfãos, FKs lógicas quebradas em pets/triagens/follow_ups | **Sim** |

O arquivo `05` é o único que imprime colunas identificadoras (`email`,
`profile_id`, `laudo_id`, `storage_path`). Isso é intencional: sem um
identificador, ninguém consegue decidir o que fazer com o achado. Trate a
saída deste comando como dado sensível:
- não cole no Slack/WhatsApp/ticket público;
- não commit no repositório;
- se precisar registrar a decisão, registre o `profile_id` (UUID) e a
  conclusão, não o e-mail completo nem dados de paciente.

## Como ler a saída do arquivo 05

A saída aparece na ordem das consultas do arquivo
`web/scripts/staging-audit/sql/05-role-escalation-audit.sql`:

**(a) Contagem de perfis por role** — `profile_count`, `first_created_at`,
`last_created_at`, `created_before_auth_hardening` (quantos desses perfis
existem desde antes de 2026-06-23 00:01 UTC, quando o trigger `handle_new_user`
parou de confiar em `raw_user_meta_data`).
- **Esperado:** a maioria dos perfis é `tutor`. `vet`/`admin` deve bater com o
  número de profissionais que você sabe que existem.
- **Alerta:** contagem de `vet`/`admin` muito maior que o número de
  profissionais conhecidos.

**(b) Lista nominal de perfis `vet`/`admin`** — `profile_id`, `role`,
`profile_created_at`, `email`, `auth_user_created_at`,
`created_before_auth_hardening`, `metadata_role`, `metadata_requested_role`.
- **Esperado:** toda linha corresponde a um profissional que você reconhece.
  `metadata_role`/`metadata_requested_role` normalmente vêm `NULL` (o valor só
  existiria se alguém tivesse mandado esse campo no cadastro).
- **Alerta forte (revisar manualmente):** `created_before_auth_hardening = true`
  **e** `metadata_role` ou `metadata_requested_role` preenchido com `'vet'` ou
  `'admin'` — é o padrão exato de quem escalou o próprio papel explorando o
  bug do trigger antigo.
- **Alerta médio:** `email` que você não reconhece como profissional, mesmo
  sem metadata suspeita (pode ter sido promovido manualmente sem registro).

**(c) Perfis `vet`/`admin` sem `colaboradores` ativo correspondente** —
mesmas colunas de (b), mas apenas para quem não tem uma linha ativa
(`ativo = true`) em `public.colaboradores` com `supabase_uid` igual ao
`profile_id`.
- **Esperado:** vazio, ou só o(s) admin(s) fundador(es)/técnico(s) que
  deliberadamente não têm cadastro de colaborador (documente a exceção).
- **Alerta:** qualquer outra linha — é um papel elevado sem contrapartida de
  RH/cadastro de equipe.

**(d.1) `laudos_pdf` sem objeto correspondente no Storage** — laudo referencia
um `storage_path` que não existe no bucket `laudos`.
- **Ação:** provavelmente upload incompleto ou objeto removido manualmente.
  Cliente que tenta abrir o laudo vai receber erro; considerar reprocessar ou
  marcar o laudo com status de erro.

**(d.2) Objetos do bucket `laudos` sem `laudos_pdf` correspondente** — arquivo
existe no Storage mas nenhuma linha de `laudos_pdf` aponta para ele.
- **Ação:** candidato a limpeza (arquivo órfão consumindo espaço). Confirmar
  que não é um upload em andamento antes de remover.

**(e.1)–(e.4) Integridade lógica de `pets`/`triagens`/`follow_ups`** — pets sem
tutor válido, `triagens` cujo `tutor_id` diverge do tutor atual do pet,
`triagens` sem `pet_id` válido, `follow_ups` sem `triagem_id` válido.
- Como `pets.tutor_id`, `triagens.pet_id` e `follow_ups.triagem_id` têm FK
  `NOT NULL` com `ON DELETE CASCADE`, os itens (e.1), (e.3) e (e.4) **deveriam
  estar sempre vazios**; qualquer linha aqui indica dado inserido fora do
  caminho normal da aplicação (ex.: script manual, migração antiga) e merece
  investigação antes de mexer no schema de tenancy da Fase 1.
- (e.2) é o único caso esperado eventualmente (reatribuição legítima de pet a
  outro tutor deixa `triagens` antigas com o tutor anterior) — revisar caso a
  caso, não é necessariamente um bug.

## Critérios de decisão

1. **Nenhum achado em (b)/(c) fora do esperado:** documentar "auditoria
   executada em `<data>`, sem perfis de escalada não reconhecidos" e seguir
   para a Fase 1 do plano de ação.
2. **Perfil elevado não reconhecido, com sinal de escalada em (b):**
   1. Confirmar com a equipe que ninguém autorizou aquele e-mail como
      vet/admin.
   2. Se confirmado como não autorizado, rebaixar o perfil **manualmente**,
      revisando cada UUID individualmente. Sugestão de SQL (NÃO faz parte de
      nenhum script automático — copie, adapte o UUID, revise e rode você
      mesmo no SQL Editor do Supabase ou via `psql` com uma sessão separada,
      **fora** deste runbook read-only):

      ```sql
      -- SUGESTÃO — REVISAR E EXECUTAR MANUALMENTE, UM UUID DE CADA VEZ.
      -- Não faz parte do pacote de auditoria; não é executado automaticamente.
      -- BEGIN;
      -- UPDATE public.profiles
      --   SET role = 'tutor'
      --   WHERE id = '00000000-0000-0000-0000-000000000000'; -- <profile_id confirmado>
      -- Confira 1 linha afetada antes de prosseguir, depois:
      -- COMMIT; -- ou ROLLBACK; se algo não bater
      ```

      Observação: o trigger `prevent_profile_privilege_escalation` (ver
      `supabase/migrations/20260623000100_auth_rls_hardening.sql`) só bloqueia
      o próprio usuário autenticado tentando mudar seu `role` via API/RLS —
      ele **não** impede um operador com acesso direto ao Postgres (Dashboard
      SQL Editor ou `psql` com a senha do banco) de rodar o `UPDATE` acima.
      Por isso a sugestão funciona, mas também por isso ela precisa ser
      revisada por um humano antes de rodar — não existe um "desfazer"
      automático.
   3. Depois do rebaixamento, force o usuário a reautenticar (revogar sessões
      no Dashboard de Auth) para que o `role` antigo não fique em cache no
      cliente.
   4. Registrar a decisão (UUID, data, motivo) em um lugar que **não** seja
      o repositório de código público.
3. **Achados em (c) sem escalada óbvia em (b):** tratar como pendência de
   cadastro, não necessariamente de segurança — criar/associar o registro de
   `colaboradores` correspondente, ou remover o papel elevado se a pessoa não
   for mais staff.
4. **Achados em (d.1)/(d.2):** registrar a lista, decidir caso a caso
   (reprocessar laudo vs. marcar erro vs. remover objeto órfão). Não há SQL de
   remoção sugerido aqui de propósito — remoção de Storage é uma operação
   distinta (ver P1-3 do plano de ação, compensação determinística de
   Storage) e não deve ser feita ad hoc a partir desta auditoria.
5. **Achados em (e.1)/(e.3)/(e.4):** bloqueante para a Fase 1 (tenancy) — um
   dado com FK logicamente quebrada antes de introduzir `clinic_id` pode
   quebrar o backfill. Investigar a origem antes de prosseguir para a Fase 1.

## Depois de rodar

- Se o arquivo `04-release-blocker-summary.sql` reportar `NO-GO`, isso é
  **esperado no estado atual do projeto** (ver
  `docs/auditoria-completa-plano-acao-2026-07-18.md`, P0-1 a P0-4) e não é
  causado por este runbook — não é motivo para interromper a auditoria dos
  demais arquivos.
- Guarde a decisão tomada para cada achado do arquivo `05` fora do
  repositório de código (ex.: ticket interno, documento de auditoria com
  acesso restrito), citando apenas UUIDs — nunca cole e-mails, CPFs ou dados
  clínicos em canais que não sejam estritamente controlados.
