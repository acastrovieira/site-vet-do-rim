import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  assertReadOnlySql,
  assertStagingAuditConnection,
  parseStagingAuditArgs,
  parseStagingReleaseGateOutput,
  redactAuditDiagnostic,
} from '../../scripts/lib/staging-audit-safety.mjs'

test('staging audit defaults to a network-free plan', () => {
  assert.deepEqual(parseStagingAuditArgs([]), { runRemote: false })
  assert.deepEqual(parseStagingAuditArgs(['--plan']), { runRemote: false })
  assert.deepEqual(parseStagingAuditArgs(['--remote-read-only']), { runRemote: true })
  assert.throws(() => parseStagingAuditArgs(['--apply']))
  assert.throws(() => parseStagingAuditArgs(['--plan', '--remote-read-only']))
})

test('staging audit SQL is transactionally read-only and rollback-only', () => {
  assert.equal(assertReadOnlySql(
    'BEGIN TRANSACTION READ ONLY; SELECT 1; ROLLBACK;',
  ), true)
  assert.throws(() => assertReadOnlySql('SELECT 1;'))
  assert.throws(() => assertReadOnlySql(
    'BEGIN TRANSACTION READ ONLY; UPDATE public.profiles SET role = role; ROLLBACK;',
  ))
  assert.throws(() => assertReadOnlySql(
    'BEGIN TRANSACTION READ ONLY;\n\\include unsafe.sql\nROLLBACK;',
  ))
})

test('every committed staging audit SQL passes the offline safety verifier', () => {
  const sqlDirectory = resolve(import.meta.dirname, '../../scripts/staging-audit/sql')
  const files = readdirSync(sqlDirectory).filter((name) => name.endsWith('.sql'))
  assert.ok(files.length >= 3)

  for (const file of files) {
    assert.equal(
      assertReadOnlySql(readFileSync(resolve(sqlDirectory, file), 'utf8'), file),
      true,
    )
  }
})

test('staging release summary blocks missing Data API grants', () => {
  const summary = readFileSync(
    resolve(import.meta.dirname, '../../scripts/staging-audit/sql/04-release-blocker-summary.sql'),
    'utf8',
  )

  assert.match(summary, /SEC-011-authenticated-data-api-grants/)
  assert.match(summary, /SEC-012-service-role-data-api-grants/)
  assert.match(summary, /grantee = 'authenticated'/)
  assert.match(summary, /grantee = 'service_role'/)
  assert.match(summary, /privilege_type IN \('SELECT', 'UPDATE'\)/)
  assert.match(summary, /vetdorim-release-gate-v1/)
  assert.doesNotMatch(summary, /has_function_privilege\('PUBLIC'/)
})

test('staging release gate parser fails closed on false or malformed contracts', () => {
  const failed = parseStagingReleaseGateOutput(JSON.stringify({
    contract: 'vetdorim-release-gate-v1',
    passed: false,
    checks: [{
      checkId: 'SEC-001',
      severity: 'P0',
      passed: false,
      expectation: 'tenant isolation must exist',
    }],
  }))

  assert.equal(failed.passed, false)
  assert.throws(() => parseStagingReleaseGateOutput('{}'))
  assert.throws(() => parseStagingReleaseGateOutput(JSON.stringify({
    contract: 'vetdorim-release-gate-v1',
    passed: true,
    checks: [{}],
  })))
})

test('staging connection contract rejects production, mismatches and weak confirmation', () => {
  const projectRef = 'abcdefghijklmnopqrst'
  const supabaseUrl = `https://${projectRef}.supabase.co`
  const valid = {
    projectRef,
    supabaseUrl,
    environment: 'staging',
    confirmation: `CONFIRM_STAGING_READ_ONLY:${projectRef}`,
    dbHost: `db.${projectRef}.supabase.co`,
    dbUser: 'postgres',
    dbName: 'postgres',
    dbPort: '5432',
  }

  assert.deepEqual(assertStagingAuditConnection(valid), {
    projectRef,
    dbHost: valid.dbHost,
    dbUser: 'postgres',
    dbName: 'postgres',
    dbPort: '5432',
  })
  assert.throws(() => assertStagingAuditConnection({ ...valid, environment: 'production' }))
  assert.throws(() => assertStagingAuditConnection({ ...valid, confirmation: '' }))
  assert.throws(() => assertStagingAuditConnection({ ...valid, dbHost: 'db.other.supabase.co' }))

  assert.doesNotThrow(() => assertStagingAuditConnection({
    ...valid,
    dbHost: 'aws-0-sa-east-1.pooler.supabase.com',
    dbUser: `postgres.${projectRef}`,
    dbPort: '6543',
  }))
})

test('staging audit diagnostics mask credentials and personal e-mail', () => {
  const output = redactAuditDiagnostic(
    'password=super-secret-value owner=tutor@example.test',
    ['super-secret-value'],
  )
  assert.doesNotMatch(output, /super-secret-value|tutor@example\.test/)
  assert.match(output, /\[REDACTED\]/)
  assert.match(output, /\[REDACTED_EMAIL\]/)
})

test('staging audit runner keeps credentials out of process arguments and defaults read-only', () => {
  const source = readFileSync(
    resolve(import.meta.dirname, '../../scripts/staging-audit.mjs'),
    'utf8',
  )
  const envExample = readFileSync(
    resolve(import.meta.dirname, '../../.env.example'),
    'utf8',
  )

  assert.match(source, /PGPASSWORD: password/)
  assert.match(source, /default_transaction_read_only=on/)
  assert.match(source, /if \(!runRemote\)/)
  assert.doesNotMatch(source, /['"]--password['"]/)
  assert.match(envExample, /STAGING_AUDIT_CONFIRMATION=/)
  assert.match(envExample, /SUPABASE_DB_HOST=/)
})
