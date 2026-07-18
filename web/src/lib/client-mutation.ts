import { isUuid } from './identifiers.ts'

export interface ClientMutationResult {
  ok: boolean
  id?: string
  code: string
  error?: string
  status?: number
}

interface RequestJsonOptions {
  fetcher?: typeof fetch
  method?: 'POST' | 'PATCH'
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 15_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Envia uma mutação JSON sem deixar falhas de rede, timeout ou respostas não JSON
 * escaparem para o event handler do formulário.
 */
export async function requestJsonMutation(
  url: string,
  payload: unknown,
  { fetcher = fetch, method = 'POST', timeoutMs = DEFAULT_TIMEOUT_MS }: RequestJsonOptions = {},
): Promise<ClientMutationResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetcher(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    let data: unknown
    try {
      data = await response.json()
    } catch {
      return {
        ok: false,
        code: 'INVALID_RESPONSE',
        status: response.status,
      }
    }

    if (!isRecord(data) || typeof data.ok !== 'boolean') {
      return {
        ok: false,
        code: 'INVALID_RESPONSE',
        status: response.status,
      }
    }

    if (!response.ok || !data.ok) {
      return {
        ok: false,
        code: typeof data.code === 'string' ? data.code : 'REQUEST_FAILED',
        error: typeof data.error === 'string' ? data.error : undefined,
        status: response.status,
      }
    }

    if (!isUuid(data.id)) {
      return {
        ok: false,
        code: 'INVALID_RESPONSE',
        status: response.status,
      }
    }

    return {
      ok: true,
      id: data.id,
      code: 'OK',
      status: response.status,
    }
  } catch (error) {
    return {
      ok: false,
      code: error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK',
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Indica que o cliente não consegue provar se a mutação foi ou não
 * confirmada pelo servidor. Reenviar imediatamente nesses casos pode duplicar
 * um cadastro enquanto a API ainda não possui idempotência transacional.
 */
export function isMutationOutcomeAmbiguous(result: ClientMutationResult): boolean {
  if (result.ok) return false

  return result.code === 'TIMEOUT'
    || result.code === 'NETWORK'
    || result.code === 'INVALID_RESPONSE'
    || (typeof result.status === 'number' && result.status >= 500)
}

export function getMutationErrorCopy(
  result: ClientMutationResult,
  entityLabel: 'tutor' | 'paciente',
): { title: string; message: string } {
  if (isMutationOutcomeAmbiguous(result)) {
    const listLabel = entityLabel === 'tutor' ? 'tutores' : 'pacientes'
    return {
      title: 'Confirmação pendente',
      message: `Não foi possível confirmar se o cadastro foi concluído. Confira a lista de ${listLabel} antes de iniciar outra tentativa.`,
    }
  }

  if (result.code === 'UNAUTHENTICATED') {
    return {
      title: 'Sessão expirada',
      message: 'Entre novamente e repita o cadastro. Os dados preenchidos continuam no formulário.',
    }
  }

  if (result.code === 'RLS_DENIED' || result.code === 'FORBIDDEN') {
    return {
      title: 'Acesso não autorizado',
      message: `Sua conta não tem permissão para cadastrar este ${entityLabel}. Se o problema persistir, contate o suporte.`,
    }
  }

  if (result.code === 'AUTHORIZATION_UNAVAILABLE') {
    return {
      title: 'Autorização temporariamente indisponível',
      message: 'O cadastro foi bloqueado porque sua permissão não pôde ser confirmada. Aguarde e tente novamente.',
    }
  }

  if (result.code === 'VALIDATION') {
    return {
      title: 'Revise os dados informados',
      message: `Um ou mais dados do ${entityLabel} não foram aceitos. Corrija os campos e tente novamente.`,
    }
  }

  return {
    title: `Erro ao salvar ${entityLabel}`,
    message: 'Não foi possível concluir o cadastro com segurança. Tente novamente em instantes.',
  }
}
