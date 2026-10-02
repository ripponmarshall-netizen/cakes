import { useState } from 'react'
import type { MemberSummary } from '../../lib/calc'
import { formatDate, formatHands, formatMoney, periodLabel, plural } from '../../lib/format'
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
          {plural(summary.members.length, 'member')} · {formatHands(summary.totalHands)} ·{' '}
          <strong className="text-ink-700">{formatMoney(summary.monthlyCollection)}</strong> a month
        </p>
        <Button size="sm" onClick={() => setOpenId('new')}>
          <Icon name="plus" size={16} /> Add member
        </Button>
      </div>

      {summary.members.length === 0 ? (
        <EmptyState icon="users" title="No members yet">
          Add everyone throwing a hand. Someone with two hands draws twice and pays twice each month; two half hands share a draw.
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

      {summary.former.length > 0 && (
        <section>
          <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-ink-400">Left the partner</h3>
          <ul className="divide-y divide-ink-100 rounded-2xl bg-white/60 ring-1 ring-ink-100">
            {summary.former.map((f) => (
              <li key={f.member.id} className="px-4 py-3 text-sm">
                <p className="font-semibold text-ink-600">
                  {f.member.name} <span className="font-normal text-ink-400">· {formatHands(Number(f.member.hands))}</span>
                </p>
                <p className="num text-xs text-ink-400">
                  {f.member.left_on && <>Left {formatDate(f.member.left_on)} · </>}
                  {f.member.transfer_mode === 'buyout' ? 'Hand bought by' : 'Refunded, replaced by'} {f.replacedBy?.name ?? '—'} · paid in{' '}
                  {formatMoney(f.paid)}
                  {f.refunded > 0 && <> · refunded {formatMoney(f.refunded)}</>}
                </p>
              </li>
            ))}
          </ul>
        </section>
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
      className={`w-full rounded-2xl bg-white p-4 text-left shadow-card ring-1 transition hover:ring-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
        m.risk === 'high' ? 'ring-rose-200' : 'ring-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar name={m.member.name} id={m.member.id} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink-900">{m.member.name}</p>
          <p className="num text-xs text-ink-500">
            {formatHands(m.hands)} · {formatMoney(m.monthlyDue)}/mo
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StandingBadge m={m} />
          <RiskBadge m={m} />
        </div>
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
            {m.shares.map((s) => (
              <span
                key={`${s.slotIndex}-${s.handNo}`}
                className={`inline-flex items-center gap-0.5 font-bold ${s.payout ? 'text-brand-700' : 'text-ink-700'}`}
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
