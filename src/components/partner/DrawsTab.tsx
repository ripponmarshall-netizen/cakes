import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { moveSlot, scheduleOrder, shuffleUnpaid, type DrawShare } from '../../lib/calc'
import { formatDate, formatMoney, formatShortDate, periodLabel, plural } from '../../lib/format'
import type { Member, Payout } from '../../lib/types'
import { useToast } from '../ui/Toast'
import { useConfirm } from '../ui/Confirm'
import { Badge } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { VoidDialog } from './VoidDialog'
import { Avatar, type PartnerCtx } from './shared'

export function DrawsTab({ ctx, onPay }: { ctx: PartnerCtx; onPay: (share: DrawShare) => void }) {
  const { partner, members, summary, refresh } = ctx
  const { toast } = useToast()
  const confirm = useConfirm()
  const [saving, setSaving] = useState(false)
  const [voiding, setVoiding] = useState<Payout | null>(null)
  const { schedule, terms } = summary
  const memberById = new Map(members.map((m) => [m.id, m]))

  if (schedule.length === 0) {
    return (
      <EmptyState icon="gift" title="No draws yet">
        Each hand gets one draw; two half hands share one. Add members and the draw order appears here.
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

  const order = scheduleOrder(schedule)
  const canSwap = (a: number, b: number) => b >= 0 && b < schedule.length && !schedule[a].locked && !schedule[b].locked

  async function shuffle() {
    const ok = await confirm({
      title: 'Draw lots?',
      message: 'Randomly re-orders every draw that hasn’t been paid out yet. Draws already paid stay where they are; half hands keep their partner.',
      confirmLabel: 'Shuffle',
    })
    if (ok) saveOrder(shuffleUnpaid(schedule), 'Draw order shuffled')
  }

  async function voidPayout(reason: string): Promise<boolean> {
    if (!voiding) return false
    const { error } = await supabase
      .from('payouts')
      .update({ voided_at: new Date().toISOString(), void_reason: reason })
      .eq('id', voiding.id)
    if (error) {
      toast(error.message, 'error')
      return false
    }
    refresh()
    toast('Payout voided', 'info')
    return true
  }

  const perMonth = schedule.length / partner.term_months

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="num text-sm text-ink-500">
          Each draw <strong className="text-ink-800">{formatMoney(terms.netPerDraw)}</strong>
          {terms.feePerDraw > 0 && <> ({formatMoney(terms.grossPerDraw)} − {formatMoney(terms.feePerDraw)} fee)</>}
          {perMonth !== 1 && (
            <>
              {' '}
              · {Number.isInteger(perMonth) ? `${perMonth} draws a month` : `${plural(schedule.length, 'draw')} over ${partner.term_months} months`}
            </>
          )}
        </p>
        <Button size="sm" variant="secondary" onClick={shuffle} loading={saving} disabled={schedule.every((s) => s.locked)}>
          <Icon name="shuffle" size={16} /> Draw lots
        </Button>
      </div>

      <ol className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white shadow-card">
        {schedule.map((slot, i) => {
          const isNow = !slot.done && slot.period === summary.rawPeriod
          const overdue = !slot.done && slot.period < summary.rawPeriod
          return (
            <li key={slot.index} className={`flex items-center gap-3 px-3 py-3 sm:px-4 ${isNow ? 'bg-gold-50/60' : ''}`}>
              <div className="w-12 shrink-0 self-start pt-1 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Month</p>
                <p className="num text-lg font-extrabold leading-tight text-ink-800">{slot.period}</p>
              </div>
              <div className="min-w-0 flex-1 space-y-2.5">
                {slot.shares.map((share) => (
                  <ShareRow
                    key={share.memberId}
                    share={share}
                    member={memberById.get(share.memberId)}
                    startDate={partner.start_date}
                    lone={slot.half && slot.shares.length === 1}
                    status={overdue ? 'overdue' : isNow ? 'now' : null}
                    onPay={() => onPay(share)}
                    onVoid={() => share.payout && setVoiding(share.payout)}
                  />
                ))}
              </div>
              {!slot.locked && (
                <div className="flex flex-col self-center">
                  <ReorderButtons
                    up={canSwap(i, i - 1) ? () => saveOrder(moveSlot(order, i, i - 1), 'Order updated') : undefined}
                    down={canSwap(i, i + 1) ? () => saveOrder(moveSlot(order, i, i + 1), 'Order updated') : undefined}
                    disabled={saving}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <p className="text-center text-xs text-ink-400">
        Use the arrows to swap who draws when. Paid draws are locked. Two half hands share one draw and move together.
      </p>

      <VoidDialog open={!!voiding} title="Void this payout?" confirmLabel="Void payout" onClose={() => setVoiding(null)} onConfirm={voidPayout}>
        {voiding && (
          <>
            The record of {formatMoney(voiding.net)} paid to {memberById.get(voiding.member_id)?.name ?? 'this member'} on{' '}
            {formatDate(voiding.paid_on)} stops counting, and the draw opens again.
          </>
        )}
      </VoidDialog>
    </div>
  )
}

function ShareRow({
  share,
  member,
  startDate,
  lone,
  status,
  onPay,
  onVoid,
}: {
  share: DrawShare
  member: Member | undefined
  startDate: string
  lone: boolean
  status: 'overdue' | 'now' | null
  onPay: () => void
  onVoid: () => void
}) {
  if (!member) return null
  const multi = Number(member.hands) > 1
  return (
    <div className="flex items-center gap-3">
      <Avatar name={member.name} id={member.id} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-ink-900">
          {member.name}
          {share.half && <Badge tone="blue" className="ml-1.5 align-middle">½ hand</Badge>}
          {multi && !share.half && <span className="font-medium text-ink-400"> · hand {share.handNo}</span>}
        </p>
        <p className="text-xs text-ink-500">
          {share.payout ? (
            <span className="num inline-flex items-center gap-1 font-semibold text-brand-700">
              <Icon name="check" size={12} /> {formatMoney(share.payout.net)} · {formatShortDate(share.payout.paid_on)}
            </span>
          ) : (
            <>
              <span className="num">{formatMoney(share.net)}</span> · {periodLabel(startDate, share.period)}
              {status === 'overdue' && <span className="font-semibold text-rose-600"> · overdue</span>}
              {status === 'now' && <span className="font-semibold text-gold-600"> · this month</span>}
              {lone && <span className="text-ink-400"> · no half-hand partner yet</span>}
            </>
          )}
        </p>
      </div>
      {share.payout ? (
        <IconButton label="Void payout" onClick={onVoid}>
          <Icon name="undo" size={16} />
        </IconButton>
      ) : (
        <Button size="sm" variant={status ? 'gold' : 'ghost'} onClick={onPay}>
          Pay
        </Button>
      )}
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
