import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClinicMembershipRole, ClinicStatus, Database } from '../../src/types/database.ts'
import {
  ACTIVE_CLINIC_COOKIE_MAX_AGE_SECONDS,
  ACTIVE_CLINIC_COOKIE_NAME,
  activeClinicCookieOptions,
  expiredActiveClinicCookieOptions,
  parseActiveClinicCookieValue,
  resolvePostClinicSwitchPath,
} from '../../src/lib/active-clinic-cookie.ts'
import { authorizeClinicAccess } from '../../src/lib/server-authorization.ts'
import {
  listActiveUserClinics,
  resolveActiveClinicFromList,
  resolveActiveClinicResult,
} from '../../src/lib/server-clinic-context.ts'

const CLINIC_1_ID = '00000000-0000-4000-8000-000000000001'
const CLINIC_2_ID = '00000000-0000-4000-8000-000000000002'
const CLINIC_3_ID = '00000000-0000-4000-8000-000000000003'
const USER_ID = '00000000-0000-4000-8000-000000000099'

interface FakeMembershipRow {
  clinic_id: string
  user_id: string
  role: ClinicMembershipRole
  status: 'active' | 'inactive'
}

interface FakeClinicRow {
  id: string
  nome: string
  status: ClinicStatus
}

function fakeMultiClinicClient({
  userId = USER_ID,
  profileRole = 'vet',
  memberships = [],
  clinics = [],
  membershipError = null,
  clinicError = null,
}: {
  userId?: string | null
  profileRole?: string
  memberships?: FakeMembershipRow[]
  clinics?: FakeClinicRow[]
  membershipError?: unknown
  clinicError?: unknown
}) {
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: userId ? { role: profileRole } : null,
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === 'clinic_memberships') {
        const filters: Record<string, unknown> = {}
        const builder = {
          select: () => builder,
          eq: (column: string, value: unknown) => {
            filters[column] = value
            return builder
          },
          order: () => builder,
          limit: () => builder,
          maybeSingle: async () => {
            if (membershipError) return { data: null, error: membershipError }
            const matched = memberships.find((row) =>
              (!filters.user_id || row.user_id === filters.user_id)
              && (!filters.status || row.status === filters.status)
              && (!filters.clinic_id || row.clinic_id === filters.clinic_id),
            )
            return {
              data: matched ? { clinic_id: matched.clinic_id, role: matched.role } : null,
              error: null,
            }
          },
          then: (
            onFulfilled: (value: { data: { clinic_id: string; role: ClinicMembershipRole }[] | null; error: unknown }) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) => {
            if (membershipError) {
              return Promise.resolve({ data: null, error: membershipError }).then(onFulfilled, onRejected)
            }
            const matched = memberships
              .filter((row) =>
                (!filters.user_id || row.user_id === filters.user_id)
                && (!filters.status || row.status === filters.status)
                && (!filters.clinic_id || row.clinic_id === filters.clinic_id),
              )
              .map((row) => ({ clinic_id: row.clinic_id, role: row.role }))
            return Promise.resolve({ data: matched, error: null }).then(onFulfilled, onRejected)
          },
        }
        return builder
      }

      if (table === 'clinics') {
        const eqFilters: Record<string, unknown> = {}
        let inIds: string[] | null = null
        const builder = {
          select: () => builder,
          eq: (column: string, value: unknown) => {
            eqFilters[column] = value
            return builder
          },
          in: (column: string, values: string[]) => {
            if (column === 'id') inIds = values
            return builder
          },
          maybeSingle: async () => {
            if (clinicError) return { data: null, error: clinicError }
            const matched = clinics.find((row) =>
              (!eqFilters.id || row.id === eqFilters.id)
              && (!eqFilters.status || row.status === eqFilters.status),
            )
            return {
              data: matched ? { id: matched.id, nome: matched.nome } : null,
              error: null,
            }
          },
          then: (
            onFulfilled: (value: { data: { id: string; nome: string }[] | null; error: unknown }) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) => {
            if (clinicError) {
              return Promise.resolve({ data: null, error: clinicError }).then(onFulfilled, onRejected)
            }
            const matched = clinics
              .filter((row) =>
                (!eqFilters.id || row.id === eqFilters.id)
                && (!eqFilters.status || row.status === eqFilters.status)
                && (!inIds || inIds.includes(row.id)),
              )
              .map((row) => ({ id: row.id, nome: row.nome }))
            return Promise.resolve({ data: matched, error: null }).then(onFulfilled, onRejected)
          },
        }
        return builder
      }

      throw new Error(`unexpected table in test double: ${table}`)
    },
  }

  return client as unknown as SupabaseClient<Database>
}

test('active clinic cookie helpers validate UUIDs, set HttpOnly options, and resolve post-switch routes', () => {
  assert.equal(ACTIVE_CLINIC_COOKIE_NAME, 'vetdorim_active_clinic')
  assert.equal(parseActiveClinicCookieValue(`  ${CLINIC_2_ID}  `), CLINIC_2_ID)
  assert.equal(parseActiveClinicCookieValue('not-a-uuid'), null)
  assert.equal(parseActiveClinicCookieValue('../clinic'), null)
  assert.equal(parseActiveClinicCookieValue(undefined), null)

  assert.deepEqual(activeClinicCookieOptions(true), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: ACTIVE_CLINIC_COOKIE_MAX_AGE_SECONDS,
  })
  assert.equal(activeClinicCookieOptions(false).secure, false)
  assert.equal(expiredActiveClinicCookieOptions(true).maxAge, 0)

  assert.equal(resolvePostClinicSwitchPath('/lab'), null)
  assert.equal(resolvePostClinicSwitchPath('/lab/pacientes'), null)
  assert.equal(resolvePostClinicSwitchPath('/lab/tutores'), null)
  assert.equal(resolvePostClinicSwitchPath('/lab/perfil'), null)
  assert.equal(resolvePostClinicSwitchPath(`/lab/pacientes/${CLINIC_1_ID}`), '/lab/pacientes')
  assert.equal(resolvePostClinicSwitchPath(`/lab/pacientes/${CLINIC_1_ID}/laudos`), '/lab/pacientes')
  assert.equal(resolvePostClinicSwitchPath('/lab/pacientes/novo'), '/lab/pacientes')
  assert.equal(resolvePostClinicSwitchPath(`/lab/tutores/${CLINIC_1_ID}`), '/lab/tutores')
  assert.equal(resolvePostClinicSwitchPath('/lab/tutores/novo'), '/lab/tutores')
})

test('resolveActiveClinicResult honors valid active preferredClinicId and falls back safely otherwise', async () => {
  const client = fakeMultiClinicClient({
    memberships: [
      { clinic_id: CLINIC_1_ID, user_id: USER_ID, role: 'vet', status: 'active' },
      { clinic_id: CLINIC_2_ID, user_id: USER_ID, role: 'clinic_admin', status: 'active' },
      { clinic_id: CLINIC_3_ID, user_id: USER_ID, role: 'vet', status: 'inactive' },
    ],
    clinics: [
      { id: CLINIC_1_ID, nome: 'Clinica Alfa', status: 'active' },
      { id: CLINIC_2_ID, nome: 'Clinica Beta', status: 'active' },
      { id: CLINIC_3_ID, nome: 'Clinica Gama', status: 'active' },
    ],
  })

  // Seleciona a segunda clinica quando preferida e ativa
  assert.deepEqual(await resolveActiveClinicResult(client, USER_ID, CLINIC_2_ID), {
    ok: true,
    context: { clinicId: CLINIC_2_ID, membershipRole: 'clinic_admin' },
  })

  // Vinculo inativo (CLINIC_3_ID) cai de volta na primeira membership ativa
  assert.deepEqual(await resolveActiveClinicResult(client, USER_ID, CLINIC_3_ID), {
    ok: true,
    context: { clinicId: CLINIC_1_ID, membershipRole: 'vet' },
  })

  // UUID de outro tenant ou valor malformado cai na primeira membership ativa
  assert.deepEqual(
    await resolveActiveClinicResult(client, USER_ID, '00000000-0000-4000-8000-000000000777'),
    {
      ok: true,
      context: { clinicId: CLINIC_1_ID, membershipRole: 'vet' },
    },
  )
  assert.deepEqual(await resolveActiveClinicResult(client, USER_ID, 'invalid-cookie'), {
    ok: true,
    context: { clinicId: CLINIC_1_ID, membershipRole: 'vet' },
  })

  // Clinica preferida suspensa na tabela clinics tambem cai de forma segura
  const suspendedClient = fakeMultiClinicClient({
    memberships: [
      { clinic_id: CLINIC_1_ID, user_id: USER_ID, role: 'vet', status: 'active' },
      { clinic_id: CLINIC_2_ID, user_id: USER_ID, role: 'clinic_admin', status: 'active' },
    ],
    clinics: [
      { id: CLINIC_1_ID, nome: 'Clinica Alfa', status: 'active' },
      { id: CLINIC_2_ID, nome: 'Clinica Suspensa', status: 'suspended' },
    ],
  })
  assert.deepEqual(await resolveActiveClinicResult(suspendedClient, USER_ID, CLINIC_2_ID), {
    ok: true,
    context: { clinicId: CLINIC_1_ID, membershipRole: 'vet' },
  })
})

test('resolveActiveClinicResult and authorizeClinicAccess fail closed on membership or clinic query errors', async () => {
  const membershipFailureClient = fakeMultiClinicClient({
    membershipError: new Error('db timeout'),
  })
  assert.deepEqual(await resolveActiveClinicResult(membershipFailureClient, USER_ID, CLINIC_2_ID), {
    ok: false,
  })
  assert.deepEqual(await authorizeClinicAccess(membershipFailureClient, ['vet', 'admin'], CLINIC_2_ID), {
    ok: false,
    code: 'AUTHORIZATION_UNAVAILABLE',
    status: 503,
  })

  const clinicLookupFailureClient = fakeMultiClinicClient({
    memberships: [{ clinic_id: CLINIC_2_ID, user_id: USER_ID, role: 'vet', status: 'active' }],
    clinicError: new Error('clinics lookup error'),
  })
  assert.deepEqual(await resolveActiveClinicResult(clinicLookupFailureClient, USER_ID, CLINIC_2_ID), {
    ok: false,
  })
  assert.deepEqual(await authorizeClinicAccess(clinicLookupFailureClient, ['vet', 'admin'], CLINIC_2_ID), {
    ok: false,
    code: 'AUTHORIZATION_UNAVAILABLE',
    status: 503,
  })
})

test('listActiveUserClinics preserves membership order, filters suspended clinics, and resolves fallback', async () => {
  const client = fakeMultiClinicClient({
    memberships: [
      { clinic_id: CLINIC_1_ID, user_id: USER_ID, role: 'vet', status: 'active' },
      { clinic_id: CLINIC_2_ID, user_id: USER_ID, role: 'clinic_admin', status: 'active' },
      { clinic_id: CLINIC_3_ID, user_id: USER_ID, role: 'vet', status: 'active' },
    ],
    clinics: [
      { id: CLINIC_1_ID, nome: 'Clinica Alfa', status: 'active' },
      { id: CLINIC_2_ID, nome: 'Clinica Suspensa', status: 'suspended' },
      { id: CLINIC_3_ID, nome: 'Clinica Gama', status: 'active' },
    ],
  })

  const listed = await listActiveUserClinics(client, USER_ID)
  assert.deepEqual(listed, {
    ok: true,
    clinics: [
      { clinicId: CLINIC_1_ID, clinicName: 'Clinica Alfa', membershipRole: 'vet' },
      { clinicId: CLINIC_3_ID, clinicName: 'Clinica Gama', membershipRole: 'vet' },
    ],
  })

  if (listed.ok) {
    assert.equal(resolveActiveClinicFromList(listed.clinics, CLINIC_3_ID)?.clinicId, CLINIC_3_ID)
    assert.equal(resolveActiveClinicFromList(listed.clinics, CLINIC_2_ID)?.clinicId, CLINIC_1_ID)
    assert.equal(resolveActiveClinicFromList([], CLINIC_1_ID), null)
  }

  const failingClient = fakeMultiClinicClient({
    memberships: [{ clinic_id: CLINIC_1_ID, user_id: USER_ID, role: 'vet', status: 'active' }],
    clinicError: new Error('rls error'),
  })
  assert.deepEqual(await listActiveUserClinics(failingClient, USER_ID), { ok: false })
})

test('multi-clinic endpoint, lab shell, and RSC pages enforce fail-closed cookie switching contracts', () => {
  const webRoot = resolve(import.meta.dirname, '../..')

  const routeSource = readFileSync(resolve(webRoot, 'src/app/api/lab/active-clinic/route.ts'), 'utf8')
  const switcherSource = readFileSync(resolve(webRoot, 'src/components/lab/ClinicSwitcher.tsx'), 'utf8')
  const labShellSource = readFileSync(resolve(webRoot, 'src/components/lab/LabShell.tsx'), 'utf8')
  const labLayoutSource = readFileSync(resolve(webRoot, 'src/app/lab/layout.tsx'), 'utf8')
  const labContextSource = readFileSync(resolve(webRoot, 'src/lib/server-lab-context.ts'), 'utf8')
  const labPageSource = readFileSync(resolve(webRoot, 'src/app/lab/page.tsx'), 'utf8')
  const patientPageSource = readFileSync(resolve(webRoot, 'src/app/lab/pacientes/[petId]/page.tsx'), 'utf8')

  assert.match(routeSource, /authorizeServerRoles\(supabase, \['vet', 'admin'\]\)/)
  assert.match(routeSource, /assertSameOriginMutation\(request\)/)
  assert.match(routeSource, /checkIpRateLimit\(request, 'active_clinic_switch'/)
  assert.match(routeSource, /assertAllowedKeys\(body, \['clinic_id'\]\)/)
  assert.match(routeSource, /isUuid\(clinicId\)/)
  assert.match(routeSource, /code: 'NOT_FOUND'/)
  assert.match(routeSource, /code: 'AUTHORIZATION_UNAVAILABLE'/)
  assert.match(routeSource, /ACTIVE_CLINIC_COOKIE_NAME/)
  assert.match(routeSource, /export async function DELETE/)

  assert.match(switcherSource, /switchInFlightRef\.current/)
  assert.match(switcherSource, /requestJsonMutation\(\s*'\/api\/lab\/active-clinic'/)
  assert.match(switcherSource, /aria-label="Clínica ativa"/)
  assert.match(switcherSource, /resolvePostClinicSwitchPath/)
  assert.doesNotMatch(switcherSource, /useEffect/)

  assert.match(labShellSource, /<ClinicSwitcher/)
  assert.match(labShellSource, /fetch\('\/api\/lab\/active-clinic', \{ method: 'DELETE' \}\)/)
  assert.match(labLayoutSource, /listActiveUserClinics\(supabase, user\.id\)/)
  assert.match(labLayoutSource, /readActiveClinicCookie\(\)/)
  assert.match(labContextSource, /readActiveClinicCookie\(\)/)
  assert.match(labPageSource, /requireLabClinicContext\('\/lab'\)/)
  assert.match(patientPageSource, /readActiveClinicCookie\(\)/)
})
