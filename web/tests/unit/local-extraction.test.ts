import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseLocalNumber } from '../../src/lib/lab/local-extraction/number-parser.ts'
import { parseLocalLabText } from '../../src/lib/lab/local-extraction/text-parser.ts'
import {
  buildReviewedLocalResult,
  parseReviewedLocalExtractionPayload,
} from '../../src/lib/lab/local-extraction/reviewed-result.ts'

test('local number parser handles pt-BR and en-US without guessing ambiguous thousands', () => {
  assert.equal(parseLocalNumber('2,15').value, 2.15)
  assert.equal(parseLocalNumber('2.15').value, 2.15)
  assert.equal(parseLocalNumber('1.234,56').value, 1234.56)
  assert.equal(parseLocalNumber('1,234.56').value, 1234.56)
  assert.equal(parseLocalNumber('12.000').value, null)
  assert.equal(parseLocalNumber('12.000').ambiguous, true)
  assert.equal(parseLocalNumber('< 1,2').value, null)
  assert.equal(parseLocalNumber('< 1,2').qualifier, '<')
})

test('digital parser extracts supported values and preserves laboratory evidence', () => {
  const draft = parseLocalLabText([
    [
      'Laboratório: Vet Teste',
      'Data de coleta: 23/08/2026',
      'Creatinina: 2,1 mg/dL 0,5 - 1,8',
      'Ureia: 85 mg/dL 21 - 60',
      'Fósforo: 5.2 mg/dL',
      'Hematócrito: 31 % 37 - 55',
    ].join('\n'),
  ], 'pdf-text')

  assert.equal(draft.source, 'pdf-text')
  assert.equal(draft.metadata.laboratory, 'Vet Teste')
  assert.equal(draft.metadata.collectionDate, '2026-08-23')
  assert.equal(draft.items.find((item) => item.key === 'creatinina')?.value, 2.1)
  assert.equal(draft.items.find((item) => item.key === 'creatinina')?.unit, 'mg/dL')
  assert.equal(draft.items.find((item) => item.key === 'creatinina')?.referenceMin, 0.5)
  assert.equal(draft.items.find((item) => item.key === 'creatinina')?.referenceMax, 1.8)
  assert.equal(draft.items.find((item) => item.key === 'hematocrito')?.value, 31)
})

test('parser ignores numeric unit scales and prefers absolute leukocyte counts over percentages', () => {
  const draft = parseLocalLabText([
    'Hemácias x10^6/µL 6,50 5,50 - 8,50',
    'Neutrófilos segmentados 70 % 7000 /µL 3000 - 11500',
  ], 'pdf-text')

  const hemacias = draft.items.find((item) => item.key === 'hemacias')
  const neutrofilos = draft.items.find((item) => item.key === 'neutrofilos_segmentados')

  assert.equal(hemacias?.value, 6.5)
  assert.equal(hemacias?.unit, '×10⁶/µL')
  assert.equal(neutrofilos?.value, 7000)
  assert.equal(neutrofilos?.unit, '/µL')
})

test('parser preserves platelet, leukogram and renal units without rescaling values', () => {
  const draft = parseLocalLabText([
    [
      'Plaquetas 250 x10^3/µL 175 - 500',
      'Leucócitos totais 8000 células/mm³ 6000 - 17000',
      'Ureia 8,2 mmol/L 3,1 - 10,4',
      'Creatinina 110 µmol/L 40 - 130',
    ].join('\n'),
  ], 'pdf-text')

  const platelets = draft.items.find((item) => item.key === 'plaquetas_contagem')
  const leukocytes = draft.items.find((item) => item.key === 'leucocitos_totais')
  const urea = draft.items.find((item) => item.key === 'ureia')
  const creatinine = draft.items.find((item) => item.key === 'creatinina')

  assert.equal(platelets?.value, 250)
  assert.equal(platelets?.unit, '×10³/µL')
  assert.equal(platelets?.referenceText, '175 - 500')
  assert.equal(leukocytes?.value, 8000)
  assert.equal(leukocytes?.unit, '/µL')
  assert.equal(urea?.unit, 'mmol/L')
  assert.equal(creatinine?.unit, 'µmol/L')
})

test('parser refuses ambiguous, percentage-only absolute counts and conflicting duplicates', () => {
  const draft = parseLocalLabText([
    'Leucócitos: 65 %\nPlaquetas: 12.000 /µL\nCreatinina: 1,2 mg/dL\nCreatinina: 2,4 mg/dL',
  ], 'ocr')

  const leucocytes = draft.items.find((item) => item.key === 'leucocitos_totais')
  const platelets = draft.items.find((item) => item.key === 'plaquetas_contagem')
  const creatinine = draft.items.filter((item) => item.key === 'creatinina')
  assert.equal(leucocytes?.selected, false)
  assert.ok(leucocytes?.flags.includes('percentage_not_absolute'))
  assert.equal(platelets?.value, null)
  assert.ok(platelets?.flags.includes('ambiguous_number'))
  assert.equal(creatinine.length, 2)
  assert.ok(creatinine.every((item) => !item.selected && item.flags.includes('conflicting_duplicate')))
})

test('reviewed payload is strict and produces a neutral local result', () => {
  const payload = parseReviewedLocalExtractionPayload({
    items: [
      { key: 'creatinina', value: 2.1, valueText: '2,1', unit: 'mg/dL', referenceMin: 0.5, referenceMax: 1.8, referenceText: '0,5 - 1,8', page: 1 },
      { key: 'ureia', value: 85, valueText: '85', unit: 'mg/dL', referenceMin: 21, referenceMax: 60, referenceText: '21 - 60', page: 1 },
    ],
    laboratory: 'Vet Teste',
    collectionDate: '2026-08-23',
    resultDate: null,
    source: 'pdf-text',
  })
  const result = buildReviewedLocalResult(payload, {
    name: 'Paciente teste', species: 'canino', breed: '', age: '', weightKg: null, tutor: '',
  })

  assert.equal(result.bioquimica.creatinina, 2.1)
  assert.equal(result.bioquimica.ureia, 85)
  assert.equal(result.interpretacao_ia.estadiamento_iris_sugerido, null)
  assert.match(result.interpretacao_ia.resumo, /Nenhuma interpretação clínica automática/i)
  assert.equal(result.extracao_local?.reviewed, true)
  assert.equal(result.extracao_local?.schema_version, 2)
  assert.equal(result.extracao_local?.items[0]?.valor_texto, '2,1')
  assert.equal(result.extracao_local?.items[0]?.referencia_texto, '0,5 - 1,8')
  assert.equal(result.extracao_local?.items[0]?.observation?.assessment.status, 'above')
  assert.throws(() => parseReviewedLocalExtractionPayload({
    items: [
      { key: 'creatinina', value: 1, valueText: '1', unit: null, referenceMin: null, referenceMax: null, referenceText: null, page: 0 },
      { key: 'creatinina', value: 2, valueText: '2', unit: null, referenceMin: null, referenceMax: null, referenceText: null, page: 0 },
    ],
    laboratory: null, collectionDate: null, resultDate: null, source: 'pdf-text',
  }))
  assert.throws(() => parseReviewedLocalExtractionPayload({
    items: [
      { key: 'creatinina', value: 2.1, valueText: '2,1', unit: 'mg/dL', referenceMin: 0.5, referenceMax: 1.8, referenceText: '99 - 100', page: 1 },
    ],
    laboratory: null, collectionDate: null, resultDate: null, source: 'pdf-text',
  }), /Evidencia da referencia/i)
})

test('local flow stays provider-free and server persistence is narrowly authorized', () => {
  const component = readFileSync(
    resolve(import.meta.dirname, '../../src/components/lab/LocalExtractionReview.tsx'),
    'utf8',
  )
  const extractor = readFileSync(
    resolve(import.meta.dirname, '../../src/lib/lab/local-extraction/pdf-extractor.client.ts'),
    'utf8',
  )
  const route = readFileSync(
    resolve(import.meta.dirname, '../../src/app/api/laudos/[id]/results-local/route.ts'),
    'utf8',
  )
  const csp = readFileSync(resolve(import.meta.dirname, '../../vercel.json'), 'utf8')

  assert.doesNotMatch(component, /functions\.invoke|OPENAI_API_KEY|GEMINI_API_KEY/)
  assert.doesNotMatch(extractor, /openai|gemini|cdn\.jsdelivr|unpkg/i)
  assert.match(component, /Conferi os parâmetros selecionados/)
  assert.match(route, /authorizeClinicAccess/)
  assert.match(route, /authorization\.clinicId/)
  assert.match(route, /\['vet', 'clinic_admin'\]\.includes\(authorization\.membershipRole\)/)
  assert.match(route, /authorization\.membershipRole !== 'clinic_admin'/)
  assert.match(route, /\.eq\('status', 'pendente'\)/)
  assert.match(route, /expectedPath = `clinics\/\$\{authorization\.clinicId\}\/laudos\/\$\{id\}\/original\.pdf`/)
  assert.match(csp, /worker-src 'self' blob:/)
})
