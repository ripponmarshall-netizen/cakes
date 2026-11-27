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

/** Eight identity tints (--av-1…8 in index.css), none of them a status colour. */
const AVATAR_TINTS = 8

export function Avatar({ name, id, size = 'md' }: { name: string; id: string; size?: 'sm' | 'md' | 'lg' }) {
  const hash = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0)
  const n = (hash % AVATAR_TINTS) + 1
  const dims = size === 'sm' ? 'h-9 w-9 text-[11px]' : size === 'lg' ? 'h-14 w-14 text-base' : 'h-10 w-10 text-xs'
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold tracking-[0.02em] ${dims}`}
      style={{ background: `rgb(var(--av-${n}-bg))`, color: `rgb(var(--av-${n}-fg))` }}
      aria-hidden
    >
      {initials(name)}
    </div>
  )
}

/**
 * The cycle, month by month: one segment per month, filled up to the current
 * one (which glows), months with no draw drawn hollow. Long cycles (over three
 * years) fall back to a plain bar.
 */
export function CycleTrack({
  term,
  rawPeriod,
  noDraw = [],
  tone = 'accent',
  track = 'bg-ink-100',
  className = '',
}: {
  term: number
  rawPeriod: number
  noDraw?: number[]
  tone?: 'accent' | 'brand'
  /** The empty segments' colour. */
  track?: string
  className?: string
}) {
  const fill = tone === 'brand' ? 'bg-brand-600' : 'bg-accent-600'
  const label = rawPeriod < 1 ? 'Not started' : rawPeriod > term ? 'Finished' : `Month ${rawPeriod} of ${term}`
  if (term > 36) {
    const pct = Math.max(0, Math.min(1, rawPeriod / term)) * 100
    return (
      <div className={`h-1.5 overflow-hidden rounded-full ${track} ${className}`} role="img" aria-label={label}>
        <div className={`h-full origin-left animate-grow-x rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    )
  }
  const skip = new Set(noDraw)
  return (
    <div className={`flex h-1.5 gap-[3px] ${className}`} role="img" aria-label={label}>
      {Array.from({ length: term }, (_, i) => {
        const m = i + 1
        const state = m < rawPeriod ? 'past' : m === rawPeriod ? 'now' : 'future'
        return (
          <span key={m} className={`relative min-w-0 flex-1 overflow-hidden rounded-full ${track}`}>
            {state !== 'future' && (
              <span
                className={`absolute inset-0 origin-left animate-grow-x rounded-full ${fill} ${state === 'now' ? 'cycle-now' : ''}`}
                style={{ animationDelay: state === 'now' ? `${Math.min(i, 24) * 22}ms, ${Math.min(i, 24) * 22 + 1200}ms` : `${Math.min(i, 24) * 22}ms` }}
              />
            )}
            {skip.has(m) && <span className="absolute inset-[1.5px] rounded-full bg-surface/90" />}
          </span>
        )
      })}
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
