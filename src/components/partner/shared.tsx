import type { ReactNode } from 'react'
import type { CashCount, Contribution, Member, Partner, Payout, Reminder } from '../../lib/types'
import type { PartnerSummary } from '../../lib/calc'
import { initials } from '../../lib/format'

/** Everything a partner tab needs. */
export interface PartnerCtx {
  partner: Partner
  members: Member[]
  contributions: Contribution[]
  payouts: Payout[]
  reminders: Reminder[]
  cashCounts: CashCount[]
  summary: PartnerSummary
  refresh: () => Promise<void>
}

/** When a member was last sent a WhatsApp reminder, if ever. */
export function lastReminded(reminders: Reminder[], memberId: string): string | null {
  let last: string | null = null
  for (const r of reminders) if (r.member_id === memberId && r.kind === 'reminder' && (!last || r.created_at > last)) last = r.created_at
  return last
}

// Muted, harmonised tints: deep text on a soft wash of the same hue.
const avatarColors = [
  'bg-brand-100 text-brand-800',
  'bg-accent-100 text-accent-700',
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
    <div className="rounded-2xl bg-ink-50 p-4 ring-1 ring-inset ring-line-soft">
      <p className="eyebrow">{label}</p>
      <p className={`mono mt-1 text-lg font-semibold ${color}`}>{value}</p>
      {sub && <p className="num mt-0.5 text-xs text-ink-500">{sub}</p>}
    </div>
  )
}

export function ProgressBar({ value, label, tone = 'brand' }: { value: number; label: string; tone?: 'brand' | 'accent' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className="h-2 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`h-full origin-left animate-grow-x rounded-full transition-[width] duration-700 ease-out ${tone === 'accent' ? 'bg-accent-600' : 'bg-brand-600'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/** Small label over a group of rows or cards. */
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-1 flex items-center justify-between gap-3 px-1">
      <h3 className="eyebrow">{children}</h3>
      {right}
    </div>
  )
}
