import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vetdorim_analytics_consent', 'declined')
  })
})

async function expectStableViewport(page: import('@playwright/test').Page) {
  const state = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyText: document.body.innerText,
  }))

  expect(state.scrollWidth).toBeLessThanOrEqual(state.clientWidth + 1)
  expect(state.bodyText).not.toMatch(/Runtime Error|Build Error|Unhandled Runtime Error|Application error/i)
}

test.describe('public cross-browser smoke', () => {
  test('core routes render without horizontal overflow', async ({ page }) => {
    test.setTimeout(60_000)
    const routes = [
      { path: '/', heading: /Nefrologia|Urologia/i },
      { path: '/auth/login', heading: /Entrar/i },
      { path: '/ferramentas', heading: /Ferramentas/i },
      { path: '/ferramentas/controle-de-peso', heading: /Controle de Peso/i },
    ]

    for (const route of routes) {
      await page.goto(route.path)
      await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible()
      await expectStableViewport(page)
    }
  })

  test('primary public navigation reaches a live tool', async ({ page }) => {
    await page.goto('/ferramentas')

    const irisLink = page.getByRole('link', { name: /Estadiamento IRIS/i }).first()
    await expect(irisLink).toBeVisible()
    await irisLink.click()

    await expect(page).toHaveURL(/\/ferramentas\/estadiamento-iris/)
    await expect(page.getByRole('heading', { name: /Estadiamento IRIS/i })).toBeVisible()
    await expectStableViewport(page)
  })

  test('free lab prevents silent loss when two tabs save the same revision', async ({ context, page: pageA }) => {
    test.setTimeout(60_000)
    await context.addInitScript(() => {
      localStorage.setItem('vetdorim_analytics_consent', 'declined')
    })
    await pageA.goto('/ferramentas/planilha-laboratorial')
    await pageA.evaluate(() => {
      localStorage.removeItem('vetdorim_free_patients')
      localStorage.removeItem('vetdorim_free_exams')
      localStorage.removeItem('vetdorim_free_state_v2')
    })
    await pageA.reload()

    const pageB = await context.newPage()
    const lockPage = await context.newPage()
    await Promise.all([
      pageB.goto('/ferramentas/planilha-laboratorial'),
      lockPage.goto('/ferramentas/planilha-laboratorial'),
    ])

    async function preparePatient(
      target: import('@playwright/test').Page,
      petName: string,
      tutorName: string,
    ) {
      await target.getByRole('button', { name: /Cadastrar Primeiro Paciente|Novo Paciente/i }).first().click()
      await target.getByLabel('Nome do Pet *', { exact: true }).fill(petName)
      await target.getByLabel('Nome do Tutor *', { exact: true }).fill(tutorName)
    }

    await preparePatient(pageA, 'Paciente Aba A', 'Tutor A')
    await preparePatient(pageB, 'Paciente Aba B', 'Tutor B')

    await lockPage.evaluate(() => {
      const scope = window as typeof window & { releaseAuditLock?: () => void }
      let release!: () => void
      const gate = new Promise<void>((resolve) => { release = resolve })
      scope.releaseAuditLock = release
      void navigator.locks.request('vetdorim:free-lab:state', { mode: 'exclusive' }, async () => {
        localStorage.setItem('vetdorim_free_e2e_lock', 'held')
        await gate
        localStorage.removeItem('vetdorim_free_e2e_lock')
      })
    })
    await expect.poll(() => pageA.evaluate(() => localStorage.getItem('vetdorim_free_e2e_lock')))
      .toBe('held')

    await Promise.all([
      pageA.getByRole('dialog', { name: 'Novo Paciente' }).locator('form').evaluate((form) => {
        (form as HTMLFormElement).requestSubmit()
      }),
      pageB.getByRole('dialog', { name: 'Novo Paciente' }).locator('form').evaluate((form) => {
        (form as HTMLFormElement).requestSubmit()
      }),
    ])
    await lockPage.evaluate(() => {
      const scope = window as typeof window & { releaseAuditLock?: () => void }
      scope.releaseAuditLock?.()
    })

    await expect.poll(() => pageA.evaluate(() => {
      const raw = localStorage.getItem('vetdorim_free_state_v2')
      if (!raw) return null
      const state = JSON.parse(raw) as { revision?: number; patients?: unknown[] }
      return { revision: state.revision, patients: state.patients?.length }
    })).toEqual({ revision: 1, patients: 1 })

    const dialogA = pageA.getByRole('dialog', { name: 'Novo Paciente' })
    const loser = await dialogA.isVisible() ? pageA : pageB
    const loserDialog = loser.getByRole('dialog', { name: 'Novo Paciente' })
    await expect(loserDialog.getByRole('alert')).toContainText('alterados em outra aba')
    await loserDialog.getByRole('button', { name: 'Salvar Paciente' }).click()

    await expect.poll(() => loser.evaluate(() => {
      const raw = localStorage.getItem('vetdorim_free_state_v2')
      if (!raw) return null
      const state = JSON.parse(raw) as { revision?: number; patients?: unknown[] }
      return { revision: state.revision, patients: state.patients?.length }
    })).toEqual({ revision: 2, patients: 2 })
    await expect(loserDialog).toBeHidden()
    await expectStableViewport(pageA)
    await expectStableViewport(pageB)
    await lockPage.close()
    await pageB.close()
  })
})
