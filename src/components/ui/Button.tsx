import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

// The calculator's buttons: primary is ink on the page colour (it inverts
// with the theme), secondary sits on the sunken tone with a hairline, and
// the accent is kept for the money moment (paying out a draw).
const variants: Record<Variant, string> = {
  primary: 'bg-ink-900 text-canvas hover:bg-ink-800',
  secondary: 'bg-ink-50 text-ink-900 ring-1 ring-inset ring-line hover:bg-ink-100',
  ghost: 'text-ink-500 hover:bg-ink-900/[0.05] hover:text-ink-900',
  danger: 'bg-ink-50 text-rose-600 ring-1 ring-inset ring-rose-200 hover:bg-rose-50',
  accent: 'bg-accent-600 text-accent-ink hover:bg-accent-700',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] rounded-xl',
  md: 'h-11 px-4 text-[13.5px] rounded-xl',
}

const base =
  'inline-flex shrink-0 select-none items-center justify-center gap-2 font-semibold transition duration-200 ease-out active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-45'

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

export function IconButton({
  label,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-500 transition duration-200 hover:bg-ink-900/[0.05] hover:text-ink-800 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70 disabled:pointer-events-none disabled:opacity-25 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
