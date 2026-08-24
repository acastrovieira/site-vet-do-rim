import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assessLaboratoryReference,
  buildCanonicalLaboratoryObservation,
  canonicalizeLaboratoryUnit,
  observationsHaveComparableUnits,
} from '../../src/lib/lab/canonical-observation.ts'

test('canonical unit handling preserves count scale instead of converting silently', () => {
  assert.equal(canonicalizeLaboratoryUnit('/uL'), '/µL')
  assert.equal(canonicalizeLaboratoryUnit('células/mm³'), '/µL')
  assert.equal(canonicalizeLaboratoryUnit('10^3/uL'), '×10³/µL')
  assert.equal(canonicalizeLaboratoryUnit('x10³/µL'), '×10³/µL')
  assert.notEqual(canonicalizeLaboratoryUnit('/uL'), canonicalizeLaboratoryUnit('10^3/uL'))
})

test('platelet and leukogram fixtures classify only within their own printed scale', () => {
  const compactPlatelets = assessLaboratoryReference({
    value: 250,
    measurementUnit: '×10³/µL',
    referenceMin: 175,
    referenceMax: 500,
    referenceText: '175 - 500',
    referenceUnit: '×10³/µL',
    referenceSource: 'laboratory_report',
  })
  const absolutePlatelets = assessLaboratoryReference({
    value: 250_000,
    measurementUnit: '/µL',
    referenceMin: 175_000,
    referenceMax: 500_000,
    referenceText: '175000 - 500000',
    referenceUnit: '/µL',
    referenceSource: 'laboratory_report',
  })
  const mismatchedLeukogram = assessLaboratoryReference({
    value: 7,
    measurementUnit: '×10³/µL',
    referenceMin: 6_000,
    referenceMax: 17_000,
    referenceText: '6000 - 17000',
    referenceUnit: '/µL',
    referenceSource: 'laboratory_report',
  })

  assert.equal(compactPlatelets.status, 'within')
  assert.equal(absolutePlatelets.status, 'within')
  assert.deepEqual(mismatchedLeukogram, {
    status: 'not_classified',
    reason: 'unit_mismatch',
  })
})

test('urea and creatinine preserve laboratory units without assuming mg/dL', () => {
  const urea = buildCanonicalLaboratoryObservation({
    parameter: 'ureia',
    value: 8.2,
    printedValue: '8,2',
    printedUnit: 'mmol/L',
    referenceMin: 3.1,
    referenceMax: 10.4,
    referenceText: '3,1 - 10,4',
    referenceSource: 'laboratory_report',
    source: 'pdf-text',
    page: 2,
    reviewed: true,
  })
  const creatinine = buildCanonicalLaboratoryObservation({
    parameter: 'creatinina',
    value: 110,
    printedValue: '110',
    printedUnit: 'µmol/L',
    referenceMin: 40,
    referenceMax: 130,
    referenceText: '40 - 130',
    referenceSource: 'laboratory_report',
    source: 'ocr',
    page: 1,
    reviewed: true,
  })

  assert.equal(urea.measurement.printedValue, '8,2')
  assert.equal(urea.measurement.canonicalUnit, 'mmol/L')
  assert.equal(urea.reference.printedText, '3,1 - 10,4')
  assert.equal(urea.assessment.status, 'within')
  assert.equal(creatinine.measurement.canonicalUnit, 'µmol/L')
  assert.equal(creatinine.assessment.status, 'within')
})

test('classification fails closed without complete printed laboratory evidence', () => {
  const base = {
    value: 2,
    measurementUnit: 'mg/dL',
    referenceMin: 1,
    referenceMax: 3,
    referenceText: '1 - 3',
    referenceUnit: 'mg/dL',
    referenceSource: 'laboratory_report' as const,
  }

  assert.equal(assessLaboratoryReference({ ...base, referenceText: null }).status, 'not_classified')
  assert.equal(assessLaboratoryReference({ ...base, referenceMax: null }).status, 'not_classified')
  assert.equal(assessLaboratoryReference({ ...base, measurementUnit: null }).status, 'not_classified')
  assert.equal(assessLaboratoryReference({ ...base, qualifier: '<' }).status, 'not_classified')
  assert.deepEqual(
    assessLaboratoryReference({ ...base, referenceSource: 'legacy_catalog' }),
    { status: 'not_classified', reason: 'reference_not_from_report' },
  )
})

test('trend comparison refuses mixed or unknown units', () => {
  assert.equal(observationsHaveComparableUnits([
    { value: 7, unit: '×10³/µL' },
    { value: 8, unit: '10^3/uL' },
  ]), true)
  assert.equal(observationsHaveComparableUnits([
    { value: 7, unit: '×10³/µL' },
    { value: 8_000, unit: '/µL' },
  ]), false)
  assert.equal(observationsHaveComparableUnits([
    { value: 1.2, unit: 'mg/dL' },
    { value: 110, unit: 'µmol/L' },
  ]), false)
  assert.equal(observationsHaveComparableUnits([{ value: 1.2, unit: null }]), false)
})

test('evolution and export never classify from the unversioned legacy catalog', () => {
  const evolution = readFileSync(
    resolve(import.meta.dirname, '../../src/components/lab/LabEvolutionTable.tsx'),
    'utf8',
  )
  const exportRoute = readFileSync(
    resolve(import.meta.dirname, '../../src/app/api/lab/export/route.ts'),
    'utf8',
  )

  assert.doesNotMatch(evolution, /CANINE_REF|FELINE_REF|getRefForSpecies/)
  assert.doesNotMatch(exportRoute, /CANINE_REF|FELINE_REF|getRefForSpecies/)
  assert.match(exportRoute, /observation\?\.assessment\.status/)
})

test('successful extraction and legacy cron preserve the original PDF', () => {
  const edge = readFileSync(
    resolve(import.meta.dirname, '../../../supabase/functions/parse-laudo/index.ts'),
    'utf8',
  )
  const localRoute = readFileSync(
    resolve(import.meta.dirname, '../../src/app/api/laudos/[id]/results-local/route.ts'),
    'utf8',
  )
  const cleanupRoute = readFileSync(
    resolve(import.meta.dirname, '../../src/app/api/cron/cleanup-storage/route.ts'),
    'utf8',
  )
  const vercel = JSON.parse(readFileSync(
    resolve(import.meta.dirname, '../../vercel.json'),
    'utf8',
  )) as { crons?: Array<{ path?: string }> }
  const adr = readFileSync(
    resolve(import.meta.dirname, '../../../docs/architecture/ADR-003-exam-ingestion-evidence-preservation.md'),
    'utf8',
  )

  assert.match(edge, /const pdfSha256 = await sha256Hex\(pdfBytes\)/)
  assert.match(edge, /p_provenance: provenance/)
  assert.match(edge, /event=provenance_size_limit[\s\S]*pdf_sha256: input\.pdfSha256/)
  assert.match(edge, /O objeto original permanece no Storage privado/)
  assert.doesNotMatch(edge, /\.remove\(\[claimResult\.storage_path\]\)/)
  assert.doesNotMatch(edge, /storage_deleted_at:\s*new Date/)

  assert.match(localRoute, /\.list\(folder, \{ limit: 2, search: 'original\.pdf' \}\)/)
  assert.doesNotMatch(localRoute, /\.remove\(/)

  assert.match(cleanupRoute, /preservation_hold_pending_retention_policy/)
  assert.doesNotMatch(cleanupRoute, /\.remove\(|storage_deleted_at|SUPABASE_SERVICE_ROLE_KEY/)
  assert.equal(vercel.crons?.some((cron) => cron.path === '/api/cron/cleanup-storage'), false)
  assert.match(adr, /não haverá purge automático dos objetos/)
})
