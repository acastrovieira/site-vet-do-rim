# Auditoria Completa de Cibersegurança e Blindagem — Vet do Rim

- **Data da Auditoria:** 2026-11-18 (consolidado em 2026-11-19)
- **Escopo:** Frontend Next.js (`web/`), Backend/Route Handlers/Proxy (`web/src/`), Banco de Dados & Migrations PostgreSQL/Supabase (`supabase/migrations/`), Storage (`laudos`), Edge Function (`supabase/functions/parse-laudo`), Configurações Supabase (`supabase/config.toml`) e CI/CD (`.github/workflows/`).
- **Política Operacional Aplicada:** Nenhuma mutação remota foi executada em produção (`<production-project-ref>`). `supabase/.temp/` foi desvinculado do projeto remoto e `supabase/.gitignore` foi atualizado (`.env`, `.env.*`, `!.env.example`). Alterações de banco e Edge Functions permanecem exclusivamente locais até execução do Runbook Manual ao final deste documento.

---

## 1. Sumário Executivo por Frente (Squad de Segurança)

| Frente | Foco da Auditoria | Resultado Principal |
| --- | --- | --- |
| **Banco de Dados, RLS & Storage** (`@db-sage` / Subagent `965010f6`) | `FORCE RLS`, privilégios de escrita, tenant isolation, storage de PDFs, cotas e triggers defensivos | Criada migration [`20261118120000_security_audit_total_hardening.sql`](../../supabase/migrations/20261118120000_security_audit_total_hardening.sql) com `FORCE ROW LEVEL SECURITY` em 10 tabelas públicas + `private.clinical_rate_limit_windows`, fechamento de escrita direta em `laudos_pdf` por `authenticated`, eliminação de bypass `OR` no storage e rate limit distribuído em PostgreSQL. |
| **Backend, APIs, Proxy & Edge** (`@omar-santos` / Subagent `4b90248c`) | CSRF, IDOR, path traversal, fail-closed auth, rate limiting, cron auth e Edge IA (`parse-laudo`) | Proteção `assertSameOriginMutation` + rate limit distribuído (`consume_clinical_rate_limit`) e in-memory por IP (`SHA-256` + salt efêmero), `normalizePathname` fail-closed no proxy, comparação de segredos via `timingSafeEqual`, erro `503 AUTHORIZATION_UNAVAILABLE` fail-closed e anti-prompt-injection + validação estrita de payload em `parse-laudo`. |
| **Frontend, CSP, PDF & LGPD** (`@georgia-weidman` / `@jim-manico` / Subagent `f24a6a77`) | CSP, headers HTTP, SSR gate, validação binária de PDF, troca segura de credenciais e consentimento LGPD | CSP sincronizada em `security-headers.ts`, `next.config.ts` e `vercel.json` (sem `posthog` em `script-src`, com `wasm-unsafe-eval`, `COOP`/`CORP` e `Cache-Control: private, no-store...` em `/api/*`), validação de magic bytes `%PDF-` + opções seguras no `pdfjs-dist` v5, gate SSR em `VetOnlyGate` e revalidação de senha atual em `/lab/perfil`. |
| **DevSecOps, Supply Chain & CI/CD** (`@chris-sanders` / Subagent `07d271d2`) | Dependências npm, GitHub Actions, permissões mínimas, secret leaks e integridade E2E/migrations | `typescript-eslint` atualizado para `8.73.0`, script [`verify-dependency-audit.mjs`](../../web/scripts/verify-dependency-audit.mjs) garantindo 0 vulnerabilidades em produção (`--omit=dev`), workflows endurecidos com `permissions: {}` e limpeza E2E ajustada para `clinic_memberships`. |

---

## 2. Matriz de Achados e Remediações Implementadas

### 2.1 Críticos e Altos (Banco de Dados, Storage & Privilégios)

| ID | Severidade | Achado / Vetor | Remediação Aplicada | Artefatos |
| --- | --- | --- | --- | --- |
| **CRIT-01 / HIGH-01** | Crítica / Alta | Escrita direta de `authenticated` em `public.laudos_pdf` (`laudos_pdf_insert_active_clinical_member`), policy de storage com bypass lógico `OR created_by/vet_id` em `private.can_access_reserved_laudo_object`, ausência de formato canônico/unicidade de `storage_path` e risco de reserva ilimitada/concorrente. | Removida policy de insert direto e executado `REVOKE INSERT, UPDATE, DELETE ON TABLE public.laudos_pdf FROM authenticated`; bucket `laudos` garantido como privado (10 MiB, PDF-only); índice único `uq_laudos_pdf_storage_path` e check constraint `chk_laudos_pdf_canonical_storage_path` (`NOT VALID`); reescrita `private.can_access_reserved_laudo_object` exigindo regex canônico `AND` `private.has_clinic_role`; `private.reserve_laudo_upload` com `FOR UPDATE` no pet e limite de 15 reservas/24h por ator; `private.abandon_laudo_upload` endurecida e rota `/api/laudos/[id]/abandon` conferindo `outcome.storage_path === expectedPath` antes do `.remove()`. | [`20261118120000_security_audit_total_hardening.sql`](../../supabase/migrations/20261118120000_security_audit_total_hardening.sql), [`abandon/route.ts`](../../web/src/app/api/laudos/%5Bid%5D/abandon/route.ts) |
| **HIGH-02** | Alta | Policy `profiles_select_own_or_admin` em `public.profiles`, falta de `FORCE ROW LEVEL SECURITY`, função `private.current_user_is_admin()` acessível a `authenticated`, `search_path` não fixado em funções sensíveis e `full_name` sem sanitização em `handle_new_user()`. | `FORCE ROW LEVEL SECURITY` em `public.profiles`; substituição por `profiles_select_own`; fixação de `search_path = ''` e revogação de `private.current_user_is_admin()` de `authenticated`; sanitização e truncamento de `full_name` (120 chars) em `public.handle_new_user()`; `search_path = ''` em `public.increment_ai_quota(uuid)` restrita a `service_role`. | [`20261118120000_security_audit_total_hardening.sql`](../../supabase/migrations/20261118120000_security_audit_total_hardening.sql) |
| **HIGH-03 / HIGH-04** | Alta | `clinic_id` anulável nas tabelas clínicas, ausência de `FORCE ROW LEVEL SECURITY`, constraint global `colaboradores_email_key` expondo colisão cross-tenant, FKs de `exam_result_items` sem composição com `clinic_id`, mutabilidade de colunas de tenant/`id` e alteração direta de óbito em `pets`. | `clinic_id SET NOT NULL` nas 6 tabelas clínicas; `FORCE ROW LEVEL SECURITY` em 10 tabelas públicas e `private.clinical_rate_limit_windows`; troca de `colaboradores_email_key` por `uq_colaboradores_clinic_email_ci (clinic_id, lower(email))`; FKs compostas validadas `fk_exam_items_laudo_same_clinic` e `fk_exam_items_pet_same_clinic`; `private.enforce_tenant_row_immutability` com `supabase_auth_admin`, `to_jsonb` e `id` imutável anexado também em `exam_result_items`; trigger `private.prevent_direct_pet_death_transition` em `public.pets`; grants mínimos por coluna preservando `GRANT SELECT ON TABLE ...` (`SEC-011`) e `REVOKE ALL` em `private.clinical_rate_limit_windows`. | [`20261118120000_security_audit_total_hardening.sql`](../../supabase/migrations/20261118120000_security_audit_total_hardening.sql) |

### 2.2 Backend, Proxy, APIs & Edge Function

- **Rate Limiting em Dupla Camada:**
  - **Camada Distribuída (PostgreSQL RPC):** `public.consume_clinical_rate_limit(p_scope text)` com limpeza probabilística (`random() < 0.05`) cobrindo os 8 escopos `laudo_reserve`, `laudo_abandon`, `laudo_local_extraction`, `laudo_ai_parse`, `lab_export`, `pets_mutation`, `tutores_mutation` e `profile_mutation`. Integrada em [`database.ts`](../../web/src/types/database.ts), [`server-rate-limit.ts`](../../web/src/lib/server-rate-limit.ts) e [`parse-laudo/index.ts`](../../supabase/functions/parse-laudo/index.ts).
  - **Camada In-Memory por IP:** [`ip-rate-limit.ts`](../../web/src/lib/ip-rate-limit.ts) usando chave `SHA-256` com salt efêmero de 16 bytes e teto de 2000 buckets, aplicado nas rotas `/api/health`, `/api/health/readiness`, `/api/cron/keep-alive`, `/api/cron/purge-claim-events`, `/api/cron/cleanup-storage` e `/auth/callback` (com logs removidos de [`callback/route.ts`](../../web/src/app/auth/callback/route.ts)).
- **Proteção CSRF & Navegação Fail-Closed:**
  - [`api-validation.ts`](../../web/src/lib/api-validation.ts): adicionados `ApiCsrfError` e `assertSameOriginMutation`, aplicados nas rotas mutáveis `laudos/reserve`, `laudos/[id]/abandon`, `laudos/[id]/results-local` (persistindo `origem_resultado: 'pdf_local'`), `lab/pacientes/[petId]/exames-manuais`, `pets`, `pets/[id]`, `tutores` e `tutores/[id]`.
  - [`lab/export/route.ts`](../../web/src/app/api/lab/export/route.ts): bloqueio explícito a `sec-fetch-site === 'cross-site'`, `.limit(200)` e neutralização contra CSV Injection.
  - [`route-authorization.ts`](../../web/src/lib/route-authorization.ts) & [`proxy.ts`](../../web/src/proxy.ts): `normalizePathname` (até 2 decodificações, bloqueando path traversal, caracteres de controle e encodings malformados), resposta `400` para paths inválidos, `AUTH_NO_STORE` em `/auth/*`, limpeza de `url.search` no redirect para login e matcher sem exclusão de `/lab/*.png|svg`.
- **Autorização Fail-Closed & Timing-Safe Secrets:**
  - [`server-clinic-context.ts`](../../web/src/lib/server-clinic-context.ts) & [`server-authorization.ts`](../../web/src/lib/server-authorization.ts): `resolveActiveClinicResult` fail-closed retornando `503 AUTHORIZATION_UNAVAILABLE` quando há falha de banco em `authorizeClinicAccess`.
  - [`operational-health.ts`](../../web/src/lib/operational-health.ts): `hasValidBearerSecret` normaliza segredos em digests `SHA-256` de 32 bytes antes de comparar via `timingSafeEqual`.
- **Edge Function `parse-laudo` & Funções SQL Auxiliares:**
  - [`contracts.ts`](../../supabase/functions/parse-laudo/contracts.ts): rejeita control chars, valores `< 0` ou `>= 100_000_000`, limita strings a `2048B` e campos `$.paciente.*` / `$.laboratorio` a `256B`.
  - [`parse-laudo/index.ts`](../../supabase/functions/parse-laudo/index.ts): poda de `extractionRateBuckets` (teto 1000), instrução anti-prompt-injection nos system prompts e RPC `laudo_ai_parse` quando `SUPABASE_ANON_KEY` está presente (preservando `PROMPT_VERSION = "2026-08-29.1"` e logs `event=*`).
  - Banco: `private.safe_parse_numeric` (`< 0` ou `>= 100000000` -> `NULL`), `private.refund_laudo_ia` compatível com `pg_cron` (`postgres`/`supabase_admin`) e `private.claim_laudo_ia` com auto-renovação de cota expirada.

### 2.3 Frontend, Headers HTTP, PDF, Conta & Privacidade

- **CSP e Headers Unificados:** [`security-headers.ts`](../../web/src/lib/security-headers.ts), [`next.config.ts`](../../web/next.config.ts) e [`vercel.json`](../../web/vercel.json) alinhados com `'wasm-unsafe-eval'` para OCR local, remoção de `posthog` de `script-src`, `X-XSS-Protection: 0`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `Cache-Control: private, no-store, no-cache, max-age=0, must-revalidate` em `/api/(.*)` e `Referrer-Policy: no-referrer` em `/auth/(.*)` (protegendo `/auth/callback`, `/auth/redefinir-senha` e `/auth/redefinir-senha/concluir`).
- **Contexto Clínico Server-Side (`/lab`) & SSR Gate (`/ferramentas`):** [`server-lab-context.ts`](../../web/src/lib/server-lab-context.ts) (`requireLabClinicContext`) aplicado em 6 páginas de `/lab/*`; [`VetOnlyGate.tsx`](../../web/src/components/ferramentas/VetOnlyGate.tsx) + [`injuria-renal-aguda/page.tsx`](../../web/src/app/ferramentas/injuria-renal-aguda/page.tsx) passam a validar cookie `sb-*` + `profiles.role` no SSR antes de renderizar `<IRACalculator />`.
- **Upload & Parser Local de PDF:** [`pdf-extractor.client.ts`](../../web/src/lib/lab/local-extraction/pdf-extractor.client.ts) e [`LaudoUploader.tsx`](../../web/src/components/lab/LaudoUploader.tsx) validam magic bytes `%PDF-` (`0x25 0x50 0x44 0x46 0x2d`) e configuram `enableXfa: false, disableRange: true, disableStream: true, disableAutoFetch: true` no `pdfjs-dist` v5.
- **Perfil & Sessões:** [`ProfileForm.tsx`](../../web/src/app/lab/perfil/ProfileForm.tsx) exige validação da senha atual (`signInWithPassword`) na troca de senha ou e-mail e revoga outras sessões ativas (`signOut({ scope: 'others' })`).
- **LGPD & Indexação:** [`analytics-consent.ts`](../../web/src/lib/analytics-consent.ts), [`CookiePreferencesButton.tsx`](../../web/src/components/ui/CookiePreferencesButton.tsx) e [`Footer.tsx`](../../web/src/components/marketing/Footer.tsx) permitem reabrir/revogar preferências de cookies no rodapé; [`robots.ts`](../../web/src/app/robots.ts) e [`sitemap.ts`](../../web/src/app/sitemap.ts) bloqueiam `/api/`, `/auth/`, `/lab/`, `/portal`, `/admin/` e `/dashboard/` com canonical fallback `https://www.vetdorim.com.br`.

### 2.4 Supabase Config, Supply Chain, CI/CD & Testes

- [`supabase/config.toml`](../../supabase/config.toml): `graphql_public` removido de `schemas`; `[realtime] enabled = false`; `[storage] file_size_limit = "10MiB"`; `[storage.s3_protocol] enabled = false`; `[storage.vector] enabled = false`; `[auth.email] max_frequency = "60s"`; `[auth.mfa.totp]` desativado (`enroll_enabled = false`, `verify_enabled = false`) por decisão de produto para priorizar acesso simples e prático sem 2FA.
- [`ci.yml`](../../.github/workflows/ci.yml), [`node.js.yml`](../../.github/workflows/node.js.yml) & [`supabase-keep-alive.yml`](../../.github/workflows/supabase-keep-alive.yml): `permissions: {}`, `concurrency`, `set -euo pipefail`, remoção de `cat /tmp/*.json`, matrix via `env:`, inclusão de `local-ocr-assets.spec.ts` / `motion-runtime.spec.ts` e troca do audit do CI para `npm run check:audit`.
- Novos testes & contratos atualizados: [`cybersecurity-hardening.test.ts`](../../web/tests/unit/cybersecurity-hardening.test.ts), [`tenancy-context.test.ts`](../../web/tests/unit/tenancy-context.test.ts), [`api-security.spec.ts`](../../web/tests/e2e/api-security.spec.ts), `supabase/tests/*.sql` (`production_safety_test.sql`, `sprint0_security_forward_test.sql`, `tenancy_structural_test.sql`), `04-release-blocker-summary.sql` e os 5 scripts E2E/cleanup em `web/scripts/`.

---

## 3. Evidências de Verificação Local (Pós-Última Edição de Código)

Todos os comandos abaixo foram executados **após a última edição** (`next.config.ts`, `vercel.json` e `cybersecurity-hardening.test.ts`), com saída de código `0` e sem mutação remota:

| Gate / Comando | Resultado | Escopo / Observações |
| --- | --- | --- |
| `npm run audit:staging` (raiz) | **PASS** | `mode: "plan-only"`, `networkConsulted: false`, 5 scripts SQL somente leitura validados (`01-catalog-inventory.sql` a `05-role-escalation-audit.sql`). |
| `npm run check:predeploy` → `verify-supply-chain.mjs` | **PASS** | `web/package-lock.json`: `683` pacotes de registry e `4` pacotes com lifecycle revisados (`0` raiz, `127` `.aiox-core`, `351` health-dashboard). |
| `npm run check:predeploy` → `verify-migration-integrity.mjs --check` | **PASS** | `30` arquivos SQL ativos verificados por `SHA-256` em bytes brutos, `7` transições divulgadas (escopo local). |
| `npm run check:predeploy` → `verify-edge-functions.mjs` | **PASS** | `parse-laudo`: `3` arquivos fonte recursivos, `2` pins exatos de dependência, Deno lock v4, JWT obrigatório. |
| `npm run check:predeploy` → `verify-dependency-audit.mjs` (`check:audit`) | **PASS** | `0` vulnerabilidades de runtime em produção (`--omit=dev`) e `0` vulnerabilidades não permitidas na árvore completa. |
| `npm run check:predeploy` → `verify-sprint-3-safety.mjs` + `node --check` | **PASS** | Verificações estáticas Sprint 3 aprovadas + checagem de sintaxe em todos os `9` scripts operacionais/E2E `.mjs`. |
| `npm run check:predeploy` → `npm run lint` (`eslint src/`) | **PASS** | `0` erros e saída limpa. |
| `npm run check:predeploy` → `npm run typecheck` (`tsc --noEmit`) | **PASS** | `0` erros de tipagem TypeScript. |
| `npm run check:predeploy` → `npm test` | **PASS** | **177/177 passed**, `0` failed, `0` skipped em 13 suítes unitárias (incluindo `cybersecurity-hardening.test.ts`). |
| `npm run check:predeploy` → `npm run build` | **PASS** | `Next.js 16.4.5 (Turbopack)`, `OCR local pronto (5 arquivos same-origin)`, `28` páginas estáticas geradas e Proxy ativo (com env placeholders locais). |
| `npm run check:predeploy` → Playwright E2E Chromium (11 specs) | **77 passed, 0 failed, 4 skipped** | Executado contra servidor de produção (`next start`) na porta `3310` com `--workers=1`. Os `4` casos pulados pertencem exclusivamente a `tests/e2e/auth.spec.ts` (fluxos autenticados que exigem credenciais reais de staging). |

---

## 4. Runbook Obrigatório de Ações Manuais Pendentes em Produção

Antes de levar qualquer parte desta blindagem ao projeto remoto (`<production-project-ref>`), executar **nesta ordem**:

1. **Auditoria Somente Leitura Pré-Migration (Produção / Staging):**
   - Confirmar que o histórico remoto em `supabase_migrations.schema_migrations` está reconciliado até a versão `20261104000000` (conforme [`reconciliacao-producao-2026-11-04.md`](../../docs/relatorios/reconciliacao-producao-2026-11-04.md)).
   - Executar consulta `SELECT ... WHERE clinic_id IS NULL` nas 6 tabelas clínicas alvo de `SET NOT NULL`, verificar duplicidades case-insensitive de `(clinic_id, lower(email))` em `public.colaboradores` e inspecionar registros em `public.laudos_pdf` que não atendam à regex canônica de `storage_path`.
2. **Backup e Aplicação Controlada das Migrations #30 e #31:**
   - Gerar backup lógico/snapshot no painel Supabase antes da janela de manutenção.
   - Aplicar [`20261118120000_security_audit_total_hardening.sql`](../../supabase/migrations/20261118120000_security_audit_total_hardening.sql) e [`20261119120000_pet_death_audit_workflow.sql`](../../supabase/migrations/20261119120000_pet_death_audit_workflow.sql) em sequência via `supabase db push` ou SQL Editor (em ambiente dev/staging com `pgTAP` disponível, rodar também `supabase/tests/*.sql`).
   - Após eventuais saneamentos de dados legados em `public.laudos_pdf`, executar manualmente `ALTER TABLE public.laudos_pdf VALIDATE CONSTRAINT chk_laudos_pdf_canonical_storage_path;`.
3. **Deploy da Edge Function `parse-laudo` e Configuração de Painel:**
   - Publicar a nova versão da função (`supabase functions deploy parse-laudo`).
   - Conferir segredos e variáveis em Produção (Vercel e Supabase Secrets): `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e chave do provedor de IA usado pela Edge Function.
   - Confirmar o rate limit de e-mail (`60s`) e MFA TOTP desativado no painel **Supabase Authentication** para espelhar `supabase/config.toml`, além das configurações de segurança do bucket privado `laudos`.

---

## 5. Plano de Iteração e Melhoria Contínua (Próxima Fase Recomendada)

Concluída a blindagem defensiva desta auditoria, a sequência recomendada de evolução é:

1. **Iteração A — Observabilidade e Telemetria de Segurança:** instrumentar agregação/alertas operacionais para eventos `429 Rate Limit`, `403 CSRF`, `503 AUTHORIZATION_UNAVAILABLE` e erros de extração/Edge IA (sem logar PII). *(Concluída)*
2. ~~**Iteração B — MFA TOTP na Interface (`/lab/perfil`)**~~: **descartada por decisão de produto** para manter o acesso ao sistema simples e prático sem fricção de 2FA.
3. **Iteração C — Fluxo Transacional Auditável de Óbito de Paciente (`pets`):** implementar RPC/ação dedicada e auditada para transição de óbito, já que mutações diretas da coluna passaram a ser bloqueadas por `private.prevent_direct_pet_death_transition`. *(Concluída)*
4. **Iteração D — Seletor Explícito Multi-Clínica no `/lab`:** permitir troca explícita de clínica ativa na UI quando o usuário possuir múltiplos vínculos em `clinic_memberships` via cookie HttpOnly validado no servidor ([`active-clinic/route.ts`](../../web/src/app/api/lab/active-clinic/route.ts), [`ClinicSwitcher.tsx`](../../web/src/components/lab/ClinicSwitcher.tsx), [`active-clinic-cookie.ts`](../../web/src/lib/active-clinic-cookie.ts) e [`server-active-clinic.ts`](../../web/src/lib/server-active-clinic.ts)). *(Concluída)*
5. **Iteração E — Homologação Clínica e Suíte E2E Autenticada em Staging:** concluída localmente a preparação técnica e de governança — correção de ordenação filtrada e validação civil/data futura em [`peso-controller.ts`](../../web/src/lib/peso-controller.ts), cobertura de testes dos motores clínicos e contenção das 3 calculadoras prescritivas em [`clinical-homologation-gates.test.ts`](../../web/tests/unit/clinical-homologation-gates.test.ts), expansão de [`e2e-lab-crud-cycle.mjs`](../../web/scripts/e2e-lab-crud-cycle.mjs) e [`lab-crud.spec.ts`](../../web/tests/e2e/lab-crud.spec.ts) para validar guardrails de óbito (Iteração C) e troca/isolamento entre duas clínicas (Iteração D), suporte `--local` em [`e2e-auth-rls-cycle.mjs`](../../web/scripts/e2e-auth-rls-cycle.mjs), correção da detecção do CLI em [`remote-readiness-check.mjs`](../../web/scripts/remote-readiness-check.mjs), além do dossiê [`homologacao-clinica-checklist-2026-11-19.md`](../../docs/clinical/homologacao-clinica-checklist-2026-11-19.md) e do runbook [`staging-homologacao-e2e-runbook.md`](../../docs/runbooks/staging-homologacao-e2e-runbook.md). *(Preparação local concluída; execução autenticada completa depende de Docker ativo ou projeto staging isolado e a reativação das 3 calculadoras prescritivas depende da homologação formal exclusiva do Clínico e Administrador)*
