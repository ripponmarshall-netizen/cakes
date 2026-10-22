import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { usePresence } from '../../hooks/usePresence'
import { useSheetDrag } from '../../hooks/useSheetDrag'

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

const focusable =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Keeps Tab and Shift+Tab cycling inside the open dialog instead of reaching the page behind it. */
function trapFocus(e: KeyboardEvent, panel: HTMLElement | null) {
  if (!panel) return
  const items = [...panel.querySelectorAll<HTMLElement>(focusable)].filter((el) => el.offsetParent !== null || el === document.activeElement)
  if (items.length === 0) {
    e.preventDefault()
    panel.focus()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement
  if (e.shiftKey && (active === first || active === panel || !panel.contains(active))) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
    e.preventDefault()
    first.focus()
  }
}

/** The close mark (SF Symbols' xmark), drawn so it's crisp at any size. */
function XMark({ size = 13 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M2 2l10 10M12 2L2 12" />
    </svg>
  )
}

/**
 * Bottom sheet on phones (slides up on a soft spring; pull it down by its top
 * to close), centred card on larger screens (springs in). Animates out.
 */
export function Modal({ open, onClose, title, subtitle, children, footer }: ModalProps) {
  const { mounted, leaving } = usePresence(open)
  const panel = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const subtitleId = useId()
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
      if (stack[stack.length - 1] !== id) return
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
      } else if (e.key === 'Tab') {
        trapFocus(e, panel.current)
      }
    }
    document.addEventListener('keydown', onKey)
    if (stack.length === 1) {
      // Hold the page still: hiding the scrollbar would otherwise shift it sideways.
      const gap = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      if (gap > 0) document.body.style.paddingRight = `${gap}px`
    }
    // Focus the first field the dialog asked for, else the dialog itself.
    requestAnimationFrame(() => {
      const el = panel.current
      if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true })
    })
    return () => {
      document.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(id), 1)
      if (stack.length === 0) {
        document.body.style.overflow = ''
        document.body.style.paddingRight = ''
      }
      returnTo?.focus?.({ preventScroll: true })
    }
  }, [open])

  const flung = useSheetDrag(open && mounted, panel, body, backdrop, () => closeRef.current())

  if (!mounted) return null

  // Portalled to <body> so no transformed or blurred ancestor can trap it.
  // A sheet that's been flung leaves on its own flight, and its backdrop fades
  // from where the drag left it, so the usual exit keyframes stand aside.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] sm:items-center sm:p-6">
      <div
        ref={backdrop}
        // No backdrop blur: re-blurring the whole screen on every frame of the fade makes sheets stutter on mid-range phones.
        className={`absolute inset-0 bg-black/45 ${leaving ? (flung ? '' : 'animate-fade-out') : 'animate-[fade_0.18s_ease-out]'}`}
        onClick={() => !leaving && onClose()}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        // On phones a sheet that floats just above the bottom edge, rounder like an iOS sheet; a centred card on larger screens.
        className={`relative z-10 flex max-h-full w-full flex-col overflow-hidden rounded-[28px] bg-surface shadow-lift outline-none ring-1 ring-[color:var(--card-edge)] sm:max-h-[88dvh] sm:max-w-lg sm:rounded-4xl ${
          leaving ? `pointer-events-none ${flung ? '' : 'animate-sheet-out sm:animate-pop-out'}` : 'animate-sheet-in sm:animate-pop-in'
        }`}
      >
        <span className="grabber sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-start justify-between gap-3 px-[18px] pb-3.5 pt-3 sm:px-6 sm:pt-6">
          <div className="min-w-0 pt-1.5">
            <h2 id={titleId} className="truncate text-lg font-semibold leading-tight text-ink-900">{title}</h2>
            {subtitle && <p id={subtitleId} className="num mt-1 text-[13px] text-ink-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fill text-ink-500 hover:bg-fill-strong hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
            aria-label="Close"
          >
            <XMark />
          </button>
        </div>
        <div ref={body} className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-[18px] sm:px-6 ${footer ? 'pb-4' : 'pb-5 sm:pb-6'}`}>
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-line-soft bg-surface px-[18px] pb-[18px] pt-3.5 sm:px-6 sm:pb-6">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
