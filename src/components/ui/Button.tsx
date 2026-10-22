import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive' | 'accent'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

// The calculator's buttons after its iOS refresh: primary is ink on the
// card colour (it inverts with the theme), secondary is a plain gray fill
// (no outline), as iOS draws secondary actions, and the accent is kept for
// the money moment (paying out a draw). danger is red text on the gray
// fill; destructive is the solid red of a confirm dialog's Delete.
const variants: Record<Variant, string> = {
  primary: 'bg-ink-900 text-surface hover:bg-ink-800',
  secondary: 'bg-fill text-ink-900 hover:bg-fill-strong',
  ghost: 'text-ink-500 hover:bg-fill hover:text-ink-900',
  danger: 'bg-fill text-rose-600 hover:bg-fill-strong',
  destructive: 'bg-rose-600 text-white hover:bg-rose-700',
  accent: 'bg-accent-600 text-accent-ink hover:bg-accent-700',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] rounded-xl',
  md: 'h-11 px-4 text-[14px] rounded-xl',
}

const base =
  'tap inline-flex shrink-0 select-none items-center justify-center gap-2 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-45'

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  )
}

/** A link styled as a button (WhatsApp, tel:). */
export function LinkButton({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <a className={buttonClass(variant, size, className)} {...props}>
      {children}
    </a>
  )
}

/**
 * A round gray button, as iOS draws toolbar and close buttons. 40px by
 * default (44 where there's room: pass h-11 w-11); `plain` drops the fill for
 * quiet inline actions in dense rows.
 */
export function IconButton({
  label,
  plain = false,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; plain?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`tap inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70 disabled:pointer-events-none disabled:opacity-30 ${
        plain ? 'text-ink-400 hover:bg-fill hover:text-ink-900' : 'bg-fill text-ink-900 hover:bg-fill-strong'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
