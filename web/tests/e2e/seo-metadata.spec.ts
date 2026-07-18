import { expect, test } from '@playwright/test'

test.describe('SEO metadata routes', () => {
  test('page title appends the site brand exactly once', async ({ page }) => {
    await page.goto('/ferramentas')

    await expect(page).toHaveTitle(
      'Ferramentas Clínicas — Nefrologia Veterinária | Vet do Rim',
    )
    expect((await page.title()).match(/Vet do Rim/g)).toHaveLength(1)
  })

  test('sitemap exposes public content without private application routes', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    const xml = await response.text()

    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain('application/xml')
    expect(xml).toMatch(/<loc>https?:\/\/[^<]+<\/loc>/)
    expect(xml).toContain('/ferramentas/estadiamento-iris</loc>')
    expect(xml).toContain('/blog/estadiamento-iris-doenca-renal-cronica</loc>')
    expect(xml).not.toContain('/lab</loc>')
    expect(xml).not.toContain('/api/</loc>')
    expect(xml).not.toContain('/auth/</loc>')
    expect(xml).not.toContain('/ferramentas/fluidoterapia</loc>')
    expect(xml).not.toContain('/ferramentas/reposicao-eletrolitica</loc>')
    expect(xml).not.toContain('/ferramentas/dieta-renal</loc>')
  })

  test('robots allows public pages and disallows private surfaces', async ({ request }) => {
    const response = await request.get('/robots.txt')
    const body = await response.text()

    expect(response.ok()).toBe(true)
    expect(body).toContain('Allow: /')
    expect(body).toContain('Disallow: /api/')
    expect(body).toContain('Disallow: /auth/')
    expect(body).toContain('Disallow: /lab/')
    expect(body).toContain('Disallow: /portal')
    expect(body).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/)
  })

  for (const route of [
    '/ferramentas/fluidoterapia',
    '/ferramentas/reposicao-eletrolitica',
    '/ferramentas/dieta-renal',
  ]) {
    test(`${route} is excluded from indexing while under clinical review`, async ({ page }) => {
      await page.goto(route)

      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        /noindex/i,
      )
      await expect(
        page.getByRole('heading', { name: 'Ferramenta temporariamente indisponível' }),
      ).toBeVisible()
    })
  }
})
