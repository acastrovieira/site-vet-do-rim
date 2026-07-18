export const RECOVERY_COOKIE_NAME = 'vetdorim_recovery_verified'
export const RECOVERY_COOKIE_VALUE = '1'
export const RECOVERY_COOKIE_MAX_AGE_SECONDS = 10 * 60
export const RECOVERY_DESTINATIONS = ['/lab', '/portal'] as const

export type RecoveryDestination = (typeof RECOVERY_DESTINATIONS)[number]

export function isVerifiedRecoveryExchange(value: unknown) {
  return value === 'recovery'
}

export function recoveryCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: isProduction,
    path: '/auth/redefinir-senha',
    maxAge: RECOVERY_COOKIE_MAX_AGE_SECONDS,
  }
}

export function expiredRecoveryCookieOptions(isProduction: boolean) {
  return {
    ...recoveryCookieOptions(isProduction),
    maxAge: 0,
  }
}

export function isRecoveryDestination(value: unknown): value is RecoveryDestination {
  return typeof value === 'string'
    && RECOVERY_DESTINATIONS.some((destination) => destination === value)
}

export function isRecoveryCompletionPayload(
  value: unknown,
): value is { ok: true; redirectTo: RecoveryDestination } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const payload = value as Record<string, unknown>
  return payload.ok === true && isRecoveryDestination(payload.redirectTo)
}
