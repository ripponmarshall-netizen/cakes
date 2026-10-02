import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  leaving: boolean
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const toneStyles: Record<ToastTone, { icon: IconName; dot: string }> = {
  success: { icon: 'check', dot: 'bg-brand-400 text-brand-950' },
  error: { icon: 'alert', dot: 'bg-rose-400 text-rose-950' },
  info: { icon: 'info', dot: 'bg-gold-300 text-ink-900' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev.slice(-2), { id, message, tone, leaving: false }])
    const ttl = tone === 'error' ? 5200 : 3200
    setTimeout(() => setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))), ttl)
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), ttl + 220)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl bg-ink-900/95 py-2.5 pl-2.5 pr-4 text-sm font-semibold text-white shadow-lift ring-1 ring-white/10 backdrop-blur ${
              t.leaving ? 'animate-pop-out' : 'animate-pop-in'
            }`}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${toneStyles[t.tone].dot}`}>
              <Icon name={toneStyles[t.tone].icon} size={13} />
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
