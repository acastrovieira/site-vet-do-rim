import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { ApiValidationError } from '../../src/lib/api-validation.ts'
import {
  mapRecordPetDeathError,
  parsePetDeathPayload,
  PET_DEATH_REASON_PRESETS,
  todayCivilDateSaoPaulo,
} from '../../src/lib/lab/pet-death.ts'

const webRoot = resolve(import.meta.dirname, '../..')
const repoRoot = resolve(webRoot, '..')

test('parsePetDeathPayload enforces civil dates, bounds, reason length and strict keys', () => {
  const valid = parsePetDeathPayload(
    {
      data_obito: '2026-11-18',
      motivo: PET_DEATH_REASON_PRESETS[0],
      observacoes: 'Acompanhamento encerrado junto ao tutor.',
      confirm_pet_name: 'Rex',
    },
    '2026-11-19',
  )

  assert.deepEqual(valid, {
    data_obito: '2026-11-18',
    motivo: PET_DEATH_REASON_PRESETS[0],
    observacoes: 'Acompanhamento encerrado junto ao tutor.',
    confirm_pet_name: 'Rex',
  })

  assert.match(todayCivilDateSaoPaulo(new Date('2026-11-19T23:00:00.000Z')), /^\d{4}-\d{2}-\d{2}$/)

  assert.throws(
    () =>
      parsePetDeathPayload(
        {
          data_obito: '2026-11-20',
          motivo: 'Evolução clínica',
          confirm_pet_name: 'Rex',
        },
        '2026-11-19',
      ),
    ApiValidationError,
  )

  assert.throws(
    () =>
      parsePetDeathPayload(
        {
          data_obito: '1989-12-31',
          motivo: 'Evolução clínica',
          confirm_pet_name: 'Rex',
        },
        '2026-11-19',
      ),
    ApiValidationError,
  )

  assert.throws(
    () =>
      parsePetDeathPayload(
        {
          data_obito: '2026-11-18',
          motivo: 'ab',
          confirm_pet_name: 'Rex',
        },
        '2026-11-19',
      ),
    ApiValidationError,
  )

  assert.throws(
    () =>
      parsePetDeathPayload(
        {
          data_obito: '2026-11-18',
          motivo: 'Evolução clínica',
          confirm_pet_name: 'Rex',
          clinic_id: '00000000-0000-4000-8000-000000000001',
        },
        '2026-11-19',
      ),
    ApiValidationError,
  )
})

test('mapRecordPetDeathError translates every SQL exception cleanly without raw internals', () => {
  assert.equal(mapRecordPetDeathError('actor_not_authorized').status, 403)
  assert.equal(mapRecordPetDeathError('pet_not_found').status, 404)
  assert.equal(mapRecordPetDeathError('pet_already_deceased').status, 409)
  assert.equal(mapRecordPetDeathError('invalid_death_date').status, 400)
  assert.equal(mapRecordPetDeathError('invalid_death_reason').status, 400)
  assert.equal(mapRecordPetDeathError('invalid_death_notes').status, 400)
  assert.equal(mapRecordPetDeathError('invalid_request').status, 400)
  assert.equal(mapRecordPetDeathError('unexpected_pg_detail').code, 'DATABASE')
})

test('20261119120000 migration and /api/pets/[id]/obito enforce atomic tenancy, append-only audit and CSRF/rate limits', () => {
  const migration = readFileSync(
    resolve(repoRoot, 'supabase/migrations/20261119120000_pet_death_audit_workflow.sql'),
    'utf8',
  )

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.pet_death_events/)
  assert.match(migration, /ALTER TABLE public\.pet_death_events FORCE ROW LEVEL SECURITY/)
  assert.match(migration, /fk_pet_death_events_pet_same_clinic/)
  assert.match(migration, /REFERENCES public\.pets\(clinic_id, id\)/)
  assert.match(migration, /trg_pet_death_events_append_only/)
  assert.match(migration, /pet_death_events_append_only/)
  assert.match(migration, /FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /TO service_role/)
  assert.match(migration, /SET search_path = ''/)
  assert.match(migration, /FOR UPDATE/)
  assert.match(migration, /status = 'encerrada_obito'/)
  assert.match(migration, /opt_out = true/)

  const routeSource = readFileSync(
    resolve(webRoot, 'src/app/api/pets/[id]/obito/route.ts'),
    'utf8',
  )
  assert.match(routeSource, /authorizeClinicAccess\(supabase, \['vet', 'admin'\]\)/)
  assert.match(routeSource, /assertSameOriginMutation\(request\)/)
  assert.match(routeSource, /consumeClinicalRateLimit/)
  assert.match(routeSource, /confirm_pet_name/)
  assert.match(routeSource, /createServiceClient\(\)/)
  assert.match(routeSource, /rpc\('record_pet_death'/)
  assert.match(routeSource, /privateApiJson/)
})
