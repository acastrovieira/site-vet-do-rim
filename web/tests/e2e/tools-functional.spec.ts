import { expect, test } from '@playwright/test'

const publicToolRoutes = [
  '/ferramentas',
  '/ferramentas/estadiamento-iris',
  '/ferramentas/planilha-laboratorial',
  '/ferramentas/controle-de-peso',
  '/ferramentas/dieta-renal',
  '/ferramentas/calculadora-tfg',
]

const professionalToolRoutes = [
  '/ferramentas/injuria-renal-aguda',
  '/ferramentas/fluidoterapia',
  '/ferramentas/reposicao-eletrolitica',
]

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  )
  expect(hasOverflow).toBe(false)
}

test.describe('public clinical tools', () => {
  test('tools index communicates public and professional access levels', async ({ page }) => {
    await page.goto('/ferramentas')

    await expect(page.getByRole('heading', { name: /Ferramentas de Nefrologia/i })).toBeVisible()
    await expect(page.getByText('Login vet', { exact: true })).toHaveCount(3)
    await expect(page.getByText('Entrar para acessar', { exact: true })).toHaveCount(3)
    await expect(page.getByText('Sem cadastro', { exact: true })).toHaveCount(3)
    await expect(page.getByText(/8 ferramentas gratuitas|sem cadastro, sem custo|Ferramentas Clínicas Gratuitas/i)).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
  })

  test('home tools section avoids promising every tool is anonymous', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /Ferramentas públicas e profissionais/i })).toBeVisible()
    await expect(page.getByText(/ferramentas com conduta ou dosagem exigem conta veterinária gratuita/i)).toBeVisible()
    await expect(page.getByText(/8 ferramentas gratuitas|sem cadastro, sem custo/i)).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
  })

  for (const route of [...publicToolRoutes, ...professionalToolRoutes]) {
    test(`${route} renders without layout overflow`, async ({ page }) => {
      await page.goto(route)

      await expect(page.locator('h1').first()).toBeVisible()
      await expectNoHorizontalOverflow(page)
    })
  }

  test('TFG calculator returns an IRIS result and signup gate for advanced stages', async ({ page }) => {
    await page.goto('/ferramentas/calculadora-tfg')

    await page.locator('#species').selectOption('gato')
    await page.locator('#weight').fill('4.8')
    await page.locator('#creatinina').fill('2.4')
    await page.locator('#sdma').fill('25')
    await page.locator('#upc').fill('0.7')
    await page.locator('#pressao').fill('165')
    await page.getByRole('button', { name: /Calcular TFG/i }).click()

    await expect(page.getByText(/Estágio/i).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: /Ver estadiamento completo/i })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('IRIS staging model updates result from clinical inputs', async ({ page }) => {
    await page.goto('/ferramentas/estadiamento-iris')

    const inputs = page.locator('input[type="number"]')
    await inputs.nth(0).fill('2.4')
    await inputs.nth(1).fill('28')
    await inputs.nth(2).fill('0.7')
    await inputs.nth(3).fill('165')

    await expect(page.getByText(/Estágio [234]/).first()).toBeVisible()
    await expect(page.getByText(/Proteinúria/i).first()).toBeVisible()
    await expect(page.getByText(/PA:/i).first()).toBeVisible()
  })

  test('renal diet calculator compares supported brands', async ({ page }) => {
    await page.goto('/ferramentas/dieta-renal')

    await page.locator('#especie').selectOption('cao')
    await page.locator('#pesoKg').fill('12.5')
    await page.getByRole('button', { name: /Selecione o ECC/i }).click()
    await page.getByText('ECC 5 — Ideal').click()
    await page.getByRole('button', { name: /Calcular quantidade diária/i }).click()

    await expect(page.getByText(/Comparativo entre 4 marcas/i)).toBeVisible()
    await expect(page.getByText(/Royal Canin/i).first()).toBeVisible()
    await expect(page.getByText(/g\/dia/i).first()).toBeVisible()
  })

  test('weight control registers a local weight entry', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('vetdorim:peso-historico'))
    await page.goto('/ferramentas/controle-de-peso')

    await page.getByRole('button', { name: /Registrar primeiro peso/i }).click()
    await page.locator('#nomePaciente').fill('Thor E2E')
    await page.locator('#especie').selectOption('cao')
    await page.locator('#pesoKg').fill('11.2')
    await page.getByRole('button', { name: /Selecione o ECC/i }).click()
    await page.getByText('ECC 5 — Ideal').click()
    await page.getByRole('button', { name: /Salvar Registro/i }).click()

    await expect(page.getByText('Thor E2E')).toBeVisible()
    await expect(page.getByText(/11\.20/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Exportar CSV/i })).toBeVisible()
  })

  test('free lab spreadsheet creates a patient dashboard', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('vetdorim_free_patients')
      localStorage.removeItem('vetdorim_free_exams')
    })
    await page.goto('/ferramentas/planilha-laboratorial')

    await page.getByRole('button', { name: /Cadastrar Primeiro Paciente|Novo Paciente/i }).first().click()
    await page.getByPlaceholder('Ex: Rex').fill('Rex E2E')
    await page.getByPlaceholder('Ex: Maria').fill('Maria E2E')
    await page.getByRole('button', { name: /Salvar Paciente/i }).click()

    await expect(page.getByText('Rex E2E')).toBeVisible()
    await expect(page.getByText(/Seus dados ficam salvos neste navegador/i)).toBeVisible()
  })

  test('local storage tools hydrate cleanly when data already exists', async ({ page }) => {
    const issues: string[] = []
    page.on('console', (message) => {
      if (['error', 'warning', 'warn'].includes(message.type())) {
        issues.push(`${message.type()}: ${message.text()}`)
      }
    })
    page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`))

    await page.addInitScript(() => {
      localStorage.setItem('vetdorim:peso-historico', JSON.stringify([
        {
          id: 'audit-weight',
          nomePaciente: 'Thor Audit',
          especie: 'cao',
          pesoKg: 10.5,
          ecc: 5,
          data: '2026-06-25',
          observacoes: '',
          criadoEm: 1782345600000,
        },
      ]))
      localStorage.setItem('vetdorim_free_patients', JSON.stringify([
        {
          id: 'audit-lab',
          petName: 'Rex Audit',
          species: 'Canino',
          breed: '',
          sex: 'Macho',
          birthDate: '',
          tutorName: 'Maria Audit',
          createdAt: '2026-06-25T00:00:00.000Z',
        },
      ]))
      localStorage.setItem('vetdorim_free_exams', JSON.stringify([]))
    })

    await page.goto('/ferramentas/controle-de-peso')
    await expect(page.getByText('Thor Audit')).toBeVisible()

    await page.goto('/ferramentas/planilha-laboratorial')
    await expect(page.getByText('Rex Audit')).toBeVisible()

    expect(issues).toEqual([])
  })
})

test.describe('professional clinical tools gates', () => {
  for (const route of professionalToolRoutes) {
    test(`${route} shows professional access gate to anonymous users`, async ({ page }) => {
      await page.goto(route)

      await expect(page.getByRole('heading', { name: /Acesso restrito a profissionais/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /Criar conta veterinária gratuita/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /Já tenho conta/i })).toBeVisible()
      await expectNoHorizontalOverflow(page)
    })
  }
})
