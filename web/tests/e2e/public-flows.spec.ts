import { expect, test } from '@playwright/test'

const publicRoutes = [
  '/',
  '/blog',
  '/blog/estadiamento-iris-doenca-renal-cronica',
  '/blog/taxa-filtracao-glomerular-veterinaria',
  '/blog/manejo-nutricional-doenca-renal',
  '/ferramentas',
  '/ferramentas/calculadora-tfg',
  '/ferramentas/controle-de-peso',
  '/ferramentas/dieta-renal',
  '/ferramentas/estadiamento-iris',
  '/ferramentas/planilha-laboratorial',
  '/legal/privacidade',
  '/legal/termos',
  '/auth/login',
  '/auth/cadastro',
  '/auth/recuperar-senha',
  '/portal',
]

const publicEntryRoutes = [
  '/',
  '/blog',
  '/ferramentas',
  '/legal/privacidade',
  '/legal/termos',
  '/portal',
]

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  )
  expect(hasOverflow).toBe(false)
}

async function expectNoFrameworkOverlay(page: import('@playwright/test').Page) {
  const bodyText = await page.locator('body').innerText()
  expect(bodyText).not.toMatch(/Runtime Error|Build Error|Unhandled Runtime Error|Application error/i)
}

test.describe('public routes and CTA integrity', () => {
  for (const route of publicRoutes) {
    test(`${route} renders a stable public screen`, async ({ page }) => {
      await page.goto(route)

      await expect(page.locator('body')).toBeVisible()
      await expect(page.locator('h1').first()).toBeVisible()
      await expectNoFrameworkOverlay(page)
      await expectNoHorizontalOverflow(page)
    })
  }

  test('home primary CTAs route to live public destinations', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('link', { name: /Calcular TFG grátis/i }).first()).toHaveAttribute(
      'href',
      '/ferramentas/calculadora-tfg'
    )
    await expect(page.getByRole('link', { name: /Blog científico/i }).first()).toHaveAttribute('href', '/blog')
    await expect(page.getByRole('link', { name: /Ver todas as ferramentas/i })).toHaveAttribute('href', '/ferramentas')
    await expect(page.getByRole('link', { name: /Acessar gratuitamente/i })).toHaveAttribute('href', '/auth/login')
  })

  test('public entry pages do not expose broken internal links', async ({ page, request, baseURL }) => {
    test.setTimeout(60_000)
    const checked = new Set<string>()

    for (const route of publicEntryRoutes) {
      await page.goto(route)

      const hrefs = await page.locator('a[href]').evaluateAll((links) =>
        links
          .map((link) => link.getAttribute('href') ?? '')
          .filter((href) =>
            href.length > 0 &&
            !href.startsWith('#') &&
            !href.startsWith('mailto:') &&
            !href.startsWith('tel:') &&
            !href.startsWith('https://wa.me') &&
            !href.startsWith('https://www.instagram.com') &&
            !href.startsWith('https://www.iris-kidney.com')
          )
      )

      for (const href of hrefs) {
        const target = href.startsWith('http') ? href : new URL(href, baseURL).toString()
        const sameOrigin = baseURL ? target.startsWith(baseURL) : href.startsWith('/')
        const current = new URL(route, baseURL).toString()
        if (target === current) continue
        if (!sameOrigin || checked.has(target)) continue

        checked.add(target)
        const response = await request.get(target, { maxRedirects: 0, timeout: 15_000 })
        expect(response.status(), `${route} links to ${href}`).toBeLessThan(400)
      }
    }
  })
})
