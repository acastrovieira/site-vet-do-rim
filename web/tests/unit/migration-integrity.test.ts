import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MIGRATION_MANIFEST_SCOPE,
  validateAppendOnlyMigrations,
  validateManifestAppendOnly,
  validateMigrationManifest,
} from '../../scripts/lib/migration-integrity.mjs'

const digest = (character: string) => character.repeat(64)
const migration = (file: string, sha256: string) => ({ file, sha256 })

function manifest(
  migrations: Array<{ file: string; sha256: string }>,
  approvedHistoricalTransitions: Array<Record<string, unknown>> = [],
) {
  return {
    formatVersion: 1,
    algorithm: 'sha256',
    hashMode: 'raw-file-bytes',
    scope: MIGRATION_MANIFEST_SCOPE,
    remoteAttestation: false,
    migrations,
    approvedHistoricalTransitions,
  }
}

test('migration manifest matches every active SQL byte hash and rejects drift', () => {
  const rows = [migration('20260101000000_initial.sql', digest('a'))]
  assert.doesNotThrow(() => validateMigrationManifest(manifest(rows), rows))

  assert.throws(
    () =>
      validateMigrationManifest(
        manifest(rows),
        [migration('20260101000000_initial.sql', digest('b'))],
      ),
    /differ from the SHA-256 manifest/u,
  )
})

test('historical migrations are append-only except for one exact disclosed transition', () => {
  const base = [migration('20260101000000_initial.sql', digest('a'))]
  const current = [
    migration('20260101000000_initial.sql', digest('b')),
    migration('20260102000000_forward_fix.sql', digest('c')),
  ]
  const transition = {
    file: base[0].file,
    baseSha256: digest('a'),
    currentSha256: digest('b'),
  }

  assert.equal(validateAppendOnlyMigrations(base, current, [transition]), true)
  assert.throws(
    () => validateAppendOnlyMigrations(base, current, []),
    /modified without an exact approved transition/u,
  )
  assert.throws(
    () => validateAppendOnlyMigrations(base, []),
    /at least one migration/u,
  )
})

test('new migrations must be newer and published manifest history cannot be rewritten', () => {
  const baseRows = [migration('20260102000000_initial.sql', digest('a'))]
  const invalidCurrent = [
    migration('20260101000000_backdated.sql', digest('b')),
    ...baseRows,
  ]
  assert.throws(
    () => validateAppendOnlyMigrations(baseRows, invalidCurrent),
    /must have a version greater/u,
  )

  const baseManifest = manifest(baseRows)
  const currentManifest = manifest([
    ...baseRows,
    migration('20260103000000_forward.sql', digest('c')),
  ])
  assert.equal(validateManifestAppendOnly(baseManifest, currentManifest), true)

  const inventedTransition = manifest(currentManifest.migrations, [{
    file: baseRows[0].file,
    baseSha256: digest('e'),
    currentSha256: baseRows[0].sha256,
    remoteArtifactSha256: null,
    remoteReconciliationRequired: true,
    ticket: 'AUDIT-999',
    reason: 'This transition was never observed in the published base manifest or migration bytes.',
  }])
  assert.throws(
    () => validateManifestAppendOnly(baseManifest, inventedTransition),
    /transition ledger is immutable/u,
  )

  const rewritten = manifest([migration(baseRows[0].file, digest('d'))])
  assert.throws(
    () => validateManifestAppendOnly(baseManifest, rewritten),
    /published manifest entry changed/u,
  )
})
