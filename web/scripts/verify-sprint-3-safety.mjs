import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const webRoot = resolve(import.meta.dirname, '..')
const repoRoot = resolve(webRoot, '..')
const edgeSource = readFileSync(resolve(repoRoot, 'supabase/functions/parse-laudo/index.ts'), 'utf8')
const requiredRoutes = [
  'src/app/api/laudos/reserve/route.ts',
  'src/app/api/laudos/[id]/results-local/route.ts',
  'src/app/api/lab/export/route.ts',
]

for (const route of requiredRoutes) {
  const source = readFileSync(resolve(webRoot, route), 'utf8')
  if (!source.includes('consumeClinicalRateLimit') || !source.includes("'Retry-After'")) {
    throw new Error(`Sprint 3 rate-limit contract missing in ${route}`)
  }
}

const edgeLogLines = edgeSource.split('\n').filter((line) => line.includes('console.'))
if (!edgeLogLines.every((line) => /event=[a-z_]+/.test(line))) {
  throw new Error('Edge logs must use allowlisted event names instead of sensitive request or provider data')
}

if (!edgeSource.includes('isExtractionRateLimited(user.id)') || !edgeSource.includes('function rateLimited(')) {
  throw new Error('Edge extraction rate limit is missing')
}

const runbook = resolve(repoRoot, 'docs/runbooks/sprint-3-release-privacy-backup.md')
if (!existsSync(runbook)) throw new Error('Sprint 3 operational runbook is missing')

const migration = resolve(repoRoot, 'supabase/migrations/20260824004343_distributed_rate_limit.sql')
const migrationSource = readFileSync(migration, 'utf8')
for (const requirement of [
  'private.clinical_rate_limit_windows',
  'public.consume_clinical_rate_limit',
  'SECURITY DEFINER',
  'SET search_path = pg_catalog, private, auth',
  'GRANT EXECUTE ON FUNCTION public.consume_clinical_rate_limit(text) TO authenticated',
]) {
  if (!migrationSource.includes(requirement)) throw new Error(`Distributed limiter migration is missing: ${requirement}`)
}

console.log('Sprint 3 safety checks passed (static/local evidence; provider and staging recovery remain unverified).')
