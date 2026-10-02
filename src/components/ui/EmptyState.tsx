import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: IconName
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="animate-rise flex flex-col items-center justify-center rounded-4xl border border-dashed border-ink-300/70 bg-white/50 px-6 py-14 text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 scale-150 rounded-full bg-gold-200/40 blur-xl" aria-hidden />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-gold-200 shadow-float">
          <Icon name={icon} size={24} />
        </div>
      </div>
      <h3 className="font-display text-xl font-semibold text-ink-900">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
