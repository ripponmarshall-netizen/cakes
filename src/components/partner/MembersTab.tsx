import { useState } from 'react'
import type { MemberSummary } from '../../lib/calc'
import { formatDate, formatHands, formatMoney, periodLabel, plural } from '../../lib/format'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { MemberModal } from './MemberModal'
import { Avatar, SectionTitle, type PartnerCtx } from './shared'

export function MembersTab({ ctx }: { ctx: PartnerCtx }) {
  const { partner, summary } = ctx
  const [openId, setOpenId] = useState<string | 'new' | null>(null)
  const selected = summary.members.find((m) => m.member.id === openId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="num text-[13px] leading-snug text-ink-500">
          {plural(summary.members.length, 'member')} · {formatHands(summary.totalHands)}
          <span className="block font-semibold text-ink-800 sm:inline">
            <span className="hidden sm:inline"> · </span>
            {formatMoney(summary.monthlyCollection)} a month
          </span>
        </p>
        <Button size="sm" onClick={() => setOpenId('new')}>
          <Icon name="plus" size={15} /> Add member
        </Button>
      </div>

      {summary.members.length === 0 ? (
        <EmptyState
          icon="users"
          title="No members yet"
          action={
            <Button onClick={() => setOpenId('new')}>
              <Icon name="plus" size={16} /> Add the first member
            </Button>
          }
        >
          Add everyone throwing a hand. Someone with two hands draws twice and pays twice each month; two half hands share a draw.
        </EmptyState>
      ) : (
        <ul className="stagger space-y-2.5">
          {summary.members.map((m, i) => (
            <li key={m.member.id} style={{ ['--i' as string]: i }}>
              <MemberCard m={m} startDate={partner.start_date} rawPeriod={summary.rawPeriod} onOpen={() => setOpenId(m.member.id)} />
            </li>
          ))}
        </ul>
      )}

      {summary.former.length > 0 && (
        <section className="pt-3">
          <SectionTitle>Left the partner</SectionTitle>
          <ul className="divide-y divide-ink-100 rounded-3xl bg-white/50 ring-1 ring-inset ring-ink-900/[0.06]">
            {summary.former.map((f) => (
              <li key={f.member.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="opacity-60 grayscale">
                  <Avatar name={f.member.name} id={f.member.id} size="sm" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-ink-600">
                    {f.member.name} <span className="font-normal text-ink-400">· {formatHands(Number(f.member.hands))}</span>
                  </p>
                  <p className="num text-xs leading-relaxed text-ink-400">
                    {f.member.left_on && <>Left {formatDate(f.member.left_on)} · </>}
                    {f.member.transfer_mode === 'buyout' ? 'Hand bought by' : 'Refunded, replaced by'} {f.replacedBy?.name ?? '—'} · paid in{' '}
                    {formatMoney(f.paid)}
                    {f.refunded > 0 && <> · refunded {formatMoney(f.refunded)}</>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <MemberModal ctx={ctx} open={openId === 'new' || !!selected} summary={openId === 'new' ? null : selected} onClose={() => setOpenId(null)} />
    </div>
  )
}

function MemberCard({ m, startDate, rawPeriod, onOpen }: { m: MemberSummary; startDate: string; rawPeriod: number; onOpen: () => void }) {
  const paidShare = m.termTotal > 0 ? Math.min(1, m.paid / m.termTotal) : 0
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`card group w-full p-4 text-left transition duration-300 ease-out hover:shadow-float active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:p-5 ${
        m.risk === 'high' ? '!ring-rose-300/70' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar name={m.member.name} id={m.member.id} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-ink-900">{m.member.name}</p>
          <p className="num text-xs text-ink-500">
            {formatHands(m.hands)} · {formatMoney(m.monthlyDue)}/mo
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StandingBadge m={m} />
          <RiskBadge m={m} />
        </div>
        <Icon name="chevron-right" size={16} className="shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-500" />
      </div>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-ink-100" aria-hidden>
        <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-[width] duration-700 ease-out" style={{ width: `${paidShare * 100}%` }} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="eyebrow !text-[10px]">Paid in</p>
          <p className="num mt-0.5 font-bold text-ink-800">{formatMoney(m.paid)}</p>
        </div>
        <div>
          <p className="eyebrow !text-[10px]">Gets</p>
          <p className="num mt-0.5 font-bold text-brand-700">{formatMoney(m.entitlementNet)}</p>
        </div>
        <div>
          <p className="eyebrow !text-[10px]">Draws</p>
          <p className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5">
            {m.shares.map((s) => (
              <span
                key={`${s.slotIndex}-${s.handNo}`}
                className={`inline-flex items-center gap-0.5 font-bold ${
                  s.payout ? 'text-brand-700' : s.period < rawPeriod ? 'text-rose-600' : 'text-ink-700'
                }`}
              >
                {periodLabel(startDate, s.period).replace(/ \d{4}$/, '')}
                {s.half && <span className="font-medium text-ink-400">½</span>}
                {s.payout && <Icon name="check" size={11} />}
              </span>
            ))}
          </p>
        </div>
      </div>
    </button>
  )
}

export function StandingBadge({ m }: { m: MemberSummary }) {
  if (m.behind > 0) return <Badge tone="red">Owes {formatMoney(m.behind)}</Badge>
  if (m.ahead > 0) return <Badge tone="blue">{formatMoney(m.ahead)} ahead</Badge>
  if (m.dueToDate > 0) return <Badge tone="green">Up to date</Badge>
  return null
}

/** Shown once a member has drawn more than they've paid in. */
export function RiskBadge({ m }: { m: MemberSummary }) {
  if (!m.risk) return null
  return (
    <Badge tone={m.risk === 'high' ? 'red' : 'amber'}>
      <Icon name="shield" size={12} /> {formatMoney(m.exposure)} at risk
    </Badge>
  )
}
