import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { envValue, loadLocalEnv } from './lib/env-file.mjs'
import {
  assertReadOnlySql,
  assertStagingAuditConnection,
  parseStagingAuditArgs,
  parseStagingReleaseGateOutput,
  redactAuditDiagnostic,
} from './lib/staging-audit-safety.mjs'

const sqlDirectory = join(import.meta.dirname, 'staging-audit', 'sql')
const sqlFiles = readdirSync(sqlDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => join(sqlDirectory, name))

let runRemote = false
try {
  ;({ runRemote } = parseStagingAuditArgs(process.argv.slice(2)))
  if (sqlFiles.length === 0) throw new Error('No staging audit SQL files were found.')
  for (const filePath of sqlFiles) {
    assertReadOnlySql(readFileSync(filePath, 'utf8'), basename(filePath))
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid staging audit configuration.')
  process.exit(2)
}

if (!runRemote) {
  console.log(JSON.stringify({
    ok: true,
    mode: 'plan-only',
    networkConsulted: false,
    guarantees: [
      'every SQL file starts a READ ONLY transaction',
      'every SQL file ends with ROLLBACK',
      'mutating statements and psql meta-commands are rejected',
      'remote execution requires an explicit staging target and confirmation',
    ],
    files: sqlFiles.map((filePath) => basename(filePath)),
    nextAction: 'Use --remote-read-only only in an authorized isolated staging project.',
  }, null, 2))
  process.exit(0)
}

const localEnv = loadLocalEnv()
const value = (name) => envValue(localEnv, name).value
const requiredNames = [
  'SUPABASE_PROJECT_REF',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_ENVIRONMENT',
  'STAGING_AUDIT_CONFIRMATION',
  'SUPABASE_DB_HOST',
  'SUPABASE_DB_USER',
  'SUPABASE_DB_NAME',
  'SUPABASE_DB_PORT',
  'SUPABASE_DB_PASSWORD',
]
const missing = requiredNames.filter((name) => !value(name))
if (missing.length > 0) {
  console.error(`Missing required staging audit variables: ${missing.join(', ')}`)
  process.exit(2)
}

let connection
try {
  connection = assertStagingAuditConnection({
    projectRef: value('SUPABASE_PROJECT_REF'),
    supabaseUrl: value('NEXT_PUBLIC_SUPABASE_URL'),
    environment: value('SUPABASE_ENVIRONMENT'),
    confirmation: value('STAGING_AUDIT_CONFIRMATION'),
    dbHost: value('SUPABASE_DB_HOST'),
    dbUser: value('SUPABASE_DB_USER'),
    dbName: value('SUPABASE_DB_NAME'),
    dbPort: value('SUPABASE_DB_PORT'),
  })
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Staging target validation failed.')
  process.exit(2)
}

const password = value('SUPABASE_DB_PASSWORD')
const versionCheck = spawnSync('psql', ['--version'], {
  encoding: 'utf8',
  shell: false,
  timeout: 5_000,
})
if (versionCheck.status !== 0) {
  console.error('psql is unavailable; no network query was started.')
  process.exit(2)
}

for (const filePath of sqlFiles) {
  const fileName = basename(filePath)
  const isReleaseGate = fileName === '04-release-blocker-summary.sql'
  const psqlArgs = [
    '--host', connection.dbHost,
    '--port', connection.dbPort,
    '--username', connection.dbUser,
    '--dbname', connection.dbName,
    '--no-psqlrc',
    '--set', 'ON_ERROR_STOP=1',
    '--pset', 'pager=off',
    '--file', filePath,
  ]
  if (isReleaseGate) psqlArgs.push('--quiet', '--tuples-only', '--no-align')

  const result = spawnSync('psql', psqlArgs, {
    encoding: 'utf8',
    shell: false,
    timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024,
    env: {
      ...process.env,
      PGPASSWORD: password,
      PGSSLMODE: 'require',
      PGAPPNAME: 'vetdorim-staging-readonly-audit',
      PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=3000',
    },
  })

  if (result.status !== 0) {
    console.error(`${fileName} failed; remaining files were not executed.`)
    console.error(redactAuditDiagnostic(result.stderr, [password]))
    process.exit(1)
  }

  console.log(`\n===== ${fileName} =====`)
  console.log(result.stdout.trim())

  if (isReleaseGate) {
    let releaseGate
    try {
      releaseGate = parseStagingReleaseGateOutput(result.stdout)
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Release gate output is invalid.')
      process.exit(1)
    }

    if (!releaseGate.passed) {
      const failed = releaseGate.checks
        .filter((check) => !check.passed)
        .map((check) => check.checkId)
      console.error(`Release gate is NO-GO: ${failed.join(', ')}`)
      process.exit(1)
    }
  }
}

console.log(JSON.stringify({
  ok: true,
  mode: 'remote-read-only',
  networkConsulted: true,
  targetValidated: true,
  filesExecuted: sqlFiles.map((filePath) => basename(filePath)),
  reminder: 'Classify findings without copying credentials, PII or clinical row data into the repository.',
}, null, 2))
