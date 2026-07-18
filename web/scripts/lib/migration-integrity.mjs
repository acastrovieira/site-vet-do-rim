import { createHash } from 'node:crypto'

export const MIGRATION_MANIFEST_VERSION = 1
export const MIGRATION_MANIFEST_SCOPE = 'repository-baseline-only; remote-equality-not-asserted'

const MIGRATION_FILE_RE = /^(?<version>\d{14})_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/
const SHA256_RE = /^[a-f0-9]{64}$/

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
}

function assertExactKeys(value, expectedKeys, label) {
  assertPlainObject(value, label)
  const actual = Object.keys(value).sort()
  const expected = [...expectedKeys].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} keys must be exactly: ${expected.join(', ')}`)
  }
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function validateMigrationRows(rows, label) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`${label} must contain at least one migration`)
  }

  const versions = new Set()
  let previousFile = ''

  return rows.map((row, index) => {
    const rowLabel = `${label}[${index}]`
    assertExactKeys(row, ['file', 'sha256'], rowLabel)

    const match = typeof row.file === 'string' ? MIGRATION_FILE_RE.exec(row.file) : null
    if (!match) {
      throw new Error(`${rowLabel}.file must match ${MIGRATION_FILE_RE}`)
    }
    if (!SHA256_RE.test(row.sha256)) {
      throw new Error(`${rowLabel}.sha256 must be a lowercase SHA-256 digest`)
    }
    if (row.file <= previousFile) {
      throw new Error(`${label} must be strictly sorted by file name`)
    }

    const version = match.groups.version
    if (versions.has(version)) {
      throw new Error(`${label} contains duplicate migration version ${version}`)
    }

    versions.add(version)
    previousFile = row.file
    return { file: row.file, sha256: row.sha256, version }
  })
}

function validateDriftEvents(events, manifestRows) {
  if (!Array.isArray(events)) {
    throw new Error('approvedHistoricalTransitions must be an array')
  }

  const manifestByFile = new Map(manifestRows.map((row) => [row.file, row]))
  const files = new Set()

  return events.map((event, index) => {
    const label = `approvedHistoricalTransitions[${index}]`
    assertExactKeys(
      event,
      [
        'baseSha256',
        'currentSha256',
        'file',
        'reason',
        'remoteArtifactSha256',
        'remoteReconciliationRequired',
        'ticket',
      ],
      label,
    )

    if (!MIGRATION_FILE_RE.test(event.file)) {
      throw new Error(`${label}.file is not a valid migration file`)
    }
    if (!SHA256_RE.test(event.baseSha256) || !SHA256_RE.test(event.currentSha256)) {
      throw new Error(`${label} must contain lowercase SHA-256 digests`)
    }
    if (event.baseSha256 === event.currentSha256) {
      throw new Error(`${label} does not describe a content transition`)
    }
    if (event.remoteArtifactSha256 !== null || event.remoteReconciliationRequired !== true) {
      throw new Error(`${label} must keep remote equality explicitly unresolved`)
    }
    if (typeof event.reason !== 'string' || event.reason.trim().length < 40) {
      throw new Error(`${label}.reason must provide an auditable explanation`)
    }
    if (typeof event.ticket !== 'string' || !/^AUDIT-\d+$/.test(event.ticket)) {
      throw new Error(`${label}.ticket must reference an AUDIT story`)
    }
    if (files.has(event.file)) {
      throw new Error(`multiple historical transitions are not allowed for ${event.file}`)
    }

    const manifestRow = manifestByFile.get(event.file)
    if (!manifestRow || manifestRow.sha256 !== event.currentSha256) {
      throw new Error(`${label}.currentSha256 must match the repository manifest`)
    }

    files.add(event.file)
    return { ...event }
  })
}

export function validateMigrationManifest(manifest, actualRows) {
  assertExactKeys(
    manifest,
    [
      'algorithm',
      'approvedHistoricalTransitions',
      'formatVersion',
      'hashMode',
      'migrations',
      'remoteAttestation',
      'scope',
    ],
    'migration manifest',
  )

  if (manifest.formatVersion !== MIGRATION_MANIFEST_VERSION) {
    throw new Error(`unsupported migration manifest version ${manifest.formatVersion}`)
  }
  if (manifest.algorithm !== 'sha256' || manifest.hashMode !== 'raw-file-bytes') {
    throw new Error('migration manifest must use SHA-256 over raw file bytes')
  }
  if (manifest.scope !== MIGRATION_MANIFEST_SCOPE || manifest.remoteAttestation !== false) {
    throw new Error('migration manifest must not claim remote equality')
  }

  const declared = validateMigrationRows(manifest.migrations, 'migrations')
  const actual = validateMigrationRows(actualRows, 'active migration files')
  const declaredPairs = declared.map(({ file, sha256: digest }) => [file, digest])
  const actualPairs = actual.map(({ file, sha256: digest }) => [file, digest])

  if (JSON.stringify(declaredPairs) !== JSON.stringify(actualPairs)) {
    throw new Error('active migration files differ from the SHA-256 manifest')
  }

  const transitions = validateDriftEvents(manifest.approvedHistoricalTransitions, declared)
  return { migrations: declared, transitions }
}

export function validateAppendOnlyMigrations(baseRows, currentRows, transitions = []) {
  const base = validateMigrationRows(baseRows, 'base migrations')
  const current = validateMigrationRows(currentRows, 'current migrations')
  const currentByFile = new Map(current.map((row) => [row.file, row]))
  const transitionByFile = new Map(transitions.map((event) => [event.file, event]))

  for (const baseRow of base) {
    const currentRow = currentByFile.get(baseRow.file)
    if (!currentRow) {
      throw new Error(`historical migration removed or renamed: ${baseRow.file}`)
    }
    if (currentRow.sha256 === baseRow.sha256) continue

    const exception = transitionByFile.get(baseRow.file)
    if (
      !exception ||
      exception.baseSha256 !== baseRow.sha256 ||
      exception.currentSha256 !== currentRow.sha256
    ) {
      throw new Error(`historical migration modified without an exact approved transition: ${baseRow.file}`)
    }
  }

  const baseFiles = new Set(base.map((row) => row.file))
  const baseMaxVersion = base.at(-1).version
  for (const currentRow of current) {
    if (!baseFiles.has(currentRow.file) && currentRow.version <= baseMaxVersion) {
      throw new Error(
        `new migration ${currentRow.file} must have a version greater than ${baseMaxVersion}`,
      )
    }
  }

  return true
}

export function validateManifestAppendOnly(baseManifest, currentManifest) {
  const base = validateMigrationManifest(
    baseManifest,
    baseManifest.migrations.map(({ file, sha256: digest }) => ({ file, sha256: digest })),
  )
  const current = validateMigrationManifest(
    currentManifest,
    currentManifest.migrations.map(({ file, sha256: digest }) => ({ file, sha256: digest })),
  )

  const currentByFile = new Map(current.migrations.map((row) => [row.file, row]))
  for (const baseRow of base.migrations) {
    const currentRow = currentByFile.get(baseRow.file)
    if (!currentRow || currentRow.sha256 !== baseRow.sha256) {
      throw new Error(`published manifest entry changed or disappeared: ${baseRow.file}`)
    }
  }

  validateAppendOnlyMigrations(
    base.migrations.map(({ file, sha256: digest }) => ({ file, sha256: digest })),
    current.migrations.map(({ file, sha256: digest }) => ({ file, sha256: digest })),
  )

  if (JSON.stringify(base.transitions) !== JSON.stringify(current.transitions)) {
    throw new Error('approved historical transition ledger is immutable after bootstrap')
  }

  return true
}
