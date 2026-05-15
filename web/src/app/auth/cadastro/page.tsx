import type { Metadata } from 'next'
import Link from 'next/link'
import { CadastroForm } from '@/components/auth/CadastroForm'
import { VetDoRimLogo } from '@/components/ui/VetDoRimLogo'

export const metadata: Metadata = {
  title: 'Solicitar Acesso — Lab Evolution',
  description: 'Crie sua conta no Lab Evolution da Vet do Rim.',
  robots: { index: false, follow: false },
}

export default function CadastroPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-science-50 to-white px-4 py-12">
      <Link href="/" className="flex flex-col items-center gap-2 mb-10 group" aria-label="Vet do Rim — Voltar ao site">
        <VetDoRimLogo
          className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 transition-transform group-hover:scale-105 duration-200"
          priority
        />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Lab Evolution</span>
      </Link>

      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50 p-8">
          <h1 className="font-display text-2xl font-bold text-slate-900 mb-1">Criar conta</h1>
          <p className="text-sm text-slate-500 mb-8">
            Cadastro disponível para médicos veterinários e tutores de pacientes renais.
          </p>
          <CadastroForm />
        </div>

        <p className="text-center text-sm text-slate-400 mt-6">
          Já tem conta?{' '}
          <Link href="/auth/login" className="text-brand-600 font-semibold hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
