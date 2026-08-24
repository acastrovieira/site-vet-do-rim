import { expect, test } from '@playwright/test'
import { expectLabArea, getE2ECredentials, loginWithSupabaseCredentials } from './auth-utils'

const vetCredentials = getE2ECredentials('vet')
const petId = process.env.E2E_UPLOAD_PET_ID

function digitalLabPdf() {
  return Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 332 >>
stream
BT
/F1 12 Tf
72 720 Td
(Laboratorio: E2E Local) Tj
0 -18 Td
(Data coleta: 23/08/2026) Tj
0 -18 Td
(Creatinina 2,1 mg/dL Ref. 0,5 - 1,8) Tj
0 -18 Td
(Ureia 85 mg/dL Ref. 21 - 60) Tj
0 -18 Td
(Fosforo 5,2 mg/dL Ref. 2,5 - 6,0) Tj
0 -18 Td
(Hematocrito 31 % Ref. 37 - 55) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000241 00000 n
0000000623 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
693
%%EOF`)
}

test.describe('Extração local autenticada sem API paga', () => {
  test.skip(!vetCredentials || !petId, 'Set E2E_VET_EMAIL, E2E_VET_PASSWORD and E2E_UPLOAD_PET_ID.')

  test('extrai, preserva a revisão durante o upload, salva, exibe tabela e exporta', async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    const providerRequests: string[] = []
    page.on('request', (request) => {
      if (/openai|gemini|generativelanguage/i.test(request.url())) providerRequests.push(request.url())
    })

    await loginWithSupabaseCredentials(page, vetCredentials!, '/lab')
    await expectLabArea(page)
    await page.goto(`/lab/pacientes/${petId}/laudos`)

    const safeProject = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    const fileName = `laudo-local-${safeProject}.pdf`
    await page.locator('#laudo-file-input').setInputFiles({
      name: fileName,
      mimeType: 'application/pdf',
      buffer: digitalLabPdf(),
    })

    await page.getByRole('button', { name: /Extrair parâmetros gratuitamente/i }).click()
    await expect(page.getByText(/leituras? encontradas?/i)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('paragraph').filter({ hasText: /^Creatinina$/ })).toBeVisible()

    const selectedBeforeUpload = await page.locator('input[type="checkbox"]:checked').count()
    expect(selectedBeforeUpload).toBeGreaterThan(0)

    await page.getByRole('button', { name: /Enviar PDF ao histórico/i }).click()
    await expect(page.getByText(/PDF salvo com sucesso/i)).toBeVisible({ timeout: 30_000 })

    // Regressão: o componente era desmontado durante o upload e o rascunho sumia.
    await expect(page.getByText(/leituras? encontradas?/i)).toBeVisible()
    await expect(page.locator('input[type="checkbox"]:checked').first()).toBeVisible()

    await page.getByText(/Conferi os parâmetros selecionados/i).click()
    await page.getByRole('button', { name: /Salvar valores conferidos e gerar tabela/i }).click()
    await expect(page.getByText(/Resultados conferidos/i)).toBeVisible({ timeout: 30_000 })
    expect(providerRequests).toEqual([])

    await page.getByRole('link', { name: /Ver tabela evolutiva do paciente/i }).click()
    await expect(page).toHaveURL(new RegExp(`/lab/pacientes/${petId}#evolucao-laboratorial$`))
    const creatinineRow = page.getByRole('row').filter({ hasText: 'Creatinina' }).first()
    await expect(creatinineRow).toBeVisible()
    await expect(creatinineRow).toContainText(/2[,.]1/)

    for (const format of ['csv', 'xlsx'] as const) {
      const response = await page.evaluate(async ({ currentPetId, currentFormat }) => {
        const result = await fetch(`/api/lab/export?petId=${currentPetId}&format=${currentFormat}`)
        return {
          ok: result.ok,
          status: result.status,
          contentType: result.headers.get('content-type'),
          disposition: result.headers.get('content-disposition'),
          size: (await result.arrayBuffer()).byteLength,
        }
      }, { currentPetId: petId, currentFormat: format })

      expect(response.ok, `${format} export returned ${response.status}`).toBe(true)
      expect(response.disposition).toContain('attachment')
      expect(response.size).toBeGreaterThan(50)
      expect(response.contentType).toContain(format === 'csv' ? 'text/csv' : 'spreadsheetml')
    }

    const layout = await page.evaluate(() => ({
      // Chromium desktop emulando um telefone mantém a barra vertical fora de
      // clientWidth (14 px), embora a área horizontal real seja window.innerWidth.
      overflow: Math.max(
        0,
        document.documentElement.scrollWidth - window.innerWidth,
        document.body.scrollWidth - document.documentElement.clientWidth
      ),
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      scrollX: window.scrollX,
      offenders: [...document.querySelectorAll<HTMLElement>('body *')]
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return {
            tag: element.tagName.toLowerCase(),
            className: String(element.className).slice(0, 180),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          }
        })
        .filter((element) => element.right > window.innerWidth + 1 || element.left < -1)
        .sort((left, right) => right.width - left.width)
        .slice(0, 8),
    }))
    expect(layout.overflow, JSON.stringify(layout)).toBeLessThanOrEqual(1)
  })
})
