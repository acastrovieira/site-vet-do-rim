import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { VetDoRimLogo } from '@/components/ui/VetDoRimLogo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { ResetForm } from './ResetForm'
import {
  RECOVERY_COOKIE_NAME,
  RECOVERY_COOKIE_VALUE,
} from '@/lib/auth-recovery'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Redefinir Senha — Lab Evolution',
  description: 'Defina uma nova senha para sua conta do Lab Evolution.',
  robots: { index: false, follow: false },
}

export default async function RedefinirSenhaPage() {
  const cookieStore = await cookies()
  const recoveryAuthorized = cookieStore.get(RECOVERY_COOKIE_NAME)?.value === RECOVERY_COOKIE_VALUE

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
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-1">Nova senha</h1>
          <p className="text-sm text-slate-500 dark:text-science-200 mb-8">
            Escolha uma senha segura com no mínimo 8 caracteres.
          </p>
          <ResetForm recoveryAuthorized={recoveryAuthorized} />
        </div>
      </div>
    </div>
  )
}
