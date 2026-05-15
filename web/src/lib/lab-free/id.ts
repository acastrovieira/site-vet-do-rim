/**
 * Geração centralizada de IDs únicos para entidades do sistema.
 * Formato: PREFIX_timestamp_random
 *
 * @param prefix - Prefixo da entidade ('PAT' | 'EXAM')
 * @returns ID único no formato PREFIX_timestamp_RANDOM
 *
 * @example generateId('PAT') => 'PAT_1234567890_XYZAB'
 */
export function generateId(prefix: 'PAT' | 'EXAM'): string {
  const random = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `${prefix}_${Date.now()}_${random}`
}
