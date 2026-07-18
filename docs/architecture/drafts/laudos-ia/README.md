# Draft de arquitetura — processamento idempotente de laudos por IA

> **QUARENTENA — NÃO APLICAR.** Estes arquivos são material de projeto da story `AUDIT-001`. Eles não pertencem a `supabase/migrations`, não autorizam alteração local/remota e não foram executados contra banco algum.

## Objetivo e conclusão da auditoria

O fluxo atual não oferece uma unidade transacional para reservar processamento, controlar concorrência, consumir ou compensar cota e persistir o resultado. O desenho desta pasta propõe três operações estreitas — `claim`, `finalize` e `refund` — que mantêm as chamadas externas à IA fora da transação e tornam as alterações de banco curtas, atômicas e idempotentes.

O material é deliberadamente um **draft bloqueado**. O schema real ainda não possui `clinics`, `clinic_memberships` nem `clinic_id` em `laudos_pdf`, `pets` e demais entidades. Esses elementos pertencem ao ADR proposto de tenancy e não podem ser presumidos em uma migration ativa.

## Evidência do estado real

| Superfície | Estado observado | Consequência |
|---|---|---|
| `public.laudos_pdf` | `pet_id`, `vet_id`, `storage_path`, quatro estados (`pendente`, `processando`, `concluido`, `erro`), resultado e erro; sem `clinic_id` | Não há contexto de clínica suficiente para autorizar ou derivar o caminho canônico. |
| `public.profiles` | `ai_quota_limit`, `ai_quota_used`, `ai_quota_reset_date` | A cota é por usuário, mas o ciclo/reset e eventual cobrança por clínica não estão definidos. |
| `public.increment_ai_quota(uuid)` | Incremento atômico posterior ao resultado, `SECURITY DEFINER` em `public` | Concorrência pode iniciar chamadas além da cota; falha depois de gravar resultado deixa estado e quota divergentes. |
| `LaudoUploader` | Browser escolhe o path, faz upload, insere `laudos_pdf` e depois invoca IA | O cliente ainda define `vet_id` e `storage_path`; não existe reserva server-side do objeto. |
| `parse-laudo` | Autentica com `auth.getUser`, valida `vet_id`/prefixo e usa atualizações condicionais por `vet_id` e estado para adquirir/finalizar o laudo | O compare-and-set atual reduz processamento duplicado do mesmo laudo, mas o trecho privilegiado ainda usa `service_role` sem contexto de clínica e não há chave idempotente, lease/token nem reserva transacional de quota. |
| Retry Gemini | `MAX_ATTEMPTS = 3`, laço estrito `< MAX_ATTEMPTS` e timeout de 30 s por request | O limite atual já é de três chamadas por invocação. Na arquitetura alvo, o contador precisa sobreviver a novas invocações como três leases persistidas, com uma chamada externa por lease e sem retry aninhado. |
| Entrada/saída da Edge | Somente `POST`; body até 4 KiB; `laudoId` UUID; PDF até 10 MiB com assinatura `%PDF-`; saída até 256 KiB e objeto JSON | O hardening básico de método, volume e forma já existe e deve ser preservado. Ainda falta validar localmente o resultado contra o schema clínico versionado, sem confiar apenas no schema solicitado ao provedor. |
| Finalização e falha | Resultado é concluído condicionalmente por `id`/`vet_id`/`status`; depois a quota é incrementada em outro RPC. O `catch` persiste e registra apenas código controlado | Logs/body/PII e mensagens brutas já foram saneados. O bloqueador restante é transacional: se a quota falhar após o resultado, o `catch` marca `erro` sem limpar `resultado_ia`; além disso, a atualização de falha não possui guarda de status/lease e não prova proteção contra worker obsoleto. |

Referências locais principais:

- `supabase/migrations/20260531000000_full_schema_setup.sql:143-172`
- `supabase/migrations/20260531000050_ai_usage_limits.sql:2-9`
- `supabase/migrations/20260626010000_ai_quota_rpc_and_parse_laudo_hardening.sql:5-39`
- `supabase/functions/parse-laudo/index.ts:9-93`
- `supabase/functions/parse-laudo/index.ts:296-345`
- `supabase/functions/parse-laudo/index.ts:438-647`
- `web/src/components/lab/LaudoUploader.tsx:161-243`
- `docs/architecture/ADR-001-tenancy-clinica-rls.md:204-232`

## Arquitetura proposta

```text
browser autenticado
  └─ reserva de upload server-side (fora deste draft)
       └─ laudoId + path canônico imutável
            └─ upload exato no bucket privado
                 └─ parse-laudo com JWT + clinicId + laudoId + Idempotency-Key
                      ├─ cliente com JWT prova usuário + acesso via RLS
                      ├─ service_role chama claim com o ator verificado
                      │    └─ lock curto: membership + laudo + quota + lease
                      ├─ service_role baixa somente o path retornado
                      ├─ uma única chamada ao provedor por lease
                      └─ service_role chama finalize OU refund
                           └─ lock curto: token/lease + laudo + quota/auditoria
```

Invariantes:

1. A Edge resolve o ator com `auth.getUser(jwt)` e prova acesso com um cliente RLS antes de usar qualquer cliente privilegiado. O browser nunca envia `actor_user_id`.
2. `claim` recebe esse ator verificado explicitamente, exige `service_role` e revalida clínica/membership no banco. Isso é necessário porque o trigger real impede que o próprio `auth.uid()` altere campos de quota.
3. `clinic_id` é explícito, mas só indica contexto: a membership ativa no banco concede ou nega acesso.
4. `service_role` só é usado depois da autenticação/RLS e sempre precisa apresentar contexto, claim, chave idempotente e token da lease.
5. A cota é reservada antes da chamada externa. Sucesso converte a reserva em consumo; falha terminal a compensa exatamente uma vez.
6. Retry usa a mesma chave de idempotência e a mesma reserva. Um laudo não admite duas reservas abertas.
7. Lease expirada invalida o token do worker anterior. Um resultado atrasado não pode sobrescrever o resultado do worker atual.
8. A operação de banco nunca permanece aberta durante download, parsing, espera/backoff ou chamada HTTP.
9. O path é calculado de `clinic_id + laudo_id` e comparado ao registro; nunca vem do request do processamento.
10. Logs externos contêm somente `claim_id`, evento e código controlado. Nome, path, conteúdo, resultado clínico, prompt e erro bruto ficam fora dos logs.
11. Há no máximo três leases/chamadas de provedor por claim e nenhum retry aninhado no adaptador do provedor.

## Conteúdo da pasta

- [`claim-finalize-contract.md`](claim-finalize-contract.md): contrato Edge Function ↔ frontend ↔ RPC e máquina de estados.
- [`claim-finalize-refund.quarantined.sql`](claim-finalize-refund.quarantined.sql): SQL de projeto protegido por `BEGIN` + exceção incondicional + `ROLLBACK`.
- [`test-matrix.md`](test-matrix.md): matriz obrigatória de concorrência, autorização, Storage, falha e compensação.

## Ambiguidades que bloqueiam uma migration real

| Decisão ausente | Default seguro adotado apenas no draft | Aprovação necessária |
|---|---|---|
| Estrutura de tenancy | `public.clinics(id,status)` e `public.clinic_memberships(clinic_id,user_id,role,status)` | ADR-001, Produto, Segurança e DBA. |
| Literais de status/papel | `active`, `vet`, `clinic_admin` | Contrato definitivo de memberships. |
| Dono da cota | Mantém a cota atual por `profiles.id` | Produto/Financeiro: usuário, clínica, assinatura ou combinação. |
| Reset da cota | Não reseta automaticamente; data vencida bloqueia novo claim | Regra de ciclo, timezone, job idempotente e auditoria. |
| Cobrança de falha | Retry mantém reserva; falha terminal reembolsa | Produto/Financeiro e política do provedor. |
| Lease | 90 segundos; uma chamada externa de até 30 segundos por tentativa | SLO real, tamanho de PDF e latência dos provedores. |
| Retenção de claims/eventos | Nenhum `DELETE` neste draft | LGPD, Jurídico e Operações. |
| Path canônico | `clinics/{clinic_id}/laudos/{laudo_id}/original.pdf` | Storage/RLS, migração de objetos e retenção. |
| Schema de resultado | Apenas exige objeto JSON e limite de 256 KiB | Homologação clínica e versionamento de schema. |
| Tratamento de laudo já concluído | Resposta idempotente sem nova cobrança | Produto e UX. |
| Erros expostos | Catálogo de códigos estáveis; sem mensagens internas | Frontend, Suporte e Observabilidade. |
| Reaper de lease órfã | `refund` sem token somente após expiração, chamado por job interno | Operações, autenticação do job e frequência. |
| Contexto de papel do RPC | Grant exato + claim de request `service_role` | Validar chave legada atual e nova secret key no PostgREST/Supabase JS. |

## Pré-requisitos para retirar da quarentena

- ADR-001 aprovado e migrations de tenancy implementadas/testadas em ambiente efêmero.
- Backfill de `clinic_id` revisado, sem linhas ambíguas fora da quarentena.
- Reserva server-side de laudo/upload implementada; browser não define `storage_path`, `vet_id`, status ou resultado.
- Grants/policies de `laudos_pdf` refeitos para que `authenticated` não possua `UPDATE` de `clinic_id`, `vet_id`, `storage_path`, `status`, `resultado_ia` ou `erro_ia`; revogar colunas não é suficiente se permanecer um grant de tabela amplo.
- Catálogo remoto de grants, functions, policies e owners reconciliado com o repositório.
- Regra de quota/reset aprovada e testes com limite `0`, `NULL`, data vencida e concorrência.
- Contrato clínico do JSON versionado e validado após `JSON.parse`, não apenas pelo provedor.
- Worker/refund/reaper e observabilidade sem PII definidos.
- SQL convertido em migrations separadas via CLI, revisado por duas pessoas e sem o sentinel deste arquivo.
- Reset local/efêmero, Security Advisor, Performance Advisor e toda a matriz desta pasta verdes.

## Validação permitida nesta etapa

A validação desta entrega é somente estática:

1. parser PostgreSQL sobre o draft, sem conexão;
2. verificação dos sentinels `BEGIN`, exceção incondicional e `ROLLBACK`;
3. presença de `SECURITY DEFINER` apenas no schema `private`, `search_path = ''`, nomes qualificados e revogações específicas;
4. busca por grants a `PUBLIC`/`anon`, SQL dinâmico, path recebido como parâmetro e logging de payload;
5. `git diff --check` nos artefatos.

Não contam como validação: executar a exceção do arquivo em produção, copiar trechos para o SQL Editor, aplicar em um projeto conectado ou afirmar que um parser comprova semântica, concorrência ou segurança. A prova final exige PostgreSQL efêmero com as migrations de tenancy aprovadas e a matriz completa.

## Fontes oficiais atuais consultadas

- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase — Storage ownership](https://supabase.com/docs/guides/storage/security/ownership)
- [Supabase — Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Supabase — Authorization headers](https://supabase.com/docs/guides/functions/auth-headers)
- [Supabase — Storage schema](https://supabase.com/docs/guides/storage/schema/design)
- [Supabase changelog — restrições nos schemas Auth, Storage e Realtime](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025)
