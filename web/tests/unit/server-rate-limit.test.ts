import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CLINICAL_RATE_LIMIT_SCOPES,
  consumeClinicalRateLimit,
} from '../../src/lib/server-rate-limit.ts'

test('distributed clinical limiter accepts only the fixed RPC scope and handles responses fail-closed', async () => {
  const calls: unknown[] = []
  const client = {
    rpc: async (...args: unknown[]) => {
      calls.push(args)
      return { data: [{ allowed: false, retry_after_seconds: 12.2 }], error: null }
    },
  }
  assert.deepEqual(
    await consumeClinicalRateLimit(client as never, CLINICAL_RATE_LIMIT_SCOPES.reserve),
    { state: 'limited', retryAfterSeconds: 13 },
  )
  assert.deepEqual(calls, [['consume_clinical_rate_limit', { p_scope: 'laudo_reserve' }]])

  const allowedClient = { rpc: async () => ({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null }) }
  assert.deepEqual(
    await consumeClinicalRateLimit(allowedClient as never, CLINICAL_RATE_LIMIT_SCOPES.export),
    { state: 'allowed' },
  )

  const unavailableClient = { rpc: async () => ({ data: null, error: { code: 'PGRST202' } }) }
  assert.deepEqual(
    await consumeClinicalRateLimit(unavailableClient as never, CLINICAL_RATE_LIMIT_SCOPES.localExtraction),
    { state: 'unavailable' },
  )
})
