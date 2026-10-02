import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { periodRows, type PeriodRow } from '../../lib/calc'
import { formatHands, formatMoney, methodLabels, periodDay, periodLabel, plural, todayIso } from '../../lib/format'
import { firstName, normalizePhone, waLink } from '../../lib/whatsapp'
import { useToast } from '../ui/Toast'
import { useConfirm } from '../ui/Confirm'
import { Badge } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { ContributionModal, lastMethod } from './ContributionModal'
import { Avatar, ProgressBar, type PartnerCtx } from './shared'

export function PaymentsTab({ ctx, onAddMembers }: { ctx: PartnerCtx; onAddMembers: () => void }) {
  const { partner, members, contributions, summary, refresh } = ctx
  const { toast } = useToast()
  const confirm = useConfirm()
  const T = partner.term_months
  const [period, setPeriod] = useState(() => Math.min(Math.max(summary.period, 1), T))
  const [busy, setBusy] = useState<string | null>(null)
  const [openRow, setOpenRow] = useState<string | null>(null)

  const current = Math.min(period, T)
  const rows = useMemo(() => periodRows(partner, members, contributions, current), [partner, members, contributions, current])
  const due = rows.reduce((a, r) => a + r.due, 0)
  const paid = rows.reduce((a, r) => a + Math.min(r.paid, r.due), 0)
  const paidCount = rows.filter((r) => r.status === 'paid').length
  const open = rows.filter((r) => r.status !== 'paid')
  const draws = summary.schedule.filter((s) => s.period === current).flatMap((s) => s.shares)
  const selected = rows.find((r) => r.member.id === openRow) ?? null

  const when =
    summary.status === 'upcoming' || current > summary.rawPeriod
      ? 'Upcoming'
      : current === summary.rawPeriod
        ? 'This month'
        : 'Past month'

  if (members.length === 0) {
    return (
      <EmptyState icon="users" title="Add members first" action={<Button onClick={onAddMembers}>Add members</Button>}>
        Once members and their hands are in, you can tick off payments month by month here.
      </EmptyState>
    )
  }

  async function markPaid(rowsToPay: PeriodRow[]) {
    const inserts = rowsToPay
      .filter((r) => r.remaining > 0)
      .map((r) => ({
        partner_id: partner.id,
        member_id: r.member.id,
        period: current,
        amount: r.remaining,
        paid_on: todayIso(),
        method: lastMethod(),
      }))
    if (!inserts.length) return
    const { error } = await supabase.from('contributions').insert(inserts)
    if (error) return toast(error.message, 'error')
    refresh()
    toast(inserts.length === 1 ? `${rowsToPay[0].member.name} marked paid` : `${inserts.length} payments recorded`)
  }

  async function payOne(row: PeriodRow) {
    setBusy(row.member.id)
    await markPaid([row])
    setBusy(null)
  }

  async function payAll() {
    const total = open.reduce((a, r) => a + r.remaining, 0)
    const ok = await confirm({
      title: `Mark everyone paid for ${periodLabel(partner.start_date, current)}?`,
      message: (
        <>
          Records {plural(open.length, 'payment')} totalling <strong className="num">{formatMoney(total)}</strong>, dated today
          {' '}by {methodLabels[lastMethod()].toLowerCase()}.
        </>
      ),
      confirmLabel: 'Mark all paid',
    })
    if (!ok) return
    setBusy('all')
    await markPaid(open)
    setBusy(null)
  }

  return (
    <div className="space-y-4">
      {/* Month picker + progress */}
      <div className="rounded-2xl bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <IconButton label="Previous month" onClick={() => setPeriod(current - 1)} disabled={current <= 1}>
            <Icon name="chevron-left" size={20} />
          </IconButton>
          <div className="text-center">
            <p className="font-extrabold text-ink-900">
              Month {current} <span className="font-semibold text-ink-400">· {periodLabel(partner.start_date, current)}</span>
            </p>
            <p className="text-xs font-semibold text-ink-400">
              {when} · from {periodDay(partner.start_date, current)}
            </p>
          </div>
          <IconButton label="Next month" onClick={() => setPeriod(current + 1)} disabled={current >= T}>
            <Icon name="chevron-right" size={20} />
          </IconButton>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="num font-bold text-ink-800">
              {formatMoney(paid)} <span className="font-medium text-ink-400">of {formatMoney(due)}</span>
            </span>
            <span className="text-xs font-semibold text-ink-500">
              {paidCount} of {rows.length} paid
            </span>
          </div>
          <ProgressBar value={due ? paid / due : 0} />
        </div>

        {draws.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-ink-100 pt-3 text-xs text-ink-500">
            <Icon name="gift" size={14} className="text-gold-500" />
            <span className="font-semibold">Drawing:</span>
            {draws.map((d) => {
              const m = members.find((x) => x.id === d.memberId)
              return (
                <Badge key={`${d.slotIndex}-${d.memberId}`} tone={d.payout ? 'green' : 'gold'}>
                  {m?.name ?? '—'}
                  {d.half && ' (½)'}
                  {d.payout && <Icon name="check" size={12} />}
                </Badge>
              )
            })}
          </div>
        )}
      </div>

      {open.length > 1 && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={payAll} loading={busy === 'all'}>
            <Icon name="check" size={16} /> Mark all paid
          </Button>
        </div>
      )}

      {/* Member rows */}
      <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white shadow-card">
        {rows.map((r) => (
          <li key={r.member.id} className="flex items-center gap-3 px-4 py-3">
            <button type="button" onClick={() => setOpenRow(r.member.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <Avatar name={r.member.name} id={r.member.id} />
              <div className="min-w-0">
                <p className="truncate font-bold text-ink-900">{r.member.name}</p>
                <p className="num text-xs text-ink-500">
                  {Number(r.member.hands) !== 1 && <>{formatHands(r.member.hands)} · </>}
                  {r.status === 'partial' ? (
                    <>
                      <span className="font-semibold text-amber-600">{formatMoney(r.remaining)} left</span> of {formatMoney(r.due)}
                    </>
                  ) : (
                    formatMoney(r.due)
                  )}
                </p>
              </div>
            </button>
            {r.status === 'paid' ? (
              <button type="button" onClick={() => setOpenRow(r.member.id)}>
                <Badge tone="green">
                  <Icon name="check" size={12} /> Paid
                </Badge>
              </button>
            ) : (
              <div className="flex items-center gap-1">
                {r.member.phone && normalizePhone(r.member.phone) && (
                  <a
                    href={waLink(
                      r.member.phone,
                      `Hi ${firstName(r.member.name)}, reminder for ${partner.name}: ${formatMoney(r.remaining)} for ${periodLabel(partner.start_date, current)} (month ${current}). Thanks!`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Remind ${r.member.name} on WhatsApp`}
                    title="Remind on WhatsApp"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-400 transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    <Icon name="message" size={17} />
                  </a>
                )}
                <Button size="sm" variant="secondary" onClick={() => payOne(r)} loading={busy === r.member.id}>
                  Mark paid
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <ContributionModal ctx={ctx} row={selected} period={current} onClose={() => setOpenRow(null)} />
    </div>
  )
}
