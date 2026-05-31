import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/tutores
 * Cria um novo tutor. Retorna { ok, id } ou { ok: false, error, code }.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Valida sessão
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado', code: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const body = await request.json() as {
      nome: string
      telefone: string
      email: string | null
      cpf: string | null
      cep: string | null
      endereco: string | null
      cidade: string | null
      estado: string | null
    }

    const { nome, telefone } = body
    if (!nome?.trim() || !telefone?.trim()) {
      return NextResponse.json({ ok: false, error: 'Nome e telefone são obrigatórios', code: 'VALIDATION' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('tutores')
      .insert({
        nome: nome.trim(),
        telefone: telefone.trim(),
        email: body.email ?? null,
        cpf: body.cpf ?? null,
        cep: body.cep ?? null,
        endereco: body.endereco ?? null,
        cidade: body.cidade ?? null,
        estado: body.estado ?? null,
      })
      .select('id')
      .single() as { data: { id: string } | null; error: { message: string; code: string; details: string; hint: string } | null }

    if (error || !data) {
      console.error('[POST /api/tutores]', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        userId: user.id,
      })

      // RLS denial: code 42501 ou message contains "row-level"
      const isRLS = error?.code === '42501' || error?.message?.toLowerCase().includes('row-level')
      return NextResponse.json(
        {
          ok: false,
          error: error?.message ?? 'Erro desconhecido',
          code: isRLS ? 'RLS_DENIED' : (error?.code ?? 'UNKNOWN'),
          hint: error?.hint ?? null,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, id: data.id })
  } catch (err) {
    console.error('[POST /api/tutores] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Erro interno inesperado', code: 'INTERNAL' }, { status: 500 })
  }
}
