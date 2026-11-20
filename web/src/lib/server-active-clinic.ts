import {
  ACTIVE_CLINIC_COOKIE_NAME,
  parseActiveClinicCookieValue,
} from './active-clinic-cookie.ts'

/**
 * Le o cookie HttpOnly da clinica ativa fora de chamadas estaticas a `next/headers`
 * para manter os modulos de autorizacao importaveis nos testes unitarios Node.
 */
export async function readActiveClinicCookie(): Promise<string | null> {
  try {
    const { cookies } = await import('next/headers')
    const store = await cookies()
    return parseActiveClinicCookieValue(store.get(ACTIVE_CLINIC_COOKIE_NAME)?.value)
  } catch {
    return null
  }
}
