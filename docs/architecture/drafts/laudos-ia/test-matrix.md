# Matriz de testes — laudos/IA concorrente e fail-closed

> **Gate:** todos os casos são obrigatórios em PostgreSQL/Supabase efêmero antes de qualquer canário. Um teste unitário de mocks não substitui os casos de concorrência, RLS, Storage ou rollback.

## Convenções

- **A/B:** clínicas isoladas A e B.
- **Vet A/Vet B:** membership ativa apenas na clínica correspondente.
- **Vet AB:** membership ativa nas duas clínicas, sempre com contexto explícito.
- **Observações:** capturar contagens antes/depois de `laudos_pdf`, claims, eventos e quota. Logs não podem conter fixture PII.
- **Concorrência:** usar duas conexões reais e barreira determinística; não testar apenas `Promise.all` contra mocks.
- **Falhas injetadas:** ocorrer em ponto conhecido e ter as alterações verificadas após rollback/commit.
- **Baseline preservado:** o runtime atual já limita Gemini a três requests por invocação, restringe método/body/UUID/PDF/saída, usa compare-and-set por `vet_id`/estado e não registra body/PII/erro bruto. Os casos marcados como regressão impedem perder esse hardening durante a adoção de claim/lease.

## 1. Autorização e contexto

| ID | Cenário | Injeção/ação | Resultado obrigatório |
|---|---|---|---|
| AUTH-01 | Vet A processa laudo A | JWT A + `clinicId=A` | Claim criado; uma reserva; path A retornado. |
| AUTH-02 | Vet A envia UUID do laudo B com contexto A | `laudoId=B` | `laudo_not_found`; nenhuma leitura/download, claim, status, evento com UUID B ou quota. |
| AUTH-03 | Vet A envia contexto B | Membership inexistente | Mesma resposta segura de inexistência/negação; nenhuma mutação. |
| AUTH-04 | Vet AB alterna A e B | Dois requests explícitos | Cada claim liga exatamente um tenant; nenhum resultado/path misturado. |
| AUTH-05 | Membership é desativada com JWT ainda válido | Desativar antes do claim | Negar imediatamente; `profiles.role` não concede fallback. |
| AUTH-06 | Tutor/anon tenta claim | JWT tutor ou sem JWT | 404/401 conforme contrato; zero efeitos. |
| AUTH-07 | Browser tenta claim/finalize/refund | JWT authenticated | Permissão negada pelo grant e pelo check interno; estado idêntico. |
| AUTH-08 | Serviço apresenta contexto de outro claim | Trocar user/clinic/laudo/idempotency | Finalize/refund negado; nenhum dado é revelado ou alterado. |
| AUTH-09 | Admin da clínica A tenta B | Membership `clinic_admin` apenas A | Negar; não existe admin clínico global. |
| AUTH-10 | `raw_user_meta_data` declara papel/clínica privilegiados | JWT com metadata manipulada | Metadata ignorada; decisão depende de membership no banco. |
| AUTH-11 | RPC usa chave legada e depois secret key suportada | Duas configurações efêmeras | Em ambas, o papel interno é reconhecido somente como `service_role`; browser continua negado. |
| AUTH-12 | Browser tenta alterar campos internos do laudo | UPDATE de clinic/vet/path/status/result/error | Negar em todos os campos; grants amplos de tabela não podem permanecer. |

## 2. Idempotência e concorrência

| ID | Cenário | Injeção/ação | Resultado obrigatório |
|---|---|---|---|
| CON-01 | Dois claims simultâneos, mesma chave/laudo | Barreira antes do lock | Um `claimed`; outro `processing`; uma claim row e `quota_used + 1`. |
| CON-02 | Dois claims simultâneos, chaves diferentes, mesmo laudo | Barreira antes do lock | Um vence; outro `already_processing`; uma reserva e um possível provider job. |
| CON-03 | Última unidade de quota, dois laudos | `used=limit-1`; claims simultâneos | Exatamente um claim; outro `quota_exhausted`; `used=limit`. |
| CON-04 | `limit=0` | Claim válido | Negar; nenhum fallback para 5 e nenhuma mutação. |
| CON-05 | Quota `NULL`/inconsistente | Campo nulo legado | Fail-closed com alerta técnico; não aplicar `COALESCE(...,5)`. |
| CON-06 | Mesmo idempotency key para outro laudo | Reusar key A em laudo A2 | `idempotency_conflict`; zero mutações no segundo laudo. |
| CON-07 | Lease válida e retry do cliente | Repetir mesma key | Retornar `processing` sem token; nenhuma chamada adicional ao provedor. |
| CON-08 | Lease expira | Avançar relógio/controlar timestamp | Mesmo key faz `reclaimed`, token muda, attempt incrementa e quota não muda. |
| CON-09 | Worker antigo finaliza após reclaim | Usar token anterior | Rejeitar como stale; resultado/status do worker novo intactos. |
| CON-10 | Terceira lease falha | `attempt_count=3` | Estado terminal; compensação única; quarto claim recusado. |
| CON-11 | Laudo já concluído | Novo claim | `already_completed`; nenhum claim/custo/alteração do resultado. |
| CON-12 | Duas finalizações simultâneas iguais | Mesmo token/contexto | Uma grava; outra `already_completed`; resultado e evento final únicos. |
| CON-13 | Duas compensações simultâneas | Mesmo token/contexto | Uma decrementa; outra `already_refunded`; quota não fica negativa. |

## 3. Falha e atomicidade

| ID | Ponto de falha | Injeção | Resultado obrigatório |
|---|---|---|---|
| FLT-01 | Depois de reservar quota, antes de inserir claim | Exceção SQL | Transação inteira revertida; quota/status inalterados. |
| FLT-02 | Depois de inserir claim, antes de marcar laudo | Exceção SQL | Claim e quota revertidos; laudo permanece anterior. |
| FLT-03 | Dentro de `finalize`, depois de gravar resultado e antes de concluir claim/quota | Exceção SQL | Resultado, status, claim e quota revertidos juntos. |
| FLT-04 | Depois de decrementar quota, antes de marcar refunded | Exceção SQL | Decremento revertido; retry não causa perda de quota. |
| FLT-05 | Resposta HTTP perdida após finalize commit | Cliente recebe timeout e repete | `already_completed`; sem nova chamada/cobrança. |
| FLT-06 | Edge morre após claim | Nenhum finalize/refund | Lease expira; reaper/refund sem token pode recuperar; uma compensação no máximo. |
| FLT-07 | Download retorna não encontrado | Storage sem objeto | Nenhum provedor chamado; refund controlado; `error_code=storage_missing`. |
| FLT-08 | Regressão do hardening atual: PDF excede 10 MiB ou assinatura inválida | Conteúdo sintético | Nenhum provedor chamado; falha terminal/compensação conforme política. |
| FLT-09 | Timeout do provedor | Abort em 30 s | `retryable_error`, mesma reserva, backoff fora da transação. |
| FLT-10 | Regressão do hardening atual: provedor 429 | Resposta injetada em requests/leases sucessivos | Baseline e alvo nunca fazem um quarto request. No alvo, são no máximo três leases persistidas, uma chamada por lease e compensação terminal ao esgotar. |
| FLT-11 | Provedor 4xx permanente | Resposta inválida/autorização | Falha terminal imediata; refund único; segredo não aparece em log. |
| FLT-12 | JSON inválido | Texto não JSON | `finalize` não é chamado; refund conforme catálogo; resposta bruta não persistida. |
| FLT-13 | Regressão do hardening atual: JSON objeto acima de 256 KiB | Payload sintético | Finalize rejeitado atomicamente; laudo não vira concluído. |
| FLT-14 | JSON válido, schema clínico inválido | Campo/tipo ausente | Validador da Edge recusa antes do finalize; código controlado. |
| FLT-15 | Quota reset vencida | `reset_date <= now()` | Novo claim bloqueado até job/regra aprovada; não resetar silenciosamente. |
| FLT-16 | Risco residual atual: falha de quota depois da gravação do resultado | Forçar falha no passo equivalente ao antigo `increment_ai_quota` | No desenho alvo, finalize é uma única transação: não pode existir `status=erro` com `resultado_ia` persistido nem resultado concluído sem quota consumida. |
| FLT-17 | Worker antigo entra no caminho de erro depois de outro worker concluir | Reclaim, finalizar com token novo e então executar refund/falha com token antigo | Token antigo é rejeitado; `concluido`, resultado e quota consumida do vencedor permanecem intactos. |

## 4. Storage e vínculo do registro

| ID | Cenário | Ação | Resultado obrigatório |
|---|---|---|---|
| STO-01 | Path canônico correto | Claim A | Retorna exatamente `clinics/A/laudos/{id}/original.pdf`. |
| STO-02 | Registro contém path de outro usuário/clínica | Alteração sintética em fixture | Claim falha antes da quota e do download; alerta `path_mismatch` sem registrar path. |
| STO-03 | Body inclui `storagePath` | Campo extra malicioso | Campo rejeitado/ignorado; path vem somente do registro. |
| STO-04 | Objeto B com UUID de registro A | Fixture inconsistente | Constraint/policy/reconciliação bloqueia; nenhum conteúdo B enviado à IA. |
| STO-05 | Tentativa de `../`, path absoluto ou Unicode confusável | Reserva/upload | Path server-side não incorpora input; upload fora da reserva negado. |
| STO-06 | Upsert no objeto existente | Segundo upload | Negado; original é imutável. |
| STO-07 | SQL direto em `storage.objects` | Script de teste | Não usado pelo runtime; upload/download/delete passam pela API Storage. |
| STO-08 | Signed URL cross-tenant | Vet A pede objeto B | Não emitir URL; evento agregado sem UUID/path em log público. |

## 5. Estados, quota e compensação

| ID | Estado inicial | Operação | Estado final obrigatório |
|---|---|---|---|
| STA-01 | `pendente`, sem claim | claim | `processando` / `processing` / `reserved`. |
| STA-02 | `erro`, retry compensado | nova ação com nova key | Nova reserva permitida segundo política; uma unidade apenas. |
| STA-03 | `retryable_error`, reserva aberta | claim mesma key | `processando` / `reclaimed`; quota inalterada. |
| STA-04 | `processing`, lease válida | refund retryable | `erro` / `retryable_error` / `reserved`. |
| STA-05 | `processing`, falha terminal | refund terminal | `erro` / `terminal_error` / `refunded`; quota -1. |
| STA-06 | `processing`, sucesso | finalize | `concluido` / `completed` / `consumed`; quota permanece reservada/consumida. |
| STA-07 | `completed` | refund | Negar; resultado e quota consumida intactos. |
| STA-08 | `refunded` | refund repetido | `already_refunded`; quota intacta. |
| STA-09 | claim aberto de outro idempotency key | novo claim | Negar sem segunda reserva. |
| STA-10 | status `processando` sem claim | claim | Fail-closed `invalid_laudo_state`; não “adotar” trabalho órfão sem reconciliação. |

## 6. Logs, privacidade e contratos

| ID | Evidência | Asserção obrigatória |
|---|---|---|
| OBS-01 | Regressão do hardening atual: logs de sucesso | Não contêm nome, arquivo, path, PDF, resultado, prompt, paciente, tutor, e-mail ou JWT. |
| OBS-02 | Regressão do hardening atual: logs de erro de provedor | Não contêm body/header/resposta bruta/API key; somente provider/error code controlados. |
| OBS-03 | `private.laudo_ia_claim_events` | Contém claim/evento/tentativa/timestamp; contexto detalhado permanece na claim privada. |
| OBS-04 | Resposta HTTP | Não expõe SQLSTATE, nome de tabela/policy, stack, Storage path ou provider body. |
| OBS-05 | Regressão do hardening atual: mensagem `erro_ia` | Apenas código controlado; sem `error.message` bruto. |
| OBS-06 | Eventos duplicados | `finalized` e `refunded` têm cardinalidade máxima 1 por claim. |
| OBS-07 | Métricas | Latência, tentativas, quota denied e stale worker agregáveis sem PII. |
| OBS-08 | Dados de teste | Fixtures sintéticas; nenhuma cópia de laudo real em CI/staging. |

## 7. Compatibilidade frontend/API

| ID | Cenário | Resultado obrigatório |
|---|---|---|
| API-01 | `202 processing` | UI mantém chave, informa andamento e faz polling limitado/cancelável. |
| API-02 | Timeout após POST | UI consulta status antes de retry; não gera nova key. |
| API-03 | `429 quota_exhausted` | Botão desabilita após refetch; limite `0` permanece `0`. |
| API-04 | `401` | Sessão é renovada/login solicitado; não exibe erro interno. |
| API-05 | `404` cross-tenant | Mesma UX de registro inexistente; nenhuma PII. |
| API-06 | `503 retryable` | Retry manual/automático máximo definido; sem loop. |
| API-07 | Sucesso | Quota vem da resposta/refetch; não usa incremento otimista local. |
| API-08 | Refresh durante processamento | UI recupera status do servidor e não dispara outro provider job. |
| API-09 | Regressão do hardening atual: método diferente de `POST` | `GET`, `PUT` e `DELETE` | `405`, sem autenticação, leitura, claim, quota ou provider. |
| API-10 | Regressão do hardening atual: body/UUID inválido | Body maior que 4 KiB, JSON malformado/não objeto e UUID inválido | Erro controlado antes de consultar laudo ou chamar provider; nenhum detalhe interno exposto. |

## 8. Gates técnicos

- [ ] Testes SQL de duas sessões reais passam 50 vezes sem flakiness.
- [ ] Testes de RLS/Data API passam com Vet A × Vet B e membership desativada.
- [ ] Testes Storage passam com bucket privado, upload exato e cross-tenant negativo.
- [ ] Edge Function possui no máximo uma chamada de provedor por lease e três no total.
- [ ] Fault injection prova rollback nos quatro pontos transacionais.
- [ ] Contadores provam `0 <= ai_quota_used <= ai_quota_limit` após cada caso.
- [ ] Nenhum claim fica `reserved` após o período máximo definido para reaper.
- [ ] Segurança revisa owner, grants, `search_path`, schema exposto e ausência de SQL dinâmico.
- [ ] Performance revisa índices e planos das consultas de membership/claim sob volume representativo.
- [ ] Tipos são regenerados do ambiente efêmero e contratos frontend/E2E atualizados.
- [ ] Logs automatizados passam em detector de PII/segredos com fixtures sentinela.
- [ ] Backup/restore, rollback fail-closed e runbook de incidente são ensaiados.
