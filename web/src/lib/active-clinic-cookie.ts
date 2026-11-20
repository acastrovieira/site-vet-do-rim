import { isUuid } from './identifiers.ts'

export const ACTIVE_CLINIC_COOKIE_NAME = 'vetdorim_active_clinic'
export const ACTIVE_CLINIC_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export function parseActiveClinicCookieValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return isUuid(trimmed) ? trimmed : null
}

export function activeClinicCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction,
    path: '/',
    maxAge: ACTIVE_CLINIC_COOKIE_MAX_AGE_SECONDS,
  }
}

export function expiredActiveClinicCookieOptions(isProduction: boolean) {
  return {
    ...activeClinicCookieOptions(isProduction),
    maxAge: 0,
  }
}

/**
 * Redireciona rotas de detalhe por ID para a listagem correspondente ao trocar de
 * clinica ativa, evitando 404 ou estado obsoleto de outra clinica.
 */
export function resolvePostClinicSwitchPath(pathname: string): string | null {
  if (/^\/lab\/pacientes\/.+/.test(pathname)) return '/lab/pacientes'
  if (/^\/lab\/tutores\/.+/.test(pathname)) return '/lab/tutores'
  return null
}
