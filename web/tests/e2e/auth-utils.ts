import { expect, type Page } from '@playwright/test'

export type E2ECredentials = {
  email: string
  password: string
}

export type E2ERole = 'admin' | 'vet' | 'tutor'

export function getE2ECredentials(role?: E2ERole): E2ECredentials | null {
  const prefix = role ? `E2E_${role.toUpperCase()}` : 'E2E_SUPABASE'
  const email = process.env[`${prefix}_EMAIL`]
  const password = process.env[`${prefix}_PASSWORD`]

  if (!email || !password) {
    if (role === 'vet') {
      const fallbackEmail = process.env.E2E_SUPABASE_EMAIL
      const fallbackPassword = process.env.E2E_SUPABASE_PASSWORD
      if (fallbackEmail && fallbackPassword) return { email: fallbackEmail, password: fallbackPassword }
    }
    return null
  }

  return { email, password }
}

export async function loginWithSupabaseCredentials(
  page: Page,
  credentials: E2ECredentials,
  redirectTo = '/lab'
) {
  await page.addInitScript(() => {
    window.localStorage.setItem('vetdorim_cookies_accepted', 'true')
  })
  await page.goto(`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`)

  await page.getByLabel(/email/i).fill(credentials.email)
  await page.getByLabel(/^Senha$/i).fill(credentials.password)
  await page.getByRole('button', { name: /^Entrar$/i }).click()
}

export async function expectProtectedArea(page: Page) {
  await expect(page).toHaveURL(/\/(?:lab|portal)(?:[/?#]|$)/)

  if (page.url().includes('/portal')) {
    await expect(page.getByRole('heading', { name: /portal|acesso|lab evolution/i }).first()).toBeVisible()
    return
  }

  await expect(page.getByRole('heading', { name: /bom dia|boa tarde|boa noite|dashboard/i }).first()).toBeVisible()
  await expect(page.getByRole('navigation', { name: /menu principal/i })).toBeVisible()
}

export async function expectLabArea(page: Page) {
  await expect(page).toHaveURL(/\/lab(?:[/?#]|$)/)
  await expect(page.getByRole('navigation', { name: /menu principal/i })).toBeVisible()
}

export async function expectTutorPortal(page: Page) {
  await expect(page).toHaveURL(/\/portal(?:[/?#]|$)/)
  await expect(page.getByRole('heading', { name: /portal do tutor|ola/i })).toBeVisible()
}
