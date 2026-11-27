import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export type NoticeTone = 'info' | 'warn' | 'danger' | 'success' | 'neutral'

const tones: Record<NoticeTone, { box: string; icon: string; glyph: IconName }> = {
  info: { box: 'bg-sky-50 text-sky-900 ring-sky-200/70', icon: 'text-sky-600', glyph: 'info' },
  warn: { box: 'bg-amber-50 text-amber-900 ring-amber-200/80', icon: 'text-amber-600', glyph: 'alert' },
  danger: { box: 'bg-rose-50 text-rose-900 ring-rose-200/70', icon: 'text-rose-600', glyph: 'alert' },
  success: { box: 'bg-brand-50 text-brand-800 ring-brand-200/80', icon: 'text-brand-600', glyph: 'check' },
  neutral: { box: 'bg-ink-50 text-ink-600 ring-line-soft', icon: 'text-ink-400', glyph: 'info' },
}

/**
 * The one callout style: a tinted box with an icon, for warnings, tips and
 * errors. `children` is the message; `action` sits under it (a switch, a link).
 */
export function Notice({
  tone = 'info',
  icon,
  title,
  children,
  action,
  className = '',
  role,
}: {
  tone?: NoticeTone
  /** Defaults to the tone's own icon; pass null for none. */
  icon?: IconName | null
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
  role?: 'alert' | 'status'
}) {
  const t = tones[tone]
  const glyph = icon === undefined ? t.glyph : icon
  return (
    <div role={role} className={`rounded-2xl px-3.5 py-3 text-[13px] leading-relaxed ring-1 ring-inset ${t.box} ${className}`}>
      <div className="flex items-start gap-2.5">
        {glyph && <Icon name={glyph} size={17} className={`mt-px shrink-0 ${t.icon}`} />}
        <div className="min-w-0 flex-1">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
        </div>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
