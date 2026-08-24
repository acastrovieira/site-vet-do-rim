import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { rmSync } from 'node:fs'
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
import { assertLocalSupabaseTarget, explicitSupabaseTarget } from './lib/supabase-target.mjs'

const localEnv = loadLocalEnv()
const localExtractionMode = process.argv.includes('--local-extraction')
const localTargetMode = process.argv.includes('--local')
const { supabaseUrl } = localTargetMode
  ? assertLocalSupabaseTarget(requiredEnv(localEnv, 'LOCAL_SUPABASE_URL'))
  : explicitSupabaseTarget(localEnv, { mutation: true })
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
const nextBuildPath = join(process.cwd(), '.next')
let createdUser
let createdClinicId
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

  // O fluxo de laudos e isolado por clinica. A fixture precisa reproduzir o
  // mesmo contexto que a aplicacao cria para um profissional real; sem isso,
  // a reserva do upload e rejeitada corretamente pela RPC de tenancy.
  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .insert({
      nome: `Clinica E2E Upload IA ${runId}`,
      status: 'active',
      created_by: data.user.id,
    })
    .select('id')
    .single()

  if (clinicError || !clinic) {
    throw new Error(`Failed to create E2E clinic: ${clinicError?.message || 'no clinic returned'}`)
  }
  createdClinicId = clinic.id

  const { error: membershipError } = await supabase
    .from('clinic_memberships')
    .insert({
      clinic_id: createdClinicId,
      user_id: data.user.id,
      role: 'vet',
      status: 'active',
      created_by: data.user.id,
    })

  if (membershipError) {
    throw new Error(`Failed to create E2E clinic membership: ${membershipError.message}`)
  }

  return { email, password: userPassword }
}

async function createClinicalData() {
  if (!createdClinicId || !createdUser) throw new Error('E2E clinical context was not created')

  const { data: tutor, error: tutorError } = await supabase
    .from('tutores')
    .insert({
      nome: `Tutor E2E Upload IA ${runId}`,
      telefone: '(27) 99999-1000',
      email: `tutor-upload-${runId}@example.test`,
      cidade: 'Vitoria',
      estado: 'ES',
      clinic_id: createdClinicId,
      created_by: createdUser.id,
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
      clinic_id: createdClinicId,
      created_by: createdUser.id,
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

    if (createdClinicId) {
      const { error: clinicError } = await supabase
        .from('clinics')
        .delete()
        .eq('id', createdClinicId)
      if (clinicError) throw new Error(`Cleanup clinic failed: ${clinicError.message}`)
    }
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
  await verifyTableRowsAbsent(supabase, 'clinics', createdClinicId ? [createdClinicId] : [])
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

function clearNextCache() {
  rmSync(nextBuildPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
}

let executionError

try {
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
    ...(localExtractionMode
      ? {
          PORT: process.env.PORT ?? '3314',
          PLAYWRIGHT_HOST: process.env.PLAYWRIGHT_HOST ?? '127.0.0.1',
          PLAYWRIGHT_REUSE_EXISTING_SERVER: '0',
        }
      : {}),
  }

  const playwrightCli = join(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js')
  const allowedLocalProjects = new Set([
    'chromium',
    'chromium-mobile-auth',
    'chromium-tablet-auth',
    'webkit-auth',
  ])
  const requestedLocalProjects = (process.env.E2E_LOCAL_PROJECTS
    ?? [...allowedLocalProjects].join(','))
    .split(',')
    .map((project) => project.trim())
    .filter(Boolean)
  if (requestedLocalProjects.some((project) => !allowedLocalProjects.has(project))) {
    throw new Error('E2E_LOCAL_PROJECTS contains an unsupported project.')
  }
  const playwrightArgs = localExtractionMode
    ? [
        playwrightCli,
        'test',
        'tests/e2e/local-extraction-auth.spec.ts',
        ...requestedLocalProjects.map((project) => `--project=${project}`),
        '--workers=1',
      ]
    : [playwrightCli, 'test', 'tests/e2e/upload-ia.spec.ts']
  const result = spawnSync(process.execPath, playwrightArgs, {
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
  ['Next.js cache', clearNextCache],
], { primaryError: executionError })
