import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Database } from '@/types/database'

interface Params {
  params: Promise<{ id: string }>
}

type TutorUpdate = Database['public']['Tables']['tutores']['Update']

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UF_RE = /^[A-Z]{2}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error, code: 'VALIDATION' }, { status: 400 })
}

function optionalString(value: unknown, field: string) {
  if (value === null) return null
  if (typeof value !== 'string') throw new Error(`${field} invalido`)
  return value.trim() || null
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    if (!UUID_RE.test(id)) {
      return badRequest('ID de tutor invalido')
    }

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Nao autenticado', code: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const body = await request.json() as {
      nome?: string
      telefone?: string
      email?: string | null
      cpf?: string | null
      cep?: string | null
      endereco?: string | null
      cidade?: string | null
      estado?: string | null
    }

    const updates: TutorUpdate = {}

    if (body.nome !== undefined) {
      if (typeof body.nome !== 'string') return badRequest('Nome invalido')
      const nome = body.nome.trim()
      if (!nome) {
        return badRequest('Nome e obrigatorio')
      }
      updates.nome = nome
    }

    if (body.telefone !== undefined) {
      if (typeof body.telefone !== 'string') return badRequest('Telefone invalido')
      const telefone = body.telefone.trim()
      if (!telefone) {
        return badRequest('Telefone e obrigatorio')
      }
      updates.telefone = telefone
    }

    for (const field of ['email', 'cpf', 'cep', 'endereco', 'cidade', 'estado'] as const) {
      if (body[field] !== undefined) {
        const value = optionalString(body[field], field)
        if (field === 'email' && value && !EMAIL_RE.test(value)) return badRequest('Email invalido')
        if (field === 'estado' && value && !UF_RE.test(value)) return badRequest('Estado invalido')
        updates[field] = value
      }
    }

    if (Object.keys(updates).length === 0) {
      return badRequest('Nenhum campo para atualizar')
    }

    const { data, error } = await supabase
      .from('tutores')
      .update(updates)
      .eq('id', id)
      .select('id')
      .single()

    if (error || !data) {
      console.error('[PATCH /api/tutores/:id]', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        userId: user.id,
        tutorId: id,
      })

      const isRLS = error?.code === '42501' || error?.message?.toLowerCase().includes('row-level')
      const isNotFound = error?.code === 'PGRST116'
      return NextResponse.json(
        {
          ok: false,
          error: isRLS
            ? 'Permissao insuficiente para atualizar tutor.'
            : isNotFound
              ? 'Tutor nao encontrado.'
              : 'Nao foi possivel atualizar o tutor.',
          code: isRLS ? 'RLS_DENIED' : isNotFound ? 'NOT_FOUND' : (error?.code ?? 'UNKNOWN'),
        },
        { status: isRLS ? 403 : isNotFound ? 404 : 500 }
      )
    }

    return NextResponse.json({ ok: true, id: data.id })
  } catch (err) {
    console.error('[PATCH /api/tutores/:id] Unexpected error:', err)
    if (err instanceof SyntaxError) return badRequest('JSON invalido')
    if (err instanceof Error && err.message.endsWith('invalido')) return badRequest(err.message)
    return NextResponse.json({ ok: false, error: 'Erro interno inesperado', code: 'INTERNAL' }, { status: 500 })
  }
}
