import { expect, test } from '@playwright/test'

const anonymousClinicalMutations = [
  { method: 'POST', path: '/api/tutores' },
  { method: 'PATCH', path: '/api/tutores/00000000-0000-4000-8000-000000000001' },
  { method: 'POST', path: '/api/pets' },
  { method: 'PATCH', path: '/api/pets/00000000-0000-4000-8000-000000000001' },
] as const

test('clinical mutation APIs fail closed without an authenticated session', async ({ request }) => {
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
})
