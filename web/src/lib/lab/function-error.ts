import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js'

const MAX_ERROR_BODY_BYTES = 16 * 1024

type JsonObject = Record<string, unknown>

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : null
}

async function readBoundedErrorJson(response: Response): Promise<JsonObject | null> {
  if (response.bodyUsed || !response.body) return null
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('application/json')) return null

  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ERROR_BODY_BYTES) return null

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > MAX_ERROR_BODY_BYTES) {
        await reader.cancel().catch(() => undefined)
        return null
      }
      chunks.push(value)
    }
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return asObject(JSON.parse(new TextDecoder().decode(bytes)))
  } catch {
    return null
  }
}

export interface LaudoFunctionFailure {
  serviceError: unknown
  status: number | null
  outcomeUnknown: boolean
}

/** Supports both the current HTTP-200 envelope and Supabase non-2xx errors. */
export async function resolveLaudoFunctionFailure(
  error: unknown,
  legacyData: unknown,
): Promise<LaudoFunctionFailure> {
  const legacyPayload = asObject(legacyData)

  if (error instanceof FunctionsHttpError) {
    const response = error.context instanceof Response ? error.context : null
    const payload = response ? await readBoundedErrorJson(response) : null
    const status = response?.status ?? null
    return {
      serviceError: payload?.error ?? legacyPayload?.error,
      status,
      outcomeUnknown: status === null || status >= 500,
    }
  }

  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    return { serviceError: undefined, status: null, outcomeUnknown: true }
  }

  return {
    serviceError: legacyPayload?.error,
    status: null,
    outcomeUnknown: error !== null && error !== undefined,
  }
}
