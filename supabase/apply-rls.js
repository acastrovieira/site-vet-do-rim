/**
 * Script de aplicação das políticas RLS via Supabase REST API.
 * 
 * Como usar:
 * 1. Acesse: https://supabase.com/dashboard/project/ycclyzoslirpnnwgzrqx/settings/api
 * 2. Copie o "service_role key" (secret)
 * 3. Execute: node apply-rls.js SEU_SERVICE_ROLE_KEY
 * 
 * OU copie o SQL abaixo e execute no Dashboard → SQL Editor
 */

const SUPABASE_URL = 'https://ycclyzoslirpnnwgzrqx.supabase.co'
const SERVICE_ROLE_KEY = process.argv[2]

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Uso: node apply-rls.js SEU_SERVICE_ROLE_KEY')
  console.error('   Obtenha em: https://supabase.com/dashboard/project/ycclyzoslirpnnwgzrqx/settings/api')
  process.exit(1)
}

const sql = `
-- Remove políticas antigas
DROP POLICY IF EXISTS "auth_select_tutores" ON public.tutores;
DROP POLICY IF EXISTS "auth_insert_tutores" ON public.tutores;
DROP POLICY IF EXISTS "auth_update_tutores" ON public.tutores;
DROP POLICY IF EXISTS "admin_delete_tutores" ON public.tutores;
DROP POLICY IF EXISTS "auth_select_pets" ON public.pets;
DROP POLICY IF EXISTS "auth_insert_pets" ON public.pets;
DROP POLICY IF EXISTS "auth_update_pets" ON public.pets;
DROP POLICY IF EXISTS "admin_delete_pets" ON public.pets;

-- Ativa RLS
ALTER TABLE public.tutores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

-- TUTORES: autenticados podem SELECT, INSERT, UPDATE
CREATE POLICY "auth_select_tutores" ON public.tutores FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_tutores" ON public.tutores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_tutores" ON public.tutores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_delete_tutores" ON public.tutores FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

-- PETS: autenticados podem SELECT, INSERT, UPDATE
CREATE POLICY "auth_select_pets" ON public.pets FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_pets" ON public.pets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_pets" ON public.pets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_delete_pets" ON public.pets FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
`

async function apply() {
  console.log('🚀 Aplicando políticas RLS no Supabase...')
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!response.ok) {
    // Tenta via query endpoint
    const response2 = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Prefer': 'return=minimal',
      },
    })
    
    console.log('⚠️  API REST direta não suporta DDL.')
    console.log('')
    console.log('📋 Execute este SQL manualmente no Dashboard:')
    console.log('   https://supabase.com/dashboard/project/ycclyzoslirpnnwgzrqx/sql/new')
    console.log('')
    console.log(sql)
    return
  }

  const result = await response.json()
  console.log('✅ RLS aplicado com sucesso!', result)
}

apply().catch(console.error)
