import type { Metadata } from 'next'
import Link from 'next/link'
import { CadastroForm } from '@/components/auth/CadastroForm'
import { VetDoRimLogo } from '@/components/ui/VetDoRimLogo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export const metadata: Metadata = {
  title: 'Solicitar Acesso — Lab Evolution',
  description: 'Crie uma conta de tutor no Lab Evolution da Vet do Rim.',
  robots: { index: false, follow: false },
}

export default function CadastroPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-science-50 dark:bg-[#0A0A0C] px-4 py-12 relative transition-colors duration-300">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <Link href="/" className="flex flex-col items-center gap-2 mb-10 group" aria-label="Vet do Rim — Voltar ao site">
        <VetDoRimLogo
          className="h-24 w-40 group-hover:scale-103 transition-all duration-300"
          variant="auto"
          showText
          orientation="vertical"
        />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-science-500">Lab Evolution</span>
      </Link>

      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-none p-8">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-1">Criar conta</h1>
          <p className="text-sm text-slate-500 dark:text-science-200 mb-8">
            Auto cadastro disponível para tutores. O acesso profissional permanece
            indisponível até a conclusão do processo seguro de verificação.
          </p>
          <CadastroForm />
        </div>

        <p className="text-center text-sm text-slate-400 dark:text-science-300 mt-6">
          Já tem conta?{' '}
          <Link href="/auth/login" className="text-brand-600 dark:text-gold-400 font-semibold hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
