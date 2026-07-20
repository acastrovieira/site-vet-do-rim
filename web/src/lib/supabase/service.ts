import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Cliente Supabase com service_role, para uso EXCLUSIVAMENTE server-side
 * (rotas de API em runtime Node.js). NUNCA importar em componentes
 * 'use client' nem expor a chave via NEXT_PUBLIC_*.
 *
 * Uso atual (AUDIT-001 Fase 2, Tarefa 2.5): remover o objeto de Storage apos
 * private.abandon_laudo_upload confirmar a compensacao no banco. O contrato
 * de Storage (docs/architecture/drafts/laudos-ia/claim-finalize-contract.md,
 * secao 8) exige que o "cliente privilegiado" use a API de Storage — nunca
 * SQL direto em storage.objects, que deixaria o objeto binario orfao no
 * backend de armazenamento sem trilha alcancavel.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL nao configurados nesta instancia.')
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
