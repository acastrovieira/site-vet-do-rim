'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ToastProvider } from '@/components/ui/Toast'
import {
  LayoutDashboard,
  Users,
  FlaskConical,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Settings,
} from 'lucide-react'
import { useState, useTransition } from 'react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row'] | null

interface LabShellProps {
  children: React.ReactNode
  user: User
  profile: Profile
}

const navItems = [
  { href: '/lab', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/lab/pacientes', label: 'Pacientes', icon: FlaskConical },
  { href: '/lab/tutores', label: 'Tutores', icon: Users },
]

/**
 * Shell (sidebar + topbar) do Lab Evolution.
 * Server layout passa user/profile; este componente é client-side para interatividade.
 */
export function LabShell({ children, user, profile }: LabShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/')
      router.refresh()
    })
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const displayName = profile?.full_name ?? user.email ?? 'Usuário'
  const roleLabel = profile?.role === 'vet' ? 'Veterinário(a)' : profile?.role === 'admin' ? 'Admin' : 'Tutor'

  return (
    <ToastProvider>
      <div className="min-h-screen flex">
      {/* ── Sidebar ───────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 glass-card border-r flex flex-col transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navegação do Lab Evolution"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-200 dark:border-white/5">
          <Image src="/logo.svg" alt="Vet do Rim" width={80} height={80} className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0" priority />
          <div>
            <span className="font-display font-bold text-sm text-slate-900 dark:text-white leading-none tracking-tight">Vet do Rim</span>
            <span className="block text-[10px] text-gold-400 font-medium tracking-wider mt-0.5">Lab Evolution</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Menu principal">
          {navItems.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive(href, exact)
                  ? 'bg-gold-400/10 text-gold-400 border border-gold-400/20'
                  : 'text-slate-600 dark:text-science-200 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
              }`}
              aria-current={isActive(href, exact) ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              {label}
              {isActive(href, exact) && (
                <ChevronRight className="h-3.5 w-3.5 ml-auto text-gold-400" aria-hidden />
              )}
            </Link>
          ))}
        </nav>

        {/* User + Links + Logout */}
        <div className="px-4 py-4 border-t border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-gold-400/10 text-gold-400 flex items-center justify-center text-xs font-bold shrink-0 border border-gold-400/20">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{displayName}</p>
              <p className="text-[10px] text-slate-500 dark:text-science-200">{roleLabel}</p>
            </div>
            <ThemeToggle className="scale-75 origin-right" />
          </div>
          <Link
            href="/lab/perfil"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-science-200 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors duration-200 mb-1"
          >
            <Settings className="h-4 w-4" aria-hidden />
            Meu perfil
          </Link>
          <button
            onClick={handleLogout}
            disabled={isPending}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-science-200 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors duration-200"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {isPending ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/20 dark:bg-black/20 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Main ──────────────────────────────── */}
      <div className="flex-1 md:ml-64 flex flex-col">
        {/* Topbar mobile */}
        <header className="h-16 glass-card border-b flex items-center gap-3 px-4 md:hidden sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-slate-600 dark:text-science-200 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
            aria-label="Abrir menu"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="font-display font-bold text-sm text-slate-900 dark:text-white flex-1">Lab Evolution</span>
          <ThemeToggle />
        </header>

        {/* Content */}
        <main className="flex-1 p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
      </div>
    </ToastProvider>
  )
}
