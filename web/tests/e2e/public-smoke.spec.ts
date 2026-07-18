import { expect, test } from '@playwright/test'

test.describe('public website smoke', () => {
  test('privacy banner offers a real analytics opt-out', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('vetdorim_analytics_consent')
      localStorage.removeItem('vetdorim_cookies_accepted')
    })
    await page.goto('/')

    await expect(page.getByRole('button', { name: /Somente necessários/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Aceitar analytics/i })).toBeVisible()
    await page.getByRole('button', { name: /Somente necessários/i }).click()

    await expect(page.getByRole('button', { name: /Aceitar analytics/i })).toHaveCount(0)
    await expect(page.evaluate(() => localStorage.getItem('vetdorim_analytics_consent'))).resolves.toBe('declined')
  })

  test('home renders primary navigation and CTAs', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/Nefrologia|Veterin/i)
    await expect(page.getByRole('heading', { name: /Nefrologia|Urologia/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Entrar|Login/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Ferramentas/i }).first()).toBeVisible()
  })

  test('auth pages render usable forms without submitting credentials', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('heading', { name: /Entrar|Login/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByRole('textbox', { name: /^Senha$/i })).toBeVisible()

    await page.goto('/auth/cadastro')
    await expect(page.getByRole('heading', { name: /Criar|Cadastro|Conta/i })).toBeVisible()
    await expect(page.getByLabel(/nome/i)).toBeVisible()
    await expect(page.getByLabel(/perfil/i)).toBeVisible()
  })

  test('tools directory links to a public clinical calculator', async ({ page }) => {
    await page.goto('/ferramentas')
    await expect(page.getByRole('heading', { name: /Ferramentas/i })).toBeVisible()

    await page.getByRole('link', { name: /Estadiamento IRIS/i }).first().click()
    await expect(page).toHaveURL(/\/ferramentas\/estadiamento-iris/)
    await expect(page.getByRole('heading', { name: /Estadiamento IRIS/i })).toBeVisible()
  })
})
