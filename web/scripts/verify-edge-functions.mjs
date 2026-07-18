import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const functionsRoot = join(repoRoot, 'supabase', 'functions')
const configText = readFileSync(join(repoRoot, 'supabase', 'config.toml'), 'utf8')
const EXACT_JSR_RE = /^jsr:@[a-z0-9_-]+\/[a-z0-9_-]+@(?<version>\d+\.\d+\.\d+)(?:\/[a-zA-Z0-9._/-]+)?$/u
const EXACT_NPM_RE = /^npm:(?:@[a-z0-9_-]+\/)?[a-z0-9_-]+@(?<version>\d+\.\d+\.\d+)$/u
const IMPORT_RE = /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?["'](?<specifier>[^"']+)["']/gu
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*["'](?<specifier>[^"']+)["']/gu
const SOURCE_EXTENSION_RE = /\.(?:[cm]?[jt]sx?)$/u

function listSourceFiles(root, directory = root) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isSymbolicLink()) {
      throw new Error(`Edge Function source tree cannot contain symlinks: ${relative(root, path)}`)
    } else if (entry.isDirectory()) {
      files.push(...listSourceFiles(root, path))
    } else if (entry.isFile() && SOURCE_EXTENSION_RE.test(entry.name)) {
      files.push({ path, displayPath: relative(root, path).replaceAll('\\', '/') })
    }
  }
  return files.sort((left, right) => left.displayPath.localeCompare(right.displayPath))
}

function importSpecifiers(source) {
  return [...source.matchAll(IMPORT_RE), ...source.matchAll(DYNAMIC_IMPORT_RE)]
    .map((match) => match.groups.specifier)
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`${path} is not valid UTF-8 JSON: ${error.message}`)
  }
}

function functionConfig(name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const section = new RegExp(
    `^\\[functions\\.${escapedName}\\]\\s*$([\\s\\S]*?)(?=^\\[|(?![\\s\\S]))`,
    'mu',
  ).exec(configText)?.[1]
  if (!section) throw new Error(`supabase/config.toml is missing [functions.${name}]`)
  return section
}

const functionDirectories = readdirSync(functionsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => entry.name)
  .sort()

if (functionDirectories.length === 0) {
  throw new Error('no Supabase Edge Function directories found')
}

for (const functionName of functionDirectories) {
  const directory = join(functionsRoot, functionName)
  const denoConfig = readJson(join(directory, 'deno.json'))
  const denoLock = readJson(join(directory, 'deno.lock'))
  const imports = denoConfig.imports

  if (denoLock.version !== '4' || !denoLock.specifiers || typeof denoLock.specifiers !== 'object') {
    throw new Error(`${functionName}/deno.lock must be a Deno v4 dependency lock`)
  }

  if (!imports || typeof imports !== 'object' || Array.isArray(imports)) {
    throw new Error(`${functionName}/deno.json must define an imports object`)
  }
  if (denoConfig.compilerOptions?.strict !== true) {
    throw new Error(`${functionName}/deno.json must enable compilerOptions.strict`)
  }

  const aliases = new Set(Object.keys(imports))
  const supabaseVersions = new Set()
  for (const [alias, target] of Object.entries(imports)) {
    if (typeof target !== 'string') {
      throw new Error(`${functionName}: import target for ${alias} must be a string`)
    }
    const match = EXACT_JSR_RE.exec(target) || EXACT_NPM_RE.exec(target)
    if (!match) {
      throw new Error(`${functionName}: dependency ${target} is not pinned to an exact x.y.z version`)
    }
    if (target.includes('@supabase/')) supabaseVersions.add(match.groups.version)
  }

  if (supabaseVersions.size > 1) {
    throw new Error(`${functionName}: Supabase Edge dependencies must use one reviewed version`)
  }

  const sourceFiles = listSourceFiles(directory)
  if (!sourceFiles.some((sourceFile) => sourceFile.displayPath === 'index.ts')) {
    throw new Error(`${functionName} must contain the configured index.ts entrypoint`)
  }

  for (const sourceFile of sourceFiles) {
    const source = readFileSync(sourceFile.path, 'utf8')
    for (const specifier of importSpecifiers(source)) {
      if (/^(?:jsr:|npm:|https?:)/u.test(specifier)) {
        throw new Error(`${functionName}/${sourceFile.displayPath} bypasses deno.json: ${specifier}`)
      }
      if (!specifier.startsWith('.') && !aliases.has(specifier)) {
        throw new Error(`${functionName}/${sourceFile.displayPath} uses undeclared import alias ${specifier}`)
      }
    }
  }

  const config = functionConfig(functionName)
  if (!/^enabled\s*=\s*true\s*$/mu.test(config)) {
    throw new Error(`[functions.${functionName}] must be explicitly enabled`)
  }
  if (!/^verify_jwt\s*=\s*true\s*$/mu.test(config)) {
    throw new Error(`[functions.${functionName}] must explicitly require JWT verification`)
  }
  const expectedEntrypoint = `./functions/${functionName}/index.ts`
  if (!new RegExp(`^entrypoint\\s*=\\s*["']${expectedEntrypoint.replaceAll('.', '\\.')}["']\\s*$`, 'mu').test(config)) {
    throw new Error(`[functions.${functionName}] must use entrypoint ${expectedEntrypoint}`)
  }

  console.log(
    `${functionName}: ${sourceFiles.length} recursive source file(s), ${aliases.size} exact dependency pin(s), ` +
      'Deno lock v4, JWT required',
  )
}

if (!/^deno_version\s*=\s*2\s*$/mu.test(configText)) {
  throw new Error('supabase/config.toml must keep Edge Runtime on Deno major 2')
}

console.log('Edge Function configuration PASS.')
