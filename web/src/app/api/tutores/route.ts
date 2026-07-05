import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UF_RE = /^[A-Z]{2}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Nao autenticado', code: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const body = await request.json() as {
      nome?: unknown
      telefone?: unknown
      email?: unknown
      cpf?: unknown
      cep?: unknown
      endereco?: unknown
      cidade?: unknown
      estado?: unknown
    }

    const nome = requiredString(body.nome, 'Nome')
    const telefone = requiredString(body.telefone, 'Telefone')
    const email = optionalString(body.email, 'Email')
    const cpf = optionalString(body.cpf, 'CPF')
    const cep = optionalString(body.cep, 'CEP')
    const endereco = optionalString(body.endereco, 'Endereco')
    const cidade = optionalString(body.cidade, 'Cidade')
    const estado = optionalString(body.estado, 'Estado')

    if (email && !EMAIL_RE.test(email)) return badRequest('Email invalido')
    if (estado && !UF_RE.test(estado)) return badRequest('Estado invalido')

    const { data, error } = await supabase
      .from('tutores')
      .insert({
        nome,
        telefone,
        email,
        cpf,
        cep,
        endereco,
        cidade,
        estado,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[POST /api/tutores]', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        userId: user.id,
      })

      const isRLS = error?.code === '42501' || error?.message?.toLowerCase().includes('row-level')
      return NextResponse.json(
        {
          ok: false,
          error: isRLS ? 'Permissao insuficiente para criar tutor.' : 'Nao foi possivel criar o tutor.',
          code: isRLS ? 'RLS_DENIED' : (error?.code ?? 'UNKNOWN'),
        },
        { status: isRLS ? 403 : 500 }
      )
    }

    return NextResponse.json({ ok: true, id: data.id })
  } catch (err) {
    console.error('[POST /api/tutores] Unexpected error:', err)
    if (err instanceof SyntaxError) return badRequest('JSON invalido')
    if (err instanceof Error && (err.message.endsWith('invalido') || err.message.endsWith('obrigatorio'))) {
      return badRequest(err.message)
    }
    return NextResponse.json({ ok: false, error: 'Erro interno inesperado', code: 'INTERNAL' }, { status: 500 })
  }
}
