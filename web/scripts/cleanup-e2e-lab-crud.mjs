import { createClient } from '@supabase/supabase-js'
import { envValue, loadLocalEnv, requiredEnv } from './lib/env-file.mjs'
import {
  assertNoRows,
  assertRows,
  assertValidCleanupRunId,
  deleteRowsByIds,
  matchesExactE2EUser,
  removeStoragePaths,
  runCleanupSteps,
  verifyStoragePathsAbsent,
  verifyTableRowsAbsent,
} from './lib/e2e-cleanup-match.mjs'
import { explicitSupabaseTarget } from './lib/supabase-target.mjs'

const localEnv = loadLocalEnv()
const runId = envValue(localEnv, 'E2E_CLEANUP_RUN_ID').value
const apply = process.argv.includes('--apply')
const { projectRef, supabaseUrl } = explicitSupabaseTarget(localEnv, { mutation: apply })
const serviceRoleKey = requiredEnv(localEnv, 'SUPABASE_SERVICE_ROLE_KEY')

if (apply && !runId) {
  console.error('Refusing to delete without E2E_CLEANUP_RUN_ID. Example: E2E_CLEANUP_RUN_ID=labcrud-20260626093000 npm run cleanup:e2e:lab-crud -- --apply')
  process.exit(1)
}

if (apply) assertValidCleanupRunId(runId, 'labcrud')

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function listE2EUsers() {
  const matches = []
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Failed to list users: ${error.message}`)

    for (const user of data.users) {
      const isMatch = runId
        ? matchesExactE2EUser(user.email, runId, 'labcrud')
        : user.email?.startsWith('e2e-vet-labcrud-') && user.email.endsWith('@example.test')
      if (isMatch) {
        matches.push({ id: user.id, email: user.email })
      }
    }

    if (data.users.length < 1000) break
    page += 1
  }

  return matches
}

async function collectData() {
  const tutorQuery = supabase
    .from('tutores')
    .select('id, nome')
  const { data: tutorRows, error: tutorsError } = runId
    ? await tutorQuery.eq('email', `tutor-${runId}@example.test`)
    : await tutorQuery.ilike('nome', 'Tutor E2E CRUD labcrud-%')
  if (tutorsError) throw new Error(`Failed to list tutors: ${tutorsError.message}`)
  const tutors = assertRows('Tutor cleanup', tutorRows)
  const tutorIds = tutors.map((tutor) => tutor.id)

  const petQuery = supabase.from('pets').select('id, nome')
  const { data: petRows, error: petsError } = runId
    ? tutorIds.length > 0
      ? await petQuery.in('tutor_id', tutorIds)
      : { data: [], error: null }
    : await petQuery.ilike('nome', 'Paciente E2E CRUD labcrud-%')
  if (petsError) throw new Error(`Failed to list pets: ${petsError.message}`)
  const pets = assertRows('Pet cleanup', petRows)

  const petIds = pets.map((pet) => pet.id)
  const { data: laudoRows, error: laudosError } = petIds.length > 0
    ? await supabase
      .from('laudos_pdf')
      .select('id, storage_path')
      .in('pet_id', petIds)
    : { data: [], error: null }
  if (laudosError) throw new Error(`Failed to list laudos: ${laudosError.message}`)
  const laudos = assertRows('Laudo cleanup', laudoRows)

  return {
    tutors,
    pets,
    laudos,
  }
}

async function deleteData(data) {
  const storagePaths = [...new Set(data.laudos.map((laudo) => laudo.storage_path).filter(Boolean))]
  await removeStoragePaths(supabase, 'laudos', storagePaths)
  const laudoIds = data.laudos.map((laudo) => laudo.id)
  await deleteRowsByIds(supabase, 'laudos_pdf', laudoIds, 'Laudos')
  const petIds = data.pets.map((pet) => pet.id)
  await deleteRowsByIds(supabase, 'pets', petIds, 'Pets')
  const tutorIds = data.tutors.map((tutor) => tutor.id)
  await deleteRowsByIds(supabase, 'tutores', tutorIds, 'Tutores')
}

async function deleteUsers(users) {
  await runCleanupSteps(users.map((user) => [user.email, async () => {
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) throw new Error(`Failed to delete ${user.email}: ${error.message}`)
    console.log(`Deleted user: ${user.email}`)
  }]))
}

async function verifyNoResidues(expectedData) {
  await verifyTableRowsAbsent(supabase, 'laudos_pdf', expectedData.laudos.map((row) => row.id))
  await verifyTableRowsAbsent(supabase, 'pets', expectedData.pets.map((row) => row.id))
  await verifyTableRowsAbsent(supabase, 'tutores', expectedData.tutors.map((row) => row.id))
  await verifyStoragePathsAbsent(supabase, 'laudos', [
    ...new Set(expectedData.laudos.map((row) => row.storage_path).filter(Boolean)),
  ])

  const remainingUsers = await listE2EUsers()
  const remainingData = await collectData()
  assertNoRows('E2E users', remainingUsers)
  assertNoRows('Matching laudos', remainingData.laudos)
  assertNoRows('Matching pets', remainingData.pets)
  assertNoRows('Matching tutors', remainingData.tutors)
}

const users = await listE2EUsers()
const data = await collectData()

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  projectRef,
  runId: runId ?? null,
  users: users.map((user) => user.email),
  counts: {
    users: users.length,
    tutors: data.tutors.length,
    pets: data.pets.length,
    laudos: data.laudos.length,
    storageObjects: data.laudos.filter((laudo) => Boolean(laudo.storage_path)).length,
  },
}, null, 2))

if (!apply) {
  console.log('Dry-run only. Set E2E_CLEANUP_RUN_ID and pass --apply to delete.')
  process.exit(0)
}

let cleanupError
try {
  await deleteData(data)
  await deleteUsers(users)
} catch (error) {
  cleanupError = error
}

await runCleanupSteps([
  ['residue verification', () => verifyNoResidues(data)],
], { primaryError: cleanupError })

console.log('E2E Lab CRUD cleanup completed.')
