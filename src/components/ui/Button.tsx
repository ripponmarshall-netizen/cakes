import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'theme-light bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_6px_16px_-8px_rgba(18,59,46,0.7)] hover:from-brand-700 hover:to-brand-800 focus-visible:ring-brand-400',
  secondary: 'bg-surface text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-50 hover:ring-ink-300 focus-visible:ring-brand-300',
  ghost: 'text-ink-600 hover:bg-ink-900/[0.05] hover:text-ink-900 focus-visible:ring-brand-300',
  danger: 'bg-surface text-rose-600 ring-1 ring-inset ring-rose-200 hover:bg-rose-50 focus-visible:ring-rose-300',
  gold: 'theme-light bg-gradient-to-b from-gold-300 to-gold-400 text-ink-900 shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_6px_16px_-8px_rgba(141,106,47,0.8)] hover:from-gold-400 hover:to-gold-500 focus-visible:ring-gold-300',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] rounded-xl',
  md: 'h-12 px-5 text-sm rounded-2xl',
}

const base =
  'inline-flex shrink-0 select-none items-center justify-center gap-2 font-semibold transition duration-200 ease-out active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-45'

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
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-500 transition duration-200 hover:bg-ink-900/[0.05] hover:text-ink-800 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:pointer-events-none disabled:opacity-25 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
