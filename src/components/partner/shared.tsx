import type { ReactNode } from 'react'
import type { Contribution, Member, Partner, Payout } from '../../lib/types'
import type { PartnerSummary } from '../../lib/calc'
import { initials } from '../../lib/format'

/** Everything a partner tab needs. */
export interface PartnerCtx {
  partner: Partner
  members: Member[]
  contributions: Contribution[]
  payouts: Payout[]
  summary: PartnerSummary
  refresh: () => void
}

// Muted, harmonised tints: deep text on a soft wash of the same hue.
const avatarColors = [
  'bg-brand-100 text-brand-800',
  'bg-gold-100 text-gold-700',
  'bg-sky-100 text-sky-800',
  'bg-rose-100 text-rose-800',
  'bg-amber-100 text-amber-800',
  'bg-ink-100 text-ink-700',
]

export function Avatar({ name, id, size = 'md' }: { name: string; id: string; size?: 'sm' | 'md' | 'lg' }) {
  const hash = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0)
  const dims = size === 'sm' ? 'h-9 w-9 text-[11px]' : size === 'lg' ? 'h-14 w-14 text-base' : 'h-10 w-10 text-xs'
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-surface ${dims} ${avatarColors[hash % avatarColors.length]}`}
      aria-hidden
    >
      {initials(name)}
    </div>
  )
}

export function Stat({ label, value, sub, tone = 'default' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const color = tone === 'good' ? 'text-brand-700' : tone === 'warn' ? 'text-amber-700' : tone === 'bad' ? 'text-rose-700' : 'text-ink-900'
  return (
    <div className="rounded-2xl bg-ink-50/80 p-4 ring-1 ring-inset ring-ink-900/[0.04]">
      <p className="eyebrow">{label}</p>
      <p className={`num mt-1 text-lg font-extrabold tracking-tight ${color}`}>{value}</p>
      {sub && <p className="num mt-0.5 text-xs text-ink-500">{sub}</p>}
    </div>
  )
}

export function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'gold' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className="h-2 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${tone === 'gold' ? 'bg-gradient-to-r from-gold-400 to-gold-300' : 'bg-gradient-to-r from-brand-600 to-brand-400'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/** Small uppercase heading over a group of rows or cards. */
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-1 flex items-center justify-between gap-3 px-1">
      <h3 className="eyebrow">{children}</h3>
      {right}
    </div>
  )
}
