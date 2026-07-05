import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { envValue, loadLocalEnv } from './lib/env-file.mjs'

const repoRoot = resolve(process.cwd(), '..')
const checks = []
const localEnv = loadLocalEnv()

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail })
}

function runCommand(command, args = []) {
  return spawnSync(
    process.platform === 'win32' ? [command, ...args].join(' ') : command,
    process.platform === 'win32' ? [] : args,
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    }
  )
}

function commandVersion(command, args = ['--version']) {
  const result = runCommand(command, args)

  return {
    ok: result.status === 0,
    output: (result.stdout || result.stderr || '').trim().split('\n')[0] || null,
  }
}

function listSecretNames(projectRef) {
  const result = runCommand('supabase', ['secrets', 'list', '--project-ref', projectRef])
  if (result.status !== 0) {
    return {
      ok: false,
      detail: (result.stderr || result.stdout || 'falha ao listar secrets').trim().split('\n')[0],
      names: new Set(),
    }
  }

  const names = new Set()
  for (const line of (result.stdout || '').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s+\|/)
    if (match) names.add(match[1])
  }

  return { ok: true, detail: 'nomes de secrets consultados sem valores', names }
}

function envCheck(name) {
  const { value, source } = envValue(localEnv, name)
  const ok = Boolean(value && !value.includes('dummy-') && !value.includes('PROJECT_REF'))
  return {
    ok,
    detail: ok ? `presente em ${source}` : 'ausente ou placeholder',
  }
}

async function apiKeyCheck(label, url, key, { publicKey = false } = {}) {
  if (!url || !key || url.includes('PROJECT_REF') || key.includes('dummy-')) {
    return { ok: false, detail: 'nao testado: env ausente ou placeholder' }
  }

  try {
    const usesCurrentSupabaseKey = key.startsWith('sb_')
    const endpoint = publicKey && usesCurrentSupabaseKey
      ? '/auth/v1/settings'
      : '/rest/v1/'
    const headers = { apikey: key }

    if (!usesCurrentSupabaseKey || !publicKey) {
      headers.Authorization = `Bearer ${key}`
    }

    const response = await fetch(`${url}${endpoint}`, { headers })

    return {
      ok: response.status !== 401,
      detail: response.status === 401
        ? `${label} recusada pelo API Gateway`
        : `API respondeu HTTP ${response.status}`,
    }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'falha desconhecida',
    }
  }
}

const supabase = commandVersion('supabase')
addCheck('Supabase CLI no PATH', supabase.ok, supabase.output ?? 'nao encontrado')

const deno = commandVersion('deno')
addCheck('Deno no PATH para Edge Function check', deno.ok, deno.output ?? 'nao encontrado')

const supabaseUrl = envCheck('NEXT_PUBLIC_SUPABASE_URL')
addCheck('NEXT_PUBLIC_SUPABASE_URL definido', supabaseUrl.ok, supabaseUrl.detail)

const anonKey = envCheck('NEXT_PUBLIC_SUPABASE_ANON_KEY')
addCheck('NEXT_PUBLIC_SUPABASE_ANON_KEY definido', anonKey.ok, anonKey.detail)

const serviceRoleKey = envCheck('SUPABASE_SERVICE_ROLE_KEY')
addCheck('SUPABASE_SERVICE_ROLE_KEY definido', serviceRoleKey.ok, serviceRoleKey.detail)

const dbPassword = envCheck('SUPABASE_DB_PASSWORD')
addCheck('SUPABASE_DB_PASSWORD definido para CLI Postgres', dbPassword.ok, dbPassword.detail)

const supabaseUrlValue = envValue(localEnv, 'NEXT_PUBLIC_SUPABASE_URL').value
const anonKeyValue = envValue(localEnv, 'NEXT_PUBLIC_SUPABASE_ANON_KEY').value
const serviceRoleKeyValue = envValue(localEnv, 'SUPABASE_SERVICE_ROLE_KEY').value
const projectRef = envValue(localEnv, 'SUPABASE_PROJECT_REF').value || 'ycclyzoslirpnnwgzrqx'

const anonGateway = await apiKeyCheck('Chave publica Supabase', supabaseUrlValue, anonKeyValue, { publicKey: true })
addCheck('Chave publica aceita pelo Supabase', anonGateway.ok, anonGateway.detail)

const serviceGateway = await apiKeyCheck('Chave administrativa Supabase', supabaseUrlValue, serviceRoleKeyValue)
addCheck('Chave administrativa aceita pelo Supabase', serviceGateway.ok, serviceGateway.detail)

const migrationPath = join(repoRoot, 'supabase', 'migrations', '20260626010000_ai_quota_rpc_and_parse_laudo_hardening.sql')
const functionPath = join(repoRoot, 'supabase', 'functions', 'parse-laudo', 'index.ts')
const configPath = join(repoRoot, 'supabase', 'config.toml')
const migrationExists = existsSync(migrationPath)
const functionExists = existsSync(functionPath)
const configExists = existsSync(configPath)

addCheck('Migration de quota atomica existe', migrationExists, migrationPath)
addCheck('Edge Function parse-laudo existe', functionExists, functionPath)
addCheck('supabase/config.toml existe', configExists, configPath)

const secrets = supabase.ok
  ? listSecretNames(projectRef)
  : { ok: false, detail: 'Supabase CLI indisponivel', names: new Set() }
addCheck('Secrets da Edge Function consultaveis', secrets.ok, secrets.detail)
addCheck('Secret SUPABASE_URL configurado', secrets.names.has('SUPABASE_URL'), secrets.names.has('SUPABASE_URL') ? 'presente' : 'ausente')
addCheck('Secret SUPABASE_SERVICE_ROLE_KEY configurado', secrets.names.has('SUPABASE_SERVICE_ROLE_KEY'), secrets.names.has('SUPABASE_SERVICE_ROLE_KEY') ? 'presente' : 'ausente')
addCheck('Secret OPENAI_API_KEY configurado', secrets.names.has('OPENAI_API_KEY'), secrets.names.has('OPENAI_API_KEY') ? 'presente' : 'ausente')
addCheck('Secret OPENAI_MODEL configurado', secrets.names.has('OPENAI_MODEL'), secrets.names.has('OPENAI_MODEL') ? 'presente' : 'opcional ausente')

const labCrudReady = supabaseUrl.ok &&
  anonKey.ok &&
  serviceRoleKey.ok &&
  anonGateway.ok &&
  serviceGateway.ok

const uploadIaReady = labCrudReady &&
  supabase.ok &&
  deno.ok &&
  dbPassword.ok &&
  migrationExists &&
  functionExists &&
  configExists &&
  secrets.ok &&
  secrets.names.has('SUPABASE_URL') &&
  secrets.names.has('SUPABASE_SERVICE_ROLE_KEY') &&
  secrets.names.has('OPENAI_API_KEY')

console.log(JSON.stringify({
  ok: uploadIaReady,
  projectRef,
  envFilesChecked: localEnv.envFiles.filter((filePath) => existsSync(filePath)),
  readiness: {
    labCrud: labCrudReady,
    uploadIa: uploadIaReady,
  },
  checks,
  nextManualActions: [
    'supabase db push --dry-run',
    'supabase db push',
    'supabase functions deploy parse-laudo',
    'npm run test:e2e:lab-crud',
    'npm run test:e2e:upload-ia',
  ],
}, null, 2))

process.exit(uploadIaReady ? 0 : 1)
