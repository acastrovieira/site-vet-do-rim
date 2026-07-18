import { expect, test } from '@playwright/test'

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vetdorim_analytics_consent', 'declined')
  })
})

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
}

test.describe('mobile public layout', () => {
  test('key public routes render without horizontal overflow', async ({ page }) => {
    const routes = [
      { path: '/', heading: /Nefrologia|Urologia/i },
      { path: '/auth/login', heading: /Entrar/i },
      { path: '/auth/cadastro', heading: /Criar conta/i },
      { path: '/ferramentas', heading: /Ferramentas/i },
      { path: '/ferramentas/controle-de-peso', heading: /Controle de Peso/i },
      { path: '/ferramentas/planilha-laboratorial', heading: /Planilha Laboratorial/i },
    ]

    for (const route of routes) {
      await page.goto(route.path)
      await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible()
      await expectNoHorizontalOverflow(page)
    }
  })

  test('mobile navigation exposes primary links', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Mudar para modo (claro|escuro)/ })).toBeVisible()

    const menuButton = page.getByRole('button', { name: /menu/i })
    await expect(menuButton).toBeVisible()
    await menuButton.click()

    await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ferramentas', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Entrar no Lab', exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('tablet keeps the accessible menu before the desktop breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')

    const menuButton = page.getByRole('button', { name: 'Abrir menu', exact: true })
    await expect(menuButton).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeHidden()

    await menuButton.click()
    const mobileNavigation = page.getByRole('navigation', { name: 'Navegação mobile' })
    await expect(mobileNavigation).toBeVisible()
    await expect(mobileNavigation.getByRole('link', { name: 'Blog Científico', exact: true })).toBeVisible()
    await expect(mobileNavigation.getByRole('link', { name: 'Lab Evolution', exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('header controls have accessible names on mobile', async ({ page }) => {
    await page.goto('/')

    const unnamedVisibleButtons = await page.locator('button').evaluateAll((buttons) =>
      buttons
        .filter((button) => {
          const style = window.getComputedStyle(button)
          const rect = button.getBoundingClientRect()
          const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
          const hasName = Boolean(button.textContent?.trim() || button.getAttribute('aria-label')?.trim())
          return isVisible && !hasName && button.getAttribute('aria-hidden') !== 'true'
        })
        .map((button) => button.outerHTML.slice(0, 160)),
    )

    expect(unnamedVisibleButtons).toEqual([])
  })

  test('long auth forms remain usable on mobile', async ({ page }) => {
    await page.goto('/auth/cadastro')

    await expect(page.getByLabel(/Nome completo/i)).toBeVisible()
    await expect(page.getByLabel(/^Email$/i)).toBeVisible()
    await expect(page.getByLabel(/Perfil de acesso/i)).toBeVisible()
    await expect(page.getByLabel(/^Senha$/i)).toBeVisible()

    const showPassword = page.getByLabel(/Mostrar campo de senha/i)
    await expect(showPassword).toBeVisible()
    await showPassword.click()
    await expect(page.locator('#password')).toHaveAttribute('type', 'text')
    await expect(page.getByLabel(/Ocultar campo de senha/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Criar conta/i })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('professional tool copy is clear before login on mobile', async ({ page }) => {
    await page.goto('/ferramentas')

    await expect(page.getByText('Login vet').first()).toBeVisible()
    await expect(page.getByText('Entrar para acessar').first()).toBeVisible()
    await expect(page.getByText('Sem cadastro').first()).toBeVisible()
    await expect(page.getByText('Freemium').first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('anonymous Lab access redirects to login with safe return path', async ({ page }) => {
    await page.goto('/lab')

    await expect(page).toHaveURL(/\/auth\/login\?redirectTo=%2Flab|\/auth\/login\?redirectTo=\/lab/)
    await expect(page.getByRole('heading', { name: /Entrar/i })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('operational endpoints separate liveness from local readiness without secrets', async ({ page }) => {
    const livenessResponse = await page.request.get('/api/health')
    const livenessBody = await livenessResponse.json()

    expect(livenessResponse.status()).toBe(200)
    expect(livenessResponse.headers()['cache-control']).toContain('no-store')
    expect(livenessBody).toMatchObject({
      ok: true,
      status: 'alive',
      service: 'vetdorim-web',
      checks: { runtime: true },
    })

    const readinessResponse = await page.request.get('/api/health/readiness')
    const readinessBody = await readinessResponse.json()
    expect([200, 503]).toContain(readinessResponse.status())
    expect(readinessResponse.headers()['cache-control']).toContain('no-store')
    expect(readinessBody).toMatchObject({
      status: readinessResponse.ok() ? 'ready' : 'not_ready',
      service: 'vetdorim-web',
      checks: { runtime: true },
    })

    const serialized = JSON.stringify([livenessBody, readinessBody])
    expect(serialized).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(serialized).not.toContain('OPENAI_API_KEY')
  })
})
