export const SECURITY_EVENT_TYPES = [
  'rate_limit_exceeded',
  'rate_limit_unavailable',
  'csrf_rejected',
  'authorization_unavailable',
  'authorization_forbidden',
  'proxy_invalid_path',
  'cron_auth_failed',
  'extraction_storage_mismatch',
  'rls_denied',
] as const

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number]

export type SecurityEventLayer =
  | 'proxy'
  | 'api'
  | 'rate_limit_ip'
  | 'rate_limit_db'
  | 'authz'
  | 'cron'

export type SecurityEventLogSeverity = 'warn' | 'error'
export type SecurityAlertSeverity = 'medium' | 'high' | 'critical'
export type SecurityHealthStatus = 'healthy' | 'elevated' | 'degraded'

export const SECURITY_TELEMETRY_WINDOW_MS = 15 * 60 * 1000
export const MAX_SCOPE_KEYS = 200
const MAX_TOP_SCOPES = 10

export const SECURITY_ALERT_THRESHOLDS: Record<
  SecurityEventType,
  { count: number; severity: SecurityAlertSeverity }
> = {
  extraction_storage_mismatch: { count: 1, severity: 'critical' },
  authorization_unavailable: { count: 3, severity: 'critical' },
  rate_limit_unavailable: { count: 3, severity: 'high' },
  csrf_rejected: { count: 5, severity: 'high' },
  cron_auth_failed: { count: 5, severity: 'high' },
  rls_denied: { count: 5, severity: 'high' },
  proxy_invalid_path: { count: 10, severity: 'medium' },
  authorization_forbidden: { count: 15, severity: 'medium' },
  rate_limit_exceeded: { count: 20, severity: 'medium' },
}

export type SecurityEventInput = {
  event: SecurityEventType
  status: number
  layer: SecurityEventLayer
  scope?: string
  code?: string
  severity?: SecurityEventLogSeverity
  retryAfterSeconds?: number
  degraded?: boolean
}

export type SecurityEventRecord = {
  event: SecurityEventType
  status: number
  layer: SecurityEventLayer
  scope: string
  timestamp: string
  code?: string
  retryAfterSeconds?: number
  degraded?: boolean
}

export type SecurityAlert = {
  event: SecurityEventType
  severity: SecurityAlertSeverity
  threshold: number
  count: number
  windowMs: number
}

export type SecurityTelemetrySnapshot = {
  status: SecurityHealthStatus
  windowMs: number
  startedAt: string
  timestamp: string
  totalEvents: number
  windowEvents: number
  byEvent: Record<SecurityEventType, { total: number; window: number }>
  topScopes: Array<{ scope: string; count: number; lastSeenAt: string }>
  activeAlerts: SecurityAlert[]
}

export type SecurityEventSink = (
  severity: SecurityEventLogSeverity,
  line: string,
  record: SecurityEventRecord,
) => void

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const LONG_NUMERIC_SEGMENT_RE = /(?<=^|\/)\d{4,}(?=$|\/)/g
const SAFE_ROUTE_PATH_RE = /^\/[a-zA-Z0-9_/:.-]{0,63}$/
const SAFE_SCOPE_RE = /^[a-zA-Z0-9_.:/-]{1,64}$/
const SAFE_CODE_RE = /^[A-Z0-9_]{1,64}$/
const SENSITIVE_SCOPE_MARKER_RE = /(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[@?=\s]|eyj|bearer)/i

const defaultSink: SecurityEventSink = (severity, line) => {
  if (severity === 'error') {
    console.error(line)
  } else {
    console.warn(line)
  }
}

function createEmptyEventCounts(): Record<SecurityEventType, number> {
  return {
    rate_limit_exceeded: 0,
    rate_limit_unavailable: 0,
    csrf_rejected: 0,
    authorization_unavailable: 0,
    authorization_forbidden: 0,
    proxy_invalid_path: 0,
    cron_auth_failed: 0,
    extraction_storage_mismatch: 0,
    rls_denied: 0,
  }
}

function createEmptyWindowBuckets(): Record<SecurityEventType, Map<number, number>> {
  return {
    rate_limit_exceeded: new Map(),
    rate_limit_unavailable: new Map(),
    csrf_rejected: new Map(),
    authorization_unavailable: new Map(),
    authorization_forbidden: new Map(),
    proxy_invalid_path: new Map(),
    cron_auth_failed: new Map(),
    extraction_storage_mismatch: new Map(),
    rls_denied: new Map(),
  }
}

let activeSink: SecurityEventSink = defaultSink
let startedAtMs = Date.now()
let totalByEvent = createEmptyEventCounts()
let windowBucketsByEvent = createEmptyWindowBuckets()
const scopeCounters = new Map<string, { count: number; lastSeenAtMs: number }>()

function defaultSeverityForEvent(event: SecurityEventType): SecurityEventLogSeverity {
  const alertSeverity = SECURITY_ALERT_THRESHOLDS[event].severity
  return alertSeverity === 'medium' ? 'warn' : 'error'
}

function pruneWindowBuckets(nowMs: number) {
  const cutoffSec = Math.floor((nowMs - SECURITY_TELEMETRY_WINDOW_MS) / 1000)
  for (const event of SECURITY_EVENT_TYPES) {
    const buckets = windowBucketsByEvent[event]
    for (const sec of buckets.keys()) {
      if (sec <= cutoffSec) {
        buckets.delete(sec)
      }
    }
  }
}

function recordScopeCounter(scope: string, nowMs: number) {
  const existing = scopeCounters.get(scope)
  if (existing) {
    existing.count += 1
    existing.lastSeenAtMs = nowMs
    return
  }

  if (scopeCounters.size >= MAX_SCOPE_KEYS) {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    for (const [key, entry] of scopeCounters.entries()) {
      if (entry.lastSeenAtMs < oldestTime) {
        oldestTime = entry.lastSeenAtMs
        oldestKey = key
      }
    }
    if (oldestKey !== null) {
      scopeCounters.delete(oldestKey)
    }
  }

  scopeCounters.set(scope, { count: 1, lastSeenAtMs: nowMs })
}

/** Redige IDs extensos e query strings de paths antes de logar ou agregar. */
export function sanitizeTelemetryRoutePath(rawUrlOrPath: string): string {
  const trimmed = rawUrlOrPath.trim()
  if (!trimmed) return 'unknown'

  let pathname = ''
  if (trimmed.startsWith('/')) {
    const queryIdx = trimmed.indexOf('?')
    const hashIdx = trimmed.indexOf('#')
    const cutIdx = [queryIdx, hashIdx].filter((idx) => idx >= 0).sort((a, b) => a - b)[0]
    pathname = cutIdx === undefined ? trimmed : trimmed.slice(0, cutIdx)
  } else {
    try {
      pathname = new URL(trimmed).pathname
    } catch {
      return 'unknown'
    }
  }

  if (!pathname.startsWith('/') || pathname.includes('..')) {
    return 'unknown'
  }

  const normalized = pathname
    .replace(UUID_RE, ':id')
    .replace(LONG_NUMERIC_SEGMENT_RE, ':id')

  return SAFE_ROUTE_PATH_RE.test(normalized) ? normalized : 'unknown'
}

/** Garante que escopos de telemetria nunca contenham PII, UUIDs, tokens ou query strings. */
export function sanitizeTelemetryScope(raw?: string): string {
  if (!raw) return 'unknown'
  const trimmed = raw.trim()
  if (!trimmed) return 'unknown'
  if (SENSITIVE_SCOPE_MARKER_RE.test(trimmed)) return 'redacted'
  return SAFE_SCOPE_RE.test(trimmed) ? trimmed : 'redacted'
}

/** Registra evento estruturado de segurança (allowlisted e livre de PII). */
export function recordSecurityEvent(input: SecurityEventInput): SecurityEventRecord {
  const nowMs = Date.now()
  pruneWindowBuckets(nowMs)

  const status = Number.isInteger(input.status) && input.status >= 100 && input.status <= 599
    ? input.status
    : 500
  const scope = sanitizeTelemetryScope(input.scope)
  const code = input.code && SAFE_CODE_RE.test(input.code) ? input.code : undefined
  const retryAfterSeconds = typeof input.retryAfterSeconds === 'number'
    && Number.isInteger(input.retryAfterSeconds)
    && input.retryAfterSeconds > 0
    ? input.retryAfterSeconds
    : undefined
  const degraded = typeof input.degraded === 'boolean' ? input.degraded : undefined

  const record: SecurityEventRecord = {
    event: input.event,
    status,
    layer: input.layer,
    scope,
    timestamp: new Date(nowMs).toISOString(),
    ...(code ? { code } : {}),
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    ...(degraded !== undefined ? { degraded } : {}),
  }

  totalByEvent[input.event] += 1
  const epochSec = Math.floor(nowMs / 1000)
  const buckets = windowBucketsByEvent[input.event]
  buckets.set(epochSec, (buckets.get(epochSec) ?? 0) + 1)
  recordScopeCounter(`${input.event}:${scope}`, nowMs)

  const logSeverity = input.severity ?? defaultSeverityForEvent(input.event)
  const line = `[security] event=${record.event} ${JSON.stringify(record)}`
  activeSink(logSeverity, line, record)

  return record
}

/** Consolida contadores agregados e alertas ativos da janela deslizante sem expor PII. */
export function getSecurityTelemetrySnapshot(now = Date.now()): SecurityTelemetrySnapshot {
  pruneWindowBuckets(now)

  const byEvent = {} as Record<SecurityEventType, { total: number; window: number }>
  const activeAlerts: SecurityAlert[] = []
  let totalEvents = 0
  let windowEvents = 0

  for (const event of SECURITY_EVENT_TYPES) {
    const total = totalByEvent[event]
    let windowCount = 0
    for (const count of windowBucketsByEvent[event].values()) {
      windowCount += count
    }

    byEvent[event] = { total, window: windowCount }
    totalEvents += total
    windowEvents += windowCount

    const threshold = SECURITY_ALERT_THRESHOLDS[event]
    if (windowCount >= threshold.count) {
      activeAlerts.push({
        event,
        severity: threshold.severity,
        threshold: threshold.count,
        count: windowCount,
        windowMs: SECURITY_TELEMETRY_WINDOW_MS,
      })
    }
  }

  let status: SecurityHealthStatus = 'healthy'
  if (activeAlerts.some((alert) => alert.severity === 'critical')) {
    status = 'degraded'
  } else if (activeAlerts.length > 0) {
    status = 'elevated'
  }

  const topScopes = [...scopeCounters.entries()]
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, MAX_TOP_SCOPES)
    .map(([scope, entry]) => ({
      scope,
      count: entry.count,
      lastSeenAt: new Date(entry.lastSeenAtMs).toISOString(),
    }))

  return {
    status,
    windowMs: SECURITY_TELEMETRY_WINDOW_MS,
    startedAt: new Date(startedAtMs).toISOString(),
    timestamp: new Date(now).toISOString(),
    totalEvents,
    windowEvents,
    byEvent,
    topScopes,
    activeAlerts,
  }
}

export function setSecurityEventSinkForTests(sink: SecurityEventSink | null) {
  activeSink = sink ?? defaultSink
}

export function resetSecurityTelemetryForTests() {
  startedAtMs = Date.now()
  totalByEvent = createEmptyEventCounts()
  windowBucketsByEvent = createEmptyWindowBuckets()
  scopeCounters.clear()
}
