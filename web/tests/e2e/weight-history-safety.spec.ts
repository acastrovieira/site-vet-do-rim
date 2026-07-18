import { expect, test } from '@playwright/test'

const STORAGE_KEY = 'vetdorim:peso-historico'

test.describe('weight history safety', () => {
  test('does not mix different patients in charts or trend comparisons', async ({ page }) => {
    await page.addInitScript(
      ({ key, registros }) => localStorage.setItem(key, JSON.stringify(registros)),
      {
        key: STORAGE_KEY,
        registros: [
          {
            id: 'mia-1',
            nomePaciente: 'Mia',
            especie: 'gato',
            pesoKg: 4.2,
            ecc: 5,
            data: '2026-07-15',
            criadoEm: 3,
          },
          {
            id: 'thor-2',
            nomePaciente: 'Thor',
            especie: 'cao',
            pesoKg: 10.5,
            ecc: 5,
            data: '2026-07-14',
            criadoEm: 2,
          },
          {
            id: 'thor-1',
            nomePaciente: 'Thor',
            especie: 'cao',
            pesoKg: 10,
            ecc: 5,
            data: '2026-07-01',
            criadoEm: 1,
          },
        ],
      },
    )

    await page.goto('/ferramentas/controle-de-peso')

    await expect(page.getByText(/Thor · Cão · últimos 2 registros/)).toBeVisible()
    const miaRow = page.locator('div.divide-y > div').filter({ hasText: 'Mia' })
    await expect(miaRow).toHaveCount(1)
    await expect(miaRow).not.toContainText('%')
  })

  test('requires a patient name and rejects future dates', async ({ page }) => {
    await page.goto('/ferramentas/controle-de-peso')
    await page.getByRole('button', { name: 'Registrar Peso' }).click()

    const dateInput = page.getByLabel('Data *')
    await expect(page.getByLabel('Nome do paciente *')).toHaveAttribute('required', '')
    await dateInput.fill('2999-01-01')
    await page.getByRole('button', { name: 'Salvar Registro' }).click()

    await expect(page.getByText('Informe o nome do paciente')).toBeVisible()
    await expect(page.getByText('A data não pode estar no futuro')).toBeVisible()
  })

  test('warns instead of silently replacing a corrupted local history', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, '{invalid-json'), STORAGE_KEY)
    await page.goto('/ferramentas/controle-de-peso')

    const warning = page.getByRole('alert').filter({
      hasText: 'O histórico local precisa de atenção',
    })
    await expect(warning).toContainText('O histórico local precisa de atenção')
    await expect(warning).toContainText('não pôde ser lido')
  })
})
