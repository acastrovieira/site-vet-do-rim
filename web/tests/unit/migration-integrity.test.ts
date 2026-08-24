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

function transition(file: string, baseSha256: string, currentSha256: string) {
  return {
    file,
    baseSha256,
    currentSha256,
    remoteArtifactSha256: null,
    remoteReconciliationRequired: true,
    ticket: 'AUDIT-999',
    reason: 'Audited repository transition with remote artifact equality explicitly unresolved.',
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

test('new migrations must use a version greater than the published maximum', () => {
  const baseRows = [migration('20260102000000_initial.sql', digest('a'))]
  const invalidCurrent = [
    migration('20260101000000_backdated.sql', digest('b')),
    ...baseRows,
  ]
  assert.throws(
    () => validateAppendOnlyMigrations(baseRows, invalidCurrent),
    /must have a version greater/u,
  )

})

test('manifest ledger preserves its immutable prefix and permits exact appended transitions', () => {
  const baseRows = [
    migration('20260101000000_initial.sql', digest('b')),
    migration('20260102000000_feature.sql', digest('c')),
  ]
  const publishedTransition = transition(baseRows[0].file, digest('a'), digest('b'))
  const baseManifest = manifest(baseRows, [publishedTransition])
  const currentRows = [
    baseRows[0],
    migration(baseRows[1].file, digest('d')),
    migration('20260103000000_forward.sql', digest('e')),
  ]
  const appendedTransition = transition(baseRows[1].file, digest('c'), digest('d'))
  const currentManifest = manifest(currentRows, [publishedTransition, appendedTransition])

  assert.equal(validateManifestAppendOnly(baseManifest, currentManifest), true)

  const reordered = manifest(currentRows, [appendedTransition, publishedTransition])
  assert.throws(
    () => validateManifestAppendOnly(baseManifest, reordered),
    /immutable prefix/u,
  )

  const rewrittenPublished = {
    ...publishedTransition,
    reason: 'A rewritten explanation must not replace the already published ledger event.',
  }
  assert.throws(
    () => validateManifestAppendOnly(
      baseManifest,
      manifest(currentRows, [rewrittenPublished, appendedTransition]),
    ),
    /immutable prefix/u,
  )
})

test('every changed historical manifest row requires one exact appended event', () => {
  const baseRows = [migration('20260102000000_initial.sql', digest('a'))]
  const changedRows = [migration(baseRows[0].file, digest('b'))]

  assert.throws(
    () => validateManifestAppendOnly(manifest(baseRows), manifest(changedRows)),
    /changed without an exact appended transition/u,
  )

  const wrongBase = transition(baseRows[0].file, digest('c'), digest('b'))
  assert.throws(
    () => validateManifestAppendOnly(manifest(baseRows), manifest(changedRows, [wrongBase])),
    /changed without an exact appended transition/u,
  )
})

test('appended events cannot invent drift for unchanged or unpublished rows', () => {
  const baseRows = [migration('20260102000000_initial.sql', digest('a'))]

  const inventedTransition = manifest(baseRows, [
    transition(baseRows[0].file, digest('e'), baseRows[0].sha256),
  ])
  assert.throws(
    () => validateManifestAppendOnly(manifest(baseRows), inventedTransition),
    /does not match a changed historical manifest row/u,
  )

  const newRows = [
    ...baseRows,
    migration('20260103000000_forward.sql', digest('c')),
  ]
  const transitionForNewRow = transition(newRows[1].file, digest('b'), digest('c'))
  assert.throws(
    () => validateManifestAppendOnly(manifest(baseRows), manifest(newRows, [transitionForNewRow])),
    /does not match a changed historical manifest row/u,
  )
})
