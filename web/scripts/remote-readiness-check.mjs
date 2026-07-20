import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { envValue, loadLocalEnv } from './lib/env-file.mjs'
import {
  getRemoteReadinessTimeoutMs,
  isUsableReadinessValue,
  parseRemoteReadinessArgs,
  safeEnvSourceLabel,
  safeErrorType,
} from './lib/readiness-safety.mjs'
import { assertSupabaseTarget } from './lib/supabase-target.mjs'

let allowRemote = false
try {
  ;({ allowRemote } = parseRemoteReadinessArgs(process.argv.slice(2)))
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid arguments.')
  process.exit(2)
}

const repoRoot = resolve(process.cwd(), '..')
const checks = []
const localEnv = loadLocalEnv()
const remoteTimeoutMs = getRemoteReadinessTimeoutMs(
  envValue(localEnv, 'REMOTE_READINESS_TIMEOUT_MS').value,
)

function addCheck(name, ok, detail, status = ok ? 'passed' : 'failed') {
  checks.push({ name, ok, status, detail })
}

function runCommand(command, args = []) {
  return spawnSync(
    process.platform === 'win32' ? [command, ...args].join(' ') : command,
    process.platform === 'win32' ? [] : args,
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
      timeout: remoteTimeoutMs,
    },
  )
}

function commandVersion(command, args = ['--version']) {
  const result = runCommand(command, args)
  const firstLine = (result.stdout || '').trim().split('\n')[0] || ''
  const safeVersion = /^[A-Za-z0-9][A-Za-z0-9 ._+(),-]{0,79}$/.test(firstLine)
    ? firstLine
    : null
  return {
    ok: result.status === 0,
    output: result.status === 0 ? safeVersion : null,
  }
}

function listSecretNames(projectRef) {
  const result = runCommand('supabase', ['secrets', 'list', '--project-ref', projectRef])
  if (result.status !== 0) {
    return {
      ok: false,
      detail: result.error?.name === 'ETIMEDOUT'
        ? 'consulta excedeu o timeout'
        : 'CLI recusou ou nao concluiu a consulta',
      names: new Set(),
    }
  }

  const names = new Set()
  for (const line of (result.stdout || '').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s+\|/)
    if (match) names.add(match[1])
  }

  return { ok: true, detail: 'nomes consultados sem exibir valores', names }
}

function envCheck(name) {
  const { value, source } = envValue(localEnv, name)
  const ok = isUsableReadinessValue(value)
  return {
    ok,
    detail: ok
      ? `presente em ${safeEnvSourceLabel(source)}`
      : 'ausente ou placeholder',
  }
}

async function apiKeyCheck(url, key) {
  if (!isUsableReadinessValue(url) || !isUsableReadinessValue(key)) {
    return { ok: false, detail: 'nao testado: configuracao ausente ou placeholder' }
  }

  try {
    const usesCurrentSupabaseKey = key.startsWith('sb_')
    const endpoint = '/auth/v1/settings'
    const headers = { apikey: key }

    if (!usesCurrentSupabaseKey) {
      headers.Authorization = `Bearer ${key}`
    }

    const response = await fetch(`${url}${endpoint}`, {
      cache: 'no-store',
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(remoteTimeoutMs),
    })
    const status = response.status
    await response.body?.cancel()

    return {
      ok: response.ok,
      detail: response.ok
        ? `API respondeu HTTP ${status}`
        : `API recusou ou esta indisponivel (HTTP ${status})`,
    }
  } catch (error) {
    return {
      ok: false,
      detail: `consulta falhou (${safeErrorType(error)})`,
    }
  }
}

const supabase = commandVersion('supabase')
addCheck('Supabase CLI no PATH', supabase.ok, supabase.output ?? 'nao encontrado')

const deno = commandVersion('deno')
addCheck('Deno no PATH para Edge Function check', deno.ok, deno.output ?? 'nao encontrado')

const supabaseUrl = envCheck('NEXT_PUBLIC_SUPABASE_URL')
addCheck('NEXT_PUBLIC_SUPABASE_URL definido', supabaseUrl.ok, supabaseUrl.detail)

const publicKey = envCheck('NEXT_PUBLIC_SUPABASE_ANON_KEY')
addCheck('NEXT_PUBLIC_SUPABASE_ANON_KEY definido', publicKey.ok, publicKey.detail)

const serviceRoleKey = envCheck('SUPABASE_SERVICE_ROLE_KEY')
addCheck('SUPABASE_SERVICE_ROLE_KEY definido', serviceRoleKey.ok, serviceRoleKey.detail)

const dbPassword = envCheck('SUPABASE_DB_PASSWORD')
addCheck('SUPABASE_DB_PASSWORD definido para CLI Postgres', dbPassword.ok, dbPassword.detail)

const supabaseUrlValue = envValue(localEnv, 'NEXT_PUBLIC_SUPABASE_URL').value
const publicKeyValue = envValue(localEnv, 'NEXT_PUBLIC_SUPABASE_ANON_KEY').value
const serviceRoleKeyValue = envValue(localEnv, 'SUPABASE_SERVICE_ROLE_KEY').value
const projectRefCheck = envCheck('SUPABASE_PROJECT_REF')
const projectRef = envValue(localEnv, 'SUPABASE_PROJECT_REF').value
addCheck('SUPABASE_PROJECT_REF definido explicitamente', projectRefCheck.ok, projectRefCheck.detail)

let targetValidated = false
if (projectRefCheck.ok && supabaseUrl.ok) {
  try {
    assertSupabaseTarget({ projectRef, supabaseUrl: supabaseUrlValue })
    targetValidated = true
  } catch {
    targetValidated = false
  }
}
addCheck(
  'URL e project ref apontam para o mesmo alvo',
  targetValidated,
  targetValidated ? 'alvo consistente' : 'alvo ausente ou inconsistente',
)

const migrationPath = join(
  repoRoot,
  'supabase',
  'migrations',
  '20260626010000_ai_quota_rpc_and_parse_laudo_hardening.sql',
)
const functionPath = join(repoRoot, 'supabase', 'functions', 'parse-laudo', 'index.ts')
const configPath = join(repoRoot, 'supabase', 'config.toml')
const migrationExists = existsSync(migrationPath)
const functionExists = existsSync(functionPath)
const configExists = existsSync(configPath)

addCheck('Migration de quota atomica existe', migrationExists, 'arquivo local')
addCheck('Edge Function parse-laudo existe', functionExists, 'arquivo local')
addCheck('supabase/config.toml existe', configExists, 'arquivo local')

let publicGateway = { ok: false, detail: 'nao executado: use --remote conscientemente' }
let serviceGateway = { ok: false, detail: 'nao executado: use --remote conscientemente' }
let secrets = {
  ok: false,
  detail: 'nao executado: use --remote conscientemente',
  names: new Set(),
}

if (allowRemote && targetValidated) {
  ;[publicGateway, serviceGateway] = await Promise.all([
    apiKeyCheck(supabaseUrlValue, publicKeyValue),
    apiKeyCheck(supabaseUrlValue, serviceRoleKeyValue),
  ])

  if (supabase.ok) {
    secrets = listSecretNames(projectRef)
  } else {
    secrets.detail = 'Supabase CLI indisponivel'
  }
}

const remoteStatus = allowRemote ? undefined : 'skipped'
addCheck('Chave publica aceita pelo Supabase', publicGateway.ok, publicGateway.detail, remoteStatus)
addCheck('Chave administrativa aceita pelo Supabase', serviceGateway.ok, serviceGateway.detail, remoteStatus)
addCheck('Secrets da Edge Function consultaveis', secrets.ok, secrets.detail, remoteStatus)

for (const name of [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
]) {
  const present = secrets.names.has(name)
  addCheck(
    `Secret ${name} configurado`,
    present,
    present ? 'presente' : allowRemote ? 'ausente' : 'nao consultado',
    remoteStatus,
  )
}

const localLabPrerequisites = supabaseUrl.ok &&
  publicKey.ok &&
  serviceRoleKey.ok &&
  projectRefCheck.ok &&
  targetValidated
const remoteLabVerified = allowRemote && publicGateway.ok && serviceGateway.ok
const labCrudReady = localLabPrerequisites && remoteLabVerified

const localUploadPrerequisites = localLabPrerequisites &&
  supabase.ok &&
  deno.ok &&
  dbPassword.ok &&
  migrationExists &&
  functionExists &&
  configExists
const remoteUploadVerified = remoteLabVerified &&
  secrets.ok &&
  secrets.names.has('SUPABASE_URL') &&
  secrets.names.has('SUPABASE_SERVICE_ROLE_KEY') &&
  secrets.names.has('OPENAI_API_KEY')
const uploadIaReady = localUploadPrerequisites && remoteUploadVerified
const overallOk = allowRemote ? uploadIaReady : localUploadPrerequisites

console.log(JSON.stringify({
  ok: overallOk,
  mode: allowRemote ? 'remote-read-only' : 'local-only',
  networkConsulted: allowRemote && targetValidated,
  envFilesChecked: localEnv.envFiles
    .filter((filePath) => existsSync(filePath))
    .map((filePath) => safeEnvSourceLabel(filePath)),
  readiness: {
    localLabPrerequisites,
    remoteLabVerified,
    labCrud: labCrudReady,
    localUploadPrerequisites,
    remoteUploadVerified,
    uploadIa: uploadIaReady,
  },
  checks,
  nextManualActions: [
    allowRemote
      ? 'Revisar as falhas sem imprimir ou compartilhar valores de secrets'
      : 'Executar novamente com --remote somente quando a consulta externa read-only estiver autorizada',
    'Confirmar explicitamente que SUPABASE_PROJECT_REF aponta para homologacao isolada',
    'Obter aprovacao antes de migrations, deploys ou qualquer mutacao remota',
  ],
}, null, 2))

process.exit(overallOk ? 0 : 1)
