import { recordSecurityEvent, sanitizeTelemetryRoutePath } from './security-telemetry.ts'

const DEFAULT_MAX_JSON_BYTES = 32 * 1024

export class ApiValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiValidationError'
  }
}

export class ApiUnsupportedMediaTypeError extends ApiValidationError {
  constructor() {
    super('Content-Type deve ser application/json')
    this.name = 'ApiUnsupportedMediaTypeError'
  }
}

export class ApiPayloadTooLargeError extends ApiValidationError {
  constructor() {
    super('Corpo da requisicao excede o limite permitido')
    this.name = 'ApiPayloadTooLargeError'
  }
}

export class ApiCsrfError extends ApiValidationError {
  constructor(message = 'Origem da requisicao nao autorizada') {
    super(message)
    this.name = 'ApiCsrfError'
  }
}

function resolveExpectedHost(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const hostHeader = request.headers.get('host')?.trim()
  if (forwardedHost) return forwardedHost.toLowerCase()
  if (hostHeader) return hostHeader.toLowerCase()
  try {
    return new URL(request.url).host.toLowerCase()
  } catch {
    return ''
  }
}

function rejectCsrf(request: Request): never {
  recordSecurityEvent({
    event: 'csrf_rejected',
    status: 403,
    layer: 'api',
    scope: sanitizeTelemetryRoutePath(request.url),
    code: 'CSRF_REJECTED',
  })
  throw new ApiCsrfError()
}

function parseHeaderHost(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).host.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Garante que mutacoes baseadas em cookie partam apenas da propria origem.
 * Bloqueia `Sec-Fetch-Site: cross-site` e `Origin`/`Referer` divergentes.
 */
export function assertSameOriginMutation(request: Request) {
  const secFetchSite = request.headers.get('sec-fetch-site')?.trim().toLowerCase()
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    rejectCsrf(request)
  }

  const expectedHost = resolveExpectedHost(request)
  const origin = request.headers.get('origin')?.trim()
  if (origin) {
    if (origin.toLowerCase() === 'null' || !expectedHost || parseHeaderHost(origin) !== expectedHost) {
      rejectCsrf(request)
    }
    return
  }

  const referer = request.headers.get('referer')?.trim()
  if (referer) {
    if (!expectedHost || parseHeaderHost(referer) !== expectedHost) {
      rejectCsrf(request)
    }
  }
}

async function readBoundedRequestText(request: Request, maxBytes: number) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new ApiValidationError('Limite de corpo invalido')
  }
  if (!request.body) return ''

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let totalBytes = 0
  let raw = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw new ApiPayloadTooLargeError()
      }
      raw += decoder.decode(value, { stream: true })
    }
    raw += decoder.decode()
    return raw
  } finally {
    reader.releaseLock()
  }
}

export async function readJsonObject(
  request: Request,
  maxBytes = DEFAULT_MAX_JSON_BYTES,
): Promise<Record<string, unknown>> {
  const mediaType = request.headers
    .get('content-type')
    ?.split(';', 1)[0]
    .trim()
    .toLowerCase()
  if (
    mediaType !== 'application/json' &&
    !(mediaType?.startsWith('application/') && mediaType.endsWith('+json'))
  ) {
    throw new ApiUnsupportedMediaTypeError()
  }

  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const declaredBytes = Number(contentLength)
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      throw new ApiPayloadTooLargeError()
    }
  }

  const raw = await readBoundedRequestText(request, maxBytes)

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new ApiValidationError('JSON invalido')
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiValidationError('JSON deve ser um objeto')
  }

  return value as Record<string, unknown>
}

export function assertAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
) {
  const allowed = new Set(allowedKeys)
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new ApiValidationError('JSON contem campos nao permitidos')
  }
}

export function requiredText(
  value: unknown,
  field: string,
  maxLength: number,
) {
  if (typeof value !== 'string') throw new ApiValidationError(`${field} invalido`)
  const trimmed = value.trim()
  if (!trimmed) throw new ApiValidationError(`${field} e obrigatorio`)
  if (trimmed.length > maxLength) throw new ApiValidationError(`${field} excede o limite permitido`)
  return trimmed
}

export function optionalText(
  value: unknown,
  field: string,
  maxLength: number,
) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new ApiValidationError(`${field} invalido`)
  const trimmed = value.trim()
  if (trimmed.length > maxLength) throw new ApiValidationError(`${field} excede o limite permitido`)
  return trimmed || null
}

export function optionalNumber(
  value: unknown,
  field: string,
  min: number,
  max: number,
  { integer = false } = {},
) {
  if (value === null || value === undefined) return null
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new ApiValidationError(`${field} invalido`)
  }
  return value
}

export function safeErrorSummary(error: unknown) {
  if (!(error instanceof Error)) return { name: 'UnknownError' }
  return { name: error.name }
}
