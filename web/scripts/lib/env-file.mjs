import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export function loadLocalEnv(cwd = process.cwd()) {
  const repoRoot = resolve(cwd, '..')
  const envFiles = [
    join(cwd, '.env.local'),
    join(cwd, '.env'),
    join(repoRoot, '.env.local'),
    join(repoRoot, '.env'),
  ]
  const values = new Map()

  for (const filePath of envFiles) {
    if (!existsSync(filePath)) continue

    const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex === -1) continue

      const key = trimmed.slice(0, separatorIndex).trim()
      if (!key || values.has(key)) continue

      const rawValue = trimmed.slice(separatorIndex + 1).trim()
      values.set(key, {
        value: rawValue.replace(/^['"]|['"]$/g, ''),
        source: filePath,
      })
    }
  }

  return { envFiles, values }
}

export function envValue(localEnv, name) {
  if (process.env[name]) return { value: process.env[name], source: 'process.env' }
  return localEnv.values.get(name) ?? { value: '', source: null }
}

export function requiredEnv(localEnv, name) {
  const { value } = envValue(localEnv, name)
  if (!value) {
    console.error(`Missing ${name}. Set it in the shell or in web/.env.local.`)
    process.exit(1)
  }
  return value
}
