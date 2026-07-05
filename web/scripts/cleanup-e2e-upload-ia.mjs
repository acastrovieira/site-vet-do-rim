import { createClient } from '@supabase/supabase-js'
import { envValue, loadLocalEnv, requiredEnv } from './lib/env-file.mjs'

const localEnv = loadLocalEnv()
const projectRef = envValue(localEnv, 'SUPABASE_PROJECT_REF').value || 'ycclyzoslirpnnwgzrqx'
const supabaseUrl = envValue(localEnv, 'NEXT_PUBLIC_SUPABASE_URL').value || `https://${projectRef}.supabase.co`
const serviceRoleKey = requiredEnv(localEnv, 'SUPABASE_SERVICE_ROLE_KEY')
const runId = envValue(localEnv, 'E2E_CLEANUP_RUN_ID').value
const apply = process.argv.includes('--apply')

if (apply && !runId) {
  console.error('Refusing to delete without E2E_CLEANUP_RUN_ID. Example: E2E_CLEANUP_RUN_ID=uploadia-20260626093000 npm run cleanup:e2e:upload-ia -- --apply')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

function matchesRun(value, prefix) {
  if (!runId) return value?.includes(prefix)
  return value?.includes(runId)
}

async function listE2EUsers() {
  const matches = []
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Failed to list users: ${error.message}`)

    for (const user of data.users) {
      if (matchesRun(user.email, 'e2e-vet-uploadia-')) {
        matches.push({ id: user.id, email: user.email })
      }
    }

    if (data.users.length < 1000) break
    page += 1
  }

  return matches
}

async function collectData() {
  const tutorPattern = runId ? `Tutor E2E Upload IA ${runId}%` : 'Tutor E2E Upload IA uploadia-%'
  const petPattern = runId ? `Paciente E2E Upload IA ${runId}%` : 'Paciente E2E Upload IA uploadia-%'

  const { data: tutors, error: tutorsError } = await supabase
    .from('tutores')
    .select('id, nome')
    .ilike('nome', tutorPattern)
  if (tutorsError) throw new Error(`Failed to list tutors: ${tutorsError.message}`)

  const { data: pets, error: petsError } = await supabase
    .from('pets')
    .select('id, nome')
    .ilike('nome', petPattern)
  if (petsError) throw new Error(`Failed to list pets: ${petsError.message}`)

  const petIds = pets?.map((pet) => pet.id) ?? []
  const { data: laudos, error: laudosError } = petIds.length > 0
    ? await supabase
      .from('laudos_pdf')
      .select('id, storage_path')
      .in('pet_id', petIds)
    : { data: [], error: null }
  if (laudosError) throw new Error(`Failed to list laudos: ${laudosError.message}`)

  return {
    tutors: tutors ?? [],
    pets: pets ?? [],
    laudos: laudos ?? [],
  }
}

async function deleteData(data) {
  const storagePaths = data.laudos.map((laudo) => laudo.storage_path).filter(Boolean)
  if (storagePaths.length > 0) {
    const { error } = await supabase.storage.from('laudos').remove(storagePaths)
    if (error) {
      throw new Error(`Storage cleanup failed; keeping database rows for traceability: ${error.message}`)
    }
  }

  const laudoIds = data.laudos.map((laudo) => laudo.id)
  if (laudoIds.length > 0) {
    const { error } = await supabase.from('laudos_pdf').delete().in('id', laudoIds)
    if (error) throw new Error(`Failed to delete laudos: ${error.message}`)
  }

  const petIds = data.pets.map((pet) => pet.id)
  if (petIds.length > 0) {
    const { error } = await supabase.from('pets').delete().in('id', petIds)
    if (error) throw new Error(`Failed to delete pets: ${error.message}`)
  }

  const tutorIds = data.tutors.map((tutor) => tutor.id)
  if (tutorIds.length > 0) {
    const { error } = await supabase.from('tutores').delete().in('id', tutorIds)
    if (error) throw new Error(`Failed to delete tutors: ${error.message}`)
  }
}

async function deleteUsers(users) {
  for (const user of users) {
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) throw new Error(`Failed to delete ${user.email}: ${error.message}`)
    console.log(`Deleted user: ${user.email}`)
  }
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

await deleteData(data)
await deleteUsers(users)
console.log('E2E Upload IA cleanup completed.')
