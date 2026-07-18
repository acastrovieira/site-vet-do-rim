import { expect, test } from '@playwright/test'

test.describe('public accessibility navigation', () => {
  test('keyboard users can reveal a skip link to the main content', async ({ page }) => {
    await page.goto('/ferramentas')
    await page.keyboard.press('Tab')

    const skipLink = page.getByRole('link', { name: /Pular para o conteúdo principal/i })
    await expect(skipLink).toBeFocused()
    await expect(skipLink).toBeVisible()
    await expect(skipLink).toHaveAttribute('href', '#main-content')
    await expect(page.locator('main#main-content')).toHaveCount(1)
  })

  test('reduced-motion preference disables decorative animation loops', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    await expect(page.getByRole('link', { name: 'Fale conosco pelo WhatsApp' })).toBeVisible()

    const metrics = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.className = 'animate-float'
      document.body.appendChild(probe)
      const styles = getComputedStyle(probe)
      const result = {
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        duration: styles.animationDuration,
        iterations: styles.animationIterationCount,
      }
      probe.remove()
      return result
    })

    expect(metrics.reducedMotion).toBe(true)
    expect(Number.parseFloat(metrics.duration)).toBeLessThanOrEqual(0.001)
    expect(metrics.iterations).toBe('1')
  })

  test('home section labels resolve to real headings', async ({ page }) => {
    await page.goto('/')

    const unresolvedLabels = await page.locator('[aria-labelledby]').evaluateAll((elements) =>
      elements.flatMap((element) =>
        (element.getAttribute('aria-labelledby') ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .filter((id) => document.getElementById(id) === null)
          .map((id) => ({ tag: element.tagName, id })),
      ),
    )

    expect(unresolvedLabels).toEqual([])
  })

  test('mobile navigation moves focus, closes with Escape and returns focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const toggle = page.getByRole('button', { name: 'Abrir menu' })
    await toggle.click()

    const mobileNavigation = page.getByRole('navigation', { name: 'Navegação mobile' })
    await expect(mobileNavigation).toBeVisible()
    await expect(mobileNavigation.getByRole('link', { name: 'Blog Científico' })).toBeFocused()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toHaveCount(0)
    await expect(toggle).toBeFocused()
  })
})
