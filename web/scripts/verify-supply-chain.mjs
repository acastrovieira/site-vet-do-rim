import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const targets = [
  {
    manifest: 'package.json',
    lockfile: 'package-lock.json',
    lifecycleAllowlist: [],
  },
  {
    manifest: 'web/package.json',
    lockfile: 'web/package-lock.json',
    lifecycleAllowlist: ['core-js', 'fsevents', 'sharp', 'unrs-resolver'],
  },
  {
    manifest: '.aiox-core/package.json',
    lockfile: '.aiox-core/package-lock.json',
    lifecycleAllowlist: [],
  },
  {
    manifest: '.aiox-core/scripts/diagnostics/health-dashboard/package.json',
    lockfile: '.aiox-core/scripts/diagnostics/health-dashboard/package-lock.json',
    lifecycleAllowlist: ['esbuild', 'fsevents'],
  },
]

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8'))
}

function stableEntries(value = {}) {
  return Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
}

function assertManifestMatch(manifest, rootPackage, section, lockfile) {
  const declared = stableEntries(manifest[section])
  const locked = stableEntries(rootPackage?.[section])

  if (JSON.stringify(declared) !== JSON.stringify(locked)) {
    throw new Error(`${lockfile}: ${section} differs from its package manifest`)
  }
}

function packageNameFromPath(packagePath) {
  return packagePath.split('node_modules/').at(-1)
}

for (const target of targets) {
  const manifest = readJson(target.manifest)
  const lock = readJson(target.lockfile)

  if (lock.lockfileVersion !== 3) {
    throw new Error(`${target.lockfile}: expected lockfileVersion 3`)
  }

  const rootPackage = lock.packages?.['']
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    assertManifestMatch(manifest, rootPackage, section, target.lockfile)
  }

  const lifecyclePackages = new Set()
  let resolvedPackages = 0

  for (const [packagePath, metadata] of Object.entries(lock.packages ?? {})) {
    if (metadata.hasInstallScript && packagePath.includes('node_modules/')) {
      lifecyclePackages.add(packageNameFromPath(packagePath))
    }

    if (!metadata.resolved) continue
    resolvedPackages += 1

    const source = new URL(metadata.resolved)
    if (source.protocol !== 'https:' || source.hostname !== 'registry.npmjs.org') {
      throw new Error(`${target.lockfile}: unapproved package source ${source.origin}`)
    }

    if (!metadata.integrity?.startsWith('sha512-')) {
      throw new Error(`${target.lockfile}: package ${packagePath} lacks sha512 integrity`)
    }
  }

  const actualLifecycle = [...lifecyclePackages].sort()
  const allowedLifecycle = [...target.lifecycleAllowlist].sort()
  if (JSON.stringify(actualLifecycle) !== JSON.stringify(allowedLifecycle)) {
    throw new Error(
      `${target.lockfile}: lifecycle scripts changed; expected ${allowedLifecycle.join(', ') || 'none'}, ` +
        `found ${actualLifecycle.join(', ') || 'none'}`,
    )
  }

  console.log(
    `${target.lockfile}: ${resolvedPackages} registry packages verified; ` +
      `${actualLifecycle.length} reviewed lifecycle package(s)`,
  )
}
