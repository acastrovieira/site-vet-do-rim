export type AppRole = 'admin' | 'vet' | 'tutor'

const AUTHENTICATED_PREFIXES = ['/lab', '/portal', '/dashboard', '/admin'] as const
const ROLE_RULES: ReadonlyArray<{
  prefix: string
  roles: readonly AppRole[]
}> = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/lab', roles: ['admin', 'vet'] },
  { prefix: '/portal', roles: ['tutor'] },
]

export function matchesRoutePrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function requiresAuthentication(pathname: string) {
  return AUTHENTICATED_PREFIXES.some((prefix) => matchesRoutePrefix(pathname, prefix))
}

export function requiredRoles(pathname: string) {
  return ROLE_RULES.find(({ prefix }) => matchesRoutePrefix(pathname, prefix))?.roles ?? null
}

export function roleHome(role: AppRole | null) {
  if (role === 'tutor') return '/portal'
  if (role === 'vet' || role === 'admin') return '/lab'
  return '/auth/login'
}

export function parseAppRole(value: unknown): AppRole | null {
  return value === 'admin' || value === 'vet' || value === 'tutor' ? value : null
}

export function isRoleAuthorized(pathname: string, role: AppRole | null) {
  const roles = requiredRoles(pathname)
  return roles === null || (role !== null && roles.includes(role))
}

/** Accepts only a same-origin path for post-authentication redirects. */
export function safeInternalRedirectPath(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return ''
  }

  try {
    const base = new URL('https://internal.invalid')
    const candidate = new URL(value, base)
    if (candidate.origin !== base.origin || candidate.hash) return ''
    const decodedPath = decodeURIComponent(candidate.pathname)
    if (
      decodedPath.startsWith('//') ||
      decodedPath.includes('\\') ||
      /[\u0000-\u001f\u007f]/.test(decodedPath)
    ) {
      return ''
    }
    if (matchesRoutePrefix(candidate.pathname, '/auth')) return ''
    return `${candidate.pathname}${candidate.search}`
  } catch {
    return ''
  }
}

export function isRoleAuthorizedForRedirect(
  value: string | null | undefined,
  role: AppRole | null,
) {
  const safePath = safeInternalRedirectPath(value)
  if (!safePath) return false

  const pathname = new URL(safePath, 'https://internal.invalid').pathname
  return isRoleAuthorized(pathname, role)
}
