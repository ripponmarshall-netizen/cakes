import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { moveSlot, shuffleUnpaid, type DrawSlot } from '../../lib/calc'
import { formatDate, formatMoney, formatShortDate, periodLabel, plural } from '../../lib/format'
import { useToast } from '../ui/Toast'
import { useConfirm } from '../ui/Confirm'
import { Button, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { Avatar, type PartnerCtx } from './shared'

export function DrawsTab({ ctx, onPay }: { ctx: PartnerCtx; onPay: (slot: DrawSlot) => void }) {
  const { partner, members, summary, refresh } = ctx
  const { toast } = useToast()
  const confirm = useConfirm()
  const [saving, setSaving] = useState(false)
  const { schedule, terms } = summary
  const memberById = new Map(members.map((m) => [m.id, m]))

  if (schedule.length === 0) {
    return (
      <EmptyState icon="gift" title="No draws yet">
        Each hand gets one draw. Add members and the draw order appears here.
      </EmptyState>
    )
  }

  async function saveOrder(order: string[], message: string) {
    setSaving(true)
    const { error } = await supabase.from('partners').update({ draw_order: order }).eq('id', partner.id)
    setSaving(false)
    if (error) return toast(error.message, 'error')
    refresh()
    toast(message)
  }

  const order = schedule.map((s) => s.memberId)
  const canSwap = (a: number, b: number) => b >= 0 && b < schedule.length && !schedule[a].payout && !schedule[b].payout

  async function shuffle() {
    const ok = await confirm({
      title: 'Draw lots?',
      message: 'Randomly re-orders every hand that hasn’t been paid out yet. Draws already paid stay where they are.',
      confirmLabel: 'Shuffle',
    })
    if (ok) saveOrder(shuffleUnpaid(schedule), 'Draw order shuffled')
  }

  async function undo(slot: DrawSlot) {
    if (!slot.payout) return
    const name = memberById.get(slot.memberId)?.name ?? 'this member'
    const ok = await confirm({
      title: 'Undo this payout?',
      message: `Deletes the record of ${formatMoney(slot.payout.net)} paid to ${name} on ${formatDate(slot.payout.paid_on)}.`,
      confirmLabel: 'Undo payout',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('payouts').delete().eq('id', slot.payout.id)
    if (error) return toast(error.message, 'error')
    refresh()
    toast('Payout removed', 'info')
  }

  const perMonth = summary.totalHands / partner.term_months

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="num text-sm text-ink-500">
          Each draw <strong className="text-ink-800">{formatMoney(terms.netPerDraw)}</strong>
          {terms.feePerDraw > 0 && <> ({formatMoney(terms.grossPerDraw)} − {formatMoney(terms.feePerDraw)} fee)</>}
          {perMonth !== 1 && (
            <>
              {' '}
              · {Number.isInteger(perMonth) ? `${perMonth} draws a month` : `${plural(summary.totalHands, 'draw')} over ${partner.term_months} months`}
            </>
          )}
        </p>
        <Button size="sm" variant="secondary" onClick={shuffle} loading={saving} disabled={schedule.every((s) => s.payout)}>
          <Icon name="shuffle" size={16} /> Draw lots
        </Button>
      </div>

      <ol className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white shadow-card">
        {schedule.map((slot, i) => {
          const m = memberById.get(slot.memberId)
          if (!m) return null
          const isNow = !slot.payout && slot.period === summary.rawPeriod
          const overdue = !slot.payout && slot.period < summary.rawPeriod
          return (
            <li key={slot.index} className={`flex items-center gap-3 px-3 py-3 sm:px-4 ${isNow ? 'bg-gold-50/60' : ''}`}>
              <div className="w-12 shrink-0 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Month</p>
                <p className="num text-lg font-extrabold leading-tight text-ink-800">{slot.period}</p>
              </div>
              <Avatar name={m.name} id={m.id} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink-900">
                  {m.name}
                  {m.hands > 1 && <span className="font-medium text-ink-400"> · hand {slot.handNo}</span>}
                </p>
                <p className="text-xs text-ink-500">
                  {slot.payout ? (
                    <span className="num inline-flex items-center gap-1 font-semibold text-brand-700">
                      <Icon name="check" size={12} /> {formatMoney(slot.payout.net)} · {formatShortDate(slot.payout.paid_on)}
                    </span>
                  ) : (
                    <>
                      {periodLabel(partner.start_date, slot.period)}
                      {overdue && <span className="font-semibold text-rose-600"> · overdue</span>}
                      {isNow && <span className="font-semibold text-gold-600"> · this month</span>}
                    </>
                  )}
                </p>
              </div>

              {slot.payout ? (
                <IconButton label="Undo payout" onClick={() => undo(slot)}>
                  <Icon name="undo" size={16} />
                </IconButton>
              ) : (
                <div className="flex items-center gap-0.5">
                  <Button size="sm" variant={isNow || overdue ? 'gold' : 'ghost'} onClick={() => onPay(slot)}>
                    Pay
                  </Button>
                  <div className="flex flex-col">
                    <ReorderButtons
                      up={canSwap(i, i - 1) ? () => saveOrder(moveSlot(order, i, i - 1), 'Order updated') : undefined}
                      down={canSwap(i, i + 1) ? () => saveOrder(moveSlot(order, i, i + 1), 'Order updated') : undefined}
                      disabled={saving}
                    />
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <p className="text-center text-xs text-ink-400">Use the arrows to swap who draws when. Paid draws are locked.</p>
    </div>
  )
}

function ReorderButtons({ up, down, disabled }: { up?: () => void; down?: () => void; disabled: boolean }) {
  return (
    <>
      <button
        type="button"
        aria-label="Move earlier"
        onClick={up}
        disabled={!up || disabled}
        className="flex h-5 w-7 items-center justify-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-800 disabled:opacity-20"
      >
        <Icon name="arrow-up" size={15} />
      </button>
      <button
        type="button"
        aria-label="Move later"
        onClick={down}
        disabled={!down || disabled}
        className="flex h-5 w-7 items-center justify-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-800 disabled:opacity-20"
      >
        <Icon name="arrow-down" size={15} />
      </button>
    </>
  )
}
