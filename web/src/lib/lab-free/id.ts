/**
 * Geração centralizada de IDs únicos para entidades do sistema.
 * Formato: PREFIX_UUIDv4
 *
 * @param prefix - Prefixo da entidade ('PAT' | 'EXAM')
 * @returns ID único no formato PREFIX_UUIDv4
 *
 * @example generateId('PAT') => 'PAT_550e8400-e29b-41d4-a716-446655440000'
 */
export function generateId(prefix: 'PAT' | 'EXAM'): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Secure random identifier generation is unavailable')
  }
  return `${prefix}_${globalThis.crypto.randomUUID()}`
}
