import { relative } from 'node:path'

const PLACEHOLDER_MARKERS = [
  'dummy-',
  'example.',
  'project_ref',
  'replace-with',
  'placeholder',
]

export function parseRemoteReadinessArgs(args) {
  const unknown = args.filter((arg) => arg !== '--remote')
  if (unknown.length > 0) {
    throw new Error(`Unknown argument: ${unknown[0]}`)
  }

  return { allowRemote: args.includes('--remote') }
}

export function isUsableReadinessValue(value) {
  if (!value || value.length > 16_384) return false
  const normalized = value.toLowerCase()
  return !PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker))
}

export function getRemoteReadinessTimeoutMs(value, fallback = 5_000) {
  if (!value || !/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return parsed >= 1_000 && parsed <= 15_000 ? parsed : fallback
}

export function safeEnvSourceLabel(source, cwd = process.cwd()) {
  if (!source) return 'nao definido'
  if (source === 'process.env') return source

  const label = relative(cwd, source).replaceAll('\\', '/')
  return label.startsWith('../') ? `repo/${label.slice(3)}` : label
}

export function safeErrorType(error) {
  return error instanceof Error && /^[A-Za-z][A-Za-z0-9]*$/.test(error.name)
    ? error.name
    : 'UnknownError'
}
