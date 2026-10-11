import type { ReactNode } from 'react'

export type Tone = 'green' | 'amber' | 'red' | 'gray' | 'accent' | 'blue'

const tones: Record<Tone, string> = {
  green: 'bg-brand-50 text-brand-700 ring-brand-600/15',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  gray: 'bg-ink-100/80 text-ink-600 ring-line-soft',
  accent: 'bg-accent-50 text-accent-700 ring-accent-500/25',
  blue: 'bg-sky-50 text-sky-800 ring-sky-600/15',
}

export function Badge({ tone = 'gray', className = '', children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={`num inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
