import { expect, test } from '@playwright/test'

const anonymousClinicalMutations = [
  { method: 'POST', path: '/api/tutores' },
  { method: 'PATCH', path: '/api/tutores/00000000-0000-4000-8000-000000000001' },
  { method: 'POST', path: '/api/pets' },
  { method: 'PATCH', path: '/api/pets/00000000-0000-4000-8000-000000000001' },
  { method: 'POST', path: '/api/pets/00000000-0000-4000-8000-000000000001/obito' },
  { method: 'POST', path: '/api/laudos/reserve' },
  { method: 'POST', path: '/api/laudos/00000000-0000-4000-8000-000000000001/abandon' },
  { method: 'POST', path: '/api/laudos/00000000-0000-4000-8000-000000000001/results-local' },
  { method: 'POST', path: '/api/lab/active-clinic' },
  { method: 'DELETE', path: '/api/lab/active-clinic' },
] as const

test('clinical mutation and export APIs fail closed without an authenticated session', async ({ request }) => {
  for (const mutation of anonymousClinicalMutations) {
    const response = await request.fetch(mutation.path, {
      method: mutation.method,
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })

    expect(response.status(), `${mutation.method} ${mutation.path}`).toBe(401)
    expect(response.headers()['content-type']).toContain('application/json')
    expect(response.headers()['cache-control']).toContain('private')
    expect(response.headers()['cache-control']).toContain('no-store')

    const body = await response.json()
    expect(body).toEqual({
      ok: false,
      error: 'Nao autenticado',
      code: 'UNAUTHENTICATED',
    })
    expect(JSON.stringify(body)).not.toMatch(/supabase|postgres|sql|cookie|token|stack/i)
  }

  const exportResponse = await request.get(
    '/api/lab/export?petId=00000000-0000-4000-8000-000000000001&format=csv',
  )
  expect(exportResponse.status()).toBe(401)
  expect(exportResponse.headers()['cache-control']).toContain('private')
  expect(exportResponse.headers()['cache-control']).toContain('no-store')
})

test('public responses carry hardened security headers and proxy blocks percent-encoded protected routes', async ({ request }) => {
  const homeResponse = await request.get('/')
  expect(homeResponse.ok()).toBe(true)

  const headers = homeResponse.headers()
  expect(headers['content-security-policy']).toContain("'wasm-unsafe-eval'")
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-xss-protection']).toBe('0')
  expect(headers['cross-origin-opener-policy']).toBe('same-origin')
  expect(headers['cross-origin-resource-policy']).toBe('same-origin')

  const encodedBypassResponse = await request.get('/%6cab', { maxRedirects: 0 })
  expect([307, 308]).toContain(encodedBypassResponse.status())
  expect(encodedBypassResponse.headers()['location']).toContain('/auth/login')
})

test('security telemetry endpoint fails closed without valid bearer authorization', async ({ request }) => {
  const response = await request.get('/api/health/security')

  expect([401, 503]).toContain(response.status())
  expect(response.headers()['cache-control']).toContain('no-store')
  const rawBody = await response.text()
  expect(rawBody).not.toContain('activeAlerts')
  expect(rawBody).not.toContain('byEvent')
})
