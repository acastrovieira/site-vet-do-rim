import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'
import { VetDoRimLogo } from '@/components/ui/VetDoRimLogo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export const metadata: Metadata = {
  title: 'Entrar — Lab Evolution',
  description: 'Acesse o Lab Evolution da Vet do Rim. Plataforma clínica para nefrologia veterinária.',
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-science-50 dark:bg-[#0A0A0C] px-4 py-12 relative transition-colors duration-300">
      {/* Botão flutuante de tema */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      {/* Logo + marca */}
      <Link href="/" className="flex flex-col items-center gap-2 mb-10 group" aria-label="Vet do Rim — Voltar ao site">
        {/* Logo vertical colorida no tema claro */}
        <img 
          src="/logo-vertical.svg" 
          alt="Vet do Rim" 
          className="h-20 sm:h-24 w-auto block dark:hidden group-hover:scale-103 transition-all duration-300"
        />
        {/* Logo vertical dourada no tema escuro */}
        <img 
          src="/logo-vertical-gold.svg" 
          alt="Vet do Rim" 
          className="h-20 sm:h-24 w-auto hidden dark:block group-hover:scale-103 transition-all duration-300"
        />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-science-500">Lab Evolution</span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-none p-8">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-1">Entrar na plataforma</h1>
          <p className="text-sm text-slate-500 dark:text-science-200 mb-8">Acesse o painel clínico do Lab Evolution</p>
          <LoginForm />
        </div>

        <p className="text-center text-sm text-slate-400 mt-4">
          <Link href="/auth/recuperar-senha" className="text-brand-600 dark:text-gold-400 font-semibold hover:underline">
            Esqueci minha senha
          </Link>
        </p>

        <p className="text-center text-sm text-slate-400 mt-2">
          Não tem conta?{' '}
          <Link href="/auth/cadastro" className="text-brand-600 dark:text-gold-400 font-semibold hover:underline">
            Solicitar acesso
          </Link>
        </p>
      </div>
    </div>
  )
}
