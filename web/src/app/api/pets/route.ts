import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/pets
 * Cria um novo paciente (pet). Retorna { ok, id } ou { ok: false, error, code }.
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
      tutor_id: string
      especie: string
      raca: string | null
      idade_anos: number | null
      idade_meses: number | null
      peso_atual: number | null
      status_paciente: string
    }

    const { nome, tutor_id, especie } = body
    if (!nome?.trim() || !tutor_id?.trim() || !especie?.trim()) {
      return NextResponse.json({ ok: false, error: 'Nome, tutor e espécie são obrigatórios', code: 'VALIDATION' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('pets')
      .insert({
        nome: nome.trim(),
        tutor_id: tutor_id.trim(),
        especie: especie.trim(),
        raca: body.raca ?? null,
        idade_anos: body.idade_anos ?? null,
        idade_meses: body.idade_meses ?? null,
        peso_atual: body.peso_atual ?? null,
        status_paciente: body.status_paciente ?? 'ativo',
      })
      .select('id')
      .single() as { data: { id: string } | null; error: { message: string; code: string; details: string; hint: string } | null }

    if (error || !data) {
      console.error('[POST /api/pets]', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        userId: user.id,
      })

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
    console.error('[POST /api/pets] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Erro interno inesperado', code: 'INTERNAL' }, { status: 500 })
  }
}
