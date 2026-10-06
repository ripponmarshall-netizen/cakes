import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type ToastTone = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  actions: ToastAction[]
  leaving: boolean
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone, opts?: { actions?: ToastAction[] }) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const toneStyles: Record<ToastTone, { icon: IconName; dot: string }> = {
  success: { icon: 'check', dot: 'bg-brand-400 text-brand-950' },
  error: { icon: 'alert', dot: 'bg-rose-400 text-rose-950' },
  info: { icon: 'info', dot: 'bg-gold-300 text-ink-900' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 220)
  }, [])

  const toast = useCallback<ToastContextValue['toast']>(
    (message, tone = 'success', opts = {}) => {
      const id = Date.now() + Math.random()
      const actions = opts.actions ?? []
      setItems((prev) => [...prev.slice(-2), { id, message, tone, actions, leaving: false }])
      // Long enough to read and reach for Undo.
      timers.current.set(id, setTimeout(() => dismiss(id), actions.length ? 8000 : tone === 'error' ? 5200 : 3200))
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* At the top, so a toast never covers the buttons of a sheet that's still open. Tap to dismiss. */}
      <div
        className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`theme-light pointer-events-auto flex max-w-md cursor-pointer items-center gap-2.5 rounded-2xl bg-ink-900/95 py-2 pl-2.5 text-sm font-semibold text-white shadow-lift ring-1 ring-white/10 backdrop-blur ${
              t.actions.length ? 'pr-2' : 'pr-4'
            } ${t.leaving ? 'animate-drop-out' : 'animate-drop-in'}`}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${toneStyles[t.tone].dot}`}>
              <Icon name={toneStyles[t.tone].icon} size={13} />
            </span>
            <span className="min-w-0 py-0.5">{t.message}</span>
            {t.actions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  a.onClick()
                  dismiss(t.id)
                }}
                className="shrink-0 rounded-xl bg-white/10 px-3 py-1.5 text-[13px] font-bold text-gold-200 transition hover:bg-white/20 active:scale-95"
              >
                {a.label}
              </button>
            ))}
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
