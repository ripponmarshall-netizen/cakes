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
    <div className="animate-rise flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-surface/60 px-6 py-14 text-center">
      <div className="hero mb-4 flex h-14 w-14 items-center justify-center !rounded-2xl text-accent-600">
        <Icon name={icon} size={24} />
      </div>
      <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
