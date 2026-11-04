# Vet do Rim — Site e Plataforma

Aplicativo Next.js (`web/`) com Supabase (`supabase/`) para ferramentas clínicas públicas e o laboratório do veterinário (`/lab`).

## Comandos (a partir da raiz)

- `npm run lint` / `npm run typecheck` / `npm test`
- `npm run check:predeploy` — gate local seguro (supply-chain, migrations, edge, lint, tipos, testes, build, E2E)
- `npm run audit:staging` — plano offline de auditoria SQL somente leitura

## Estrutura

- `web/` — app, API routes, testes (`web/tests`)
- `supabase/` — migrations (append-only, ver `supabase/migration-integrity.json`) e Edge Functions
- `docs/` — stories, ADRs, runbooks e relatórios

## Regras

- `git push`, PR e `supabase db push` são exclusivos do `@devops` (ver `AGENTS.md`).
- Calculadoras clínicas sem revisão veterinária permanecem contidas por `ClinicalReviewNotice`.
