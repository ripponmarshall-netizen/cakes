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

const avatarColors = [
  'bg-brand-100 text-brand-800',
  'bg-gold-100 text-gold-600',
  'bg-sky-100 text-sky-800',
  'bg-rose-100 text-rose-800',
  'bg-violet-100 text-violet-800',
  'bg-orange-100 text-orange-800',
]

export function Avatar({ name, id, size = 'md' }: { name: string; id: string; size?: 'sm' | 'md' }) {
  const hash = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0)
  const dims = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-xs'
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full font-bold ${dims} ${avatarColors[hash % avatarColors.length]}`}>
      {initials(name)}
    </div>
  )
}

export function Stat({ label, value, sub, tone = 'default' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'good' | 'warn' }) {
  const color = tone === 'good' ? 'text-brand-700' : tone === 'warn' ? 'text-amber-600' : 'text-ink-900'
  return (
    <div className="rounded-2xl bg-ink-50 p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
      <p className={`num mt-1 text-lg font-extrabold ${color}`}>{value}</p>
      {sub && <p className="num mt-0.5 text-xs text-ink-500">{sub}</p>}
    </div>
  )
}

export function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'gold' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className="h-2 overflow-hidden rounded-full bg-ink-100">
      <div
        className={`h-full rounded-full transition-all duration-500 ${tone === 'gold' ? 'bg-gold-400' : 'bg-brand-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
