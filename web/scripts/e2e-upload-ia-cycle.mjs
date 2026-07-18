import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { loadLocalEnv, requiredEnv } from './lib/env-file.mjs'
import {
  assertRows,
  deleteRowsByIds,
  removeStoragePaths,
  runCleanupSteps,
  verifyStoragePathsAbsent,
  verifyTableRowsAbsent,
} from './lib/e2e-cleanup-match.mjs'
import { explicitSupabaseTarget } from './lib/supabase-target.mjs'

const localEnv = loadLocalEnv()
const { supabaseUrl } = explicitSupabaseTarget(localEnv, { mutation: true })
const serviceRoleKey = requiredEnv(localEnv, 'SUPABASE_SERVICE_ROLE_KEY')
const anonKey = requiredEnv(localEnv, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')

process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const runId = `uploadia-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
const envLocalPath = join(process.cwd(), '.env.local')
const nextBuildPath = join(process.cwd(), '.next')
let envLocalSnapshot
let createdUser
let createdTutorId
let createdPetId

function password() {
  return `VetRim-${randomBytes(9).toString('base64url')}!9`
}

async function createVetUser() {
  const email = `e2e-vet-${runId}@example.test`
  const userPassword = password()

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: userPassword,
    email_confirm: true,
    user_metadata: {
      full_name: `E2E Upload IA ${runId}`,
    },
  })

  if (error || !data.user) {
    throw new Error(`Failed to create vet user: ${error?.message || 'no user returned'}`)
  }

  createdUser = { id: data.user.id, email }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: data.user.id,
      role: 'vet',
      full_name: `E2E Upload IA ${runId}`,
      ai_quota_limit: 5,
      ai_quota_used: 0,
    }, { onConflict: 'id' })

  if (profileError) {
    throw new Error(`Failed to set vet profile: ${profileError.message}`)
  }

  return { email, password: userPassword }
}

async function createClinicalData() {
  const { data: tutor, error: tutorError } = await supabase
    .from('tutores')
    .insert({
      nome: `Tutor E2E Upload IA ${runId}`,
      telefone: '(27) 99999-1000',
      email: `tutor-upload-${runId}@example.test`,
      cidade: 'Vitoria',
      estado: 'ES',
    })
    .select('id')
    .single()

  if (tutorError || !tutor) {
    throw new Error(`Failed to create tutor: ${tutorError?.message || 'no tutor returned'}`)
  }
  createdTutorId = tutor.id

  const { data: pet, error: petError } = await supabase
    .from('pets')
    .insert({
      nome: `Paciente E2E Upload IA ${runId}`,
      tutor_id: createdTutorId,
      especie: 'canino',
      raca: 'SRD',
      idade_anos: 8,
      peso_atual: 12.4,
      status_paciente: 'em_tratamento',
    })
    .select('id')
    .single()

  if (petError || !pet) {
    throw new Error(`Failed to create pet: ${petError?.message || 'no pet returned'}`)
  }
  createdPetId = pet.id
}

async function cleanupData() {
  const scope = { laudoIds: [], storagePaths: [] }
  let cleanupError

  try {
    if (createdPetId) {
      const { data: laudoRows, error: laudosQueryError } = await supabase
        .from('laudos_pdf')
        .select('id, storage_path')
        .eq('pet_id', createdPetId)
      if (laudosQueryError) throw new Error(`Cleanup laudo query failed: ${laudosQueryError.message}`)
      const laudos = assertRows('Cleanup laudo', laudoRows)

      scope.laudoIds = laudos.map((laudo) => laudo.id)
      scope.storagePaths = [...new Set(laudos.map((laudo) => laudo.storage_path).filter(Boolean))]
      await removeStoragePaths(supabase, 'laudos', scope.storagePaths)
      await deleteRowsByIds(supabase, 'laudos_pdf', scope.laudoIds, 'Laudos')
      await deleteRowsByIds(supabase, 'pets', [createdPetId], 'Pet')
    }

    await deleteRowsByIds(supabase, 'tutores', createdTutorId ? [createdTutorId] : [], 'Tutor')
  } catch (error) {
    cleanupError = error
  }

  await runCleanupSteps([
    ['data residue verification', () => verifyNoDataResidues(scope)],
  ], { primaryError: cleanupError })
}

async function verifyNoDataResidues({ laudoIds, storagePaths }) {
  await verifyTableRowsAbsent(supabase, 'laudos_pdf', laudoIds)
  await verifyTableRowsAbsent(supabase, 'pets', createdPetId ? [createdPetId] : [])
  await verifyTableRowsAbsent(supabase, 'tutores', createdTutorId ? [createdTutorId] : [])
  await verifyStoragePathsAbsent(supabase, 'laudos', storagePaths)
}

async function cleanupUser() {
  if (!createdUser) return

  const { error } = await supabase.auth.admin.deleteUser(createdUser.id)
  if (error) throw new Error(`Cleanup failed for vet (${createdUser.email}): ${error.message}`)

  let page = 1
  while (true) {
    const { data, error: listError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (listError) throw new Error(`Failed to verify E2E user cleanup: ${listError.message}`)
    if (data.users.some((user) => user.id === createdUser.id || user.email === createdUser.email)) {
      throw new Error(`E2E user cleanup left residue: ${createdUser.email}`)
    }
    if (data.users.length < 1000) break
    page += 1
  }

  console.log(`Deleted E2E vet user: ${createdUser.email}`)
}

function writeTemporaryPublicEnv() {
  envLocalSnapshot = existsSync(envLocalPath)
    ? readFileSync(envLocalPath, 'utf8')
    : null

  writeFileSync(
    envLocalPath,
    [
      '# Temporary E2E env generated by scripts/e2e-upload-ia-cycle.mjs',
      `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`,
      '',
    ].join('\n'),
    'utf8'
  )
}

function restoreEnvLocal() {
  if (envLocalSnapshot === undefined) return

  if (envLocalSnapshot === null) {
    unlinkSync(envLocalPath)
    return
  }

  writeFileSync(envLocalPath, envLocalSnapshot, 'utf8')
}

function clearNextCache() {
  rmSync(nextBuildPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
}

let executionError

try {
  writeTemporaryPublicEnv()
  clearNextCache()

  const credentials = await createVetUser()
  await createClinicalData()
  console.log(`Created E2E Upload IA vet user: ${credentials.email}`)
  console.log(`Created E2E Upload IA pet: ${createdPetId}`)

  const env = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    E2E_RUN_ID: runId,
    E2E_VET_EMAIL: credentials.email,
    E2E_VET_PASSWORD: credentials.password,
    E2E_UPLOAD_PET_ID: createdPetId,
  }

  const playwrightCli = join(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js')
  const result = spawnSync(process.execPath, [playwrightCli, 'test', 'tests/e2e/upload-ia.spec.ts'], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  })

  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Playwright exited with status ${result.status}`)
} catch (error) {
  executionError = error
}

await runCleanupSteps([
  ['database and storage', cleanupData],
  ['E2E user', cleanupUser],
  ['temporary environment', restoreEnvLocal],
  ['Next.js cache', clearNextCache],
], { primaryError: executionError })
