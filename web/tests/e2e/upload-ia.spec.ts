import { expect, test } from '@playwright/test'
import { expectLabArea, getE2ECredentials, loginWithSupabaseCredentials } from './auth-utils'

const vetCredentials = getE2ECredentials('vet')
const petId = process.env.E2E_UPLOAD_PET_ID
const runId = process.env.E2E_RUN_ID ?? Date.now().toString()

function sampleLaudoPdf() {
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
<< /Length 391 >>
stream
BT
/F1 12 Tf
72 720 Td
(Laudo veterinario E2E Vet do Rim) Tj
0 -18 Td
(Paciente: Paciente E2E Upload IA ${runId}) Tj
0 -18 Td
(Especie: canino) Tj
0 -18 Td
(Tutor: Tutor E2E Upload IA ${runId}) Tj
0 -18 Td
(Creatinina: 2.1 mg/dL) Tj
0 -18 Td
(Ureia: 85 mg/dL) Tj
0 -18 Td
(Fosforo: 5.2 mg/dL) Tj
0 -18 Td
(Hematocrito: 31 %) Tj
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
0000000683 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
753
%%EOF`)
}

test.describe('Upload/IA de laudos', () => {
  test.skip(!vetCredentials || !petId, 'Set E2E_VET_EMAIL, E2E_VET_PASSWORD and E2E_UPLOAD_PET_ID.')

  test('vet uploads PDF, invokes parse-laudo and receives structured result', async ({ page }) => {
    test.setTimeout(180_000)

    await loginWithSupabaseCredentials(page, vetCredentials!, '/lab')
    await expectLabArea(page)

    await page.goto(`/lab/pacientes/${petId}/laudos`)
    await expect(page.getByLabel(/Área de upload de laudo PDF|Ãrea de upload de laudo PDF/i)).toBeVisible()

    const fileInput = page.locator('#laudo-file-input')
    await fileInput.setInputFiles({
      name: `laudo-upload-ia-${runId}.pdf`,
      mimeType: 'application/pdf',
      buffer: sampleLaudoPdf(),
    })

    await expect(page.getByText(`laudo-upload-ia-${runId}.pdf`)).toBeVisible()
    await page.getByRole('button', { name: /Analisar com IA/i }).click()

    await expect(page.getByText(/IA analisando|Enviando PDF|Análise concluída|AnÃ¡lise concluÃ­da/i)).toBeVisible()
    await expect(page.getByText(/Análise concluída|AnÃ¡lise concluÃ­da/i)).toBeVisible({ timeout: 150_000 })
    await expect(page.getByText(/Creatinina|Ureia|Achados relevantes|Bioqu/i).first()).toBeVisible()
  })
})
