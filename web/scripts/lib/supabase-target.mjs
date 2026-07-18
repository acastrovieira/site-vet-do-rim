import { envValue, requiredEnv } from './env-file.mjs'

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/

export function assertSupabaseTarget({
  projectRef,
  supabaseUrl,
  environment = '',
  mutationConfirmation = '',
  requireMutationConfirmation = false,
}) {
  if (!PROJECT_REF_PATTERN.test(projectRef)) {
    throw new Error('SUPABASE_PROJECT_REF must be an explicit 20-character project reference.')
  }

  let parsedUrl
  try {
    parsedUrl = new URL(supabaseUrl)
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid absolute URL.')
  }

  const expectedOrigin = `https://${projectRef}.supabase.co`
  if (parsedUrl.origin !== expectedOrigin || parsedUrl.pathname !== '/') {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must exactly match the explicit project reference (${expectedOrigin}).`,
    )
  }

  if (requireMutationConfirmation) {
    if (environment !== 'staging') {
      throw new Error('Remote E2E mutations are restricted to SUPABASE_ENVIRONMENT=staging.')
    }

    const expectedConfirmation = `CONFIRM_STAGING_MUTATION:${projectRef}`
    if (mutationConfirmation !== expectedConfirmation) {
      throw new Error(
        `Set SUPABASE_MUTATION_CONFIRMATION=${expectedConfirmation} to confirm the staging target.`,
      )
    }
  }

  return { projectRef, supabaseUrl: expectedOrigin }
}

export function explicitSupabaseTarget(localEnv, { mutation = false } = {}) {
  return assertSupabaseTarget({
    projectRef: requiredEnv(localEnv, 'SUPABASE_PROJECT_REF'),
    supabaseUrl: requiredEnv(localEnv, 'NEXT_PUBLIC_SUPABASE_URL'),
    environment: envValue(localEnv, 'SUPABASE_ENVIRONMENT').value,
    mutationConfirmation: envValue(localEnv, 'SUPABASE_MUTATION_CONFIRMATION').value,
    requireMutationConfirmation: mutation,
  })
}
