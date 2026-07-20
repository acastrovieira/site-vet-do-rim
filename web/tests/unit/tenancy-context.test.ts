import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database.ts'
import { resolveActiveClinic } from '../../src/lib/server-clinic-context.ts'
import { authorizeClinicAccess } from '../../src/lib/server-authorization.ts'

/**
 * Contratos unitarios da Fase 1.5 (ADR-001 tenancy) — ver
 * docs/architecture/fase1-tenancy-implementation-spec.md secao 4.
 *
 * Sem E2E real aqui (exige projeto efemero/staging): estes testes mockam o
 * client Supabase para provar a plumbing de `resolveActiveClinic` e
 * `authorizeClinicAccess`, e leem o codigo-fonte das rotas para provar que o
 * `clinic_id` so pode vir do contexto resolvido no servidor — nunca do body.
 */

type MembershipRow = { clinic_id: string; role: 'clinic_admin' | 'vet' | 'recepcao' }

function fakeMembershipClient(
  userId: string | null,
  memberships: MembershipRow[],
  options: { membershipError?: unknown; profileRole?: string } = {},
) {
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === 'clinic_memberships') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => {
                      if (options.membershipError) {
                        return { data: null, error: options.membershipError }
                      }
                      // A query real ordena por `criado_em` ascendente e usa
                      // limit(1); aqui simulamos o resultado ja ordenado que
                      // o Postgres devolveria (primeira membership por ingresso).
                      const [first] = memberships
                      return { data: first ?? null, error: null }
                    },
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: userId ? { role: options.profileRole ?? 'vet' } : null,
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table in test double: ${table}`)
    },
  }
  return client as unknown as SupabaseClient<Database>
}

test('resolveActiveClinic returns null when the user has no active membership', async () => {
  const client = fakeMembershipClient('user-1', [])
  assert.equal(await resolveActiveClinic(client, 'user-1'), null)
})

test('resolveActiveClinic resolves automatically with exactly one active membership', async () => {
  const client = fakeMembershipClient('user-1', [{ clinic_id: 'clinic-a', role: 'vet' }])
  assert.deepEqual(await resolveActiveClinic(client, 'user-1'), {
    clinicId: 'clinic-a',
    membershipRole: 'vet',
  })
})

test('resolveActiveClinic picks the first membership by criado_em when there are several (TODO seletor)', async () => {
  const client = fakeMembershipClient('user-1', [
    { clinic_id: 'clinic-oldest', role: 'recepcao' },
    { clinic_id: 'clinic-newest', role: 'clinic_admin' },
  ])
  assert.deepEqual(await resolveActiveClinic(client, 'user-1'), {
    clinicId: 'clinic-oldest',
    membershipRole: 'recepcao',
  })
})

test('resolveActiveClinic fails closed to null on a query error', async () => {
  const client = fakeMembershipClient('user-1', [], { membershipError: new Error('connection reset') })
  assert.equal(await resolveActiveClinic(client, 'user-1'), null)
})

test('authorizeClinicAccess stays retrocompatible: no membership does not block a role-authorized user', async () => {
  const client = fakeMembershipClient('user-1', [])
  assert.deepEqual(await authorizeClinicAccess(client, ['vet', 'admin']), {
    ok: true,
    role: 'vet',
    userId: 'user-1',
    clinicId: null,
    membershipRole: null,
  })
})

test('authorizeClinicAccess surfaces the resolved clinic context when a membership exists', async () => {
  const client = fakeMembershipClient('user-1', [{ clinic_id: 'clinic-a', role: 'vet' }])
  assert.deepEqual(await authorizeClinicAccess(client, ['vet', 'admin']), {
    ok: true,
    role: 'vet',
    userId: 'user-1',
    clinicId: 'clinic-a',
    membershipRole: 'vet',
  })
})

test('authorizeClinicAccess denies unauthenticated and unauthorized users without querying memberships', async () => {
  let membershipQueried = false
  const guardClient = {
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    from: (table: string) => {
      if (table === 'clinic_memberships') membershipQueried = true
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
    },
  } as unknown as SupabaseClient<Database>

  assert.deepEqual(await authorizeClinicAccess(guardClient, ['vet', 'admin']), {
    ok: false,
    code: 'UNAUTHENTICATED',
    status: 401,
  })
  assert.equal(membershipQueried, false)

  const forbiddenClient = fakeMembershipClient('user-1', [], { profileRole: 'tutor' })
  assert.deepEqual(await authorizeClinicAccess(forbiddenClient, ['vet', 'admin']), {
    ok: false,
    code: 'FORBIDDEN',
    status: 403,
  })
})

test('pets and tutores mutation routes resolve clinic context via authorizeClinicAccess', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const sources = {
    tutoresPost: readFileSync(resolve(webRoot, 'src/app/api/tutores/route.ts'), 'utf8'),
    tutoresPatch: readFileSync(resolve(webRoot, 'src/app/api/tutores/[id]/route.ts'), 'utf8'),
    petsPost: readFileSync(resolve(webRoot, 'src/app/api/pets/route.ts'), 'utf8'),
    petsPatch: readFileSync(resolve(webRoot, 'src/app/api/pets/[id]/route.ts'), 'utf8'),
  }

  for (const source of Object.values(sources)) {
    assert.match(source, /authorizeClinicAccess\(supabase, \['vet', 'admin'\]\)/)
  }

  // O insert grava clinic_id/created_by somente a partir do contexto
  // resolvido no servidor — nunca a partir do body da requisicao.
  assert.match(
    sources.tutoresPost,
    /clinic_id: authorization\.clinicId, created_by: authorization\.userId/,
  )
  assert.match(
    sources.petsPost,
    /clinic_id: authorization\.clinicId, created_by: authorization\.userId/,
  )

  // O update filtra explicitamente por clinic_id quando ha contexto —
  // UUID de outro tenant vira 404 (linha inexistente), nunca 403.
  assert.match(sources.tutoresPatch, /updateQuery = updateQuery\.eq\('clinic_id', authorization\.clinicId\)/)
  assert.match(sources.petsPatch, /updateQuery = updateQuery\.eq\('clinic_id', authorization\.clinicId\)/)

  // Defesa em profundidade: o tutor referenciado precisa pertencer a mesma
  // clinica ativa antes do insert/update do pet.
  assert.match(sources.petsPost, /\.eq\('clinic_id', authorization\.clinicId\)/)
  assert.match(sources.petsPatch, /\.eq\('clinic_id', authorization\.clinicId\)/)
})

test('pets and tutores mutation routes never accept clinic_id/created_by/vet_id from the request body', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const relativePaths = [
    'src/app/api/tutores/route.ts',
    'src/app/api/tutores/[id]/route.ts',
    'src/app/api/pets/route.ts',
    'src/app/api/pets/[id]/route.ts',
  ]

  for (const relativePath of relativePaths) {
    const source = readFileSync(resolve(webRoot, relativePath), 'utf8')
    const allowlistMatch = source.match(/assertAllowedKeys\(body, \[([\s\S]*?)\]\)/)
    assert.ok(allowlistMatch, `${relativePath} deve validar o body com assertAllowedKeys`)
    assert.doesNotMatch(
      allowlistMatch[1],
      /'clinic_id'|'created_by'|'vet_id'/,
      `${relativePath} nao pode permitir clinic_id/created_by/vet_id vindos do cliente`,
    )
  }
})
