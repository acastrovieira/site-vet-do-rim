export interface ReservationErrorMapping {
  status: 400 | 401 | 404 | 409 | 429 | 500
  error: string
  code:
    | 'VALIDATION'
    | 'UNAUTHENTICATED'
    | 'NOT_FOUND'
    | 'TENANT_NOT_READY'
    | 'RESERVATION_LIMIT'
    | 'STATE_CONFLICT'
    | 'DATABASE'
}

/**
 * Mapeia as mensagens de erro controladas de `private.reserve_laudo_upload`
 * (migration 20260718120000_laudo_upload_reservation.sql, Tarefa 2.5 —
 * AUDIT-001 Fase 2) para respostas HTTP publicas. Nunca repassa a mensagem
 * bruta do Postgres ao cliente.
 */
export function mapReserveLaudoUploadError(message: string | undefined | null): ReservationErrorMapping {
  const value = message ?? ''

  if (value.includes('pet_not_found')) {
    return { status: 404, error: 'Paciente nao encontrado.', code: 'NOT_FOUND' }
  }
  if (value.includes('tenant_not_ready')) {
    return {
      status: 409,
      error: 'Esta clinica ainda nao esta pronta para reservar laudos.',
      code: 'TENANT_NOT_READY',
    }
  }
  if (value.includes('reservation_limit_exceeded')) {
    return {
      status: 429,
      error: 'Limite de reservas pendentes para este paciente foi atingido. Conclua ou aguarde antes de tentar novamente.',
      code: 'RESERVATION_LIMIT',
    }
  }
  if (value.includes('unauthenticated')) {
    return { status: 401, error: 'Sessao expirada. Faca login novamente.', code: 'UNAUTHENTICATED' }
  }
  if (value.includes('invalid_request')) {
    return { status: 400, error: 'Paciente invalido.', code: 'VALIDATION' }
  }

  return { status: 500, error: 'Nao foi possivel reservar o envio do laudo agora.', code: 'DATABASE' }
}

/**
 * Mapeia as mensagens de erro controladas de `private.abandon_laudo_upload`
 * (mesma migration) para respostas HTTP publicas.
 */
export function mapAbandonLaudoUploadError(message: string | undefined | null): ReservationErrorMapping {
  const value = message ?? ''

  if (value.includes('laudo_not_found')) {
    return { status: 404, error: 'Laudo nao encontrado.', code: 'NOT_FOUND' }
  }
  if (value.includes('tenant_not_ready')) {
    return {
      status: 409,
      error: 'Esta clinica ainda nao esta pronta para esta operacao.',
      code: 'TENANT_NOT_READY',
    }
  }
  if (value.includes('invalid_laudo_state')) {
    return {
      status: 409,
      error: 'Este laudo ja avancou de etapa e nao pode mais ser descartado por aqui.',
      code: 'STATE_CONFLICT',
    }
  }
  if (value.includes('unauthenticated')) {
    return { status: 401, error: 'Sessao expirada. Faca login novamente.', code: 'UNAUTHENTICATED' }
  }
  if (value.includes('invalid_request')) {
    return { status: 400, error: 'Laudo invalido.', code: 'VALIDATION' }
  }

  return { status: 500, error: 'Nao foi possivel desistir do envio do laudo agora.', code: 'DATABASE' }
}
