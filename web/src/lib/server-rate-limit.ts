import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const CLINICAL_RATE_LIMIT_SCOPES = {
  reserve: 'laudo_reserve',
  localExtraction: 'laudo_local_extraction',
  export: 'lab_export',
} as const

type ClinicalRateLimitScope = (typeof CLINICAL_RATE_LIMIT_SCOPES)[keyof typeof CLINICAL_RATE_LIMIT_SCOPES]

export type DistributedRateLimitResult =
  | { state: 'allowed' }
  | { state: 'limited'; retryAfterSeconds: number }
  | { state: 'unavailable' }

/** Consome o contador transacional sem enviar IDs ou dados clínicos à RPC. */
export async function consumeClinicalRateLimit(
  supabase: SupabaseClient<Database>,
  scope: ClinicalRateLimitScope,
): Promise<DistributedRateLimitResult> {
  const { data, error } = await supabase.rpc('consume_clinical_rate_limit', { p_scope: scope })
  const result = data?.[0]

  if (error || !result || typeof result.allowed !== 'boolean') return { state: 'unavailable' }
  if (result.allowed) return { state: 'allowed' }

  const retryAfterSeconds = typeof result.retry_after_seconds === 'number'
    && Number.isFinite(result.retry_after_seconds)
    ? Math.max(1, Math.ceil(result.retry_after_seconds))
    : 1
  return { state: 'limited', retryAfterSeconds }
}
