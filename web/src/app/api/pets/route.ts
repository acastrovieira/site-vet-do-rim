import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ESPECIES = new Set(['canino', 'felino', 'equino', 'bovino', 'suino', 'ave', 'roedor', 'reptil', 'outro'])
const STATUS = new Set(['ativo', 'em_tratamento', 'alta', 'inativo', 'obito'])

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error, code: 'VALIDATION' }, { status: 400 })
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string') throw new Error(`${field} invalido`)
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${field} e obrigatorio`)
  return trimmed
}

function optionalString(value: unknown, field: string) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error(`${field} invalido`)
  return value.trim() || null
}

function optionalNumber(value: unknown, field: string, min: number, max: number) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${field} invalido`)
  }
  return value
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Nao autenticado', code: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const body = await request.json() as {
      nome?: unknown
      tutor_id?: unknown
      especie?: unknown
      raca?: unknown
      idade_anos?: unknown
      idade_meses?: unknown
      peso_atual?: unknown
      status_paciente?: unknown
    }

    const nome = requiredString(body.nome, 'Nome')
    const tutorId = requiredString(body.tutor_id, 'Tutor')
    const especie = requiredString(body.especie, 'Especie').toLowerCase()
    const raca = optionalString(body.raca, 'Raca')
    const idadeAnos = optionalNumber(body.idade_anos, 'Idade em anos', 0, 40)
    const idadeMeses = optionalNumber(body.idade_meses, 'Idade em meses', 0, 11)
    const pesoAtual = optionalNumber(body.peso_atual, 'Peso atual', 0.01, 250)
    const statusPaciente = body.status_paciente === undefined || body.status_paciente === null
      ? 'ativo'
      : requiredString(body.status_paciente, 'Status').toLowerCase()

    if (!UUID_RE.test(tutorId)) return badRequest('Tutor invalido')
    if (!ESPECIES.has(especie)) return badRequest('Especie invalida')
    if (!STATUS.has(statusPaciente)) return badRequest('Status invalido')

    const { data, error } = await supabase
      .from('pets')
      .insert({
        nome,
        tutor_id: tutorId,
        especie,
        raca,
        idade_anos: idadeAnos,
        idade_meses: idadeMeses,
        peso_atual: pesoAtual,
        status_paciente: statusPaciente,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[POST /api/pets]', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        userId: user.id,
      })

      const isRLS = error?.code === '42501' || error?.message?.toLowerCase().includes('row-level')
      const isConstraint = error?.code === '23503' || error?.code === '23514' || error?.code === '22P02'
      return NextResponse.json(
        {
          ok: false,
          error: isRLS
            ? 'Permissao insuficiente para criar paciente.'
            : isConstraint
              ? 'Dados invalidos para criar paciente.'
              : 'Nao foi possivel criar o paciente.',
          code: isRLS ? 'RLS_DENIED' : isConstraint ? 'VALIDATION' : (error?.code ?? 'UNKNOWN'),
        },
        { status: isRLS ? 403 : isConstraint ? 400 : 500 }
      )
    }

    return NextResponse.json({ ok: true, id: data.id })
  } catch (err) {
    console.error('[POST /api/pets] Unexpected error:', err)
    if (err instanceof SyntaxError) return badRequest('JSON invalido')
    if (err instanceof Error && (err.message.endsWith('invalido') || err.message.endsWith('obrigatorio'))) {
      return badRequest(err.message)
    }
    return NextResponse.json({ ok: false, error: 'Erro interno inesperado', code: 'INTERNAL' }, { status: 500 })
  }
}
