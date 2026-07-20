# Auditoria Completa + Plano de Ação — 2026-07-18

Escopo auditado: `web/` (Next.js 16, React 19), `supabase/` (11 migrations, RLS, Edge Function `parse-laudo`), scripts de verificação, testes e documentação. Verificação executada nesta sessão: typecheck ✅, lint ✅, 105/105 testes unitários ✅.

Estado vigente do projeto: **NO-GO para dados reais** (coerente com `docs/auditoria-production-readiness-2026-07-16.md`). Esta auditoria confirma que os bloqueios documentados continuam abertos e não encontrou regressões novas graves.

---

## 1. Pontos fortes confirmados (não mexer, preservar)

- Segredos fora do git: `.env*` ignorado nos dois níveis; apenas `.env.example` versionado. `env.ts` rejeita chave `service_role` em variável pública.
- Autorização em 3 camadas: `proxy.ts` (rota) → `authorizeServerRoles` (API, papel lido de `profiles`, nunca de `user_metadata`) → RLS (banco). Falhas negam acesso (fail-closed).
- APIs com validação rígida: content-type, limite de 32 KiB com leitura em stream, allowlist de campos, limites numéricos, UUID, respostas de erro sem vazamento de detalhes internos.
- RLS endurecida: trigger anti-escalada de papel em `profiles`, quota de IA imutável pelo próprio usuário, storage isolado por pasta `auth.uid()`, privilégios do Data API restringidos.
- Edge Function `parse-laudo`: exige JWT + papel vet/admin, valida dono do laudo e prefixo do storage, assinatura PDF, limites de tamanho, claim condicional por estado, contenção de inferência clínica (`containClinicalInference`), CORS com allowlist.
- Ferramentas clínicas de risco (fluidoterapia, reposição eletrolítica, dieta renal) corretamente quarentenadas: página substituída por aviso, `robots: noindex`, fora do sitemap.
- Headers de segurança no `vercel.json` (CSP, HSTS, X-Frame-Options DENY, nosniff), redirect pós-login validado contra open redirect.
- Anti-óbito acidental: mudança para `obito` bloqueada na API, exigindo fluxo transacional dedicado; update com verificação otimista de estado.

## 2. Achados — brechas e fragilidades abertas

### P0 (bloqueiam produção com dados reais)

| # | Achado | Evidência |
|---|--------|-----------|
| P0-1 | **Sem isolamento por clínica/profissional.** Policies de `tutores`, `pets`, `triagens`, `follow_ups` autorizam por papel: qualquer vet autenticado lê/edita a base clínica inteira de todos os outros vets. | `20260623000100_auth_rls_hardening.sql` (policies `vet_admin_*`); drafts prontos e não aplicados em `docs/architecture/drafts/tenancy/` |
| P0-2 | **Motores clínicos reprovados em revisão (8 falhas P0)** — fluidoterapia, eletrólitos e dieta renal. Quarentena aplicada, mas os motores não podem reativar sem correção + homologação clínica independente. | `docs/auditoria-production-readiness-2026-07-16.md`; `ClinicalReviewNotice` |
| P0-3 | **Processamento de laudo não é transação idempotente.** Claim, resultado e cota são operações separadas; falha entre elas deixa estado inconsistente (cota consumida sem resultado ou vice-versa). Contrato claim-finalize-refund existe apenas como draft quarentenado. | `parse-laudo/index.ts` (linhas 521–612); `docs/architecture/drafts/laudos-ia/` |
| P0-4 | **Cota de IA com TOCTOU:** leitura da cota antes do claim e incremento só no fim; requisições paralelas sobre laudos distintos podem ultrapassar o limite. | `parse-laudo/index.ts` (linhas 483–487 vs 609) |
| P0-5 | **Auditoria do histórico de escalada de papel pendente** nos dados já existentes do projeto remoto (antes do hardening). | Auditoria 2026-07-16, item P0 |

### P1 (antes do go-live)

| # | Achado |
|---|--------|
| P1-1 | Config Auth remota não reconciliada: signup aberto, confirmação de email off, MFA off, proteção contra senhas vazadas off (plano Free). Estado local (`config.toml`) ≠ prova do remoto. |
| P1-2 | Onboarding profissional inexistente: sem workflow auditável de verificação/aprovação de vets (autocadastro limitado a tutor — mitigação correta, mas bloqueia operação). |
| P1-3 | Deleção/compensação de Storage não determinística: rollback de upload pode deixar órfãos; DELETE tenant-aware pendente. |
| P1-4 | Ciclo de vida de PII (LGPD): `tutores` guarda CPF, endereço, telefone sem política de retenção, sem fluxo de exclusão/exportação por titular, sem DPA formalizado com subprocessadores (Supabase, Vercel, PostHog, Google/OpenAI). |
| P1-5 | CI criado (FIX-99), mas primeira execução no GitHub e required checks nunca rodaram remotamente. |
| P1-6 | E2E autenticado real (PKCE, recovery, cookies, upload+IA) nunca executado no staging hospedado. |

### P2 (melhorias)

| # | Achado |
|---|--------|
| P2-1 | CSP com `script-src 'unsafe-inline'` — migrar para nonce/hash reduz superfície XSS. |
| P2-2 | `http://localhost:3000` na allowlist CORS da Edge Function em produção. Mover para env por ambiente. |
| P2-3 | Sem rate limiting aplicativo nas rotas `/api/*` e no endpoint de IA (custo e brute-force dependem só de Vercel/Supabase). |
| P2-4 | Observabilidade: runbook existe, mas sem error tracking real (Sentry ou similar), sem alertas; PostHog é só analytics. |
| P2-5 | Dívida mecânica: `deno fmt` histórico; `qualities` de imagem e cache TTL ok, Lighthouse/performance nunca medidos formalmente. |
| P2-6 | `interpretacao_ia` sem proveniência (modelo, versão do prompt, data, hash do PDF) gravada junto ao resultado. |

---

## 3. Plano de ação por fases

Convenção de modelo (roteamento de custo, alinhado à filosofia do `squad-chief`: "o modelo mais barato que mantém qualidade"):
- **Opus/Fable** → arquitetura, segurança, SQL de RLS, motores clínicos (erro é caro).
- **Sonnet** → implementação guiada por spec, testes, refactors.
- **Haiku** → tarefas mecânicas (formatação, checklists, execução de scripts).

> Nota: a homologação clínica da Fase 4 exige revisores humanos (médicos-veterinários). Nenhum agente/modelo substitui essa assinatura.

### Fase 0 — Baseline e CI remoto (curta, destrava tudo)

| Tarefa | Agente squad | Modelo |
|--------|--------------|--------|
| 0.1 Rodar o workflow de CI no GitHub pela 1ª vez, configurar required checks (P1-5) | `devops` | Sonnet |
| 0.2 Reconciliar Dashboard Supabase × `config.toml`: fechar signup, ligar confirmação de email, ativar proteção de senha vazada (avaliar upgrade de plano p/ MFA) (P1-1) | `devops` + `cyber-chief` (revisão) | Sonnet (exec) / Opus (revisão) |
| 0.3 Auditar dados remotos existentes: perfis com papel elevado, laudos/objetos órfãos (P0-5) | `db-sage` | Sonnet |
| 0.4 Limpar dívidas mecânicas (`deno fmt`, envs de CORS da Edge) (P2-2, P2-5) | `dev` | Haiku |

### Fase 1 — Tenancy / isolamento clínico (P0-1) — a fase mais crítica

| Tarefa | Agente squad | Modelo |
|--------|--------------|--------|
| 1.1 Finalizar ADR-001 e o modelo (clinica_id vs vet_id owner) a partir dos drafts `01-expand.sql` / `02-enforce.sql` | `architect` | Opus |
| 1.2 Migration expand (colunas + backfill) forward-only | `db-sage` | Opus |
| 1.3 Migration enforce (novas policies com escopo de dono/clínica) | `db-sage` | Opus |
| 1.4 Testes negativos pgTAP (`90-negative-tests.sql`): vet A não lê dados do vet B | `qa` | Sonnet |
| 1.5 Ajustar APIs/queries do frontend para o novo escopo + E2E de isolamento com 2 vets | `dev` + `qa` | Sonnet |

### Fase 2 — Transação de laudos IA (P0-3, P0-4, P2-6)

| Tarefa | Agente squad | Modelo |
|--------|--------------|--------|
| 2.1 Promover o draft claim-finalize-refund para RPC transacional (claim atômico com débito de cota + refund em falha) | `db-sage` | Opus |
| 2.2 Refatorar `parse-laudo` para usar a RPC; eliminar TOCTOU da cota | `dev` | Sonnet |
| 2.3 Gravar proveniência no `resultado_ia` (provider, modelo, versão do prompt, timestamp, hash do PDF) | `dev` | Sonnet |
| 2.4 Testes de contrato (test-matrix.md já existe) + teste de concorrência | `qa` | Sonnet |
| 2.5 Compensação determinística de Storage no rollback de upload (P1-3) | `dev` + `db-sage` | Sonnet |

### Fase 3 — Onboarding profissional e Auth (P1-2)

| Tarefa | Agente squad | Modelo |
|--------|--------------|--------|
| 3.1 Spec do workflow de verificação de vet (CRMV, aprovação por admin, trilha de auditoria) | `pm` + `architect` | Opus |
| 3.2 Implementar fluxo (tabela de solicitações, promoção auditável de papel, e-mails) | `dev` | Sonnet |
| 3.3 E2E autenticado completo em staging: PKCE, recovery, upload+IA (P1-6) | `qa` | Sonnet |

### Fase 4 — Reativação dos motores clínicos (P0-2)

| Tarefa | Agente squad | Modelo |
|--------|--------------|--------|
| 4.1 Reescrever motores como funções puras separadas da UI, com análise dimensional explícita | `dev` | Opus |
| 4.2 Golden cases + casos de fronteira por espécie/fase (fluido, eletrólitos, dieta); catálogo nutricional versionado por SKU/país/data | `qa` + `data-chief` | Opus (casos) / Sonnet (implementação) |
| 4.3 Duas revisões clínicas independentes + assinatura formal (intensivista/nefro/nutrição) | **Humanos** (Dr. Anderson + revisor externo) | — |
| 4.4 Reativar rotas, sitemap e monitorar | `dev` | Haiku |

### Fase 5 — LGPD e ciclo de vida de dados (P1-4)

| Tarefa | Agente squad | Modelo |
|--------|--------------|--------|
| 5.1 Mapear PII, definir retenção, base legal e fluxos de exclusão/exportação por titular | `legal-chief` | Opus |
| 5.2 Implementar exclusão em cascata auditável (tutor → pets → laudos → storage) | `db-sage` + `dev` | Sonnet |
| 5.3 Revisar política de privacidade/termos contra o comportamento real do sistema | `legal-chief` | Sonnet |

### Fase 6 — Hardening e operação (P2)

| Tarefa | Agente squad | Modelo |
|--------|--------------|--------|
| 6.1 Rate limiting nas rotas `/api/*` e na Edge Function (P2-3) | `dev` + `cyber-chief` | Sonnet |
| 6.2 CSP com nonce, remover `unsafe-inline` de script-src (P2-1) | `dev` | Sonnet |
| 6.3 Error tracking + alertas conforme `observability-production-runbook.md` (P2-4) | `devops` | Sonnet |
| 6.4 Lighthouse/performance budget no CI (P2-5) | `devops` | Haiku |

### Fase 7 — Gate de go-live

| Tarefa | Agente squad | Modelo |
|--------|--------------|--------|
| 7.1 Re-executar auditoria de production readiness completa (staging paridade, advisors, pgTAP, E2E) | `qa` + `aiox-master` (orquestração) | Opus |
| 7.2 Decisão GO/NO-GO documentada com evidências | `po` + Dr. Anderson | — |

**Ordem obrigatória:** Fases 0→1→2 são sequenciais (tenancy antes de qualquer dado real). Fases 3, 5 e 6 podem correr em paralelo após a Fase 1. Fase 4 é independente mas gargalada pela revisão humana — iniciar 4.1/4.2 cedo. Fase 7 só após todas.
