import { expect, test } from '@playwright/test'
import {
  expectLabArea,
  expectProtectedArea,
  expectTutorPortal,
  getE2ECredentials,
  loginWithSupabaseCredentials,
} from './auth-utils'

const legacyCredentials = getE2ECredentials()
const adminCredentials = getE2ECredentials('admin')
const vetCredentials = getE2ECredentials('vet')
const tutorCredentials = getE2ECredentials('tutor')

test.describe('authenticated flows', () => {
  test.skip(
    !legacyCredentials,
    'Set E2E_SUPABASE_EMAIL and E2E_SUPABASE_PASSWORD to run authenticated E2E tests.'
  )

  test('logs in with Supabase credentials and reaches a protected area', async ({ page }) => {
    await loginWithSupabaseCredentials(page, legacyCredentials!)
    await expectProtectedArea(page)
  })
})

test.describe('role-based Auth/RLS flows', () => {
  test.skip(
    !adminCredentials && !vetCredentials && !tutorCredentials,
    'Set E2E_ADMIN_*, E2E_VET_* or E2E_TUTOR_* credentials to run role-based E2E tests.'
  )

  test('vet reaches /lab and is redirected away from /portal', async ({ page }) => {
    test.skip(!vetCredentials, 'Set E2E_VET_EMAIL and E2E_VET_PASSWORD.')

    await loginWithSupabaseCredentials(page, vetCredentials!, '/lab')
    await expectLabArea(page)

    await page.goto('/portal')
    await expectLabArea(page)
  })

  test('admin reaches /lab and is redirected away from /portal', async ({ page }) => {
    test.skip(!adminCredentials, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.')

    await loginWithSupabaseCredentials(page, adminCredentials!, '/lab')
    await expectLabArea(page)

    await page.goto('/portal')
    await expectLabArea(page)
  })

  test('tutor is redirected from /lab to /portal', async ({ page }) => {
    test.skip(!tutorCredentials, 'Set E2E_TUTOR_EMAIL and E2E_TUTOR_PASSWORD.')

    await loginWithSupabaseCredentials(page, tutorCredentials!, '/lab')
    await expectTutorPortal(page)

    await page.goto('/lab')
    await expectTutorPortal(page)
  })
})

test.describe('protected routes', () => {
  test('redirect anonymous users from /lab to login with redirect target', async ({ page }) => {
    await page.goto('/lab')

    await expect(page).toHaveURL(/\/auth\/login\?redirectTo=%2Flab$/)
    await expect(page.getByRole('heading', { name: /entrar/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/^Senha$/i)).toBeVisible()
  })
})
