import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface Params {
  params: Promise<{ id: string }>
}

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
  if (value === null) return null
  if (typeof value !== 'string') throw new Error(`${field} invalido`)
  return value.trim() || null
}

function optionalNumber(value: unknown, field: string, min: number, max: number) {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${field} invalido`)
  }
  return value
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    if (!UUID_RE.test(id)) {
      return badRequest('ID de paciente invalido')
    }

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Nao autenticado', code: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const body = await request.json() as {
      nome?: string
      tutor_id?: string
      especie?: string
      raca?: string | null
      idade_anos?: number | null
      idade_meses?: number | null
      peso_atual?: number | null
      status_paciente?: string
    }

    const updates: {
      nome?: string
      tutor_id?: string
      especie?: string
      raca?: string | null
      idade_anos?: number | null
      idade_meses?: number | null
      peso_atual?: number | null
      status_paciente?: string
    } = {}

    if (body.nome !== undefined) {
      updates.nome = requiredString(body.nome, 'Nome')
    }

    if (body.tutor_id !== undefined) {
      const tutorId = requiredString(body.tutor_id, 'Tutor')
      if (!UUID_RE.test(tutorId)) return badRequest('Tutor invalido')
      updates.tutor_id = tutorId
    }

    if (body.especie !== undefined) {
      const especie = requiredString(body.especie, 'Especie').toLowerCase()
      if (!ESPECIES.has(especie)) return badRequest('Especie invalida')
      updates.especie = especie
    }

    if (body.raca !== undefined) updates.raca = optionalString(body.raca, 'Raca')
    if (body.idade_anos !== undefined) updates.idade_anos = optionalNumber(body.idade_anos, 'Idade em anos', 0, 40)
    if (body.idade_meses !== undefined) updates.idade_meses = optionalNumber(body.idade_meses, 'Idade em meses', 0, 11)
    if (body.peso_atual !== undefined) updates.peso_atual = optionalNumber(body.peso_atual, 'Peso atual', 0.01, 250)
    if (body.status_paciente !== undefined) {
      const status = requiredString(body.status_paciente, 'Status').toLowerCase()
      if (!STATUS.has(status)) return badRequest('Status invalido')
      updates.status_paciente = status
    }

    if (Object.keys(updates).length === 0) {
      return badRequest('Nenhum campo para atualizar')
    }

    const { data, error } = await supabase
      .from('pets')
      .update(updates)
      .eq('id', id)
      .select('id')
      .single()

    if (error || !data) {
      console.error('[PATCH /api/pets/:id]', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        userId: user.id,
        petId: id,
      })

      const isRLS = error?.code === '42501' || error?.message?.toLowerCase().includes('row-level')
      const isNotFound = error?.code === 'PGRST116'
      const isConstraint = error?.code === '23503' || error?.code === '23514' || error?.code === '22P02'
      return NextResponse.json(
        {
          ok: false,
          error: isRLS
            ? 'Permissao insuficiente para atualizar paciente.'
            : isNotFound
              ? 'Paciente nao encontrado.'
              : isConstraint
                ? 'Dados invalidos para atualizar paciente.'
                : 'Nao foi possivel atualizar o paciente.',
          code: isRLS ? 'RLS_DENIED' : isNotFound ? 'NOT_FOUND' : isConstraint ? 'VALIDATION' : (error?.code ?? 'UNKNOWN'),
        },
        { status: isRLS ? 403 : isNotFound ? 404 : isConstraint ? 400 : 500 }
      )
    }

    return NextResponse.json({ ok: true, id: data.id })
  } catch (err) {
    console.error('[PATCH /api/pets/:id] Unexpected error:', err)
    if (err instanceof SyntaxError) return badRequest('JSON invalido')
    if (err instanceof Error && (err.message.endsWith('invalido') || err.message.endsWith('obrigatorio'))) {
      return badRequest(err.message)
    }
    return NextResponse.json({ ok: false, error: 'Erro interno inesperado', code: 'INTERNAL' }, { status: 500 })
  }
}
