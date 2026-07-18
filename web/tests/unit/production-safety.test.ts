import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database.ts'
import {
  calcularTFG,
  getProteinuriaSubstage,
  getStageByCreatinine,
  getStageBySdma,
} from '../../src/lib/tfg-calculator.ts'
import { gradeAKI } from '../../src/lib/aki-grading.ts'
import { exportarCSV, type RegistroPeso } from '../../src/lib/peso-controller.ts'
import {
  assertDeletedIds,
  assertNoRows,
  assertRemovedCount,
  assertRows,
  assertValidCleanupRunId,
  deleteAuthUsersAndVerify,
  matchesExactE2EUser,
  runCleanupSteps,
  verifyAuthUsersAbsent,
} from '../../scripts/lib/e2e-cleanup-match.mjs'
import { assertSupabaseTarget } from '../../scripts/lib/supabase-target.mjs'
import {
  isRoleAuthorized,
  isRoleAuthorizedForRedirect,
  requiresAuthentication,
  safeInternalRedirectPath,
} from '../../src/lib/route-authorization.ts'
import { assertServerQuerySucceeded } from '../../src/lib/server-query-safety.ts'
import {
  getBoundedTimeoutMs,
  getReadinessChecks,
  hasValidBearerSecret,
  isConfiguredSupabasePublicKey,
  isConfiguredSupabaseUrl,
  isReady,
  parseHttpsHealthUrl,
} from '../../src/lib/operational-health.ts'
import {
  getRemoteReadinessTimeoutMs,
  parseRemoteReadinessArgs,
  safeEnvSourceLabel,
} from '../../scripts/lib/readiness-safety.mjs'
import { authorizeServerRoles } from '../../src/lib/server-authorization.ts'
import { getPostBySlug } from '../../src/lib/blog.ts'
import {
  detectTrend,
  resolveLaudoChronology,
  sortLaudosChronologically,
  transformLaudosToEvolution,
  type ResultadoIA,
} from '../../src/lib/lab/transform-laudo-data.ts'
import {
  getRefForSpecies,
  resolveReferenceSpecies,
} from '../../src/lib/lab/reference-values.ts'
import {
  expiredRecoveryCookieOptions,
  isRecoveryCompletionPayload,
  isRecoveryDestination,
  isVerifiedRecoveryExchange,
  recoveryCookieOptions,
} from '../../src/lib/auth-recovery.ts'

test('IRIS 2026 uses species-specific creatinine boundaries', () => {
  assert.equal(getStageByCreatinine(1.39, 'cao'), 1)
  assert.equal(getStageByCreatinine(1.4, 'cao'), 2)
  assert.equal(getStageByCreatinine(2.8, 'cao'), 2)
  assert.equal(getStageByCreatinine(2.81, 'cao'), 3)
  assert.equal(getStageByCreatinine(5, 'cao'), 3)
  assert.equal(getStageByCreatinine(5.01, 'cao'), 4)

  assert.equal(getStageByCreatinine(1.59, 'gato'), 1)
  assert.equal(getStageByCreatinine(1.6, 'gato'), 2)
})

test('IRIS 2026 uses species-specific SDMA and UPC boundaries', () => {
  assert.equal(getStageBySdma(25, 'gato'), 2)
  assert.equal(getStageBySdma(26, 'gato'), 3)
  assert.equal(getStageBySdma(38, 'gato'), 3)
  assert.equal(getStageBySdma(39, 'gato'), 4)
  assert.equal(getStageBySdma(35, 'cao'), 2)
  assert.equal(getStageBySdma(36, 'cao'), 3)
  assert.equal(getStageBySdma(54, 'cao'), 3)
  assert.equal(getStageBySdma(55, 'cao'), 4)

  assert.equal(getProteinuriaSubstage(0.4, 'gato'), 'borderline')
  assert.equal(getProteinuriaSubstage(0.41, 'gato'), 'proteinurico')
  assert.equal(getProteinuriaSubstage(0.5, 'cao'), 'borderline')
  assert.equal(getProteinuriaSubstage(0.51, 'cao'), 'proteinurico')
})

test('legacy calculator returns IRIS staging without inventing a GFR value', () => {
  const result = calcularTFG({
    species: 'gato',
    creatininaMgDl: 2.4,
    sdmaMcgDl: 26,
  })
  assert.equal(result.stage, 3)
  assert.equal('tfgEstimadaMin' in result, false)
  assert.equal('tfgEstimadaMax' in result, false)
})

test('AKI urine output is a subgrade and never upgrades creatinine grade', () => {
  const result = gradeAKI({
    creatinineMgDl: 2,
    urineOutputStatus: 'oliguria',
    hasClinicalEvidence: true,
  })
  assert.deepEqual(result, { grade: 2, urineSubgrade: 'O', deltaMgDl: undefined })
})

test('AKI requires evidence and respects the official reported ranges', () => {
  assert.equal(gradeAKI({
    creatinineMgDl: 1.5,
    urineOutputStatus: 'normal',
    hasClinicalEvidence: false,
  }), null)

  assert.equal(gradeAKI({
    creatinineMgDl: 1.6,
    urineOutputStatus: 'normal',
    hasClinicalEvidence: true,
  }), null)

  assert.equal(gradeAKI({
    creatinineMgDl: 1.7,
    urineOutputStatus: 'normal',
    hasClinicalEvidence: true,
  })?.grade, 2)

  assert.equal(gradeAKI({
    creatinineMgDl: 1.3,
    previousCreatinineMgDl: 1,
    intervalHours: 48,
    urineOutputStatus: 'nao_avaliado',
    hasClinicalEvidence: false,
  }), null)

  assert.equal(gradeAKI({
    creatinineMgDl: 1.31,
    previousCreatinineMgDl: 1,
    intervalHours: 48,
    urineOutputStatus: 'nao_avaliado',
    hasClinicalEvidence: false,
  })?.grade, 1)
})

test('E2E cleanup only accepts a suite-specific exact identity', () => {
  assert.equal(
    matchesExactE2EUser(
      'e2e-vet-labcrud-20260716123045@example.test',
      'labcrud-20260716123045',
      'labcrud',
    ),
    true,
  )
  assert.equal(
    matchesExactE2EUser(
      'real-labcrud-20260716123045@example.test',
      'labcrud-20260716123045',
      'labcrud',
    ),
    false,
  )
  assert.throws(() => assertValidCleanupRunId('123', 'labcrud'))
  assert.throws(() => assertValidCleanupRunId('uploadia-20260716123045', 'labcrud'))
})

test('E2E cleanup verifies deletions and detects residues', () => {
  assert.doesNotThrow(() => assertDeletedIds('pets', ['pet-2', 'pet-1'], [
    { id: 'pet-1' },
    { id: 'pet-2' },
  ]))
  assert.throws(() => assertDeletedIds('pets', ['pet-1', 'pet-2'], [{ id: 'pet-1' }]))
  assert.doesNotThrow(() => assertRemovedCount('storage', 2, [{ name: 'a' }, { name: 'b' }]))
  assert.throws(() => assertRemovedCount('storage', 2, [{ name: 'a' }]))
  assert.doesNotThrow(() => assertNoRows('pets', []))
  assert.throws(() => assertNoRows('pets', [{ id: 'residue' }]))
  assert.throws(() => assertRows('pets', null))
})

test('E2E cleanup runs every step and propagates cleanup failures', async () => {
  const calls: string[] = []

  await assert.rejects(
    runCleanupSteps([
      ['first', async () => {
        calls.push('first')
        throw new Error('remote cleanup failed')
      }],
      ['second', () => {
        calls.push('second')
      }],
    ]),
    /Cleanup step "first" failed: remote cleanup failed/,
  )
  assert.deepEqual(calls, ['first', 'second'])

  const primaryError = new Error('Playwright failed')
  await assert.rejects(
    runCleanupSteps([
      ['cleanup', () => {
        throw new Error('residue found')
      }],
    ], { primaryError }),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError)
      assert.equal(error.errors[0], primaryError)
      assert.match(error.errors[1].message, /Cleanup step "cleanup" failed/)
      return true
    },
  )
})

test('Auth E2E cleanup attempts every deletion and aggregates sanitized failures', async () => {
  const users = [
    { id: 'auth-admin-id', email: 'e2e-admin-20260717123045@example.test', role: 'admin' },
    { id: 'auth-vet-id', email: 'e2e-vet-20260717123045@example.test', role: 'vet' },
    { id: 'auth-tutor-id', email: 'e2e-tutor-20260717123045@example.test', role: 'tutor' },
  ]
  const deleteCalls: string[] = []
  const listCalls: number[] = []
  const privateProviderDetail = 'private provider detail for secret@example.test'
  const authAdmin = {
    deleteUser: async (id: string) => {
      deleteCalls.push(id)
      return id === 'auth-vet-id'
        ? { data: null, error: new Error(privateProviderDetail) }
        : { data: null, error: null }
    },
    listUsers: async ({ page }: { page: number; perPage: number }) => {
      listCalls.push(page)
      return {
        data: {
          users: page === 1
            ? [{ id: 'unrelated-id', email: users[1].email }]
            : [],
          nextPage: null,
        },
        error: null,
      }
    },
  }

  await assert.rejects(
    deleteAuthUsersAndVerify(authAdmin, users, {
      isExpectedUser: (user: { email: string }) => user.email.endsWith('@example.test'),
    }),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError)
      assert.equal(error.errors.length, 2)
      assert.match(error.errors[0].message, /deleteUser failed for E2E vet/)
      assert.match(error.errors[1].message, /1 matching email/)
      assert.doesNotMatch(String(error), /private provider detail|secret@example\.test/)
      return true
    },
  )

  assert.deepEqual(deleteCalls, users.map((user) => user.id))
  assert.deepEqual(listCalls, [1])
})

test('Auth E2E cleanup verifies every page by both user ID and email', async () => {
  const users = [
    { id: 'expected-id', email: 'e2e-admin-20260717123045@example.test', role: 'admin' },
  ]
  const pages: number[] = []
  const authAdmin = {
    listUsers: async ({ page }: { page: number; perPage: number }) => {
      pages.push(page)
      return page === 1
        ? {
            data: {
              users: [{ id: 'unrelated-id', email: 'other@example.test' }],
              nextPage: 2,
            },
            error: null,
          }
        : {
            data: {
              users: [{ id: users[0].id, email: 'replacement@example.test' }],
              nextPage: null,
            },
            error: null,
          }
    },
  }

  await assert.rejects(
    verifyAuthUsersAbsent(authAdmin, users),
    /1 matching ID\(s\) and 0 matching email\(s\)/,
  )
  assert.deepEqual(pages, [1, 2])
})

test('Auth/RLS cycle wires fail-closed Auth cleanup into primary error handling', () => {
  const source = readFileSync(
    resolve(import.meta.dirname, '../../scripts/e2e-auth-rls-cycle.mjs'),
    'utf8',
  )

  assert.match(source, /deleteAuthUsersAndVerify\(supabase\.auth\.admin, users/)
  assert.match(source, /\['Auth E2E user cleanup', cleanup\]/)
  assert.match(source, /\], \{ primaryError \}\)/)
  assert.doesNotMatch(source, /finally\s*\{\s*await cleanup\(\)/)

  const remoteCycleSources = [
    source,
    readFileSync(resolve(import.meta.dirname, '../../scripts/e2e-lab-crud-cycle.mjs'), 'utf8'),
    readFileSync(resolve(import.meta.dirname, '../../scripts/e2e-upload-ia-cycle.mjs'), 'utf8'),
  ]
  for (const cycleSource of remoteCycleSources) {
    assert.doesNotMatch(cycleSource, /requested_role/)
  }
})

test('E2E apply cleanup uses exact run identities instead of name prefixes', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const labCycle = readFileSync(resolve(webRoot, 'scripts/e2e-lab-crud-cycle.mjs'), 'utf8')
  const cleanupScripts = [
    readFileSync(resolve(webRoot, 'scripts/cleanup-e2e-lab-crud.mjs'), 'utf8'),
    readFileSync(resolve(webRoot, 'scripts/cleanup-e2e-upload-ia.mjs'), 'utf8'),
  ]

  assert.match(labCycle, /\.eq\('email', `tutor-\$\{runId\}@example\.test`\)/)
  assert.match(labCycle, /\.in\('tutor_id', (?:scope\.)?tutorIds\)/)

  for (const source of cleanupScripts) {
    assert.match(source, /runId\s*\?\s*await tutorQuery\.eq\('email'/)
    assert.match(source, /await petQuery\.in\('tutor_id', tutorIds\)/)
    assert.doesNotMatch(source, /\.ilike\('nome', `[^`]*\$\{runId\}[^`]*%`\)/)
  }
})

test('CSV export escapes quotes, newlines and spreadsheet formulas', () => {
  const row: RegistroPeso = {
    id: 'test',
    nomePaciente: '=HYPERLINK("https://invalid.test")',
    especie: 'cao',
    pesoKg: 10,
    ecc: 5,
    data: '2026-07-16',
    observacoes: 'linha 1\n"linha 2"',
    criadoEm: 0,
  }
  const csv = exportarCSV([row])
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/invalid\.test""\)"/)
  assert.match(csv, /"linha 1 ""linha 2"""/)
})

test('unsafe legacy RLS scripts remain quarantined and fail closed', () => {
  const repoRoot = resolve(import.meta.dirname, '../../..')
  const legacySql = readFileSync(
    resolve(repoRoot, 'supabase/fix-laudos-storage.sql'),
    'utf8',
  )
  const legacyJs = readFileSync(
    resolve(repoRoot, 'supabase/apply-rls.js'),
    'utf8',
  )

  assert.match(legacySql, /QUARANTINED/)
  assert.match(legacySql, /RAISE EXCEPTION/)
  assert.doesNotMatch(legacySql, /CREATE\s+POLICY/i)

  assert.match(legacyJs, /QUARANTINED/)
  assert.doesNotMatch(legacyJs, /service_role|fetch\s*\(/i)
})

test('archived migrations remain documented as non-executable history', () => {
  const repoRoot = resolve(import.meta.dirname, '../../..')
  const archiveReadme = readFileSync(
    resolve(repoRoot, 'supabase/migrations_archive/README.md'),
    'utf8',
  )
  const supabaseConfig = readFileSync(
    resolve(repoRoot, 'supabase/config.toml'),
    'utf8',
  )

  assert.match(archiveReadme, /não executar/i)
  assert.match(archiveReadme, /não faz parte da cadeia ativa/i)
  assert.match(archiveReadme, /CREATE POLICY IF NOT EXISTS/)
  assert.doesNotMatch(supabaseConfig, /migrations_archive/)
})

test('remote mutation scripts require an explicit matching staging target', () => {
  const projectRef = 'abcdefghijklmnopqrst'
  const supabaseUrl = `https://${projectRef}.supabase.co`

  assert.deepEqual(assertSupabaseTarget({
    projectRef,
    supabaseUrl,
    environment: 'staging',
    mutationConfirmation: `CONFIRM_STAGING_MUTATION:${projectRef}`,
    requireMutationConfirmation: true,
  }), { projectRef, supabaseUrl })

  assert.throws(() => assertSupabaseTarget({
    projectRef,
    supabaseUrl: 'https://different-project.supabase.co',
  }))
  assert.throws(() => assertSupabaseTarget({
    projectRef,
    supabaseUrl,
    environment: 'production',
    mutationConfirmation: `CONFIRM_STAGING_MUTATION:${projectRef}`,
    requireMutationConfirmation: true,
  }))
  assert.throws(() => assertSupabaseTarget({
    projectRef,
    supabaseUrl,
    environment: 'staging',
    requireMutationConfirmation: true,
  }))
})

test('protected route authorization is exact and fails closed by role', () => {
  assert.equal(requiresAuthentication('/lab'), true)
  assert.equal(requiresAuthentication('/lab/pacientes'), true)
  assert.equal(requiresAuthentication('/laboratorio'), false)

  assert.equal(isRoleAuthorized('/admin', 'admin'), true)
  assert.equal(isRoleAuthorized('/admin', 'vet'), false)
  assert.equal(isRoleAuthorized('/lab', 'tutor'), false)
  assert.equal(isRoleAuthorized('/lab', null), false)
  assert.equal(isRoleAuthorized('/portal', 'tutor'), true)
  assert.equal(isRoleAuthorized('/portal', 'admin'), false)
})

test('post-auth redirects accept only normalized same-origin paths', () => {
  assert.equal(safeInternalRedirectPath('/lab/pacientes?tab=recentes'), '/lab/pacientes?tab=recentes')
  assert.equal(safeInternalRedirectPath('//evil.example/path'), '')
  assert.equal(safeInternalRedirectPath('/\\evil.example/path'), '')
  assert.equal(safeInternalRedirectPath('/%2f%2fevil.example/path'), '')
  assert.equal(safeInternalRedirectPath('/%5cevil.example/path'), '')
  assert.equal(safeInternalRedirectPath('https://evil.example/path'), '')
  assert.equal(safeInternalRedirectPath('/auth/callback?code=loop'), '')
  assert.equal(safeInternalRedirectPath('/auth/redefinir-senha'), '')
  assert.equal(safeInternalRedirectPath('/auth/login'), '')
  assert.equal(safeInternalRedirectPath('/lab#fragment'), '')
  assert.equal(isRoleAuthorizedForRedirect('/lab?tab=recentes', 'tutor'), false)
  assert.equal(isRoleAuthorizedForRedirect('/lab?tab=recentes', 'vet'), true)
  assert.equal(isRoleAuthorizedForRedirect('/portal?tab=perfil', 'tutor'), true)
})

test('local Auth redirects match every supported development and E2E callback origin', () => {
  const config = readFileSync(
    resolve(import.meta.dirname, '../../../supabase/config.toml'),
    'utf8',
  )

  assert.match(config, /site_url = "http:\/\/localhost:3000"/)
  for (const port of [3000, 3310, 3312]) {
    assert.match(config, new RegExp(`"http:\\/\\/localhost:${port}\\/\\*\\*"`))
    assert.match(config, new RegExp(`"http:\\/\\/127\\.0\\.0\\.1:${port}\\/\\*\\*"`))
  }
  assert.doesNotMatch(config, /https:\/\/(?:localhost|127\.0\.0\.1)/)
  assert.match(config, /minimum_password_length = 8/)
  assert.match(config, /Production must use its exact HTTPS callback/)
})

test('Auth callback distinguishes recovery flows and exposes only sanitized errors', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const callback = readFileSync(
    resolve(webRoot, 'src/app/auth/callback/route.ts'),
    'utf8',
  )
  const loginPage = readFileSync(
    resolve(webRoot, 'src/app/auth/login/page.tsx'),
    'utf8',
  )
  const recoveryPage = readFileSync(
    resolve(webRoot, 'src/app/auth/recuperar-senha/page.tsx'),
    'utf8',
  )
  const registrationForm = readFileSync(
    resolve(webRoot, 'src/components/auth/CadastroForm.tsx'),
    'utf8',
  )

  assert.match(callback, /'redirectType' in data/)
  assert.match(callback, /isVerifiedRecoveryExchange\(exchangeRedirectType\)/)
  assert.match(callback, /authRedirect\(request, '\/auth\/redefinir-senha', true\)/)
  assert.match(callback, /\/auth\/recuperar-senha\?error=link_expirado/)
  assert.doesNotMatch(callback, /error\.message|console\.(?:error|warn|log)/)
  assert.match(loginPage, /role="alert"/)
  assert.match(loginPage, /errorCode === 'profile'/)
  assert.match(recoveryPage, /errorCode === 'link_expirado'/)
  assert.match(recoveryPage, /role="alert"/)
  assert.match(registrationForm, /concluir o cadastro agora/)
  assert.doesNotMatch(registrationForm, /jÃ¡ (?:estÃ¡ )?cadastrad|already registered/i)
})

test('recovery authorization accepts only the SDK recovery type and hardens its marker', () => {
  assert.equal(isVerifiedRecoveryExchange('recovery'), true)
  assert.equal(isVerifiedRecoveryExchange(null), false)
  assert.equal(isVerifiedRecoveryExchange('signup'), false)
  assert.equal(isVerifiedRecoveryExchange({ type: 'recovery' }), false)

  assert.deepEqual(recoveryCookieOptions(true), {
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    path: '/auth/redefinir-senha',
    maxAge: 600,
  })
  assert.equal(recoveryCookieOptions(false).secure, false)
  assert.deepEqual(expiredRecoveryCookieOptions(true), {
    ...recoveryCookieOptions(true),
    maxAge: 0,
  })

  assert.equal(isRecoveryDestination('/lab'), true)
  assert.equal(isRecoveryDestination('/portal'), true)
  assert.equal(isRecoveryDestination('/admin'), false)
  assert.equal(isRecoveryDestination('//example.com'), false)
  assert.equal(isRecoveryCompletionPayload({ ok: true, redirectTo: '/lab' }), true)
  assert.equal(isRecoveryCompletionPayload({ ok: true, redirectTo: '/portal' }), true)
  assert.equal(isRecoveryCompletionPayload({ ok: false, redirectTo: '/lab' }), false)
  assert.equal(isRecoveryCompletionPayload({ ok: true, redirectTo: '/auth/login' }), false)
  assert.equal(isRecoveryCompletionPayload(null), false)
})

test('password recovery completion consumes its marker without a remote mutation', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const route = readFileSync(
    resolve(webRoot, 'src/app/auth/redefinir-senha/concluir/route.ts'),
    'utf8',
  )
  const resetForm = readFileSync(
    resolve(webRoot, 'src/app/auth/redefinir-senha/ResetForm.tsx'),
    'utf8',
  )

  assert.match(route, /marker !== RECOVERY_COOKIE_VALUE/)
  assert.match(route, /authorizeServerRoles\(supabase, \['admin', 'vet', 'tutor'\]\)/)
  assert.match(route, /roleHome\(authorization\.role\)/)
  assert.match(route, /expiredRecoveryCookieOptions/)
  assert.match(route, /privateApiJson/)
  assert.doesNotMatch(route, /\.(?:insert|update|delete|upsert)\s*\(/)
  assert.match(resetForm, /fetch\('\/auth\/redefinir-senha\/concluir'/)
  assert.match(resetForm, /isRecoveryCompletionPayload/)
  assert.doesNotMatch(resetForm, /router\.replace\('\/lab'\)/)
})

test('clinical API authorization uses the persisted profile role and fails closed', async () => {
  const fakeClient = (
    userId: string | null,
    profile: { role: string } | null,
    profileError: unknown = null,
  ) => ({
    auth: {
      getUser: async () => ({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: profile, error: profileError }),
        }),
      }),
    }),
  }) as unknown as SupabaseClient<Database>

  assert.deepEqual(
    await authorizeServerRoles(fakeClient(null, null), ['vet', 'admin']),
    { ok: false, code: 'UNAUTHENTICATED', status: 401 },
  )
  assert.deepEqual(
    await authorizeServerRoles(fakeClient('user-1', { role: 'tutor' }), ['vet', 'admin']),
    { ok: false, code: 'FORBIDDEN', status: 403 },
  )
  assert.deepEqual(
    await authorizeServerRoles(fakeClient('user-1', { role: 'vet' }), ['vet', 'admin']),
    { ok: true, role: 'vet', userId: 'user-1' },
  )
  assert.deepEqual(
    await authorizeServerRoles(fakeClient('user-1', null, new Error('private detail')), ['vet']),
    { ok: false, code: 'AUTHORIZATION_UNAVAILABLE', status: 503 },
  )
})

test('clinical mutation handlers enforce server roles and private responses', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const handlers = [
    'src/app/api/tutores/route.ts',
    'src/app/api/tutores/[id]/route.ts',
    'src/app/api/pets/route.ts',
    'src/app/api/pets/[id]/route.ts',
  ].map((relativePath) => readFileSync(resolve(webRoot, relativePath), 'utf8'))

  for (const source of handlers) {
    assert.match(source, /authorizeServerRoles\(supabase, \['vet', 'admin'\]\)/)
    assert.match(source, /authorizationFailureJson\(authorization\)/)
    assert.match(source, /privateApiJson\(/)
    assert.match(source, /assertAllowedKeys\(body,/)
    assert.match(source, /PAYLOAD_TOO_LARGE/)
    assert.match(source, /status: 413/)
    assert.doesNotMatch(source, /user_metadata|app_metadata/)
  }

  const petUpdate = handlers[3]
  assert.match(petUpdate, /DEATH_WORKFLOW_UNAVAILABLE/)
  assert.match(petUpdate, /DEATH_STATUS_IMMUTABLE/)
  assert.match(petUpdate, /expectedStatus/)
  assert.match(petUpdate, /const isMissing = expectedStatus === null && !error && !data/)
  assert.match(petUpdate, /\.eq\('status_paciente', expectedStatus\)/)

  const responseHelper = readFileSync(
    resolve(webRoot, 'src/lib/server-api-response.ts'),
    'utf8',
  )
  assert.match(responseHelper, /private, no-store, no-cache/)
})

test('blog lookup rejects traversal and does not echo an unsafe slug', () => {
  const unsafeSlug = '..\\..\\private-secret'
  assert.throws(
    () => getPostBySlug(unsafeSlug),
    (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.doesNotMatch(error.message, /private-secret|\.\./)
      return true
    },
  )
})

test('lab evolution ignores malformed AI sections and treats equal zeroes as stable', () => {
  const malformedResult = {
    bioquimica: { creatinina: '2.4' },
    data_coleta: '2026-07-17',
  } as unknown as ResultadoIA

  assert.doesNotThrow(() => transformLaudosToEvolution([{
    id: 'laudo-1',
    created_at: '2026-07-17T12:00:00.000Z',
    resultado_ia: malformedResult,
    status: 'concluido',
    nome_arquivo: 'laudo.pdf',
  }], 'canino'))
  assert.deepEqual(transformLaudosToEvolution([{
    id: 'laudo-1',
    created_at: '2026-07-17T12:00:00.000Z',
    resultado_ia: malformedResult,
    status: 'concluido',
    nome_arquivo: 'laudo.pdf',
  }], 'canino'), [])
  assert.equal(detectTrend([{ value: 0 }, { value: 0 }]), 'estavel')
})

test('lab evolution orders by valid collection date and labels legacy fallback', () => {
  const laudos = [
    {
      id: 'uploaded-late',
      created_at: '2026-07-20T12:00:00.000Z',
      resultado_ia: {
        bioquimica: { creatinina: 1.1 },
        data_coleta: '2026-07-01',
        data_resultado: null,
        laboratorio: null,
      } as ResultadoIA,
      status: 'concluido',
      nome_arquivo: 'early.pdf',
    },
    {
      id: 'uploaded-first',
      created_at: '2026-07-11T12:00:00.000Z',
      resultado_ia: {
        bioquimica: { creatinina: 2.2 },
        data_coleta: '2026-07-10',
        data_resultado: null,
        laboratorio: null,
      } as ResultadoIA,
      status: 'concluido',
      nome_arquivo: 'later.pdf',
    },
  ]

  assert.deepEqual(
    sortLaudosChronologically(laudos).map((laudo) => laudo.id),
    ['uploaded-late', 'uploaded-first'],
  )
  const creatinine = transformLaudosToEvolution(laudos, 'canino')
    .flatMap((group) => group.rows)
    .find((row) => row.key === 'creatinina')
  assert.deepEqual(
    creatinine?.values.map(({ laudoId, date, value }) => ({ laudoId, date, value })),
    [
      { laudoId: 'uploaded-late', date: '01/07/2026', value: 1.1 },
      { laudoId: 'uploaded-first', date: '10/07/2026', value: 2.2 },
    ],
  )

  const legacy = {
    ...laudos[0],
    id: 'invalid-legacy-date',
    created_at: '2026-01-15T01:00:00.000Z',
    resultado_ia: {
      ...laudos[0].resultado_ia,
      data_coleta: '2026-02-30',
    },
  }
  assert.deepEqual(resolveLaudoChronology(legacy), {
    sortTimestamp: Date.parse(legacy.created_at),
    uploadTimestamp: Date.parse(legacy.created_at),
    displayDate: '14/01/2026',
    source: 'upload',
  })

  const unavailable = {
    ...legacy,
    id: 'unavailable-date',
    created_at: 'not-a-timestamp',
    resultado_ia: {
      ...legacy.resultado_ia,
      data_coleta: null,
    },
  }
  assert.deepEqual(resolveLaudoChronology(unavailable), {
    sortTimestamp: Number.MAX_SAFE_INTEGER,
    uploadTimestamp: Number.MAX_SAFE_INTEGER,
    displayDate: 'Data indisponível',
    source: 'unavailable',
  })

  const sameDate = [
    { ...laudos[0], id: 'tie-b', created_at: '2026-07-20T12:00:00.000Z' },
    { ...laudos[0], id: 'tie-a', created_at: '2026-07-20T12:00:00.000Z' },
  ]
  assert.deepEqual(
    sortLaudosChronologically(sameDate).map((laudo) => laudo.id),
    ['tie-a', 'tie-b'],
  )
})

test('laboratory references never fall back across unsupported species', () => {
  assert.equal(resolveReferenceSpecies('Cão'), 'canino')
  assert.equal(resolveReferenceSpecies('felino'), 'felino')
  assert.equal(resolveReferenceSpecies('equino'), null)
  assert.throws(() => getRefForSpecies('equino'), /indisponível/i)

  const equineResult = {
    bioquimica: { creatinina: 1.2 },
    data_coleta: '2026-07-17',
  } as unknown as ResultadoIA
  assert.doesNotThrow(() => transformLaudosToEvolution([{
    id: 'laudo-equino',
    created_at: '2026-07-17T12:00:00.000Z',
    resultado_ia: equineResult,
    status: 'concluido',
    nome_arquivo: 'laudo-equino.pdf',
  }], 'equino'))
})

test('proxy responses carrying authenticated state are explicitly non-cacheable', () => {
  const source = readFileSync(
    resolve(import.meta.dirname, '../../src/proxy.ts'),
    'utf8',
  )

  assert.match(source, /private, no-store, no-cache/)
  assert.match(source, /markAuthResponsePrivate\(response\)/)
  assert.match(source, /sessionResponse\.cookies\.getAll\(\)/)
  assert.match(source, /if \(!isProtected\) return NextResponse\.next\(\)/)
  assert.match(source, /return markAuthResponsePrivate\(supabaseResponse\)/)
  assert.ok(
    source.indexOf("if (!isProtected) return NextResponse.next()")
      < source.indexOf('createServerClient('),
  )
})

test('cron health checks do not read clinical rows or use a settings endpoint as health', () => {
  const source = readFileSync(
    resolve(import.meta.dirname, '../../src/app/api/cron/keep-alive/route.ts'),
    'utf8',
  )

  assert.match(source, /\/rest\/v1\//)
  assert.doesNotMatch(source, /\.from\(/)
  assert.doesNotMatch(source, /createClient/)
  assert.match(source, /\/auth\/v1\/health/)
  assert.doesNotMatch(source, /\/auth\/v1\/settings/)
})

test('server query failures expose a stable code without provider details', () => {
  const providerError = {
    message: 'private SQL detail for tutor@example.test',
    details: 'patient-id',
  }

  assert.throws(
    () => assertServerQuerySucceeded(providerError, 'PATIENT_QUERY_FAILED'),
    (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.equal(error.name, 'ServerQueryError')
      assert.equal(error.message, 'PATIENT_QUERY_FAILED')
      assert.doesNotMatch(error.message, /tutor|patient-id|SQL/i)
      return true
    },
  )
  assert.doesNotThrow(() => assertServerQuerySucceeded(null, 'IGNORED'))
})

test('liveness/readiness helpers reject placeholders and malformed configuration', () => {
  const projectRef = 'abcdefghijklmnopqrst'
  const publishableKey = `sb_publishable_${'a'.repeat(24)}`
  const legacyKey = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signature'

  assert.equal(isConfiguredSupabaseUrl(`https://${projectRef}.supabase.co`), true)
  assert.equal(isConfiguredSupabaseUrl('https://PROJECT_REF.supabase.co'), false)
  assert.equal(isConfiguredSupabaseUrl(`http://${projectRef}.supabase.co`), false)
  assert.equal(isConfiguredSupabaseUrl(`https://${projectRef}.supabase.co/path`), false)
  assert.equal(isConfiguredSupabasePublicKey(publishableKey), true)
  assert.equal(isConfiguredSupabasePublicKey(legacyKey), true)
  const serviceRolePayload = Buffer.from(JSON.stringify({ role: 'service_role' }))
    .toString('base64url')
  assert.equal(
    isConfiguredSupabasePublicKey(`eyJhbGciOiJIUzI1NiJ9.${serviceRolePayload}.signature`),
    false,
  )
  assert.equal(isConfiguredSupabasePublicKey('eyJ.invalid.signature'), false)
  assert.equal(isConfiguredSupabasePublicKey('replace-with-key'), false)

  const checks = getReadinessChecks({
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publishableKey,
  })
  assert.equal(isReady(checks), true)
  assert.equal(isReady(getReadinessChecks({})), false)
})

test('cron authorization, health target and timeouts fail closed', () => {
  const secret = 'a'.repeat(32)
  assert.equal(hasValidBearerSecret(`Bearer ${secret}`, secret), true)
  assert.equal(hasValidBearerSecret(`Bearer ${secret}x`, secret), false)
  assert.equal(hasValidBearerSecret(`Bearer ${'x'.repeat(5000)}`, secret), false)
  assert.equal(hasValidBearerSecret(`Bearer ${'a'.repeat(16)}`, 'a'.repeat(16)), false)
  assert.equal(hasValidBearerSecret(null, secret), false)

  assert.equal(parseHttpsHealthUrl('https://health.example.test/status'), 'https://health.example.test/status')
  assert.equal(parseHttpsHealthUrl('http://health.example.test/status'), null)
  assert.equal(parseHttpsHealthUrl('https://user:pass@health.example.test/status'), null)
  assert.equal(parseHttpsHealthUrl('https://health.example.test/status#secret'), null)

  assert.equal(getBoundedTimeoutMs('1000'), 1000)
  assert.equal(getBoundedTimeoutMs('10001'), 5000)
  assert.equal(getBoundedTimeoutMs('not-a-number'), 5000)
})

test('remote readiness is local-only unless the explicit flag is present', () => {
  assert.deepEqual(parseRemoteReadinessArgs([]), { allowRemote: false })
  assert.deepEqual(parseRemoteReadinessArgs(['--remote']), { allowRemote: true })
  assert.throws(() => parseRemoteReadinessArgs(['--apply']))
  assert.equal(getRemoteReadinessTimeoutMs('15000'), 15000)
  assert.equal(getRemoteReadinessTimeoutMs('15001'), 5000)

  const sourceLabel = safeEnvSourceLabel(
    resolve(process.cwd(), '../.env.local'),
    process.cwd(),
  )
  assert.equal(sourceLabel, 'repo/.env.local')
  assert.doesNotMatch(sourceLabel, /Users|acast/i)

  const source = readFileSync(
    resolve(import.meta.dirname, '../../scripts/remote-readiness-check.mjs'),
    'utf8',
  )
  assert.match(source, /if \(allowRemote && targetValidated\)/)
  assert.match(source, /networkConsulted: allowRemote && targetValidated/)
  assert.match(source, /overallOk = allowRemote \? uploadIaReady : localUploadPrerequisites/)
  assert.match(source, /process\.exit\(overallOk \? 0 : 1\)/)
})

test('predeploy E2E owns an isolated server instead of reusing an unrelated preview', () => {
  const predeploy = readFileSync(
    resolve(import.meta.dirname, '../../scripts/predeploy-check.mjs'),
    'utf8',
  )
  const playwrightConfig = readFileSync(
    resolve(import.meta.dirname, '../../playwright.config.ts'),
    'utf8',
  )
  const packageJson = JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8'),
  )

  assert.match(predeploy, /PREDEPLOY_E2E_PORT \|\| '3310'/)
  assert.match(predeploy, /PLAYWRIGHT_HOST: '127\.0\.0\.1'/)
  assert.match(predeploy, /PLAYWRIGHT_REUSE_EXISTING_SERVER: '0'/)
  assert.match(playwrightConfig, /PLAYWRIGHT_REUSE_EXISTING_SERVER === '0'/)
  assert.match(playwrightConfig, /reuseExistingServer,/)
  assert.equal(
    packageJson.scripts['test:e2e'],
    'cross-env PORT=3310 PLAYWRIGHT_HOST=127.0.0.1 PLAYWRIGHT_REUSE_EXISTING_SERVER=0 playwright test --project=chromium --workers=1',
  )
  assert.match(packageJson.scripts['test:e2e:cross-browser'], /PORT=3312/)
  assert.match(packageJson.scripts['test:e2e:cross-browser'], /PLAYWRIGHT_REUSE_EXISTING_SERVER=0/)
  assert.match(packageJson.scripts['test:e2e:cross-browser'], /firefox-smoke/)
  assert.match(packageJson.scripts['test:e2e:cross-browser'], /webkit-smoke/)
})

test('asset maintenance scripts fail closed and avoid destructive legacy behavior', () => {
  const scriptsRoot = resolve(import.meta.dirname, '../../scripts')
  const sources = [
    'generate-assets-from-symbol.mjs',
    'generate-favicon.mjs',
    'vectorize.mjs',
    'vectorize-all.mjs',
    'update-logo-component.mjs',
  ].map((file) => readFileSync(resolve(scriptsRoot, file), 'utf8'))
  const generateIcons = readFileSync(resolve(scriptsRoot, 'generate-icons.js'), 'utf8')

  for (const source of sources) {
    assert.doesNotMatch(source, /\.catch\(console\.error\)/)
    assert.doesNotMatch(source, /C:\/Users\/|C:\\\\Users\\/)
  }
  assert.doesNotMatch(sources[0], /unlink\(|rm\(/)
  assert.doesNotMatch(generateIcons, /copyFileSync[\s\S]*favicon\.ico/)
  assert.match(generateIcons, /Kept existing favicon\.ico unchanged/)
})

test('parse-laudo keeps bounded attempts, ownership-scoped claim and sanitized failures', () => {
  const source = readFileSync(
    resolve(import.meta.dirname, '../../../supabase/functions/parse-laudo/index.ts'),
    'utf8',
  )
  const contracts = readFileSync(
    resolve(import.meta.dirname, '../../../supabase/functions/parse-laudo/contracts.ts'),
    'utf8',
  )

  assert.match(source, /const MAX_ATTEMPTS = 3/)
  assert.equal(source.match(/redirect:\s*"error"/g)?.length, 2)
  assert.match(source, /\.select\("role, ai_quota_used, ai_quota_limit"\)/)
  assert.match(source, /!\["vet", "admin"\]\.includes\(profile\.role\)/)
  assert.match(source, /return authorizationUnavailable\(corsHeaders\)/)
  assert.match(source, /return forbidden\(corsHeaders\)/)
  assert.match(source, /\.eq\("vet_id", user\.id\)/)
  assert.match(source, /laudoError \|\| !laudo \|\| laudo\.vet_id !== user\.id/)
  assert.doesNotMatch(source, /Acesso negado a este laudo/)
  assert.match(source, /\.in\("status", \["pendente", "erro"\]\)/)
  assert.match(source, /erro_ia: `PROCESSING_FAILED:\$\{code\}`/)
  assert.doesNotMatch(source, /errBody|attempt\s*<=\s*MAX_RETRIES/)
  assert.match(contracts, /Object\.keys\(value\)\.length !== 1/)
  assert.match(contracts, /schema\.additionalProperties === false/)
  assert.match(contracts, /readBoundedText\(response\.body, maxBytes\)/)

  const containmentIndex = source.indexOf(
    'containClinicalInference(parsedOutput, HEMOGRAMA_SCHEMA.schema)',
  )
  const persistenceIndex = source.indexOf('status: "concluido"')
  assert.ok(containmentIndex >= 0)
  assert.ok(persistenceIndex > containmentIndex)
  assert.match(source, /Nao diagnostique DRC/)
  assert.match(source, /nao sugira estadiamento IRIS/)
  assert.doesNotMatch(source, /Sugira estadiamento IRIS apenas se creatinina/)

  const authorizationIndex = source.indexOf('!["vet", "admin"].includes(profile.role)')
  const claimIndex = source.indexOf('.from("laudos_pdf")')
  assert.ok(authorizationIndex >= 0)
  assert.ok(claimIndex > authorizationIndex)
})

test('git publication hook rejects command-scoped agent spoofing', () => {
  const hook = resolve(
    import.meta.dirname,
    '../../../.claude/hooks/enforce-git-push-authority.cjs',
  )
  const agentKeys = [
    'AIOX_ACTIVE_AGENT',
    'AIOX_AGENT',
    'ACTIVE_AGENT',
    'CLAUDE_AGENT_NAME',
    'CLAUDE_CODE_AGENT',
    'AIOX_CURRENT_AGENT',
  ]
  const baseEnv = { ...process.env }
  for (const key of agentKeys) delete baseEnv[key]

  const invoke = (command: string, activeAgent?: string) => {
    const env = { ...baseEnv }
    if (activeAgent) env.AIOX_ACTIVE_AGENT = activeAgent
    return spawnSync(process.execPath, [hook], {
      encoding: 'utf8',
      env,
      input: JSON.stringify({ tool_input: { command } }),
    })
  }

  const spoofed = invoke('AIOX_ACTIVE_AGENT=devops git push origin main')
  assert.equal(spoofed.status, 0)
  assert.match(spoofed.stdout, /"permissionDecision":"deny"/)

  const unknown = invoke('git push origin main')
  assert.equal(unknown.status, 0)
  assert.match(unknown.stdout, /"permissionDecision":"deny"/)

  const trusted = invoke('git push origin main', 'devops')
  assert.equal(trusted.status, 0)
  assert.equal(trusted.stdout, '')
})

test('architecture SQL drafts are mechanically quarantined', () => {
  const repoRoot = resolve(import.meta.dirname, '../../..')
  const quarantinedDrafts = [
    'docs/architecture/drafts/tenancy/01-expand.sql',
    'docs/architecture/drafts/tenancy/02-enforce.sql',
    'docs/architecture/drafts/laudos-ia/claim-finalize-refund.quarantined.sql',
  ]

  for (const relativePath of quarantinedDrafts) {
    const source = readFileSync(resolve(repoRoot, relativePath), 'utf8')
    const sentinelIndex = source.indexOf('QUARANTINED')
    const firstMutationIndex = source.search(/^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE)\b/im)
    assert.ok(sentinelIndex >= 0, `${relativePath} must declare quarantine`)
    assert.match(source.slice(0, firstMutationIndex), /RAISE EXCEPTION/)
  }

  const negativeTests = readFileSync(
    resolve(repoRoot, 'docs/architecture/drafts/tenancy/90-negative-tests.sql'),
    'utf8',
  )
  assert.match(negativeTests, /test\.allow_tenancy_destructive_fixture/)
  assert.match(negativeTests.trimEnd(), /ROLLBACK;$/)
})

test('agent wrappers resolve the canonical command authority matrix', () => {
  const repoRoot = resolve(import.meta.dirname, '../../..')
  const matrixPath = resolve(repoRoot, 'docs/architecture/command-authority-matrix.md')
  assert.equal(existsSync(matrixPath), true)

  const wrappers = [
    '.antigravity/agents/pm.md',
    '.antigravity/agents/po.md',
    '.antigravity/agents/sm.md',
    '.claude/skills/AIOX/agents/pm/SKILL.md',
    '.claude/skills/AIOX/agents/po/SKILL.md',
    '.claude/skills/AIOX/agents/sm/SKILL.md',
    '.codex/agents/pm.md',
    '.codex/agents/po.md',
    '.codex/agents/sm.md',
    '.kimi/skills/aiox-pm/SKILL.md',
    '.kimi/skills/aiox-po/SKILL.md',
    '.kimi/skills/aiox-sm/SKILL.md',
  ]

  for (const relativePath of wrappers) {
    const source = readFileSync(resolve(repoRoot, relativePath), 'utf8')
    assert.match(source, /docs\/architecture\/command-authority-matrix\.md/)
  }

  const matrix = readFileSync(matrixPath, 'utf8')
  assert.match(matrix, /Apenas @devops pode executar `git push`|`git push` \| `@devops`/)
  assert.match(matrix, /não autoriza ações\s+remotas/i)
})

test('local Supabase Auth rejects passwords shorter than the UI contract', () => {
  const repoRoot = resolve(import.meta.dirname, '../../..')
  const config = readFileSync(resolve(repoRoot, 'supabase/config.toml'), 'utf8')

  assert.match(config, /^minimum_password_length\s*=\s*8$/m)
})
