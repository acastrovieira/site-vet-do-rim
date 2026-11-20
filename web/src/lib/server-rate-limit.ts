import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { recordSecurityEvent } from './security-telemetry.ts'

export const CLINICAL_RATE_LIMIT_SCOPES = {
  reserve: 'laudo_reserve',
  abandon: 'laudo_abandon',
  localExtraction: 'laudo_local_extraction',
  aiParse: 'laudo_ai_parse',
  export: 'lab_export',
  petsMutation: 'pets_mutation',
  tutoresMutation: 'tutores_mutation',
  profileMutation: 'profile_mutation',
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

  if (error || !result || typeof result.allowed !== 'boolean') {
    recordSecurityEvent({
      event: 'rate_limit_unavailable',
      status: 503,
      layer: 'rate_limit_db',
      scope,
      code: 'RATE_LIMIT_UNAVAILABLE',
      degraded: scope === 'lab_export',
    })
    return { state: 'unavailable' }
  }
  if (result.allowed) return { state: 'allowed' }

  const retryAfterSeconds = typeof result.retry_after_seconds === 'number'
    && Number.isFinite(result.retry_after_seconds)
    ? Math.max(1, Math.ceil(result.retry_after_seconds))
    : 1
  recordSecurityEvent({
    event: 'rate_limit_exceeded',
    status: 429,
    layer: 'rate_limit_db',
    scope,
    code: 'RATE_LIMITED',
    retryAfterSeconds,
  })
  return { state: 'limited', retryAfterSeconds }
}
