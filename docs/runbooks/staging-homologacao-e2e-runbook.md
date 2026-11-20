# Runbook de Homologação E2E Autenticada e SQL (`pgTAP`) — Staging / Loopback Local

- **Última atualização:** 2026-11-19
- **Regra de Segurança Inviolável:** **NUNCA** executar scripts de mutação E2E ou resets SQL contra o projeto de produção (`<production-project-ref>`). Os scripts exigem confirmação explícita do projeto alvo de staging (`SUPABASE_ENVIRONMENT=staging` + `SUPABASE_MUTATION_CONFIRMATION=CONFIRM_STAGING_MUTATION:<ref>`) ou instância efêmera exclusivamente `http://127.0.0.1:<porta>` via flag `--local`.

---

## 1. Matriz de Execução da Suíte Completa (Local vs Staging Isolado)

| Suíte / Verificação | Propósito | Onde Rodar | Comando (dentro de `web/`, salvo indicação) |
| --- | --- | --- | --- |
| Gate Local Seguro (`audit:staging` + `check:predeploy`) | Supply chain, 31 migrations SHA-256, Edge checks, audit npm, lint, typecheck, 17 suítes unitárias, build Next.js e 11 specs E2E não autenticadas | Máquina local (sem rede/Docker) | `npm run audit:staging && npm run check:predeploy` (na **raiz**) |
| Prontidão de Staging (`remote-readiness-check`) | Verifica CLI Supabase (`2.115.0`), `deno`, env vars e migrations `#21`, `#30` e `#31` | Local (`local-only`) ou Staging (`--remote`) | `npm run check:remote-readiness` (ou com `-- --remote`) |
| **Auth / RLS E2E** (`auth.spec.ts` — 4 casos autenticados + redirecionamentos por papel) | Cria usuários efêmeros `admin`, `vet` e `tutor`, testa `/lab` vs `/portal` e limpa com verificação fail-closed | Local Docker (`--local`) ou Staging isolado | `npm run test:e2e:auth-rls:local` ou `npm run test:e2e:auth-rls` |
| **Lab CRUD + Óbito + Multi-Clínica** (`lab-crud.spec.ts`) | Testa criação/edição de tutor e pet, upload de PDF, guarda `DEATH_WORKFLOW_UNAVAILABLE` (Iteração C) e troca/isolamento entre Clínica A e Clínica B (Iteração D) | Local Docker (`--local`) ou Staging isolado | `npm run test:e2e:lab-crud:local` ou `npm run test:e2e:lab-crud` |
| **Extração Local Autenticada sem IA** (`local-extraction-auth.spec.ts`) | Testa parser local `pdfjs-dist`/Tesseract, upload de PDF, revisão conferida e exportação CSV/XLSX sem chamada paga | Local Docker (`--local`) ou Staging isolado | `npm run test:e2e:local-extraction` (ou adaptar URL para staging com confirmação explícita) |
| **Upload + Edge IA `parse-laudo`** (`upload-ia.spec.ts`) | Testa ciclo ponta a ponta com `parse-laudo` e IA real | Staging isolado com secrets configurados | `npm run test:e2e:upload-ia` |
| **Auditorias SQL Read-Only** (`01..05*.sql`) | Inventário de catálogo, RLS, integridade agregada, release blockers e escalonamento | Staging isolado (`--remote-read-only`) | `npm run audit:staging -- --remote-read-only` (após definir alvo staging) |
| **Suíte SQL `pgTAP`** (`supabase/tests/*.sql`) | Testa políticas RLS, `FORCE RLS`, cotas, reservas, rate limit distribuído e workflow transacional `record_pet_death` em transação `ROLLBACK` | Postgres local (`supabase start` / Docker) ou Staging isolado | `psql` / Supabase `test db` (ver Seção 3) |

---

## 2. Pré-requisitos por Modo

### Modo A — Instância Efêmera Local (`--local`, recomendado antes de tocar qualquer ambiente remoto)

1. Iniciar o Docker Desktop (`docker info` respondendo sem erro no daemon Linux engine).
2. Subir o stack local do Supabase a partir da **raiz** usando o binário empacotado:
   ```powershell
   node web/node_modules/supabase/dist/supabase.js start
   ```
3. Aplicar todas as 31 migrations locais e registrar as credenciais retornadas em variáveis de sessão (sem sobrescrever `web/.env.local` se quiser mantê-lo isolado):
   ```powershell
   $env:LOCAL_SUPABASE_URL = "http://127.0.0.1:54321"
   $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "<anon key local>"
   $env:SUPABASE_SERVICE_ROLE_KEY = "<service_role key local>"
   ```
4. Executar as suítes `--local`:
   ```powershell
   Set-Location web
   npm run test:e2e:auth-rls:local
   npm run test:e2e:lab-crud:local
   npm run test:e2e:local-extraction
   ```

### Modo B — Staging Remoto Isolado (NUNCA produção)

1. Confirmar que `SUPABASE_PROJECT_REF` aponta exclusivamente para o projeto de **staging** (diferente de `<production-project-ref>`) e que todas as 31 migrations locais + Edge Function `parse-laudo` já foram aplicadas nesse staging.
2. Definir no terminal (sem commitar):
   ```powershell
   $env:SUPABASE_PROJECT_REF = "<staging-project-ref>"
   $env:NEXT_PUBLIC_SUPABASE_URL = "https://<staging-project-ref>.supabase.co"
   $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "<staging-anon-key>"
   $env:SUPABASE_SERVICE_ROLE_KEY = "<staging-service-role-key>"
   $env:SUPABASE_DB_PASSWORD = "<staging-db-password>"
   $env:SUPABASE_ENVIRONMENT = "staging"
   $env:SUPABASE_MUTATION_CONFIRMATION = "CONFIRM_STAGING_MUTATION:<staging-project-ref>"
   ```
3. Validar prontidão read-only e rodar suíte:
   ```powershell
   Set-Location web
   npm run check:remote-readiness -- --remote
   npm run test:e2e:auth-rls
   npm run test:e2e:lab-crud
   npm run test:e2e:upload-ia
   ```
4. Smoke check de telemetria zero-PII (Iteração A):
   ```powershell
   $headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
   Invoke-RestMethod -Uri "https://<staging-app-url>/api/health/security" -Headers $headers
   ```
   Esperado: HTTP `200`, `cache-control: private, no-store, ...`, JSON sem e-mails, UUIDs ou tokens.

---

## 3. Verificação SQL `pgTAP` (`supabase/tests/*.sql`)

Com Postgres local (`supabase start`) ou banco de staging conectado via `psql`, executar os 7 arquivos de teste abaixo (todos rodam dentro de transação com `ROLLBACK` ao final):

1. [`production_safety_test.sql`](../../supabase/tests/production_safety_test.sql)
2. [`sprint0_security_forward_test.sql`](../../supabase/tests/sprint0_security_forward_test.sql)
3. [`tenancy_structural_test.sql`](../../supabase/tests/tenancy_structural_test.sql)
4. [`laudo_reservation_test.sql`](../../supabase/tests/laudo_reservation_test.sql)
5. [`laudo_transaction_test.sql`](../../supabase/tests/laudo_transaction_test.sql)
6. [`distributed_rate_limit_test.sql`](../../supabase/tests/distributed_rate_limit_test.sql)
7. [`pet_death_workflow_test.sql`](../../supabase/tests/pet_death_workflow_test.sql) — cobre o workflow atômico da Iteração C (`record_pet_death`, imutabilidade append-only de `pet_death_events`, encerramento de `triagens` e cancelamento de `follow_ups`).

```powershell
# Exemplo com Supabase CLI local após `supabase start`:
node web/node_modules/supabase/dist/supabase.js test db
```

---

## 4. Recuperação e Limpeza em Caso de Interrupção

Todos os runners E2E executam cleanup fail-closed automático (`runCleanupSteps`), mas em queda de rede ou `Ctrl+C`:

```powershell
Set-Location web

# 1. Dry-run (somente leitura)
$env:E2E_CLEANUP_RUN_ID = "labcrud-YYYYMMDDHHMMSS"
npm run cleanup:e2e:lab-crud

# 2. Aplicar remoção exata após revisar dry-run
npm run cleanup:e2e:lab-crud -- --apply

# Mesmo fluxo para upload-ia:
$env:E2E_CLEANUP_RUN_ID = "uploadia-YYYYMMDDHHMMSS"
npm run cleanup:e2e:upload-ia
npm run cleanup:e2e:upload-ia -- --apply
```
