import type { Metadata } from 'next'
import Link from 'next/link'
import { VetDoRimLogo } from '@/components/ui/VetDoRimLogo'
import { ResetForm } from './ResetForm'

export const metadata: Metadata = {
  title: 'Redefinir Senha — Lab Evolution',
  description: 'Defina uma nova senha para sua conta do Lab Evolution.',
  robots: { index: false, follow: false },
}

export default function RedefinirSenhaPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-science-50 to-white px-4 py-12">
      {/* Logo */}
      <Link href="/" className="flex flex-col items-center gap-2 mb-10 group" aria-label="Vet do Rim — Voltar ao site">
        <VetDoRimLogo
          className="h-24 w-40 group-hover:scale-103 transition-all duration-300"
          variant="auto"
          showText
          orientation="vertical"
        />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Lab Evolution</span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50 p-8">
          <h1 className="font-display text-2xl font-bold text-slate-900 mb-1">Nova senha</h1>
          <p className="text-sm text-slate-500 mb-8">
            Escolha uma senha segura com no mínimo 8 caracteres.
          </p>
          <ResetForm />
        </div>
      </div>
    </div>
  )
}
