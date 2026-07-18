import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  sha256,
  validateAppendOnlyMigrations,
  validateManifestAppendOnly,
  validateMigrationManifest,
} from './lib/migration-integrity.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationsDirectory = join(repoRoot, 'supabase', 'migrations')
const manifestPath = join(repoRoot, 'supabase', 'migration-integrity.json')
const migrationPrefix = 'supabase/migrations/'

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`${label} is not valid UTF-8 JSON: ${error.message}`)
  }
}

function readActiveMigrations() {
  return readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.name.endsWith('.sql'))
    .map((entry) => {
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new Error(`migration must be a regular file: ${entry.name}`)
      }

      const bytes = readFileSync(join(migrationsDirectory, entry.name))
      if (bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
        throw new Error(`migration must not contain an UTF-8 BOM: ${entry.name}`)
      }

      return { file: entry.name, sha256: sha256(bytes) }
    })
    .sort((left, right) => left.file.localeCompare(right.file))
}

function git(args, encoding = 'utf8') {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding,
    shell: false,
    maxBuffer: 10 * 1024 * 1024,
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString('utf8')
      : String(result.stderr || '')
    throw new Error(`git ${args[0]} failed: ${stderr.trim() || `exit ${result.status}`}`)
  }
  return result.stdout
}

function readBaseMigrations(baseRef) {
  const names = String(
    git(['ls-tree', '-r', '--name-only', baseRef, '--', 'supabase/migrations']),
  )
    .split(/\r?\n/u)
    .filter((path) => path.startsWith(migrationPrefix) && path.endsWith('.sql'))
    .sort()

  if (names.length === 0) {
    throw new Error(`base ref ${baseRef} has no active migrations`)
  }

  return names.map((path) => {
    const bytes = git(['show', `${baseRef}:${path}`], null)
    return { file: path.slice(migrationPrefix.length), sha256: sha256(bytes) }
  })
}

function readBaseManifest(baseRef) {
  const probe = spawnSync('git', ['cat-file', '-e', `${baseRef}:supabase/migration-integrity.json`], {
    cwd: repoRoot,
    shell: false,
  })
  if (probe.error) throw probe.error
  if (probe.status !== 0) return null

  const bytes = git(['show', `${baseRef}:supabase/migration-integrity.json`], null)
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    throw new Error(`base migration manifest is invalid JSON: ${error.message}`)
  }
}

function parseBaseRef() {
  const args = process.argv.slice(2)
  let baseRef = process.env.MIGRATION_BASE_REF?.trim() || ''

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--check') continue
    if (argument === '--base-ref') {
      baseRef = args[index + 1] || ''
      index += 1
      continue
    }
    if (argument.startsWith('--base-ref=')) {
      baseRef = argument.slice('--base-ref='.length)
      continue
    }
    throw new Error(`unknown argument: ${argument}`)
  }

  if (!baseRef || /^0+$/u.test(baseRef)) return null
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(baseRef)) {
    throw new Error('base ref must be a full 40- or 64-character lowercase commit hash')
  }
  return baseRef
}

const currentManifest = readJson(manifestPath, 'migration manifest')
const currentMigrations = readActiveMigrations()
const validated = validateMigrationManifest(currentManifest, currentMigrations)
const baseRef = parseBaseRef()

if (baseRef) {
  git(['cat-file', '-e', `${baseRef}^{commit}`])
  const baseMigrations = readBaseMigrations(baseRef)
  validateAppendOnlyMigrations(baseMigrations, currentMigrations, validated.transitions)

  const baseManifest = readBaseManifest(baseRef)
  if (baseManifest) {
    validateManifestAppendOnly(baseManifest, currentManifest)
  } else {
    console.warn('Base commit has no manifest: validating the one-time bootstrap against raw migration bytes.')
  }
}

console.log(
  `Migration integrity PASS: ${currentMigrations.length} active file(s), SHA-256 raw bytes, ` +
    `${validated.transitions.length} disclosed transition(s).`,
)
console.log('Scope is repository-only; equality with staging/production is not asserted.')
