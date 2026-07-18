import type { Metadata } from 'next'
import Link from 'next/link'
import { VetDoRimLogo } from '@/components/ui/VetDoRimLogo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { RecoverForm } from './RecoverForm'

export const metadata: Metadata = {
  title: 'Recuperar Senha — Lab Evolution',
  description: 'Recupere o acesso à sua conta do Lab Evolution.',
  robots: { index: false, follow: false },
}

interface RecuperarSenhaPageProps {
  searchParams?: Promise<{ error?: string | string[] }>
}

export default async function RecuperarSenhaPage({ searchParams }: RecuperarSenhaPageProps) {
  const params = await searchParams
  const errorCode = Array.isArray(params?.error) ? params?.error[0] : params?.error
  const linkError = errorCode === 'link_expirado'
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-science-50 to-white dark:from-[#0C1E3D] dark:to-[#091530] px-4 py-12 relative transition-colors duration-300">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>
      {/* Logo */}
      <Link href="/" className="flex flex-col items-center gap-2 mb-10 group" aria-label="Vet do Rim — Voltar ao site">
        <VetDoRimLogo
          className="h-24 w-40 group-hover:scale-103 transition-all duration-300"
          variant="auto"
          showText
          orientation="vertical"
        />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-science-500">Lab Evolution</span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-[#0F2244] rounded-2xl border border-slate-100 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/20 p-8">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-1">Recuperar senha</h1>
          <p className={`text-sm text-slate-500 dark:text-science-200 ${linkError ? 'mb-4' : 'mb-8'}`}>
            Informe seu e-mail cadastrado e enviaremos um link para redefinir sua senha.
          </p>
          {linkError && (
            <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300" role="alert">
              Este link é inválido, expirou ou já foi utilizado. Solicite um novo link abaixo.
            </p>
          )}
          <RecoverForm />
        </div>

        <p className="text-center text-sm text-slate-400 dark:text-science-400 mt-6">
          Lembrou a senha?{' '}
          <Link href="/auth/login" className="text-brand-600 dark:text-gold-400 font-semibold hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
