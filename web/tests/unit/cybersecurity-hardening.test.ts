import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  isRoleAuthorized,
  normalizePathname,
  requiresAuthentication,
  safeInternalRedirectPath,
} from '../../src/lib/route-authorization.ts'
import {
  ApiCsrfError,
  assertSameOriginMutation,
} from '../../src/lib/api-validation.ts'
import {
  checkIpRateLimit,
  resetIpRateLimitForTests,
} from '../../src/lib/ip-rate-limit.ts'
import { hasValidBearerSecret } from '../../src/lib/operational-health.ts'
import { assertJsonMatchesSchema } from '../../../supabase/functions/parse-laudo/contracts.ts'
import { SECURITY_CSP, SECURITY_HEADERS } from '../../src/lib/security-headers.ts'

const webRoot = resolve(import.meta.dirname, '../..')
const repoRoot = resolve(webRoot, '..')

test('20261118120000 hardening migration enforces CRIT-01/HIGH-01..04 and 8-scope rate limiting', () => {
  const migration = readFileSync(
    resolve(repoRoot, 'supabase/migrations/20261118120000_security_audit_total_hardening.sql'),
    'utf8',
  )

  assert.match(migration, /ALTER TABLE public\.profiles FORCE ROW LEVEL SECURITY/)
  assert.match(migration, /DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public\.profiles/)
  assert.match(migration, /CREATE POLICY "profiles_select_own"/)
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.laudos_pdf FROM authenticated/)
  assert.match(migration, /DROP POLICY IF EXISTS laudos_pdf_insert_active_clinical_member ON public\.laudos_pdf/)
  assert.match(migration, /uq_laudos_pdf_storage_path/)
  assert.match(migration, /chk_laudos_pdf_canonical_storage_path/)
  assert.match(migration, /p_object_name ~ '\^clinics\/\[0-9a-fA-F-\]\{36\}\/laudos\/\[0-9a-fA-F-\]\{36\}\/original\\\.pdf\$'/)
  assert.match(migration, /AND private\.has_clinic_role\(l\.clinic_id, p_allowed_roles\)/)
  assert.match(migration, /ALTER TABLE public\.tutores ALTER COLUMN clinic_id SET NOT NULL/)
  assert.match(migration, /ALTER TABLE public\.laudos_pdf ALTER COLUMN clinic_id SET NOT NULL/)
  assert.match(migration, /prevent_direct_pet_death_transition/)
  assert.match(migration, /ALTER TABLE private\.clinical_rate_limit_windows FORCE ROW LEVEL SECURITY/)

  for (const scope of [
    'laudo_reserve',
    'laudo_abandon',
    'laudo_local_extraction',
    'laudo_ai_parse',
    'lab_export',
    'pets_mutation',
    'tutores_mutation',
    'profile_mutation',
  ]) {
    assert.match(migration, new RegExp(`WHEN '${scope}'`))
  }
})

test('route-authorization fails closed on encoded bypasses, traversal and malformed paths', () => {
  assert.equal(normalizePathname('/%6cab'), '/lab')
  assert.equal(normalizePathname('/%256cab'), '/lab')
  assert.equal(requiresAuthentication('/%6cab'), true)
  assert.equal(requiresAuthentication('/%256cab/pacientes'), true)
  assert.equal(requiresAuthentication('/lab%2f..%2fadmin'), true)
  assert.equal(requiresAuthentication('/%00lab'), true)
  assert.equal(requiresAuthentication('/%zz'), true)

  assert.equal(isRoleAuthorized('/%6cab', 'tutor'), false)
  assert.equal(isRoleAuthorized('/%6cab', 'vet'), true)
  assert.equal(isRoleAuthorized('/lab%2f..%2fadmin', 'admin'), false)
  assert.equal(isRoleAuthorized('/%zz', 'admin'), false)

  assert.equal(safeInternalRedirectPath('/%6cab'), '/lab')
  assert.equal(safeInternalRedirectPath('/lab/..%2fadmin'), '')
  assert.equal(safeInternalRedirectPath('/%252f%252fevil.example'), '')
})

test('assertSameOriginMutation blocks cross-site CSRF origins and accepts same-origin mutations', () => {
  assert.doesNotThrow(() =>
    assertSameOriginMutation(
      new Request('https://www.vetdorim.com.br/api/pets', {
        method: 'POST',
        headers: {
          host: 'www.vetdorim.com.br',
          origin: 'https://www.vetdorim.com.br',
          'sec-fetch-site': 'same-origin',
        },
      }),
    ),
  )

  assert.throws(
    () =>
      assertSameOriginMutation(
        new Request('https://www.vetdorim.com.br/api/pets', {
          method: 'POST',
          headers: {
            host: 'www.vetdorim.com.br',
            origin: 'https://evil.example',
            'sec-fetch-site': 'cross-site',
          },
        }),
      ),
    ApiCsrfError,
  )

  assert.throws(
    () =>
      assertSameOriginMutation(
        new Request('https://www.vetdorim.com.br/api/pets', {
          method: 'POST',
          headers: {
            host: 'www.vetdorim.com.br',
            origin: 'null',
          },
        }),
      ),
    ApiCsrfError,
  )

  assert.throws(
    () =>
      assertSameOriginMutation(
        new Request('https://www.vetdorim.com.br/api/pets', {
          method: 'POST',
          headers: {
            host: 'www.vetdorim.com.br',
            referer: 'https://evil.example/form',
          },
        }),
      ),
    ApiCsrfError,
  )
})

test('IP rate limiter bounds requests and enforces Retry-After', () => {
  resetIpRateLimitForTests()
  const req = () =>
    new Request('https://www.vetdorim.com.br/api/health', {
      headers: { 'x-forwarded-for': '203.0.113.42' },
    })

  assert.deepEqual(checkIpRateLimit(req(), 'test_scope', 2, 60_000), { allowed: true })
  assert.deepEqual(checkIpRateLimit(req(), 'test_scope', 2, 60_000), { allowed: true })
  const blocked = checkIpRateLimit(req(), 'test_scope', 2, 60_000)
  assert.equal(blocked.allowed, false)
  if (!blocked.allowed) {
    assert.ok(blocked.retryAfterSeconds >= 1)
  }
  resetIpRateLimitForTests()
})

test('hasValidBearerSecret compares fixed-size SHA-256 digests safely', () => {
  const secret = 's'.repeat(32)
  assert.equal(hasValidBearerSecret(`Bearer ${secret}`, secret), true)
  assert.equal(hasValidBearerSecret(`Bearer ${secret}extra`, secret), false)
  assert.equal(hasValidBearerSecret(`Bearer short`, secret), false)
  assert.equal(hasValidBearerSecret(null, secret), false)
  assert.equal(hasValidBearerSecret(`Bearer ${'x'.repeat(20)}`, 'x'.repeat(20)), false)
})

test('next.config.ts and vercel.json keep hardened CSP, wasm-unsafe-eval and security headers synchronized', () => {
  const vercel = JSON.parse(readFileSync(resolve(webRoot, 'vercel.json'), 'utf8')) as {
    headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
  }
  const rootRule = vercel.headers.find((rule) => rule.source === '/(.*)')
  assert.ok(rootRule)
  const authRule = vercel.headers.find((rule) => rule.source === '/auth/(.*)')
  assert.ok(authRule)
  const authHeaderMap = new Map(authRule.headers.map((h) => [h.key, h.value]))
  assert.equal(authHeaderMap.get('Referrer-Policy'), 'no-referrer')

  const headerMap = new Map(rootRule.headers.map((h) => [h.key, h.value]))
  assert.equal(headerMap.get('Content-Security-Policy'), SECURITY_CSP)
  assert.match(SECURITY_CSP, /'wasm-unsafe-eval'/)
  assert.doesNotMatch(SECURITY_CSP, /script-src[^;]*posthog\.com/)
  assert.equal(headerMap.get('X-XSS-Protection'), '0')
  assert.equal(headerMap.get('Cross-Origin-Opener-Policy'), 'same-origin')
  assert.equal(headerMap.get('Cross-Origin-Resource-Policy'), 'same-origin')

  const nextConfig = readFileSync(resolve(webRoot, 'next.config.ts'), 'utf8')
  assert.match(nextConfig, /SECURITY_HEADERS/)
  assert.match(nextConfig, /async headers\(\)/)
  assert.match(nextConfig, /\/auth\/\(\.\*\)/)
  assert.match(nextConfig, /no-referrer/)

  const nextHeaderMap = new Map(SECURITY_HEADERS.map((h) => [h.key, h.value]))
  assert.equal(nextHeaderMap.get('X-XSS-Protection'), '0')
  assert.equal(nextHeaderMap.get('Cross-Origin-Opener-Policy'), 'same-origin')
  assert.equal(nextHeaderMap.get('Cross-Origin-Resource-Policy'), 'same-origin')
})

test('parse-laudo contracts reject negative numbers, numeric overflow, control chars and oversized registration strings', () => {
  const schema = {
    type: 'object',
    properties: {
      valor: { type: ['number', 'null'] },
      laboratorio: { type: ['string', 'null'] },
      paciente: {
        type: 'object',
        properties: { nome: { type: 'string' } },
        required: ['nome'],
        additionalProperties: false,
      },
    },
    required: ['valor', 'laboratorio', 'paciente'],
    additionalProperties: false,
  }

  assert.doesNotThrow(() =>
    assertJsonMatchesSchema(
      { valor: 2.1, laboratorio: 'Lab Vet', paciente: { nome: 'Rex' } },
      schema,
    ),
  )

  assert.throws(() =>
    assertJsonMatchesSchema(
      { valor: -1, laboratorio: 'Lab Vet', paciente: { nome: 'Rex' } },
      schema,
    ),
  )

  assert.throws(() =>
    assertJsonMatchesSchema(
      { valor: 100_000_000, laboratorio: 'Lab Vet', paciente: { nome: 'Rex' } },
      schema,
    ),
  )

  assert.throws(() =>
    assertJsonMatchesSchema(
      { valor: 1, laboratorio: 'Lab\u0007Vet', paciente: { nome: 'Rex' } },
      schema,
    ),
  )

  assert.throws(() =>
    assertJsonMatchesSchema(
      { valor: 1, laboratorio: 'Lab Vet', paciente: { nome: 'a'.repeat(300) } },
      schema,
    ),
  )
})
