'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button className={`p-2 rounded-xl border border-transparent opacity-0 ${className}`} aria-hidden="true">
        <div className="w-5 h-5" />
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className={`relative p-2 rounded-xl transition-all duration-300 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-science-200 dark:hover:text-white ${className}`}
      aria-label="Alternar tema"
      title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
    >
      <Sun className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 scale-100 opacity-100 rotate-0 dark:scale-0 dark:opacity-0 dark:-rotate-90" strokeWidth={1.5} />
      <Moon className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 scale-0 opacity-0 rotate-90 dark:scale-100 dark:opacity-100 dark:rotate-0" strokeWidth={1.5} />
      <span className="sr-only">Alternar tema</span>
      {/* Invisible spacer to maintain button size */}
      <div className="w-5 h-5 opacity-0 pointer-events-none" />
    </button>
  )
}
