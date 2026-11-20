import { expect, test } from '@playwright/test'
import { expectLabArea, getE2ECredentials, loginWithSupabaseCredentials } from './auth-utils'

const vetCredentials = getE2ECredentials('vet')

test.describe('Lab Evolution real CRUD', () => {
  test.skip(!vetCredentials, 'Set E2E_VET_EMAIL and E2E_VET_PASSWORD.')

  test('vet creates, lists and edits tutor, patient and reaches laudos workflow', async ({ page }) => {
    test.setTimeout(90_000)

    const runId = process.env.E2E_RUN_ID ?? Date.now().toString()
    const tutorName = `Tutor E2E CRUD ${runId}`
    const tutorEditedName = `${tutorName} Editado`
    const petName = `Paciente E2E CRUD ${runId}`
    const petEditedName = `${petName} Editado`

    await loginWithSupabaseCredentials(page, vetCredentials!, '/lab')
    await expectLabArea(page)

    await page.goto('/lab/tutores/novo')
    await page.getByLabel(/Nome completo/i).fill(tutorName)
    await page.getByLabel(/Telefone \/ WhatsApp/i).fill('(27) 99999-0001')
    await page.getByLabel(/^E-mail$/i).fill(`tutor-${runId}@example.test`)
    await page.getByLabel(/^Cidade$/i).fill('Vitoria')
    await page.getByLabel(/Estado/i).selectOption('ES')
    await Promise.all([
      page.waitForURL(/\/lab\/tutores\/[0-9a-f-]+$/i, { timeout: 30_000 }),
      page.getByRole('button', { name: /Salvar tutor/i }).click(),
    ])
    await expect(page.getByRole('heading', { name: tutorName })).toBeVisible()
    const tutorId = page.url().split('/').pop()
    expect(tutorId).toBeTruthy()

    await page.goto('/lab/tutores')
    await expect(page.getByRole('table', { name: /Lista de tutores/i })).toBeVisible()
    await expect(page.getByText(tutorName)).toBeVisible()

    const tutorPatch = await page.evaluate(async ({ tutorId, tutorEditedName }) => {
      const res = await fetch(`/api/tutores/${tutorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: tutorEditedName,
          telefone: '(27) 99999-0002',
          cidade: 'Serra',
          estado: 'ES',
        }),
      })
      return { ok: res.ok, body: await res.text() }
    }, { tutorId, tutorEditedName })
    expect(tutorPatch.ok, tutorPatch.body).toBe(true)

    await page.goto(`/lab/tutores/${tutorId}`)
    await expect(page.getByRole('heading', { name: tutorEditedName })).toBeVisible()
    await expect(page.getByText('(27) 99999-0002')).toBeVisible()
    await expect(page.getByText(/Serra,\s*ES/i)).toBeVisible()

    await page.getByRole('link', { name: /Novo pet/i }).click()
    await expect(page).toHaveURL(new RegExp(`/lab/pacientes/novo\\?tutor_id=${tutorId}`))
    await page.getByLabel(/Nome do animal/i).fill(petName)
    await page.getByLabel(/Espécie/i).selectOption('canino')
    await page.getByLabel(/Raça/i).fill('SRD')
    await page.getByLabel(/Idade \(anos\)/i).fill('7')
    await page.getByLabel(/Peso \(kg\)/i).fill('12.4')
    await Promise.all([
      page.waitForURL(/\/lab\/pacientes\/[0-9a-f-]+\/laudos$/i, { timeout: 30_000 }),
      page.getByRole('button', { name: /Salvar paciente/i }).click(),
    ])
    await expect(page.getByRole('heading', { name: new RegExp(`Laudos.*${petName}`, 'i') })).toBeVisible()
    const petId = page.url().split('/').at(-2)
    expect(petId).toBeTruthy()

    await page.goto('/lab/pacientes')
    await expect(page.getByRole('table', { name: /Lista de pacientes/i })).toBeVisible()
    await expect(page.getByText(petName)).toBeVisible()
    await expect(page.getByText(tutorEditedName)).toBeVisible()

    const petPatch = await page.evaluate(async ({ petId, petEditedName }) => {
      const res = await fetch(`/api/pets/${petId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: petEditedName,
          raca: 'SRD renal',
          peso_atual: 13.1,
          status_paciente: 'em_tratamento',
        }),
      })
      return { ok: res.ok, body: await res.text() }
    }, { petId, petEditedName })
    expect(petPatch.ok, petPatch.body).toBe(true)

    await page.goto(`/lab/pacientes/${petId}`)
    await expect(page.getByRole('heading', { name: petEditedName })).toBeVisible()
    await expect(page.getByText('SRD renal', { exact: true })).toBeVisible()
    await expect(page.getByText('13.1 kg', { exact: true })).toBeVisible()
    await expect(page.getByText('Em tratamento', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Analisar laudo/i })).toBeVisible()

    await page.goto(`/lab/pacientes/${petId}/laudos`)
    await expect(page.getByLabel(/Área de upload de laudo PDF/i)).toBeVisible()
    const fileInput = page.locator('#laudo-file-input')
    await expect(fileInput).toHaveAttribute('accept', 'application/pdf')

    await fileInput.setInputFiles({
      name: `laudo-${runId}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'),
    })
    await expect(page.getByText(`laudo-${runId}.pdf`)).toBeVisible()
    await expect(page.getByRole('button', { name: /Enviar PDF ao histórico/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Trocar/i })).toBeVisible()

    // Guardrails Iteracao C: status_paciente = 'obito' bloqueado via PATCH generico e validado em /obito
    const blockedDeathPatch = await page.evaluate(async ({ currentPetId }) => {
      const res = await fetch(`/api/pets/${currentPetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_paciente: 'obito' }),
      })
      return { status: res.status, body: await res.json() }
    }, { currentPetId: petId! })
    expect(blockedDeathPatch.status).toBe(422)
    expect(blockedDeathPatch.body.code).toBe('DEATH_WORKFLOW_UNAVAILABLE')

    const invalidDeathPost = await page.evaluate(async ({ currentPetId }) => {
      const res = await fetch(`/api/pets/${currentPetId}/obito`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data_obito: '2099-01-01', motivo: 'x' }),
      })
      return { status: res.status, body: await res.json() }
    }, { currentPetId: petId! })
    expect(invalidDeathPost.status).toBe(400)
    expect(invalidDeathPost.body.code).toBe('VALIDATION')

    // Isolamento multi-clinica Iteracao D: alternar clinica ativa na UI isola pacientes e mutacoes
    const clinicAName = process.env.E2E_CLINIC_A_NAME
    const clinicBName = process.env.E2E_CLINIC_B_NAME
    if (clinicAName && clinicBName) {
      const switcher = page.getByLabel('Clínica ativa')
      await expect(switcher).toBeVisible()
      await Promise.all([
        page.waitForResponse((res) =>
          res.url().includes('/api/lab/active-clinic')
          && res.request().method() === 'POST'
          && res.status() === 200,
        ),
        switcher.selectOption({ label: clinicBName }),
      ])

      await page.goto('/lab/pacientes')
      await expect(page.getByText(petEditedName)).toHaveCount(0)

      const crossClinicPatch = await page.evaluate(async ({ currentPetId }) => {
        const res = await fetch(`/api/pets/${currentPetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: 'Cross Tenant Probe' }),
        })
        return { status: res.status, body: await res.json() }
      }, { currentPetId: petId! })
      expect(crossClinicPatch.status).toBe(404)
      expect(crossClinicPatch.body.code).toBe('NOT_FOUND')

      await Promise.all([
        page.waitForResponse((res) =>
          res.url().includes('/api/lab/active-clinic')
          && res.request().method() === 'POST'
          && res.status() === 200,
        ),
        page.getByLabel('Clínica ativa').selectOption({ label: clinicAName }),
      ])

      await page.goto('/lab/pacientes')
      await expect(page.getByText(petEditedName)).toBeVisible()
    }
  })
})

test.describe('Lab Evolution authenticated mobile shell', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  })

  test.skip(!vetCredentials, 'Set E2E_VET_EMAIL and E2E_VET_PASSWORD.')

  test('vet opens mobile Lab navigation without horizontal overflow', async ({ page }) => {
    await loginWithSupabaseCredentials(page, vetCredentials!, '/lab')
    await expectLabArea(page)

    const menuButton = page.getByRole('button', { name: 'Abrir menu', exact: true })
    await expect(menuButton).toBeVisible()
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false')

    await menuButton.click()

    await expect(page.getByRole('button', { name: 'Fechar menu', exact: true })).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('navigation', { name: 'Menu principal', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Tutores', exact: true })).toBeVisible()

    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
  })
})
