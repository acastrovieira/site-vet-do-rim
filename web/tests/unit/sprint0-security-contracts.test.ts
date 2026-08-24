import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const repoRoot = resolve(import.meta.dirname, '../../..')
const migration = readFileSync(
  resolve(
    repoRoot,
    'supabase/migrations/20260823234842_sprint0_security_forward_hardening.sql',
  ),
  'utf8',
)
const historicalMigrations = {
  missingIndexes: readFileSync(
    resolve(repoRoot, 'supabase/migrations/20260823000000_perf_001_missing_indexes.sql'),
    'utf8',
  ),
  rlsOptimization: readFileSync(
    resolve(repoRoot, 'supabase/migrations/20260823000100_perf_002_rls_policy_optimization.sql'),
    'utf8',
  ),
  pdfLifecycle: readFileSync(
    resolve(repoRoot, 'supabase/migrations/20260823000300_pdf_lifecycle_and_populate.sql'),
    'utf8',
  ),
}
const integrityManifest = JSON.parse(
  readFileSync(resolve(repoRoot, 'supabase/migration-integrity.json'), 'utf8'),
) as {
  approvedHistoricalTransitions: Array<{
    file: string
    baseSha256: string
    currentSha256: string
    remoteArtifactSha256: string | null
    remoteReconciliationRequired: boolean
    ticket: string
  }>
}

test('Sprint 0 forward migration replaces global-role RLS with clinic membership', () => {
  const tenantTables = [
    'tutores',
    'pets',
    'triagens',
    'follow_ups',
    'colaboradores',
    'laudos_pdf',
    'exam_result_items',
  ]

  assert.match(migration, /FROM pg_policies/)
  assert.match(migration, /DROP POLICY %I ON %I\.%I/)
  const policySection = migration.slice(
    migration.indexOf('CREATE POLICY'),
    migration.indexOf('REVOKE UPDATE ON TABLE public.laudos_pdf'),
  )
  assert.doesNotMatch(policySection, /current_user_is_vet_or_admin/)

  for (const table of tenantTables) {
    assert.match(migration, new RegExp(`ON public\\.${table}`))
  }

  const membershipChecks = migration.match(/private\.has_clinic_role\(/g) ?? []
  assert.ok(membershipChecks.length >= 18)
  assert.match(migration, /ARRAY\['clinic_admin', 'vet', 'recepcao'\]::text\[\]/)
  assert.match(migration, /ARRAY\['clinic_admin', 'vet'\]::text\[\]/)
})

test('authenticated cannot mutate laudo lifecycle fields directly', () => {
  assert.match(
    migration,
    /REVOKE UPDATE ON TABLE public\.laudos_pdf FROM authenticated/,
  )
  assert.doesNotMatch(
    migration,
    /CREATE POLICY\s+\w+\s+ON public\.laudos_pdf\s+FOR UPDATE/,
  )
})

test('population RPC uses a public invoker wrapper with service-role-only execution', () => {
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.populate_exam_result_items\(p_laudo_id uuid\)/,
  )
  assert.match(migration, /SECURITY INVOKER\s+SET search_path = ''/)
  assert.match(
    migration,
    /SELECT private\.populate_exam_result_items\(p_laudo_id\)/,
  )
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.populate_exam_result_items\(uuid\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/,
  )
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.populate_exam_result_items\(uuid\)\s+TO service_role/,
  )
  assert.doesNotMatch(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.populate_exam_result_items\(uuid\)\s+TO (?:PUBLIC|anon|authenticated)/,
  )
})

test('cleanup index forward definition is transaction-safe', () => {
  const executableSql = migration.replace(/^\s*--.*$/gm, '')
  assert.match(
    executableSql,
    /CREATE INDEX IF NOT EXISTS idx_laudos_pending_deletion/,
  )
  assert.doesNotMatch(executableSql, /CREATE INDEX CONCURRENTLY/)
})

test('Data API grants are explicit for service and authenticated roles', () => {
  assert.match(migration, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE[\s\S]*TO service_role/)
  assert.match(migration, /GRANT SELECT, INSERT, UPDATE ON TABLE[\s\S]*TO authenticated/)
  assert.match(migration, /GRANT SELECT, INSERT ON TABLE public\.laudos_pdf TO authenticated/)
  assert.match(migration, /REVOKE UPDATE ON TABLE public\.laudos_pdf FROM authenticated/)
})

test('three disclosed historical transitions remove only the proven replay blockers', () => {
  assert.match(historicalMigrations.missingIndexes, /relname AS tablename/)
  assert.match(historicalMigrations.missingIndexes, /indexrelname AS indexname/)

  const executableRls = historicalMigrations.rlsOptimization.replace(/^\s*--.*$/gm, '')
  assert.match(executableRls, /private\.current_user_is_admin\(\)/)
  assert.doesNotMatch(executableRls, /public\.current_user_is_admin\(\)/)

  const executableLifecycle = historicalMigrations.pdfLifecycle.replace(/^\s*--.*$/gm, '')
  assert.match(executableLifecycle, /CREATE INDEX IF NOT EXISTS idx_laudos_pending_deletion/)
  assert.doesNotMatch(executableLifecycle, /CREATE INDEX CONCURRENTLY/)

  const expectedFiles = new Set([
    '20260823000000_perf_001_missing_indexes.sql',
    '20260823000100_perf_002_rls_policy_optimization.sql',
    '20260823000300_pdf_lifecycle_and_populate.sql',
  ])
  const sprintTransitions = integrityManifest.approvedHistoricalTransitions.filter(
    ({ file }) => expectedFiles.has(file),
  )

  assert.equal(sprintTransitions.length, expectedFiles.size)
  for (const event of sprintTransitions) {
    assert.notEqual(event.baseSha256, event.currentSha256)
    assert.equal(event.remoteArtifactSha256, null)
    assert.equal(event.remoteReconciliationRequired, true)
    assert.equal(event.ticket, 'AUDIT-001')
  }
})
