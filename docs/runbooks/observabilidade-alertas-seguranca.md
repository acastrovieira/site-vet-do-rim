# Runbook — Observabilidade & Alertas de Segurança (Zero-PII)

Este runbook documenta os eventos estruturados, limiares de alerta e o endpoint operacional de leitura adicionados na **Iteração A**, preservando integralmente a política de não registrar PII, e-mails, IPs brutos, cookies, payloads clínicos ou UUIDs reais em logs.

---

## 1. Arquitetura de Telemetria

- **Módulo central:** [`security-telemetry.ts`](../../web/src/lib/security-telemetry.ts) (compatível com Proxy/Edge e Node.js, sem dependências `node:*`).
- **Formato de log (Next.js / Vercel):**
  ```text
  [security] event=<tipo_allowlisted> {"event":"...","status":429,"layer":"rate_limit_db","scope":"laudo_reserve","timestamp":"...","code":"RATE_LIMITED","retryAfterSeconds":60}
  ```
- **Formato de log (Edge Function `parse-laudo`):**
  - `[parse-laudo] event=authorization_unavailable`
  - `[parse-laudo] event=rate_limit_exceeded` (`{ layer: "instance" | "distributed" }`)
  - Demais eventos existentes (`event=processing_failed`, `event=distributed_rate_limit_unavailable`, etc.).
- **Garantia Zero-PII:**
  - `sanitizeTelemetryRoutePath` reduz qualquer UUID e segmento numérico longo (`>= 4` dígitos) para `:id` e remove query strings/fragmentos.
  - `sanitizeTelemetryScope` substitui por `redacted` qualquer valor contendo `@`, `?`, `=`, espaço, `eyJ`, `bearer` ou UUID.
  - Nenhum log foi adicionado a [`/auth/callback`](../../web/src/app/auth/callback/route.ts) (preservando o contrato de higienização de callback).

---

## 2. Catálogo de Eventos & Limiares (Janela Deslizante de 15 Minutos)

| Evento Allowlisted | Severidade do Alerta | Limiar (15 min) | Camadas Instrumentadas | Código(s) Comuns |
| --- | --- | --- | --- | --- |
| `extraction_storage_mismatch` | **critical** | `1` | `api` (`/api/laudos/:id/abandon`, `/api/laudos/:id/results-local`) | `PATH_MISMATCH` |
| `authorization_unavailable` | **critical** | `3` | `authz` (`profiles`, `clinic_memberships`) + `parse-laudo` | `AUTHORIZATION_UNAVAILABLE` |
| `rate_limit_unavailable` | **high** | `3` | `rate_limit_db` (`consume_clinical_rate_limit`) | `RATE_LIMIT_UNAVAILABLE` |
| `csrf_rejected` | **high** | `5` | `api` (`assertSameOriginMutation`, `/api/lab/export`) | `CSRF_REJECTED` |
| `cron_auth_failed` | **high** | `5` | `cron` (`keep-alive`, `cleanup-storage`, `purge-claim-events`, `health/security`) | `CRON_UNAUTHORIZED` |
| `rls_denied` | **high** | `5` | `api` (`/api/pets*`, `/api/tutores*`) | `RLS_DENIED` |
| `proxy_invalid_path` | **medium** | `10` | `proxy` (`normalizePathname`) | `INVALID_PATH` |
| `authorization_forbidden` | **medium** | `15` | `authz` (`profiles_role`) | `FORBIDDEN` |
| `rate_limit_exceeded` | **medium** | `20` | `rate_limit_ip`, `rate_limit_db` + `parse-laudo` | `IP_RATE_LIMITED`, `RATE_LIMITED` |

**Status agregado calculado pelo snapshot:**
- `healthy`: nenhum alerta ativo na janela de 15 minutos.
- `elevated`: um ou mais alertas `medium` ou `high` ativos.
- `degraded`: ao menos um alerta `critical` ativo.

---

## 3. Consulta ao Snapshot Operacional (`GET /api/health/security`)

- **Endpoint:** [`route.ts`](../../web/src/app/api/health/security/route.ts)
- **Autenticação obrigatória:** `Authorization: Bearer <CRON_SECRET>` (comparado via `SHA-256` + `timingSafeEqual`; secret `< 32` chars responde `503`).
- **Rate limit:** `20 req/min` por IP (`health_security`).
- **Headers:** `Cache-Control: no-store, no-cache, max-age=0, must-revalidate`.
- **Exemplo de leitura (sem expor segredo no histórico):**
  ```bash
  curl -sS -H "Authorization: Bearer $CRON_SECRET" https://www.vetdorim.com.br/api/health/security
  ```
- **Limitação arquitetural em serverless:** os contadores em memória no `GET /api/health/security` refletem a instância que atendeu à requisição; a visão consolidada entre réplicas deve consultar os drenos de log da Vercel e Supabase Logs filtrando por `"[security] event="` e `"[parse-laudo] event="`.

---

## 4. Ações Recomendadas por Alerta

1. **`extraction_storage_mismatch` (`critical`, limiar 1):** investigar imediatamente divergência entre `clinic_id`/`storage_path` gravado em `laudos_pdf` e o caminho canônico esperado (`clinics/<clinic>/laudos/<laudo>/original.pdf`). Conferir se houve tentativa de manipulação de ID ou dado legado pré-constraint.
2. **`authorization_unavailable` / `rate_limit_unavailable` (`critical`/`high`):** verificar conectividade e saúde do projeto Supabase (Data API, Postgres, RPC `consume_clinical_rate_limit`, permissões em `profiles`/`clinic_memberships`).
3. **`csrf_rejected` / `cron_auth_failed` / `rls_denied` (`high`):** checar nos logs agregados qual `scope` concentrou rejeições (sem expor PII) para distinguir origem de ataque automatizado, token de cron expirado ou bug de UI chamando mutação sem vínculo de clínica.
4. **`proxy_invalid_path` / `rate_limit_exceeded` (`medium`):** confirmar se há varredura automatizada nas rotas públicas/auth e avaliar ajuste fino de regras no WAF/Vercel Firewall caso o volume persista.
