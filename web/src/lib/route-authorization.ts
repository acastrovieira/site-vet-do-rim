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

/**
 * Decodifica percent-encoding iterativamente (ate 2 passes) e rejeita
 * sequencias invalidas, bytes de controle, barras invertidas ou traversal (`..`).
 * Retorna `null` em caso de path malformado/suspeito para permitir fail-closed.
 */
export function normalizePathname(pathname: string): string | null {
  if (!pathname || typeof pathname !== 'string') return null
  if (
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    pathname.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(pathname)
  ) {
    return null
  }

  let current = pathname
  for (let pass = 0; pass < 2; pass += 1) {
    let decoded: string
    try {
      decoded = decodeURIComponent(current)
    } catch {
      return null
    }

    if (
      decoded.startsWith('//') ||
      decoded.includes('\\') ||
      /[\u0000-\u001f\u007f]/.test(decoded)
    ) {
      return null
    }

    if (decoded === current) break
    current = decoded
  }

  const collapsed = current.replace(/\/+/g, '/')
  const segments = collapsed.split('/')
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return null
  }

  return collapsed
}

export function matchesRoutePrefix(pathname: string, prefix: string) {
  const normalized = normalizePathname(pathname)
  if (!normalized) return false
  return normalized === prefix || normalized.startsWith(`${prefix}/`)
}

export function requiresAuthentication(pathname: string) {
  const normalized = normalizePathname(pathname)
  if (!normalized) return true
  return AUTHENTICATED_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  )
}

export function requiredRoles(pathname: string) {
  const normalized = normalizePathname(pathname)
  if (!normalized) return null
  return (
    ROLE_RULES.find(
      ({ prefix }) => normalized === prefix || normalized.startsWith(`${prefix}/`),
    )?.roles ?? null
  )
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
  if (normalizePathname(pathname) === null) return false
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
    const normalizedPath = normalizePathname(candidate.pathname)
    if (!normalizedPath) return ''
    if (
      normalizedPath === '/auth' ||
      normalizedPath.startsWith('/auth/')
    ) {
      return ''
    }
    return `${normalizedPath}${candidate.search}`
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
