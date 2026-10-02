import type { ReactNode } from 'react'

export type Tone = 'green' | 'amber' | 'red' | 'gray' | 'gold' | 'blue'

const tones: Record<Tone, string> = {
  green: 'bg-brand-50 text-brand-700 ring-brand-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  gray: 'bg-ink-50 text-ink-500 ring-ink-200',
  gold: 'bg-gold-50 text-gold-600 ring-gold-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
}

export function Badge({ tone = 'gray', className = '', children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
