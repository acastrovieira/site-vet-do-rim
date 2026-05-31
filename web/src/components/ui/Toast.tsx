'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, CheckCircle2, Info, AlertCircle } from 'lucide-react'

/* ── Tipos ──────────────────────────────────────────────── */

export type ToastType = 'error' | 'success' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

/* ── Contexto ───────────────────────────────────────────── */

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return ctx
}

/* ── Helpers visuais ────────────────────────────────────── */

const config: Record<ToastType, {
  icon: React.ElementType
  bg: string
  border: string
  iconColor: string
  titleColor: string
  bar: string
}> = {
  error: {
    icon: AlertCircle,
    bg: 'rgba(20, 8, 8, 0.97)',
    border: 'rgba(239, 68, 68, 0.4)',
    iconColor: '#f87171',
    titleColor: '#fca5a5',
    bar: '#ef4444',
  },
  success: {
    icon: CheckCircle2,
    bg: 'rgba(4, 16, 10, 0.97)',
    border: 'rgba(52, 211, 153, 0.4)',
    iconColor: '#34d399',
    titleColor: '#6ee7b7',
    bar: '#10b981',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'rgba(18, 14, 4, 0.97)',
    border: 'rgba(251, 191, 36, 0.4)',
    iconColor: '#fbbf24',
    titleColor: '#fde68a',
    bar: '#f59e0b',
  },
  info: {
    icon: Info,
    bg: 'rgba(4, 10, 20, 0.97)',
    border: 'rgba(96, 165, 250, 0.4)',
    iconColor: '#60a5fa',
    titleColor: '#93c5fd',
    bar: '#3b82f6',
  },
}

/* ── Card de Toast Individual ───────────────────────────── */

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: () => void
}) {
  const c = config[toast.type]
  const Icon = c.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 80, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, y: 40 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      role="alert"
      aria-live="assertive"
      className="relative w-full max-w-sm overflow-hidden pointer-events-auto"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '16px',
        boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px ${c.border}, inset 0 1px 0 rgba(255,255,255,0.05)`,
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Barra lateral colorida */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ background: c.bar }}
        aria-hidden
      />

      {/* Conteúdo */}
      <div className="pl-5 pr-4 py-4 flex items-start gap-3.5">
        {/* Ícone */}
        <div
          className="shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${c.bar}20` }}
          aria-hidden
        >
          <Icon className="w-4.5 h-4.5" style={{ color: c.iconColor }} strokeWidth={2} />
        </div>

        {/* Texto */}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold leading-snug"
            style={{ color: c.titleColor }}
          >
            {toast.title}
          </p>
          {toast.message && (
            <p
              className="text-xs mt-1 leading-relaxed break-words"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              {toast.message}
            </p>
          )}
        </div>

        {/* Fechar */}
        <button
          onClick={onDismiss}
          aria-label="Fechar notificação"
          className="shrink-0 -mr-1 -mt-0.5 p-1.5 rounded-lg transition-all duration-150 hover:bg-white/10 active:scale-95"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Barra de progresso auto-dismiss */}
      <motion.div
        className="absolute bottom-0 left-1 right-0 h-0.5 origin-left"
        style={{ background: c.bar, opacity: 0.5 }}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: 6, ease: 'linear' }}
      />
    </motion.div>
  )
}

/* ── Provider + Portal ──────────────────────────────────── */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(({ type, title, message }: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts(prev => [...prev.slice(-4), { id, type, title, message }])

    const timer = setTimeout(() => dismiss(id), 6000)
    timers.current.set(id, timer)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}

      {/* Portal de toasts — canto inferior direito */}
      <div
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none"
        aria-label="Notificações"
      >
        <AnimatePresence mode="sync">
          {toasts.map(t => (
            <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
