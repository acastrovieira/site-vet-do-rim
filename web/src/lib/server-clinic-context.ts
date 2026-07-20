import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClinicMembershipRole, Database } from '../types/database.ts'

type ServerSupabaseClient = SupabaseClient<Database>

export interface ActiveClinicContext {
  clinicId: string
  membershipRole: ClinicMembershipRole
}

/**
 * Resolve a clinica ativa do usuario autenticado a partir de
 * `clinic_memberships` (fonte de autorizacao por clinica do ADR-001), nao de
 * `profiles.role`.
 *
 * Contrato Fase 1.5 (docs/architecture/fase1-tenancy-implementation-spec.md
 * secao 4) — preparar a aplicacao para escrever `clinic_id` enquanto as
 * policies globais legadas ainda vigoram, sem quebrar quando o `enforce`
 * (fora deste lote) ligar as policies de membership:
 *
 * - 0 memberships ativas -> null. Cobre tanto o usuario sem clinica quanto o
 *   estado pre-backfill remoto (colunas existem, mas a tabela de memberships
 *   ainda nao foi populada la fora). Chamadores devem tratar null como "sem
 *   contexto de clinica" e cair no comportamento legado (sem filtro), nunca
 *   como erro.
 * - 1 membership ativa -> resolvida automaticamente.
 * - N memberships ativas -> por ora, a primeira por `criado_em` ascendente
 *   (ordem de ingresso na clinica). TODO(seletor-de-clinica): quando existir
 *   selecao explicita de clinica na UI/sessao, trocar por um parametro
 *   `preferredClinicId` e devolver um estado ambiguo quando ausente (ver a
 *   assinatura mais rica descrita na spec, secao 4, para `resolveActiveClinic`
 *   com codigos AMBIGUOUS/409). Esta funcao fica deliberadamente simples
 *   nesta fase porque o app ainda nao apresenta esse seletor.
 *
 * Sem cache: cada chamada consulta o banco. Memberships podem ser revogadas
 * a qualquer momento e a decisao de tenant nao pode sobreviver a requisicao.
 */
export async function resolveActiveClinic(
  supabase: ServerSupabaseClient,
  userId: string,
): Promise<ActiveClinicContext | null> {
  const { data, error } = await supabase
    .from('clinic_memberships')
    .select('clinic_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('criado_em', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  return { clinicId: data.clinic_id, membershipRole: data.role }
}
