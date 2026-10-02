import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { usePresence } from '../../hooks/usePresence'
import { Icon } from './Icon'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  children: ReactNode
  /** Pinned under the content (action buttons). */
  footer?: ReactNode
}

// Modals can stack (e.g. a void dialog over a member's payments): only the top
// one reacts to Escape, and the page stays scroll-locked until the last closes.
const stack: symbol[] = []

/** Bottom sheet on phones, centred card on larger screens. Animates in and out. */
export function Modal({ open, onClose, title, subtitle, children, footer }: ModalProps) {
  const { mounted, leaving } = usePresence(open)
  const panel = useRef<HTMLDivElement>(null)
  // Callers pass inline closures; keep the latest without re-running the effect
  // (re-running would reorder the stack and let Escape close the wrong modal).
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const id = Symbol('modal')
    const returnTo = document.activeElement as HTMLElement | null
    stack.push(id)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === id) closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    // Focus the first field the dialog asked for, else the dialog itself.
    requestAnimationFrame(() => {
      const el = panel.current
      if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true })
    })
    return () => {
      document.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(id), 1)
      if (stack.length === 0) document.body.style.overflow = ''
      returnTo?.focus?.({ preventScroll: true })
    }
  }, [open])

  if (!mounted) return null

  // Portalled to <body> so no transformed or blurred ancestor can trap it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6 print:static print:block">
      <div
        className={`absolute inset-0 bg-brand-950/45 backdrop-blur-[3px] print:hidden ${leaving ? 'animate-fade-out' : 'animate-fade'}`}
        onClick={() => !leaving && onClose()}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-lift outline-none sm:max-w-lg sm:rounded-4xl print:max-h-none print:max-w-none print:overflow-visible print:shadow-none ${
          leaving ? 'pointer-events-none animate-sheet-out sm:animate-pop-out' : 'animate-sheet-in sm:animate-pop-in'
        }`}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink-200 sm:hidden print:hidden" aria-hidden />
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-4 pt-3 sm:px-7 sm:pt-6 print:hidden">
          <div className="min-w-0">
            <h2 className="truncate font-display text-[1.35rem] font-semibold leading-tight text-ink-900">{title}</h2>
            {subtitle && <p className="num mt-1 text-sm text-ink-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 focus-visible:ring-2 focus-visible:ring-brand-300"
            aria-label="Close"
          >
            <Icon name="x" size={17} />
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-7 print:overflow-visible print:p-0 ${footer ? 'pb-4' : 'pb-safe sm:pb-7'}`}>
          {children}
        </div>
        {footer && (
          <div className="pb-safe shrink-0 border-t border-ink-100 bg-white/95 px-5 pt-4 backdrop-blur sm:px-7 sm:pb-6 print:hidden">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
