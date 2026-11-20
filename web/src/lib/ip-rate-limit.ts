import { createHash, randomBytes } from 'node:crypto'
import { recordSecurityEvent } from './security-telemetry.ts'

const EPHEMERAL_SALT = randomBytes(16)
const MAX_BUCKETS = 2000

const buckets = new Map<string, { count: number; resetAt: number }>()

function extractClientIp(request: Request): string {
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  return 'unknown'
}

function hashKey(scope: string, ip: string): string {
  return createHash('sha256')
    .update(EPHEMERAL_SALT)
    .update(':')
    .update(scope)
    .update(':')
    .update(ip)
    .digest('hex')
}

function pruneBuckets(now: number) {
  if (buckets.size < MAX_BUCKETS) return
  for (const [key, entry] of buckets.entries()) {
    if (now >= entry.resetAt) buckets.delete(key)
  }
  while (buckets.size >= MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value
    if (oldestKey === undefined) break
    buckets.delete(oldestKey)
  }
}

export function checkIpRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now()
  pruneBuckets(now)

  const key = hashKey(scope, extractClientIp(request))
  const current = buckets.get(key)

  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    recordSecurityEvent({
      event: 'rate_limit_exceeded',
      status: 429,
      layer: 'rate_limit_ip',
      scope,
      code: 'IP_RATE_LIMITED',
      retryAfterSeconds,
    })
    return {
      allowed: false,
      retryAfterSeconds,
    }
  }

  current.count += 1
  return { allowed: true }
}

export function resetIpRateLimitForTests() {
  buckets.clear()
}
