import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { gradeAKI } from '../../src/lib/aki-grading.ts'
import { getLabReferenceStatus, parseLabNumber } from '../../src/lib/lab-free/reference-status.ts'
import { listarPesos, obterErroStorage, salvarPeso } from '../../src/lib/peso-controller.ts'
import {
  calcularTFG,
  getHypertensionSubstage,
  getProteinuriaSubstage,
} from '../../src/lib/tfg-calculator.ts'

function withMemoryLocalStorage<T>(
  initialStore: Record<string, string>,
  run: (backing: Map<string, string>) => T,
): T {
  const backing = new Map(Object.entries(initialStore))
  const fakeStorage = {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => {
      backing.set(key, String(value))
    },
    removeItem: (key: string) => {
      backing.delete(key)
    },
    clear: () => {
      backing.clear()
    },
    key: (index: number) => Array.from(backing.keys())[index] ?? null,
    get length() {
      return backing.size
    },
  }

  const descriptorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const descriptorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: fakeStorage },
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: fakeStorage,
  })

  try {
    return run(backing)
  } finally {
    if (descriptorWindow) {
      Object.defineProperty(globalThis, 'window', descriptorWindow)
    } else {
      delete (globalThis as { window?: unknown }).window
    }
    if (descriptorStorage) {
      Object.defineProperty(globalThis, 'localStorage', descriptorStorage)
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage
    }
  }
}

test('unapproved prescriptive clinical tools remain strictly fail-closed and non-indexed', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const containedTools = [
    {
      path: 'src/app/ferramentas/fluidoterapia/page.tsx',
      forbiddenComponent: 'FluidoterapiaCalculator',
    },
    {
      path: 'src/app/ferramentas/reposicao-eletrolitica/page.tsx',
      forbiddenComponent: 'ReposicaoEletroliticaCalculator',
    },
    {
      path: 'src/app/ferramentas/dieta-renal/page.tsx',
      forbiddenComponent: 'DietaRenalCalculator',
    },
  ] as const

  for (const tool of containedTools) {
    const source = readFileSync(resolve(webRoot, tool.path), 'utf8')
    assert.match(source, /<ClinicalReviewNotice\b/)
    assert.match(source, /robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/)
    assert.doesNotMatch(source, new RegExp(tool.forbiddenComponent))
  }
})

test('IRIS 2026 DRC triage enforces worst-marker rule, substaging boundaries, and auth gate', () => {
  const stage1Dog = calcularTFG({
    species: 'cao',
    creatininaMgDl: 1.2,
    sdmaMcgDl: 14,
    upcRatio: 0.1,
    pressaoSistolicaMmhg: 130,
  })
  assert.equal(stage1Dog.stage, 1)
  assert.equal(stage1Dog.requiresAuth, false)
  assert.equal(stage1Dog.proteinuriaSubstage, 'nao-proteinurico')
  assert.equal(stage1Dog.hypertensionSubstage, 'normotenso')

  // Regra IRIS: SDMA mais grave prevalece sobre creatinina em estagio 1
  const escalatedBySdma = calcularTFG({
    species: 'gato',
    creatininaMgDl: 1.3,
    sdmaMcgDl: 26,
    upcRatio: 0.4,
    pressaoSistolicaMmhg: 160,
  })
  assert.equal(escalatedBySdma.stage, 3)
  assert.equal(escalatedBySdma.requiresAuth, true)
  assert.equal(escalatedBySdma.proteinuriaSubstage, 'borderline')
  assert.equal(escalatedBySdma.hypertensionSubstage, 'hipertensivo')

  assert.equal(getProteinuriaSubstage(undefined, 'cao'), 'nao-avaliado')
  assert.equal(getProteinuriaSubstage(0.19, 'gato'), 'nao-proteinurico')
  assert.equal(getProteinuriaSubstage(0.41, 'gato'), 'proteinurico')
  assert.equal(getProteinuriaSubstage(0.5, 'cao'), 'borderline')
  assert.equal(getProteinuriaSubstage(0.51, 'cao'), 'proteinurico')

  assert.equal(getHypertensionSubstage(undefined), 'nao-avaliado')
  assert.equal(getHypertensionSubstage(139), 'normotenso')
  assert.equal(getHypertensionSubstage(140), 'pre-hipertensivo')
  assert.equal(getHypertensionSubstage(159), 'pre-hipertensivo')
  assert.equal(getHypertensionSubstage(179), 'hipertensivo')
  assert.equal(getHypertensionSubstage(180), 'gravemente-hipertensivo')
})

test('IRIS AKI 2026 grading enforces intentional fail-safe boundary gaps, delta window, and subgrades', () => {
  // Valores nao finitos ou <= 0 retornam null
  assert.equal(gradeAKI({ creatinineMgDl: 0, urineOutputStatus: 'normal', hasClinicalEvidence: true }), null)
  assert.equal(gradeAKI({ creatinineMgDl: -1, urineOutputStatus: 'normal', hasClinicalEvidence: true }), null)
  assert.equal(gradeAKI({ creatinineMgDl: Number.NaN, urineOutputStatus: 'normal', hasClinicalEvidence: true }), null)
  assert.equal(gradeAKI({ creatinineMgDl: Number.POSITIVE_INFINITY, urineOutputStatus: 'normal', hasClinicalEvidence: true }), null)

  // Lacunas entre faixas (1.6 <= Cr < 1.7; 2.5 < Cr < 2.6; 5.0 < Cr < 5.1) sao fail-safe intencional
  for (const gapValue of [1.6, 1.65, 2.55, 5.05]) {
    assert.equal(
      gradeAKI({
        creatinineMgDl: gapValue,
        urineOutputStatus: 'normal',
        hasClinicalEvidence: true,
      }),
      null,
      `gap value ${gapValue} should fail closed`,
    )
  }

  // Graus I-V e subgraus O/NO/null sem elevar o grau
  assert.deepEqual(
    gradeAKI({ creatinineMgDl: 1.59, urineOutputStatus: 'nao_avaliado', hasClinicalEvidence: true }),
    { grade: 1, urineSubgrade: null, deltaMgDl: undefined },
  )
  assert.deepEqual(
    gradeAKI({ creatinineMgDl: 2.5, urineOutputStatus: 'normal', hasClinicalEvidence: true }),
    { grade: 2, urineSubgrade: 'NO', deltaMgDl: undefined },
  )
  assert.deepEqual(
    gradeAKI({ creatinineMgDl: 2.6, urineOutputStatus: 'oliguria', hasClinicalEvidence: true }),
    { grade: 3, urineSubgrade: 'O', deltaMgDl: undefined },
  )
  assert.deepEqual(
    gradeAKI({ creatinineMgDl: 5.1, urineOutputStatus: 'anuria', hasClinicalEvidence: true }),
    { grade: 4, urineSubgrade: 'O', deltaMgDl: undefined },
  )
  assert.deepEqual(
    gradeAKI({ creatinineMgDl: 10.1, urineOutputStatus: 'anuria', hasClinicalEvidence: true }),
    { grade: 5, urineSubgrade: 'O', deltaMgDl: undefined },
  )

  // Janela do delta: > 48h ou intervalHours <= 0 nao qualifica sem outra evidencia
  assert.equal(
    gradeAKI({
      creatinineMgDl: 1.5,
      previousCreatinineMgDl: 1.0,
      intervalHours: 49,
      urineOutputStatus: 'normal',
      hasClinicalEvidence: false,
    }),
    null,
  )
  assert.equal(
    gradeAKI({
      creatinineMgDl: 1.5,
      previousCreatinineMgDl: 1.0,
      intervalHours: 0,
      urineOutputStatus: 'normal',
      hasClinicalEvidence: false,
    }),
    null,
  )
})

test('peso-controller sorts filtered entries newest-first, rejects future/invalid dates, and isolates corrupt storage', () => {
  withMemoryLocalStorage(
    {
      'vetdorim:peso-historico': JSON.stringify([
        {
          id: 'thor-old',
          nomePaciente: 'Thor',
          especie: 'cao',
          pesoKg: 10,
          ecc: 5,
          data: '2026-07-01',
          criadoEm: 100,
        },
        {
          id: 'mia-mid',
          nomePaciente: 'Mia',
          especie: 'gato',
          pesoKg: 4.1,
          ecc: 5,
          data: '2026-07-10',
          criadoEm: 200,
        },
        {
          id: 'thor-new',
          nomePaciente: 'Thor',
          especie: 'cao',
          pesoKg: 10.6,
          ecc: 5,
          data: '2026-07-15',
          criadoEm: 300,
        },
      ]),
    },
    () => {
      const filtered = listarPesos({ nomePaciente: 'thor' })
      assert.deepEqual(
        filtered.map((item) => item.id),
        ['thor-new', 'thor-old'],
      )

      assert.throws(
        () =>
          salvarPeso({
            nomePaciente: 'Thor',
            especie: 'cao',
            pesoKg: 11,
            ecc: 5,
            data: '2999-01-01',
          }),
        /futuro/i,
      )
      assert.throws(
        () =>
          salvarPeso({
            nomePaciente: 'Thor',
            especie: 'cao',
            pesoKg: 11,
            ecc: 5,
            data: '2026-02-31',
          }),
        /inválida/i,
      )
    },
  )

  withMemoryLocalStorage({ 'vetdorim:peso-historico': '{corrupted' }, (backing) => {
    assert.deepEqual(listarPesos(), [])
    assert.match(obterErroStorage() ?? '', /não pôde ser lido/i)
    assert.throws(() =>
      salvarPeso({
        nomePaciente: 'Thor',
        especie: 'cao',
        pesoKg: 11,
        ecc: 5,
        data: '2026-07-20',
      }),
    )
    assert.equal(backing.get('vetdorim:peso-historico'), '{corrupted')
  })
})

test('lab-free reference-status rejects partial/inverted inputs and evaluates inclusive bounds', () => {
  assert.equal(parseLabNumber('2,1'), 2.1)
  assert.equal(parseLabNumber(' 1.45 '), 1.45)
  assert.equal(parseLabNumber('1.2 mg/dL'), null)
  assert.equal(parseLabNumber(''), null)

  assert.equal(
    getLabReferenceStatus({ name: 'Cr', value: '1,4', unit: 'mg/dL', refMin: '0,5', refMax: '1,4' }),
    'normal',
  )
  assert.equal(
    getLabReferenceStatus({ name: 'Cr', value: '1,41', unit: 'mg/dL', refMin: '0,5', refMax: '1,4' }),
    'abnormal',
  )
  assert.equal(
    getLabReferenceStatus({ name: 'Cr', value: '1,0', unit: 'mg/dL', refMin: '2,0', refMax: '1,0' }),
    'unavailable',
  )
  assert.equal(
    getLabReferenceStatus({ name: 'Cr', value: '1,0 mg', unit: 'mg/dL', refMin: '0,5', refMax: '1,4' }),
    'unavailable',
  )
})

test('staging/local E2E cycles and remote-readiness cover Iteracoes C/D and security migrations', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const authCycle = readFileSync(resolve(webRoot, 'scripts/e2e-auth-rls-cycle.mjs'), 'utf8')
  const labCycle = readFileSync(resolve(webRoot, 'scripts/e2e-lab-crud-cycle.mjs'), 'utf8')
  const labSpec = readFileSync(resolve(webRoot, 'tests/e2e/lab-crud.spec.ts'), 'utf8')
  const readiness = readFileSync(resolve(webRoot, 'scripts/remote-readiness-check.mjs'), 'utf8')

  for (const source of [authCycle, labCycle]) {
    assert.match(source, /assertLocalSupabaseTarget/)
    assert.match(source, /explicitSupabaseTarget\(localEnv, \{ mutation: true \}\)/)
    assert.match(source, /process\.argv\.includes\('--local'\)/)
  }

  assert.match(labCycle, /E2E_CLINIC_A_NAME/)
  assert.match(labCycle, /E2E_CLINIC_B_NAME/)
  assert.match(labSpec, /DEATH_WORKFLOW_UNAVAILABLE/)
  assert.match(labSpec, /\/api\/lab\/active-clinic/)
  assert.match(labSpec, /NOT_FOUND/)

  assert.match(readiness, /20261118120000_security_audit_total_hardening\.sql/)
  assert.match(readiness, /20261119120000_pet_death_audit_workflow\.sql/)
  assert.match(readiness, /SUPABASE_DISABLE_UPDATE_CHECK:\s*'true'/)
})
