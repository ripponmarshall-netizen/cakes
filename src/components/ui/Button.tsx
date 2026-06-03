import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'bg-blush-500 text-white hover:bg-blush-600 shadow-sm focus-visible:ring-blush-400',
  secondary:
    'bg-white text-cocoa-700 ring-1 ring-cocoa-200 hover:bg-blush-50 focus-visible:ring-blush-300',
  ghost: 'text-cocoa-600 hover:bg-blush-50 focus-visible:ring-blush-300',
  danger:
    'bg-white text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 focus-visible:ring-rose-300',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
}
