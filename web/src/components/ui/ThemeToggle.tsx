'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

export function ThemeToggle({ className = '', inverted = false }: { className?: string; inverted?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <span className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-transparent p-2 opacity-0 ${className}`} aria-hidden="true">
        <span className="block w-5 h-5" />
      </span>
    )
  }

  const isDark = resolvedTheme === 'dark'
  const toggleLabel = isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'
  const toneClasses = inverted
    ? 'text-white/70 hover:text-white hover:bg-white/10 hover:border-white/15'
    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-900/5 hover:border-slate-900/10 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/10 dark:hover:border-white/15'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-transparent p-2 transition-all duration-300 ${toneClasses} ${className}`}
      aria-label={toggleLabel}
      title={toggleLabel}
    >
      <Sun className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 scale-100 opacity-100 rotate-0 dark:scale-0 dark:opacity-0 dark:-rotate-90" strokeWidth={1.5} />
      <Moon className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 scale-0 opacity-0 rotate-90 dark:scale-100 dark:opacity-100 dark:rotate-0" strokeWidth={1.5} />
      <span className="sr-only">{toggleLabel}</span>
      {/* Invisible spacer to maintain button size */}
      <div className="w-5 h-5 opacity-0 pointer-events-none" />
    </button>
  )

}
