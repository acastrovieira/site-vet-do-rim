import { NextResponse } from 'next/server'
import {
  hasValidBearerSecret,
  OPERATIONAL_NO_STORE_HEADERS,
} from '@/lib/operational-health'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Guarda de compatibilidade do antigo cron de descarte.
 *
 * O endpoint permanece para que um agendamento antigo ainda ativo falhe de
 * forma segura: autentica a chamada e confirma que nenhuma mutação ocorreu.
 * Não consulta banco, não usa service role e não remove objetos. O prazo e o
 * workflow de retenção/purge dependem de aprovação humana (ADR-003).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.length < 32) {
    return NextResponse.json(
      { ok: false, message: 'CRON_SECRET não configurado.' },
      { status: 503, headers: OPERATIONAL_NO_STORE_HEADERS },
    )
  }

  if (!hasValidBearerSecret(request.headers.get('authorization'), cronSecret)) {
    return new NextResponse('Unauthorized', { status: 401, headers: OPERATIONAL_NO_STORE_HEADERS })
  }

  return NextResponse.json(
    {
      ok: true,
      message: 'Preservação ativa; nenhum PDF foi removido.',
      policy: 'preservation_hold_pending_retention_policy',
      deleted: 0,
    },
    { status: 200, headers: OPERATIONAL_NO_STORE_HEADERS },
  )
}
