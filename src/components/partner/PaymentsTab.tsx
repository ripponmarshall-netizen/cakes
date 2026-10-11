import { useMemo, useRef, useState } from 'react'
import { arrearsByPeriod, periodRows, type PeriodRow } from '../../lib/calc'
import { formatHands, formatMoney, methodLabels, monthNames, periodDay, periodLabel, plural, todayIso } from '../../lib/format'
import { firstName, normalizePhone, receiptMessage, waLink } from '../../lib/whatsapp'
import { logMessage, outcomeMessage, recordPayments, undoPayments } from '../../lib/ledgerWrites'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../ui/Toast'
import { useConfirm } from '../ui/Confirm'
import { Badge } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { ContributionModal, lastMethod } from './ContributionModal'
import { Avatar, ProgressBar, type PartnerCtx } from './shared'

export function PaymentsTab({ ctx, onAddMembers }: { ctx: PartnerCtx; onAddMembers: () => void }) {
  const { partner, members, contributions, summary } = ctx
  const { toast } = useToast()
  const { profile } = useAuth()
  const confirm = useConfirm()
  const T = partner.term_months
  const [period, setPeriod] = useState(() => Math.min(Math.max(summary.period, 1), T))
  const [openRow, setOpenRow] = useState<string | null>(null)

  const current = Math.min(period, T)
  const rows = useMemo(() => periodRows(partner, members, contributions, current), [partner, members, contributions, current])
  // The rows as they are now, for work that resumes after a confirm dialog.
  const latestRows = useRef(rows)
  latestRows.current = rows
  const due = rows.reduce((a, r) => a + r.due, 0)
  const paid = rows.reduce((a, r) => a + Math.min(r.paid, r.due), 0)
  const paidCount = rows.filter((r) => r.status === 'paid').length
  const open = rows.filter((r) => r.status !== 'paid')
  const draws = summary.schedule.filter((s) => s.period === current).flatMap((s) => s.shares)
  const selected = rows.find((r) => r.member.id === openRow) ?? null

  // Months other than this one that each member still owes, for the "also owes"
  // hint. Walks every month per member, so only when the data or month changes.
  const earlierById = useMemo(() => {
    const out = new Map<string, number[]>()
    for (const m of summary.members) {
      if (m.behind <= 0) continue
      const months = arrearsByPeriod(partner, members, contributions, m.member.id, summary.period)
        .map((a) => a.period)
        .filter((p) => p !== current)
      if (months.length) out.set(m.member.id, months)
    }
    return out
  }, [summary, partner, members, contributions, current])

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

  /**
   * Records the rest of the month for each row. The rows flip to Paid at once
   * (the write is queued on the phone first), so a second tap can't pay twice.
   */
  async function markPaid(rowsToPay: PeriodRow[]) {
    const payments = rowsToPay
      .filter((r) => r.remaining > 0)
      .map((r) => ({
        partner_id: partner.id,
        member_id: r.member.id,
        period: current,
        amount: r.remaining,
        paid_on: todayIso(),
        method: lastMethod(),
      }))
    if (!payments.length) return
    const one = payments.length === 1 ? rowsToPay.find((r) => r.remaining > 0)! : null
    const label = one ? `${formatMoney(one.remaining)} from ${one.member.name}` : `${payments.length} payments`
    const written = recordPayments(payments, label)
    const actions = [{ label: 'Undo', onClick: () => (undoPayments(written, label), toast('Undone', 'info')) }]
    if (one) {
      const m = summary.members.find((x) => x.member.id === one.member.id)
      const text = receiptMessage(
        partner,
        one.member.name,
        { amount: one.remaining, period: current, paid_on: payments[0].paid_on },
        m ? { monthSettled: true, behind: Math.max(0, m.behind - one.remaining) } : null,
        profile?.display_name,
      )
      if (normalizePhone(one.member.phone)) {
        actions.push({
          label: 'Receipt',
          onClick: () => {
            window.open(waLink(one.member.phone, text), '_blank', 'noreferrer')
            logMessage(partner.id, one.member.id, 'receipt')
          },
        })
      }
    }
    toast(one ? `${one.member.name} marked paid` : `${payments.length} payments recorded`, 'success', { actions })
    const msg = outcomeMessage(await written.done)
    if (msg) toast(msg.text, msg.tone)
  }

  function payOne(row: PeriodRow) {
    void markPaid([row])
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
    // Only what's still owed now: another banker may have recorded some of
    // these while the dialog was open, and paying from the old list would
    // record those twice.
    void markPaid(latestRows.current.filter((r) => r.status !== 'paid'))
  }

  const isCurrent = summary.status === 'active' && current === summary.period

  return (
    <div className="space-y-4">
      {/* Month picker + progress */}
      <div className="card p-[18px]">
        <div className="flex items-center justify-between gap-2">
          <IconButton label="Previous month" onClick={() => setPeriod(current - 1)} disabled={current <= 1} className="h-11 w-11 rounded-2xl bg-ink-50 text-ink-900 ring-1 ring-inset ring-line">
            <Icon name="chevron-left" size={20} />
          </IconButton>
          <div key={current} className="animate-fade min-w-0 text-center">
            <p className="eyebrow">
              {when} · Month {current} of {T}
            </p>
            <p className="mt-0.5 text-xl font-semibold tracking-[-0.01em] text-ink-900">{periodLabel(partner.start_date, current)}</p>
            <p className="text-xs text-ink-400">due from {periodDay(partner.start_date, current)}</p>
          </div>
          <IconButton label="Next month" onClick={() => setPeriod(current + 1)} disabled={current >= T} className="h-11 w-11 rounded-2xl bg-ink-50 text-ink-900 ring-1 ring-inset ring-line">
            <Icon name="chevron-right" size={20} />
          </IconButton>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
            <span className="mono font-semibold text-ink-900">
              {formatMoney(paid)} <span className="font-normal text-ink-400">of {formatMoney(due)}</span>
            </span>
            <span className={`text-xs font-semibold ${paidCount === rows.length ? 'text-brand-600' : 'text-ink-500'}`}>
              {paidCount === rows.length ? (
                <span className="inline-flex items-center gap-1">
                  <Icon name="check" size={13} /> All paid
                </span>
              ) : (
                <>
                  {paidCount} of {rows.length} paid
                </>
              )}
            </span>
          </div>
          <ProgressBar value={due ? paid / due : 0} label={`Paid for ${periodLabel(partner.start_date, current)}`} />
        </div>

        {draws.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line-soft pt-3.5 text-xs text-ink-500">
            <Icon name="gift" size={14} className="text-accent-600" />
            <span className="mr-0.5 font-medium">Drawing this month</span>
            {draws.map((d) => {
              const m = members.find((x) => x.id === d.memberId)
              return (
                <Badge key={`${d.slotIndex}-${d.memberId}`} tone={d.payout ? 'green' : 'accent'}>
                  {m?.name ?? '—'}
                  {d.half && ' (½)'}
                  {d.payout && <Icon name="check" size={11} className="tick" />}
                </Badge>
              )
            })}
          </div>
        )}
      </div>

      {(!isCurrent && summary.status === 'active') || open.length > 1 ? (
        <div className="flex items-center justify-between gap-2">
          {!isCurrent && summary.status === 'active' ? (
            <Button variant="ghost" size="sm" onClick={() => setPeriod(summary.period)}>
              <Icon name="calendar" size={15} /> Back to this month
            </Button>
          ) : (
            <span />
          )}
          {open.length > 1 && (
            <Button variant="secondary" size="sm" onClick={payAll}>
              <Icon name="check" size={15} /> Mark all paid
            </Button>
          )}
        </div>
      ) : null}

      {/* Member rows */}
      <ul key={current} className="card stagger divide-y divide-line-soft overflow-hidden">
        {rows.map((r, i) => (
          <li key={r.member.id} style={{ ['--i' as string]: i }} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-50/50 sm:px-5">
            <button
              type="button"
              onClick={() => setOpenRow(r.member.id)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
            >
              <Avatar name={r.member.name} id={r.member.id} />
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-semibold text-ink-900">{r.member.name}</p>
                <p className="num text-xs text-ink-500">
                  {Number(r.member.hands) !== 1 && <>{formatHands(r.member.hands)} · </>}
                  {r.status === 'partial' ? (
                    <>
                      <span className="font-semibold text-amber-700">{formatMoney(r.remaining)} left</span> of {formatMoney(r.due)}
                    </>
                  ) : (
                    formatMoney(r.due)
                  )}
                </p>
                {earlierById.has(r.member.id) && (
                  <p className="truncate text-xs font-semibold text-rose-600">Also owes {monthNames(partner.start_date, earlierById.get(r.member.id)!)}</p>
                )}
              </div>
            </button>
            {r.status === 'paid' ? (
              // Marking paid: the badge springs in, then its tick draws itself.
              <button type="button" onClick={() => setOpenRow(r.member.id)} className="animate-pop rounded-xl" aria-label={`${r.member.name}: paid — see details`}>
                <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-50 px-3 text-[13px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/20">
                  <span className="flex h-4 w-4 animate-check-pop items-center justify-center rounded-full bg-brand-600 text-canvas">
                    <Icon name="check" size={10} strokeWidth={3} className="tick" />
                  </span>
                  Paid
                </span>
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
                    onClick={() => logMessage(partner.id, r.member.id, 'reminder')}
                    aria-label={`Remind ${r.member.name} on WhatsApp`}
                    title="Remind on WhatsApp"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-400 transition hover:bg-ink-900/[0.05] hover:text-ink-900 active:scale-90"
                  >
                    <Icon name="message" size={17} />
                  </a>
                )}
                <Button size="sm" variant="secondary" onClick={() => payOne(r)} aria-label={`Mark ${r.member.name} paid (${formatMoney(r.remaining)})`}>
                  Mark paid
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="px-1 text-center text-xs text-ink-400">Tap a name for part payments, method, reference and voids.</p>

      <ContributionModal ctx={ctx} row={selected} period={current} onClose={() => setOpenRow(null)} />
    </div>
  )
}
