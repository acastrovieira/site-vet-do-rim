import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { assertSameOriginMutation, ApiCsrfError } from '../../src/lib/api-validation.ts'
import { checkIpRateLimit, resetIpRateLimitForTests } from '../../src/lib/ip-rate-limit.ts'
import { authorizeClinicAccess } from '../../src/lib/server-authorization.ts'
import {
  CLINICAL_RATE_LIMIT_SCOPES,
  consumeClinicalRateLimit,
} from '../../src/lib/server-rate-limit.ts'
import {
  getSecurityTelemetrySnapshot,
  recordSecurityEvent,
  resetSecurityTelemetryForTests,
  sanitizeTelemetryRoutePath,
  sanitizeTelemetryScope,
  SECURITY_TELEMETRY_WINDOW_MS,
  setSecurityEventSinkForTests,
  type SecurityEventRecord,
} from '../../src/lib/security-telemetry.ts'

const webRoot = resolve(import.meta.dirname, '../..')

test('telemetry sanitizers redact UUIDs, emails, query strings and bearer tokens', () => {
  assert.equal(
    sanitizeTelemetryRoutePath(
      'https://www.vetdorim.com.br/api/pets/123e4567-e89b-42d3-a456-426614174000?token=secret#frag',
    ),
    '/api/pets/:id',
  )
  assert.equal(sanitizeTelemetryRoutePath('/api/tutores/987654/edit?cpf=123'), '/api/tutores/:id/edit')
  assert.equal(sanitizeTelemetryRoutePath('not-a-valid-url'), 'unknown')
  assert.equal(sanitizeTelemetryRoutePath('/api/../admin'), 'unknown')

  assert.equal(sanitizeTelemetryScope('health_liveness'), 'health_liveness')
  assert.equal(sanitizeTelemetryScope('/api/pets/:id'), '/api/pets/:id')
  assert.equal(sanitizeTelemetryScope('tutor@example.com'), 'redacted')
  assert.equal(sanitizeTelemetryScope('123e4567-e89b-42d3-a456-426614174000'), 'redacted')
  assert.equal(sanitizeTelemetryScope('eyJhbGciOiJIUzI1NiJ9.abc.def'), 'redacted')
  assert.equal(sanitizeTelemetryScope('Bearer abc123'), 'redacted')
  assert.equal(sanitizeTelemetryScope('foo?bar=1'), 'redacted')
  assert.equal(sanitizeTelemetryScope(''), 'unknown')
})

test('security telemetry tracks sliding window alerts and transitions healthy -> elevated -> degraded', () => {
  const captured: Array<{ severity: string; line: string; record: SecurityEventRecord }> = []
  resetSecurityTelemetryForTests()
  setSecurityEventSinkForTests((severity, line, record) => {
    captured.push({ severity, line, record })
  })

  try {
    assert.equal(getSecurityTelemetrySnapshot().status, 'healthy')

    for (let i = 0; i < 5; i += 1) {
      recordSecurityEvent({
        event: 'csrf_rejected',
        status: 403,
        layer: 'api',
        scope: '/api/pets',
        code: 'CSRF_REJECTED',
      })
    }

    const elevated = getSecurityTelemetrySnapshot()
    assert.equal(elevated.status, 'elevated')
    assert.equal(elevated.windowEvents, 5)
    assert.equal(elevated.byEvent.csrf_rejected.window, 5)
    assert.ok(elevated.activeAlerts.some((a) => a.event === 'csrf_rejected' && a.severity === 'high'))
    assert.match(captured[0].line, /^\[security\] event=csrf_rejected \{/)

    recordSecurityEvent({
      event: 'extraction_storage_mismatch',
      status: 409,
      layer: 'api',
      scope: '/api/laudos/:id/abandon',
      code: 'PATH_MISMATCH',
    })

    const degraded = getSecurityTelemetrySnapshot()
    assert.equal(degraded.status, 'degraded')
    assert.ok(
      degraded.activeAlerts.some(
        (a) => a.event === 'extraction_storage_mismatch' && a.severity === 'critical',
      ),
    )

    const expired = getSecurityTelemetrySnapshot(Date.now() + SECURITY_TELEMETRY_WINDOW_MS + 1)
    assert.equal(expired.status, 'healthy')
    assert.equal(expired.windowEvents, 0)
    assert.equal(expired.totalEvents, 6)
    assert.equal(expired.activeAlerts.length, 0)
  } finally {
    setSecurityEventSinkForTests(null)
    resetSecurityTelemetryForTests()
  }
})

test('instrumented security boundaries emit telemetry events without PII', async () => {
  const records: SecurityEventRecord[] = []
  resetSecurityTelemetryForTests()
  resetIpRateLimitForTests()
  setSecurityEventSinkForTests((_severity, _line, record) => {
    records.push(record)
  })

  try {
    const req = () =>
      new Request('https://www.vetdorim.com.br/api/health', {
        headers: { 'x-forwarded-for': '203.0.113.99' },
      })
    assert.deepEqual(checkIpRateLimit(req(), 'telemetry_ip_test', 1, 60_000), { allowed: true })
    assert.equal(checkIpRateLimit(req(), 'telemetry_ip_test', 1, 60_000).allowed, false)

    assert.throws(
      () =>
        assertSameOriginMutation(
          new Request(
            'https://www.vetdorim.com.br/api/pets/123e4567-e89b-42d3-a456-426614174000?secret=1',
            {
              method: 'POST',
              headers: {
                host: 'www.vetdorim.com.br',
                origin: 'https://evil.example',
              },
            },
          ),
        ),
      ApiCsrfError,
    )

    const unavailableRpcClient = {
      rpc: async () => ({ data: null, error: { code: 'PGRST202' } }),
    }
    assert.deepEqual(
      await consumeClinicalRateLimit(unavailableRpcClient as never, CLINICAL_RATE_LIMIT_SCOPES.export),
      { state: 'unavailable' },
    )

    const limitedRpcClient = {
      rpc: async () => ({ data: [{ allowed: false, retry_after_seconds: 9 }], error: null }),
    }
    assert.deepEqual(
      await consumeClinicalRateLimit(limitedRpcClient as never, CLINICAL_RATE_LIMIT_SCOPES.reserve),
      { state: 'limited', retryAfterSeconds: 9 },
    )

    const errorAuthClient = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: (table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { role: 'vet' }, error: null }),
              }),
            }),
          }
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: null, error: new Error('db down') }),
                  }),
                }),
              }),
            }),
          }),
        }
      },
    }
    const authResult = await authorizeClinicAccess(errorAuthClient as never, ['vet'])
    assert.equal(authResult.ok, false)

    assert.deepEqual(
      records.map((r) => ({ event: r.event, scope: r.scope, status: r.status })),
      [
        { event: 'rate_limit_exceeded', scope: 'telemetry_ip_test', status: 429 },
        { event: 'csrf_rejected', scope: '/api/pets/:id', status: 403 },
        { event: 'rate_limit_unavailable', scope: 'lab_export', status: 503 },
        { event: 'rate_limit_exceeded', scope: 'laudo_reserve', status: 429 },
        { event: 'authorization_unavailable', scope: 'clinic_memberships', status: 503 },
      ],
    )
    assert.equal(
      records.some((r) => JSON.stringify(r).includes('203.0.113.99') || JSON.stringify(r).includes('secret=1')),
      false,
    )
  } finally {
    setSecurityEventSinkForTests(null)
    resetSecurityTelemetryForTests()
    resetIpRateLimitForTests()
  }
})

test('security telemetry endpoint and parse-laudo Edge logs maintain operational contracts', () => {
  const routeSource = readFileSync(
    resolve(webRoot, 'src/app/api/health/security/route.ts'),
    'utf8',
  )
  assert.match(routeSource, /CRON_SECRET/)
  assert.match(routeSource, /hasValidBearerSecret/)
  assert.match(routeSource, /checkIpRateLimit/)
  assert.match(routeSource, /OPERATIONAL_NO_STORE_HEADERS/)
  assert.match(routeSource, /getSecurityTelemetrySnapshot/)

  const edgeSource = readFileSync(
    resolve(webRoot, '../supabase/functions/parse-laudo/index.ts'),
    'utf8',
  )
  assert.match(edgeSource, /event=authorization_unavailable/)
  assert.match(edgeSource, /event=rate_limit_exceeded/)
})
