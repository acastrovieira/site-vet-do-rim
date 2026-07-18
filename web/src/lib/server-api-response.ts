import { NextResponse } from 'next/server'
import type { ServerAuthorizationResult } from '@/lib/server-authorization'

const PRIVATE_API_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  Expires: '0',
  Pragma: 'no-cache',
} as const

/** Retorna JSON clinico sem permitir armazenamento compartilhado ou local. */
export function privateApiJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  for (const [name, value] of Object.entries(PRIVATE_API_HEADERS)) {
    headers.set(name, value)
  }

  return NextResponse.json(body, { ...init, headers })
}

export function authorizationFailureJson(
  failure: Extract<ServerAuthorizationResult, { ok: false }>,
) {
  const error = failure.code === 'UNAUTHENTICATED'
    ? 'Nao autenticado'
    : failure.code === 'FORBIDDEN'
      ? 'Acesso nao autorizado'
      : 'Nao foi possivel validar a autorizacao'

  return privateApiJson(
    { ok: false, error, code: failure.code },
    { status: failure.status },
  )
}
