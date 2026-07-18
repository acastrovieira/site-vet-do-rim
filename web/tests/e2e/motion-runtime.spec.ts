import { expect, test } from '@playwright/test'

test.describe('runtime motion policy', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('vetdorim_analytics_consent', 'declined')
    })
  })

  test('product demo stays frozen offscreen and advances only while visible', async ({ page }) => {
    await page.goto('/')

    const demo = page.locator('[data-demo-scene]')
    await expect(demo).toHaveAttribute('data-demo-scene', 'dashboard')
    await page.waitForTimeout(4_300)
    await expect(demo).toHaveAttribute('data-demo-scene', 'dashboard')

    await demo.scrollIntoViewIfNeeded()
    await expect(demo).toBeInViewport()
    await expect(demo).not.toHaveAttribute('data-demo-scene', 'dashboard', { timeout: 5_500 })

    await page.getByRole('button', { name: 'Pausar demo' }).click()
    const pausedScene = await demo.getAttribute('data-demo-scene')
    await page.waitForTimeout(4_300)
    await expect(demo).toHaveAttribute('data-demo-scene', pausedScene ?? '')
  })

  test('product demo preserves progress while its tab is hidden', async ({ page }) => {
    await page.addInitScript(() => {
      let visibility: DocumentVisibilityState = 'visible'
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => visibility,
      })
      Object.defineProperty(window, '__setMotionVisibilityForTest', {
        configurable: true,
        value: (next: DocumentVisibilityState) => {
          visibility = next
          document.dispatchEvent(new Event('visibilitychange'))
        },
      })
    })
    await page.goto('/')

    const demo = page.locator('[data-demo-scene]')
    await demo.scrollIntoViewIfNeeded()
    await expect(demo).toBeInViewport()
    await page.getByRole('button', { name: 'Reiniciar demo' }).click()
    await expect(demo).toHaveAttribute('data-demo-scene', 'dashboard')

    const hiddenAt = await demo.getAttribute('data-demo-scene')
    await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __setMotionVisibilityForTest: (next: DocumentVisibilityState) => void
      }
      testWindow.__setMotionVisibilityForTest('hidden')
    })
    await page.waitForTimeout(4_300)
    await expect(demo).toHaveAttribute('data-demo-scene', hiddenAt ?? '')

    await page.evaluate(() => {
      const testWindow = window as typeof window & {
        __setMotionVisibilityForTest: (next: DocumentVisibilityState) => void
      }
      testWindow.__setMotionVisibilityForTest('visible')
    })

    await expect(demo).toHaveAttribute('data-demo-scene', hiddenAt ?? '', { timeout: 500 })
    await expect(demo).not.toHaveAttribute('data-demo-scene', hiddenAt ?? '', { timeout: 5_500 })
  })

  test('reduced motion exposes stable final content without starting JavaScript loops', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    const principles = page.locator('[data-practice-principles]')
    await principles.scrollIntoViewIfNeeded()
    await expect(principles).toContainText('Cães e gatos')
    await expect(principles).toContainText('Decisão clínica humana')

    const demo = page.locator('[data-demo-scene]')
    await demo.scrollIntoViewIfNeeded()
    await expect(demo).toHaveAttribute('data-demo-scene', 'dashboard')
    await page.waitForTimeout(4_300)
    await expect(demo).toHaveAttribute('data-demo-scene', 'dashboard')
  })

  test('public evidence policy replaces unverified testimonials on mobile without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const policy = page.locator('[data-public-evidence-policy]')
    await policy.scrollIntoViewIfNeeded()
    await expect(policy).toBeInViewport()
    await expect(policy).toContainText('Depoimentos com autorização')
    await expect(policy).toContainText('Indicadores com metodologia')
    await expect(page.locator('main')).not.toContainText('500+')
    await expect(page.locator('main')).not.toContainText('98%')

    const overflow = await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
