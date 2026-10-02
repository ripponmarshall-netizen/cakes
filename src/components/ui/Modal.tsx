import { useEffect, type ReactNode } from 'react'
import { Icon } from './Icon'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  children: ReactNode
}

// Modals can stack (e.g. a void dialog over a member's payments): only the top
// one reacts to Escape, and the page stays scroll-locked until the last closes.
const stack: symbol[] = []

export function Modal({ open, onClose, title, subtitle, children }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const id = Symbol('modal')
    stack.push(id)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === id) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(id), 1)
      if (stack.length === 0) document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 print:static print:block">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px] print:hidden" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-rise relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-lift sm:max-w-lg sm:rounded-3xl sm:p-6 print:max-h-none print:max-w-none print:overflow-visible print:p-0 print:shadow-none"
      >
        <div className="mb-5 flex items-start justify-between gap-3 print:hidden">
          <div>
            <h2 className="text-lg font-bold text-ink-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 rounded-full p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            aria-label="Close"
          >
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
