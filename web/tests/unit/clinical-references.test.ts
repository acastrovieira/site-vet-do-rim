import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const library = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../../src/lib/lab/clinical-references/reference-library.json'),
    'utf8',
  ),
) as {
  status: string
  sources: Record<string, { citation: string }>
  parameters: Array<{
    key: string
    unit: string | null
    source: string
    requiresArbitration?: boolean
    alternateSources?: Array<{ source: string }>
    species: Record<'canino' | 'felino', { min: number; max: number }>
  }>
  unsourced: Array<{ key: string; reason: string }>
}

test('every clinical interval carries the source it came from', () => {
  // Constitution, Artigo IV (No Invention): nenhum valor clínico entra sem fonte.
  assert.ok(library.parameters.length > 0)
  for (const parameter of library.parameters) {
    assert.ok(
      library.sources[parameter.source]?.citation,
      `${parameter.key} aponta para uma fonte inexistente: ${parameter.source}`,
    )
    for (const especie of ['canino', 'felino'] as const) {
      const range = parameter.species[especie]
      assert.equal(typeof range.min, 'number', `${parameter.key}/${especie} sem minimo`)
      assert.equal(typeof range.max, 'number', `${parameter.key}/${especie} sem maximo`)
      assert.ok(range.min <= range.max, `${parameter.key}/${especie} com faixa invertida`)
    }
  }
})

test('the library stays flagged as draft until a clinician approves it', () => {
  // Enquanto este status não mudar, nenhum consumidor deve classificar resultado
  // com estes valores: eles ainda não foram conferidos contra o PDF de origem.
  assert.equal(library.status, 'draft-awaiting-clinical-approval')
})

test('sources that disagree are surfaced instead of silently resolved', () => {
  const emConflito = library.parameters.filter((p) => p.requiresArbitration)
  assert.ok(emConflito.length > 0, 'Knoll e Thrall divergem na série branca')
  for (const parameter of emConflito) {
    assert.ok(
      parameter.alternateSources?.length,
      `${parameter.key} marcado como conflito mas sem a fonte divergente registrada`,
    )
    for (const alternate of parameter.alternateSources ?? []) {
      assert.ok(library.sources[alternate.source], `fonte alternativa desconhecida em ${parameter.key}`)
    }
  }
})

test('the 13 parameters that had no reference are now sourced, except the one still missing', () => {
  const faltavam = [
    'hcm', 'rdw',
    'leucocitos_totais', 'neutrofilos_segmentados', 'neutrofilos_bastoes',
    'linfocitos', 'monocitos', 'eosinofilos', 'basofilos',
    'plaquetas_contagem', 'plaquetas_vpm',
    'alt_tgp', 'ast_tgo',
  ]
  const comFonte = new Set(library.parameters.map((p) => p.key))
  const semFonte = new Set(library.unsourced.map((p) => p.key))

  for (const key of faltavam) {
    if (key === 'plaquetas_vpm') continue
    assert.ok(comFonte.has(key), `${key} continua sem fonte na biblioteca`)
  }
  // VPM não foi localizado em nenhuma das obras: fica declarado, não inventado.
  assert.ok(semFonte.has('plaquetas_vpm'))
  assert.ok(!comFonte.has('plaquetas_vpm'))
})

test('parameters without a located source are declared, never guessed', () => {
  assert.ok(library.unsourced.length > 0)
  for (const parameter of library.unsourced) {
    assert.ok(parameter.reason.length > 10, `${parameter.key} sem justificativa`)
    assert.ok(
      !library.parameters.some((p) => p.key === parameter.key),
      `${parameter.key} está declarado sem fonte e ao mesmo tempo com intervalo`,
    )
  }
})

test('IRIS staging matches the 2026 guideline, not the superseded 2023 one', () => {
  const iris = (library as unknown as {
    irisStaging: {
      source: string
      stages: Record<'canino' | 'felino', Array<{
        stage: number
        creatinineMgDl: { min?: number; max?: number }
        sdma: { min?: number; max?: number }
      }>>
    }
  }).irisStaging

  assert.equal(iris.source, 'iris-2026')

  const creat = (esp: 'canino' | 'felino', stage: number) =>
    iris.stages[esp].find((s) => s.stage === stage)?.creatinineMgDl
  const sdma = (esp: 'canino' | 'felino', stage: number) =>
    iris.stages[esp].find((s) => s.stage === stage)?.sdma

  // Creatinina (mg/dL) — só o estágio 1 difere entre as espécies.
  assert.deepEqual(creat('canino', 2), { min: 1.4, max: 2.8 })
  assert.deepEqual(creat('felino', 2), { min: 1.6, max: 2.8 })
  assert.deepEqual(creat('canino', 3), { min: 2.9, max: 5.0 })
  assert.deepEqual(creat('felino', 3), { min: 2.9, max: 5.0 })

  // O que a revisão de 2026 mudou: o SDMA felino ganhou faixas próprias em vez
  // de repetir as do cão. Se alguém reintroduzir os valores de 2023, cai aqui.
  assert.deepEqual(sdma('canino', 2), { min: 18, max: 35 })
  assert.deepEqual(sdma('felino', 2), { min: 18, max: 25 })
  assert.deepEqual(sdma('canino', 3), { min: 36, max: 54 })
  assert.deepEqual(sdma('felino', 3), { min: 26, max: 38 })
  assert.notDeepEqual(sdma('felino', 2), sdma('canino', 2))
  assert.notDeepEqual(sdma('felino', 3), sdma('canino', 3))
})

test('IRIS substaging thresholds are transcribed exactly, with no overlapping bounds', () => {
  const iris = (library as unknown as {
    irisStaging: {
      proteinuriaSubstaging: Record<'canino' | 'felino', Array<{ abbreviation: string; upc: Record<string, number | boolean> }>>
      bloodPressureSubstaging: Array<{ category: string; systolicMmHg: Record<string, number | boolean> }>
    }
  }).irisStaging

  // UP/C: o limite superior do borderline é a única diferença entre espécies.
  const bpCao = iris.proteinuriaSubstaging.canino.find((c) => c.abbreviation === 'BP')
  const bpGato = iris.proteinuriaSubstaging.felino.find((c) => c.abbreviation === 'BP')
  assert.equal(bpCao?.upc.max, 0.5)
  assert.equal(bpGato?.upc.max, 0.4)

  // Pressão arterial: mesmos cortes para as duas espécies, sem sobreposição —
  // <140, 140–159, 160–179, >=180.
  const pas = iris.bloodPressureSubstaging
  assert.equal(pas.length, 4)
  assert.equal(pas[0]?.systolicMmHg.max, 140)
  assert.equal(pas[0]?.systolicMmHg.inclusiveMax, false)
  assert.equal(pas[1]?.systolicMmHg.min, 140)
  assert.equal(pas[1]?.systolicMmHg.max, 159)
  assert.equal(pas[2]?.systolicMmHg.min, 160)
  assert.equal(pas[3]?.systolicMmHg.min, 180)
})
