# Contrato proposto — `claim`, `finalize` e `refund`

> **Status:** draft incompatível com o runtime atual. Não implementar antes dos pré-requisitos do [`README.md`](README.md).

## 1. Fronteiras de confiança

| Componente | Credencial | Pode fazer | Não pode fazer |
|---|---|---|---|
| Browser | chave pública + JWT do usuário | Escolher a clínica ativa como preferência, reservar upload por API, enviar `laudoId` e uma chave idempotente | Definir `vet_id`, `storage_path`, `clinic_id` persistido, status, resultado, quota ou claim token. |
| Edge Function | JWT recebido + chave pública | Resolver o usuário com `auth.getUser` e provar acesso ao laudo com RLS | Usar a simples presença de `Authorization` ou dados do body como autorização clínica. |
| Edge Function — trecho privilegiado | `service_role` server-side | Chamar `claim` com o ator verificado, baixar o path retornado, finalizar ou compensar o claim exato | Consultar conteúdo/path privilegiado antes da prova RLS, aceitar ator/path do body ou reaproveitar o privilégio para outros registros. |
| RPC privada | owner controlado | Fazer locks e transições atômicas com checks internos | Confiar em metadata de usuário, `profiles.role`, prefixo de path ou parâmetro de usuário sem vínculo ao claim. |
| Provedor de IA | chave server-side | Processar o PDF mínimo necessário | Receber UUID de tutor/usuário, nome de bucket/path ou outros metadados internos sem necessidade. |

O request do usuário deve ser autenticado antes de instanciar o fluxo privilegiado. A Edge Function mantém dois clientes distintos: um cliente com o header `Authorization` do usuário para `auth.getUser` e uma consulta mínima protegida por RLS; outro cliente administrativo criado somente depois dessa prova para `claim`, Storage, `finalize` e `refund`. O `actor_user_id` vem do usuário verificado, nunca do body.

Essa separação também preserva o hardening já existente: `prevent_profile_privilege_escalation` bloqueia o próprio `auth.uid()` quando tenta alterar os campos de quota. Não se cria bypass no trigger; a reserva de quota ocorre no RPC server-side, com `service_role`, ator explícito e membership revalidada na mesma transação.

## 2. Contrato HTTP da Edge Function

### Request de processamento

```http
POST /functions/v1/parse-laudo
Authorization: Bearer <user-jwt>
Idempotency-Key: <uuid-v4-estável-para-a-ação>
Content-Type: application/json

{
  "clinicId": "<uuid>",
  "laudoId": "<uuid>"
}
```

Regras:

- `clinicId` e `laudoId` devem ser UUIDs canônicos.
- `Idempotency-Key` é obrigatório, tem formato UUID e é gerado uma única vez quando o usuário inicia a análise. O mesmo valor é reutilizado em timeout, reconexão ou retry daquela ação.
- O body não aceita `userId`, `vetId`, `storagePath`, `provider`, `attempt`, `status`, `quota` ou `result`.
- A lista CORS de headers deve passar a permitir `idempotency-key`.
- `clinicId` não concede acesso; `claim` revalida clínica e membership ativa no banco.
- Laudo de outro tenant responde como inexistente. Não há confirmação de que o UUID existe.

### Sucesso concluído

```json
{
  "success": true,
  "status": "completed",
  "laudoId": "<uuid>",
  "claimId": "<uuid>",
  "data": {},
  "quota": { "used": 1, "limit": 5 }
}
```

### Requisição idempotente ainda em andamento

HTTP `202`, sem resultado e sem claim token:

```json
{
  "success": true,
  "status": "processing",
  "laudoId": "<uuid>",
  "claimId": "<uuid>",
  "retryAfterSeconds": 10
}
```

### Erro estável

```json
{
  "success": false,
  "code": "quota_exhausted",
  "message": "Limite de análises atingido.",
  "retryable": false
}
```

Mapa mínimo:

| HTTP | Código | Retry | Observação |
|---:|---|---:|---|
| 400 | `invalid_request` | não | UUID/header/body inválido. |
| 401 | `unauthenticated` | após login | JWT ausente, expirado ou inválido. |
| 404 | `laudo_not_found` | não | Inclui UUID inexistente, outra clínica e membership sem acesso. |
| 409 | `already_processing` | sim | Outro idempotency key/worker possui reserva aberta. |
| 409 | `claim_conflict` | sim | Corrida de unicidade foi revertida; consultar status antes de repetir. |
| 409 | `attempts_exhausted` | não | Três leases já foram usados. |
| 422 | `invalid_laudo_state` | não | Registro/path/estado incompatível; alerta operacional interno. |
| 429 | `quota_exhausted` | não | Reserva atômica recusada. |
| 503 | `provider_unavailable` | sim | Falha transitória compensada ou mantida como retry controlado. |
| 500 | `processing_failed` | não | Mensagem pública genérica; detalhe bruto não é persistido nem retornado. |

O runtime atual retorna HTTP `200` para quase todo erro lógico. A adoção deste contrato é uma mudança versionada e exige atualização coordenada do frontend e dos E2E.

## 3. `claim`

Assinatura pública proposta:

```sql
public.claim_laudo_ia(
  p_clinic_id uuid,
  p_actor_user_id uuid,
  p_laudo_id uuid,
  p_idempotency_key uuid
)
```

Chamador: somente `service_role`, depois de a Edge resolver `p_actor_user_id` com `auth.getUser(jwt)` e provar o acesso usando o cliente RLS. O wrapper é `SECURITY INVOKER`; a implementação privilegiada fica em `private`, com `SECURITY DEFINER`, `search_path = ''`, nomes qualificados e `EXECUTE` explicitamente revogado por padrão.

O check interno do papel usa o contexto de request do PostgREST além do grant exato a `service_role`. A compatibilidade desse contexto com a chave legada atual e com chaves secretas modernas precisa ser comprovada no ambiente efêmero; não se deve remover o check sem revisão de Segurança.

Ordem conceitual dentro de uma transação curta:

1. exigir `service_role` e validar todos os identificadores explícitos;
2. validar clínica ativa e membership ativa de `p_actor_user_id` com papel `vet` ou `clinic_admin`;
3. procurar a mesma tripla `(clinic_id, actor_user_id, idempotency_key)` e bloquear o claim, se existir;
4. bloquear `laudos_pdf` por `(id, clinic_id)` e confirmar que o pet pertence ao mesmo tenant;
5. derivar `clinics/{clinic_id}/laudos/{laudo_id}/original.pdf` e exigir igualdade com `storage_path`;
6. bloquear a linha de quota do ator;
7. reservar uma unidade por `used := used + 1` somente se `used < limit`;
8. criar o claim ou renovar uma lease expirada/retryable com token novo;
9. marcar `laudos_pdf.status = 'processando'` e limpar somente o código de erro controlado;
10. registrar evento técnico sem PII e retornar bucket/path do registro.

Disposições possíveis:

- `claimed`: nova reserva, `attempt_count = 1`;
- `reclaimed`: mesma chave e reserva, lease anterior expirada/retryable, contador incrementado;
- `processing`: mesma chave ainda possui lease válida; nenhuma nova chamada externa;
- `already_completed`: resultado já persistido; nenhuma reserva/cobrança;
- `terminal`: tentativa já compensada ou esgotada.

Nunca retornar o token para `processing`, `already_completed` ou `terminal`. Um token novo é emitido apenas ao worker que adquiriu a lease.

## 4. Chamada externa e retry

Depois do commit do claim:

1. o cliente privilegiado baixa apenas `storage_bucket` + `storage_path` retornados;
2. valida MIME, tamanho e assinatura `%PDF-` antes de enviar;
3. chama **uma vez** o provedor durante aquela lease, com timeout máximo de 30 segundos;
4. valida resposta contra um schema clínico versionado local, além de `JSON.parse`;
5. chama exatamente uma das operações `finalize` ou `refund`.

Não há loop interno no adaptador do provedor. Se a falha for retryable, `refund(..., retryable=true)` libera a lease, preserva a única reserva e o orquestrador pode adquirir a próxima lease com a mesma chave depois de backoff. O total máximo é três leases e três chamadas ao provedor.

Backoff sugerido para validação em staging: 2 s antes da segunda tentativa e 4 s antes da terceira. Não aguardar dentro de transação ou função SQL.

## 5. `finalize`

Assinatura pública proposta:

```sql
public.finalize_laudo_ia(
  p_clinic_id uuid,
  p_actor_user_id uuid,
  p_laudo_id uuid,
  p_claim_id uuid,
  p_claim_token uuid,
  p_idempotency_key uuid,
  p_result jsonb,
  p_provider_code text
)
```

Chamador: somente `service_role`. Todos os campos de contexto precisam coincidir com o claim armazenado. `p_provider_code` aceita apenas identificadores previstos; resposta bruta, modelo, prompt, nome/path e conteúdo não vão para eventos/logs.

Transação curta:

1. confirmar papel de serviço e validar argumentos;
2. revalidar que o ator ainda possui membership ativa, bloquear o claim pela identidade completa e conferir token;
3. bloquear o laudo correspondente;
4. aceitar apenas claim `processing` com lease ainda válida;
5. validar que o JSON é objeto e está dentro do limite de armazenamento;
6. alterar laudo para `concluido`, gravar resultado e limpar erro;
7. alterar claim para `completed` e quota para `consumed`;
8. registrar evento sem payload;
9. retornar quota atual.

Repetir `finalize` com os mesmos identificadores e token retorna `already_completed`, sem alterar resultado ou quota. Token antigo depois de `reclaimed` é recusado, mesmo que o provedor antigo responda depois.

Se clínica ou membership forem desativadas durante a chamada externa, `finalize` falha fechado. A Edge deve então executar `refund` terminal com o mesmo claim para não deixar a reserva presa; `refund` não depende de membership ativa, pois sua função é somente reduzir privilégio/estado e compensar quota.

## 6. `refund`

Assinatura pública proposta:

```sql
public.refund_laudo_ia(
  p_clinic_id uuid,
  p_actor_user_id uuid,
  p_laudo_id uuid,
  p_claim_id uuid,
  p_claim_token uuid,
  p_idempotency_key uuid,
  p_retryable boolean,
  p_error_code text
)
```

Chamador: somente `service_role`. `p_error_code` deve pertencer à allowlist fechada do SQL (`provider_timeout`, `provider_rate_limited`, `provider_unavailable`, `provider_rejected`, `storage_missing`, `invalid_pdf`, `invalid_provider_response`, `invalid_result_schema`, `result_too_large`, `worker_crashed`, `internal_processing_error`, `attempts_exhausted`). Texto livre é recusado mesmo quando contém apenas caracteres seguros.

- Falha retryable antes da terceira tentativa: claim vira `retryable_error`, lease é encerrada, laudo vira `erro`, a reserva permanece e o próximo claim com a mesma chave não incrementa quota.
- Falha terminal ou terceira tentativa: quota reservada é decrementada exatamente uma vez, claim vira `terminal_error`/`refunded` e laudo vira `erro`.
- Repetição da compensação retorna `already_refunded`; `ai_quota_used` nunca cai abaixo de zero.
- Um job interno pode chamar a operação sem token apenas depois da expiração da lease. Isso permite recuperar crash do worker, mas requer autenticação de serviço e contexto completo.
- Claim `completed`/`consumed` não pode ser compensado por esta operação. Correção financeira posterior é outro workflow auditado.

## 7. Máquina de estados

```text
laudos_pdf.pendente | erro
         │ claim + reserva
         ▼
laudos_pdf.processando / claim.processing / quota.reserved
         ├─ finalize ───────────────► concluido / completed / consumed
         ├─ refund retryable (<3) ─► erro / retryable_error / reserved
         │                              │ claim mesma key + token novo
         │                              └──────────────────────────────┐
         └─ refund terminal (ou 3ª) ► erro / terminal_error / refunded│
                                                                         │
                      reclaimed / processing ◄───────────────────────────┘
```

Os quatro estados atuais de `laudos_pdf` são preservados. Os detalhes de concorrência ficam na tabela privada de claims, não em estados novos expostos ao frontend.

Essa máquina só é válida se mutações diretas dos campos internos forem removidas. A migration de adoção deve revogar o `UPDATE` amplo de tabela e conceder apenas as colunas realmente editáveis; um simples `REVOKE UPDATE (coluna)` não neutraliza um grant de tabela mais amplo. `clinic_id`, `vet_id`, `storage_path`, `status`, `resultado_ia` e `erro_ia` ficam sob RPCs/serviço controlado.

## 8. Contrato de Storage

Este draft não implementa a reserva de upload, mas depende dela:

- um endpoint/RPC server-side autorizado cria `laudos_pdf.id`, atribui `clinic_id`, liga o pet do mesmo tenant e grava o path canônico;
- o browser recebe apenas o path já reservado e faz `upload(..., upsert: false)`;
- policies de Storage exigem que `storage.objects.name` corresponda a uma reserva `laudos_pdf` acessível por membership;
- o claim retorna o path do registro e não aceita path no request;
- o cliente privilegiado usa a API de Storage; não altera `storage.objects` por SQL;
- falha de upload antes do registro ou registro antes do upload precisa de compensação/reaper próprio, fora deste draft.

## 9. Contrato do frontend

Mudanças necessárias em `LaudoUploader`, coordenadas com a futura API:

1. substituir `Date.now()` + nome do arquivo por reserva server-side;
2. não inserir diretamente `vet_id`, `storage_path` ou estado interno;
3. manter `idempotencyKey` em estado/ref até conclusão terminal; não gerar nova chave ao clicar “tentar novamente” após timeout;
4. distinguir `202 processing`, `409`, `429`, `503` e sessão expirada;
5. depois de timeout, consultar o status pelo `laudoId`/claim antes de repetir;
6. atualizar quota a partir da resposta do servidor ou refetch, nunca por `used + 1` otimista;
7. não renderizar mensagens brutas de banco, Storage ou provedor;
8. expor fallback humano sem pedir compartilhamento de dados clínicos por canal externo.

## 10. Observabilidade sem PII

Eventos permitidos nos logs estruturados da Edge:

- `claimed`, `reclaimed`, `already_processing`;
- `provider_started`, `provider_succeeded`, `provider_failed`;
- `finalized`, `retryable_error`, `refunded`, `stale_worker_rejected`;
- `authorization_denied`, `quota_denied`, `path_mismatch` como métricas agregadas.

A tabela privada `laudo_ia_claim_events` mantém apenas as transições transacionais (`claimed`, `reclaimed`, `finalized`, `retryable_error`, `refunded`, `attempts_exhausted`). Eventos de provedor permanecem na observabilidade da Edge e nunca incluem payload.

Campos permitidos em log: timestamp, `claim_id`, correlation/request ID aleatório, número da tentativa, duração, provider code, event code e error code controlado. UUIDs de usuário/clínica/laudo ficam somente na tabela de claim privada e nos logs auditáveis de acesso restrito, não nos logs da Edge Function.

Campos proibidos: nome do arquivo, `storage_path`, PDF/base64, resultado/prompt, nome de paciente/tutor, e-mail, telefone, CPF, JWT, keys, resposta bruta e mensagem bruta de SDK/provedor.
