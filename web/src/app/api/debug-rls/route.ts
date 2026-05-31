import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/debug-rls
 * Rota temporária de diagnóstico — testa INSERT nas tabelas tutores e pets.
 * Remove após diagnóstico.
 */
export async function GET() {
  const supabase = await createClient()

  // Verifica usuário logado
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({
      ok: false,
      step: 'auth',
      error: authError?.message ?? 'Usuário não autenticado',
      userId: null,
    }, { status: 401 })
  }

  // Testa INSERT em tutores
  const testNome = `DEBUG_TEST_${Date.now()}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tutorData, error: tutorError } = await (supabase as any)
    .from('tutores')
    .insert({ nome: testNome, telefone: '99999-9999' })
    .select('id, nome')
    .single()

  if (tutorError) {
    return NextResponse.json({
      ok: false,
      step: 'insert_tutor',
      userId: user.id,
      error: {
        message: tutorError.message,
        details: tutorError.details,
        hint: tutorError.hint,
        code: tutorError.code,
      },
    }, { status: 500 })
  }

  // Limpa o registro de teste
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('tutores').delete().eq('id', tutorData.id)

  return NextResponse.json({
    ok: true,
    userId: user.id,
    tutorInserido: tutorData,
    mensagem: 'INSERT em tutores funcionou corretamente. RLS OK.',
  })
}
