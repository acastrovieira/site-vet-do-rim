import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'
import { VetDoRimLogo } from '@/components/ui/VetDoRimLogo'

export const metadata: Metadata = {
  title: 'Entrar — Lab Evolution',
  description: 'Acesse o Lab Evolution da Vet do Rim. Plataforma clínica para nefrologia veterinária.',
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-science-50 to-white px-4 py-12">
      {/* Logo + marca */}
      <Link href="/" className="flex flex-col items-center gap-2 mb-10 group" aria-label="Vet do Rim — Voltar ao site">
        <VetDoRimLogo
          className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 transition-transform group-hover:scale-105 duration-200"
          priority
        />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Lab Evolution</span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50 p-8">
          <h1 className="font-display text-2xl font-bold text-slate-900 mb-1">Entrar na plataforma</h1>
          <p className="text-sm text-slate-500 mb-8">Acesse o painel clínico do Lab Evolution</p>
          <LoginForm />
        </div>

        <p className="text-center text-sm text-slate-400 mt-6">
          Não tem conta?{' '}
          <Link href="/auth/cadastro" className="text-brand-600 font-semibold hover:underline">
            Solicitar acesso
          </Link>
        </p>
      </div>
    </div>
  )
}
