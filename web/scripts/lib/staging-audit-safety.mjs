import { assertSupabaseTarget } from './supabase-target.mjs'

const MUTATING_SQL = /\b(?:insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|copy|call|do|vacuum|analyze|reindex|cluster|refresh|comment|security\s+label)\b/i
const PSQL_META_COMMAND = /^\s*\\/m
const POOLER_HOST = /^(?:[a-z0-9-]+\.)+pooler\.supabase\.com$/
const RELEASE_GATE_CONTRACT = 'vetdorim-release-gate-v1'

function sqlWithoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ')
    .replace(/'(?:''|[^'])*'/g, "''")
}

export function parseStagingAuditArgs(args) {
  const allowed = new Set(['--plan', '--remote-read-only'])
  const unknown = args.find((arg) => !allowed.has(arg))
  if (unknown) throw new Error(`Unknown argument: ${unknown}`)
  if (args.includes('--plan') && args.includes('--remote-read-only')) {
    throw new Error('Choose either --plan or --remote-read-only.')
  }

  return {
    runRemote: args.includes('--remote-read-only'),
  }
}

export function assertReadOnlySql(source, label = 'SQL audit file') {
  const normalized = sqlWithoutComments(source).trim()
  if (!/^BEGIN\s+TRANSACTION\s+READ\s+ONLY\s*;/i.test(normalized)) {
    throw new Error(`${label} must start with BEGIN TRANSACTION READ ONLY.`)
  }
  if (!/ROLLBACK\s*;\s*$/i.test(normalized)) {
    throw new Error(`${label} must end with ROLLBACK.`)
  }
  if (MUTATING_SQL.test(normalized)) {
    throw new Error(`${label} contains a mutating or privileged SQL statement.`)
  }
  if (PSQL_META_COMMAND.test(normalized)) {
    throw new Error(`${label} must not contain psql meta-commands.`)
  }

  return true
}

export function assertStagingAuditConnection({
  projectRef,
  supabaseUrl,
  environment,
  confirmation,
  dbHost,
  dbUser,
  dbName,
  dbPort,
}) {
  assertSupabaseTarget({ projectRef, supabaseUrl })

  if (environment !== 'staging') {
    throw new Error('The catalog audit is restricted to SUPABASE_ENVIRONMENT=staging.')
  }

  const expectedConfirmation = `CONFIRM_STAGING_READ_ONLY:${projectRef}`
  if (confirmation !== expectedConfirmation) {
    throw new Error(`Set STAGING_AUDIT_CONFIRMATION=${expectedConfirmation}.`)
  }

  const directHost = `db.${projectRef}.supabase.co`
  const isDirect = dbHost === directHost
  const isPooler = POOLER_HOST.test(dbHost)
  if (!isDirect && !isPooler) {
    throw new Error('SUPABASE_DB_HOST must be the project direct host or an official Supabase pooler.')
  }

  const expectedUser = isDirect ? 'postgres' : `postgres.${projectRef}`
  if (dbUser !== expectedUser) {
    throw new Error(`SUPABASE_DB_USER must be ${expectedUser} for the selected host.`)
  }

  if (dbName !== 'postgres') {
    throw new Error('SUPABASE_DB_NAME must be postgres for this audit.')
  }

  const allowedPorts = isDirect ? new Set(['5432']) : new Set(['5432', '6543'])
  if (!allowedPorts.has(String(dbPort))) {
    throw new Error('SUPABASE_DB_PORT is not valid for the selected Supabase host.')
  }

  return {
    projectRef,
    dbHost,
    dbUser,
    dbName,
    dbPort: String(dbPort),
  }
}

export function redactAuditDiagnostic(value, secrets = []) {
  let redacted = String(value ?? '')
  for (const secret of secrets) {
    if (secret) redacted = redacted.replaceAll(secret, '[REDACTED]')
  }
  return redacted
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .slice(0, 2_000)
}

export function parseStagingReleaseGateOutput(value) {
  const lines = String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  let gate = null
  for (const line of lines) {
    if (!line.startsWith('{') || !line.endsWith('}')) continue

    try {
      const candidate = JSON.parse(line)
      if (candidate?.contract === RELEASE_GATE_CONTRACT) gate = candidate
    } catch {
      // Other psql output is untrusted diagnostic text, not a gate contract.
    }
  }

  if (!gate) throw new Error('Release gate output is missing its machine-readable contract.')
  if (typeof gate.passed !== 'boolean' || !Array.isArray(gate.checks)) {
    throw new Error('Release gate output has an invalid shape.')
  }

  for (const check of gate.checks) {
    if (
      typeof check?.checkId !== 'string'
      || typeof check.severity !== 'string'
      || typeof check.passed !== 'boolean'
      || typeof check.expectation !== 'string'
    ) {
      throw new Error('Release gate output contains an invalid check entry.')
    }
  }

  return gate
}
