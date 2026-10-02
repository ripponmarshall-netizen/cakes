import { useState } from 'react'
import type { MemberSummary } from '../../lib/calc'
import { formatMoney, periodLabel, plural } from '../../lib/format'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { MemberModal } from './MemberModal'
import { Avatar, type PartnerCtx } from './shared'

export function MembersTab({ ctx }: { ctx: PartnerCtx }) {
  const { partner, summary } = ctx
  const [openId, setOpenId] = useState<string | 'new' | null>(null)
  const selected = summary.members.find((m) => m.member.id === openId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="num text-sm text-ink-500">
          {plural(summary.members.length, 'member')} · {plural(summary.totalHands, 'hand')} ·{' '}
          <strong className="text-ink-700">{formatMoney(summary.monthlyCollection)}</strong> a month
        </p>
        <Button size="sm" onClick={() => setOpenId('new')}>
          <Icon name="plus" size={16} /> Add member
        </Button>
      </div>

      {summary.members.length === 0 ? (
        <EmptyState icon="users" title="No members yet">
          Add everyone throwing a hand. Someone with two hands draws twice and pays twice each month.
        </EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {summary.members.map((m) => (
            <li key={m.member.id}>
              <MemberCard m={m} startDate={partner.start_date} onOpen={() => setOpenId(m.member.id)} />
            </li>
          ))}
        </ul>
      )}

      <MemberModal ctx={ctx} open={openId !== null} summary={openId === 'new' ? null : selected} onClose={() => setOpenId(null)} />
    </div>
  )
}

function MemberCard({ m, startDate, onOpen }: { m: MemberSummary; startDate: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl bg-white p-4 text-left shadow-card ring-1 ring-transparent transition hover:ring-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <div className="flex items-center gap-3">
        <Avatar name={m.member.name} id={m.member.id} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink-900">{m.member.name}</p>
          <p className="num text-xs text-ink-500">
            {plural(m.member.hands, 'hand')} · {formatMoney(m.monthlyDue)}/mo
          </p>
        </div>
        <StandingBadge m={m} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-ink-100 pt-3 text-xs">
        <div>
          <p className="font-semibold text-ink-400">Paid in</p>
          <p className="num mt-0.5 font-bold text-ink-800">{formatMoney(m.paid)}</p>
        </div>
        <div>
          <p className="font-semibold text-ink-400">Gets</p>
          <p className="num mt-0.5 font-bold text-brand-700">{formatMoney(m.entitlementNet)}</p>
        </div>
        <div>
          <p className="font-semibold text-ink-400">Draws</p>
          <p className="mt-0.5 flex flex-wrap gap-1">
            {m.slots.map((s) => (
              <span
                key={s.index}
                className={`inline-flex items-center gap-0.5 font-bold ${s.payout ? 'text-brand-700' : 'text-ink-700'}`}
              >
                {periodLabel(startDate, s.period).replace(/ \d{4}$/, '')}
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
